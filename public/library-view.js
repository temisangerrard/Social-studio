import { els, calEls, adminEls } from "./dom-refs.js";
import { studioState } from "./state.js";
import { escapeHtml, titleCase } from "./app-helpers.js";
import { showStatus } from "./ui-utils.js";
import { outputAssets, renderInspectorAsset, renderCanvas } from "./inspector.js";
import { renderRoutePreview } from "./references.js";
import { loadOutputToEngine, showCaptionBar } from "./generation.js";

let libraryOutputs = [];
let libraryStorageInfo = null;
let librarySortMode = "date";
let librarySelectedIds = new Set();
let libraryVisibleCount = 20;

function showLibraryError(message) {
  const existing = els.libraryList?.querySelector(".library-error");
  if (existing) existing.remove();
  const banner = document.createElement("div");
  banner.className = "library-error";
  banner.setAttribute("role", "alert");
  banner.innerHTML = `<span>${escapeHtml(message)}</span><button type="button" class="library-error__dismiss" aria-label="Dismiss">&times;</button>`;
  banner.querySelector(".library-error__dismiss").addEventListener("click", () => banner.remove());
  setTimeout(() => { if (banner.parentNode) banner.remove(); }, 6000);
  if (els.libraryList) els.libraryList.prepend(banner);
}

