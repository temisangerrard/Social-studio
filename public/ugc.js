import { els } from "./dom-refs.js";
import { ugcState } from "./ugc-state.js";
import { buildUgcDraftRequest, buildUgcGenerateRequest } from "./ugc-request.js";
import { buildUgcOutputActions } from "./ugc-output.js";

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || "";
}

function getText(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

function setStatus(message, isError = false) {
  if (!els.ugcStatus) return;
  els.ugcStatus.textContent = message || "";
  els.ugcStatus.classList.toggle("hidden", !message);
  els.ugcStatus.classList.toggle("assistant-status--error", !!message && isError);
}

function renderUploads() {
  if (!els.ugcUploadsList) return;
  if (!ugcState.uploadedAssets.length) {
    els.ugcUploadsList.innerHTML = `<p class="drawer-empty-hint">No uploaded assets yet.</p>`;
    return;
  }
  els.ugcUploadsList.innerHTML = ugcState.uploadedAssets
    .map((asset) => `<span class="reference-chip reference-chip--asset">${asset.label || asset.filename}</span>`)
    .join("");
}

function renderDraft() {
  const hasDraft = !!ugcState.draft;
  els.ugcDraftPanel?.classList.toggle("hidden", !hasDraft);
  if (!hasDraft) return;
  setText("ugc-script-hook", ugcState.draft.hook);
  setText("ugc-script-problem", ugcState.draft.problem);
  setText("ugc-script-product-moment", ugcState.draft.productMoment);
  setText("ugc-script-outcome", ugcState.draft.outcome);
  setText("ugc-script-cta", ugcState.draft.cta);
  setText("ugc-script-tone-notes", ugcState.draft.toneNotes);
  setText("ugc-script-full", ugcState.draft.fullScript);
  setText("ugc-script-beats", (ugcState.draft.beatSheet || []).join("\n"));
  setText("ugc-script-onscreen", (ugcState.draft.onScreenText || []).join("\n"));
}

function renderOutput() {
  if (!els.ugcOutput) return;
  if (!ugcState.lastOutput) {
    els.ugcOutput.innerHTML = `<p class="drawer-empty-hint">Draft a script, then generate the UGC package here.</p>`;
    return;
  }

  const output = ugcState.lastOutput;
  const video = output.videoUrl
    ? `<video class="ugc-output__video" controls playsinline src="${output.videoUrl}"></video>`
    : "";
  const audio = output.audioUrl
    ? `<audio class="ugc-output__audio" controls src="${output.audioUrl}"></audio>`
    : "";
  const beats = (output.script?.beatSheet || []).map((beat) => `<li>${beat}</li>`).join("");
  const actions = buildUgcOutputActions({
    postId: output.postId,
    platform: output.platform,
    videoUrl: output.videoUrl,
    audioUrl: output.audioUrl
  }).map((action) => `
    <a class="ghost-button ugc-output__action" href="${action.href}" ${action.download ? "download" : 'target="_blank" rel="noreferrer"'}>${action.label}</a>
  `).join("");

  els.ugcOutput.innerHTML = `
    <div class="ugc-output__card">
      <div class="ugc-output__header">
        <strong>${output.brandName || "UGC Output"}</strong>
        <span>${output.platform || "tiktok"} · ${output.voiceName || output.voiceId || "voice"}</span>
      </div>
      ${video}
      ${audio}
      <div class="ugc-output__actions">${actions}</div>
      <p class="ugc-output__script">${output.script?.fullScript || ""}</p>
      <ul class="ugc-output__beats">${beats}</ul>
    </div>
  `;
}

async function loadVoices() {
  if (!els.ugcVoiceSelect || ugcState.loadingVoices) return;
  ugcState.loadingVoices = true;
  try {
    const res = await fetch("/api/voices");
    ugcState.voices = await res.json();
    els.ugcVoiceSelect.innerHTML = ugcState.voices
      .map((voice) => `<option value="${voice.voiceId}">${voice.name}</option>`)
      .join("");
  } catch {
    els.ugcVoiceSelect.innerHTML = `<option value="mock">Mock Voice</option>`;
  } finally {
    ugcState.loadingVoices = false;
  }
}

async function handleUploads(files) {
  for (const file of Array.from(files || [])) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const res = await fetch("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, dataUrl })
    });
    const asset = await res.json();
    ugcState.uploadedAssets.push(asset);
  }
  renderUploads();
}

function collectDraftScript() {
  return {
    hook: getText("ugc-script-hook"),
    problem: getText("ugc-script-problem"),
    productMoment: getText("ugc-script-product-moment"),
    outcome: getText("ugc-script-outcome"),
    cta: getText("ugc-script-cta"),
    toneNotes: getText("ugc-script-tone-notes"),
    fullScript: getText("ugc-script-full"),
    beatSheet: getText("ugc-script-beats").split("\n").map((line) => line.trim()).filter(Boolean),
    onScreenText: getText("ugc-script-onscreen").split("\n").map((line) => line.trim()).filter(Boolean)
  };
}

export async function loadUgc() {
  renderUploads();
  renderDraft();
  renderOutput();
  await loadVoices();
}

export function initUgcListeners() {
  els.ugcAssetsInput?.addEventListener("change", async (event) => {
    setStatus("Uploading assets…");
    try {
      await handleUploads(event.target.files);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.", true);
    } finally {
      event.target.value = "";
    }
  });

  els.ugcDraftForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("Drafting script…");
    els.ugcDraftButton.disabled = true;
    try {
      const body = buildUgcDraftRequest({
        brandId: els.ugcBrandSelect?.value,
        platform: els.ugcPlatformSelect?.value,
        idea: els.ugcIdeaInput?.value,
        notes: els.ugcNotesInput?.value
      });
      const res = await fetch("/api/ugc/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "UGC draft failed.");
      ugcState.draft = payload;
      ugcState.draftApproved = true;
      renderDraft();
      setStatus("Script drafted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "UGC draft failed.", true);
    } finally {
      els.ugcDraftButton.disabled = false;
    }
  });

  els.ugcGenerateForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("Generating UGC package…");
    els.ugcGenerateButton.disabled = true;
    try {
      const res = await fetch("/api/ugc/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildUgcGenerateRequest({
          brandId: els.ugcBrandSelect?.value,
          platform: els.ugcPlatformSelect?.value,
          voiceId: els.ugcVoiceSelect?.value,
          visualMode: els.ugcVisualMode?.value,
          script: collectDraftScript(),
          uploadedAssetIds: ugcState.uploadedAssets.map((asset) => asset.id)
        }))
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "UGC generation failed.");
      ugcState.lastOutput = payload;
      renderOutput();
      setStatus("UGC package generated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "UGC generation failed.", true);
    } finally {
      els.ugcGenerateButton.disabled = false;
    }
  });
}
