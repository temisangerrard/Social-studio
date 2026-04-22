// ── Styles View — browse, inspect, create, delete style presets ────────────────

import { studioState } from "./state.js";

const grid = () => document.getElementById("styles-grid");
const detail = () => document.getElementById("styles-detail");
const modal = () => document.getElementById("styles-create-modal");

// ── Load & Render ─────────────────────────────────────────────────────────────

export async function loadStyles() {
  try {
    const res = await fetch("/api/styles");
    studioState.stylePresets = await res.json();
  } catch { /* keep existing */ }
  renderStyleCards();
}

function renderStyleCards() {
  const el = grid();
  if (!el) return;
  const styles = studioState.stylePresets || [];
  if (!styles.length) { el.innerHTML = `<p class="styles-empty">No style presets yet.</p>`; return; }

  el.innerHTML = styles.map((s) => `
    <button class="styles-card" data-style-id="${s.id}">
      <div class="styles-card__tone">${s.visualTraits.tone.map((t) => `<span class="styles-card__tag">${t}</span>`).join("")}</div>
      <h3 class="styles-card__name">${s.name}</h3>
      <p class="styles-card__intent">${s.intent}</p>
      <div class="styles-card__meta">
        <span class="styles-card__badge styles-card__badge--${s.source}">${s.source}</span>
        <span class="styles-card__style">${s.imageStyle}</span>
      </div>
    </button>
  `).join("");
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function showDetail(styleId) {
  const s = (studioState.stylePresets || []).find((x) => x.id === styleId);
  if (!s) return;
  const d = detail();
  d.classList.remove("hidden");

  document.getElementById("styles-detail-source").textContent = s.source;
  document.getElementById("styles-detail-name").textContent = s.name;
  document.getElementById("styles-detail-intent").textContent = s.intent;
  document.getElementById("styles-detail-image").textContent = s.imageStyle;
  document.getElementById("styles-detail-layout").textContent = s.layoutStyle;
  document.getElementById("styles-detail-copy").textContent = s.copyStyle;
  document.getElementById("styles-detail-tone").innerHTML = s.visualTraits.tone.map((t) => `<span class="style-tag">${t}</span>`).join("");
  document.getElementById("styles-detail-avoids").innerHTML = s.negativeConstraints.slice(0, 6).map((c) => `<span class="style-tag style-tag--avoid">${c}</span>`).join("");
  document.getElementById("styles-detail-rules").textContent = `Max ${s.contentRules.maxTextWordsPerSlide} words/slide · Caption: ${s.contentRules.captionStyle}`;

  const deleteBtn = document.getElementById("styles-detail-delete");
  deleteBtn.classList.toggle("hidden", s.source === "builtin");
  deleteBtn.dataset.styleId = s.id;

  const useBtn = document.getElementById("styles-detail-use");
  useBtn.dataset.styleId = s.id;
  useBtn.textContent = s.id.startsWith("ugc-") ? "Open in UGC" : "Use in Studio";
}

// ── Create from References ────────────────────────────────────────────────────

let refFiles = [];

function openCreateModal() {
  refFiles = [];
  document.getElementById("styles-ref-thumbs").innerHTML = "";
  document.getElementById("styles-create-name").value = "";
  document.getElementById("styles-create-intent").value = "";
  document.getElementById("styles-create-status").classList.add("hidden");
  modal().classList.remove("hidden");
}

function addRefFiles(files) {
  for (const f of Array.from(files)) {
    if (refFiles.length >= 10) break;
    refFiles.push(f);
  }
  const thumbs = document.getElementById("styles-ref-thumbs");
  thumbs.innerHTML = refFiles.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `<div class="styles-ref-thumb"><img src="${url}" alt="" /><button type="button" data-ref-idx="${i}" class="styles-ref-remove">✕</button></div>`;
  }).join("");
}

