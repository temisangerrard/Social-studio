// ── Social Studio — app.js (orchestrator) ─────────────────────────────────────
// Thin entry point: imports modules, wires listeners, runs bootstrap.

import { buildCanvasCards } from "./app-helpers.js";
import { CanvasEngine, downloadArtboard, downloadAllAsZip } from "./canvas-engine.js";

import { studioState } from "./state.js";
import { els, calEls } from "./dom-refs.js";
import {
  showStatus, hideStatus, showChatStatus, hideChatStatus,
  setCheckpoint, resetCheckpoints, showCanvasProgress, hideCanvasProgress,
  setButtonLoading, clearButtonLoading, copyText, getWorkflowPreset, makeId, getBrandById
} from "./ui-utils.js";
import { uploadQueue, loadExistingUploads, renderUploadedAssets, analyzeUploadedAssetRecord, onAssetDeleted } from "./upload-manager.js";
import {
  buildReferenceAssets, renderReferenceChips, renderRoutePreview,
  renderInlineRoutePreview, refreshRoutePreview, updateContentTypeSelector, updateWorkflowUI
} from "./references.js";
import {
  initAssetModalListeners, outputAssets, renderInspectorPackage, renderInspectorAsset,
  renderCanvas, applyBrandSelectionRing, clearBrandSelectionRing,
  populateDetailPanel, hideDetailPanel, regenerateSlide
} from "./inspector.js";
import {
  pollJob, syncCardsFromBrief, loadOutputToEngine,
  runGeneration, finishGeneration, mergeRefinedOutput, downloadAllAssets
} from "./generation.js";
import { loadCalendar, initCalendarListeners } from "./calendar-view.js";
import { loadLibrary, initLibraryListeners, loadOutputIntoCanvas } from "./library-view.js";
import { loadAdmin, initAdminListeners } from "./admin-view.js";
import { renderBrandEditor, initBrandEditorListeners } from "./brand-editor.js";
import { InlineEditor, schedulePatch } from "./inline-editor.js";

// ── View routing ──────────────────────────────────────────────────────────────
function switchView(name) {
  Object.entries(els.views).forEach(([key, el]) => el.classList.toggle("hidden", key !== name));
  els.navLinks.forEach((link) => link.classList.toggle("is-active", link.dataset.view === name));
  if (name === "library") loadLibrary();
  if (name === "calendar") loadCalendar();
  if (name === "admin") loadAdmin();
}

els.navLinks.forEach((link) => link.addEventListener("click", (e) => { e.preventDefault(); switchView(link.dataset.view); }));
document.addEventListener("studio:switch-view", (e) => switchView(e.detail));

// ── Asset modal listeners ─────────────────────────────────────────────────────
initAssetModalListeners();

