import {
  buildCanvasCards,
  escapeHtml,
  getArtifactPreviewUrl,
  getPlatformPublishLinks,
  getWorkflowPresets,
  getWorkspaceAssetUrl,
  titleCase
} from "./app-helpers.js";

const WORKFLOW_PRESETS = getWorkflowPresets();

// ── Single studio state ────────────────────────────────────────────────────────
const studioState = {
  products: [],
  brands: [],
  session: null,
  canvasCards: [],
  generatedOutput: null,
  selectedAsset: null,
  workflowType: "slideshow",
  canvasLoadingStage: null,
  downloading: false
};

// ── Element references ────────────────────────────────────────────────────────
const els = {
  navLinks: Array.from(document.querySelectorAll(".topnav a[data-view]")),
  views: {
    studio: document.getElementById("view-studio"),
    library: document.getElementById("view-library")
  },

  // Sidebar selects
  studioProductSelect: document.getElementById("studio-product-select"),
  studioPlatformSelect: document.getElementById("studio-platform-select"),
  studioVisualMode: document.getElementById("studio-visual-mode"),
  studioDeliveryTarget: document.getElementById("studio-delivery-target"),

  // Workflow
  studioWorkflowPresets: document.getElementById("studio-workflow-presets"),
  studioWorkflowSummary: document.getElementById("studio-workflow-summary"),

  // Quick generate form
  studioQuickForm: document.getElementById("studio-quick-form"),
  studioIdeaInput: document.getElementById("studio-idea-input"),
  studioNotesInput: document.getElementById("studio-notes-input"),
  studioReferenceInput: document.getElementById("studio-reference-input"),
  studioReferenceFiles: document.getElementById("studio-reference-files"),
  studioReferenceChipset: document.getElementById("studio-reference-chipset"),
  studioStatus: document.getElementById("studio-status"),
  studioSubmit: document.getElementById("studio-submit"),

  // Chat toggle + panel
  chatToggle: document.getElementById("chat-toggle"),
  chatPanel: document.getElementById("chat-panel"),
  studioMessageThread: document.getElementById("studio-message-thread"),
  studioChatForm: document.getElementById("studio-chat-form"),
  studioChatInput: document.getElementById("studio-chat-input"),
  studioChatStatus: document.getElementById("studio-chat-status"),
  studioChatSubmit: document.getElementById("studio-chat-submit"),

  // Canvas
  canvas: document.getElementById("canvas"),
  canvasEmpty: document.getElementById("canvas-empty"),
  canvasProgressPill: document.getElementById("canvas-progress-pill"),
  canvasProgressText: document.getElementById("canvas-progress-text"),
  studioCheckpoints: Array.from(document.querySelectorAll("#studio-checkpoint-strip .checkpoint")),

  // Inspector — package
  inspectorPackage: document.getElementById("inspector-package"),
  inspectorPackageStatus: document.getElementById("inspector-package-status"),
  inspectorCopyCaption: document.getElementById("inspector-copy-caption"),
  inspectorCopyHashtags: document.getElementById("inspector-copy-hashtags"),
  inspectorCaptionText: document.getElementById("inspector-caption-text"),
  inspectorHashtagsText: document.getElementById("inspector-hashtags-text"),
  inspectorHooksList: document.getElementById("inspector-hooks-list"),
  inspectorPublishLinks: document.getElementById("inspector-publish-links"),
  studioDownloadAllBtn: document.getElementById("studio-download-all-btn"),

  // Inspector — asset
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

  // Library
  libraryList: document.getElementById("library-list"),

  // Brand editor (same IDs)
  brandMascotName: document.getElementById("brand-mascot-name"),
  brandMascotRole: document.getElementById("brand-mascot-role"),
  brandMascotVisualPrompt: document.getElementById("brand-mascot-visual-prompt"),
  brandMascotRules: document.getElementById("brand-mascot-rules"),
  brandMascotReferences: document.getElementById("brand-mascot-references"),
  brandMascotRefFiles: document.getElementById("brand-mascot-ref-files"),
  brandMascotRefStatus: document.getElementById("brand-mascot-ref-status"),
  brandEditorStatus: document.getElementById("brand-editor-status"),
  brandEditorSave: document.getElementById("brand-editor-save"),

  // Asset modal (same IDs)
  assetModal: document.getElementById("asset-modal"),
  assetModalImage: document.getElementById("asset-modal-image"),
  assetModalVideo: document.getElementById("asset-modal-video"),
  assetModalTitle: document.getElementById("asset-modal-title"),
  assetModalOpen: document.getElementById("asset-modal-open"),
  assetModalDownload: document.getElementById("asset-modal-download"),
  assetModalClose: document.getElementById("asset-modal-close")
};

// ── Utilities ──────────────────────────────────────────────────────────────────
function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function switchView(viewName) {
  Object.entries(els.views).forEach(([name, el]) => {
    el.classList.toggle("hidden", name !== viewName);
  });
  els.navLinks.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.view === viewName);
  });
  if (viewName === "library") {
    loadLibrary();
  }
}

els.navLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    switchView(link.dataset.view);
  });
});

// ── Status helpers ─────────────────────────────────────────────────────────────
function showStatus(text) {
  els.studioStatus.classList.remove("hidden");
  els.studioStatus.textContent = text;
}

function hideStatus() {
  els.studioStatus.classList.add("hidden");
}

function showRefineStatus(text) {
  els.studioRefineStatus.classList.remove("hidden");
  els.studioRefineStatus.textContent = text;
}

function hideRefineStatus() {
  els.studioRefineStatus.classList.add("hidden");
}

function showChatStatus(text) {
  els.studioChatStatus.classList.remove("hidden");
  els.studioChatStatus.textContent = text;
}

function hideChatStatus() {
  els.studioChatStatus.classList.add("hidden");
}

// ── Checkpoint helpers ─────────────────────────────────────────────────────────
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