async function submitCreate(e) {
  e.preventDefault();
  const name = document.getElementById("styles-create-name").value.trim();
  const intent = document.getElementById("styles-create-intent").value.trim();
  const status = document.getElementById("styles-create-status");
  if (!name) { status.textContent = "Name is required."; status.classList.remove("hidden"); return; }
  if (refFiles.length < 1) { status.textContent = "Upload at least one reference image."; status.classList.remove("hidden"); return; }

  status.textContent = "Uploading & analyzing…"; status.classList.remove("hidden");
  const btn = document.getElementById("styles-create-submit");
  btn.disabled = true; btn.textContent = "Working…";

  try {
    // Upload each file and get analyses
    const analyses = [];
    for (const file of refFiles) {
      const dataUrl = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsDataURL(file); });
      const uploadRes = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name, dataUrl }) });
      const asset = await uploadRes.json();
      const analyzeRes = await fetch("/api/uploads/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asset, brandProfileId: "peppera" }) });
      analyses.push(await analyzeRes.json());
    }

    // Create style card from analyses
    const res = await fetch("/api/styles/from-references", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analyses, name, intent: intent || `Custom style: ${name}` })
    });
    const { styleCard } = await res.json();

    status.textContent = `Created "${styleCard.name}"`;
    await loadStyles();
    setTimeout(() => modal().classList.add("hidden"), 800);
  } catch (err) {
    status.textContent = err instanceof Error ? err.message : "Failed to create style.";
  } finally {
    btn.disabled = false; btn.textContent = "Analyze & Create";
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function deleteStyle(styleId) {
  if (!confirm("Delete this custom style?")) return;
  await fetch(`/api/styles/${encodeURIComponent(styleId)}`, { method: "DELETE" });
  detail().classList.add("hidden");
  await loadStyles();
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initStylesListeners() {
  grid()?.addEventListener("click", (e) => {
    const card = e.target.closest("[data-style-id]");
    if (card) showDetail(card.dataset.styleId);
  });

  document.getElementById("styles-detail-close")?.addEventListener("click", () => detail().classList.add("hidden"));

  document.getElementById("styles-detail-delete")?.addEventListener("click", (e) => {
    const id = e.currentTarget.dataset.styleId;
    if (id) deleteStyle(id);
  });

  document.getElementById("styles-detail-use")?.addEventListener("click", (e) => {
    const id = e.currentTarget.dataset.styleId;
    if (!id) return;
    if (id.startsWith("ugc-")) {
      document.dispatchEvent(new CustomEvent("studio:switch-view", { detail: "ugc" }));
      return;
    }
    studioState.selectedStyleId = id;
    const presetSelect = document.getElementById("studio-style-preset");
    if (presetSelect) {
      // Refresh options so newly created styles are available
      const presets = studioState.stylePresets || [];
      const editorial = presets.filter((s) => !s.id.startsWith("ugc-") && s.source === "builtin");
      const custom = presets.filter((s) => !s.id.startsWith("ugc-") && s.source !== "builtin");
      let html = "";
      if (editorial.length) html += `<optgroup label="Editorial">${editorial.map((s) => `<option value="${s.id}">${s.name}</option>`).join("")}</optgroup>`;
      if (custom.length) html += `<optgroup label="Custom">${custom.map((s) => `<option value="${s.id}">${s.name}</option>`).join("")}</optgroup>`;
      const studioPresets = presets.filter((s) => !s.id.startsWith("ugc-"));
      presetSelect.innerHTML = html || studioPresets.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
      presetSelect.value = id;
      presetSelect.dispatchEvent(new Event("change"));
    }
    document.dispatchEvent(new CustomEvent("studio:switch-view", { detail: "studio" }));
  });

  document.getElementById("styles-create-btn")?.addEventListener("click", openCreateModal);
  document.getElementById("styles-modal-close")?.addEventListener("click", () => modal().classList.add("hidden"));
  modal()?.querySelector("[data-close-styles-modal]")?.addEventListener("click", () => modal().classList.add("hidden"));
  document.getElementById("styles-create-form")?.addEventListener("submit", submitCreate);

  document.getElementById("styles-ref-files")?.addEventListener("change", (e) => { if (e.target.files?.length) addRefFiles(e.target.files); });
  document.getElementById("styles-ref-thumbs")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ref-idx]");
    if (btn) { refFiles.splice(Number(btn.dataset.refIdx), 1); addRefFiles([]); }
  });

  // Drag-and-drop on upload zone
  const zone = document.querySelector(".styles-upload-zone");
  if (zone) {
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("is-dragover"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("is-dragover"));
    zone.addEventListener("drop", (e) => { e.preventDefault(); zone.classList.remove("is-dragover"); if (e.dataTransfer?.files?.length) addRefFiles(e.dataTransfer.files); });
  }
}
