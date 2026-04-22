import { els } from "./dom-refs.js";
import { studioState, WORKFLOW_PRESETS } from "./state.js";
import { escapeHtml } from "./app-helpers.js";
import { getBrandById, getWorkflowPreset } from "./ui-utils.js";

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

export function buildReferenceAssets({ brandId, visualMode, inputValue, selectedAsset } = {}) {
  const brandRefs = buildBrandReferenceAssets(brandId, visualMode);
  const runRefs = parseReferenceLines(inputValue);
  const uploadedRefs = (studioState.uploadedAssets || [])
    .filter((asset) => asset.mimeType?.startsWith("image/"))
    .map((asset) => ({ id: asset.id, label: asset.label || asset.filename, url: asset.url, source: "asset", kind: "image" }));
  const assetRefs = selectedAsset?.assetUrl && selectedAsset.assetKind === "image"
    ? [{ id: `asset-ref-${selectedAsset.itemId || "sel"}`, label: selectedAsset.text || "Selected", url: selectedAsset.assetUrl, source: "asset", kind: "image" }]
    : [];
  return [...brandRefs, ...uploadedRefs, ...assetRefs, ...runRefs];
}

export function renderReferenceChips() {
  const refs = buildReferenceAssets({
    brandId: els.studioProductSelect.value,
    visualMode: els.studioVisualMode.value,
    inputValue: els.studioReferenceInput.value
  });
  els.studioReferenceChipset.innerHTML = refs.map((r) =>
    `<span class="reference-chip reference-chip--${escapeHtml(r.source)}">${escapeHtml(r.label)}</span>`
  ).join("");
}

export function renderRoutePreview() {
  if (!els.studioRoutePreview) return;
  const preview = studioState.routePreview;
  if (!preview?.decision) {
    els.studioRoutePreview.innerHTML = `<p class="assistant-status">Upload assets or enter a prompt to preview the route.</p>`;
    return;
  }
  const decision = preview.decision;
  const candidates = (decision.candidates || []).slice(0, 3)
    .map((c) => `<li>${escapeHtml(c.recipeId)} — ${escapeHtml(c.routeFamily)} (${c.score})</li>`).join("");
  els.studioRoutePreview.innerHTML = `
    <div class="route-preview__summary">
      <strong>${escapeHtml(decision.recipeId)}</strong>
      <span>${escapeHtml(decision.routeFamily)} → ${escapeHtml(decision.workflowType)}</span>
      <p>${escapeHtml(decision.reasonSummary || "No routing summary available.")}</p>
      ${decision.requiresConfirmation ? `<p class="assistant-status">Low confidence: review the asset labels before generating.</p>` : ""}
    </div>
    <ul class="route-preview__candidates">${candidates}</ul>`;
}

export function renderInlineRoutePreview() {
  const el = document.getElementById("studio-route-inline");
  if (!el) return;
  const decision = studioState.routePreview?.decision;
  if (!decision) { el.classList.add("hidden"); return; }
  const parts = [];
  parts.push(`<span class="route-inline__badge">${escapeHtml(decision.workflowType || studioState.workflowType || "slideshow")}</span>`);
  if (decision.contentTypeId) parts.push(`<span class="route-inline__label">${escapeHtml(decision.contentTypeId)}</span>`);
  if (decision.deliveryTargets) parts.push(`<span class="route-inline__label">→ ${escapeHtml(decision.deliveryTargets)}</span>`);
  const uploadCount = (studioState.uploadedAssets || []).length;
  if (uploadCount > 0) parts.push(`<span class="route-inline__label">${uploadCount} upload${uploadCount > 1 ? "s" : ""}</span>`);
  el.innerHTML = parts.join(" ");
  el.classList.remove("hidden");
}

export async function refreshRoutePreview() {
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
        recipeId: "unavailable", routeFamily: "carousel", workflowType: "slideshow",
        reasonSummary: err instanceof Error ? err.message : "Route preview unavailable.",
        candidates: [], requiresConfirmation: false
      }
    };
  }
  renderRoutePreview();
  renderInlineRoutePreview();
}

export function updateContentTypeSelector(brandId) {
  const brand = getBrandById(brandId);
  const select = els.studioContentTypeSelect;
  if (!select) return;
  if (!brand?.contentTypes?.length) { select.innerHTML = '<option value="">Standard</option>'; return; }
  select.innerHTML = brand.contentTypes.map((ct) =>
    `<option value="${escapeHtml(ct.id)}">${escapeHtml(ct.name)}</option>`
  ).join("");
  if (brand.defaultContentType) select.value = brand.defaultContentType;
  const analyses = studioState.assetAnalyses || [];
  const platform = els.studioPlatformSelect?.value || "instagram";
  if (analyses.some((a) => a.assetType === "person_photo") && platform === "linkedin") {
    const opt = document.createElement("option"); opt.value = "linkedin-photo-post"; opt.textContent = "LinkedIn Post with Photo"; select.appendChild(opt);
  }
  if (analyses.some((a) => a.assetType === "product_photo")) {
    const opt = document.createElement("option"); opt.value = "product-showcase"; opt.textContent = "Product Showcase"; select.appendChild(opt);
  }
}

export function updateWorkflowUI() {
  const preset = getWorkflowPreset(studioState.workflowType);
  els.studioWorkflowSummary.textContent = preset.summary;
  els.studioWorkflowPresets.innerHTML = WORKFLOW_PRESETS.map((p) =>
    `<button type="button" class="workflow-preset${p.id === studioState.workflowType ? " is-active" : ""}" data-workflow-id="${p.id}">
      <p class="workflow-preset__title">${escapeHtml(p.label)}</p>
      <p class="workflow-preset__summary">${escapeHtml(p.summary)}</p>
    </button>`
  ).join("");
  els.studioWorkflowPresets.querySelectorAll("[data-workflow-id]").forEach((btn) => {
    btn.addEventListener("click", () => { studioState.workflowType = btn.dataset.workflowId; updateWorkflowUI(); });
  });
  renderReferenceChips();
}
