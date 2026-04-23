import { els } from "./dom-refs.js";
import { studioState } from "./state.js";
import { escapeHtml } from "./app-helpers.js";
import { showStatus, hideStatus } from "./ui-utils.js";
import { addUploadsToLibrary, isUploadSelected, selectUploadForRun } from "./upload-scope.js";

/** @type {function|null} Called after an uploaded asset is deleted. */
let _onAssetDeleted = null;

/** Register a callback for post-delete cleanup (reference chips, route preview). */
export function onAssetDeleted(fn) { _onAssetDeleted = fn; }

// ── Upload Queue ──────────────────────────────────────────────────────────────
export const uploadQueue = {
  /** @type {Array<{ file: File, dataUrl: string, status: 'pending'|'uploading'|'done'|'error' }>} */
  files: [],

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
            this.files.push({ file, dataUrl: "", status: "error" });
            resolve();
          };
          reader.readAsDataURL(file);
        })
    );
    Promise.all(promises).then(() => this._updateBadge());
  },

  remove(index) {
    if (index >= 0 && index < this.files.length) this.files.splice(index, 1);
    this._updateBadge();
  },

  clear() {
    this.files.length = 0;
    this._updateBadge();
  },

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

  _updateBadge() {
    const badge = document.getElementById("toolbar-upload-count");
    if (!badge) return;
    badge.textContent = String(this.files.length);
    badge.classList.toggle("hidden", this.files.length === 0);
  },
};

// ── Asset analysis ────────────────────────────────────────────────────────────
export function assetAnalysisForId(assetId) {
  return studioState.assetAnalyses.find((a) => a.assetId === assetId) || null;
}

export async function analyzeUploadedAssetRecord(asset) {
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

// ── Existing uploads loader ───────────────────────────────────────────────────
export async function loadExistingUploads() {
  try {
    const res = await fetch("/api/uploads");
    if (!res.ok) return;
    const assets = await res.json();
    if (Array.isArray(assets) && assets.length) {
      const existingIds = new Set(studioState.uploadedAssets.map((a) => a.id));
      const fresh = assets.filter((a) => !existingIds.has(a.id));
      addUploadsToLibrary(studioState, fresh, { selectForRun: false });
      renderUploadedAssets();
    }
  } catch { /* network error — ignore */ }
}

// ── Render uploaded assets ────────────────────────────────────────────────────
export function renderUploadedAssets() {
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
        <label class="uploaded-asset-card__scope">
          <input type="checkbox" data-upload-field="selected" ${isUploadSelected(studioState, asset.id) ? "checked" : ""} />
          <span>Use in this run</span>
        </label>
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

  els.studioUploadedAssets.querySelectorAll(".uploaded-asset-card__delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.uploadId;
      const asset = studioState.uploadedAssets.find((a) => a.id === id);
      studioState.uploadedAssets = studioState.uploadedAssets.filter((a) => a.id !== id);
      studioState.assetAnalyses = studioState.assetAnalyses.filter((a) => a.assetId !== id);
      selectUploadForRun(studioState, id, false);
      // Strip deleted asset URL from reference input
      if (asset?.url && els.studioReferenceInput) {
        els.studioReferenceInput.value = els.studioReferenceInput.value
          .split("\n").filter((line) => line.trim() !== asset.url).join("\n");
      }
      renderUploadedAssets();
      if (_onAssetDeleted) _onAssetDeleted();
      await fetch("/api/uploads", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
    });
  });
}
