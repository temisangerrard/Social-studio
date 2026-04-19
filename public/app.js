import {
  buildCanvasCards,
  escapeHtml,
  getArtifactPreviewUrl,
  getPlatformPublishLinks,
  getWorkflowPresets,
  getWorkspaceAssetUrl,
  titleCase
} from "./app-helpers.js";

import {
  CanvasEngine,
  downloadArtboard,
  downloadAllAsZip,
  buildDownloadFilename
} from "./canvas-engine.js";

const WORKFLOW_PRESETS = getWorkflowPresets();

// ── State ─────────────────────────────────────────────────────────────────────
const studioState = {
  products: [],
  brands: [],
  session: null,
  canvasCards: [],
  generatedOutput: null,
  selectedAsset: null,
  workflowType: "slideshow",
  canvasLoadingStage: null,
  downloading: false,
  canvasEngine: null
};

// ── Element refs ──────────────────────────────────────────────────────────────
const els = {
  navLinks: Array.from(document.querySelectorAll(".topnav a[data-view]")),
  views: {
    studio: document.getElementById("view-studio"),
    calendar: document.getElementById("view-calendar"),
    library: document.getElementById("view-library")
  },

  studioProductSelect: document.getElementById("studio-product-select"),
  studioPlatformSelect: document.getElementById("studio-platform-select"),
  studioVisualMode: document.getElementById("studio-visual-mode"),
  studioDeliveryTarget: document.getElementById("studio-delivery-target"),

  studioWorkflowPresets: document.getElementById("studio-workflow-presets"),
  studioWorkflowSummary: document.getElementById("studio-workflow-summary"),

  studioQuickForm: document.getElementById("studio-quick-form"),
  studioIdeaInput: document.getElementById("studio-idea-input"),
  studioNotesInput: document.getElementById("studio-notes-input"),
  studioReferenceInput: document.getElementById("studio-reference-input"),
  studioReferenceFiles: document.getElementById("studio-reference-files"),
  studioReferenceChipset: document.getElementById("studio-reference-chipset"),
  studioStatus: document.getElementById("studio-status"),
  studioSubmit: document.getElementById("studio-submit"),

  chatToggle: document.getElementById("chat-toggle"),
  chatPanel: document.getElementById("chat-panel"),
  studioMessageThread: document.getElementById("studio-message-thread"),
  studioChatForm: document.getElementById("studio-chat-form"),
  studioChatInput: document.getElementById("studio-chat-input"),
  studioChatSubmit: document.getElementById("studio-chat-submit"),
  studioChatStatus: document.getElementById("studio-chat-status"),

  studioCheckpoints: Array.from(document.querySelectorAll("#studio-checkpoint-strip .checkpoint")),

  canvas: document.getElementById("canvas"),
  canvasEmpty: document.getElementById("canvas-empty"),
  canvasProgressPill: document.getElementById("canvas-progress-pill"),
  canvasProgressText: document.getElementById("canvas-progress-text"),

  inspectorPackage: document.getElementById("inspector-package"),
  inspectorPackageStatus: document.getElementById("inspector-package-status"),
  inspectorCaptionText: document.getElementById("inspector-caption-text"),
  inspectorHashtagsText: document.getElementById("inspector-hashtags-text"),
  inspectorHooksList: document.getElementById("inspector-hooks-list"),
  inspectorPublishLinks: document.getElementById("inspector-publish-links"),
  inspectorCopyCaption: document.getElementById("inspector-copy-caption"),
  inspectorCopyHashtags: document.getElementById("inspector-copy-hashtags"),
  studioDownloadAllBtn: document.getElementById("studio-download-all-btn"),

  inspectorAsset: document.getElementById("inspector-asset"),
  inspectorAssetTitle: document.getElementById("inspector-asset-title"),
  inspectorAssetHint: document.getElementById("inspector-asset-hint"),
  inspectorAssetPreview: document.getElementById("inspector-asset-preview"),
  studioRefineForm: document.getElementById("studio-refine-form"),
  studioRefinePrompt: document.getElementById("studio-refine-prompt"),
  studioRefineVisualMode: document.getElementById("studio-refine-visual-mode"),
  studioRefineMode: document.getElementById("studio-refine-mode"),
  studioRefineStatus: document.getElementById("studio-refine-status"),
  studioRefineSubmit: document.getElementById("studio-refine-submit"),

  brandMascotName: document.getElementById("brand-mascot-name"),
  brandMascotRole: document.getElementById("brand-mascot-role"),
  brandMascotVisualPrompt: document.getElementById("brand-mascot-visual-prompt"),
  brandMascotRules: document.getElementById("brand-mascot-rules"),
  brandMascotReferences: document.getElementById("brand-mascot-references"),
  brandMascotRefFiles: document.getElementById("brand-mascot-ref-files"),
  brandMascotRefStatus: document.getElementById("brand-mascot-ref-status"),
  brandEditorStatus: document.getElementById("brand-editor-status"),
  brandEditorSave: document.getElementById("brand-editor-save"),

  libraryList: document.getElementById("library-list"),

  assetModal: document.getElementById("asset-modal"),
  assetModalImage: document.getElementById("asset-modal-image"),
  assetModalVideo: document.getElementById("asset-modal-video"),
  assetModalTitle: document.getElementById("asset-modal-title"),
  assetModalOpen: document.getElementById("asset-modal-open"),
  assetModalDownload: document.getElementById("asset-modal-download"),
  assetModalClose: document.getElementById("asset-modal-close")
};

// ── Calendar element refs ─────────────────────────────────────────────────────
const calEls = {
  brandSelect: document.getElementById("calendar-brand-select"),
  weekPrev: document.getElementById("calendar-week-prev"),
  weekNext: document.getElementById("calendar-week-next"),
  weekLabel: document.getElementById("calendar-week-label"),
  grid: document.getElementById("calendar-grid"),
  pillarsList: document.getElementById("pillars-list"),
  addPillarBtn: document.getElementById("add-pillar-btn"),
  batchGenerate: document.getElementById("calendar-batch-generate"),
  autoFill: document.getElementById("calendar-auto-fill"),
  calendarStatus: document.getElementById("calendar-status"),
  // Pillar modal
  pillarModal: document.getElementById("pillar-modal"),
  pillarModalClose: document.getElementById("pillar-modal-close"),
  pillarForm: document.getElementById("pillar-form"),
  pillarName: document.getElementById("pillar-name"),
  pillarDescription: document.getElementById("pillar-description"),
  pillarFrequency: document.getElementById("pillar-frequency"),
  pillarPlatform: document.getElementById("pillar-platform"),
  pillarIdeas: document.getElementById("pillar-ideas"),
  pillarDelete: document.getElementById("pillar-delete"),
  // Slot modal
  slotModal: document.getElementById("slot-modal"),
  slotModalClose: document.getElementById("slot-modal-close"),
  slotModalTitle: document.getElementById("slot-modal-title"),
  slotForm: document.getElementById("slot-form"),
  slotIdea: document.getElementById("slot-idea"),
  slotPillar: document.getElementById("slot-pillar"),
  slotPlatform: document.getElementById("slot-platform"),
  slotStatus: document.getElementById("slot-status"),
  slotDelete: document.getElementById("slot-delete"),
  // Library filters
  libraryBrandFilter: document.getElementById("library-brand-filter"),
  libraryPlatformFilter: document.getElementById("library-platform-filter"),
  librarySearch: document.getElementById("library-search")
};

// ── Calendar state ────────────────────────────────────────────────────────────
const calendarState = {
  weekOffset: 0,
  slots: [],
  pillars: [],
  selectedSlotIds: new Set(),
  editingPillarId: null,
  editingSlotId: null,
  editingSlotDate: null
};

// ── Routing ───────────────────────────────────────────────────────────────────
function switchView(name) {
  Object.entries(els.views).forEach(([key, el]) => {
    el.classList.toggle("hidden", key !== name);
  });
  els.navLinks.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.view === name);
  });
  if (name === "library") loadLibrary();
  if (name === "calendar") loadCalendar();
}

els.navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    switchView(link.dataset.view);
  });
});

// ── Utilities ─────────────────────────────────────────────────────────────────
function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function getBrandById(id) {
  return studioState.brands.find((b) => b.id === id) || null;
}

function showStatus(text) {
  els.studioStatus.classList.remove("hidden");
  els.studioStatus.textContent = text;
}

function hideStatus() {
  els.studioStatus.classList.add("hidden");
}

function showChatStatus(text) {
  els.studioChatStatus.classList.remove("hidden");
  els.studioChatStatus.textContent = text;
}

function hideChatStatus() {
  els.studioChatStatus.classList.add("hidden");
}

function setCheckpoint(step, status) {
  els.studioCheckpoints.forEach((node) => {
    if (node.dataset.step !== step) return;
    node.classList.remove("is-active", "is-done");
    if (status === "active") node.classList.add("is-active");
    if (status === "done") node.classList.add("is-done");
  });
}

function resetCheckpoints() {
  els.studioCheckpoints.forEach((node) => node.classList.remove("is-active", "is-done"));
}

function showCanvasProgress(text) {
  els.canvasProgressText.textContent = text;
  els.canvasProgressPill.classList.remove("hidden");
}

function hideCanvasProgress() {
  els.canvasProgressPill.classList.add("hidden");
}

function setButtonLoading(btn, text) {
  btn.disabled = true;
  btn.dataset.origText = btn.textContent.trim();
  btn.textContent = text;
  btn.classList.add("is-loading");
}

function clearButtonLoading(btn) {
  btn.disabled = false;
  if (btn.dataset.origText) btn.textContent = btn.dataset.origText;
  btn.classList.remove("is-loading");
  delete btn.dataset.origText;
}

async function copyText(value, label) {
  if (!value) return;
  await navigator.clipboard.writeText(value);
  showStatus(`${label} copied.`);
  setTimeout(() => hideStatus(), 1400);
}

function getWorkflowPreset(id) {
  return WORKFLOW_PRESETS.find((p) => p.id === id) || WORKFLOW_PRESETS[0];
}

// ── Asset modal ───────────────────────────────────────────────────────────────
function openAssetPreview(url, title, kind = "image") {
  els.assetModalTitle.textContent = title;
  els.assetModalOpen.href = url;
  els.assetModalDownload.href = url;
  els.assetModalDownload.setAttribute(
    "download",
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "asset"
  );
  if (kind === "video") {
    els.assetModalImage.classList.add("hidden");
    els.assetModalImage.removeAttribute("src");
    els.assetModalVideo.classList.remove("hidden");
    els.assetModalVideo.src = url;
  } else {
    els.assetModalVideo.classList.add("hidden");
    els.assetModalVideo.removeAttribute("src");
    els.assetModalImage.classList.remove("hidden");
    els.assetModalImage.src = url;
    els.assetModalImage.alt = title;
  }
  els.assetModal.classList.remove("hidden");
}

function closeAssetPreview() {
  els.assetModal.classList.add("hidden");
  els.assetModalImage.removeAttribute("src");
  els.assetModalVideo.pause();
  els.assetModalVideo.removeAttribute("src");
}

els.assetModal.addEventListener("click", (e) => {
  if (e.target instanceof HTMLElement && e.target.dataset.closeModal === "true") closeAssetPreview();
});
els.assetModalClose.addEventListener("click", closeAssetPreview);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !els.assetModal.classList.contains("hidden")) closeAssetPreview();
});

