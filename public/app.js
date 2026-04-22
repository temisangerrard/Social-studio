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
  uploadedAssets: [],
  assetAnalyses: [],
  routePreview: null,
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
    library: document.getElementById("view-library"),
    admin: document.getElementById("view-admin")
  },

  studioProductSelect: document.getElementById("studio-product-select"),
  studioContentTypeSelect: document.getElementById("studio-content-type-select"),
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
  studioUploadTrigger: document.getElementById("studio-upload-trigger"),
  studioUploadedAssets: document.getElementById("studio-uploaded-assets"),
  studioRoutePreview: document.getElementById("studio-route-preview"),
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

const adminEls = {
  traceSelect: document.getElementById("admin-trace-select"),
  routingTree: document.getElementById("admin-routing-tree"),
  routingTrace: document.getElementById("admin-routing-trace")
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

// ── Upload Queue ──────────────────────────────────────────────────────────────
const uploadQueue = {
  /** @type {Array<{ file: File, dataUrl: string, status: 'pending'|'uploading'|'done'|'error' }>} */
  files: [],

  /**
   * Accept a FileList, read each file as a base64 data URL, push to the queue.
   * @param {FileList} fileList
   */
  add(fileList) {
    const promises = Array.from(fileList).map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            this.files.push({ file, dataUrl: reader.result, status: "pending" });
            resolve();
          };
          reader.onerror = () => {
            // Still queue the file but mark as error
            this.files.push({ file, dataUrl: "", status: "error" });
            resolve();
          };
          reader.readAsDataURL(file);
        })
    );
    Promise.all(promises).then(() => this._updateBadge());
  },

  /**
   * Remove a queued file by index.
   * @param {number} index
   */
  remove(index) {
    if (index >= 0 && index < this.files.length) {
      this.files.splice(index, 1);
    }
    this._updateBadge();
  },

  /** Clear all queued files. */
  clear() {
    this.files.length = 0;
    this._updateBadge();
  },

  /**
   * POST each pending file to /api/uploads and return results.
   * @returns {Promise<Array<{ filename: string, url: string, mimeType: string }>>}
   */
  async uploadAll() {
    const results = [];
    for (const item of this.files) {
      if (item.status !== "pending") continue;
      item.status = "uploading";
      try {
        const res = await fetch("/api/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: item.file.name, dataUrl: item.dataUrl }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Upload failed" }));
          item.status = "error";
          item.error = err.error || `HTTP ${res.status}`;
          continue;
        }
        const data = await res.json();
        item.status = "done";
        item.result = data;
        results.push(data);
      } catch (e) {
        item.status = "error";
        item.error = e.message || "Network error";
      }
    }
    this._updateBadge();
    return results;
  },

  /** Update the #toolbar-upload-count badge text and visibility. */
  _updateBadge() {
    const badge = document.getElementById("toolbar-upload-count");
    if (!badge) return;
    const count = this.files.length;
    badge.textContent = String(count);
    badge.classList.toggle("hidden", count === 0);
  },
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
  if (name === "admin") loadAdmin();
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
  if (!els.studioChatStatus) return;
  els.studioChatStatus.classList.remove("hidden");
  els.studioChatStatus.textContent = text;
}

function hideChatStatus() {
  if (!els.studioChatStatus) return;
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
  const uploadedRefs = (studioState.uploadedAssets || [])
    .filter((asset) => asset.mimeType?.startsWith("image/"))
    .map((asset) => ({
      id: asset.id,
      label: asset.label || asset.filename,
      url: asset.url,
      source: "asset",
      kind: "image"
    }));
  const assetRefs = selectedAsset?.assetUrl && selectedAsset.assetKind === "image"
    ? [{ id: `asset-ref-${selectedAsset.itemId || "sel"}`, label: selectedAsset.text || "Selected", url: selectedAsset.assetUrl, source: "asset", kind: "image" }]
    : [];
  return [...brandRefs, ...uploadedRefs, ...assetRefs, ...runRefs];
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

function assetAnalysisForId(assetId) {
  return studioState.assetAnalyses.find((analysis) => analysis.assetId === assetId) || null;
}

async function analyzeUploadedAssetRecord(asset) {
  const res = await fetch("/api/uploads/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      brandProfileId: els.studioProductSelect.value,
      prompt: els.studioIdeaInput.value.trim(),
      asset
    })
  });
  if (!res.ok) throw new Error("Failed to analyze upload.");
  return res.json();
}

async function loadExistingUploads() {
  try {
    const res = await fetch("/api/uploads");
    if (!res.ok) return;
    const assets = await res.json();
    if (Array.isArray(assets) && assets.length) {
      // Merge: don't duplicate assets already in state (e.g. from this session)
      const existingIds = new Set(studioState.uploadedAssets.map((a) => a.id));
      const fresh = assets.filter((a) => !existingIds.has(a.id));
      studioState.uploadedAssets = [...fresh, ...studioState.uploadedAssets];
      renderUploadedAssets();
    }
  } catch { /* network error — ignore */ }
}

function renderUploadedAssets() {
  if (!els.studioUploadedAssets) return;
  if (!studioState.uploadedAssets.length) {
    els.studioUploadedAssets.innerHTML = `<p class="assistant-status">No uploads yet.</p>`;
    return;
  }

  els.studioUploadedAssets.innerHTML = studioState.uploadedAssets.map((asset) => {
    const analysis = assetAnalysisForId(asset.id);
    const confidence = analysis ? `${Math.round((analysis.confidence || 0) * 100)}%` : "–";
    return `
      <div class="uploaded-asset-card" data-upload-id="${escapeHtml(asset.id)}">
        <div class="uploaded-asset-card__thumb-row">
          <img class="uploaded-asset-card__preview" src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.label || asset.filename)}" />
          <button class="uploaded-asset-card__delete" data-upload-id="${escapeHtml(asset.id)}" type="button" title="Remove">✕</button>
        </div>
        <div class="uploaded-asset-card__meta">
          <strong>${escapeHtml(asset.label || asset.filename)}</strong>
          <span>${escapeHtml(analysis?.subjectSummary || "Not yet analysed")}</span>
          <span>Confidence: ${escapeHtml(confidence)}</span>
        </div>
        <input class="uploaded-asset-card__input" data-upload-field="label" value="${escapeHtml(asset.label || "")}" placeholder="Label (e.g. 'hero product photo')" />
        <textarea class="uploaded-asset-card__notes" data-upload-field="notes" rows="2" placeholder="Optional notes for the AI">${escapeHtml(asset.notes || "")}</textarea>
      </div>
    `;
  }).join("");

  // Wire delete buttons
  els.studioUploadedAssets.querySelectorAll(".uploaded-asset-card__delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.uploadId;
      studioState.uploadedAssets = studioState.uploadedAssets.filter((a) => a.id !== id);
      studioState.assetAnalyses = studioState.assetAnalyses.filter((a) => a.assetId !== id);
      renderUploadedAssets();
      await fetch("/api/uploads", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
    });
  });
}

