import { els } from "./dom-refs.js";
import { studioState } from "./state.js";
import { escapeHtml, titleCase, getArtifactPreviewUrl, getWorkspaceAssetUrl } from "./app-helpers.js";
import { downloadArtboard } from "./canvas-engine.js";
import { showStatus, hideStatus, capitalizeFirst } from "./ui-utils.js";

// ── Asset modal ───────────────────────────────────────────────────────────────
export function openAssetPreview(url, title, kind = "image") {
  els.assetModalTitle.textContent = title;
  els.assetModalOpen.href = url;
  els.assetModalDownload.href = url;
  els.assetModalDownload.setAttribute("download",
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

export function closeAssetPreview() {
  els.assetModal.classList.add("hidden");
  els.assetModalImage.removeAttribute("src");
  els.assetModalVideo.pause();
  els.assetModalVideo.removeAttribute("src");
}

export function initAssetModalListeners() {
  els.assetModal.addEventListener("click", (e) => {
    if (e.target instanceof HTMLElement && e.target.dataset.closeModal === "true") closeAssetPreview();
  });
  els.assetModalClose.addEventListener("click", closeAssetPreview);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.assetModal.classList.contains("hidden")) closeAssetPreview();
  });
}

// ── Output assets helper ──────────────────────────────────────────────────────
export function outputAssets(output) {
  if (!output) return [];
  if (output.artifacts?.length) {
    return output.artifacts.map((a, i) => ({
      itemId: a.id, assetKind: a.kind, role: a.role, text: a.title,
      prompt: a.prompt, assetUrl: getArtifactPreviewUrl(output, a),
      sourceAssetId: a.source_asset_id || null, variantGroup: a.variant_group || null,
      slideNumber: null, order: i
    }));
  }
  return (output.slides || [])
    .filter((s) => typeof s.slide_number === "number" && !Number.isNaN(s.slide_number))
    .map((s, i) => ({
      itemId: `slide-${String(s.slide_number).padStart(2, "0")}`,
      assetKind: "image", role: s.role, text: s.text,
      prompt: s.image_prompt || s.text, assetUrl: getWorkspaceAssetUrl(output, s),
      sourceAssetId: null, variantGroup: null, slideNumber: s.slide_number, order: i
    }));
}

// ── Inspector package (no-op — canvas overlays handle this) ───────────────────
export function renderInspectorPackage() {}

// ── Asset node ────────────────────────────────────────────────────────────────
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
    v.controls = true; v.playsInline = true; v.src = asset.assetUrl;
    container.appendChild(v);
  } else {
    const img = document.createElement("img");
    img.src = asset.assetUrl; img.alt = asset.text || "Generated asset";
    container.appendChild(img);
  }
}

// ── Inspector asset panel ─────────────────────────────────────────────────────
export function renderInspectorAsset() {
  const sel = studioState.selectedAsset;
  const inspectorEl = document.getElementById("studio-inspector");
  els.inspectorAsset.classList.toggle("hidden", !sel);
  if (inspectorEl) inspectorEl.classList.toggle("hidden", !sel);
  if (!sel) return;

  els.inspectorAssetTitle.textContent = sel.text || "Selected asset";
  els.inspectorAssetHint.textContent = `${titleCase(sel.assetKind || "image")} — click to open full size.`;
  showAssetNode(els.inspectorAssetPreview, sel);
  els.studioRefinePrompt.value ||= sel.prompt || "";

  els.inspectorAssetPreview.style.cursor = "pointer";
  els.inspectorAssetPreview.onclick = () => openAssetPreview(sel.assetUrl, sel.text || "Asset", sel.assetKind || "image");

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
        try { dlBtn.disabled = true; dlBtn.textContent = "Downloading…"; await downloadArtboard(selected); }
        catch (err) { showStatus(err instanceof Error ? err.message : "Download failed."); }
        finally { dlBtn.disabled = false; dlBtn.textContent = "Download Asset"; }
      }
    });
  }
}

export function selectAsset(assetId) {
  studioState.selectedAsset = outputAssets(studioState.generatedOutput).find((a) => a.itemId === assetId) || null;
  renderCanvas();
  renderInspectorAsset();
  if (studioState.canvasEngine) {
    const match = studioState.canvasEngine.getArtboards().find((a) => a.id === assetId);
    if (match) studioState.canvasEngine._selection.select(match.id);
  }
}