// ── References ────────────────────────────────────────────────────────────────
function parseReferenceLines(raw) {
  return String(raw || "").split("\n").map((v) => v.trim()).filter(Boolean)
    .map((v, i) => ({ id: `run-ref-${i + 1}`, label: v.split("/").pop() || v, url: v, source: "run", kind: "image" }));
}

function buildBrandReferenceAssets(brandId, visualMode) {
  const brand = getBrandById(brandId);
  const refs = brand?.mascot?.referenceImages || [];
  if (!refs.length || visualMode === "food-led") return [];
  return refs.map((url, i) => ({
    id: `brand-ref-${i + 1}`,
    label: `${brand.mascot?.name || brand.name} ref ${i + 1}`,
    url: `/api/brand-assets/${brandId}/${i}`,
    source: "brand",
    kind: "image"
  }));
}

function buildReferenceAssets({ brandId, visualMode, inputValue, selectedAsset } = {}) {
  const brandRefs = buildBrandReferenceAssets(brandId, visualMode);
  const runRefs = parseReferenceLines(inputValue);
  const assetRefs = selectedAsset?.assetUrl && selectedAsset.assetKind === "image"
    ? [{ id: `asset-ref-${selectedAsset.itemId || "sel"}`, label: selectedAsset.text || "Selected", url: selectedAsset.assetUrl, source: "asset", kind: "image" }]
    : [];
  return [...brandRefs, ...assetRefs, ...runRefs];
}

function renderReferenceChips() {
  const refs = buildReferenceAssets({
    brandId: els.studioProductSelect.value,
    visualMode: els.studioVisualMode.value,
    inputValue: els.studioReferenceInput.value
  });
  els.studioReferenceChipset.innerHTML = refs.map((r) =>
    `<span class="reference-chip reference-chip--${escapeHtml(r.source)}">${escapeHtml(r.label)}</span>`
  ).join("");
}

// ── Workflow UI ───────────────────────────────────────────────────────────────
function updateWorkflowUI() {
  const preset = getWorkflowPreset(studioState.workflowType);
  els.studioWorkflowSummary.textContent = preset.summary;
  els.studioWorkflowPresets.innerHTML = WORKFLOW_PRESETS.map((p) =>
    `<button type="button" class="workflow-preset${p.id === studioState.workflowType ? " is-active" : ""}" data-workflow-id="${p.id}">
      <p class="workflow-preset__title">${escapeHtml(p.label)}</p>
      <p class="workflow-preset__summary">${escapeHtml(p.summary)}</p>
    </button>`
  ).join("");
  els.studioWorkflowPresets.querySelectorAll("[data-workflow-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      studioState.workflowType = btn.dataset.workflowId;
      updateWorkflowUI();
    });
  });
  renderReferenceChips();
}

// ── Output assets ─────────────────────────────────────────────────────────────
function outputAssets(output) {
  if (!output) return [];
  if (output.artifacts?.length) {
    return output.artifacts.map((a, i) => ({
      itemId: a.id,
      assetKind: a.kind,
      role: a.role,
      text: a.title,
      prompt: a.prompt,
      assetUrl: getArtifactPreviewUrl(output, a),
      sourceAssetId: a.source_asset_id || null,
      variantGroup: a.variant_group || null,
      slideNumber: null,
      order: i
    }));
  }
  return (output.slides || [])
    .filter((s) => typeof s.slide_number === "number" && !Number.isNaN(s.slide_number))
    .map((s, i) => ({
      itemId: `slide-${String(s.slide_number).padStart(2, "0")}`,
      assetKind: "image",
      role: s.role,
      text: s.text,
      prompt: s.image_prompt || s.text,
      assetUrl: getWorkspaceAssetUrl(output, s),
      sourceAssetId: null,
      variantGroup: null,
      slideNumber: s.slide_number,
      order: i
    }));
}

// ── Inspector ─────────────────────────────────────────────────────────────────
function renderInspectorPackage() {
  const output = studioState.generatedOutput;
  els.inspectorPackage.classList.toggle("hidden", !output);
  if (!output) return;

  const product = studioState.products.find((p) => p.id === els.studioProductSelect.value);
  const publishLinks = getPlatformPublishLinks(product?.name || "this product");

  els.inspectorPackageStatus.textContent =
    output.render_status === "skipped" ? "Using generated visuals directly." : "Package ready.";
  els.inspectorCaptionText.textContent = output.caption || "";
  els.inspectorHashtagsText.textContent = (output.hashtags || []).join(" ");
  els.inspectorHooksList.innerHTML = (output.hooks || [])
    .map((h) => `<div class="package-list__item"><strong>Hook</strong><span>${escapeHtml(h)}</span></div>`)
    .join("");
  els.inspectorPublishLinks.innerHTML = publishLinks.map((l) =>
    `<div class="publish-link">
      <a href="${l.href}" target="_blank" rel="noreferrer">${escapeHtml(l.label)}</a>
      <span>${escapeHtml(l.helper)}</span>
    </div>`
  ).join("");
}

function showAssetNode(container, asset) {
  container.innerHTML = "";
  if (!asset?.assetUrl) {
    container.classList.add("refine-preview--empty");
    container.innerHTML = "<span>Preview</span>";
    return;
  }
  container.classList.remove("refine-preview--empty");
  if (asset.assetKind === "video") {
    const v = document.createElement("video");
    v.controls = true;
    v.playsInline = true;
    v.src = asset.assetUrl;
    container.appendChild(v);
  } else {
    const img = document.createElement("img");
    img.src = asset.assetUrl;
    img.alt = asset.text || "Generated asset";
    container.appendChild(img);
  }
}

function renderInspectorAsset() {
  const sel = studioState.selectedAsset;
  const inspectorEl = document.getElementById("studio-inspector");
  els.inspectorAsset.classList.toggle("hidden", !sel);

  // Show/hide the inspector panel based on selection
  if (inspectorEl) {
    inspectorEl.classList.toggle("hidden", !sel && !studioState.generatedOutput);
  }

  if (!sel) return;
  els.inspectorAssetTitle.textContent = sel.text || "Selected asset";
  els.inspectorAssetHint.textContent = `${titleCase(sel.assetKind || "image")} — click to open full size.`;
  showAssetNode(els.inspectorAssetPreview, sel);
  els.studioRefinePrompt.value ||= sel.prompt || "";

  // Add/update download button for selected artboard
  let dlBtn = els.inspectorAsset.querySelector(".inspector-download-btn");
  if (!dlBtn) {
    dlBtn = document.createElement("button");
    dlBtn.className = "ghost-button inspector-download-btn";
    dlBtn.type = "button";
    dlBtn.textContent = "Download Asset";
    els.inspectorAsset.insertBefore(dlBtn, els.studioRefineForm);
    dlBtn.addEventListener("click", async () => {
      if (!studioState.canvasEngine) return;
      const selected = studioState.canvasEngine.getSelectedArtboard();
      if (selected) {
        try {
          dlBtn.disabled = true;
          dlBtn.textContent = "Downloading…";
          await downloadArtboard(selected);
        } catch (err) {
          showStatus(err instanceof Error ? err.message : "Download failed.");
        } finally {
          dlBtn.disabled = false;
          dlBtn.textContent = "Download Asset";
        }
      }
    });
  }
}

function selectAsset(assetId) {
  studioState.selectedAsset = outputAssets(studioState.generatedOutput).find((a) => a.itemId === assetId) || null;
  renderCanvas();
  renderInspectorAsset();
  // Also select in canvas engine if available
  if (studioState.canvasEngine) {
    const artboards = studioState.canvasEngine.getArtboards();
    const match = artboards.find((a) => a.id === assetId);
    if (match) studioState.canvasEngine._selection.select(match.id);
  }
}

// ── Canvas drag — handled by CanvasEngine ─────────────────────────────────────
function initCanvasDrag() { /* no-op — CanvasEngine handles drag */ }
function drawConnectors() { /* no-op — CanvasEngine handles connectors */ }

// ── Canvas render ─────────────────────────────────────────────────────────────
function renderCanvas() {
  // Old card-based canvas removed — CanvasEngine handles all rendering
  if (els.canvasEmpty && !studioState.generatedOutput) {
    els.canvasEmpty.classList.remove("hidden");
  }
}

// ── Poll job ──────────────────────────────────────────────────────────────────
async function pollJob(jobId, onUpdate) {
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await fetch(`/api/jobs/${jobId}`);
    const job = await res.json();
    onUpdate?.(job);
    if (job.status === "failed") throw new Error(job.error || "Generation failed.");
    if (job.status === "done") return job.result;
  }
  throw new Error("Generation timed out.");
}

// ── Sync cards from brief ─────────────────────────────────────────────────────
function syncCardsFromBrief() {
  studioState.canvasCards = buildCanvasCards(
    studioState.session?.inferredBrief || {},
    studioState.generatedOutput,
    makeId
  );
  if (studioState.generatedOutput) {
    studioState.selectedAsset = outputAssets(studioState.generatedOutput)[0] || null;
  }
}