// ── Session helpers ───────────────────────────────────────────────────────────
async function persistSession() {
  if (!studioState.session) return;
  await fetch(`/api/assistant/sessions/${studioState.session.id}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...studioState.session, workspaceCards: studioState.canvasCards })
  });
}

async function createSession(productId) {
  showStatus("Loading product context…");
  const res = await fetch("/api/assistant/sessions", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId })
  });
  studioState.session = await res.json();
  studioState.generatedOutput = null;
  studioState.canvasCards = studioState.session.workspaceCards || [];
  studioState.selectedAsset = null;
  renderMessages(); renderCanvas(); renderInspectorPackage(); renderInspectorAsset();
  hideStatus();
}

// ── Messages ──────────────────────────────────────────────────────────────────
function renderMessages() {
  if (!els.studioMessageThread) return;
  els.studioMessageThread.innerHTML = "";
  (studioState.session?.messages || []).filter((m) => m.role !== "system").forEach((msg) => {
    const el = document.createElement("article");
    el.className = `message-bubble message-bubble--${msg.role === "user" ? "user" : "assistant"}`;
    el.innerHTML = `<strong>${msg.role === "user" ? "You" : "Social Studio"}</strong><p>${msg.text}</p>`;
    els.studioMessageThread.appendChild(el);
  });
  els.studioMessageThread.scrollTop = els.studioMessageThread.scrollHeight;
}

function renderCheckpoints() {
  if (!studioState.session) return;
  els.studioCheckpoints.forEach((node) => {
    const status = studioState.session.checkpoints?.[node.dataset.step] || "pending";
    node.classList.remove("is-active", "is-done");
    if (status === "active") node.classList.add("is-active");
    if (status === "done") node.classList.add("is-done");
  });
}

// ── Quick form submit ─────────────────────────────────────────────────────────
els.studioQuickForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const idea = els.studioIdeaInput.value.trim();
  if (!idea) return;

  setButtonLoading(els.studioSubmit, "Planning…");
  showStatus("Planning content strategy…");
  resetCheckpoints();
  const routeInlineEl = document.getElementById("studio-route-inline");
  if (routeInlineEl) routeInlineEl.classList.add("hidden");
  setCheckpoint("strategy", "active");
  studioState.canvasLoadingStage = "planning";
  studioState.canvasCards = buildCanvasCards({ goal: idea, audience: null, offer: els.studioNotesInput.value.trim() || null, tone: els.studioVisualMode.value, platform: els.studioPlatformSelect.value }, null, makeId);
  renderCanvas();
  showCanvasProgress("Planning content strategy…");

  try {
    if (uploadQueue.files.length > 0) {
      showStatus("Uploading images…");
      try {
        const uploadResults = await uploadQueue.uploadAll();
        for (const result of uploadResults) { if (studioState.canvasEngine) studioState.canvasEngine.addUploadedArtboard(result); }
        const failedItems = uploadQueue.files.filter((item) => item.status === "error");
        if (failedItems.length > 0) {
          const mimeErrors = failedItems.filter((item) => item.error && /unsupported|mime|400/i.test(item.error));
          if (mimeErrors.length > 0) showStatus(`${mimeErrors.length} file(s) skipped — unsupported file type. Use PNG, JPEG, WebP, or GIF.`);
          else showStatus(`${failedItems.length} upload(s) failed — network error. Files kept in queue for retry.`);
          uploadQueue.files = uploadQueue.files.filter((item) => item.status !== "done");
          uploadQueue._updateBadge();
        } else { uploadQueue.clear(); }
      } catch (uploadErr) { console.error("[studio] Upload error:", uploadErr); showStatus("Upload failed — files kept in queue for retry."); }
    }
    const output = await runGeneration(idea, els.studioNotesInput.value.trim());
    finishGeneration(output);
    clearButtonLoading(els.studioSubmit);
    renderInspectorPackage();
  } catch (err) {
    studioState.canvasLoadingStage = null;
    hideCanvasProgress();
    clearButtonLoading(els.studioSubmit);
    showCanvasProgress(err instanceof Error ? err.message : String(err));
    resetCheckpoints();
  }
});

// ── Chat ──────────────────────────────────────────────────────────────────────
if (els.chatToggle) els.chatToggle.addEventListener("click", () => {
  const open = !els.chatPanel.classList.contains("hidden");
  els.chatPanel.classList.toggle("hidden", open);
  els.chatToggle.classList.toggle("is-active", !open);
});

function inferWorkflow(text) {
  const v = String(text || "").toLowerCase();
  if (/\breel\b|\bvoiceover\b/.test(v)) return "reel-package";
  if (/\bvideo\b|\bclip\b/.test(v)) return "video-clip";
  if (/\bvariant\b|\bpack\b/.test(v)) return "mascot-variants";
  if (/\bedit\b|\brefine\b/.test(v)) return "reference-edit";
  if (/\blinkedin\b.*\btext\b|\btext.only\b|\btext\spost\b/.test(v)) return "linkedin-text";
  if (/\blinkedin\b|\bcarousel\b/.test(v)) return "linkedin-carousel";
  return "slideshow";
}

async function submitChatAnswer(text) {
  const isFirst = (studioState.session?.messages || []).filter((m) => m.role === "user").length === 0;
  const res = await fetch(`/api/assistant/sessions/${studioState.session.id}/reply`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error("Failed to get assistant reply.");
  const { session, shouldGenerate } = await res.json();
  studioState.session = session;
  if (isFirst) { studioState.workflowType = inferWorkflow(text); updateWorkflowUI(); }
  syncCardsFromBrief(); renderMessages(); renderCanvas(); renderCheckpoints();

  if (shouldGenerate) {
    studioState.session.checkpoints = studioState.session.checkpoints || {};
    studioState.session.checkpoints.strategy = "active";
    studioState.canvasLoadingStage = "planning";
    renderCheckpoints(); renderCanvas();
    showCanvasProgress("Planning content strategy…");
    setButtonLoading(els.studioChatSubmit, "Working…");
    const firstMsg = studioState.session.messages.find((m) => m.role === "user")?.text || text;
    try {
      const output = await runGeneration(firstMsg, "");
      finishGeneration(output);
      studioState.session.checkpoints.visuals = "done";
      studioState.session.checkpoints.finalPackage = "done";
      studioState.session.messages.push({ id: makeId("msg"), role: "assistant", text: `Done — ${getWorkflowPreset(studioState.workflowType).label.toLowerCase()} placed on the canvas.`, createdAt: new Date().toISOString() });
      syncCardsFromBrief(); clearButtonLoading(els.studioChatSubmit); hideChatStatus();
      renderMessages(); renderCanvas(); renderCheckpoints(); renderInspectorPackage(); renderInspectorAsset();
      await persistSession();
    } catch (err) {
      studioState.canvasLoadingStage = null; hideCanvasProgress(); clearButtonLoading(els.studioChatSubmit);
      studioState.session.messages.push({ id: makeId("msg"), role: "assistant", text: `Hit a problem: ${err instanceof Error ? err.message : String(err)}`, createdAt: new Date().toISOString() });
      renderMessages(); renderCanvas(); renderCheckpoints(); hideChatStatus();
      await persistSession();
    }
  }
}

if (els.studioChatForm) els.studioChatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = els.studioChatInput.value.trim();
  if (!text || !studioState.session) return;
  els.studioChatInput.value = "";
  showChatStatus("Thinking…"); setButtonLoading(els.studioChatSubmit, "Sending…");
  try { await submitChatAnswer(text); }
  catch (err) { showChatStatus(err instanceof Error ? err.message : String(err)); }
  finally { if (!studioState.canvasLoadingStage) { clearButtonLoading(els.studioChatSubmit); hideChatStatus(); } }
});

// ── Refinement form ───────────────────────────────────────────────────────────
els.studioRefineForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!studioState.selectedAsset) { els.studioRefineStatus.classList.remove("hidden"); els.studioRefineStatus.textContent = "Select an asset first."; return; }
  els.studioRefineStatus.classList.remove("hidden"); els.studioRefineStatus.textContent = "Generating refined variant…";
  setButtonLoading(els.studioRefineSubmit, "Refining…");
  const brandId = els.studioProductSelect.value;
  const request = {
    brandProfileId: brandId,
    rawIdea: els.studioRefinePrompt.value.trim() || studioState.selectedAsset.prompt || studioState.selectedAsset.text,
    notes: "Refinement request.", cards: [], references: [],
    referenceAssets: buildReferenceAssets({ brandId, visualMode: els.studioRefineVisualMode.value, inputValue: "", selectedAsset: studioState.selectedAsset }),
    platformTargets: [els.studioPlatformSelect.value],
    goal: getBrandById(brandId)?.defaults?.goal || "awareness",
    workflowType: "reference-edit", visualMode: els.studioRefineVisualMode.value,
    targetAssetId: studioState.selectedAsset.itemId, deliveryTargets: els.studioDeliveryTarget.value
  };
  try {
    const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
    const { jobId } = await res.json();
    const output = await pollJob(jobId);
    studioState.generatedOutput = mergeRefinedOutput(studioState.generatedOutput, output, els.studioRefineMode.value, studioState.selectedAsset);
    studioState.selectedAsset = outputAssets(studioState.generatedOutput).at(-1) || null;
    studioState.canvasCards = buildCanvasCards(studioState.session?.inferredBrief || {}, studioState.generatedOutput, makeId);
    renderCanvas(); loadOutputToEngine(studioState.generatedOutput); renderInspectorPackage(); renderInspectorAsset();
    els.studioRefineStatus.textContent = "Done.";
  } catch (err) { els.studioRefineStatus.textContent = err instanceof Error ? err.message : String(err); }
  finally { clearButtonLoading(els.studioRefineSubmit); }
});

// ── Download all ──────────────────────────────────────────────────────────────
els.studioDownloadAllBtn.addEventListener("click", downloadAllAssets);
document.getElementById("toolbar-download-all-btn")?.addEventListener("click", downloadAllAssets);

// ── Export buttons ────────────────────────────────────────────────────────────
async function triggerExport(format) {
  const postId = studioState.generatedOutput?.post_id;
  if (!postId) return;
  const btn = document.getElementById(`toolbar-export-${format}`);
  if (btn) { btn.disabled = true; btn.textContent = "…"; }
  try {
    const url = format === "pdf"
      ? `/api/outputs/${postId}/export/pdf`
      : `/api/outputs/${postId}/export/zip?platform=instagram&platform=tiktok&platform=linkedin`;
    const res = await fetch(url);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Export failed");
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = format === "pdf" ? `${postId}-carousel.pdf` : `${postId}-platforms.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (err) { showStatus(err instanceof Error ? err.message : "Export failed."); }
  finally { if (btn) { btn.disabled = false; btn.textContent = format.toUpperCase(); } }
}
document.getElementById("toolbar-export-pdf")?.addEventListener("click", () => triggerExport("pdf"));
document.getElementById("toolbar-export-zip")?.addEventListener("click", () => triggerExport("zip"));

// ── Copy buttons ──────────────────────────────────────────────────────────────
els.inspectorCopyCaption.addEventListener("click", () => copyText(studioState.generatedOutput?.caption || "", "Caption"));
els.inspectorCopyHashtags.addEventListener("click", () => copyText((studioState.generatedOutput?.hashtags || []).join(" "), "Hashtags"));

// ── Product/mode change listeners ─────────────────────────────────────────────
els.studioProductSelect.addEventListener("change", async () => {
  renderBrandEditor(els.studioProductSelect.value); renderReferenceChips();
  updateContentTypeSelector(els.studioProductSelect.value);
  await refreshRoutePreview(); await createSession(els.studioProductSelect.value);
});
els.studioVisualMode.addEventListener("change", () => { renderReferenceChips(); refreshRoutePreview(); });
els.studioReferenceInput.addEventListener("input", renderReferenceChips);
els.studioIdeaInput.addEventListener("input", () => refreshRoutePreview());
els.studioNotesInput.addEventListener("input", () => refreshRoutePreview());
els.studioPlatformSelect.addEventListener("change", () => refreshRoutePreview());
els.studioContentTypeSelect?.addEventListener("change", () => refreshRoutePreview());
// ── Style preset change listener ──────────────────────────────────────────────
if (els.studioStylePreset) {
  els.studioStylePreset.addEventListener("change", () => {
    const styleId = els.studioStylePreset.value;
    studioState.selectedStyleId = styleId;
    const hasStyle = !!styleId;
    if (els.studioStyleControls) els.studioStyleControls.classList.toggle("hidden", !hasStyle);
    if (hasStyle) {
      const style = studioState.stylePresets.find((s) => s.id === styleId);
      if (style && els.studioStylePreviewBody) {
        els.studioStylePreview.classList.remove("hidden");
        const tags = style.visualTraits.tone.map((t) => `<span class="style-tag">${t}</span>`).join("");
        const avoids = style.negativeConstraints.slice(0, 4).map((c) => `<span class="style-tag">${c}</span>`).join("");
        els.studioStylePreviewBody.innerHTML = `
          <div class="style-section"><div class="style-section-label">Intent</div>${style.intent}</div>
          <div class="style-section"><div class="style-section-label">Tone</div>${tags}</div>
          <div class="style-section"><div class="style-section-label">Image</div>${style.imageStyle}</div>
          <div class="style-section"><div class="style-section-label">Layout</div>${style.layoutStyle}</div>
          <div class="style-section"><div class="style-section-label">Avoids</div>${avoids}</div>
        `;
      }
    } else if (els.studioStylePreview) {
      els.studioStylePreview.classList.add("hidden");
    }
  });
}
els.studioUploadTrigger?.addEventListener("click", () => els.studioReferenceFiles.click());
document.getElementById("toolbar-upload-btn")?.addEventListener("click", () => els.studioReferenceFiles.click());

els.studioReferenceFiles.addEventListener("change", async () => {
  showStatus("Uploading references…");
  try {
    for (const file of Array.from(els.studioReferenceFiles.files || [])) {
      const dataUrl = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsDataURL(file); });
      const res = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name, dataUrl }) });
      const uploadedAsset = await res.json();
      const analysis = await analyzeUploadedAssetRecord(uploadedAsset);
      studioState.uploadedAssets.push(uploadedAsset);
      studioState.assetAnalyses = [...studioState.assetAnalyses.filter((item) => item.assetId !== analysis.assetId), analysis];
      const current = els.studioReferenceInput.value.trim();
      els.studioReferenceInput.value = [current, uploadedAsset.url].filter(Boolean).join("\n");
    }
    renderReferenceChips(); renderUploadedAssets(); await refreshRoutePreview(); hideStatus();
  } catch (err) { showStatus(err instanceof Error ? err.message : "Upload failed."); }
  finally { els.studioReferenceFiles.value = ""; }
});

