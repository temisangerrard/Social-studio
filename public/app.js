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

const genState = {
  output: null,
  workflowType: "slideshow",
  selectedAsset: null,
  downloading: false
};

const asstState = {
  products: [],
  brands: [],
  session: null,
  canvasCards: [],
  generatedOutput: null,
  selectedAsset: null,
  workflowType: "slideshow"
};

const els = {
  navLinks: Array.from(document.querySelectorAll(".topnav a[data-view]")),
  views: {
    generate: document.getElementById("view-generate"),
    assistant: document.getElementById("view-assistant"),
    library: document.getElementById("view-library")
  },

  productSelect: document.getElementById("product-select"),
  generateForm: document.getElementById("generate-form"),
  ideaInput: document.getElementById("idea-input"),
  ingredientsInput: document.getElementById("ingredients-input"),
  genPlatformSelect: document.getElementById("gen-platform-select"),
  genVisualMode: document.getElementById("gen-visual-mode"),
  genDeliveryTarget: document.getElementById("gen-delivery-target"),
  genReferenceGroup: document.getElementById("gen-reference-group"),
  genReferenceInput: document.getElementById("gen-reference-input"),
  genReferenceFiles: document.getElementById("gen-reference-files"),
  genReferenceChipset: document.getElementById("gen-reference-chipset"),
  genWorkflowPresets: document.getElementById("gen-workflow-presets"),
  genWorkflowSummary: document.getElementById("gen-workflow-summary"),
  genVariantGroup: document.getElementById("gen-variant-group"),
  genVariantCount: document.getElementById("gen-variant-count"),
  genTargetGroup: document.getElementById("gen-target-group"),
  genTargetAsset: document.getElementById("gen-target-asset"),
  genVideoGroup: document.getElementById("gen-video-group"),
  genVideoDuration: document.getElementById("gen-video-duration"),
  genVideoAspect: document.getElementById("gen-video-aspect"),
  genVideoConsistency: document.getElementById("gen-video-consistency"),
  genVideoAudio: document.getElementById("gen-video-audio"),
  genModelHint: document.getElementById("gen-model-hint"),
  genSubmit: document.getElementById("gen-submit"),
  genStatus: document.getElementById("gen-status"),
  genEmpty: document.getElementById("gen-empty"),
  genOutput: document.getElementById("gen-output"),
  genCheckpoints: Array.from(document.querySelectorAll("#gen-checkpoint-strip .checkpoint")),
  genAssetsHeading: document.getElementById("gen-assets-heading"),
  slideStrip: document.getElementById("slide-strip"),
  downloadAllBtn: document.getElementById("download-all-btn"),
  genPackageStatus: document.getElementById("gen-package-status"),
  genPublishLinks: document.getElementById("gen-publish-links"),
  genCopyCaption: document.getElementById("gen-copy-caption"),
  genCopyHashtags: document.getElementById("gen-copy-hashtags"),
  genCaptionText: document.getElementById("gen-caption-text"),
  genHashtagsText: document.getElementById("gen-hashtags-text"),
  genHooksList: document.getElementById("gen-hooks-list"),
  genPlatformNotes: document.getElementById("gen-platform-notes"),
  genReelCard: document.getElementById("gen-reel-card"),
  genVoiceoverText: document.getElementById("gen-voiceover-text"),
  genSubtitlesCard: document.getElementById("gen-subtitles-card"),
  genSubtitlesText: document.getElementById("gen-subtitles-text"),
  genClipBriefsCard: document.getElementById("gen-clip-briefs-card"),
  genClipBriefs: document.getElementById("gen-clip-briefs"),
  refineTitle: document.getElementById("refine-title"),
  refineHint: document.getElementById("refine-hint"),
  refinePreview: document.getElementById("refine-preview"),
  refineForm: document.getElementById("refine-form"),
  refinePrompt: document.getElementById("refine-prompt"),
  refineReferenceInput: document.getElementById("refine-reference-input"),
  refineReferenceFiles: document.getElementById("refine-reference-files"),
  refineReferenceChipset: document.getElementById("refine-reference-chipset"),
  refineVisualMode: document.getElementById("refine-visual-mode"),
  refineBranchMode: document.getElementById("refine-branch-mode"),
  refineStatus: document.getElementById("refine-status"),
  refineSubmit: document.getElementById("refine-submit"),

  asstProductSelect: document.getElementById("asst-product-select"),
  asstVisualMode: document.getElementById("asst-visual-mode"),
  asstDeliveryTarget: document.getElementById("asst-delivery-target"),
  asstReferenceInput: document.getElementById("asst-reference-input"),
  asstReferenceFiles: document.getElementById("asst-reference-files"),
  asstReferenceChipset: document.getElementById("asst-reference-chipset"),
  asstWorkflowPresets: document.getElementById("asst-workflow-presets"),
  asstWorkflowSummary: document.getElementById("asst-workflow-summary"),
  messageThread: document.getElementById("message-thread"),
  assistantForm: document.getElementById("assistant-form"),
  assistantInput: document.getElementById("assistant-input"),
  assistantStatus: document.getElementById("assistant-status"),
  workspaceTitle: document.getElementById("workspace-title"),
  workspaceSubtitle: document.getElementById("workspace-subtitle"),
  canvas: document.getElementById("canvas"),
  canvasEmpty: document.getElementById("canvas-empty"),
  asstCheckpoints: Array.from(document.querySelectorAll("#asst-checkpoint-strip .checkpoint")),
  packagePanel: document.getElementById("package-panel"),
  packageStatus: document.getElementById("package-status"),
  captionText: document.getElementById("caption-text"),
  hashtagsText: document.getElementById("hashtags-text"),
  hooksList: document.getElementById("hooks-list"),
  platformNotes: document.getElementById("platform-notes"),
  publishLinks: document.getElementById("publish-links"),
  copyCaption: document.getElementById("copy-caption"),
  copyHashtags: document.getElementById("copy-hashtags"),
  asstVoiceoverCard: document.getElementById("asst-voiceover-card"),
  voiceoverText: document.getElementById("voiceover-text"),
  asstSubtitlesCard: document.getElementById("asst-subtitles-card"),
  subtitlesText: document.getElementById("subtitles-text"),
  asstClipBriefsCard: document.getElementById("asst-clip-briefs-card"),
  clipBriefs: document.getElementById("clip-briefs"),
  workspaceRefineTitle: document.getElementById("workspace-refine-title"),
  workspaceRefineHint: document.getElementById("workspace-refine-hint"),
  workspaceRefinePreview: document.getElementById("workspace-refine-preview"),
  workspaceReferenceChipset: document.getElementById("workspace-reference-chipset"),

  libraryList: document.getElementById("library-list"),

  brandMascotName: document.getElementById("brand-mascot-name"),
  brandMascotRole: document.getElementById("brand-mascot-role"),
  brandMascotVisualPrompt: document.getElementById("brand-mascot-visual-prompt"),
  brandMascotRules: document.getElementById("brand-mascot-rules"),
  brandMascotReferences: document.getElementById("brand-mascot-references"),
  brandEditorStatus: document.getElementById("brand-editor-status"),
  brandEditorSave: document.getElementById("brand-editor-save"),

  assetModal: document.getElementById("asset-modal"),
  assetModalImage: document.getElementById("asset-modal-image"),
  assetModalVideo: document.getElementById("asset-modal-video"),
  assetModalTitle: document.getElementById("asset-modal-title"),
  assetModalOpen: document.getElementById("asset-modal-open"),
  assetModalDownload: document.getElementById("asset-modal-download"),
  assetModalClose: document.getElementById("asset-modal-close")
};

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