// ── Messages ──────────────────────────────────────────────────────────────────
function renderMessages() {
  els.studioMessageThread.innerHTML = "";
  const messages = (studioState.session?.messages || []).filter((m) => m.role !== "system");
  messages.forEach((msg) => {
    const el = document.createElement("article");
    el.className = `message-bubble message-bubble--${msg.role === "user" ? "user" : "assistant"}`;
    el.innerHTML = `<strong>${msg.role === "user" ? "You" : "Social Studio"}</strong><p>${escapeHtml(msg.text)}</p>`;
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

// ── Core generation pipeline ──────────────────────────────────────────────────
async function runGeneration(rawIdea, notes) {
  const brandId = els.studioProductSelect.value;
  const brief = studioState.session?.inferredBrief || {};
  const request = {
    brandProfileId: brandId,
    rawIdea,
    notes: notes || (brief.audience ? `Audience: ${brief.audience}. Offer: ${brief.offer || ""}. Tone: ${brief.tone || ""}.` : ""),
    cards: studioState.canvasCards,
    references: [],
    referenceAssets: buildReferenceAssets({
      brandId,
      visualMode: els.studioVisualMode.value,
      inputValue: els.studioReferenceInput.value,
      selectedAsset: studioState.selectedAsset
    }),
    platformTargets: [els.studioPlatformSelect.value],
    goal: getBrandById(brandId)?.defaults?.goal || "awareness",
    workflowType: studioState.workflowType,
    visualMode: els.studioVisualMode.value,
    deliveryTargets: els.studioDeliveryTarget.value,
    variantCount: studioState.workflowType === "mascot-variants" ? 4 : undefined,
    videoOptions: ["video-clip", "reel-package"].includes(studioState.workflowType)
      ? { duration: 5, aspectRatio: "9:16", withAudio: true, consistencyMode: "mascot-consistent" }
      : undefined
  };

  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  });
  const { jobId } = await res.json();

  return pollJob(jobId, (job) => {
    const stage = job.stage || job.status || "working";
    console.log("[studio] Job progress:", jobId, stage);
    if (stage === "planning" || job.status === "running") {
      setCheckpoint("strategy", "active");
      showCanvasProgress("Planning recipes and content…");
    }
    if (stage === "generating") {
      setCheckpoint("strategy", "done");
      setCheckpoint("hooks", "done");
      setCheckpoint("visuals", "active");
      showCanvasProgress("Generating food images…");
    }
    if (stage === "rendering") {
      setCheckpoint("visuals", "done");
      showCanvasProgress("Rendering final slides…");
    }
    studioState.canvasLoadingStage = stage;
  });
}

function finishGeneration(output) {
  studioState.canvasLoadingStage = null;
  studioState.generatedOutput = output;
  studioState.workflowType = output.workflow_type || studioState.workflowType;
  studioState.selectedAsset = outputAssets(output)[0] || null;
  setCheckpoint("visuals", "done");
  setCheckpoint("finalPackage", "done");
  hideCanvasProgress();
  hideStatus();

  // Debug: log what we got
  console.log("[studio] Generation complete:", output.post_id);
  console.log("[studio] Slides:", output.slides?.length, "Artifacts:", output.artifacts?.length);
  if (output.slides) {
    output.slides.forEach((s, i) => console.log(`  slide ${i}:`, s.role, s.asset_path || "no-asset"));
  }
  if (output.artifacts) {
    output.artifacts.forEach((a, i) => console.log(`  artifact ${i}:`, a.role, a.asset_path || "no-asset"));
  }

  // Load into canvas engine
  loadOutputToEngine(output);
}

// ── Branded text card helpers ──────────────────────────────────────────────

/**
 * Parse hook slide text into title + subtitle.
 * First non-empty line = title, remaining lines joined = subtitle.
 * Falls back to brandName if text is empty/whitespace.
 */
function parseHookText(text, brandName) {
  const lines = (text || '').split('\n').filter(l => l.trim());
  return {
    title: lines[0] || brandName,
    subtitle: lines.slice(1).join('\n') || ''
  };
}

/**
 * Build a branded hook card DOM element.
 */
function renderHookCard(slide, brandVisual, brandName) {
  const primary = brandVisual.primaryColor || '#333';
  const surface = brandVisual.surfaceColor || '#fff';
  const accent = brandVisual.accentColor || '#f5f5f5';
  const textColor = brandVisual.textColor || '#1a1a1a';
  const textSecondary = brandVisual.textSecondary || '#666';
  const fontFamily = brandVisual.fontFamily || "'Avenir Next', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

  const { title, subtitle } = parseHookText(slide.text, brandName);

  const card = document.createElement('div');
  card.className = 'canvas-output__card canvas-output__card--hook';

  const outer = document.createElement('div');
  outer.className = 'hook-card';
  outer.style.background = accent;
  outer.style.fontFamily = fontFamily;

  const inner = document.createElement('div');
  inner.className = 'hook-card__inner';
  inner.style.background = surface;

  const wordmark = document.createElement('div');
  wordmark.className = 'hook-card__wordmark';
  wordmark.style.color = primary;
  wordmark.textContent = brandName.toUpperCase();

  const divider = document.createElement('div');
  divider.className = 'hook-card__divider';
  divider.style.background = primary;

  const titleEl = document.createElement('div');
  titleEl.className = 'hook-card__title';
  titleEl.style.color = textColor;
  titleEl.textContent = title;

  const subtitleEl = document.createElement('div');
  subtitleEl.className = 'hook-card__subtitle';
  subtitleEl.style.color = textSecondary;
  subtitleEl.textContent = subtitle;

  const hint = document.createElement('div');
  hint.className = 'hook-card__hint';
  hint.textContent = 'Swipe for recipes →';

  inner.appendChild(wordmark);
  inner.appendChild(divider);
  inner.appendChild(titleEl);
  inner.appendChild(subtitleEl);
  inner.appendChild(hint);
  outer.appendChild(inner);
  card.appendChild(outer);

  return card;
}

/**
 * Build a branded CTA card DOM element.
 */
function renderCtaCard(slide, brandVisual, brandCta) {
  const primary = brandVisual.primaryColor || '#333';
  const surface = brandVisual.surfaceColor || '#fff';
  const accent = brandVisual.accentColor || '#f5f5f5';
  const textColor = brandVisual.textColor || '#1a1a1a';
  const textSecondary = brandVisual.textSecondary || '#666';
  const fontFamily = brandVisual.fontFamily || "'Avenir Next', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

  const lines = (slide.text || '').split('\n').filter(l => l.trim());
  const headline = lines[0] || '';
  const subtitle = lines.slice(1).join('\n') || '';
  const ctaText = brandCta || 'Learn more';

  const card = document.createElement('div');
  card.className = 'canvas-output__card canvas-output__card--cta';

  const outer = document.createElement('div');
  outer.className = 'cta-card';
  outer.style.background = accent;
  outer.style.fontFamily = fontFamily;

  const inner = document.createElement('div');
  inner.className = 'cta-card__inner';
  inner.style.background = surface;

  const headlineEl = document.createElement('div');
  headlineEl.className = 'cta-card__headline';
  headlineEl.style.color = textColor;
  headlineEl.textContent = headline;

  const subtitleEl = document.createElement('div');
  subtitleEl.className = 'cta-card__subtitle';
  subtitleEl.style.color = textSecondary;
  subtitleEl.textContent = subtitle;

  const divider = document.createElement('div');
  divider.className = 'cta-card__divider';
  divider.style.background = primary;

  const pill = document.createElement('div');
  pill.className = 'cta-card__pill';
  pill.style.background = primary;
  pill.style.color = surface;
  pill.textContent = ctaText;

  const question = document.createElement('div');
  question.className = 'cta-card__question';
  question.style.color = textSecondary;
  question.textContent = 'Which recipe are you trying first?';

  inner.appendChild(headlineEl);
  inner.appendChild(subtitleEl);
  inner.appendChild(divider);
  inner.appendChild(pill);
  inner.appendChild(question);
  outer.appendChild(inner);
  card.appendChild(outer);

  return card;
}

/**
 * Load output into the CanvasEngine (infinite canvas).
 * Falls back to old renderCanvas() if engine not available.
 */
function loadOutputToEngine(output) {
  console.log("[studio] loadOutputToEngine called, engine:", !!studioState.canvasEngine, "output:", !!output);
  if (!output) return;

  // Hide empty state
  if (els.canvasEmpty) els.canvasEmpty.classList.add("hidden");

  // Get the stage element and render directly
  const stage = document.getElementById("studio-canvas-stage");
  if (!stage) { console.error("[studio] No stage element"); return; }

  // Remove any previous output render
  const prev = stage.querySelector(".canvas-output");
  if (prev) prev.remove();

  // Build the output HTML directly
  const container = document.createElement("div");
  container.className = "canvas-output";

  // Slides strip
  const strip = document.createElement("div");
  strip.className = "canvas-output__strip";

  const items = (output.artifacts && output.artifacts.length) ? output.artifacts : (output.slides || []);
  const postId = output.post_id || "";

  // Extract brand settings with neutral fallbacks
  const brandProfile = output.brand_profile || {};
  const brandVisual = brandProfile.visual || {
    primaryColor: '#333',
    secondaryColor: '#ccc',
    accentColor: '#f5f5f5',
    surfaceColor: '#fff',
    textColor: '#1a1a1a',
    textSecondary: '#666',
    fontFamily: "'Avenir Next', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
  };
  const brandName = brandProfile.name || 'Brand';
  const brandCta = brandProfile.cta || '';

  items.forEach((item, i) => {
    // Branded hook card (no asset_path)
    if (item.role === 'hook' && !item.asset_path) {
      const hookCard = renderHookCard(item, brandVisual, brandName);
      // Add label
      const label = document.createElement("div");
      label.className = "canvas-output__label";
      label.textContent = `${String(i + 1).padStart(2, "0")} — Hook`;
      hookCard.appendChild(label);
      strip.appendChild(hookCard);
      return;
    }

    // Branded CTA card (no asset_path)
    if (item.role === 'cta' && !item.asset_path) {
      const ctaCard = renderCtaCard(item, brandVisual, brandCta);
      // Add label
      const label = document.createElement("div");
      label.className = "canvas-output__label";
      label.textContent = `${String(i + 1).padStart(2, "0")} — Cta`;
      ctaCard.appendChild(label);
      strip.appendChild(ctaCard);
      return;
    }

    // Default card (recipe cards with images, or any other slide)
    const card = document.createElement("div");
    card.className = "canvas-output__card";

    // Resolve image URL
    let imgUrl = null;
    if (item.asset_path) {
      const filename = item.asset_path.split("/").pop();
      imgUrl = `/api/assets/${postId}/${filename}`;
    }

    if (imgUrl) {
      const img = document.createElement("img");
      img.src = imgUrl;
      img.alt = item.role || "slide";
      img.loading = "lazy";
      img.onerror = () => { img.style.display = "none"; };
      card.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "canvas-output__placeholder";
      placeholder.textContent = item.role || "slide";
      card.appendChild(placeholder);
    }

    // Label
    const label = document.createElement("div");
    label.className = "canvas-output__label";
    label.textContent = `${String(i + 1).padStart(2, "0")} — ${(item.role || "slide").charAt(0).toUpperCase() + (item.role || "slide").slice(1)}`;
    card.appendChild(label);

    // Recipe info below image
    const recipe = item.recipe || (output.slides && output.slides[i] && output.slides[i].recipe);
    if (recipe) {
      const info = document.createElement("div");
      info.className = "canvas-output__recipe";
      info.innerHTML = `<strong>${recipe.recipeName || ""}</strong>`;
      if (recipe.cookTime) info.innerHTML += `<span class="canvas-output__meta">${recipe.cookTime}</span>`;
      if (recipe.ingredients && recipe.ingredients.length) {
        info.innerHTML += `<div class="canvas-output__ingredients">${recipe.ingredients.join(" · ")}</div>`;
      }
      if (recipe.steps && recipe.steps.length) {
        info.innerHTML += `<div class="canvas-output__steps">${recipe.steps.map((s, j) => `<span>${j + 1}. ${s}</span>`).join(" ")}</div>`;
      }
      if (recipe.proTip) {
        info.innerHTML += `<div class="canvas-output__tip">${recipe.proTip}</div>`;
      }
      card.appendChild(info);
    }

    strip.appendChild(card);
  });

  container.appendChild(strip);

  // Caption + hashtags below the strip
  if (output.caption) {
    const captionEl = document.createElement("div");
    captionEl.className = "canvas-output__caption";
    captionEl.innerHTML = `<strong>Caption</strong><p>${output.caption}</p>`;
    container.appendChild(captionEl);
  }

  if (output.hashtags && output.hashtags.length) {
    const tagsEl = document.createElement("div");
    tagsEl.className = "canvas-output__hashtags";
    tagsEl.textContent = output.hashtags.join(" ");
    container.appendChild(tagsEl);
  }

  if (output.hooks && output.hooks.length) {
    const hooksEl = document.createElement("div");
    hooksEl.className = "canvas-output__hooks";
    hooksEl.innerHTML = `<strong>Hooks</strong>` + output.hooks.map(h => `<p>${h}</p>`).join("");
    container.appendChild(hooksEl);
  }

  stage.appendChild(container);
  console.log("[studio] Output rendered to canvas:", items.length, "items");

  // ── Wire interactivity onto rendered cards ──────────────────────────────
  wireCardInteractivity(strip, output, postId, brandVisual);
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERACTIVE CANVAS EDITOR — Selection, Inline Editing, Drag, Download, Keys
// ═══════════════════════════════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────────────────────────────
let currentOutput = null;
let selectedCardIndex = -1;
let patchTimer = null;
let pendingPatch = {};
let patchFailed = false;

// ── InlineEditor ──────────────────────────────────────────────────────────────
const InlineEditor = (() => {
  let activeElement = null;
  let previousValue = '';
  let options = {};

  function activate(element, opts = {}) {
    if (activeElement) deactivate(activeElement);
    activeElement = element;
    options = opts;
    previousValue = element.textContent;
    element.contentEditable = 'true';
    element.classList.add('canvas-output__card--editing');
    element.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(element);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    element.addEventListener('blur', handleBlur);
    element.addEventListener('keydown', handleKeydown);
    element.addEventListener('paste', handlePaste);
  }

  function deactivate(element) {
    if (!element) return '';
    element.contentEditable = 'false';
    element.classList.remove('canvas-output__card--editing');
    element.removeEventListener('blur', handleBlur);
    element.removeEventListener('keydown', handleKeydown);
    element.removeEventListener('paste', handlePaste);
    const text = element.textContent;
    activeElement = null;
    return text;
  }

  function handleBlur() {
    if (!activeElement) return;
    const el = activeElement;
    const text = deactivate(el);
    // Restore if required field is empty
    if (options.required && !text.trim()) {
      el.textContent = previousValue;
      return;
    }
    if (options.onCommit) options.onCommit(text);
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      const el = activeElement;
      el.textContent = previousValue;
      deactivate(el);
      if (options.onCancel) options.onCancel();
      return;
    }
    if (e.key === 'Enter' && !options.multiline) {
      e.preventDefault();
      handleBlur();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }

  function isActive() {
    return activeElement !== null;
  }

  return { activate, deactivate, isActive };
})();

// ── patchOutput (debounced) ───────────────────────────────────────────────────
function schedulePatch(postId, partial) {
  Object.assign(pendingPatch, partial);
  if (patchTimer) clearTimeout(patchTimer);
  showSaveIndicator('saving');
  patchTimer = setTimeout(() => flushPatch(postId), 2000);
}

async function flushPatch(postId) {
  if (!postId || Object.keys(pendingPatch).length === 0) return;
  const body = { ...pendingPatch };
  pendingPatch = {};
  patchTimer = null;
  try {
    const res = await fetch(`/api/outputs/${postId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.status === 404) {
      showSaveIndicator('error');
      return;
    }
    if (!res.ok) throw new Error('PATCH failed');
    patchFailed = false;
    showSaveIndicator('saved');
  } catch {
    patchFailed = true;
    showSaveIndicator('warning');
    // Re-queue the failed patch
    Object.assign(pendingPatch, body);
  }
}

function showSaveIndicator(state) {
  let indicator = document.querySelector('.canvas-save-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'canvas-save-indicator';
    const toolbar = document.getElementById('studio-quick-form');
    if (toolbar) toolbar.parentElement.insertBefore(indicator, toolbar);
  }
  indicator.classList.remove('canvas-save-indicator--warning', 'canvas-save-indicator--error', 'canvas-save-indicator--saved');
  if (state === 'saved') {
    indicator.textContent = '✓ Saved';
    indicator.classList.add('canvas-save-indicator--saved');
    setTimeout(() => { indicator.textContent = ''; }, 2000);
  } else if (state === 'warning') {
    indicator.textContent = '⚠ Unsaved changes';
    indicator.classList.add('canvas-save-indicator--warning');
  } else if (state === 'error') {
    indicator.textContent = '✕ Output no longer exists';
    indicator.classList.add('canvas-save-indicator--error');
  } else if (state === 'saving') {
    indicator.textContent = '…';
  }
}

// ── regenerateSlide ───────────────────────────────────────────────────────────
async function regenerateSlide(postId, slideNumber, imagePrompt) {
  const res = await fetch(`/api/outputs/${postId}/slides/${slideNumber}/regenerate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_prompt: imagePrompt })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Regeneration failed' }));
    throw new Error(err.error || 'Regeneration failed');
  }
  return res.json();
}

// ── Card Selection ────────────────────────────────────────────────────────────
function selectCard(index, cards, output, brandVisual) {
  const prev = cards[selectedCardIndex];
  if (prev) prev.classList.remove('canvas-output__card--selected');

  selectedCardIndex = index;
  if (index >= 0 && index < cards.length) {
    const card = cards[index];
    card.classList.add('canvas-output__card--selected');
    card.style.borderColor = brandVisual.primaryColor || '#333';
    populateDetailPanel(index, output);
  } else {
    selectedCardIndex = -1;
    hideDetailPanel();
  }
}

function deselectCard(cards) {
  if (selectedCardIndex >= 0 && cards[selectedCardIndex]) {
    cards[selectedCardIndex].classList.remove('canvas-output__card--selected');
  }
  selectedCardIndex = -1;
  hideDetailPanel();
}

function populateDetailPanel(index, output) {
  const inspector = document.getElementById('studio-inspector');
  const assetSection = document.getElementById('inspector-asset');
  if (!inspector || !assetSection) return;

  const slides = output.slides || output.artifacts || [];
  const slide = slides[index];
  if (!slide) return;

  inspector.classList.remove('hidden');
  assetSection.classList.remove('hidden');

  const titleEl = document.getElementById('inspector-asset-title');
  const hintEl = document.getElementById('inspector-asset-hint');
  const previewEl = document.getElementById('inspector-asset-preview');

  if (titleEl) titleEl.textContent = `Slide ${slide.slide_number || index + 1} — ${(slide.role || 'slide').charAt(0).toUpperCase() + (slide.role || 'slide').slice(1)}`;
  if (hintEl) {
    let hint = slide.text || '';
    if (slide.recipe) hint = slide.recipe.recipeName || hint;
    hintEl.textContent = hint;
  }

  // Preview
  if (previewEl) {
    previewEl.innerHTML = '';
    previewEl.classList.remove('refine-preview--empty');
    const postId = output.post_id || '';
    if (slide.asset_path) {
      const filename = slide.asset_path.split('/').pop();
      const img = document.createElement('img');
      img.src = `/api/assets/${postId}/${filename}`;
      img.alt = slide.role || 'slide';
      previewEl.appendChild(img);
    } else {
      previewEl.classList.add('refine-preview--empty');
      previewEl.innerHTML = '<span>Text card</span>';
    }
  }

  // Regenerate prompt
  const promptEl = document.getElementById('studio-refine-prompt');
  if (promptEl) promptEl.value = slide.image_prompt || '';

  // Show/hide regenerate button based on role
  const regenBtn = document.getElementById('studio-refine-submit');
  if (regenBtn) {
    const canRegen = slide.role === 'recipe' || !!slide.image_prompt;
    regenBtn.style.display = canRegen ? '' : 'none';
    if (promptEl) promptEl.style.display = canRegen ? '' : 'none';
  }
}

function hideDetailPanel() {
  const assetSection = document.getElementById('inspector-asset');
  if (assetSection) assetSection.classList.add('hidden');
}

// ── DragReorderController ─────────────────────────────────────────────────────
const DragReorderController = (() => {
  let strip = null;
  let cards = [];
  let onReorder = null;
  let holdTimer = null;
  let dragging = false;
  let dragCard = null;
  let dragIndex = -1;
  let placeholder = null;

  function init(stripEl, opts = {}) {
    strip = stripEl;
    onReorder = opts.onReorder || null;
    cards = Array.from(strip.querySelectorAll('.canvas-output__card'));
    strip.addEventListener('pointerdown', onPointerDown);
  }

  function destroy() {
    if (strip) strip.removeEventListener('pointerdown', onPointerDown);
    strip = null;
    cards = [];
  }

  function onPointerDown(e) {
    const card = e.target.closest('.canvas-output__card');
    if (!card || InlineEditor.isActive()) return;
    const idx = Array.from(strip.children).indexOf(card);
    // Lock hook (first) and CTA (last)
    const allCards = Array.from(strip.querySelectorAll('.canvas-output__card'));
    if (idx === 0 || idx === allCards.length - 1) return;

    holdTimer = setTimeout(() => {
      startDrag(card, idx, e);
    }, 200);

    const onUp = () => {
      clearTimeout(holdTimer);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointermove', onMoveCancel);
    };
    const onMoveCancel = (ev) => {
      if (Math.abs(ev.clientX - e.clientX) > 5 || Math.abs(ev.clientY - e.clientY) > 5) {
        clearTimeout(holdTimer);
      }
    };
    document.addEventListener('pointerup', onUp, { once: true });
    document.addEventListener('pointermove', onMoveCancel);
  }

  function startDrag(card, idx) {
    dragging = true;
    dragCard = card;
    dragIndex = idx;
    card.classList.add('canvas-output__card--dragging');
    card.setPointerCapture && card.releasePointerCapture && card.releasePointerCapture(1);

    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragEnd);
  }

  function onDragMove(e) {
    if (!dragging || !strip) return;
    // Remove old indicator
    const oldInd = strip.querySelector('.canvas-output__drop-indicator');
    if (oldInd) oldInd.remove();

    const allCards = Array.from(strip.querySelectorAll('.canvas-output__card'));
    let insertIdx = -1;
    for (let i = 0; i < allCards.length; i++) {
      const rect = allCards[i].getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      if (e.clientX < mid) { insertIdx = i; break; }
    }
    if (insertIdx === -1) insertIdx = allCards.length;

    // Don't allow drop at position 0 (hook) or last (cta)
    if (insertIdx <= 0) insertIdx = 1;
    if (insertIdx >= allCards.length) insertIdx = allCards.length - 1;

    // Show indicator
    const indicator = document.createElement('div');
    indicator.className = 'canvas-output__drop-indicator';
    if (insertIdx < allCards.length) {
      strip.insertBefore(indicator, allCards[insertIdx]);
    } else {
      strip.appendChild(indicator);
    }
  }

  function onDragEnd(e) {
    if (!dragging || !strip) return;
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', onDragEnd);

    dragCard.classList.remove('canvas-output__card--dragging');

    // Remove indicator
    const ind = strip.querySelector('.canvas-output__drop-indicator');
    if (ind) ind.remove();

    // Calculate drop position
    const allCards = Array.from(strip.querySelectorAll('.canvas-output__card'));
    let insertIdx = -1;
    for (let i = 0; i < allCards.length; i++) {
      const rect = allCards[i].getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      if (e.clientX < mid) { insertIdx = i; break; }
    }
    if (insertIdx === -1) insertIdx = allCards.length;
    if (insertIdx <= 0) insertIdx = 1;
    if (insertIdx >= allCards.length) insertIdx = allCards.length - 1;

    // Perform reorder in DOM
    if (insertIdx !== dragIndex) {
      strip.removeChild(dragCard);
      const newCards = Array.from(strip.querySelectorAll('.canvas-output__card'));
      if (insertIdx - 1 >= newCards.length) {
        strip.appendChild(dragCard);
      } else {
        // Adjust index since we removed the card
        const adjustedIdx = insertIdx > dragIndex ? insertIdx - 1 : insertIdx;
        if (adjustedIdx < newCards.length) {
          strip.insertBefore(dragCard, newCards[adjustedIdx]);
        } else {
          strip.appendChild(dragCard);
        }
      }
      if (onReorder) onReorder();
    }

    dragging = false;
    dragCard = null;
    dragIndex = -1;
  }

  return { init, destroy };
})();