export async function loadLibrary() {
  try {
    const [outputsRes, storageRes] = await Promise.all([fetch("/api/outputs"), fetch("/api/storage/usage")]);
    libraryOutputs = await outputsRes.json();
    try { libraryStorageInfo = await storageRes.json(); } catch { libraryStorageInfo = null; }
  } catch { libraryOutputs = []; libraryStorageInfo = null; }

  const brands = [...new Set(libraryOutputs.map((o) => o.product).filter(Boolean))].sort();
  const brandSelect = calEls.libraryBrandFilter;
  if (brandSelect) {
    const current = brandSelect.value;
    brandSelect.innerHTML = `<option value="">All brands</option>` + brands.map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(titleCase(b))}</option>`).join("");
    if (current && brands.includes(current)) brandSelect.value = current;
  }
  renderStorageIndicator();
  renderLibrary();
  if (adminEls.traceSelect) {
    const current = adminEls.traceSelect.value;
    adminEls.traceSelect.innerHTML = `<option value="">Select a generated run</option>` +
      libraryOutputs.map((item) => `<option value="${escapeHtml(item.postId)}">${escapeHtml(item.postId)} — ${escapeHtml(titleCase(item.product || ""))}</option>`).join("");
    if (current && libraryOutputs.some((item) => item.postId === current)) adminEls.traceSelect.value = current;
  }
}

function renderStorageIndicator() {
  let bar = document.getElementById("library-storage-bar");
  if (!bar) {
    bar = document.createElement("div"); bar.id = "library-storage-bar"; bar.className = "storage-bar";
    const header = document.querySelector(".library-header");
    if (header) header.appendChild(bar);
  }
  if (!libraryStorageInfo || libraryStorageInfo.error) { bar.innerHTML = `<span class="storage-bar__text">Storage info unavailable</span>`; return; }
  const pct = Math.min(100, (libraryStorageInfo.usedBytes / libraryStorageInfo.totalBytes) * 100);
  bar.className = `storage-bar${pct > 80 ? " storage-bar--warning" : ""}`;
  bar.innerHTML = `<div class="storage-bar__track"><div class="storage-bar__fill" style="width:${pct.toFixed(1)}%"></div></div><span class="storage-bar__text">${libraryStorageInfo.usedFormatted} / ${libraryStorageInfo.totalFormatted}</span>`;
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
    (o.postId || "").toLowerCase().includes(search) || (o.product || "").toLowerCase().includes(search) || (o.caption || "").toLowerCase().includes(search)
  );
  filtered = [...filtered];
  if (librarySortMode === "date") filtered.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  else if (librarySortMode === "brand") filtered.sort((a, b) => (a.product || "").localeCompare(b.product || ""));
  else if (librarySortMode === "type") filtered.sort((a, b) => (a.workflowType || "").localeCompare(b.workflowType || ""));

  if (!filtered.length) {
    els.libraryList.innerHTML = `<p class="library-empty">${libraryOutputs.length ? "No results match your filters." : "No past generations yet. Go to Studio to make your first post."}</p>`;
    renderBulkBar(); return;
  }

  const totalCount = filtered.length;
  const visible = filtered.slice(0, libraryVisibleCount);
  els.libraryList.innerHTML = "";
  els.libraryList.className = "library-list";
  const grid = document.createElement("div"); grid.className = "library-grid";

  visible.forEach((item) => {
    const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
    const card = document.createElement("div");
    card.className = "library-card" + (librarySelectedIds.has(item.postId) ? " library-card--selected" : "");
    card.dataset.postId = item.postId;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox"; checkbox.className = "library-card__checkbox";
    checkbox.checked = librarySelectedIds.has(item.postId); checkbox.title = "Select for bulk action";
    checkbox.addEventListener("click", (e) => {
      e.stopPropagation();
      checkbox.checked ? librarySelectedIds.add(item.postId) : librarySelectedIds.delete(item.postId);
      card.classList.toggle("library-card--selected", checkbox.checked);
      renderBulkBar();
    });
    card.appendChild(checkbox);

    const thumbEl = document.createElement("div"); thumbEl.className = "library-card__thumb";
    if (item.firstAssetPath) {
      const img = document.createElement("img"); img.src = item.firstAssetPath; img.alt = item.caption || item.postId; img.loading = "lazy";
      img.onerror = () => { img.remove(); thumbEl.classList.add("library-card__thumb--placeholder"); thumbEl.innerHTML = `<span>${escapeHtml(titleCase(item.workflowType || "content"))}</span>`; };
      thumbEl.appendChild(img);
    } else { thumbEl.classList.add("library-card__thumb--placeholder"); thumbEl.innerHTML = `<span>${escapeHtml(titleCase(item.workflowType || "content"))}</span>`; }
    card.appendChild(thumbEl);

    const body = document.createElement("div"); body.className = "library-card__body";
    body.innerHTML = `
      <span class="library-card__brand">${escapeHtml(titleCase(item.product || "Unknown"))}</span>
      <span class="library-card__platform">${escapeHtml(titleCase(item.platform || ""))}</span>
      <span class="library-card__type">${escapeHtml(titleCase(item.workflowType || ""))}</span>
      ${item.content_recipe_id ? `<span class="library-card__type">${escapeHtml(titleCase(item.content_recipe_id))}</span>` : ""}
      <span class="library-card__date">${date}</span>
      <span class="library-card__slides">${item.slideCount || 0} slides</span>
      ${item.routeSummary ? `<p class="library-card__caption">${escapeHtml(item.routeSummary)}</p>` : ""}
      ${item.caption ? `<p class="library-card__caption">${escapeHtml(item.caption)}</p>` : ""}`;
    card.appendChild(body);

    const dupBtn = document.createElement("button");
    dupBtn.className = "library-card__duplicate"; dupBtn.type = "button"; dupBtn.title = "Duplicate"; dupBtn.textContent = "⧉";
    dupBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      els.studioIdeaInput.value = item.caption || "";
      const brandMatch = studioState.brands.find((b) => b.name === item.product || b.id === item.product);
      if (brandMatch) els.studioProductSelect.value = brandMatch.id;
      // switchView imported via app.js orchestrator — use event
      document.dispatchEvent(new CustomEvent("studio:switch-view", { detail: "studio" }));
    });
    card.appendChild(dupBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "library-card__delete"; delBtn.type = "button"; delBtn.title = "Delete"; delBtn.textContent = "✕";
    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete "${item.postId}"? This cannot be undone.`)) return;
      delBtn.disabled = true;
      try {
        const res = await fetch(`/api/outputs/${encodeURIComponent(item.postId)}`, { method: "DELETE" });
        if (res.ok || res.status === 204) {
          card.remove(); libraryOutputs = libraryOutputs.filter((o) => o.postId !== item.postId);
          librarySelectedIds.delete(item.postId);
          if (!libraryOutputs.length) renderLibrary();
          renderBulkBar();
          try { const sr = await fetch("/api/storage/usage"); libraryStorageInfo = await sr.json(); renderStorageIndicator(); } catch {}
        } else { alert("Failed to delete output."); delBtn.disabled = false; }
      } catch { alert("Failed to delete output."); delBtn.disabled = false; }
    });
    card.appendChild(delBtn);

    card.addEventListener("click", async () => {
      await loadOutputIntoCanvas(item.postId);
    });
    grid.appendChild(card);
  });

  els.libraryList.appendChild(grid);
  if (totalCount > libraryVisibleCount) {
    const loadMoreBtn = document.createElement("button");
    loadMoreBtn.className = "ghost-button library-load-more"; loadMoreBtn.type = "button";
    loadMoreBtn.textContent = `Load more (${totalCount - libraryVisibleCount} remaining)`;
    loadMoreBtn.addEventListener("click", () => { libraryVisibleCount += 20; renderLibrary(); });
    els.libraryList.appendChild(loadMoreBtn);
  }
  renderBulkBar();
}

