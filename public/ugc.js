import { els } from "./dom-refs.js";
import { ugcState } from "./ugc-state.js";
import { buildUgcDraftRequest, buildUgcGenerateRequest } from "./ugc-request.js";
import { buildUgcOutputActions } from "./ugc-output.js";
import { escapeHtml } from "./app-helpers.js";
import { removeUploadFromLibrary } from "./upload-scope.js";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function ugcSignature() {
  return [
    els.ugcBrandSelect?.value || "",
    els.ugcPlatformSelect?.value || "",
    els.ugcIdeaInput?.value?.trim() || ""
  ].join("::");
}

function invalidateApprovedBrief() {
  ugcState.creativeBriefApproved = false;
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
    .map((asset) => `
      <span class="reference-chip reference-chip--asset" data-upload-id="${escapeHtml(asset.id)}">
        ${escapeHtml(asset.label || asset.filename)}
        <button class="reference-chip__delete" type="button" data-delete-upload-id="${escapeHtml(asset.id)}" title="Delete upload">×</button>
      </span>
    `)
    .join("");
  els.ugcUploadsList.querySelectorAll("[data-delete-upload-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.deleteUploadId;
      removeUploadFromLibrary(ugcState, id);
      invalidateApprovedBrief();
      renderUploads();
      await fetch("/api/uploads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      }).catch(() => {});
    });
  });
}

function listHtml(items, ordered = false) {
  const tag = ordered ? "ol" : "ul";
  return `<${tag}>${safeArray(items).map((item) => `<li>${escapeHtml(String(item))}</li>`).join("")}</${tag}>`;
}

function renderBrief() {
  if (!els.ugcBriefPanel) return;
  const project = ugcState.creativeProject;
  if (!project?.creativePlan) {
    els.ugcBriefPanel.innerHTML = `<p class="drawer-empty-hint">Build a UGC brief to review directions, shot beats, hooks, and production assets before generating.</p>`;
    return;
  }

  const plan = project.creativePlan;
  const directions = safeArray(plan.proposed_directions);
  const selected = directions.find((direction) => direction.id === plan.recommended_direction_id) || directions[0];
  const bp = plan.content_blueprint || {};
  const pa = plan.production_assets || {};
  const approved = ugcState.creativeBriefApproved && ugcState.creativeBriefSignature === ugcSignature();

  els.ugcBriefPanel.innerHTML = `
    <div class="creative-brief-summary">
      <div>
        <span class="creative-brief-summary__label">UGC Direction</span>
        <strong>${escapeHtml(plan.brief_interpretation?.format || "ugc-short-video")} for ${escapeHtml(plan.brief_interpretation?.platform || "tiktok")}</strong>
        <p>${escapeHtml(plan.brief_interpretation?.tone || "")}</p>
      </div>
      <span class="creative-brief-summary__confidence">${approved ? "Approved" : `${Math.round((plan.brief_interpretation?.confidence || 0) * 100)}%`}</span>
    </div>

    <div class="creative-direction-grid">
      ${directions.map((direction) => `
        <button class="creative-direction-card ${direction.id === plan.recommended_direction_id ? "is-selected" : ""}" type="button" data-ugc-direction-id="${escapeHtml(direction.id)}">
          <span class="creative-direction-card__score">${Math.round(direction.performance_score || 0)}</span>
          <strong>${escapeHtml(direction.title || "")}</strong>
          <span>${escapeHtml(direction.emotional_driver || "")}</span>
          <p>${escapeHtml(direction.angle || "")}</p>
          <small>${escapeHtml(direction.why_it_works || "")}</small>
        </button>
      `).join("")}
    </div>

    <div class="creative-production">
      <span class="creative-brief-summary__label">Production Assets</span>
      <div class="creative-production__grid">
        ${safeArray(pa.headline_options).length ? `<div><span>Hooks</span>${listHtml(pa.headline_options)}</div>` : ""}
        ${safeArray(bp.beat_sheet).length ? `<div><span>Beat Sheet</span>${listHtml(bp.beat_sheet, true)}</div>` : ""}
        ${safeArray(pa.shot_list).length ? `<div><span>Shot List</span>${listHtml(pa.shot_list, true)}</div>` : ""}
        ${safeArray(pa.on_screen_text).length ? `<div><span>On-Screen Text</span>${listHtml(pa.on_screen_text)}</div>` : ""}
        ${safeArray(pa.script).length ? `<div><span>Script</span>${listHtml(pa.script, true)}</div>` : ""}
        ${safeArray(pa.voiceover_version).length ? `<div><span>Voiceover</span>${listHtml(pa.voiceover_version, true)}</div>` : ""}
      </div>
      ${selected ? `<div class="ugc-brief-recommended"><span class="creative-brief-summary__label">Why it works</span><p>${escapeHtml(selected.why_it_works || "")}</p></div>` : ""}
    </div>
  `;
}