// ── Download helpers ──────────────────────────────────────────────────────────
function getDownloadFilename(postId, slideNumber) {
  return `${postId}-slide-${String(slideNumber).padStart(2, '0')}.png`;
}

async function downloadSlide(card, postId, slideNumber) {
  const img = card.querySelector('img');
  if (img && img.src) {
    // Image card — fetch blob
    try {
      const res = await fetch(img.src);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = getDownloadFilename(postId, slideNumber);
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // Fallback: use html2canvas-style approach
      downloadCardAsCanvas(card, postId, slideNumber);
    }
  } else {
    // Text card — capture DOM to canvas
    downloadCardAsCanvas(card, postId, slideNumber);
  }
}

function downloadCardAsCanvas(card, postId, slideNumber) {
  try {
    const canvas = document.createElement('canvas');
    const rect = card.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    // Simple text rendering fallback
    ctx.fillStyle = '#333';
    ctx.font = '16px sans-serif';
    ctx.fillText('Download from browser — use screenshot', 20, rect.height / 2);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = getDownloadFilename(postId, slideNumber);
      a.click();
      URL.revokeObjectURL(a.href);
    });
  } catch {
    console.warn('[studio] DOM capture failed for text card');
  }
}

async function downloadAllSlides(output) {
  if (!window.JSZip) {
    showSaveIndicator('warning');
    alert('ZIP library not available. Please reload the page.');
    return;
  }
  const zip = new window.JSZip();
  const postId = output.post_id || 'output';
  const slides = output.slides || [];

  for (const slide of slides) {
    if (slide.asset_path) {
      const filename = slide.asset_path.split('/').pop();
      try {
        const res = await fetch(`/api/assets/${postId}/${filename}`);
        if (res.ok) {
          const blob = await res.blob();
          zip.file(getDownloadFilename(postId, slide.slide_number), blob);
        }
      } catch { /* skip */ }
    }
  }

  if (output.caption) zip.file('caption.txt', output.caption);
  if (output.hashtags?.length) zip.file('hashtags.txt', output.hashtags.join(' '));

  const content = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(content);
  a.download = `${postId}-all-slides.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Wire interactivity ────────────────────────────────────────────────────────
function wireCardInteractivity(strip, output, postId, brandVisual) {
  currentOutput = output;
  selectedCardIndex = -1;
  const cards = Array.from(strip.querySelectorAll('.canvas-output__card'));

  // Click to select
  cards.forEach((card, i) => {
    card.addEventListener('click', (e) => {
      if (InlineEditor.isActive()) return;
      e.stopPropagation();
      selectCard(i, cards, output, brandVisual);
    });
  });

  // Click empty space to deselect
  const stage = document.getElementById('studio-canvas-stage');
  if (stage) {
    stage.addEventListener('click', (e) => {
      if (e.target.closest('.canvas-output__card')) return;
      if (e.target.closest('.studio-inspector')) return;
      deselectCard(cards);
    });
  }

  // Double-click for inline editing on recipe fields
  cards.forEach((card, i) => {
    const recipeEl = card.querySelector('.canvas-output__recipe');
    if (!recipeEl) return;
    const slide = (output.slides || [])[i];
    if (!slide || !slide.recipe) return;

    // Recipe name
    const nameEl = recipeEl.querySelector('strong');
    if (nameEl) {
      nameEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        InlineEditor.activate(nameEl, {
          required: true,
          onCommit(text) {
            slide.recipe.recipeName = text;
            schedulePatch(postId, { slides: [{ slide_number: slide.slide_number, recipe: slide.recipe }] });
          }
        });
      });
    }

    // Ingredients
    const ingredientsEl = recipeEl.querySelector('.canvas-output__ingredients');
    if (ingredientsEl) {
      ingredientsEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        InlineEditor.activate(ingredientsEl, {
          multiline: true,
          onCommit(text) {
            slide.recipe.ingredients = text.split('·').map(s => s.trim()).filter(Boolean);
            ingredientsEl.textContent = slide.recipe.ingredients.join(' · ');
            schedulePatch(postId, { slides: [{ slide_number: slide.slide_number, recipe: slide.recipe }] });
          }
        });
      });
    }

    // Steps
    const stepsEl = recipeEl.querySelector('.canvas-output__steps');
    if (stepsEl) {
      stepsEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        InlineEditor.activate(stepsEl, {
          multiline: true,
          onCommit(text) {
            slide.recipe.steps = text.split(/\d+\.\s*/).filter(Boolean).map(s => s.trim());
            stepsEl.innerHTML = slide.recipe.steps.map((s, j) => `<span>${j + 1}. ${s}</span>`).join(' ');
            schedulePatch(postId, { slides: [{ slide_number: slide.slide_number, recipe: slide.recipe }] });
          }
        });
      });
    }

    // Pro tip
    const tipEl = recipeEl.querySelector('.canvas-output__tip');
    if (tipEl) {
      tipEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        InlineEditor.activate(tipEl, {
          multiline: true,
          onCommit(text) {
            slide.recipe.proTip = text;
            schedulePatch(postId, { slides: [{ slide_number: slide.slide_number, recipe: slide.recipe }] });
          }
        });
      });
    }
  });

  // Double-click on caption
  const captionEl = strip.parentElement?.querySelector('.canvas-output__caption p');
  if (captionEl) {
    captionEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      InlineEditor.activate(captionEl, {
        multiline: true,
        onCommit(text) {
          output.caption = text;
          currentOutput.caption = text;
          schedulePatch(postId, { caption: text });
        }
      });
    });
  }

  // Double-click on hashtags
  const hashtagsEl = strip.parentElement?.querySelector('.canvas-output__hashtags');
  if (hashtagsEl) {
    hashtagsEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      InlineEditor.activate(hashtagsEl, {
        multiline: false,
        onCommit(text) {
          const tags = text.split(/\s+/).filter(Boolean);
          output.hashtags = tags;
          currentOutput.hashtags = tags;
          hashtagsEl.textContent = tags.join(' ');
          schedulePatch(postId, { hashtags: tags });
        }
      });
    });
  }

  // Drag to reorder
  DragReorderController.init(strip, {
    onReorder() {
      // Update slide numbers based on new DOM order
      const reorderedCards = Array.from(strip.querySelectorAll('.canvas-output__card'));
      const slides = output.slides || [];
      reorderedCards.forEach((card, i) => {
        if (slides[i]) {
          slides[i].slide_number = i + 1;
        }
        // Update label
        const label = card.querySelector('.canvas-output__label');
        if (label && slides[i]) {
          const role = slides[i].role || 'slide';
          label.textContent = `${String(i + 1).padStart(2, '0')} — ${role.charAt(0).toUpperCase() + role.slice(1)}`;
        }
      });
      schedulePatch(postId, { slides: slides.map(s => ({ slide_number: s.slide_number, role: s.role })) });
    }
  });

  // Regeneration from detail panel
  const refineForm = document.getElementById('studio-refine-form');
  if (refineForm) {
    // Remove old listener by cloning
    const newForm = refineForm.cloneNode(true);
    refineForm.parentNode.replaceChild(newForm, refineForm);
    newForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (selectedCardIndex < 0) return;
      const slide = (output.slides || [])[selectedCardIndex];
      if (!slide) return;
      const promptEl = newForm.querySelector('#studio-refine-prompt');
      const submitBtn = newForm.querySelector('#studio-refine-submit');
      const statusEl = newForm.querySelector('#studio-refine-status');
      const prompt = promptEl?.value || slide.image_prompt || '';

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Regenerating…'; }
      if (statusEl) { statusEl.classList.remove('hidden'); statusEl.textContent = 'Generating new image…'; }

      try {
        const result = await regenerateSlide(postId, slide.slide_number, prompt);
        // Update in-memory
        slide.asset_path = result.slide.asset_path;
        slide.image_prompt = prompt;
        // Update DOM
        const card = cards[selectedCardIndex];
        const img = card?.querySelector('img');
        if (img && result.slide.asset_path) {
          const filename = result.slide.asset_path.split('/').pop();
          img.src = `/api/assets/${postId}/${filename}`;
        }
        if (statusEl) statusEl.textContent = 'Done — image updated.';
        populateDetailPanel(selectedCardIndex, output);
      } catch (err) {
        if (statusEl) statusEl.textContent = err.message || 'Regeneration failed';
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Regenerate'; }
      }
    });
  }

  // Download slide button in inspector
  let dlBtn = document.querySelector('.inspector-download-btn');
  if (dlBtn) {
    const newDl = dlBtn.cloneNode(true);
    dlBtn.parentNode.replaceChild(newDl, dlBtn);
    newDl.addEventListener('click', async () => {
      if (selectedCardIndex < 0) return;
      const slide = (output.slides || [])[selectedCardIndex];
      const card = cards[selectedCardIndex];
      if (!card || !slide) return;
      newDl.disabled = true;
      newDl.textContent = 'Downloading…';
      await downloadSlide(card, postId, slide.slide_number || selectedCardIndex + 1);
      newDl.disabled = false;
      newDl.textContent = 'Download Asset';
    });
  }

  // Download All button
  const dlAllBtn = document.getElementById('studio-download-all-btn');
  if (dlAllBtn) {
    const newDlAll = dlAllBtn.cloneNode(true);
    dlAllBtn.parentNode.replaceChild(newDlAll, dlAllBtn);
    newDlAll.addEventListener('click', async () => {
      newDlAll.disabled = true;
      newDlAll.textContent = 'Downloading…';
      await downloadAllSlides(output);
      newDlAll.disabled = false;
      newDlAll.textContent = 'Download All';
    });
  }
}

// ── Keyboard navigation ───────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Skip if inline editor is active (except Escape)
  if (InlineEditor.isActive()) {
    return; // InlineEditor handles its own Escape
  }

  // Skip if focused on input/textarea
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  const stage = document.getElementById('studio-canvas-stage');
  if (!stage) return;
  const strip = stage.querySelector('.canvas-output__strip');
  if (!strip) return;
  const cards = Array.from(strip.querySelectorAll('.canvas-output__card'));
  if (!cards.length) return;

  if (e.key === 'ArrowRight') {
    e.preventDefault();
    const next = Math.min(selectedCardIndex + 1, cards.length - 1);
    if (next >= 0) selectCard(next, cards, currentOutput, getBrandVisualFromOutput(currentOutput));
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    const prev = Math.max(selectedCardIndex - 1, 0);
    selectCard(prev, cards, currentOutput, getBrandVisualFromOutput(currentOutput));
  } else if (e.key === 'Escape') {
    e.preventDefault();
    deselectCard(cards);
  }
});

function getBrandVisualFromOutput(output) {
  if (!output) return { primaryColor: '#333' };
  return output.brand_profile?.visual || { primaryColor: '#333' };
}

// ── Quick form ────────────────────────────────────────────────────────────────
els.studioQuickForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const idea = els.studioIdeaInput.value.trim();
  if (!idea) return;

  const brief = {
    goal: idea,
    audience: null,
    offer: els.studioNotesInput.value.trim() || null,
    tone: els.studioVisualMode.value,
    platform: els.studioPlatformSelect.value
  };

  setButtonLoading(els.studioSubmit, "Planning…");
  showStatus("Planning content strategy…");
  resetCheckpoints();
  setCheckpoint("strategy", "active");
  studioState.canvasLoadingStage = "planning";
  studioState.canvasCards = buildCanvasCards(brief, null, makeId);
  renderCanvas();
  showCanvasProgress("Planning content strategy…");

  try {
    const output = await runGeneration(idea, els.studioNotesInput.value.trim());
    finishGeneration(output);
    clearButtonLoading(els.studioSubmit);
    renderInspectorPackage();
  } catch (err) {
    studioState.canvasLoadingStage = null;
    hideCanvasProgress();
    clearButtonLoading(els.studioSubmit);
    console.error("[studio] Generation error:", err);
    showCanvasProgress(err instanceof Error ? err.message : String(err));
    resetCheckpoints();
  }
});

// ── Chat toggle ───────────────────────────────────────────────────────────────
if (els.chatToggle) {
  els.chatToggle.addEventListener("click", () => {
    const open = !els.chatPanel.classList.contains("hidden");
    els.chatPanel.classList.toggle("hidden", open);
    els.chatToggle.classList.toggle("is-active", !open);
  });
}

// ── Chat submit ───────────────────────────────────────────────────────────────
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
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error("Failed to get assistant reply.");

  const { session, shouldGenerate } = await res.json();
  studioState.session = session;

  if (isFirst) {
    studioState.workflowType = inferWorkflow(text);
    updateWorkflowUI();
  }

  syncCardsFromBrief();
  renderMessages();
  renderCanvas();
  renderCheckpoints();

  if (shouldGenerate) {
    studioState.session.checkpoints = studioState.session.checkpoints || {};
    studioState.session.checkpoints.strategy = "active";
    studioState.canvasLoadingStage = "planning";
    renderCheckpoints();
    renderCanvas();
    showCanvasProgress("Planning content strategy…");
    setButtonLoading(els.studioChatSubmit, "Working…");

    const firstMsg = studioState.session.messages.find((m) => m.role === "user")?.text || text;
    try {
      const output = await runGeneration(firstMsg, "");
      finishGeneration(output);
      studioState.session.checkpoints.visuals = "done";
      studioState.session.checkpoints.finalPackage = "done";
      studioState.session.messages.push({
        id: makeId("msg"),
        role: "assistant",
        text: `Done — ${getWorkflowPreset(studioState.workflowType).label.toLowerCase()} placed on the canvas.`,
        createdAt: new Date().toISOString()
      });
      syncCardsFromBrief();
      clearButtonLoading(els.studioChatSubmit);
      hideChatStatus();
      renderMessages();
      renderCanvas();
      renderCheckpoints();
      renderInspectorPackage();
      renderInspectorAsset();
      await persistSession();
    } catch (err) {
      studioState.canvasLoadingStage = null;
      hideCanvasProgress();
      clearButtonLoading(els.studioChatSubmit);
      studioState.session.messages.push({
        id: makeId("msg"),
        role: "assistant",
        text: `Hit a problem: ${err instanceof Error ? err.message : String(err)}`,
        createdAt: new Date().toISOString()
      });
      renderMessages();
      renderCanvas();
      renderCheckpoints();
      hideChatStatus();
      await persistSession();
    }
  }
}

if (els.studioChatForm) els.studioChatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = els.studioChatInput.value.trim();
  if (!text || !studioState.session) return;
  els.studioChatInput.value = "";
  showChatStatus("Thinking…");
  setButtonLoading(els.studioChatSubmit, "Sending…");
  try {
    await submitChatAnswer(text);
  } catch (err) {
    showChatStatus(err instanceof Error ? err.message : String(err));
  } finally {
    if (!studioState.canvasLoadingStage) {
      clearButtonLoading(els.studioChatSubmit);
      hideChatStatus();
    }
  }
});

// ── Session ───────────────────────────────────────────────────────────────────
async function persistSession() {
  if (!studioState.session) return;
  await fetch(`/api/assistant/sessions/${studioState.session.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...studioState.session, workspaceCards: studioState.canvasCards })
  });
}