els.studioUploadedAssets?.addEventListener("change", async (e) => {
  const wrapper = e.target.closest("[data-upload-id]");
  if (!wrapper) return;
  const asset = studioState.uploadedAssets.find((item) => item.id === wrapper.dataset.uploadId);
  if (!asset) return;
  asset.label = wrapper.querySelector('[data-upload-field="label"]')?.value?.trim() || "";
  asset.notes = wrapper.querySelector('[data-upload-field="notes"]')?.value?.trim() || "";
  const analysis = await analyzeUploadedAssetRecord(asset);
  studioState.assetAnalyses = [...studioState.assetAnalyses.filter((item) => item.assetId !== asset.id), analysis];
  renderUploadedAssets(); await refreshRoutePreview();
});

// ── Init sub-view listeners ───────────────────────────────────────────────────
onAssetDeleted(() => { renderReferenceChips(); refreshRoutePreview(); });
initCalendarListeners();
initLibraryListeners();
initAdminListeners();
initBrandEditorListeners();

// ── Load products ─────────────────────────────────────────────────────────────
async function loadProducts() {
  const [productsRes, brandsRes, stylesRes] = await Promise.all([fetch("/api/products"), fetch("/api/brands"), fetch("/api/styles")]);
  studioState.products = await productsRes.json();
  studioState.brands = await brandsRes.json();
  studioState.stylePresets = await stylesRes.json();
  els.studioProductSelect.innerHTML = studioState.products.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
  els.studioProductSelect.value = "peppera";
  calEls.brandSelect.innerHTML = `<option value="">All brands</option>` + studioState.products.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
  calEls.libraryBrandFilter.innerHTML = `<option value="">All brands</option>` + studioState.brands.map((b) => `<option value="${b.id}">${b.name}</option>`).join("");
  // Populate style preset selector
  if (els.studioStylePreset) {
    els.studioStylePreset.innerHTML = `<option value="">None — use default</option>` +
      studioState.stylePresets.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
  }
}