function renderCheckpoints() {
  if (!studioState.session) return;
  els.studioCheckpoints.forEach((node) => {
    const status = studioState.session.checkpoints?.[node.dataset.step] || "pending";
    node.classList.remove("is-active", "is-done");
    if (status === "active") node.classList.add("is-active");
    if (status === "done") node.classList.add("is-done");
  });
}

// ── Brand helpers ──────────────────────────────────────────────────────────────
function getBrandById(brandId) {
  return studioState.brands.find((entry) => entry.id === brandId) || null;
}

// ── Reference helpers ──────────────────────────────────────────────────────────
function parseReferenceLines(rawValue) {
  return String(rawValue || "")
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value, index) => ({
      id: `run-ref-${index + 1}`,
      label: value.split("/").pop() || value,
      url: value,
      source: "run",
      kind: "image"
    }));
}

async function uploadReferenceFile(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });

  const response = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, dataUrl })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Upload failed." }));
    throw new Error(payload.error || "Upload failed.");
  }

  return response.json();
}

async function uploadReferencesIntoTextarea(fileList, textarea, onAfter) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const uploaded = [];
  for (const file of files) {
    const result = await uploadReferenceFile(file);
    uploaded.push(result.url);
  }
  const current = textarea.value.trim();
  textarea.value = [current, ...uploaded].filter(Boolean).join("\n");
  onAfter?.();
}

function buildBrandReferenceAssets(brandId, visualMode) {
  const brand = getBrandById(brandId);
  const mascotRefs = brand?.mascot?.referenceImages || [];
  if (!mascotRefs.length || visualMode === "food-led") {
    return [];
  }
  return mascotRefs.map((url, index) => ({
    id: `brand-ref-${index + 1}`,
    label: `${brand.mascot?.name || brand.name} ref ${index + 1}`,
    url: `/api/brand-assets/${brandId}/${index}`,
    source: "brand",
    kind: "image"
  }));
}

function buildReferenceAssets({ brandId, visualMode, inputValue, selectedAsset }) {
  const brandRefs = buildBrandReferenceAssets(brandId, visualMode);
  const runRefs = parseReferenceLines(inputValue);
  const assetRefs =
    selectedAsset?.assetUrl && selectedAsset.assetKind === "image"
      ? [
          {
            id: `asset-ref-${selectedAsset.itemId || "selected"}`,
            label: selectedAsset.text || "Selected asset",
            url: selectedAsset.assetUrl,
            source: "asset",
            kind: "image"
          }
        ]
      : [];
  return [...brandRefs, ...assetRefs, ...runRefs];
}

function renderReferenceChips(target, references) {
  target.innerHTML = references
    .map(
      (reference) =>
        `<span class="reference-chip reference-chip--${escapeHtml(reference.source)}">${escapeHtml(reference.label)}</span>`
    )
    .join("");
}

// ── Workflow helpers ───────────────────────────────────────────────────────────
function getWorkflowPreset(id) {
  return WORKFLOW_PRESETS.find((preset) => preset.id === id) || WORKFLOW_PRESETS[0];
}

function renderWorkflowPresets(target, activeId, onSelect) {
  target.innerHTML = WORKFLOW_PRESETS.map((preset) => {
    const activeClass = preset.id === activeId ? " is-active" : "";
    return `
      <button type="button" class="workflow-preset${activeClass}" data-workflow-id="${preset.id}">
        <p class="workflow-preset__title">${escapeHtml(preset.label)}</p>
        <p class="workflow-preset__summary">${escapeHtml(preset.summary)}</p>
      </button>
    `;
  }).join("");

  target.querySelectorAll("[data-workflow-id]").forEach((button) => {
    button.addEventListener("click", () => onSelect(button.dataset.workflowId));
  });
}

function updateWorkflowUI() {
  const preset = getWorkflowPreset(studioState.workflowType);
  els.studioWorkflowSummary.textContent = preset.summary;
  renderWorkflowPresets(els.studioWorkflowPresets, studioState.workflowType, (workflowId) => {
    studioState.workflowType = workflowId;
    updateWorkflowUI();
  });
  renderReferenceChips(
    els.studioReferenceChipset,
    buildReferenceAssets({
      brandId: els.studioProductSelect.value,
      visualMode: els.studioVisualMode.value,
      inputValue: els.studioReferenceInput.value
    })
  );
}

function inferWorkflowFromText(text) {
  const value = String(text || "").toLowerCase();
  if (/\breel\b|\bvoiceover\b|\bsubtitle\b/.test(value)) return "reel-package";
  if (/\bvideo\b|\bclip\b|\banimation\b/.test(value)) return "video-clip";
  if (/\bvariant\b|\boptions\b|\bpack\b/.test(value)) return "mascot-variants";
  if (/\bedit\b|\brefine\b|\bmake this\b/.test(value)) return "reference-edit";
  return "slideshow";
}

// ── Brand editor ───────────────────────────────────────────────────────────────
function renderBrandEditor(brandId) {
  const brand = getBrandById(brandId);
  const mascot = brand?.mascot;
  els.brandMascotName.textContent = mascot?.name || "No mascot configured";
  els.brandMascotRole.textContent = mascot?.role || "This brand does not yet have a mascot system.";
  els.brandMascotVisualPrompt.value = mascot?.visualPrompt || "";
  els.brandMascotRules.value = (mascot?.usageRules || []).join("\n");
  els.brandMascotReferences.innerHTML = (mascot?.referenceImages || [])
    .map((referencePath, index) => {
      const imgUrl = referencePath.startsWith("/api/") ? referencePath : `/api/brand-assets/${brandId}/${index}`;
      const label = referencePath.split("/").pop() || `reference ${index + 1}`;
      const title = escapeHtml(`${mascot?.name || brand?.name || "Mascot"} reference ${index + 1}`);
      return `
        <div class="brand-ref-card">
          <button type="button" data-brand-asset-url="${imgUrl}" data-brand-asset-title="${title}">
            <img src="${imgUrl}" alt="${title}" loading="lazy" />
          </button>
          <span>${escapeHtml(label)}</span>
          <button type="button" class="ghost-button brand-ref-remove" data-brand-id="${escapeHtml(brandId)}" data-ref-index="${index}" style="font-size:0.65rem;padding:4px 8px">Remove</button>
        </div>
      `;
    })
    .join("");
}