function renderRoutePreview() {
  if (!els.studioRoutePreview) return;
  const preview = studioState.routePreview;
  if (!preview?.decision) {
    els.studioRoutePreview.innerHTML = `<p class="assistant-status">Upload assets or enter a prompt to preview the route.</p>`;
    return;
  }

  const decision = preview.decision;
  const candidates = (decision.candidates || [])
    .slice(0, 3)
    .map((candidate) => `<li>${escapeHtml(candidate.recipeId)} — ${escapeHtml(candidate.routeFamily)} (${candidate.score})</li>`)
    .join("");

  els.studioRoutePreview.innerHTML = `
    <div class="route-preview__summary">
      <strong>${escapeHtml(decision.recipeId)}</strong>
      <span>${escapeHtml(decision.routeFamily)} → ${escapeHtml(decision.workflowType)}</span>
      <p>${escapeHtml(decision.reasonSummary || "No routing summary available.")}</p>
      ${decision.requiresConfirmation ? `<p class="assistant-status">Low confidence: review the asset labels before generating.</p>` : ""}
    </div>
    <ul class="route-preview__candidates">${candidates}</ul>
  `;
}

function renderInlineRoutePreview() {
  const el = document.getElementById("studio-route-inline");
  if (!el) return;

  const decision = studioState.routePreview?.decision;
  if (!decision) {
    el.classList.add("hidden");
    return;
  }

  const workflowLabel = decision.workflowType || studioState.workflowType || "slideshow";
  const contentTypeLabel = decision.contentTypeId || "";
  const deliveryLabel = decision.deliveryTargets || "";

  const parts = [];
  parts.push(`<span class="route-inline__badge">${escapeHtml(workflowLabel)}</span>`);
  if (contentTypeLabel) {
    parts.push(`<span class="route-inline__label">${escapeHtml(contentTypeLabel)}</span>`);
  }
  if (deliveryLabel) {
    parts.push(`<span class="route-inline__label">→ ${escapeHtml(deliveryLabel)}</span>`);
  }

  // Show upload count if any
  const uploadCount = (studioState.uploadedAssets || []).length;
  if (uploadCount > 0) {
    parts.push(`<span class="route-inline__label">${uploadCount} upload${uploadCount > 1 ? 's' : ''}</span>`);
  }

  el.innerHTML = parts.join(" ");
  el.classList.remove("hidden");
}

async function refreshRoutePreview() {
  const rawIdea = els.studioIdeaInput.value.trim();
  if (!rawIdea && !studioState.uploadedAssets.length) {
    studioState.routePreview = null;
    renderRoutePreview();
    renderInlineRoutePreview();
    return;
  }

  try {
    const res = await fetch("/api/routes/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandProfileId: els.studioProductSelect.value,
        rawIdea,
        notes: els.studioNotesInput.value.trim(),
        platformTargets: [els.studioPlatformSelect.value],
        goal: getBrandById(els.studioProductSelect.value)?.defaults?.goal || "awareness",
        uploadedAssets: studioState.uploadedAssets,
        assetAnalyses: studioState.assetAnalyses
      })
    });
    if (!res.ok) throw new Error("Failed to preview route.");
    studioState.routePreview = await res.json();
  } catch (err) {
    studioState.routePreview = {
      decision: {
        recipeId: "unavailable",
        routeFamily: "carousel",
        workflowType: "slideshow",
        reasonSummary: err instanceof Error ? err.message : "Route preview unavailable.",
        candidates: [],
        requiresConfirmation: false
      }
    };
  }
  renderRoutePreview();
  renderInlineRoutePreview();
}

// ── Content Type Selector ─────────────────────────────────────────────────────
function updateContentTypeSelector(brandId) {
  const brand = getBrandById(brandId);
  const select = els.studioContentTypeSelect;
  if (!select) return;

  if (!brand || !brand.contentTypes || brand.contentTypes.length === 0) {
    select.innerHTML = '<option value="">Standard</option>';
    return;
  }

  select.innerHTML = brand.contentTypes.map((ct) =>
    `<option value="${escapeHtml(ct.id)}">${escapeHtml(ct.name)}</option>`
  ).join("");

  // Auto-select default content type
  if (brand.defaultContentType) {
    select.value = brand.defaultContentType;
  }

  // Inject context-aware content types based on uploaded asset analyses
  const analyses = studioState.assetAnalyses || [];
  const platform = els.studioPlatformSelect?.value || "instagram";

  if (analyses.some(a => a.assetType === "person_photo") && platform === "linkedin") {
    const opt = document.createElement("option");
    opt.value = "linkedin-photo-post";
    opt.textContent = "LinkedIn Post with Photo";
    select.appendChild(opt);
  }
  if (analyses.some(a => a.assetType === "product_photo")) {
    const opt = document.createElement("option");
    opt.value = "product-showcase";
    opt.textContent = "Product Showcase";
    select.appendChild(opt);
  }
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
  // Content is now shown as canvas overlays — nothing to render here.
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

  // Show/hide the inspector panel — only visible when an asset is selected
  if (inspectorEl) {
    inspectorEl.classList.toggle("hidden", !sel);
  }

  if (!sel) return;
  els.inspectorAssetTitle.textContent = sel.text || "Selected asset";
  els.inspectorAssetHint.textContent = `${titleCase(sel.assetKind || "image")} — click to open full size.`;
  showAssetNode(els.inspectorAssetPreview, sel);
  els.studioRefinePrompt.value ||= sel.prompt || "";

  // Add click handler to open asset in modal
  els.inspectorAssetPreview.style.cursor = "pointer";
  els.inspectorAssetPreview.onclick = () => {
    openAssetPreview(sel.assetUrl, sel.text || "Asset", sel.assetKind || "image");
  };

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
  if (!els.studioMessageThread) return;
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
  const workflowOverride =
    studioState.routePreview?.decision?.workflowType && studioState.routePreview.decision.workflowType !== studioState.workflowType
      ? studioState.workflowType
      : undefined;
  const contentTypeOverride =
    studioState.routePreview?.decision?.contentTypeId && els.studioContentTypeSelect?.value && els.studioContentTypeSelect.value !== studioState.routePreview.decision.contentTypeId
      ? els.studioContentTypeSelect.value
      : undefined;
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
    uploadedAssets: studioState.uploadedAssets,
    assetAnalyses: studioState.assetAnalyses,
    platformTargets: [els.studioPlatformSelect.value],
    goal: getBrandById(brandId)?.defaults?.goal || "awareness",
    workflowType: studioState.routePreview?.decision?.workflowType || studioState.workflowType,
    visualMode: els.studioVisualMode.value,
    deliveryTargets: studioState.routePreview?.decision?.deliveryTargets || els.studioDeliveryTarget.value,
    contentTypeId: studioState.routePreview?.decision?.contentTypeId || els.studioContentTypeSelect?.value || undefined,
    routingOverride: workflowOverride || contentTypeOverride
      ? {
          workflowType: workflowOverride,
          contentTypeId: contentTypeOverride
        }
      : undefined,
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
      showCanvasProgress("Generating visuals…");
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
  if (output.routing_decision) {
    studioState.routePreview = {
      decision: output.routing_decision,
      trace: output.routing_trace
    };
  }
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
  renderRoutePreview();
}

