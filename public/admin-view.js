import { adminEls } from "./dom-refs.js";
import { loadLibrary } from "./library-view.js";

export async function loadAdmin() {
  try {
    const treeRes = await fetch("/api/admin/routing-tree");
    const treePayload = await treeRes.json();
    adminEls.routingTree.textContent = treePayload.tree || "Routing tree unavailable.";
  } catch {
    adminEls.routingTree.textContent = "Routing tree unavailable.";
  }
  // Ensure library outputs are loaded so trace select is populated
  await loadLibrary();
  if (!adminEls.traceSelect.value) {
    adminEls.routingTrace.textContent = "Select a run to inspect its routing trace.";
  }
}

export function initAdminListeners() {
  adminEls.traceSelect?.addEventListener("change", async () => {
    const postId = adminEls.traceSelect.value;
    if (!postId) { adminEls.routingTrace.textContent = "Select a run to inspect its routing trace."; return; }
    adminEls.routingTrace.textContent = "Loading trace…";
    try {
      const res = await fetch(`/api/outputs/${encodeURIComponent(postId)}/routing-trace`);
      const payload = await res.json();
      adminEls.routingTrace.textContent = JSON.stringify(payload, null, 2);
    } catch { adminEls.routingTrace.textContent = "Failed to load routing trace."; }
  });
}
