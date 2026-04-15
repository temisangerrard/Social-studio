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
  downloading: false
};

// ── Element refs ──────────────────────────────────────────────────────────────
const els = {
  navLinks: Array.from(document.querySelectorAll(".topnav a[data-view]")),
  views: {
    studio: document.getElementById("view-studio"),
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

// ── Routing ───────────────────────────────────────────────────────────────────
function switchView(name) {
  Object.entries(els.views).forEach(([key, el]) => {
    el.classList.toggle("hidden", key !== name);
  });
  els.navLinks.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.view === name);
  });
  if (name === "library") loadLibrary();
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
  els.inspectorAsset.classList.toggle("hidden", !sel);
  if (!sel) return;
  els.inspectorAssetTitle.textContent = sel.text || "Selected asset";
  els.inspectorAssetHint.textContent = `${titleCase(sel.assetKind || "image")} — click to open full size.`;
  showAssetNode(els.inspectorAssetPreview, sel);
  els.studioRefinePrompt.value ||= sel.prompt || "";
}

function selectAsset(assetId) {
  studioState.selectedAsset = outputAssets(studioState.generatedOutput).find((a) => a.itemId === assetId) || null;
  renderCanvas();
  renderInspectorAsset();
}

// ── Canvas drag ───────────────────────────────────────────────────────────────
let canvasDrag = null;

function initCanvasDrag() {
  els.canvas.addEventListener("mousedown", (e) => {
    const card = e.target.closest(".canvas-card");
    if (!card || card.dataset.type === "skeleton" || card.dataset.type === "asset") return;
    if (e.target.closest("button, input, textarea") || e.target.contentEditable === "true") return;
    const cardData = studioState.canvasCards.find((c) => c.id === card.dataset.cardId);
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

  els.canvas.addEventListener("touchstart", (e) => {
    const card = e.target.closest(".canvas-card");
    if (!card || card.dataset.type === "skeleton" || card.dataset.type === "asset") return;
    if (e.target.closest("button")) return;
    const cardData = studioState.canvasCards.find((c) => c.id === card.dataset.cardId);
    if (!cardData) return;
    const t = e.touches[0];
    canvasDrag = { cardEl: card, cardData, startX: t.clientX, startY: t.clientY, origX: cardData.x, origY: cardData.y };
    card.classList.add("is-dragging");
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (!canvasDrag) return;
    const t = e.touches[0];
    const { cardEl, cardData, startX, startY, origX, origY } = canvasDrag;
    cardData.x = Math.max(0, origX + (t.clientX - startX));
    cardData.y = Math.max(0, origY + (t.clientY - startY));
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

// ── SVG connectors ────────────────────────────────────────────────────────────
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
    stratCards.forEach((src) => {
      makePath(src.x + (src.width || 280), src.y + (src.height || 200) / 2, tgt.x, tgt.y + (tgt.height || 200) / 2);
    });
  }
  if (growthCards.length && assetCards.length) {
    const src = growthCards[growthCards.length - 1];
    const tgt = assetCards[0];
    makePath(src.x + (src.width || 300), src.y + (src.height || 180) / 2, tgt.x, tgt.y + (tgt.height || 460) / 2);
  }
}

// ── Canvas render ─────────────────────────────────────────────────────────────
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
      x: 760 + (i % 4) * 240, y: 52 + Math.floor(i / 4) * 520, width: 210, height: 460
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
      if (studioState.selectedAsset?.itemId === card.itemId) article.classList.add("is-selected");
    }

    let body;
    if (card.type === "asset" && card.assetUrl) {
      const visual = card.assetKind === "video"
        ? `<video src="${card.assetUrl}" muted playsinline preload="metadata"></video>`
        : `<img src="${card.assetUrl}" alt="${escapeHtml(card.text || "Generated asset")}" loading="lazy" />`;
      const branchMeta = card.sourceAssetId
        ? `<span class="canvas-card__branch">From ${escapeHtml(card.sourceAssetId)}</span>` : "";
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

els.canvas.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-asset-id]");
  if (!btn) return;
  selectAsset(btn.dataset.assetId);
  openAssetPreview(btn.dataset.assetUrl, btn.dataset.assetTitle || "Generated asset", btn.dataset.assetKind || "image");
});

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
    if (job.stage === "rendering" || job.status === "running") {
      setCheckpoint("strategy", "done");
      setCheckpoint("hooks", "done");
      setCheckpoint("visuals", "active");
      studioState.canvasLoadingStage = "generating";
      renderCanvas();
      showCanvasProgress("Generating visuals…");
    }
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
    studioState.canvasCards = buildCanvasCards(brief, output, makeId);
    clearButtonLoading(els.studioSubmit);
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

// ── Chat toggle ───────────────────────────────────────────────────────────────
els.chatToggle.addEventListener("click", () => {
  const open = !els.chatPanel.classList.contains("hidden");
  els.chatPanel.classList.toggle("hidden", open);
  els.chatToggle.classList.toggle("is-active", !open);
});

// ── Chat submit ───────────────────────────────────────────────────────────────
function inferWorkflow(text) {
  const v = String(text || "").toLowerCase();
  if (/\breel\b|\bvoiceover\b/.test(v)) return "reel-package";
  if (/\bvideo\b|\bclip\b/.test(v)) return "video-clip";
  if (/\bvariant\b|\bpack\b/.test(v)) return "mascot-variants";
  if (/\bedit\b|\brefine\b/.test(v)) return "reference-edit";
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

els.studioChatForm.addEventListener("submit", async (e) => {
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
async function loadLibrary() {
  const res = await fetch("/api/outputs");
  const outputs = await res.json();
  if (!outputs.length) {
    els.libraryList.innerHTML = `<p class="library-empty">No past generations yet. Go to Studio to make your first post.</p>`;
    return;
  }
  els.libraryList.innerHTML = outputs.map((item) => {
    const date = item.createdAt
      ? new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : "—";
    return `<div class="library-item">
      <div class="library-item__meta">
        <span class="library-item__id">${escapeHtml(item.postId)}</span>
        <span class="library-item__detail">${escapeHtml(titleCase(item.product))} · ${escapeHtml(titleCase(item.platform))} · ${date}</span>
      </div>
      <button class="ghost-button" type="button" data-post-id="${escapeHtml(item.postId)}">View</button>
    </div>`;
  }).join("");
}

async function loadOutputIntoCanvas(postId) {
  const res = await fetch(`/api/outputs/${postId}`);
  if (!res.ok) return;
  const output = await res.json();
  studioState.generatedOutput = output;
  studioState.workflowType = output.workflow_type || "slideshow";
  studioState.selectedAsset = outputAssets(output)[0] || null;
  resetCheckpoints();
  ["strategy", "hooks", "visuals", "finalPackage"].forEach((s) => setCheckpoint(s, "done"));
  const brief = { goal: output.caption || output.post_id, audience: null, offer: null, tone: null, platform: null };
  studioState.canvasCards = buildCanvasCards(brief, output, makeId);
  renderCanvas();
  renderInspectorPackage();
  renderInspectorAsset();
  switchView("studio");
}

els.libraryList.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-post-id]");
  if (!btn) return;
  loadOutputIntoCanvas(btn.dataset.postId);
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

els.brandMascotReferences.addEventListener("click", async (e) => {
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

els.brandEditorSave.addEventListener("click", async () => {
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
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap() {
  await loadProducts();
  renderBrandEditor("peppera");
  updateWorkflowUI();
  await createSession("peppera");
  initCanvasDrag();
  els.studioIdeaInput.focus();
}

bootstrap().catch((err) => showStatus(err instanceof Error ? err.message : String(err)));