/**
 * Load output into the CanvasEngine (infinite canvas).
 * Delegates to CanvasEngine.loadOutput() which handles artboard descriptor
 * building, DOM reconciliation, zoom-to-fit, and connector rendering.
 *
 * @param {object} output - PostMetadata from the server.
 */
function loadOutputToEngine(output) {
  if (!output || !studioState.canvasEngine) return;
  if (els.canvasEmpty) els.canvasEmpty.classList.add("hidden");
  studioState.canvasEngine.loadOutput(output);
  // Show download-all button in toolbar once content is loaded
  const dlAllBtn = document.getElementById("toolbar-download-all-btn");
  if (dlAllBtn) dlAllBtn.classList.remove("hidden");
}

// ── Brand Selection Ring ──────────────────────────────────────────────────────

/**
 * Apply a brand-coloured selection ring to the currently selected artboard.
 * Uses the brand's primaryColor from the generated output's brand_profile.
 * @param {object} artboardDesc - The selected artboard descriptor.
 */
function applyBrandSelectionRing(artboardDesc) {
  clearBrandSelectionRing();
  const output = studioState.generatedOutput;
  const primaryColor = output?.brand_profile?.visual?.primaryColor || '#6f5c45';
  const el = document.querySelector(`.canvas-artboard[data-artboard-id="${artboardDesc.id}"]`);
  if (el) {
    el.style.outline = `3px solid ${primaryColor}`;
    el.style.outlineOffset = '2px';
    el.style.boxShadow = `0 0 12px ${primaryColor}44`;
  }
}

/**
 * Clear brand-coloured selection ring from all artboards.
 */