async function createSession(productId) {
  showStatus("Loading product context…");
  const res = await fetch("/api/assistant/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId })
  });
  studioState.session = await res.json();
  studioState.generatedOutput = null;
  studioState.canvasCards = studioState.session.workspaceCards || [];
  studioState.selectedAsset = null;
  renderMessages();
  renderCanvas();
  renderCheckpoints();
  renderInspectorPackage();
  renderInspectorAsset();
  hideStatus();
}

// ── Refinement ────────────────────────────────────────────────────────────────
function mergeRefinedOutput(currentOutput, refinementOutput, mode, selectedAsset) {
  if (!currentOutput || !refinementOutput?.artifacts?.length) return refinementOutput;
  const next = refinementOutput.artifacts[0];
  const merged = outputAssets(currentOutput)
    .filter((a) => mode !== "replace" || a.itemId !== selectedAsset?.itemId)
    .map((a) => ({
      id: a.itemId, kind: a.assetKind, role: a.role, title: a.text,
      prompt: a.prompt || a.text, asset_path: a.assetUrl,
      preview_path: a.assetUrl, source_asset_id: a.sourceAssetId,
      variant_group: a.variantGroup
    }));
  merged.push(next);
  return { ...currentOutput, post_id: refinementOutput.post_id, workflow_type: "reference-edit", artifacts: merged };
}

