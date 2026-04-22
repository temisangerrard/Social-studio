import { els } from "./dom-refs.js";
import { studioState } from "./state.js";

export function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function getBrandById(id) {
  return studioState.brands.find((b) => b.id === id) || null;
}

export function showStatus(text) {
  els.studioStatus.classList.remove("hidden");
  els.studioStatus.textContent = text;
}

export function hideStatus() {
  els.studioStatus.classList.add("hidden");
}

export function showCanvasProgress(text) {
  els.canvasProgressText.textContent = text;
  els.canvasProgressPill.classList.remove("hidden");
}

export function hideCanvasProgress() {
  els.canvasProgressPill.classList.add("hidden");
}

export function setButtonLoading(btn, text) {
  btn.disabled = true;
  btn.dataset.origText = btn.textContent.trim();
  btn.textContent = text;
  btn.classList.add("is-loading");
}

export function clearButtonLoading(btn) {
  btn.disabled = false;
  if (btn.dataset.origText) btn.textContent = btn.dataset.origText;
  btn.classList.remove("is-loading");
  delete btn.dataset.origText;
}

export async function copyText(value, label) {
  if (!value) return;
  await navigator.clipboard.writeText(value);
  showStatus(`${label} copied.`);
  setTimeout(() => hideStatus(), 1400);
}

export function capitalizeFirst(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}