function clearBrandSelectionRing() {
  document.querySelectorAll('.canvas-artboard').forEach(el => {
    el.style.outline = '';
    el.style.outlineOffset = '';
    el.style.boxShadow = '';
  });
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

/**
 * Populate the detail panel (#studio-inspector) with slide-specific data
 * when a card is selected: slide number, role, text, image_prompt, recipe data.
 * Also shows "Download Slide" and conditional "Regenerate Image" button.
 * @param {object} artboardDesc - The selected artboard descriptor.
 */
function populateDetailPanel(artboardDesc) {
  const output = studioState.generatedOutput;
  if (!output) return;

  // Find the matching slide from the output
  const slides = output.artifacts?.length ? output.artifacts : (output.slides || []);
  const slide = slides.find(s => (s.slide_number ?? 0) === artboardDesc.slideNumber)
    || slides[artboardDesc.order];

  // Get or create the detail section
  let detailSection = document.getElementById('inspector-slide-detail');
  if (!detailSection) {
    detailSection = document.createElement('div');
    detailSection.id = 'inspector-slide-detail';
    detailSection.className = 'inspector-slide-detail';
    const inspectorEl = document.getElementById('studio-inspector');
    if (inspectorEl) {
      // Insert before the package section
      const packageEl = document.getElementById('inspector-package');
      inspectorEl.insertBefore(detailSection, packageEl);
    }
  }

  detailSection.classList.remove('hidden');

  const role = artboardDesc.role || slide?.role || 'slide';
  const slideNumber = artboardDesc.slideNumber ?? slide?.slide_number ?? '—';
  const text = slide?.text || artboardDesc.text || '';
  const imagePrompt = slide?.image_prompt || artboardDesc.prompt || '';
  const recipe = slide?.recipe || null;
  const canRegenerate = role === 'recipe' || !!imagePrompt;

  let html = `
    <p class="eyebrow" style="margin-top:16px">Slide Detail</p>
    <div class="inspector-slide-meta">
      <span class="inspector-slide-number">Slide ${slideNumber}</span>
      <span class="inspector-slide-role">${escapeHtml(capitalizeFirst(role))}</span>
    </div>`;

  if (text) {
    html += `
    <div class="inspector-row" style="margin-top:8px">
      <p class="inspector-label">Text</p>
    </div>
    <p class="inspector-body-text inspector-slide-text">${escapeHtml(text)}</p>`;
  }

  if (imagePrompt) {
    html += `
    <div class="inspector-row" style="margin-top:8px">
      <p class="inspector-label">Image Prompt</p>
    </div>
    <p class="inspector-body-text inspector-slide-prompt">${escapeHtml(imagePrompt)}</p>`;
  }

  if (recipe) {
    html += `
    <div class="inspector-row" style="margin-top:8px">
      <p class="inspector-label">Recipe</p>
    </div>
    <div class="inspector-recipe-data">`;
    if (recipe.name) html += `<p class="inspector-recipe-field"><strong>Name:</strong> ${escapeHtml(recipe.name)}</p>`;
    if (recipe.cook_time) html += `<p class="inspector-recipe-field"><strong>Cook time:</strong> ${escapeHtml(recipe.cook_time)}</p>`;
    if (recipe.ingredients?.length) html += `<p class="inspector-recipe-field"><strong>Ingredients:</strong> ${escapeHtml(recipe.ingredients.join(', '))}</p>`;
    if (recipe.steps?.length) html += `<p class="inspector-recipe-field"><strong>Steps:</strong> ${escapeHtml(recipe.steps.join(' → '))}</p>`;
    if (recipe.pro_tip) html += `<p class="inspector-recipe-field"><strong>Pro tip:</strong> ${escapeHtml(recipe.pro_tip)}</p>`;
    html += `</div>`;
  }

  // Action buttons
  html += `<div class="inspector-slide-actions" style="margin-top:12px">`;
  html += `<button class="ghost-button inspector-download-slide-btn" type="button">Download Slide</button>`;

  if (canRegenerate) {
    html += `
    <div class="inspector-regen-section" style="margin-top:8px">
      <label class="field-label" for="inspector-regen-prompt">Regeneration prompt</label>
      <textarea id="inspector-regen-prompt" class="inspector-regen-prompt" rows="3">${escapeHtml(imagePrompt)}</textarea>
      <div class="inspector-regen-btn-row">
        <button class="primary-button inspector-regen-btn" type="button" style="margin-top:6px">Regenerate Image</button>
        <span class="inspector-regen-loading hidden" aria-label="Regenerating image">
          <span class="inspector-regen-spinner"></span> Regenerating…
        </span>
      </div>
      <div class="inspector-regen-error hidden" role="alert"></div>
    </div>`;
  }

  html += `</div>`;

  detailSection.innerHTML = html;

  // Wire download slide button
  const dlBtn = detailSection.querySelector('.inspector-download-slide-btn');
  if (dlBtn) {
    dlBtn.addEventListener('click', async () => {
      if (!studioState.canvasEngine) return;
      const selected = studioState.canvasEngine.getSelectedArtboard();
      if (selected) {
        try {
          dlBtn.disabled = true;
          dlBtn.textContent = 'Downloading…';
          await downloadArtboard(selected);
        } catch (err) {
          showStatus(err instanceof Error ? err.message : 'Download failed.');
        } finally {
          dlBtn.disabled = false;
          dlBtn.textContent = 'Download Slide';
        }
      }
    });
  }

  // Wire regenerate button
  const regenBtn = detailSection.querySelector('.inspector-regen-btn');
  if (regenBtn) {
    regenBtn.addEventListener('click', async () => {
      const postId = output.post_id;
      const promptEl = document.getElementById('inspector-regen-prompt');
      const prompt = promptEl?.value || imagePrompt;
      if (!postId || slideNumber == null) return;

      const loadingEl = detailSection.querySelector('.inspector-regen-loading');
      const errorEl = detailSection.querySelector('.inspector-regen-error');

      try {
        // Show loading indicator, hide previous error, disable button
        regenBtn.disabled = true;
        regenBtn.classList.add('hidden');
        if (loadingEl) loadingEl.classList.remove('hidden');
        if (errorEl) { errorEl.classList.add('hidden'); errorEl.textContent = ''; }

        const result = await regenerateSlide(postId, slideNumber, prompt);

        if (result && result.slide) {
          const updatedSlide = result.slide;

          // Update the specific slide in studioState.generatedOutput
          const currentSlides = studioState.generatedOutput?.slides || [];
          const slideIdx = currentSlides.findIndex(s => (s.slide_number ?? 0) === slideNumber);
          if (slideIdx >= 0) {
            currentSlides[slideIdx] = { ...currentSlides[slideIdx], asset_path: updatedSlide.asset_path, image_prompt: updatedSlide.image_prompt || prompt };
          }
          // Also update artifacts if present
          const currentArtifacts = studioState.generatedOutput?.artifacts || [];
          const artIdx = currentArtifacts.findIndex(s => (s.slide_number ?? 0) === slideNumber);
          if (artIdx >= 0) {
            currentArtifacts[artIdx] = { ...currentArtifacts[artIdx], asset_path: updatedSlide.asset_path, image_prompt: updatedSlide.image_prompt || prompt };
          }

          // Targeted image swap in the DOM — find the artboard element and swap its img src
          const artboardId = `artboard-${String(slideNumber).padStart(2, '0')}`;
          const artboardEl = document.querySelector(`.canvas-artboard[data-artboard-id="${artboardId}"]`);
          if (artboardEl) {
            const img = artboardEl.querySelector('img');
            if (img && updatedSlide.asset_path) {
              const filename = updatedSlide.asset_path.split('/').pop();
              const newUrl = `/api/assets/${postId}/${filename}?t=${Date.now()}`;
              img.src = newUrl;
            }
          }

          // Re-populate the detail panel to reflect the updated prompt
          const updatedDesc = { ...artboardDesc, prompt: updatedSlide.image_prompt || prompt };
          populateDetailPanel(updatedDesc);
        }
        hideStatus();
      } catch (err) {
        // Show inline error message
        const errMsg = err instanceof Error ? err.message : 'Regeneration failed.';
        if (errorEl) {
          errorEl.textContent = errMsg;
          errorEl.classList.remove('hidden');
        }
        // Also show global status as fallback
        showStatus(errMsg);
      } finally {
        regenBtn.disabled = false;
        regenBtn.classList.remove('hidden');
        if (loadingEl) loadingEl.classList.add('hidden');
      }
    });
  }
}

/**
 * Hide the detail panel section.
 */
function hideDetailPanel() {
  const detailSection = document.getElementById('inspector-slide-detail');
  if (detailSection) detailSection.classList.add('hidden');
}

/**
 * Capitalize the first letter of a string.
 */
function capitalizeFirst(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERACTIVE CANVAS EDITOR — Selection, Inline Editing, Drag, Download, Keys
// ═══════════════════════════════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────────────────────────────
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
    element.classList.add('canvas-inline-editing');
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
    element.classList.remove('canvas-inline-editing');
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

  // Hide inline route preview during generation
  const routeInlineEl = document.getElementById("studio-route-inline");
  if (routeInlineEl) routeInlineEl.classList.add("hidden");
  setCheckpoint("strategy", "active");
  studioState.canvasLoadingStage = "planning";
  studioState.canvasCards = buildCanvasCards(brief, null, makeId);
  renderCanvas();
  showCanvasProgress("Planning content strategy…");

  try {
    // ── Upload queued images before generation ──────────────────────────
    if (uploadQueue.files.length > 0) {
      showStatus("Uploading images…");
      try {
        const uploadResults = await uploadQueue.uploadAll();

        // Render each successful upload as an artboard on the canvas
        for (const result of uploadResults) {
          if (studioState.canvasEngine) {
            studioState.canvasEngine.addUploadedArtboard(result);
          }
        }

        // Check for failed uploads and surface errors to the user
        const failedItems = uploadQueue.files.filter((item) => item.status === "error");
        if (failedItems.length > 0) {
          const mimeErrors = failedItems.filter((item) => item.error && /unsupported|mime|400/i.test(item.error));
          const networkErrors = failedItems.filter((item) => item.error && !/unsupported|mime|400/i.test(item.error));

          if (mimeErrors.length > 0) {
            showStatus(`${mimeErrors.length} file(s) skipped — unsupported file type. Use PNG, JPEG, WebP, or GIF.`);
          } else if (networkErrors.length > 0) {
            showStatus(`${networkErrors.length} upload(s) failed — network error. Files kept in queue for retry.`);
          }
          // Retain failed files in queue for retry; clear only successful ones
          uploadQueue.files = uploadQueue.files.filter((item) => item.status !== "done");
          uploadQueue._updateBadge();
        } else {
          // All uploads succeeded — clear the queue
          uploadQueue.clear();
        }
      } catch (uploadErr) {
        console.error("[studio] Upload error:", uploadErr);
        showStatus("Upload failed — files kept in queue for retry.");
        // Don't block generation on upload failure
      }
    }

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
document.getElementById("toolbar-download-all-btn")?.addEventListener("click", downloadAllAssets);

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
  updateContentTypeSelector(els.studioProductSelect.value);
  await refreshRoutePreview();
  await createSession(els.studioProductSelect.value);
});

els.studioVisualMode.addEventListener("change", () => {
  renderReferenceChips();
  refreshRoutePreview();
});
els.studioReferenceInput.addEventListener("input", renderReferenceChips);
els.studioIdeaInput.addEventListener("input", () => {
  refreshRoutePreview();
});
els.studioNotesInput.addEventListener("input", () => {
  refreshRoutePreview();
});
els.studioPlatformSelect.addEventListener("change", () => {
  refreshRoutePreview();
});
els.studioContentTypeSelect?.addEventListener("change", () => {
  refreshRoutePreview();
});
els.studioUploadTrigger?.addEventListener("click", () => {
  els.studioReferenceFiles.click();
});
document.getElementById("toolbar-upload-btn")?.addEventListener("click", () => {
  els.studioReferenceFiles.click();
});

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
      const uploadedAsset = await res.json();
      const analysis = await analyzeUploadedAssetRecord(uploadedAsset);
      studioState.uploadedAssets.push(uploadedAsset);
      studioState.assetAnalyses = [...studioState.assetAnalyses.filter((item) => item.assetId !== analysis.assetId), analysis];
      const current = els.studioReferenceInput.value.trim();
      els.studioReferenceInput.value = [current, uploadedAsset.url].filter(Boolean).join("\n");
    }
    renderReferenceChips();
    renderUploadedAssets();
    await refreshRoutePreview();
    hideStatus();
  } catch (err) {
    showStatus(err instanceof Error ? err.message : "Upload failed.");
  } finally {
    els.studioReferenceFiles.value = "";
  }
});