els.studioRefineForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!studioState.selectedAsset) {
    els.studioRefineStatus.classList.remove("hidden");
    els.studioRefineStatus.textContent = "Select an asset first.";
    return;
  }
  els.studioRefineStatus.classList.remove("hidden");
  els.studioRefineStatus.textContent = "Generating refined variant…";
  setButtonLoading(els.studioRefineSubmit, "Refining…");

  const brandId = els.studioProductSelect.value;
  const request = {
    brandProfileId: brandId,
    rawIdea: els.studioRefinePrompt.value.trim() || studioState.selectedAsset.prompt || studioState.selectedAsset.text,
    notes: "Refinement request.",
    cards: [],
    references: [],
    referenceAssets: buildReferenceAssets({
      brandId,
      visualMode: els.studioRefineVisualMode.value,
      inputValue: "",
      selectedAsset: studioState.selectedAsset
    }),
    platformTargets: [els.studioPlatformSelect.value],
    goal: getBrandById(brandId)?.defaults?.goal || "awareness",
    workflowType: "reference-edit",
    visualMode: els.studioRefineVisualMode.value,
    targetAssetId: studioState.selectedAsset.itemId,
    deliveryTargets: els.studioDeliveryTarget.value
  };

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });
    const { jobId } = await res.json();
    const output = await pollJob(jobId);
    studioState.generatedOutput = mergeRefinedOutput(studioState.generatedOutput, output, els.studioRefineMode.value, studioState.selectedAsset);
    studioState.selectedAsset = outputAssets(studioState.generatedOutput).at(-1) || null;
    const brief = studioState.session?.inferredBrief || {};
    studioState.canvasCards = buildCanvasCards(brief, studioState.generatedOutput, makeId);
    renderCanvas();
    loadOutputToEngine(studioState.generatedOutput);
    renderInspectorPackage();
    renderInspectorAsset();
    els.studioRefineStatus.textContent = "Done.";
  } catch (err) {
    els.studioRefineStatus.textContent = err instanceof Error ? err.message : String(err);
  } finally {
    clearButtonLoading(els.studioRefineSubmit);
  }
});