// ── Mobile inspector ──────────────────────────────────────────────────────────
function initMobileInspector() {
  const fab = document.getElementById("canvas-fab-inspector");
  const inspector = document.getElementById("studio-inspector");
  const closeBtn = document.getElementById("inspector-overlay-close");
  if (!fab || !inspector) return;
  function open() { inspector.classList.add("studio-inspector--overlay", "is-open"); inspector.style.display = ""; }
  function close() { inspector.classList.remove("is-open"); setTimeout(() => { if (!inspector.classList.contains("is-open")) inspector.classList.remove("studio-inspector--overlay"); }, 300); }
  fab.addEventListener("click", () => inspector.classList.contains("is-open") ? close() : open());
  if (closeBtn) closeBtn.addEventListener("click", close);
  const mql = window.matchMedia("(max-width: 640px)");
  function handleMobile(e) { if (!studioState.canvasEngine) return; e.matches ? studioState.canvasEngine.arrangeVertical() : (studioState.canvasEngine.arrangeHorizontal(), close()); }
  mql.addEventListener("change", handleMobile);
  if (mql.matches && studioState.canvasEngine) studioState.canvasEngine.arrangeVertical();
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap() {
  await loadProducts();
  renderBrandEditor("peppera");
  updateContentTypeSelector("peppera");
  updateWorkflowUI();
  renderUploadedAssets();
  renderRoutePreview();
  await Promise.all([createSession("peppera"), loadExistingUploads()]);

  const stageEl = document.querySelector(".studio-canvas-stage");
  const inspector = document.getElementById("studio-inspector");

  if (stageEl) {
    try {
      const toolbarEl = document.getElementById("studio-quick-form");
      studioState.canvasEngine = new CanvasEngine(stageEl, {
        toolbarEl,
        onSelect: (artboardDesc) => {
          const aiPrompt = document.getElementById("canvas-ai-prompt");
          if (artboardDesc) {
            studioState.selectedAsset = {
              itemId: artboardDesc.id, assetKind: artboardDesc.type, role: artboardDesc.role,
              text: artboardDesc.text || artboardDesc.label, prompt: artboardDesc.prompt,
              assetUrl: artboardDesc.assetUrl, sourceAssetId: null, variantGroup: null,
              slideNumber: artboardDesc.slideNumber, order: artboardDesc.order
            };
            applyBrandSelectionRing(artboardDesc);
            // Show the canvas AI prompt bar
            if (aiPrompt) aiPrompt.classList.remove("hidden");
          } else {
            studioState.selectedAsset = null;
            clearBrandSelectionRing(); renderInspectorAsset(); hideDetailPanel();
            if (inspector) inspector.classList.add("hidden");
            if (aiPrompt) aiPrompt.classList.add("hidden");
          }
        },
        onReorder: (orderedIds) => { if (studioState.generatedOutput) studioState.generatedOutput._artboardOrder = orderedIds; },
        onZoomChange: () => {},
        onRegenerate: async (desc) => {
          const postId = studioState.generatedOutput?.post_id;
          if (!postId || desc.slideNumber == null) return;
          try { showStatus("Regenerating slide…"); const result = await regenerateSlide(postId, desc.slideNumber, desc.prompt); if (result && studioState.canvasEngine) { studioState.generatedOutput = result; loadOutputToEngine(result); } hideStatus(); }
          catch (err) { showStatus(err instanceof Error ? err.message : "Regeneration failed."); }
        },
        onDownload: (desc) => downloadArtboard(desc),
        onDelete: (desc) => { if (confirm("Delete this artboard?")) studioState.canvasEngine.removeArtboard(desc.id); },
        onDuplicate: (desc) => studioState.canvasEngine.duplicateArtboard(desc.id)
      });

      // Double-click → InlineEditor
      stageEl.addEventListener("dblclick", (e) => {
        // Double-click on overlay → inline edit
        const overlay = e.target.closest(".canvas-overlay");
        if (overlay) {
          const bodyEl = overlay.querySelector(".canvas-overlay__body") || overlay;
          studioState.canvasEngine._pointer.setEditingActive(true);
          InlineEditor.activate(bodyEl, {
            multiline: true, required: false,
            onCommit: (text) => {
              studioState.canvasEngine._pointer.setEditingActive(false);
              const overlayId = overlay.dataset.overlayId;
              const desc = studioState.canvasEngine._artboardManager.overlays.find((o) => o.id === overlayId);
              if (desc) desc.text = text;
              const output = studioState.generatedOutput;
              const postId = output?.post_id;
              if (postId && desc) {
                if (desc.type === "caption") { output.caption = text; schedulePatch(postId, { caption: text }); }
                else if (desc.type === "hook") { const hooks = studioState.canvasEngine._artboardManager.overlays.filter((o) => o.type === "hook").map((o) => o.text); output.hooks = hooks; schedulePatch(postId, { hooks }); }
                else if (desc.type === "hashtag") { const hashtags = text.split(/\s+/).filter(Boolean); output.hashtags = hashtags; schedulePatch(postId, { hashtags }); }
              }
            },
            onCancel: () => studioState.canvasEngine._pointer.setEditingActive(false)
          });
          return;
        }

        // Double-click on artboard → open inspector
        const artboardEl = e.target.closest(".canvas-artboard");
        if (artboardEl && studioState.selectedAsset) {
          const desc = studioState.canvasEngine._artboardManager.artboards.find((a) => a.id === artboardEl.dataset.artboardId);
          if (desc) {
            renderInspectorPackage(); renderInspectorAsset(); populateDetailPanel(desc);
            if (inspector) inspector.classList.remove("hidden");
          }
        }
      });
    } catch (err) { console.error("[studio] CanvasEngine creation FAILED:", err); }
  }

  // ── Canvas AI prompt — inline LLM helper ──────────────────────────────────
  const aiForm = document.getElementById("canvas-ai-prompt");
  const aiInput = document.getElementById("canvas-ai-input");
  const aiSubmit = aiForm?.querySelector(".canvas-ai-submit");
  const aiStatus = document.getElementById("canvas-ai-status");

  if (aiForm) aiForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = aiInput?.value?.trim();
    const sel = studioState.selectedAsset;
    const postId = studioState.generatedOutput?.post_id;
    if (!text || !sel || !postId) return;

    aiSubmit.disabled = true;
    aiSubmit.textContent = "Working…";
    if (aiStatus) { aiStatus.textContent = ""; aiStatus.classList.add("hidden"); }

    try {
      if (sel.slideNumber != null) {
        // Regenerate the selected slide with the user's instruction as the prompt
        const result = await regenerateSlide(postId, sel.slideNumber, text);
        if (result?.slide) {
          // Swap the image in the DOM
          const artboardId = sel.itemId;
          const artboardEl = document.querySelector(`.canvas-artboard[data-artboard-id="${artboardId}"]`);
          if (artboardEl) {
            const img = artboardEl.querySelector("img");
            if (img && result.slide.asset_path) {
              const filename = result.slide.asset_path.split("/").pop();
              img.src = `/api/assets/${postId}/${filename}?t=${Date.now()}`;
            }
          }
          // Update in-memory
          const slides = studioState.generatedOutput?.slides || [];
          const idx = slides.findIndex((s) => (s.slide_number ?? 0) === sel.slideNumber);
          if (idx >= 0) slides[idx] = { ...slides[idx], asset_path: result.slide.asset_path, image_prompt: text };
        }
        if (aiStatus) { aiStatus.textContent = "✓ Updated"; aiStatus.classList.remove("hidden"); }
      } else {
        if (aiStatus) { aiStatus.textContent = "Select a slide first"; aiStatus.classList.remove("hidden"); }
      }
      aiInput.value = "";
      setTimeout(() => { if (aiStatus) aiStatus.classList.add("hidden"); }, 2000);
    } catch (err) {
      if (aiStatus) { aiStatus.textContent = err instanceof Error ? err.message : "Failed"; aiStatus.classList.remove("hidden"); }
    } finally {
      aiSubmit.disabled = false;
      aiSubmit.textContent = "Ask AI";
    }
  });

  // Escape key: hide inspector
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && inspector && !inspector.classList.contains("hidden")) inspector.classList.add("hidden"); });

  // File picker → upload queue
  const fileInput = document.getElementById("toolbar-image-upload");
  if (fileInput) fileInput.addEventListener("change", () => { if (fileInput.files?.length) { uploadQueue.add(fileInput.files); fileInput.value = ""; } });

  // Drag-and-drop on canvas stage
  if (stageEl) {
    stageEl.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; stageEl.classList.add("drop-zone-active"); });
    stageEl.addEventListener("dragleave", (e) => { if (!stageEl.contains(e.relatedTarget)) stageEl.classList.remove("drop-zone-active"); });
    stageEl.addEventListener("drop", (e) => {
      e.preventDefault(); stageEl.classList.remove("drop-zone-active");
      const files = e.dataTransfer?.files;
      if (files?.length) { const imgs = Array.from(files).filter((f) => f.type.startsWith("image/")); if (imgs.length) { const dt = new DataTransfer(); imgs.forEach((f) => dt.items.add(f)); uploadQueue.add(dt.files); } }
    });
  }

  initMobileInspector();

  // Drawer toggle
  const drawerToggle = document.getElementById("toolbar-drawer-toggle");
  const drawer = document.getElementById("studio-drawer");
  const drawerClose = document.getElementById("drawer-close");
  if (drawerToggle && drawer) {
    drawerToggle.addEventListener("click", () => drawer.classList.toggle("hidden"));
    if (drawerClose) drawerClose.addEventListener("click", () => drawer.classList.add("hidden"));
  }

  // Inspector toggle from toolbar
  const inspectorToggle = document.getElementById("toolbar-inspector-toggle");
  if (inspectorToggle && inspector) inspectorToggle.addEventListener("click", () => inspector.classList.toggle("hidden"));

  // Inspector dismiss
  const inspectorClose = document.getElementById("inspector-overlay-close");
  if (inspectorClose && inspector) inspectorClose.addEventListener("click", () => inspector.classList.add("hidden"));

  els.studioIdeaInput.focus();
}

bootstrap()
  .then(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get("view");
    const postIdParam = params.get("postId");
    if (viewParam) switchView(viewParam);
    if (postIdParam) loadOutputIntoCanvas(postIdParam);
  })
  .catch((err) => showStatus(err instanceof Error ? err.message : String(err)));