els.studioUploadedAssets?.addEventListener("change", async (e) => {
  const wrapper = e.target.closest("[data-upload-id]");
  if (!wrapper) return;
  const asset = studioState.uploadedAssets.find((item) => item.id === wrapper.dataset.uploadId);
  if (!asset) return;
  const labelInput = wrapper.querySelector('[data-upload-field="label"]');
  const notesInput = wrapper.querySelector('[data-upload-field="notes"]');
  asset.label = labelInput?.value?.trim() || "";
  asset.notes = notesInput?.value?.trim() || "";
  const analysis = await analyzeUploadedAssetRecord(asset);
  studioState.assetAnalyses = [...studioState.assetAnalyses.filter((item) => item.assetId !== asset.id), analysis];
  renderUploadedAssets();
  await refreshRoutePreview();
});

// ── Library ───────────────────────────────────────────────────────────────────
// (loadLibrary is defined above with filters)

/**
 * Display an error message in the library view.
 * Shows a dismissible error banner at the top of the library list.
 * @param {string} message
 */
function showLibraryError(message) {
  // Remove any existing error banner
  const existing = els.libraryList?.querySelector(".library-error");
  if (existing) existing.remove();

  const banner = document.createElement("div");
  banner.className = "library-error";
  banner.setAttribute("role", "alert");
  banner.innerHTML = `<span>${escapeHtml(message)}</span><button type="button" class="library-error__dismiss" aria-label="Dismiss">&times;</button>`;
  banner.querySelector(".library-error__dismiss").addEventListener("click", () => banner.remove());

  // Auto-dismiss after 6 seconds
  setTimeout(() => { if (banner.parentNode) banner.remove(); }, 6000);

  if (els.libraryList) {
    els.libraryList.prepend(banner);
  }
}

async function loadOutputIntoCanvas(postId) {
  let res;
  try {
    res = await fetch(`/api/outputs/${postId}`);
  } catch (err) {
    showLibraryError(`Failed to load "${postId}": network error.`);
    return;
  }

  if (!res.ok) {
    showLibraryError(`Failed to load "${postId}": server returned ${res.status}.`);
    return;
  }

  let output;
  try {
    output = await res.json();
  } catch (err) {
    showLibraryError(`Failed to load "${postId}": invalid response data.`);
    return;
  }

  // Save current studio state so user can return to it
  if (studioState.generatedOutput && studioState.generatedOutput.post_id !== postId) {
    studioState._previousOutput = studioState.generatedOutput;
  }

  studioState.generatedOutput = output;
  studioState.workflowType = output.workflow_type || "slideshow";
  studioState.selectedAsset = outputAssets(output)[0] || null;
  if (output.routing_decision) {
    studioState.routePreview = {
      decision: output.routing_decision,
      trace: output.routing_trace
    };
    renderRoutePreview();
  }
  resetCheckpoints();
  ["strategy", "hooks", "visuals", "finalPackage"].forEach((s) => setCheckpoint(s, "done"));

  // Switch to studio view and load output into canvas engine
  switchView("studio");
  loadOutputToEngine(output);
  renderInspectorAsset();
}