// ── Download all ──────────────────────────────────────────────────────────────
async function downloadAllAssets() {
  const output = studioState.generatedOutput;
  if (studioState.downloading || !output) return;
  studioState.downloading = true;
  els.studioDownloadAllBtn.disabled = true;
  els.studioDownloadAllBtn.textContent = "Downloading…";
  try {
    // Use canvas engine's artboards for primary strip filtering if available
    if (studioState.canvasEngine) {
      await downloadAllAsZip(studioState.canvasEngine.getArtboards(), output);
    } else {
      // Fallback to old behavior
      const zip = new window.JSZip();
      await Promise.all(outputAssets(output).map(async (item, i) => {
        if (!item.assetUrl) return;
        const res = await fetch(item.assetUrl);
        if (!res.ok) return;
        const blob = await res.blob();
        const ext = item.assetUrl.split(".").pop() || (item.assetKind === "video" ? "mp4" : "png");
        zip.file(`${item.itemId || `asset-${i + 1}`}.${ext}`, blob);
      }));
      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = `${output.post_id}-assets.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  } catch (err) {
    showStatus(err instanceof Error ? err.message : "Download failed.");
  } finally {
    studioState.downloading = false;
    els.studioDownloadAllBtn.disabled = false;
    els.studioDownloadAllBtn.textContent = "Download All";
  }
}

els.studioDownloadAllBtn.addEventListener("click", downloadAllAssets);

// ── Copy ──────────────────────────────────────────────────────────────────────
els.inspectorCopyCaption.addEventListener("click", () =>
  copyText(studioState.generatedOutput?.caption || "", "Caption")
);
els.inspectorCopyHashtags.addEventListener("click", () =>
  copyText((studioState.generatedOutput?.hashtags || []).join(" "), "Hashtags")
);

// ── Product/mode changes ──────────────────────────────────────────────────────
els.studioProductSelect.addEventListener("change", async () => {
  renderBrandEditor(els.studioProductSelect.value);
  renderReferenceChips();
  await createSession(els.studioProductSelect.value);
});

els.studioVisualMode.addEventListener("change", renderReferenceChips);
els.studioReferenceInput.addEventListener("input", renderReferenceChips);

els.studioReferenceFiles.addEventListener("change", async () => {
  showStatus("Uploading references…");
  try {
    const files = Array.from(els.studioReferenceFiles.files || []);
    for (const file of files) {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, dataUrl })
      });
      const { url } = await res.json();
      const current = els.studioReferenceInput.value.trim();
      els.studioReferenceInput.value = [current, url].filter(Boolean).join("\n");
    }
    renderReferenceChips();
    hideStatus();
  } catch (err) {
    showStatus(err instanceof Error ? err.message : "Upload failed.");
  } finally {
    els.studioReferenceFiles.value = "";
  }
});

// ── Library ───────────────────────────────────────────────────────────────────
// (loadLibrary is defined above with filters)

async function loadOutputIntoCanvas(postId) {
  const res = await fetch(`/api/outputs/${postId}`);
  if (!res.ok) return;
  const output = await res.json();

  // Save current studio state so user can return to it
  if (studioState.generatedOutput && studioState.generatedOutput.post_id !== postId) {
    studioState._previousOutput = studioState.generatedOutput;
  }

  studioState.generatedOutput = output;
  studioState.workflowType = output.workflow_type || "slideshow";
  studioState.selectedAsset = outputAssets(output)[0] || null;
  resetCheckpoints();
  ["strategy", "hooks", "visuals", "finalPackage"].forEach((s) => setCheckpoint(s, "done"));
  const brief = { goal: output.caption || output.post_id, audience: null, offer: null, tone: null, platform: null };
  studioState.canvasCards = buildCanvasCards(brief, output, makeId);
  renderCanvas();
  loadOutputToEngine(output);
  renderInspectorPackage();
  renderInspectorAsset();
  switchView("studio");
}

els.libraryList.addEventListener("click", async (e) => {
  const viewBtn = e.target.closest("[data-post-id]");
  if (viewBtn) {
    loadOutputIntoCanvas(viewBtn.dataset.postId);
    return;
  }
  const dupBtn = e.target.closest("[data-duplicate-id]");
  if (dupBtn) {
    const res = await fetch(`/api/outputs/${dupBtn.dataset.duplicateId}`);
    if (!res.ok) return;
    const output = await res.json();
    // Pre-fill studio with this output's idea
    els.studioIdeaInput.value = output.caption || output.hooks?.[0] || "";
    const brand = studioState.brands.find((b) => b.id === output.brand_profile?.id);
    if (brand) els.studioProductSelect.value = brand.id;
    switchView("studio");
  }
});

// ── Brand editor ──────────────────────────────────────────────────────────────
function renderBrandEditor(brandId) {
  const brand = getBrandById(brandId);
  const mascot = brand?.mascot;
  els.brandMascotName.textContent = mascot?.name || "No mascot configured";
  els.brandMascotRole.textContent = mascot?.role || "This brand does not yet have a mascot system.";
  els.brandMascotVisualPrompt.value = mascot?.visualPrompt || "";
  els.brandMascotRules.value = (mascot?.usageRules || []).join("\n");
  els.brandMascotReferences.innerHTML = (mascot?.referenceImages || []).map((ref, i) => {
    const imgUrl = ref.startsWith("/api/") ? ref : `/api/brand-assets/${brandId}/${i}`;
    const label = ref.split("/").pop() || `reference ${i + 1}`;
    const title = escapeHtml(`${mascot?.name || brand?.name || "Mascot"} reference ${i + 1}`);
    return `<div class="brand-ref-card">
      <button type="button" data-brand-asset-url="${imgUrl}" data-brand-asset-title="${title}">
        <img src="${imgUrl}" alt="${title}" loading="lazy" />
      </button>
      <span>${escapeHtml(label)}</span>
      <button type="button" class="ghost-button brand-ref-remove" data-brand-id="${escapeHtml(brandId)}" data-ref-index="${i}" style="font-size:0.65rem;padding:4px 8px">Remove</button>
    </div>`;
  }).join("");
}

if (els.brandMascotReferences) els.brandMascotReferences.addEventListener("click", async (e) => {
  const previewBtn = e.target.closest("[data-brand-asset-url]");
  if (previewBtn) {
    openAssetPreview(previewBtn.dataset.brandAssetUrl, previewBtn.dataset.brandAssetTitle || "Mascot reference");
    return;
  }
  const removeBtn = e.target.closest(".brand-ref-remove");
  if (!removeBtn) return;
  await fetch(`/api/brands/${removeBtn.dataset.brandId}/mascot-refs/${removeBtn.dataset.refIndex}`, { method: "DELETE" });
  studioState.brands = await fetch("/api/brands").then((r) => r.json());
  renderBrandEditor(els.studioProductSelect.value);
});

if (els.brandEditorSave) els.brandEditorSave.addEventListener("click", async () => {
  const brandId = els.studioProductSelect.value;
  const res = await fetch(`/api/brands/${brandId}`);
  const existing = await res.json();
  const mascot = existing.mascot || { name: `${existing.name} Mascot`, description: "", role: "", visualPrompt: "", usageRules: [], referenceImages: [] };
  await fetch("/api/brands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...existing,
      mascot: {
        ...mascot,
        visualPrompt: els.brandMascotVisualPrompt.value.trim(),
        usageRules: els.brandMascotRules.value.split("\n").map((l) => l.trim()).filter(Boolean)
      }
    })
  });
  studioState.brands = await fetch("/api/brands").then((r) => r.json());
  renderBrandEditor(brandId);
  els.brandEditorStatus.classList.remove("hidden");
  els.brandEditorStatus.textContent = "Saved.";
  setTimeout(() => els.brandEditorStatus.classList.add("hidden"), 1500);
});

if (els.brandMascotRefFiles) els.brandMascotRefFiles.addEventListener("change", async () => {
  const brandId = els.studioProductSelect.value;
  const files = Array.from(els.brandMascotRefFiles.files);
  if (!files.length) return;
  els.brandMascotRefStatus.classList.remove("hidden");
  els.brandMascotRefStatus.textContent = `Uploading ${files.length} image${files.length > 1 ? "s" : ""}…`;
  try {
    for (const file of files) {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await fetch(`/api/brands/${brandId}/mascot-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, dataUrl })
      });
    }
    studioState.brands = await fetch("/api/brands").then((r) => r.json());
    renderBrandEditor(brandId);
    els.brandMascotRefStatus.textContent = "Images uploaded.";
    setTimeout(() => els.brandMascotRefStatus.classList.add("hidden"), 1500);
  } catch (err) {
    els.brandMascotRefStatus.textContent = err instanceof Error ? err.message : "Upload failed.";
  } finally {
    els.brandMascotRefFiles.value = "";
  }
});

// ── Load products ─────────────────────────────────────────────────────────────
async function loadProducts() {
  const [productsRes, brandsRes] = await Promise.all([fetch("/api/products"), fetch("/api/brands")]);
  studioState.products = await productsRes.json();
  studioState.brands = await brandsRes.json();
  const options = studioState.products.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
  els.studioProductSelect.innerHTML = options;
  els.studioProductSelect.value = "peppera";
  // Populate calendar brand select
  calEls.brandSelect.innerHTML = `<option value="">All brands</option>` + studioState.products.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
  // Populate library brand filter
  calEls.libraryBrandFilter.innerHTML = `<option value="">All brands</option>` + studioState.brands.map((b) => `<option value="${b.id}">${b.name}</option>`).join("");
}

