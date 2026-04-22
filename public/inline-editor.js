// ── InlineEditor ──────────────────────────────────────────────────────────────
export const InlineEditor = (() => {
  let activeElement = null;
  let previousValue = "";
  let options = {};

  function activate(element, opts = {}) {
    if (activeElement) deactivate(activeElement);
    activeElement = element;
    options = opts;
    previousValue = element.textContent;
    element.contentEditable = "true";
    element.classList.add("canvas-inline-editing");
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    element.addEventListener("blur", handleBlur);
    element.addEventListener("keydown", handleKeydown);
    element.addEventListener("paste", handlePaste);
  }

  function deactivate(element) {
    if (!element) return "";
    element.contentEditable = "false";
    element.classList.remove("canvas-inline-editing");
    element.removeEventListener("blur", handleBlur);
    element.removeEventListener("keydown", handleKeydown);
    element.removeEventListener("paste", handlePaste);
    const text = element.textContent;
    activeElement = null;
    return text;
  }

  function handleBlur() {
    if (!activeElement) return;
    const el = activeElement;
    const text = deactivate(el);
    if (options.required && !text.trim()) { el.textContent = previousValue; return; }
    if (options.onCommit) options.onCommit(text);
  }

  function handleKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      const el = activeElement;
      el.textContent = previousValue;
      deactivate(el);
      if (options.onCancel) options.onCancel();
      return;
    }
    if (e.key === "Enter" && !options.multiline) { e.preventDefault(); handleBlur(); }
  }

  function handlePaste(e) {
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
  }

  function isActive() { return activeElement !== null; }

  return { activate, deactivate, isActive };
})();

// ── Patch / save indicator ────────────────────────────────────────────────────
let patchTimer = null;
let pendingPatch = {};

export function schedulePatch(postId, partial) {
  Object.assign(pendingPatch, partial);
  if (patchTimer) clearTimeout(patchTimer);
  showSaveIndicator("saving");
  patchTimer = setTimeout(() => flushPatch(postId), 2000);
}

async function flushPatch(postId) {
  if (!postId || Object.keys(pendingPatch).length === 0) return;
  const body = { ...pendingPatch };
  pendingPatch = {};
  patchTimer = null;
  try {
    const res = await fetch(`/api/outputs/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (res.status === 404) { showSaveIndicator("error"); return; }
    if (!res.ok) throw new Error("PATCH failed");
    showSaveIndicator("saved");
  } catch {
    showSaveIndicator("warning");
    Object.assign(pendingPatch, body);
  }
}

function showSaveIndicator(state) {
  let indicator = document.querySelector(".canvas-save-indicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.className = "canvas-save-indicator";
    const toolbar = document.getElementById("studio-quick-form");
    if (toolbar) toolbar.parentElement.insertBefore(indicator, toolbar);
  }
  indicator.classList.remove("canvas-save-indicator--warning", "canvas-save-indicator--error", "canvas-save-indicator--saved");
  if (state === "saved") {
    indicator.textContent = "✓ Saved"; indicator.classList.add("canvas-save-indicator--saved");
    setTimeout(() => { indicator.textContent = ""; }, 2000);
  } else if (state === "warning") {
    indicator.textContent = "⚠ Unsaved changes"; indicator.classList.add("canvas-save-indicator--warning");
  } else if (state === "error") {
    indicator.textContent = "✕ Output no longer exists"; indicator.classList.add("canvas-save-indicator--error");
  } else if (state === "saving") {
    indicator.textContent = "…";
  }
}
