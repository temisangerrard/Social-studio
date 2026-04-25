import { els } from "./dom-refs.js";
import { studioState } from "./state.js";
import { escapeHtml } from "./app-helpers.js";
import { getBrandById } from "./ui-utils.js";
import { openAssetPreview } from "./inspector.js";

export function renderBrandEditor(brandId) {
  if (!els.brandMascotName || !els.brandMascotRole || !els.brandMascotVisualPrompt || !els.brandMascotRules || !els.brandMascotReferences) return;
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
      <button type="button" data-brand-asset-url="${imgUrl}" data-brand-asset-title="${title}"><img src="${imgUrl}" alt="${title}" loading="lazy" /></button>
      <span>${escapeHtml(label)}</span>
      <button type="button" class="ghost-button brand-ref-remove" data-brand-id="${escapeHtml(brandId)}" data-ref-index="${i}" style="font-size:0.65rem;padding:4px 8px">Remove</button>
    </div>`;
  }).join("");
}

export function initBrandEditorListeners() {
  if (els.brandMascotReferences) els.brandMascotReferences.addEventListener("click", async (e) => {
    const previewBtn = e.target.closest("[data-brand-asset-url]");
    if (previewBtn) { openAssetPreview(previewBtn.dataset.brandAssetUrl, previewBtn.dataset.brandAssetTitle || "Mascot reference"); return; }
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
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...existing, mascot: { ...mascot, visualPrompt: els.brandMascotVisualPrompt.value.trim(), usageRules: els.brandMascotRules.value.split("\n").map((l) => l.trim()).filter(Boolean) } })
    });
    studioState.brands = await fetch("/api/brands").then((r) => r.json());
    renderBrandEditor(brandId);
    els.brandEditorStatus.classList.remove("hidden"); els.brandEditorStatus.textContent = "Saved.";
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
        const dataUrl = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
        await fetch(`/api/brands/${brandId}/mascot-upload`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name, dataUrl }) });
      }
      studioState.brands = await fetch("/api/brands").then((r) => r.json());
      renderBrandEditor(brandId);
      els.brandMascotRefStatus.textContent = "Images uploaded.";
      setTimeout(() => els.brandMascotRefStatus.classList.add("hidden"), 1500);
    } catch (err) { els.brandMascotRefStatus.textContent = err instanceof Error ? err.message : "Upload failed."; }
    finally { els.brandMascotRefFiles.value = ""; }
  });
}