// ── outputAssets ───────────────────────────────────────────────────────────────
function outputAssets(output) {
  if (!output) return [];
  if (output.artifacts?.length) {
    return output.artifacts.map((artifact, index) => ({
      itemId: artifact.id,
      assetKind: artifact.kind,
      role: artifact.role,
      text: artifact.title,
      prompt: artifact.prompt,
      assetUrl: getArtifactPreviewUrl(output, artifact),
      sourceAssetId: artifact.source_asset_id || null,
      variantGroup: artifact.variant_group || null,
      slideNumber: null,
      order: index
    }));
  }
  return (output.slides || [])
    .filter((slide) => typeof slide.slide_number === "number" && !Number.isNaN(slide.slide_number))
    .map((slide, index) => ({
      itemId: `slide-${String(slide.slide_number).padStart(2, "0")}`,
      assetKind: "image",
      role: slide.role,
      text: slide.text,
      prompt: slide.image_prompt || slide.text,
      assetUrl: getWorkspaceAssetUrl(output, slide),
      sourceAssetId: null,
      variantGroup: null,
      slideNumber: slide.slide_number,
      order: index
    }));
}

// ── Asset preview helpers ──────────────────────────────────────────────────────
function showAssetNode(container, asset) {
  container.innerHTML = "";
  if (!asset?.assetUrl) {
    container.classList.add("refine-preview--empty");
    container.innerHTML = "<span>Preview</span>";
    return;
  }
  container.classList.remove("refine-preview--empty");
  if (asset.assetKind === "video") {
    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.src = asset.assetUrl;
    container.appendChild(video);
    return;
  }
  const img = document.createElement("img");
  img.src = asset.assetUrl;
  img.alt = asset.text || "Generated asset";
  container.appendChild(img);
}

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

els.assetModal.addEventListener("click", (event) => {
  if (event.target instanceof HTMLElement && event.target.dataset.closeModal === "true") {
    closeAssetPreview();
  }
});

els.assetModalClose.addEventListener("click", closeAssetPreview);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.assetModal.classList.contains("hidden")) {
    closeAssetPreview();
  }
});

// ── copyText ───────────────────────────────────────────────────────────────────
async function copyText(value, label, statusEl) {
  if (!value) return;
  await navigator.clipboard.writeText(value);
  statusEl.classList.remove("hidden");
  statusEl.textContent = `${label} copied.`;
  setTimeout(() => {
    if (statusEl.textContent === `${label} copied.`) {
      statusEl.classList.add("hidden");
    }
  }, 1400);
}

// ── Canvas progress pill ───────────────────────────────────────────────────────
function showCanvasProgress(text) {
  els.canvasProgressText.textContent = text;
  els.canvasProgressPill.classList.remove("hidden");
}

function hideCanvasProgress() {
  els.canvasProgressPill.classList.add("hidden");
}

// ── Button loading helpers ─────────────────────────────────────────────────────
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

// ── Canvas drag ────────────────────────────────────────────────────────────────
let canvasDrag = null;

function initCanvasDrag() {
  els.canvas.addEventListener("mousedown", (e) => {
    const card = e.target.closest(".canvas-card");
    if (!card || card.dataset.type === "skeleton" || card.dataset.type === "asset") return;
    if (e.target.closest("button, input, textarea") || e.target.contentEditable === "true") return;
    const cardId = card.dataset.cardId;
    const cardData = studioState.canvasCards.find((c) => c.id === cardId);
    if (!cardData) return;
    canvasDrag = { cardEl: card, cardData, startX: e.clientX, startY: e.clientY, origX: cardData.x, origY: cardData.y };
    card.classList.add("is-dragging");
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!canvasDrag) return;
    const { cardEl, cardData, startX, startY, origX, origY } = canvasDrag;
    cardData.x = Math.max(0, origX + (e.clientX - startX));
    cardData.y = Math.max(0, origY + (e.clientY - startY));
    cardEl.style.left = `${cardData.x}px`;
    cardEl.style.top = `${cardData.y}px`;
    drawConnectors();
  });

  document.addEventListener("mouseup", () => {
    if (!canvasDrag) return;
    canvasDrag.cardEl.classList.remove("is-dragging");
    canvasDrag = null;
  });

  // Touch support
  els.canvas.addEventListener("touchstart", (e) => {
    const card = e.target.closest(".canvas-card");
    if (!card || card.dataset.type === "skeleton" || card.dataset.type === "asset") return;
    if (e.target.closest("button")) return;
    const cardId = card.dataset.cardId;
    const cardData = studioState.canvasCards.find((c) => c.id === cardId);
    if (!cardData) return;
    const touch = e.touches[0];
    canvasDrag = { cardEl: card, cardData, startX: touch.clientX, startY: touch.clientY, origX: cardData.x, origY: cardData.y };
    card.classList.add("is-dragging");
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (!canvasDrag) return;
    const touch = e.touches[0];
    const { cardEl, cardData, startX, startY, origX, origY } = canvasDrag;
    cardData.x = Math.max(0, origX + (touch.clientX - startX));
    cardData.y = Math.max(0, origY + (touch.clientY - startY));
    cardEl.style.left = `${cardData.x}px`;
    cardEl.style.top = `${cardData.y}px`;
    drawConnectors();
  }, { passive: true });

  document.addEventListener("touchend", () => {
    if (!canvasDrag) return;
    canvasDrag.cardEl.classList.remove("is-dragging");
    canvasDrag = null;
  });
}