// ── Canvas render (stub — CanvasEngine handles rendering) ─────────────────────
export function renderCanvas() {
  if (els.canvasEmpty && !studioState.generatedOutput) els.canvasEmpty.classList.remove("hidden");
}

// ── Brand selection ring ──────────────────────────────────────────────────────
export function applyBrandSelectionRing(artboardDesc) {
  clearBrandSelectionRing();
  const primaryColor = studioState.generatedOutput?.brand_profile?.visual?.primaryColor || "#6f5c45";
  const el = document.querySelector(`.canvas-artboard[data-artboard-id="${artboardDesc.id}"]`);
  if (el) {
    el.style.outline = `3px solid ${primaryColor}`;
    el.style.outlineOffset = "2px";
    el.style.boxShadow = `0 0 12px ${primaryColor}44`;
  }
}

export function clearBrandSelectionRing() {
  document.querySelectorAll(".canvas-artboard").forEach((el) => {
    el.style.outline = ""; el.style.outlineOffset = ""; el.style.boxShadow = "";
  });
}

// ── Detail panel ──────────────────────────────────────────────────────────────
export function populateDetailPanel(artboardDesc) {
  const output = studioState.generatedOutput;
  if (!output) return;

  const slides = output.artifacts?.length ? output.artifacts : (output.slides || []);
  const slide = slides.find((s) => (s.slide_number ?? 0) === artboardDesc.slideNumber) || slides[artboardDesc.order];

  let detailSection = document.getElementById("inspector-slide-detail");
  if (!detailSection) {
    detailSection = document.createElement("div");
    detailSection.id = "inspector-slide-detail";
    detailSection.className = "inspector-slide-detail";
    const inspectorEl = document.getElementById("studio-inspector");
    if (inspectorEl) {
      const packageEl = document.getElementById("inspector-package");
      inspectorEl.insertBefore(detailSection, packageEl);
    }
  }
  detailSection.classList.remove("hidden");

  const role = artboardDesc.role || slide?.role || "slide";
  const slideNumber = artboardDesc.slideNumber ?? slide?.slide_number ?? "—";
  const text = slide?.text || artboardDesc.text || "";
  const imagePrompt = slide?.image_prompt || artboardDesc.prompt || "";
  const recipe = slide?.recipe || null;
  const canRegenerate = role === "recipe" || !!imagePrompt;

  let html = `
    <p class="eyebrow" style="margin-top:16px">Slide Detail</p>
    <div class="inspector-slide-meta">
      <span class="inspector-slide-number">Slide ${slideNumber}</span>
      <span class="inspector-slide-role">${escapeHtml(capitalizeFirst(role))}</span>
    </div>`;
  if (text) html += `<div class="inspector-row" style="margin-top:8px"><p class="inspector-label">Text</p></div><p class="inspector-body-text inspector-slide-text">${escapeHtml(text)}</p>`;
  if (imagePrompt) html += `<div class="inspector-row" style="margin-top:8px"><p class="inspector-label">Image Prompt</p></div><p class="inspector-body-text inspector-slide-prompt">${escapeHtml(imagePrompt)}</p>`;
  if (recipe) {
    html += `<div class="inspector-row" style="margin-top:8px"><p class="inspector-label">Recipe</p></div><div class="inspector-recipe-data">`;
    if (recipe.name) html += `<p class="inspector-recipe-field"><strong>Name:</strong> ${escapeHtml(recipe.name)}</p>`;
    if (recipe.cook_time) html += `<p class="inspector-recipe-field"><strong>Cook time:</strong> ${escapeHtml(recipe.cook_time)}</p>`;
    if (recipe.ingredients?.length) html += `<p class="inspector-recipe-field"><strong>Ingredients:</strong> ${escapeHtml(recipe.ingredients.join(", "))}</p>`;
    if (recipe.steps?.length) html += `<p class="inspector-recipe-field"><strong>Steps:</strong> ${escapeHtml(recipe.steps.join(" → "))}</p>`;
    if (recipe.pro_tip) html += `<p class="inspector-recipe-field"><strong>Pro tip:</strong> ${escapeHtml(recipe.pro_tip)}</p>`;
    html += `</div>`;
  }

  html += `<div class="inspector-slide-actions" style="margin-top:12px">`;
  html += `<button class="ghost-button inspector-download-slide-btn" type="button">Download Slide</button>`;
  if (canRegenerate) {
    html += `
    <div class="inspector-regen-section" style="margin-top:8px">
      <label class="field-label" for="inspector-regen-prompt">Regeneration prompt</label>
      <textarea id="inspector-regen-prompt" class="inspector-regen-prompt" rows="3">${escapeHtml(imagePrompt)}</textarea>
      <div class="inspector-regen-btn-row">
        <button class="primary-button inspector-regen-btn" type="button" style="margin-top:6px">Regenerate Image</button>
        <span class="inspector-regen-loading hidden" aria-label="Regenerating image"><span class="inspector-regen-spinner"></span> Regenerating…</span>
      </div>
      <div class="inspector-regen-error hidden" role="alert"></div>
    </div>`;
  }
  html += `</div>`;
  detailSection.innerHTML = html;

  // Wire download slide button
  const dlBtn = detailSection.querySelector(".inspector-download-slide-btn");
  if (dlBtn) {
    dlBtn.addEventListener("click", async () => {
      if (!studioState.canvasEngine) return;
      const selected = studioState.canvasEngine.getSelectedArtboard();
      if (selected) {
        try { dlBtn.disabled = true; dlBtn.textContent = "Downloading…"; await downloadArtboard(selected); }
        catch (err) { showStatus(err instanceof Error ? err.message : "Download failed."); }
        finally { dlBtn.disabled = false; dlBtn.textContent = "Download Slide"; }
      }
    });
  }

  // Wire regenerate button
  const regenBtn = detailSection.querySelector(".inspector-regen-btn");
  if (regenBtn) {
    regenBtn.addEventListener("click", async () => {
      const postId = output.post_id;
      const promptEl = document.getElementById("inspector-regen-prompt");
      const prompt = promptEl?.value || imagePrompt;
      if (!postId || slideNumber == null) return;
      const loadingEl = detailSection.querySelector(".inspector-regen-loading");
      const errorEl = detailSection.querySelector(".inspector-regen-error");
      try {
        regenBtn.disabled = true; regenBtn.classList.add("hidden");
        if (loadingEl) loadingEl.classList.remove("hidden");
        if (errorEl) { errorEl.classList.add("hidden"); errorEl.textContent = ""; }
        const result = await regenerateSlide(postId, slideNumber, prompt);
        if (result?.slide) {
          const updatedSlide = result.slide;
          const currentSlides = studioState.generatedOutput?.slides || [];
          const slideIdx = currentSlides.findIndex((s) => (s.slide_number ?? 0) === slideNumber);
          if (slideIdx >= 0) currentSlides[slideIdx] = { ...currentSlides[slideIdx], asset_path: updatedSlide.asset_path, image_prompt: updatedSlide.image_prompt || prompt };
          const currentArtifacts = studioState.generatedOutput?.artifacts || [];
          const artIdx = currentArtifacts.findIndex((s) => (s.slide_number ?? 0) === slideNumber);
          if (artIdx >= 0) currentArtifacts[artIdx] = { ...currentArtifacts[artIdx], asset_path: updatedSlide.asset_path, image_prompt: updatedSlide.image_prompt || prompt };
          const artboardId = `artboard-${String(slideNumber).padStart(2, "0")}`;
          const artboardEl = document.querySelector(`.canvas-artboard[data-artboard-id="${artboardId}"]`);
          if (artboardEl) {
            const img = artboardEl.querySelector("img");
            if (img && updatedSlide.asset_path) {
              const filename = updatedSlide.asset_path.split("/").pop();
              img.src = `/api/assets/${postId}/${filename}?t=${Date.now()}`;
            }
          }
          populateDetailPanel({ ...artboardDesc, prompt: updatedSlide.image_prompt || prompt });
        }
        hideStatus();
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Regeneration failed.";
        if (errorEl) { errorEl.textContent = errMsg; errorEl.classList.remove("hidden"); }
        showStatus(errMsg);
      } finally {
        regenBtn.disabled = false; regenBtn.classList.remove("hidden");
        if (loadingEl) loadingEl.classList.add("hidden");
      }
    });
  }
}

export function hideDetailPanel() {
  const detailSection = document.getElementById("inspector-slide-detail");
  if (detailSection) detailSection.classList.add("hidden");
}

// ── Regenerate slide API call ─────────────────────────────────────────────────
export async function regenerateSlide(postId, slideNumber, imagePrompt) {
  const res = await fetch(`/api/outputs/${postId}/slides/${slideNumber}/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_prompt: imagePrompt })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Regeneration failed" }));
    throw new Error(err.error || "Regeneration failed");
  }
  return res.json();
}