async function copyText(value, label, statusEl) {
  if (!value) {
    return;
  }
  await navigator.clipboard.writeText(value);
  statusEl.classList.remove("hidden");
  statusEl.textContent = `${label} copied.`;
  setTimeout(() => {
    if (statusEl.textContent === `${label} copied.`) {
      statusEl.classList.add("hidden");
    }
  }, 1400);
}

function showGenStatus(text) {
  els.genStatus.classList.remove("hidden");
  els.genStatus.textContent = text;
}

function hideGenStatus() {
  els.genStatus.classList.add("hidden");
}

function showAsstStatus(text) {
  els.assistantStatus.classList.remove("hidden");
  els.assistantStatus.textContent = text;
}

function hideAsstStatus() {
  els.assistantStatus.classList.add("hidden");
}

function showRefineStatus(text) {
  els.refineStatus.classList.remove("hidden");
  els.refineStatus.textContent = text;
}

function hideRefineStatus() {
  els.refineStatus.classList.add("hidden");
}

function setCheckpoint(nodes, step, status) {
  nodes.forEach((node) => {
    if (node.dataset.step !== step) return;
    node.classList.remove("is-active", "is-done");
    if (status === "active") node.classList.add("is-active");
    if (status === "done") node.classList.add("is-done");
  });
}

function resetCheckpoints(nodes) {
  nodes.forEach((node) => node.classList.remove("is-active", "is-done"));
}

function getBrandById(brandId) {
  return asstState.brands.find((entry) => entry.id === brandId) || null;
}

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
    body: JSON.stringify({
      filename: file.name,
      dataUrl
    })
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
      (reference) => `<span class="reference-chip reference-chip--${escapeHtml(reference.source)}">${escapeHtml(
        reference.label
      )}</span>`
    )
    .join("");
}

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

function updateGenWorkflowUI() {
  const preset = getWorkflowPreset(genState.workflowType);
  els.genWorkflowSummary.textContent = preset.summary;
  els.genModelHint.textContent = modelHintForWorkflow(genState.workflowType);
  els.genVariantGroup.classList.toggle("hidden", genState.workflowType !== "mascot-variants");
  els.genTargetGroup.classList.toggle("hidden", genState.workflowType !== "reference-edit");
  els.genVideoGroup.classList.toggle(
    "hidden",
    genState.workflowType !== "video-clip" && genState.workflowType !== "reel-package"
  );
  els.genReferenceGroup.classList.toggle("hidden", false);
  renderWorkflowPresets(els.genWorkflowPresets, genState.workflowType, (workflowId) => {
    genState.workflowType = workflowId;
    updateGenWorkflowUI();
  });
  populateTargetAssetSelect(genState.output);
  renderReferenceChips(
    els.genReferenceChipset,
    buildReferenceAssets({
      brandId: els.productSelect.value,
      visualMode: els.genVisualMode.value,
      inputValue: els.genReferenceInput.value
    })
  );
}

function updateAsstWorkflowUI() {
  const preset = getWorkflowPreset(asstState.workflowType);
  els.asstWorkflowSummary.textContent = preset.summary;
  renderReferenceChips(
    els.asstReferenceChipset,
    buildReferenceAssets({
      brandId: els.asstProductSelect.value,
      visualMode: els.asstVisualMode.value,
      inputValue: els.asstReferenceInput.value
    })
  );
  renderWorkflowPresets(els.asstWorkflowPresets, asstState.workflowType, (workflowId) => {
    asstState.workflowType = workflowId;
    updateAsstWorkflowUI();
  });
}