// ── Brand editor ──────────────────────────────────────────────────────────────
function renderBrandEditor(brandId) {
  if (
    !els.brandMascotName ||
    !els.brandMascotRole ||
    !els.brandMascotVisualPrompt ||
    !els.brandMascotRules ||
    !els.brandMascotReferences
  ) {
    return;
  }

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
let libraryStorageInfo = null;
let librarySortMode = "date";
let librarySelectedIds = new Set();
let libraryVisibleCount = 20;

async function loadLibrary() {
  try {
    const [outputsRes, storageRes] = await Promise.all([
      fetch("/api/outputs"),
      fetch("/api/storage/usage")
    ]);
    libraryOutputs = await outputsRes.json();
    try {
      libraryStorageInfo = await storageRes.json();
    } catch {
      libraryStorageInfo = null;
    }
  } catch {
    libraryOutputs = [];
    libraryStorageInfo = null;
  }

  // Populate brand filter from fetched outputs
  const brands = [...new Set(libraryOutputs.map((o) => o.product).filter(Boolean))].sort();
  const brandSelect = calEls.libraryBrandFilter;
  if (brandSelect) {
    const current = brandSelect.value;
    brandSelect.innerHTML = `<option value="">All brands</option>` +
      brands.map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(titleCase(b))}</option>`).join("");
    if (current && brands.includes(current)) brandSelect.value = current;
  }

  renderStorageIndicator();
  renderLibrary();
  if (adminEls.traceSelect) {
    const current = adminEls.traceSelect.value;
    adminEls.traceSelect.innerHTML = `<option value="">Select a generated run</option>` +
      libraryOutputs.map((item) => `<option value="${escapeHtml(item.postId)}">${escapeHtml(item.postId)} — ${escapeHtml(titleCase(item.product || ""))}</option>`).join("");
    if (current && libraryOutputs.some((item) => item.postId === current)) {
      adminEls.traceSelect.value = current;
    }
  }
}

function renderStorageIndicator() {
  let bar = document.getElementById("library-storage-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "library-storage-bar";
    bar.className = "storage-bar";
    const header = document.querySelector(".library-header");
    if (header) header.appendChild(bar);
  }
  if (!libraryStorageInfo || libraryStorageInfo.error) {
    bar.innerHTML = `<span class="storage-bar__text">Storage info unavailable</span>`;
    return;
  }
  const pct = Math.min(100, (libraryStorageInfo.usedBytes / libraryStorageInfo.totalBytes) * 100);
  const warn = pct > 80;
  bar.className = `storage-bar${warn ? " storage-bar--warning" : ""}`;
  bar.innerHTML = `
    <div class="storage-bar__track">
      <div class="storage-bar__fill" style="width:${pct.toFixed(1)}%"></div>
    </div>
    <span class="storage-bar__text">${libraryStorageInfo.usedFormatted} / ${libraryStorageInfo.totalFormatted}</span>
  `;
}

function renderLibrary() {
  const brandFilter = calEls.libraryBrandFilter?.value || "";
  const platformFilter = calEls.libraryPlatformFilter?.value || "";
  const search = (calEls.librarySearch?.value || "").toLowerCase().trim();
  const sortSelect = document.getElementById("library-sort");
  if (sortSelect) librarySortMode = sortSelect.value || "date";

  let filtered = libraryOutputs;
  if (brandFilter) filtered = filtered.filter((o) => o.product === brandFilter);
  if (platformFilter) filtered = filtered.filter((o) => o.platform === platformFilter);
  if (search) filtered = filtered.filter((o) =>
    (o.postId || "").toLowerCase().includes(search) ||
    (o.product || "").toLowerCase().includes(search) ||
    (o.caption || "").toLowerCase().includes(search)
  );

  // Sort
  filtered = [...filtered];
  if (librarySortMode === "date") {
    filtered.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  } else if (librarySortMode === "brand") {
    filtered.sort((a, b) => (a.product || "").localeCompare(b.product || ""));
  } else if (librarySortMode === "type") {
    filtered.sort((a, b) => (a.workflowType || "").localeCompare(b.workflowType || ""));
  }

  if (!filtered.length) {
    els.libraryList.innerHTML = `<p class="library-empty">${libraryOutputs.length ? "No results match your filters." : "No past generations yet. Go to Studio to make your first post."}</p>`;
    renderBulkBar();
    return;
  }

  // Pagination
  const totalCount = filtered.length;
  const visible = filtered.slice(0, libraryVisibleCount);

  els.libraryList.innerHTML = "";
  els.libraryList.className = "library-list";

  const grid = document.createElement("div");
  grid.className = "library-grid";

  visible.forEach((item) => {
    const date = item.createdAt
      ? new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : "—";
    const card = document.createElement("div");
    card.className = "library-card" + (librarySelectedIds.has(item.postId) ? " library-card--selected" : "");
    card.dataset.postId = item.postId;

    // Checkbox for bulk selection
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "library-card__checkbox";
    checkbox.checked = librarySelectedIds.has(item.postId);
    checkbox.title = "Select for bulk action";
    checkbox.addEventListener("click", (e) => {
      e.stopPropagation();
      if (checkbox.checked) {
        librarySelectedIds.add(item.postId);
      } else {
        librarySelectedIds.delete(item.postId);
      }
      card.classList.toggle("library-card--selected", checkbox.checked);
      renderBulkBar();
    });
    card.appendChild(checkbox);

    // Thumbnail
    const thumbEl = document.createElement("div");
    thumbEl.className = "library-card__thumb";
    if (item.firstAssetPath) {
      const img = document.createElement("img");
      img.src = item.firstAssetPath;
      img.alt = item.caption || item.postId;
      img.loading = "lazy";
      img.onerror = () => {
        img.remove();
        thumbEl.classList.add("library-card__thumb--placeholder");
        thumbEl.innerHTML = `<span>${escapeHtml(titleCase(item.workflowType || "content"))}</span>`;
      };
      thumbEl.appendChild(img);
    } else {
      thumbEl.classList.add("library-card__thumb--placeholder");
      thumbEl.innerHTML = `<span>${escapeHtml(titleCase(item.workflowType || "content"))}</span>`;
    }
    card.appendChild(thumbEl);

    // Body
    const body = document.createElement("div");
    body.className = "library-card__body";
    body.innerHTML = `
      <span class="library-card__brand">${escapeHtml(titleCase(item.product || "Unknown"))}</span>
      <span class="library-card__platform">${escapeHtml(titleCase(item.platform || ""))}</span>
      <span class="library-card__type">${escapeHtml(titleCase(item.workflowType || ""))}</span>
      ${item.content_recipe_id ? `<span class="library-card__type">${escapeHtml(titleCase(item.content_recipe_id))}</span>` : ""}
      <span class="library-card__date">${date}</span>
      <span class="library-card__slides">${item.slideCount || 0} slides</span>
      ${item.routeSummary ? `<p class="library-card__caption">${escapeHtml(item.routeSummary)}</p>` : ""}
      ${item.caption ? `<p class="library-card__caption">${escapeHtml(item.caption)}</p>` : ""}
    `;
    card.appendChild(body);

    // Duplicate button
    const dupBtn = document.createElement("button");
    dupBtn.className = "library-card__duplicate";
    dupBtn.type = "button";
    dupBtn.title = "Duplicate";
    dupBtn.textContent = "⧉";
    dupBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      els.studioIdeaInput.value = item.caption || "";
      const brandMatch = studioState.brands.find((b) => b.name === item.product || b.id === item.product);
      if (brandMatch) els.studioProductSelect.value = brandMatch.id;
      switchView("studio");
    });
    card.appendChild(dupBtn);

    // Delete button
    const delBtn = document.createElement("button");
    delBtn.className = "library-card__delete";
    delBtn.type = "button";
    delBtn.title = "Delete";
    delBtn.textContent = "✕";
    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete "${item.postId}"? This cannot be undone.`)) return;
      delBtn.disabled = true;
      try {
        const res = await fetch(`/api/outputs/${encodeURIComponent(item.postId)}`, { method: "DELETE" });
        if (res.ok || res.status === 204) {
          card.remove();
          libraryOutputs = libraryOutputs.filter((o) => o.postId !== item.postId);
          librarySelectedIds.delete(item.postId);
          if (!libraryOutputs.length) renderLibrary();
          renderBulkBar();
          try {
            const sr = await fetch("/api/storage/usage");
            libraryStorageInfo = await sr.json();
            renderStorageIndicator();
          } catch {}
        } else {
          alert("Failed to delete output.");
          delBtn.disabled = false;
        }
      } catch {
        alert("Failed to delete output.");
        delBtn.disabled = false;
      }
    });
    card.appendChild(delBtn);

    // Click card to open in studio (new tab)
    card.addEventListener("click", () => {
      window.open(`/?view=studio&postId=${encodeURIComponent(item.postId)}`, "_blank");
    });

    grid.appendChild(card);
  });

  els.libraryList.appendChild(grid);

  // Load more button
  if (totalCount > libraryVisibleCount) {
    const loadMoreBtn = document.createElement("button");
    loadMoreBtn.className = "ghost-button library-load-more";
    loadMoreBtn.type = "button";
    loadMoreBtn.textContent = `Load more (${totalCount - libraryVisibleCount} remaining)`;
    loadMoreBtn.addEventListener("click", () => {
      libraryVisibleCount += 20;
      renderLibrary();
    });
    els.libraryList.appendChild(loadMoreBtn);
  }

  renderBulkBar();
}