function renderBulkBar() {
  let bar = document.getElementById("library-bulk-bar");
  if (librarySelectedIds.size === 0) { if (bar) bar.remove(); return; }
  if (!bar) {
    bar = document.createElement("div"); bar.id = "library-bulk-bar"; bar.className = "library-bulk-bar";
    const container = document.querySelector(".library-container");
    if (container) container.appendChild(bar);
  }
  bar.innerHTML = `
    <span class="library-bulk-bar__count">${librarySelectedIds.size} selected</span>
    <button class="primary-button library-bulk-bar__delete" type="button">Delete selected (${librarySelectedIds.size})</button>
    <button class="ghost-button library-bulk-bar__clear" type="button">Clear</button>`;
  bar.querySelector(".library-bulk-bar__delete").addEventListener("click", async () => {
    const count = librarySelectedIds.size;
    if (!confirm(`Delete ${count} item${count > 1 ? "s" : ""}? This cannot be undone.`)) return;
    const ids = [...librarySelectedIds];
    const deleteBtn = bar.querySelector(".library-bulk-bar__delete");
    deleteBtn.disabled = true; deleteBtn.textContent = "Deleting…";
    await Promise.all(ids.map((id) => fetch(`/api/outputs/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {})));
    librarySelectedIds.clear();
    await loadLibrary();
  });
  bar.querySelector(".library-bulk-bar__clear").addEventListener("click", () => { librarySelectedIds.clear(); renderLibrary(); });
}

function onFilterOrSortChange() { libraryVisibleCount = 20; librarySelectedIds.clear(); renderLibrary(); }

export function initLibraryListeners() {
  calEls.libraryBrandFilter?.addEventListener("change", onFilterOrSortChange);
  calEls.libraryPlatformFilter?.addEventListener("change", onFilterOrSortChange);
  calEls.librarySearch?.addEventListener("input", onFilterOrSortChange);
  document.getElementById("library-sort")?.addEventListener("change", onFilterOrSortChange);
}

export async function loadOutputIntoCanvas(postId) {
  let res;
  try { res = await fetch(`/api/outputs/${postId}`); } catch { showLibraryError(`Failed to load "${postId}": network error.`); return; }
  if (!res.ok) { showLibraryError(`Failed to load "${postId}": server returned ${res.status}.`); return; }
  let output;
  try { output = await res.json(); } catch { showLibraryError(`Failed to load "${postId}": invalid response data.`); return; }

  if (studioState.generatedOutput && studioState.generatedOutput.post_id !== postId) studioState._previousOutput = studioState.generatedOutput;
  studioState.generatedOutput = output;
  studioState.workflowType = output.workflow_type || "slideshow";
  studioState.selectedAsset = outputAssets(output)[0] || null;
  if (output.routing_decision) { studioState.routePreview = { decision: output.routing_decision, trace: output.routing_trace }; renderRoutePreview(); }
  document.dispatchEvent(new CustomEvent("studio:switch-view", { detail: "studio" }));
  loadOutputToEngine(output);
  showCaptionBar(output);
  renderInspectorAsset();
}

export { libraryOutputs };