// ── Canvas SVG connectors ──────────────────────────────────────────────────────
function drawConnectors() {
  let svg = els.canvas.querySelector(".canvas-connector-svg");
  if (!svg) {
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("canvas-connector-svg");
    svg.innerHTML = `<defs>
      <marker id="canvas-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
        <path d="M0,0.5 L0,6.5 L6,3.5 z" class="connector-arrowhead"/>
      </marker>
    </defs>`;
    els.canvas.insertBefore(svg, els.canvas.firstChild);
  }
  svg.style.width = "3000px";
  svg.style.height = "2000px";

  svg.querySelectorAll(".connector-path").forEach((el) => el.remove());

  const cards = studioState.canvasCards || [];
  const stratCards = cards.filter((c) => ["goal", "audience", "proof", "visual"].includes(c.type));
  const growthCards = cards.filter((c) => c.type === "hook");
  const assetCards = cards.filter((c) => c.type === "asset");

  function makePath(x1, y1, x2, y2) {
    const cpX = x1 + (x2 - x1) * 0.55;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add("connector-path");
    path.setAttribute("d", `M${x1},${y1} C${cpX},${y1} ${cpX},${y2} ${x2},${y2}`);
    path.setAttribute("marker-end", "url(#canvas-arrow)");
    svg.appendChild(path);
  }

  if (stratCards.length && growthCards.length) {
    const tgt = growthCards[0];
    const tgtX = tgt.x;
    const tgtCY = tgt.y + (tgt.height || 200) / 2;
    stratCards.forEach((src) => {
      makePath(src.x + (src.width || 280), src.y + (src.height || 200) / 2, tgtX, tgtCY);
    });
  }

  if (growthCards.length && assetCards.length) {
    const src = growthCards[growthCards.length - 1];
    const tgt = assetCards[0];
    makePath(
      src.x + (src.width || 300), src.y + (src.height || 180) / 2,
      tgt.x, tgt.y + (tgt.height || 460) / 2
    );
  }
}

// ── Canvas render ──────────────────────────────────────────────────────────────
function renderCanvas() {
  els.canvas.innerHTML = "";
  const cards = studioState.canvasCards || [];
  const isLoading = !!studioState.canvasLoadingStage;
  els.canvasEmpty.classList.toggle("hidden", cards.length > 0 || isLoading);

  [
    { x: 72, label: "Strategy" },
    { x: 400, label: "Growth Logic" },
    { x: 760, label: "Assets" }
  ].forEach(({ x, label }) => {
    if (!cards.length && !isLoading) return;
    const lbl = document.createElement("div");
    lbl.className = "canvas-lane-label";
    lbl.style.left = `${x}px`;
    lbl.textContent = label;
    els.canvas.appendChild(lbl);
  });

  if (isLoading) {
    Array.from({ length: 8 }, (_, i) => ({
      x: 760 + (i % 4) * 240,
      y: 52 + Math.floor(i / 4) * 520,
      width: 210,
      height: 460
    })).forEach((sk) => {
      const el = document.createElement("article");
      el.className = "canvas-card";
      el.dataset.type = "skeleton";
      el.style.cssText = `left:${sk.x}px;top:${sk.y}px;width:${sk.width}px;min-height:${sk.height}px`;
      els.canvas.appendChild(el);
    });
  }

  cards.forEach((card) => {
    const article = document.createElement("article");
    article.className = "canvas-card";
    article.dataset.type = card.type || "idea";
    article.dataset.cardId = card.id;
    article.style.left = `${card.x}px`;
    article.style.top = `${card.y}px`;
    article.style.width = `${card.width}px`;
    if (card.type === "asset") {
      article.style.minHeight = `${card.height}px`;
    } else {
      article.style.height = `${card.height}px`;
    }

    if (card.type === "asset") {
      article.classList.add("is-clickable");
      article.dataset.kind = card.assetKind || "image";
      if (studioState.selectedAsset?.itemId === card.itemId) {
        article.classList.add("is-selected");
      }
    }

    let body;
    if (card.type === "asset" && card.assetUrl) {
      const visual =
        card.assetKind === "video"
          ? `<video src="${card.assetUrl}" muted playsinline preload="metadata"></video>`
          : `<img src="${card.assetUrl}" alt="${escapeHtml(card.text || "Generated asset")}" loading="lazy" />`;
      const branchMeta = card.sourceAssetId
        ? `<span class="canvas-card__branch">From ${escapeHtml(card.sourceAssetId)}</span>`
        : "";
      body = `
        <button class="asset-thumb-button" type="button"
          data-asset-id="${escapeHtml(card.itemId || "")}"
          data-asset-kind="${escapeHtml(card.assetKind || "image")}"
          data-asset-url="${escapeHtml(card.assetUrl)}"
          data-asset-title="${escapeHtml(card.text || "Generated asset")}">
          <div class="asset-thumb">${visual}</div>
          <span>Open Asset</span>
        </button>
        ${branchMeta}
        <p class="canvas-card__text">${escapeHtml(card.text || "")}</p>`;
    } else {
      body = `<p class="canvas-card__text${card.type === "hook" ? " is-short" : ""}" data-editable="true">${escapeHtml(card.text || "")}</p>`;
    }

    article.innerHTML = `
      <span class="canvas-card__badge">${escapeHtml(titleCase(card.type))}</span>
      ${body}
      <div class="canvas-card__tags">${escapeHtml((card.tags || []).join(", "))}</div>`;

    if (card.type !== "asset") {
      const textEl = article.querySelector("[data-editable]");
      if (textEl) {
        article.addEventListener("dblclick", (e) => {
          if (e.target.closest("button")) return;
          textEl.contentEditable = "true";
          textEl.focus();
          const range = document.createRange();
          range.selectNodeContents(textEl);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        });
        textEl.addEventListener("blur", () => {
          textEl.contentEditable = "false";
          card.text = textEl.textContent.trim();
        });
        textEl.addEventListener("keydown", (ke) => {
          if (ke.key === "Enter" && !ke.shiftKey) { ke.preventDefault(); textEl.blur(); }
          if (ke.key === "Escape") { textEl.textContent = card.text || ""; textEl.blur(); }
        });
      }
    }

    els.canvas.appendChild(article);
  });

  drawConnectors();
}