// ── Calendar ──────────────────────────────────────────────────────────────────
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekStart(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1 - day) + offset * 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function formatDateShort(d) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function getWeekDates(offset) {
  const start = getWeekStart(offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

async function loadCalendar() {
  const [slotsRes, pillarsRes] = await Promise.all([fetch("/api/calendar"), fetch("/api/pillars")]);
  calendarState.slots = await slotsRes.json();
  calendarState.pillars = await pillarsRes.json();
  calendarState.selectedSlotIds.clear();
  renderCalendar();
  renderPillars();
}

function renderCalendar() {
  const dates = getWeekDates(calendarState.weekOffset);
  const start = dates[0];
  const end = dates[6];
  calEls.weekLabel.textContent = `${formatDateShort(start)} — ${formatDateShort(end)}`;

  const today = formatDate(new Date());
  const brandFilter = calEls.brandSelect.value;

  calEls.grid.innerHTML = dates.map((date) => {
    const dateStr = formatDate(date);
    const isToday = dateStr === today;
    const daySlots = calendarState.slots.filter((s) => {
      if (s.date !== dateStr) return false;
      if (brandFilter && s.brandProfileId !== brandFilter) return false;
      return true;
    });

    const slotsHtml = daySlots.map((slot) => {
      const selected = calendarState.selectedSlotIds.has(slot.id);
      const brand = studioState.brands.find((b) => b.id === slot.brandProfileId);
      return `<div class="calendar-slot${selected ? " is-selected" : ""}" data-slot-id="${slot.id}">
        <div class="calendar-slot__meta">
          <span class="calendar-slot__status" data-status="${slot.status}"></span>
          <span>${brand?.name || slot.brandProfileId}</span>
          <span>· ${slot.platform || "—"}</span>
        </div>
        <div class="calendar-slot__idea">${escapeHtml(slot.idea || "No idea yet")}</div>
      </div>`;
    }).join("");

    return `<div class="calendar-day${isToday ? " is-today" : ""}">
      <div class="calendar-day__header">
        <span class="calendar-day__name">${DAY_NAMES[date.getDay() === 0 ? 6 : date.getDay() - 1]}</span>
        <span class="calendar-day__date">${date.getDate()}</span>
        <button class="calendar-day__add" data-add-date="${dateStr}" type="button" title="Add slot">+</button>
      </div>
      ${slotsHtml}
    </div>`;
  }).join("");
}

function renderPillars() {
  calEls.pillarsList.innerHTML = calendarState.pillars.map((p) =>
    `<span class="pillar-chip" data-pillar-id="${p.id}">
      ${escapeHtml(p.name)} <span class="pillar-chip__freq">${p.frequency}</span>
    </span>`
  ).join("");
}

function showCalendarStatus(text) {
  calEls.calendarStatus.classList.remove("hidden");
  calEls.calendarStatus.textContent = text;
}

function hideCalendarStatus() {
  calEls.calendarStatus.classList.add("hidden");
}

// Calendar navigation
calEls.weekPrev.addEventListener("click", () => { calendarState.weekOffset--; renderCalendar(); });
calEls.weekNext.addEventListener("click", () => { calendarState.weekOffset++; renderCalendar(); });
calEls.brandSelect.addEventListener("change", renderCalendar);

// Click slot to select or edit
calEls.grid.addEventListener("click", (e) => {
  const slotEl = e.target.closest("[data-slot-id]");
  const addBtn = e.target.closest("[data-add-date]");

  if (addBtn) {
    calendarState.editingSlotId = null;
    calendarState.editingSlotDate = addBtn.dataset.addDate;
    calEls.slotModalTitle.textContent = `Add content — ${addBtn.dataset.addDate}`;
    calEls.slotIdea.value = "";
    calEls.slotPillar.innerHTML = `<option value="">None</option>` +
      calendarState.pillars.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
    calEls.slotPlatform.value = "instagram";
    calEls.slotStatus.value = "idea";
    calEls.slotModal.classList.remove("hidden");
    return;
  }

  if (slotEl) {
    if (e.shiftKey) {
      // Shift-click to toggle selection for batch
      const id = slotEl.dataset.slotId;
      if (calendarState.selectedSlotIds.has(id)) {
        calendarState.selectedSlotIds.delete(id);
      } else {
        calendarState.selectedSlotIds.add(id);
      }
      renderCalendar();
    } else {
      // Regular click to edit
      const slot = calendarState.slots.find((s) => s.id === slotEl.dataset.slotId);
      if (!slot) return;
      calendarState.editingSlotId = slot.id;
      calendarState.editingSlotDate = slot.date;
      calEls.slotModalTitle.textContent = `Edit — ${slot.date}`;
      calEls.slotIdea.value = slot.idea || "";
      calEls.slotPillar.innerHTML = `<option value="">None</option>` +
        calendarState.pillars.map((p) => `<option value="${p.id}"${p.id === slot.pillar ? " selected" : ""}>${p.name}</option>`).join("");
      calEls.slotPlatform.value = slot.platform || "instagram";
      calEls.slotStatus.value = slot.status || "idea";
      calEls.slotModal.classList.remove("hidden");
    }
  }
});

// Slot modal save
calEls.slotForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = {
    date: calendarState.editingSlotDate,
    brandProfileId: calEls.brandSelect.value || els.studioProductSelect.value || "peppera",
    platform: calEls.slotPlatform.value,
    pillar: calEls.slotPillar.value,
    idea: calEls.slotIdea.value.trim(),
    status: calEls.slotStatus.value,
    tags: []
  };

  if (calendarState.editingSlotId) {
    await fetch(`/api/calendar/${calendarState.editingSlotId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } else {
    await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }
  calEls.slotModal.classList.add("hidden");
  await loadCalendar();
});

// Slot delete
calEls.slotDelete.addEventListener("click", async () => {
  if (!calendarState.editingSlotId) return;
  await fetch(`/api/calendar/${calendarState.editingSlotId}`, { method: "DELETE" });
  calEls.slotModal.classList.add("hidden");
  await loadCalendar();
});

// Slot modal close
calEls.slotModalClose.addEventListener("click", () => calEls.slotModal.classList.add("hidden"));
calEls.slotModal.addEventListener("click", (e) => {
  if (e.target.dataset.closeSlotModal) calEls.slotModal.classList.add("hidden");
});

// Pillar modal
calEls.addPillarBtn.addEventListener("click", () => {
  calendarState.editingPillarId = null;
  calEls.pillarName.value = "";
  calEls.pillarDescription.value = "";
  calEls.pillarFrequency.value = "weekly";
  calEls.pillarPlatform.value = "instagram";
  calEls.pillarIdeas.value = "";
  calEls.pillarModal.classList.remove("hidden");
});

calEls.pillarsList.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-pillar-id]");
  if (!chip) return;
  const pillar = calendarState.pillars.find((p) => p.id === chip.dataset.pillarId);
  if (!pillar) return;
  calendarState.editingPillarId = pillar.id;
  calEls.pillarName.value = pillar.name;
  calEls.pillarDescription.value = pillar.description || "";
  calEls.pillarFrequency.value = pillar.frequency || "weekly";
  calEls.pillarPlatform.value = pillar.platforms?.[0] || "instagram";
  calEls.pillarIdeas.value = (pillar.exampleIdeas || []).join("\n");
  calEls.pillarModal.classList.remove("hidden");
});

calEls.pillarForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = {
    id: calendarState.editingPillarId || undefined,
    brandProfileId: calEls.brandSelect.value || els.studioProductSelect.value || "peppera",
    name: calEls.pillarName.value.trim(),
    description: calEls.pillarDescription.value.trim(),
    frequency: calEls.pillarFrequency.value,
    platforms: [calEls.pillarPlatform.value],
    exampleIdeas: calEls.pillarIdeas.value.split("\n").map((l) => l.trim()).filter(Boolean)
  };
  await fetch("/api/pillars", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  calEls.pillarModal.classList.add("hidden");
  await loadCalendar();
});

calEls.pillarDelete.addEventListener("click", async () => {
  if (!calendarState.editingPillarId) return;
  await fetch(`/api/pillars/${calendarState.editingPillarId}`, { method: "DELETE" });
  calEls.pillarModal.classList.add("hidden");
  await loadCalendar();
});

calEls.pillarModalClose.addEventListener("click", () => calEls.pillarModal.classList.add("hidden"));
calEls.pillarModal.addEventListener("click", (e) => {
  if (e.target.dataset.closePillarModal) calEls.pillarModal.classList.add("hidden");
});

// Batch generate
calEls.batchGenerate.addEventListener("click", async () => {
  const ids = [...calendarState.selectedSlotIds];
  if (!ids.length) {
    showCalendarStatus("Shift-click slots to select them for batch generation.");
    setTimeout(hideCalendarStatus, 2500);
    return;
  }
  showCalendarStatus(`Generating ${ids.length} slot${ids.length > 1 ? "s" : ""}…`);
  try {
    const res = await fetch("/api/calendar/batch-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotIds: ids })
    });
    const { results } = await res.json();
    const ok = results.filter((r) => r.jobId).length;
    const failed = results.filter((r) => r.error).length;
    showCalendarStatus(`Queued ${ok} job${ok !== 1 ? "s" : ""}${failed ? `, ${failed} failed` : ""}.`);
    calendarState.selectedSlotIds.clear();
    await loadCalendar();
    setTimeout(hideCalendarStatus, 3000);
  } catch (err) {
    showCalendarStatus(err instanceof Error ? err.message : String(err));
  }
});

// Auto-fill from pillars
calEls.autoFill.addEventListener("click", async () => {
  if (!calendarState.pillars.length) {
    showCalendarStatus("Add content pillars first.");
    setTimeout(hideCalendarStatus, 2000);
    return;
  }
  const dates = getWeekDates(calendarState.weekOffset);
  const brandId = calEls.brandSelect.value || els.studioProductSelect.value || "peppera";
  const existingDates = new Set(calendarState.slots.filter((s) => s.brandProfileId === brandId).map((s) => s.date));
  let created = 0;

  for (const pillar of calendarState.pillars) {
    if (pillar.brandProfileId && pillar.brandProfileId !== brandId) continue;
    const ideas = pillar.exampleIdeas || [];
    if (!ideas.length) continue;

    // Find an empty weekday for this pillar
    for (const date of dates) {
      const dateStr = formatDate(date);
      if (existingDates.has(dateStr)) continue;
      if (date.getDay() === 0 || date.getDay() === 6) continue; // skip weekends

      const idea = ideas[Math.floor(Math.random() * ideas.length)];
      await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          brandProfileId: brandId,
          platform: pillar.platforms?.[0] || "instagram",
          pillar: pillar.id,
          idea,
          status: "idea",
          tags: [pillar.name]
        })
      });
      existingDates.add(dateStr);
      created++;
      break;
    }
  }

  showCalendarStatus(created ? `Added ${created} slot${created > 1 ? "s" : ""} from pillars.` : "No empty weekday slots available.");
  await loadCalendar();
  setTimeout(hideCalendarStatus, 2500);
});

// ── Library with filters ──────────────────────────────────────────────────────
let libraryOutputs = [];

async function loadLibrary() {
  const res = await fetch("/api/outputs");
  libraryOutputs = await res.json();
  renderLibrary();
}

function renderLibrary() {
  const brandFilter = calEls.libraryBrandFilter?.value || "";
  const platformFilter = calEls.libraryPlatformFilter?.value || "";
  const search = (calEls.librarySearch?.value || "").toLowerCase().trim();

  let filtered = libraryOutputs;
  if (brandFilter) filtered = filtered.filter((o) => o.product === brandFilter);
  if (platformFilter) filtered = filtered.filter((o) => o.platform === platformFilter);
  if (search) filtered = filtered.filter((o) =>
    (o.postId || "").toLowerCase().includes(search) ||
    (o.product || "").toLowerCase().includes(search)
  );

  if (!filtered.length) {
    els.libraryList.innerHTML = `<p class="library-empty">${libraryOutputs.length ? "No results match your filters." : "No past generations yet. Go to Studio to make your first post."}</p>`;
    return;
  }

  els.libraryList.innerHTML = filtered.map((item) => {
    const date = item.createdAt
      ? new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : "—";
    return `<div class="library-item">
      <div class="library-item__meta">
        <span class="library-item__id">${escapeHtml(item.postId)}</span>
        <span class="library-item__detail">${escapeHtml(titleCase(item.product))} · ${escapeHtml(titleCase(item.platform))} · ${date}</span>
      </div>
      <div class="library-item__actions">
        <button class="ghost-button" type="button" data-post-id="${escapeHtml(item.postId)}">View</button>
        <button class="ghost-button" type="button" data-duplicate-id="${escapeHtml(item.postId)}">Duplicate</button>
      </div>
    </div>`;
  }).join("");
}

calEls.libraryBrandFilter?.addEventListener("change", renderLibrary);
calEls.libraryPlatformFilter?.addEventListener("change", renderLibrary);
calEls.librarySearch?.addEventListener("input", renderLibrary);

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap() {
  await loadProducts();
  renderBrandEditor("peppera");
  updateWorkflowUI();
  await createSession("peppera");
  initCanvasDrag();

  // Initialize CanvasEngine on the studio canvas stage
  const stageEl = document.querySelector(".studio-canvas-stage");
  console.log("[studio] Canvas stage element:", stageEl ? "found" : "NOT FOUND");
  if (stageEl) {
    try {
      studioState.canvasEngine = new CanvasEngine(stageEl, {
        onSelect: (artboardDesc) => {
          if (artboardDesc) {
            studioState.selectedAsset = {
              itemId: artboardDesc.id,
              assetKind: artboardDesc.type,
              role: artboardDesc.role,
              text: artboardDesc.text || artboardDesc.label,
              prompt: artboardDesc.prompt,
              assetUrl: artboardDesc.assetUrl,
              sourceAssetId: null,
              variantGroup: null,
              slideNumber: artboardDesc.slideNumber,
              order: artboardDesc.order
            };
          } else {
            studioState.selectedAsset = null;
          }
          renderInspectorAsset();
        },
        onReorder: (orderedIds) => {
          if (studioState.generatedOutput) {
            studioState.generatedOutput._artboardOrder = orderedIds;
          }
        },
        onZoomChange: () => {}
      });
      console.log("[studio] CanvasEngine created successfully");
    } catch (err) {
      console.error("[studio] CanvasEngine creation FAILED:", err);
    }
  }

  // Mobile inspector overlay toggle
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
  if (inspectorToggle && inspector) {
    inspectorToggle.addEventListener("click", () => inspector.classList.toggle("hidden"));
  }

  // Inspector close button
  const inspectorClose = document.getElementById("inspector-overlay-close");
  if (inspectorClose && inspector) {
    inspectorClose.addEventListener("click", () => inspector.classList.add("hidden"));
  }

  els.studioIdeaInput.focus();
}

/**
 * Set up mobile inspector FAB toggle and overlay behavior.
 * At ≤640px viewport: sidebar/inspector hidden, FAB shows inspector as overlay.
 */
function initMobileInspector() {
  const fab = document.getElementById("canvas-fab-inspector");
  const inspector = document.getElementById("studio-inspector");
  const closeBtn = document.getElementById("inspector-overlay-close");
  if (!fab || !inspector) return;

  function openInspectorOverlay() {
    inspector.classList.add("studio-inspector--overlay", "is-open");
    inspector.style.display = "";
  }

  function closeInspectorOverlay() {
    inspector.classList.remove("is-open");
    // After transition, remove overlay class
    setTimeout(() => {
      if (!inspector.classList.contains("is-open")) {
        inspector.classList.remove("studio-inspector--overlay");
      }
    }, 300);
  }

  fab.addEventListener("click", () => {
    if (inspector.classList.contains("is-open")) {
      closeInspectorOverlay();
    } else {
      openInspectorOverlay();
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", closeInspectorOverlay);
  }

  // Responsive layout: vertical artboards at ≤640px
  const mql = window.matchMedia("(max-width: 640px)");
  function handleMobileLayout(e) {
    if (!studioState.canvasEngine) return;
    if (e.matches) {
      studioState.canvasEngine.arrangeVertical();
    } else {
      studioState.canvasEngine.arrangeHorizontal();
      // Close overlay if open
      closeInspectorOverlay();
    }
  }
  mql.addEventListener("change", handleMobileLayout);
  // Apply on init if already mobile
  if (mql.matches && studioState.canvasEngine) {
    studioState.canvasEngine.arrangeVertical();
  }
}

bootstrap().catch((err) => showStatus(err instanceof Error ? err.message : String(err)));