function renderBulkBar() {
  let bar = document.getElementById("library-bulk-bar");
  if (librarySelectedIds.size === 0) {
    if (bar) bar.remove();
    return;
  }
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "library-bulk-bar";
    bar.className = "library-bulk-bar";
    const container = document.querySelector(".library-container");
    if (container) container.appendChild(bar);
  }
  bar.innerHTML = `
    <span class="library-bulk-bar__count">${librarySelectedIds.size} selected</span>
    <button class="primary-button library-bulk-bar__delete" type="button">Delete selected (${librarySelectedIds.size})</button>
    <button class="ghost-button library-bulk-bar__clear" type="button">Clear</button>
  `;
  bar.querySelector(".library-bulk-bar__delete").addEventListener("click", async () => {
    const count = librarySelectedIds.size;
    if (!confirm(`Delete ${count} item${count > 1 ? "s" : ""}? This cannot be undone.`)) return;
    const ids = [...librarySelectedIds];
    const deleteBtn = bar.querySelector(".library-bulk-bar__delete");
    deleteBtn.disabled = true;
    deleteBtn.textContent = "Deleting…";
    await Promise.all(ids.map((id) =>
      fetch(`/api/outputs/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {})
    ));
    librarySelectedIds.clear();
    await loadLibrary();
  });
  bar.querySelector(".library-bulk-bar__clear").addEventListener("click", () => {
    librarySelectedIds.clear();
    renderLibrary();
  });
}

// Reset pagination on filter/sort change
function onFilterOrSortChange() {
  libraryVisibleCount = 20;
  librarySelectedIds.clear();
  renderLibrary();
}

calEls.libraryBrandFilter?.addEventListener("change", onFilterOrSortChange);
calEls.libraryPlatformFilter?.addEventListener("change", onFilterOrSortChange);
calEls.librarySearch?.addEventListener("input", onFilterOrSortChange);
document.getElementById("library-sort")?.addEventListener("change", onFilterOrSortChange);

async function loadAdmin() {
  try {
    const treeRes = await fetch("/api/admin/routing-tree");
    const treePayload = await treeRes.json();
    adminEls.routingTree.textContent = treePayload.tree || "Routing tree unavailable.";
  } catch {
    adminEls.routingTree.textContent = "Routing tree unavailable.";
  }

  if (!libraryOutputs.length) {
    await loadLibrary();
  }

  if (!adminEls.traceSelect.value) {
    adminEls.routingTrace.textContent = "Select a run to inspect its routing trace.";
  }
}

adminEls.traceSelect?.addEventListener("change", async () => {
  const postId = adminEls.traceSelect.value;
  if (!postId) {
    adminEls.routingTrace.textContent = "Select a run to inspect its routing trace.";
    return;
  }
  adminEls.routingTrace.textContent = "Loading trace…";
  try {
    const res = await fetch(`/api/outputs/${encodeURIComponent(postId)}/routing-trace`);
    const payload = await res.json();
    adminEls.routingTrace.textContent = JSON.stringify(payload, null, 2);
  } catch {
    adminEls.routingTrace.textContent = "Failed to load routing trace.";
  }
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap() {
  await loadProducts();
  renderBrandEditor("peppera");
  updateContentTypeSelector("peppera");
  updateWorkflowUI();
  renderUploadedAssets();
  renderRoutePreview();
  await Promise.all([createSession("peppera"), loadExistingUploads()]);
  initCanvasDrag();

  // Initialize CanvasEngine on the studio canvas stage
  const stageEl = document.querySelector(".studio-canvas-stage");
  console.log("[studio] Canvas stage element:", stageEl ? "found" : "NOT FOUND");
  // Inspector panel reference — used for selection-driven show/hide
  const inspector = document.getElementById("studio-inspector");

  if (stageEl) {
    try {
      // Pass the toolbar element so zoom controls render inside it
      const toolbarEl = document.getElementById("studio-quick-form");
      studioState.canvasEngine = new CanvasEngine(stageEl, {
        toolbarEl,
        onSelect: (artboardDesc) => {
          if (artboardDesc) {
            // Artboard selected — populate and show inspector
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

            // Apply brand-coloured selection ring
            applyBrandSelectionRing(artboardDesc);

            renderInspectorPackage();
            renderInspectorAsset();
            populateDetailPanel(artboardDesc);
            if (inspector) inspector.classList.remove("hidden");
          } else {
            // Deselected — hide inspector
            studioState.selectedAsset = null;
            clearBrandSelectionRing();
            renderInspectorAsset();
            hideDetailPanel();
            if (inspector) inspector.classList.add("hidden");
          }
        },
        onReorder: (orderedIds) => {
          if (studioState.generatedOutput) {
            studioState.generatedOutput._artboardOrder = orderedIds;
          }
        },
        onZoomChange: () => {},

        // ── Context menu action handlers (Task 7.3) ───────────────────────────
        onRegenerate: async (desc) => {
          const postId = studioState.generatedOutput?.post_id;
          if (!postId || desc.slideNumber == null) return;
          try {
            showStatus("Regenerating slide…");
            const result = await regenerateSlide(postId, desc.slideNumber, desc.prompt);
            // Reload the output to reflect the regenerated slide
            if (result && studioState.canvasEngine) {
              studioState.generatedOutput = result;
              loadOutputToEngine(result);
            }
            hideStatus();
          } catch (err) {
            showStatus(err instanceof Error ? err.message : "Regeneration failed.");
          }
        },
        onDownload: (desc) => {
          downloadArtboard(desc);
        },
        onDelete: (desc) => {
          if (confirm("Delete this artboard?")) {
            studioState.canvasEngine.removeArtboard(desc.id);
          }
        },
        onDuplicate: (desc) => {
          studioState.canvasEngine.duplicateArtboard(desc.id);
        }
      });
      console.log("[studio] CanvasEngine created successfully");

      // ── Double-click on overlay text → InlineEditor (Task 15.1) ──────────
      stageEl.addEventListener("dblclick", (e) => {
        const overlay = e.target.closest(".canvas-overlay");
        if (!overlay) return;
        const bodyEl = overlay.querySelector(".canvas-overlay__body") || overlay;

        // Activate inline editing on the body paragraph
        const psm = studioState.canvasEngine._pointer;
        psm.setEditingActive(true);

        InlineEditor.activate(bodyEl, {
          multiline: true,
          required: false,
          onCommit: (text) => {
            psm.setEditingActive(false);
            // Update the overlay descriptor text
            const overlayId = overlay.dataset.overlayId;
            const desc = studioState.canvasEngine._artboardManager.overlays.find(
              (o) => o.id === overlayId
            );
            if (desc) desc.text = text;

            // Update in-memory output metadata and persist via schedulePatch
            const output = studioState.generatedOutput;
            const postId = output?.post_id;
            if (postId && desc) {
              if (desc.type === "caption") {
                output.caption = text;
                schedulePatch(postId, { caption: text });
              } else if (desc.type === "hook") {
                // Rebuild hooks array from overlay descriptors
                const hooks = studioState.canvasEngine._artboardManager.overlays
                  .filter((o) => o.type === "hook")
                  .map((o) => o.text);
                output.hooks = hooks;
                schedulePatch(postId, { hooks });
              } else if (desc.type === "hashtag") {
                const hashtags = text.split(/\s+/).filter(Boolean);
                output.hashtags = hashtags;
                schedulePatch(postId, { hashtags });
              }
            }
          },
          onCancel: () => {
            psm.setEditingActive(false);
          }
        });
      });
    } catch (err) {
      console.error("[studio] CanvasEngine creation FAILED:", err);
    }
  }

  // ── Escape key: hide inspector panel ──────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && inspector && !inspector.classList.contains("hidden")) {
      inspector.classList.add("hidden");
    }
  });

  // ── File picker: wire change event to upload queue ──────────────────────────
  const fileInput = document.getElementById("toolbar-image-upload");
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      if (fileInput.files && fileInput.files.length) {
        uploadQueue.add(fileInput.files);
        fileInput.value = ""; // reset so re-selecting the same file triggers change
      }
    });
  }

  // ── Drag-and-drop on canvas stage ─────────────────────────────────────────
  if (stageEl) {
    stageEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      stageEl.classList.add("drop-zone-active");
    });

    stageEl.addEventListener("dragleave", (e) => {
      // Only remove if we actually left the stage (not entering a child)
      if (!stageEl.contains(e.relatedTarget)) {
        stageEl.classList.remove("drop-zone-active");
      }
    });

    stageEl.addEventListener("drop", (e) => {
      e.preventDefault();
      stageEl.classList.remove("drop-zone-active");
      const files = e.dataTransfer?.files;
      if (files && files.length) {
        // Filter to image files only
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
        if (imageFiles.length) {
          const dt = new DataTransfer();
          imageFiles.forEach((f) => dt.items.add(f));
          uploadQueue.add(dt.files);
        }
      }
    });
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

  // Inspector dismiss button — closes inspector without deselecting the artboard
  const inspectorClose = document.getElementById("inspector-overlay-close");
  if (inspectorClose && inspector) {
    inspectorClose.addEventListener("click", () => {
      inspector.classList.add("hidden");
      // Intentionally do NOT deselect the artboard — the selection ring stays
    });
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

bootstrap()
  .then(() => {
    // Handle ?view= and ?postId= query params (e.g. library → new tab)
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get("view");
    const postIdParam = params.get("postId");
    if (viewParam) switchView(viewParam);
    if (postIdParam) loadOutputIntoCanvas(postIdParam);
  })
  .catch((err) => showStatus(err instanceof Error ? err.message : String(err)));