// ── Inspector: package ─────────────────────────────────────────────────────────
function renderInspectorPackage() {
  const output = studioState.generatedOutput;
  if (!output) {
    els.inspectorPackage.classList.add("hidden");
    return;
  }
  els.inspectorPackage.classList.remove("hidden");

  const product = studioState.products.find((p) => p.id === els.studioProductSelect.value);
  const publishLinks = getPlatformPublishLinks(product?.name || "this product");

  els.inspectorPackageStatus.textContent =
    output.render_status === "skipped"
      ? "Using generated visuals directly."
      : "Package ready.";

  els.inspectorCaptionText.textContent = output.caption || "";
  els.inspectorHashtagsText.textContent = (output.hashtags || []).join(" ");

  els.inspectorHooksList.innerHTML = (output.hooks || [])
    .map((hook) => `<div class="package-list__item"><strong>Hook</strong><span>${escapeHtml(hook)}</span></div>`)
    .join("");

  els.inspectorPublishLinks.innerHTML = publishLinks
    .map(
      (link) => `
        <div class="publish-link">
          <a href="${link.href}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>
          <span>${escapeHtml(link.helper)}</span>
        </div>
      `
    )
    .join("");
}

// ── Inspector: asset ───────────────────────────────────────────────────────────
function renderInspectorAsset() {
  const asset = studioState.selectedAsset;
  if (!asset) {
    els.inspectorAsset.classList.add("hidden");
    return;
  }
  els.inspectorAsset.classList.remove("hidden");
  els.inspectorAssetTitle.textContent = asset.text || "Selected asset";
  els.inspectorAssetHint.textContent = `${titleCase(asset.assetKind)} selected. Branch a new version or replace.`;
  showAssetNode(els.inspectorAssetPreview, asset);
  els.studioRefinePrompt.value ||= asset.prompt || "";
}

// ── Select asset ───────────────────────────────────────────────────────────────
function selectAsset(assetId) {
  const selected = outputAssets(studioState.generatedOutput).find((item) => item.itemId === assetId) || null;
  studioState.selectedAsset = selected;
  renderCanvas();
  renderInspectorAsset();
}

// ── syncCardsFromBrief ─────────────────────────────────────────────────────────
function syncCardsFromBrief() {
  studioState.canvasCards = buildCanvasCards(studioState.session.inferredBrief, studioState.generatedOutput, makeId);
  if (studioState.generatedOutput) {
    studioState.selectedAsset = outputAssets(studioState.generatedOutput)[0] || null;
  }
}

// ── Messages ───────────────────────────────────────────────────────────────────
function renderMessages() {
  els.studioMessageThread.innerHTML = "";
  const messages = (studioState.session?.messages || []).filter((entry) => entry.role !== "system");
  messages.forEach((message) => {
    const article = document.createElement("article");
    article.className = `message-bubble message-bubble--${message.role === "user" ? "user" : "assistant"}`;
    article.innerHTML = `
      <strong>${message.role === "user" ? "You" : "Social Studio"}</strong>
      <p>${escapeHtml(message.text)}</p>
    `;
    els.studioMessageThread.appendChild(article);
  });
  els.studioMessageThread.scrollTop = els.studioMessageThread.scrollHeight;
}

// ── pollJob ────────────────────────────────────────────────────────────────────
async function pollJob(jobId, onUpdate) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const response = await fetch(`/api/jobs/${jobId}`);
    const job = await response.json();
    onUpdate?.(job);
    if (job.status === "failed") {
      throw new Error(job.error || "Generation failed.");
    }
    if (job.status === "done") {
      return job.result;
    }
  }
  throw new Error("Generation timed out.");
}

// ── Quick generate form submit ─────────────────────────────────────────────────
els.studioQuickForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const idea = els.studioIdeaInput.value.trim();
  if (!idea) return;

  const notes = els.studioNotesInput.value.trim();
  const brandId = els.studioProductSelect.value;

  setButtonLoading(els.studioSubmit, "Planning…");
  showStatus("Planning content strategy…");
  resetCheckpoints();
  setCheckpoint("strategy", "active");
  studioState.canvasLoadingStage = "planning";
  renderCanvas();
  showCanvasProgress("Planning content strategy…");

  const request = {
    brandProfileId: brandId,
    rawIdea: idea,
    notes,
    cards: [],
    references: [],
    referenceAssets: buildReferenceAssets({
      brandId,
      visualMode: els.studioVisualMode.value,
      inputValue: els.studioReferenceInput.value
    }),
    platformTargets: [els.studioPlatformSelect.value],
    goal: getBrandById(brandId)?.defaults?.goal || "awareness",
    workflowType: studioState.workflowType,
    visualMode: els.studioVisualMode.value,
    deliveryTargets: els.studioDeliveryTarget.value
  };

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });
    const { jobId } = await response.json();
    const output = await pollJob(jobId, (job) => {
      if (job.stage === "rendering" || job.status === "running") {
        setCheckpoint("strategy", "done");
        setCheckpoint("hooks", "done");
        setCheckpoint("visuals", "active");
        studioState.canvasLoadingStage = "generating";
        renderCanvas();
        showCanvasProgress("Generating visuals…");
        setButtonLoading(els.studioSubmit, "Generating…");
        showStatus("Generating visuals…");
      }
    });

    studioState.canvasLoadingStage = null;
    studioState.generatedOutput = output;
    studioState.workflowType = output.workflow_type || studioState.workflowType;
    studioState.selectedAsset = outputAssets(output)[0] || null;

    setCheckpoint("visuals", "done");
    setCheckpoint("finalPackage", "done");

    const brief = {
      goal: idea,
      audience: null,
      offer: null,
      tone: els.studioVisualMode.value,
      platform: els.studioPlatformSelect.value
    };
    studioState.canvasCards = buildCanvasCards(brief, output, makeId);

    hideCanvasProgress();
    clearButtonLoading(els.studioSubmit);
    hideStatus();
    updateWorkflowUI();
    renderCanvas();
    renderInspectorPackage();
    renderInspectorAsset();
  } catch (err) {
    studioState.canvasLoadingStage = null;
    hideCanvasProgress();
    clearButtonLoading(els.studioSubmit);
    showStatus(err instanceof Error ? err.message : String(err));
    resetCheckpoints();
    renderCanvas();
  }
});

