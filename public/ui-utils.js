import { els } from "./dom-refs.js";
import { studioState, WORKFLOW_PRESETS } from "./state.js";

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

export function showChatStatus(text) {
  if (!els.studioChatStatus) return;
  els.studioChatStatus.classList.remove("hidden");
  els.studioChatStatus.textContent = text;
}

export function hideChatStatus() {
  if (!els.studioChatStatus) return;
  els.studioChatStatus.classList.add("hidden");
}

export function setCheckpoint(step, status) {
  els.studioCheckpoints.forEach((node) => {
    if (node.dataset.step !== step) return;
    node.classList.remove("is-active", "is-done");
    if (status === "active") node.classList.add("is-active");
    if (status === "done") node.classList.add("is-done");
  });
}

export function resetCheckpoints() {
  els.studioCheckpoints.forEach((node) => node.classList.remove("is-active", "is-done"));
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

export function getWorkflowPreset(id) {
  return WORKFLOW_PRESETS.find((p) => p.id === id) || WORKFLOW_PRESETS[0];
}

export function capitalizeFirst(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}