function renderOutput() {
  if (!els.ugcOutput) return;
  if (!ugcState.lastOutput) {
    els.ugcOutput.innerHTML = `<p class="drawer-empty-hint">Build a brief, then generate the UGC package here.</p>`;
    return;
  }

  const output = ugcState.lastOutput;
  const video = output.videoUrl
    ? `<video class="ugc-output__video" controls playsinline src="${output.videoUrl}"></video>`
    : "";
  const audio = output.audioUrl
    ? `<audio class="ugc-output__audio" controls src="${output.audioUrl}"></audio>`
    : "";
  const beats = safeArray(output.script?.beatSheet).map((beat) => `<li>${escapeHtml(beat)}</li>`).join("");
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
        <strong>${escapeHtml(output.brandName || "UGC Output")}</strong>
        <span>${escapeHtml(output.platform || "tiktok")} · ${escapeHtml(output.voiceName || output.voiceId || "voice")}</span>
      </div>
      ${video}
      ${audio}
      <div class="ugc-output__actions">${actions}</div>
      <p class="ugc-output__script">${escapeHtml(output.script?.fullScript || "")}</p>
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

async function buildBrief({ selectedDirectionId } = {}) {
  const body = buildUgcDraftRequest({
    brandId: els.ugcBrandSelect?.value,
    platform: els.ugcPlatformSelect?.value,
    idea: els.ugcIdeaInput?.value,
    notes: els.ugcNotesInput?.value
  });
  if (!body.idea) {
    setStatus("Enter an angle or idea first.", true);
    return null;
  }
  setStatus("Building UGC brief…");
  els.ugcDraftButton.disabled = true;
  try {
    const res = await fetch("/api/creative/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandProfileId: body.brandProfileId,
        platform: body.platform,
        rawIntent: [body.idea, body.notes].filter(Boolean).join("\n"),
        selectedDirectionId
      })
    });
    const project = await res.json();
    if (!res.ok) throw new Error(project.error || "UGC brief failed.");
    ugcState.creativeProject = project;
    ugcState.creativeBriefApproved = false;
    ugcState.creativeBriefSignature = ugcSignature();
    renderBrief();
    setStatus("UGC brief ready. Review it, refine it, or generate.");
    return project;
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "UGC brief failed.", true);
    return null;
  } finally {
    els.ugcDraftButton.disabled = false;
  }
}

async function refineBrief() {
  const project = ugcState.creativeProject;
  const feedback = els.ugcBriefFeedback?.value?.trim() || "";
  if (!project || !feedback) return null;
  els.ugcBriefRefine.disabled = true;
  setStatus("Refining UGC brief…");
  try {
    const res = await fetch(`/api/creative/projects/${project.id}/refine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback })
    });
    const refined = await res.json();
    if (!res.ok) throw new Error(refined.error || "UGC brief refinement failed.");
    ugcState.creativeProject = refined;
    ugcState.creativeBriefApproved = false;
    ugcState.creativeBriefSignature = ugcSignature();
    els.ugcBriefFeedback.value = "";
    renderBrief();
    setStatus("UGC brief refined.");
    return refined;
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "UGC brief refinement failed.", true);
    return null;
  } finally {
    els.ugcBriefRefine.disabled = false;
  }
}

export async function loadUgc() {
  renderUploads();
  renderBrief();
  renderOutput();
  await loadVoices();
}

export function initUgcListeners() {
  els.ugcAssetsInput?.addEventListener("change", async (event) => {
    setStatus("Uploading assets…");
    try {
      await handleUploads(event.target.files);
      invalidateApprovedBrief();
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.", true);
    } finally {
      event.target.value = "";
    }
  });

  els.ugcBrandSelect?.addEventListener("change", () => {
    invalidateApprovedBrief();
    renderBrief();
  });
  els.ugcPlatformSelect?.addEventListener("change", () => {
    invalidateApprovedBrief();
    renderBrief();
  });
  els.ugcIdeaInput?.addEventListener("input", invalidateApprovedBrief);
  els.ugcNotesInput?.addEventListener("input", invalidateApprovedBrief);

  els.ugcDraftForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await buildBrief();
  });

  els.ugcBriefPanel?.addEventListener("click", async (event) => {
    const card = event.target.closest("[data-ugc-direction-id]");
    if (!card) return;
    await buildBrief({ selectedDirectionId: card.dataset.ugcDirectionId });
  });

  els.ugcBriefRefine?.addEventListener("click", async () => {
    await refineBrief();
  });

  els.ugcGenerateForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!ugcState.creativeProject?.creativePlan) {
      setStatus("Build a UGC brief first.", true);
      return;
    }
    setStatus("Generating UGC package…");
    els.ugcGenerateButton.disabled = true;
    try {
      const signature = ugcSignature();
      ugcState.creativeBriefApproved = true;
      ugcState.creativeBriefSignature = signature;
      const res = await fetch("/api/ugc/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildUgcGenerateRequest({
          brandId: els.ugcBrandSelect?.value,
          platform: els.ugcPlatformSelect?.value,
          voiceId: els.ugcVoiceSelect?.value,
          visualMode: els.ugcVisualMode?.value,
          creativeProjectId: ugcState.creativeProject.id,
          creativePlan: ugcState.creativeProject.creativePlan,
          uploadedAssetIds: ugcState.uploadedAssets.map((asset) => asset.id)
        }))
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "UGC generation failed.");
      ugcState.lastOutput = payload;
      renderOutput();
      renderBrief();
      setStatus("UGC package generated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "UGC generation failed.", true);
    } finally {
      els.ugcGenerateButton.disabled = false;
    }
  });
}