// ── Chat toggle ────────────────────────────────────────────────────────────────
els.chatToggle.addEventListener("click", () => {
  const isOpen = !els.chatPanel.classList.contains("hidden");
  els.chatPanel.classList.toggle("hidden", isOpen);
  els.chatToggle.classList.toggle("is-active", !isOpen);
});

// ── Chat submit ────────────────────────────────────────────────────────────────
async function runChatGeneration() {
  studioState.session.checkpoints = studioState.session.checkpoints || {};
  studioState.session.checkpoints.strategy = "done";
  studioState.session.checkpoints.hooks = "active";
  studioState.canvasLoadingStage = "planning";
  renderCheckpoints();
  renderCanvas();
  showCanvasProgress("Planning content strategy…");
  setButtonLoading(els.studioChatSubmit, "Working…");
  showChatStatus("Planning content strategy…");

  const brief = studioState.session.inferredBrief || {};
  const platform = brief.platform?.toLowerCase().includes("instagram") ? "instagram" : "tiktok";

  const request = {
    brandProfileId: els.studioProductSelect.value,
    rawIdea: studioState.session.messages.find((entry) => entry.role === "user")?.text || "",
    notes: `Audience: ${brief.audience || ""}. Offer: ${brief.offer || ""}. Tone: ${brief.tone || ""}.`,
    cards: studioState.canvasCards,
    references: [],
    referenceAssets: buildReferenceAssets({
      brandId: els.studioProductSelect.value,
      visualMode: els.studioVisualMode.value,
      inputValue: "",
      selectedAsset: studioState.selectedAsset
    }),
    platformTargets: [platform],
    goal: brief.goal || "awareness",
    workflowType: studioState.workflowType,
    visualMode: els.studioVisualMode.value,
    deliveryTargets: els.studioDeliveryTarget.value
  };

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });
    const { jobId } = await response.json();
    const output = await pollJob(jobId, (job) => {
      if (job.stage === "rendering" || job.status === "running") {
        studioState.session.checkpoints.hooks = "done";
        studioState.session.checkpoints.visuals = "active";
        studioState.canvasLoadingStage = "generating";
        renderCheckpoints();
        renderCanvas();
        showCanvasProgress("Generating visuals…");
        showChatStatus("Generating visuals and clips…");
      }
    });

    studioState.canvasLoadingStage = null;
    hideCanvasProgress();
    clearButtonLoading(els.studioChatSubmit);
    studioState.generatedOutput = output;
    studioState.session.checkpoints.visuals = "done";
    studioState.session.checkpoints.finalPackage = "done";
    studioState.session.messages.push({
      id: makeId("msg"),
      role: "assistant",
      text: `I finished the ${getWorkflowPreset(studioState.workflowType).label.toLowerCase()} and placed the output back into the workspace.`,
      createdAt: new Date().toISOString()
    });
    syncCardsFromBrief();
    renderMessages();
    renderCanvas();
    renderCheckpoints();
    renderInspectorPackage();
    renderInspectorAsset();
    hideChatStatus();
  } catch (error) {
    studioState.canvasLoadingStage = null;
    hideCanvasProgress();
    clearButtonLoading(els.studioChatSubmit);
    studioState.session.checkpoints.hooks = "pending";
    studioState.session.checkpoints.visuals = "pending";
    studioState.session.checkpoints.finalPackage = "pending";
    studioState.session.messages.push({
      id: makeId("msg"),
      role: "assistant",
      text: `I hit a problem while generating. ${error instanceof Error ? error.message : String(error)}`,
      createdAt: new Date().toISOString()
    });
    renderMessages();
    renderCanvas();
    renderCheckpoints();
    showChatStatus("Generation stopped.");
  }
}