function modelHintForWorkflow(workflowType) {
  switch (workflowType) {
    case "mascot-variants":
      return "Uses Nano Banana 2 image generation with mascot references and repeatable variant prompts.";
    case "reference-edit":
      return "Uses Nano Banana 2 edit mode with the selected asset and any brand or run references.";
    case "video-clip":
      return "Uses Kling for prompt-led clips and PixVerse when mascot consistency is selected.";
    case "reel-package":
      return "Plans multiple clip briefs first, then generates clip assets with the active video settings.";
    default:
      return "Uses Nano Banana 2 for the visual assets behind the slideshow package.";
  }
}

function syncProductSelects(sourceId) {
  els.productSelect.value = sourceId;
  els.asstProductSelect.value = sourceId;
}

function syncVisualModeSelects(sourceValue) {
  els.genVisualMode.value = sourceValue;
  els.asstVisualMode.value = sourceValue;
  els.refineVisualMode.value = sourceValue;
}

function syncDeliveryTargets(sourceValue) {
  els.genDeliveryTarget.value = sourceValue;
  els.asstDeliveryTarget.value = sourceValue;
}

function renderBrandEditor(brandId) {
  const brand = getBrandById(brandId);
  const mascot = brand?.mascot;
  els.brandMascotName.textContent = mascot?.name || "No mascot configured";
  els.brandMascotRole.textContent = mascot?.role || "This brand does not yet have a mascot system.";
  els.brandMascotVisualPrompt.value = mascot?.visualPrompt || "";
  els.brandMascotRules.value = (mascot?.usageRules || []).join("\n");
  els.brandMascotReferences.innerHTML = (mascot?.referenceImages || [])
    .map(
      (referencePath, index) => `
        <div class="brand-ref-card">
          <button type="button" data-brand-asset-url="/api/brand-assets/${brandId}/${index}" data-brand-asset-title="${escapeHtml(
            mascot?.name || brand?.name || "Mascot"
          )} reference ${index + 1}">
            <img src="/api/brand-assets/${brandId}/${index}" alt="${escapeHtml(
              mascot?.name || brand?.name || "Mascot"
            )} reference ${index + 1}" loading="lazy" />
          </button>
          <span>${escapeHtml(referencePath.split("/").pop() || referencePath)}</span>
        </div>
      `
    )
    .join("");
}

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
  return (output.slides || []).map((slide, index) => ({
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

function renderAssetThumb(item, scope) {
  const url = item.assetUrl;
  if (!url) {
    return "";
  }
  const roleLabel = titleCase(item.role || "asset");
  const kindLabel = item.assetKind === "video" ? "Clip" : "Asset";
  const visual =
    item.assetKind === "video"
      ? `<video src="${url}" muted playsinline preload="metadata"></video>`
      : `<img src="${url}" alt="${escapeHtml(item.text || "Generated asset")}" loading="lazy" />`;

  return `
    <button
      class="slide-thumb${scope.selectedAsset?.itemId === item.itemId ? " is-selected" : ""}"
      type="button"
      data-scope="${scope.name}"
      data-asset-id="${escapeHtml(item.itemId || "")}"
      data-asset-kind="${escapeHtml(item.assetKind || "image")}"
      data-asset-url="${escapeHtml(url)}"
      data-asset-title="${escapeHtml(item.text || "Generated asset")}"
    >
      ${visual}
      <span class="slide-thumb__num">${escapeHtml(kindLabel)}</span>
      <span class="asset-thumb__meta"><span>${escapeHtml(roleLabel)}</span><span>${escapeHtml(item.assetKind)}</span></span>
    </button>
  `;
}

function renderAssetStrip(output, scopeName) {
  const assets = outputAssets(output);
  const scope = scopeName === "generate" ? genState : asstState;
  els.slideStrip.innerHTML = assets.map((item) => renderAssetThumb(item, { selectedAsset: scope.selectedAsset, name: scopeName })).join("");
  els.genAssetsHeading.textContent = getWorkflowPreset(output?.workflow_type || genState.workflowType).label;
}

function renderClipBriefs(target, clipBriefs) {
  target.innerHTML = (clipBriefs || [])
    .map(
      (clip) => `<div class="package-list__item"><strong>${escapeHtml(clip.title)}</strong><span>${escapeHtml(
        clip.prompt
      )}</span></div>`
    )
    .join("");
}

function renderPackage(output, targets, productId) {
  const product = asstState.products.find((entry) => entry.id === productId);
  const publishLinks = getPlatformPublishLinks(product?.name || "this product");
  targets.status.textContent =
    output.render_status === "skipped"
      ? "Using generated visuals or clips directly because slide rendering is unavailable for this workflow."
      : "Rendered package ready.";
  targets.caption.textContent = output.caption || "";
  targets.hashtags.textContent = (output.hashtags || []).join(" ");
  targets.hooks.innerHTML = (output.hooks || [])
    .map((hook) => `<div class="package-list__item"><strong>Hook</strong><span>${escapeHtml(hook)}</span></div>`)
    .join("");
  targets.platformNotes.innerHTML = Object.entries(output.platform_notes || {})
    .map(
      ([platform, note]) =>
        `<div class="package-list__item"><strong>${escapeHtml(titleCase(platform))}</strong><span>${escapeHtml(note)}</span></div>`
    )
    .join("");
  targets.publishLinks.innerHTML = publishLinks
    .map(
      (link) => `
        <div class="publish-link">
          <a href="${link.href}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>
          <span>${escapeHtml(link.helper)}</span>
        </div>
      `
    )
    .join("");

  const reel = output.reel_package;
  targets.voiceoverCard.classList.toggle("hidden", !reel);
  targets.subtitlesCard.classList.toggle("hidden", !reel);
  targets.clipBriefsCard.classList.toggle("hidden", !reel);
  if (reel) {
    targets.voiceover.textContent = reel.voiceoverScript || "";
    targets.subtitles.textContent = reel.subtitleDraft || "";
    renderClipBriefs(targets.clipBriefs, reel.clipBriefs);
  }
}

function selectAsset(scopeName, assetId) {
  const scope = scopeName === "generate" ? genState : asstState;
  const output = scopeName === "generate" ? genState.output : asstState.generatedOutput;
  const selected = outputAssets(output).find((item) => item.itemId === assetId) || null;
  scope.selectedAsset = selected;
  renderRefinePanels();
  if (scopeName === "generate") {
    renderAssetStrip(genState.output, "generate");
  } else {
    renderCanvas();
  }
}

function renderRefinePanels() {
  const selected = genState.selectedAsset;
  if (selected) {
    els.refineTitle.textContent = selected.text || "Selected asset";
    els.refineHint.textContent = `${titleCase(selected.assetKind)} selected. Branch a new version or replace this one.`;
    els.refinePrompt.value ||= selected.prompt || "";
  } else {
    els.refineTitle.textContent = "No asset selected";
    els.refineHint.textContent = "Select an image or clip to branch a new version or replace it.";
    els.refinePrompt.value = "";
  }
  showAssetNode(els.refinePreview, selected);
  renderReferenceChips(
    els.refineReferenceChipset,
    buildReferenceAssets({
      brandId: els.productSelect.value,
      visualMode: els.refineVisualMode.value,
      inputValue: els.refineReferenceInput.value,
      selectedAsset: selected
    })
  );

  const workspaceSelected = asstState.selectedAsset;
  if (workspaceSelected) {
    els.workspaceRefineTitle.textContent = workspaceSelected.text || "Selected asset";
    els.workspaceRefineHint.textContent = `${titleCase(workspaceSelected.assetKind)} selected on the canvas.`;
  } else {
    els.workspaceRefineTitle.textContent = "No asset selected";
    els.workspaceRefineHint.textContent = "Click any generated asset on the canvas to preview it and branch a refinement.";
  }
  showAssetNode(els.workspaceRefinePreview, workspaceSelected);
  renderReferenceChips(
    els.workspaceReferenceChipset,
    buildReferenceAssets({
      brandId: els.asstProductSelect.value,
      visualMode: els.asstVisualMode.value,
      inputValue: "",
      selectedAsset: workspaceSelected
    })
  );
}

function populateTargetAssetSelect(output) {
  const assets = outputAssets(output);
  els.genTargetAsset.innerHTML = `<option value="">Select an asset from the latest output</option>${assets
    .map((item) => `<option value="${escapeHtml(item.itemId)}">${escapeHtml(item.text || item.itemId)}</option>`)
    .join("")}`;
  if (genState.selectedAsset?.itemId) {
    els.genTargetAsset.value = genState.selectedAsset.itemId;
  }
}

async function downloadAllAssets(output) {
  if (genState.downloading || !output) return;
  genState.downloading = true;
  els.downloadAllBtn.disabled = true;
  els.downloadAllBtn.textContent = "Downloading…";
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
    genState.downloading = false;
    els.downloadAllBtn.disabled = false;
    els.downloadAllBtn.textContent = "Download All";
  }
}

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

function buildGenerateRequest({ workflowType, rawIdea, notes, cards, brandProfileId, visualMode, selectedAsset }) {
  const platform = els.genPlatformSelect.value;
  const deliveryTargets = els.genDeliveryTarget.value;
  const referenceAssets = buildReferenceAssets({
    brandId: brandProfileId,
    visualMode,
    inputValue: workflowType === "reference-edit" ? els.refineReferenceInput.value : els.genReferenceInput.value,
    selectedAsset
  });

  return {
    brandProfileId,
    rawIdea,
    notes,
    cards,
    references: [],
    referenceAssets,
    platformTargets: [platform],
    goal: getBrandById(brandProfileId)?.defaults?.goal || "awareness",
    workflowType,
    visualMode,
    targetAssetId:
      workflowType === "reference-edit" ? selectedAsset?.itemId || els.genTargetAsset.value || undefined : undefined,
    videoOptions:
      workflowType === "video-clip" || workflowType === "reel-package"
        ? {
            duration: Number(els.genVideoDuration.value),
            aspectRatio: els.genVideoAspect.value,
            withAudio: els.genVideoAudio.checked,
            consistencyMode: els.genVideoConsistency.value
          }
        : undefined,
    variantCount: workflowType === "mascot-variants" ? Number(els.genVariantCount.value) : undefined,
    deliveryTargets
  };
}

function inferWorkflowFromText(text) {
  const value = String(text || "").toLowerCase();
  if (/\breel\b|\bvoiceover\b|\bsubtitle\b/.test(value)) return "reel-package";
  if (/\bvideo\b|\bclip\b|\banimation\b/.test(value)) return "video-clip";
  if (/\bvariant\b|\boptions\b|\bpack\b/.test(value)) return "mascot-variants";
  if (/\bedit\b|\brefine\b|\bmake this\b/.test(value)) return "reference-edit";
  return "slideshow";
}

async function loadProducts() {
  const [productsRes, brandsRes] = await Promise.all([fetch("/api/products"), fetch("/api/brands")]);
  asstState.products = await productsRes.json();
  asstState.brands = await brandsRes.json();
  const options = asstState.products.map((entry) => `<option value="${entry.id}">${entry.name}</option>`).join("");
  els.productSelect.innerHTML = options;
  els.asstProductSelect.innerHTML = options;
  syncProductSelects("peppera");
}

function updateWorkspaceHeader() {
  const lastUserMessage = [...(asstState.session?.messages || [])].reverse().find((entry) => entry.role === "user");
  els.workspaceTitle.textContent = `${getWorkflowPreset(asstState.workflowType).label}`;
  els.workspaceSubtitle.textContent = lastUserMessage
    ? lastUserMessage.text
    : "The assistant will place your goals, hooks, proof, and generated assets here as it learns.";
}

function renderMessages() {
  els.messageThread.innerHTML = "";
  const messages = (asstState.session?.messages || []).filter((entry) => entry.role !== "system");
  messages.forEach((message) => {
    const article = document.createElement("article");
    article.className = `message-bubble message-bubble--${message.role === "user" ? "user" : "assistant"}`;
    article.innerHTML = `
      <strong>${message.role === "user" ? "You" : "Social Studio"}</strong>
      <p>${escapeHtml(message.text)}</p>
    `;
    els.messageThread.appendChild(article);
  });
  els.messageThread.scrollTop = els.messageThread.scrollHeight;
}

function renderAsstCheckpoints() {
  if (!asstState.session) return;
  els.asstCheckpoints.forEach((node) => {
    const status = asstState.session.checkpoints?.[node.dataset.step] || "pending";
    node.classList.remove("is-active", "is-done");
    if (status === "active") node.classList.add("is-active");
    if (status === "done") node.classList.add("is-done");
  });
}

function renderCanvas() {
  els.canvas.innerHTML = "";
  const cards = asstState.canvasCards || [];
  els.canvasEmpty.classList.toggle("hidden", cards.length > 0);

  cards.forEach((card) => {
    const article = document.createElement("article");
    article.className = "canvas-card";
    article.dataset.type = card.type || "idea";
    article.style.left = `${card.x}px`;
    article.style.top = `${card.y}px`;
    article.style.width = `${card.width}px`;
    article.style.height = `${card.height}px`;
    if (card.type === "asset") {
      article.classList.add("is-clickable");
      article.dataset.kind = card.assetKind || "image";
      if (asstState.selectedAsset?.itemId && asstState.selectedAsset.itemId === card.itemId) {
        article.classList.add("is-selected");
      }
    }

    let body = `<p class="canvas-card__text${card.type === "hook" ? " is-short" : ""}">${escapeHtml(card.text || "")}</p>`;
    if (card.type === "asset" && card.assetUrl) {
      const visual =
        card.assetKind === "video"
          ? `<video src="${card.assetUrl}" muted playsinline preload="metadata"></video>`
          : `<img src="${card.assetUrl}" alt="${escapeHtml(card.text || "Generated asset")}" />`;
      const branchMeta = card.sourceAssetId
        ? `<span class="canvas-card__branch">From ${escapeHtml(card.sourceAssetId)}</span>`
        : "";
      body = `
        <button
          class="asset-thumb-button"
          type="button"
          data-scope="assistant"
          data-asset-id="${escapeHtml(card.itemId || "")}"
          data-asset-kind="${escapeHtml(card.assetKind || "image")}"
          data-asset-url="${escapeHtml(card.assetUrl)}"
          data-asset-title="${escapeHtml(card.text || "Generated asset")}"
        >
          <div class="asset-thumb">${visual}</div>
          <span>Open Asset</span>
        </button>
        ${branchMeta}
        <p class="canvas-card__text">${escapeHtml(card.text || "")}</p>
      `;
    }

    article.innerHTML = `
      <span class="canvas-card__badge">${escapeHtml(titleCase(card.type))}</span>
      ${body}
      <div class="canvas-card__tags">${escapeHtml((card.tags || []).join(", "))}</div>
    `;
    els.canvas.appendChild(article);
  });
}

function renderAsstOutputPackage() {
  const output = asstState.generatedOutput;
  els.packagePanel.classList.toggle("hidden", !output);
  if (!output) return;
  renderPackage(
    output,
    {
      status: els.packageStatus,
      caption: els.captionText,
      hashtags: els.hashtagsText,
      hooks: els.hooksList,
      platformNotes: els.platformNotes,
      publishLinks: els.publishLinks,
      voiceoverCard: els.asstVoiceoverCard,
      voiceover: els.voiceoverText,
      subtitlesCard: els.asstSubtitlesCard,
      subtitles: els.subtitlesText,
      clipBriefsCard: els.asstClipBriefsCard,
      clipBriefs: els.clipBriefs
    },
    els.asstProductSelect.value
  );
}

async function persistAsstSession() {
  if (!asstState.session) return;
  await fetch(`/api/assistant/sessions/${asstState.session.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...asstState.session, workspaceCards: asstState.canvasCards })
  });
}

async function createAsstSession(productId) {
  showAsstStatus("Loading product context…");
  const response = await fetch("/api/assistant/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId })
  });
  asstState.session = await response.json();
  asstState.generatedOutput = null;
  asstState.canvasCards = asstState.session.workspaceCards || [];
  asstState.selectedAsset = null;
  asstState.workflowType = "slideshow";
  renderMessages();
  renderCanvas();
  renderAsstOutputPackage();
  renderAsstCheckpoints();
  updateAsstWorkflowUI();
  updateWorkspaceHeader();
  renderRefinePanels();
  hideAsstStatus();
}

function nextQuestionFromBrief(brief) {
  if (!brief.goal) return "What do you want this content to do for you?";
  if (!brief.audience) return "Who is this for?";
  if (!brief.offer) return "What is the main thing you want people to understand or act on?";
  if (!brief.platform) return "Where should I optimise it first? TikTok, Instagram, or both?";
  if (!brief.tone) return "What should it feel like? Funny, sharp, calm, premium, simple?";
  return "I have enough to start making this. Is there one detail or constraint I should not miss?";
}

function updateBriefFromAnswer(text) {
  const brief = asstState.session.inferredBrief;
  if (!brief.goal) brief.goal = text;
  else if (!brief.audience) brief.audience = text;
  else if (!brief.offer) brief.offer = text;
  else if (!brief.platform) brief.platform = text;
  else if (!brief.tone) brief.tone = text;
}

function syncCardsFromBrief() {
  asstState.canvasCards = buildCanvasCards(asstState.session.inferredBrief, asstState.generatedOutput, makeId);
  if (asstState.generatedOutput) {
    asstState.selectedAsset = outputAssets(asstState.generatedOutput)[0] || null;
  }
}

async function runAsstCheckpointGeneration() {
  asstState.session.status = "generating";
  asstState.session.checkpoints.strategy = "done";
  asstState.session.checkpoints.hooks = "active";
  renderAsstCheckpoints();
  showAsstStatus("Generating hooks and angles…");

  const platform = asstState.session.inferredBrief.platform?.toLowerCase().includes("instagram") ? "instagram" : "tiktok";
  const request = {
    brandProfileId: els.asstProductSelect.value,
    rawIdea: asstState.session.messages.find((entry) => entry.role === "user")?.text || "",
    notes: `Audience: ${asstState.session.inferredBrief.audience}. Offer: ${asstState.session.inferredBrief.offer}. Tone: ${asstState.session.inferredBrief.tone}.`,
    cards: asstState.canvasCards,
    references: [],
    referenceAssets: buildReferenceAssets({
      brandId: els.asstProductSelect.value,
      visualMode: els.asstVisualMode.value,
      inputValue: els.asstReferenceInput.value,
      selectedAsset: asstState.selectedAsset
    }),
    platformTargets: [platform],
    goal: asstState.session.inferredBrief.goal || "awareness",
    workflowType: asstState.workflowType,
    visualMode: els.asstVisualMode.value,
    videoOptions:
      asstState.workflowType === "video-clip" || asstState.workflowType === "reel-package"
        ? {
            duration: 5,
            aspectRatio: "9:16",
            withAudio: true,
            consistencyMode: els.asstVisualMode.value === "mascot-led" ? "mascot-consistent" : "prompt-led"
          }
        : undefined,
    variantCount: asstState.workflowType === "mascot-variants" ? 4 : undefined,
    deliveryTargets: els.asstDeliveryTarget.value
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
        asstState.session.checkpoints.hooks = "done";
        asstState.session.checkpoints.visuals = "active";
        renderAsstCheckpoints();
        showAsstStatus("Generating visuals and clips…");
      }
    });

    asstState.generatedOutput = output;
    asstState.session.checkpoints.visuals = "done";
    asstState.session.checkpoints.finalPackage = "done";
    asstState.session.status = "done";
    asstState.session.messages.push({
      id: makeId("msg"),
      role: "assistant",
      text: `I finished the ${getWorkflowPreset(asstState.workflowType).label.toLowerCase()} and placed the output back into the workspace.`,
      createdAt: new Date().toISOString()
    });
    syncCardsFromBrief();
    renderMessages();
    renderCanvas();
    renderAsstOutputPackage();
    renderAsstCheckpoints();
    renderRefinePanels();
    updateWorkspaceHeader();
    hideAsstStatus();
    await persistAsstSession();
  } catch (error) {
    asstState.session.status = "interviewing";
    asstState.session.checkpoints.hooks = "pending";
    asstState.session.checkpoints.visuals = "pending";
    asstState.session.checkpoints.finalPackage = "pending";
    asstState.session.messages.push({
      id: makeId("msg"),
      role: "assistant",
      text: `I hit a problem while generating. ${error instanceof Error ? error.message : String(error)}`,
      createdAt: new Date().toISOString()
    });
    renderMessages();
    renderAsstCheckpoints();
    showAsstStatus("Generation stopped.");
    await persistAsstSession();
  }
}

async function submitAsstAnswer(text) {
  const isFirstUserMessage = asstState.session.messages.filter((m) => m.role === "user").length === 0;

  const response = await fetch(`/api/assistant/sessions/${asstState.session.id}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    throw new Error("Failed to get assistant reply.");
  }

  const { session, shouldGenerate } = await response.json();
  asstState.session = session;

  if (isFirstUserMessage) {
    asstState.workflowType = inferWorkflowFromText(text);
    updateAsstWorkflowUI();
  }

  syncCardsFromBrief();
  renderMessages();
  renderCanvas();
  renderAsstCheckpoints();
  renderRefinePanels();
  updateWorkspaceHeader();

  if (shouldGenerate) {
    asstState.session.checkpoints.strategy = "active";
    renderAsstCheckpoints();
    await runAsstCheckpointGeneration();
  }
}

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
  if (!genState.selectedAsset) {
    showRefineStatus("Select an asset first.");
    return;
  }
  showRefineStatus("Generating refined variant…");
  els.refineSubmit.disabled = true;

  const prompt = els.refinePrompt.value.trim() || genState.selectedAsset.prompt || genState.selectedAsset.text;
  const request = buildGenerateRequest({
    workflowType: "reference-edit",
    rawIdea: prompt,
    notes: "Refinement request from selected asset.",
    cards: [],
    brandProfileId: els.productSelect.value,
    visualMode: els.refineVisualMode.value,
    selectedAsset: genState.selectedAsset
  });

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });
    const { jobId } = await response.json();
    const output = await pollJob(jobId);
    genState.output = mergeRefinedOutput(genState.output, output, els.refineBranchMode.value, genState.selectedAsset);
    genState.selectedAsset = outputAssets(genState.output).at(-1) || null;
    renderAssetStrip(genState.output, "generate");
    renderPackage(
      genState.output,
      {
        status: els.genPackageStatus,
        caption: els.genCaptionText,
        hashtags: els.genHashtagsText,
        hooks: els.genHooksList,
        platformNotes: els.genPlatformNotes,
        publishLinks: els.genPublishLinks,
        voiceoverCard: els.genReelCard,
        voiceover: els.genVoiceoverText,
        subtitlesCard: els.genSubtitlesCard,
        subtitles: els.genSubtitlesText,
        clipBriefsCard: els.genClipBriefsCard,
        clipBriefs: els.genClipBriefs
      },
      els.productSelect.value
    );
    populateTargetAssetSelect(genState.output);
    renderRefinePanels();
    showRefineStatus("Refined asset ready.");
  } catch (error) {
    showRefineStatus(error instanceof Error ? error.message : String(error));
  } finally {
    els.refineSubmit.disabled = false;
  }
}