async function submitChatAnswer(text) {
  const isFirstUserMessage = studioState.session.messages.filter((m) => m.role === "user").length === 0;

  const response = await fetch(`/api/assistant/sessions/${studioState.session.id}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    throw new Error("Failed to get assistant reply.");
  }

  const { session, shouldGenerate } = await response.json();
  studioState.session = session;

  if (isFirstUserMessage) {
    studioState.workflowType = inferWorkflowFromText(text);
    updateWorkflowUI();
  }

  syncCardsFromBrief();
  renderMessages();
  renderCanvas();
  renderCheckpoints();

  if (shouldGenerate) {
    studioState.session.checkpoints = studioState.session.checkpoints || {};
    studioState.session.checkpoints.strategy = "active";
    renderCheckpoints();
    await runChatGeneration();
  }
}

els.studioChatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = els.studioChatInput.value.trim();
  if (!text || !studioState.session) return;
  els.studioChatInput.value = "";
  showChatStatus("Thinking…");
  try {
    await submitChatAnswer(text);
  } catch (err) {
    showChatStatus(err instanceof Error ? err.message : String(err));
  } finally {
    hideChatStatus();
  }
});

// ── Refinement ─────────────────────────────────────────────────────────────────
function mergeRefinedOutput(currentOutput, refinementOutput, mode, selectedAsset) {
  if (!currentOutput || !refinementOutput?.artifacts?.length) {
    return refinementOutput;
  }
  const nextArtifact = refinementOutput.artifacts[0];
  const currentArtifacts = outputAssets(currentOutput);
  const mergedArtifacts = currentArtifacts
    .filter((item) => mode !== "replace" || item.itemId !== selectedAsset?.itemId)
    .map((item) => ({
      id: item.itemId,
      kind: item.assetKind,
      role: item.role,
      title: item.text,
      prompt: item.prompt || item.text,
      asset_path: item.assetUrl,
      preview_path: item.assetUrl,
      source_asset_id: item.sourceAssetId,
      variant_group: item.variantGroup
    }));
  mergedArtifacts.push(nextArtifact);
  return {
    ...currentOutput,
    post_id: refinementOutput.post_id,
    workflow_type: "reference-edit",
    artifacts: mergedArtifacts
  };
}

async function runRefinement(event) {
  event.preventDefault();
  if (!studioState.selectedAsset) {
    showRefineStatus("Select an asset first.");
    return;
  }
  showRefineStatus("Generating refined variant…");
  els.studioRefineSubmit.disabled = true;

  const asset = studioState.selectedAsset;
  const brandId = els.studioProductSelect.value;
  const prompt = els.studioRefinePrompt.value.trim() || asset.prompt || asset.text;

  const request = {
    brandProfileId: brandId,
    rawIdea: prompt,
    notes: "Refinement request from selected asset.",
    cards: [],
    references: [],
    referenceAssets: buildReferenceAssets({
      brandId,
      visualMode: els.studioRefineVisualMode.value,
      inputValue: "",
      selectedAsset: asset
    }),
    platformTargets: [els.studioPlatformSelect.value],
    goal: getBrandById(brandId)?.defaults?.goal || "awareness",
    workflowType: "reference-edit",
    visualMode: els.studioRefineVisualMode.value,
    targetAssetId: asset.itemId || undefined,
    deliveryTargets: els.studioDeliveryTarget.value
  };

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });
    const { jobId } = await response.json();
    const output = await pollJob(jobId);
    studioState.generatedOutput = mergeRefinedOutput(
      studioState.generatedOutput,
      output,
      els.studioRefineMode.value,
      studioState.selectedAsset
    );
    studioState.selectedAsset = outputAssets(studioState.generatedOutput).at(-1) || null;
    const brief = {
      goal: studioState.session?.inferredBrief?.goal || "",
      audience: studioState.session?.inferredBrief?.audience || null,
      offer: studioState.session?.inferredBrief?.offer || null,
      tone: els.studioRefineVisualMode.value,
      platform: els.studioPlatformSelect.value
    };
    studioState.canvasCards = buildCanvasCards(brief, studioState.generatedOutput, makeId);
    renderCanvas();
    renderInspectorPackage();
    renderInspectorAsset();
    showRefineStatus("Refined asset ready.");
  } catch (error) {
    showRefineStatus(error instanceof Error ? error.message : String(error));
  } finally {
    els.studioRefineSubmit.disabled = false;
  }
}

els.studioRefineForm.addEventListener("submit", runRefinement);

// ── Download all ───────────────────────────────────────────────────────────────
async function downloadAllAssets(output) {
  if (studioState.downloading || !output) return;
  studioState.downloading = true;
  els.studioDownloadAllBtn.disabled = true;
  els.studioDownloadAllBtn.textContent = "Downloading…";
  try {
    const zip = new window.JSZip();
    await Promise.all(
      outputAssets(output).map(async (item, index) => {
        if (!item.assetUrl) return;
        const response = await fetch(item.assetUrl);
        if (!response.ok) return;
        const blob = await response.blob();
        const ext = item.assetUrl.split(".").pop() || (item.assetKind === "video" ? "mp4" : "png");
        zip.file(`${item.itemId || `asset-${index + 1}`}.${ext}`, blob);
      })
    );
    const content = await zip.generateAsync({ type: "blob" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(content);
    anchor.download = `${output.post_id}-assets.zip`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  } finally {
    studioState.downloading = false;
    els.studioDownloadAllBtn.disabled = false;
    els.studioDownloadAllBtn.textContent = "Download All";
  }
}

els.studioDownloadAllBtn.addEventListener("click", () => downloadAllAssets(studioState.generatedOutput));

// ── Inspector copy buttons ─────────────────────────────────────────────────────
els.inspectorCopyCaption.addEventListener("click", () =>
  copyText(studioState.generatedOutput?.caption || "", "Caption", els.inspectorPackageStatus)
);
els.inspectorCopyHashtags.addEventListener("click", () =>
  copyText((studioState.generatedOutput?.hashtags || []).join(" "), "Hashtags", els.inspectorPackageStatus)
);

// ── Canvas click — select asset ────────────────────────────────────────────────
els.canvas.addEventListener("click", (event) => {
  const button = event.target.closest("[data-asset-id]");
  if (!button) return;
  selectAsset(button.dataset.assetId);
  openAssetPreview(button.dataset.assetUrl, button.dataset.assetTitle || "Generated asset", button.dataset.assetKind || "image");
});

// ── Brand editor clicks (mascot refs) ─────────────────────────────────────────
els.brandMascotReferences.addEventListener("click", (event) => {
  const previewBtn = event.target.closest("[data-brand-asset-url]");
  if (previewBtn) {
    openAssetPreview(previewBtn.dataset.brandAssetUrl, previewBtn.dataset.brandAssetTitle || "Mascot reference");
    return;
  }
  const removeBtn = event.target.closest(".brand-ref-remove");
  if (removeBtn) {
    const brandId = removeBtn.dataset.brandId;
    const index = Number(removeBtn.dataset.refIndex);
    fetch(`/api/brands/${brandId}/mascot-refs/${index}`, { method: "DELETE" })
      .then(() => fetch("/api/brands").then((res) => res.json()))
      .then((brands) => {
        studioState.brands = brands;
        renderBrandEditor(brandId);
      });
  }
});

// ── Brand editor save ──────────────────────────────────────────────────────────
els.brandEditorSave.addEventListener("click", async () => {
  const brandId = els.studioProductSelect.value;
  const response = await fetch(`/api/brands/${brandId}`);
  const existing = await response.json();
  const mascot = existing.mascot || {
    name: `${existing.name} Mascot`,
    description: "",
    role: "",
    visualPrompt: "",
    usageRules: [],
    referenceImages: []
  };
  const updatedBrand = {
    ...existing,
    mascot: {
      ...mascot,
      visualPrompt: els.brandMascotVisualPrompt.value.trim(),
      usageRules: els.brandMascotRules.value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    }
  };
  els.brandEditorStatus.classList.remove("hidden");
  els.brandEditorStatus.textContent = "Saving mascot system…";
  await fetch("/api/brands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updatedBrand)
  });
  studioState.brands = await fetch("/api/brands").then((res) => res.json());
  renderBrandEditor(brandId);
  els.brandEditorStatus.textContent = "Mascot system saved.";
  setTimeout(() => {
    if (els.brandEditorStatus.textContent === "Mascot system saved.") {
      els.brandEditorStatus.classList.add("hidden");
    }
  }, 1500);
});

// ── Brand mascot ref upload ────────────────────────────────────────────────────
els.brandMascotRefFiles.addEventListener("change", async () => {
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
    studioState.brands = await fetch("/api/brands").then((res) => res.json());
    renderBrandEditor(brandId);
    els.brandMascotRefStatus.textContent = "Images uploaded.";
    setTimeout(() => els.brandMascotRefStatus.classList.add("hidden"), 1500);
  } catch (err) {
    els.brandMascotRefStatus.textContent = err instanceof Error ? err.message : "Upload failed.";
  } finally {
    els.brandMascotRefFiles.value = "";
  }
});

// ── Product select change ──────────────────────────────────────────────────────
els.studioProductSelect.addEventListener("change", async () => {
  renderBrandEditor(els.studioProductSelect.value);
  updateWorkflowUI();
  await createSession(els.studioProductSelect.value);
});

// ── Visual mode / reference input changes ─────────────────────────────────────
els.studioVisualMode.addEventListener("change", updateWorkflowUI);
els.studioReferenceInput.addEventListener("input", updateWorkflowUI);

// ── Reference file upload ──────────────────────────────────────────────────────
els.studioReferenceFiles.addEventListener("change", async () => {
  showStatus("Uploading references…");
  try {
    await uploadReferencesIntoTextarea(els.studioReferenceFiles.files, els.studioReferenceInput, updateWorkflowUI);
    hideStatus();
  } catch (error) {
    showStatus(error instanceof Error ? error.message : String(error));
  } finally {
    els.studioReferenceFiles.value = "";
  }
});

// ── Library ────────────────────────────────────────────────────────────────────
async function loadLibrary() {
  const response = await fetch("/api/outputs");
  const outputs = await response.json();
  if (!outputs.length) {
    els.libraryList.innerHTML = `<p class="library-empty">No past generations yet. Go to Studio to make your first post.</p>`;
    return;
  }
  els.libraryList.innerHTML = outputs
    .map((item) => {
      const date = item.createdAt
        ? new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : "—";
      return `
        <div class="library-item">
          <div class="library-item__meta">
            <span class="library-item__id">${escapeHtml(item.postId)}</span>
            <span class="library-item__detail">${escapeHtml(titleCase(item.product))} · ${escapeHtml(titleCase(item.platform))} · ${date}</span>
          </div>
          <button class="ghost-button" type="button" data-post-id="${escapeHtml(item.postId)}">View</button>
        </div>
      `;
    })
    .join("");
}

async function loadOutputIntoCanvas(postId) {
  const response = await fetch(`/api/outputs/${postId}`);
  if (!response.ok) return;
  const output = await response.json();
  studioState.generatedOutput = output;
  studioState.workflowType = output.workflow_type || "slideshow";
  studioState.selectedAsset = outputAssets(output)[0] || null;
  resetCheckpoints();
  setCheckpoint("strategy", "done");
  setCheckpoint("hooks", "done");
  setCheckpoint("visuals", "done");
  setCheckpoint("finalPackage", "done");
  const brief = { goal: output.caption || output.post_id, audience: null, offer: null, tone: null, platform: null };
  studioState.canvasCards = buildCanvasCards(brief, output, makeId);
  renderCanvas();
  renderInspectorPackage();
  renderInspectorAsset();
  switchView("studio");
}

els.libraryList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-post-id]");
  if (!button) return;
  loadOutputIntoCanvas(button.dataset.postId);
});

// ── Session ────────────────────────────────────────────────────────────────────
async function createSession(productId) {
  const response = await fetch("/api/assistant/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId })
  });
  studioState.session = await response.json();
  studioState.generatedOutput = null;
  studioState.canvasCards = studioState.session.workspaceCards || [];
  studioState.selectedAsset = null;
  renderMessages();
  renderCheckpoints();
}

// ── Load products ──────────────────────────────────────────────────────────────
async function loadProducts() {
  const [productsRes, brandsRes] = await Promise.all([fetch("/api/products"), fetch("/api/brands")]);
  studioState.products = await productsRes.json();
  studioState.brands = await brandsRes.json();
  const options = studioState.products.map((entry) => `<option value="${entry.id}">${entry.name}</option>`).join("");
  els.studioProductSelect.innerHTML = options;
  els.studioProductSelect.value = "peppera";
}

// ── Bootstrap ──────────────────────────────────────────────────────────────────
async function bootstrap() {
  await loadProducts();
  renderBrandEditor("peppera");
  updateWorkflowUI();
  await createSession("peppera");
  initCanvasDrag();
  els.studioIdeaInput.focus();
}

bootstrap().catch((error) => {
  showStatus(error instanceof Error ? error.message : String(error));
});