async function loadLibrary() {
  const response = await fetch("/api/outputs");
  const outputs = await response.json();
  if (!outputs.length) {
    els.libraryList.innerHTML = `<p class="library-empty">No past generations yet. Go to Generate to make your first post.</p>`;
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
            <span class="library-item__detail">${escapeHtml(titleCase(item.product))} · ${escapeHtml(
              titleCase(item.platform)
            )} · ${date}</span>
          </div>
          <button class="ghost-button" type="button" data-post-id="${escapeHtml(item.postId)}">View</button>
        </div>
      `;
    })
    .join("");
}

async function loadOutputIntoGenerate(postId) {
  const response = await fetch(`/api/outputs/${postId}`);
  if (!response.ok) return;
  const output = await response.json();
  genState.output = output;
  genState.workflowType = output.workflow_type || "slideshow";
  genState.selectedAsset = outputAssets(output)[0] || null;
  resetCheckpoints(els.genCheckpoints);
  setCheckpoint(els.genCheckpoints, "strategy", "done");
  setCheckpoint(els.genCheckpoints, "hooks", "done");
  setCheckpoint(els.genCheckpoints, "visuals", "done");
  setCheckpoint(els.genCheckpoints, "finalPackage", "done");
  els.genEmpty.classList.add("hidden");
  els.genOutput.classList.remove("hidden");
  renderAssetStrip(output, "generate");
  renderPackage(
    output,
    {
      status: els.genPackageStatus,
      caption: els.genCaptionText,
      hashtags: els.genHashtagsText,
      hooks: els.genHooksList,
      platformNotes: els.genPlatformNotes,
      publishLinks: els.genPublishLinks,
      voiceoverCard: els.genReelCard,
      voiceover: els.genVoiceoverText,
      subtitlesCard: els.genSubtitlesCard,
      subtitles: els.genSubtitlesText,
      clipBriefsCard: els.genClipBriefsCard,
      clipBriefs: els.genClipBriefs
    },
    els.productSelect.value
  );
  updateGenWorkflowUI();
  renderRefinePanels();
  switchView("generate");
}

els.generateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const idea = els.ideaInput.value.trim();
  if (!idea) return;

  const ingredients = els.ingredientsInput.value
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const cards = [
    { id: makeId("card"), type: "idea", text: idea, x: 80, y: 80, width: 280, height: 180, tags: ["idea"] },
    ...(ingredients.length
      ? [
          {
            id: makeId("card"),
            type: "asset",
            text: ingredients.join(", "),
            x: 420,
            y: 80,
            width: 240,
            height: 160,
            tags: ["ingredients"]
          }
        ]
      : [])
  ];

  resetCheckpoints(els.genCheckpoints);
  els.genEmpty.classList.add("hidden");
  els.genOutput.classList.remove("hidden");
  setCheckpoint(els.genCheckpoints, "strategy", "active");
  showGenStatus("Planning content…");
  els.genSubmit.disabled = true;

  try {
    const request = buildGenerateRequest({
      workflowType: genState.workflowType,
      rawIdea: idea,
      notes: ingredients.length ? `Ingredients: ${ingredients.join(", ")}.` : "",
      cards,
      brandProfileId: els.productSelect.value,
      visualMode: els.genVisualMode.value,
      selectedAsset: genState.selectedAsset
    });

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });
    const { jobId } = await response.json();
    const output = await pollJob(jobId, (job) => {
      if (job.stage === "rendering" || job.status === "running") {
        setCheckpoint(els.genCheckpoints, "strategy", "done");
        setCheckpoint(els.genCheckpoints, "hooks", "done");
        setCheckpoint(els.genCheckpoints, "visuals", "active");
        showGenStatus("Generating assets…");
      }
    });

    genState.output = output;
    genState.workflowType = output.workflow_type || genState.workflowType;
    genState.selectedAsset = outputAssets(output)[0] || null;
    setCheckpoint(els.genCheckpoints, "visuals", "done");
    setCheckpoint(els.genCheckpoints, "finalPackage", "done");
    hideGenStatus();
    renderAssetStrip(output, "generate");
    renderPackage(
      output,
      {
        status: els.genPackageStatus,
        caption: els.genCaptionText,
        hashtags: els.genHashtagsText,
        hooks: els.genHooksList,
        platformNotes: els.genPlatformNotes,
        publishLinks: els.genPublishLinks,
        voiceoverCard: els.genReelCard,
        voiceover: els.genVoiceoverText,
        subtitlesCard: els.genSubtitlesCard,
        subtitles: els.genSubtitlesText,
        clipBriefsCard: els.genClipBriefsCard,
        clipBriefs: els.genClipBriefs
      },
      els.productSelect.value
    );
    populateTargetAssetSelect(output);
    renderRefinePanels();
    updateGenWorkflowUI();
  } catch (error) {
    showGenStatus(error instanceof Error ? error.message : String(error));
    resetCheckpoints(els.genCheckpoints);
  } finally {
    els.genSubmit.disabled = false;
  }
});

els.assistantForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = els.assistantInput.value.trim();
  if (!text || !asstState.session) return;
  els.assistantInput.value = "";
  showAsstStatus("Thinking…");
  await submitAsstAnswer(text);
  hideAsstStatus();
});

els.refineForm.addEventListener("submit", runRefinement);
els.downloadAllBtn.addEventListener("click", () => downloadAllAssets(genState.output));
els.genCopyCaption.addEventListener("click", () => copyText(genState.output?.caption || "", "Caption", els.genStatus));
els.genCopyHashtags.addEventListener("click", () =>
  copyText((genState.output?.hashtags || []).join(" "), "Hashtags", els.genStatus)
);
els.copyCaption.addEventListener("click", () =>
  copyText(asstState.generatedOutput?.caption || "", "Caption", els.assistantStatus)
);
els.copyHashtags.addEventListener("click", () =>
  copyText((asstState.generatedOutput?.hashtags || []).join(" "), "Hashtags", els.assistantStatus)
);

els.slideStrip.addEventListener("click", (event) => {
  const button = event.target.closest("[data-asset-id]");
  if (!button) return;
  selectAsset("generate", button.dataset.assetId);
  openAssetPreview(button.dataset.assetUrl, button.dataset.assetTitle || "Generated asset", button.dataset.assetKind || "image");
});

els.canvas.addEventListener("click", (event) => {
  const button = event.target.closest("[data-asset-id]");
  if (!button) return;
  selectAsset("assistant", button.dataset.assetId);
  openAssetPreview(button.dataset.assetUrl, button.dataset.assetTitle || "Generated asset", button.dataset.assetKind || "image");
});

els.libraryList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-post-id]");
  if (!button) return;
  loadOutputIntoGenerate(button.dataset.postId);
});

els.brandMascotReferences.addEventListener("click", (event) => {
  const button = event.target.closest("[data-brand-asset-url]");
  if (!button) return;
  openAssetPreview(button.dataset.brandAssetUrl, button.dataset.brandAssetTitle || "Mascot reference");
});

els.productSelect.addEventListener("change", async () => {
  syncProductSelects(els.productSelect.value);
  renderBrandEditor(els.productSelect.value);
  updateGenWorkflowUI();
  await createAsstSession(els.productSelect.value);
});

els.asstProductSelect.addEventListener("change", async () => {
  syncProductSelects(els.asstProductSelect.value);
  renderBrandEditor(els.asstProductSelect.value);
  await createAsstSession(els.asstProductSelect.value);
});

els.genVisualMode.addEventListener("change", () => {
  syncVisualModeSelects(els.genVisualMode.value);
  updateGenWorkflowUI();
  renderRefinePanels();
});

els.asstVisualMode.addEventListener("change", () => {
  syncVisualModeSelects(els.asstVisualMode.value);
  updateAsstWorkflowUI();
  renderRefinePanels();
});

els.genDeliveryTarget.addEventListener("change", () => syncDeliveryTargets(els.genDeliveryTarget.value));
els.asstDeliveryTarget.addEventListener("change", () => syncDeliveryTargets(els.asstDeliveryTarget.value));
els.genReferenceInput.addEventListener("input", updateGenWorkflowUI);
els.asstReferenceInput.addEventListener("input", updateAsstWorkflowUI);
els.refineReferenceInput.addEventListener("input", renderRefinePanels);
els.genTargetAsset.addEventListener("change", () => selectAsset("generate", els.genTargetAsset.value));
els.genReferenceFiles.addEventListener("change", async () => {
  showGenStatus("Uploading references…");
  try {
    await uploadReferencesIntoTextarea(els.genReferenceFiles.files, els.genReferenceInput, updateGenWorkflowUI);
    hideGenStatus();
  } catch (error) {
    showGenStatus(error instanceof Error ? error.message : String(error));
  } finally {
    els.genReferenceFiles.value = "";
  }
});
els.refineReferenceFiles.addEventListener("change", async () => {
  showRefineStatus("Uploading references…");
  try {
    await uploadReferencesIntoTextarea(els.refineReferenceFiles.files, els.refineReferenceInput, renderRefinePanels);
    hideRefineStatus();
  } catch (error) {
    showRefineStatus(error instanceof Error ? error.message : String(error));
  } finally {
    els.refineReferenceFiles.value = "";
  }
});
els.asstReferenceFiles.addEventListener("change", async () => {
  showAsstStatus("Uploading references…");
  try {
    await uploadReferencesIntoTextarea(els.asstReferenceFiles.files, els.asstReferenceInput, updateAsstWorkflowUI);
    hideAsstStatus();
  } catch (error) {
    showAsstStatus(error instanceof Error ? error.message : String(error));
  } finally {
    els.asstReferenceFiles.value = "";
  }
});

els.brandEditorSave.addEventListener("click", async () => {
  const brandId = els.productSelect.value;
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
  asstState.brands = await fetch("/api/brands").then((res) => res.json());
  renderBrandEditor(brandId);
  els.brandEditorStatus.textContent = "Mascot system saved.";
  setTimeout(() => {
    if (els.brandEditorStatus.textContent === "Mascot system saved.") {
      els.brandEditorStatus.classList.add("hidden");
    }
  }, 1500);
});

async function bootstrap() {
  await loadProducts();
  renderBrandEditor("peppera");
  updateGenWorkflowUI();
  updateAsstWorkflowUI();
  syncVisualModeSelects("mascot-led");
  syncDeliveryTargets("both");
  await createAsstSession("peppera");
  els.ideaInput.focus();
}

bootstrap().catch((error) => {
  showGenStatus(error instanceof Error ? error.message : String(error));
});
