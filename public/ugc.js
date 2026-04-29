import { els } from "./dom-refs.js";
import { ugcState } from "./ugc-state.js";
import { buildUgcDraftRequest, buildUgcStoryboardRequest, buildUgcGenerateRequest } from "./ugc-request.js";
import { buildUgcOutputActions } from "./ugc-output.js";
import { escapeHtml } from "./app-helpers.js";
import { removeUploadFromLibrary } from "./upload-scope.js";
import { loadOutputIntoCanvas } from "./library-view.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getText(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || "";
}

function setStatus(message, isError = false) {
  if (!els.ugcStatus) return;
  els.ugcStatus.textContent = message || "";
  els.ugcStatus.classList.toggle("hidden", !message);
  els.ugcStatus.classList.toggle("assistant-status--error", !!message && isError);
}

// ── Pipeline stage controller ─────────────────────────────────────────────────

function setStage(stage) {
  ugcState.stage = stage;

  const stageMap = {
    empty: els.ugcStageEmpty,
    brief: els.ugcStageBrief,
    storyboard: els.ugcStageStoryboard,
    output: els.ugcStageOutput,
  };

  Object.entries(stageMap).forEach(([key, el]) => {
    el?.classList.toggle("hidden", key !== stage);
  });

  // Generate section is part of the storyboard stage (shown after approve)
  if (stage !== "storyboard") {
    els.ugcGenerateSection?.classList.add("hidden");
  }

  updateStepper(stage);
}

function setActiveStep(activeStep) {
  [1, 2, 3, 4].forEach((n) => {
    const el = document.getElementById(`ugc-step-${n}`);
    if (!el) return;
    el.classList.remove("ugc-step--active", "ugc-step--done", "ugc-step--pending");
    if (n < activeStep) el.classList.add("ugc-step--done");
    else if (n === activeStep) el.classList.add("ugc-step--active");
    else el.classList.add("ugc-step--pending");
  });
}

function updateStepper(stage) {
  const stepMap = { empty: 0, brief: 1, storyboard: 2, output: 4 };
  setActiveStep(stepMap[stage] ?? 0);
}

// ── Uploads ───────────────────────────────────────────────────────────────────

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
      renderUploads();
      await fetch("/api/uploads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      }).catch(() => {});
    });
  });
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

// ── Brief ─────────────────────────────────────────────────────────────────────

function renderDraft() {
  if (!ugcState.draft) return;
  const d = ugcState.draft;
  setText("ugc-script-hook", d.hook);
  setText("ugc-script-problem", d.problem);
  setText("ugc-script-product-moment", d.productMoment);
  setText("ugc-script-outcome", d.outcome);
  setText("ugc-script-cta", d.cta);
  setText("ugc-script-tone-notes", d.toneNotes);
  setText("ugc-script-full", d.fullScript);
  setText("ugc-script-beats", (d.beatSheet || []).join("\n"));
  setText("ugc-script-onscreen", (d.onScreenText || []).join("\n"));
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
    beatSheet: getText("ugc-script-beats").split("\n").map((l) => l.trim()).filter(Boolean),
    onScreenText: getText("ugc-script-onscreen").split("\n").map((l) => l.trim()).filter(Boolean)
  };
}

// ── Storyboard ────────────────────────────────────────────────────────────────

const PANEL_LABELS = [
  "Hook", "Setup", "Context",
  "Action", "Escalation", "Climax",
  "Payoff", "Resolution", "CTA"
];

function showStoryboardLoading() {
  els.ugcStoryboardLoading?.classList.remove("hidden");
  els.ugcStoryboardPreview?.classList.add("hidden");
  els.ugcStoryboardActions?.classList.add("hidden");
}

function showStoryboardPreview(storyboardUrl) {
  els.ugcStoryboardLoading?.classList.add("hidden");
  if (els.ugcStoryboardImg) els.ugcStoryboardImg.src = storyboardUrl;
  els.ugcStoryboardPreview?.classList.remove("hidden");

  const labelsEl = document.getElementById("ugc-storyboard-panel-labels");
  if (labelsEl) {
    labelsEl.innerHTML = PANEL_LABELS.map((label, i) => `
      <div class="ugc-panel-label">
        <span class="ugc-panel-label__num">${i + 1}</span>
        <span class="ugc-panel-label__text">${label}</span>
      </div>
    `).join("");
  }

  const actionsEl = document.getElementById("ugc-storyboard-actions");
  actionsEl?.classList.remove("hidden");
}

async function previewStoryboard() {
  setStage("storyboard");
  showStoryboardLoading();

  const script = collectDraftScript();
  const body = buildUgcStoryboardRequest({
    brandId: els.ugcBrandSelect?.value,
    platform: els.ugcPlatformSelect?.value,
    visualMode: els.ugcVisualMode?.value,
    script
  });

  const res = await fetch("/api/ugc/storyboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || "Storyboard generation failed.");

  ugcState.storyboard = payload;
  showStoryboardPreview(payload.storyboardUrl);
}

function approveStoryboard() {
  ugcState.storyboardApproved = true;
  setActiveStep(3); // step 2 done → step 3 active
  els.ugcGenerateSection?.classList.remove("hidden");
  els.ugcGenerateSection?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ── Output ────────────────────────────────────────────────────────────────────

function renderOutput() {
  if (!els.ugcOutput) return;
  if (!ugcState.lastOutput) {
    els.ugcOutput.innerHTML = `<p class="drawer-empty-hint">Output will appear here after generation.</p>`;
    return;
  }

  const output = ugcState.lastOutput;

  const storyboardImg = output.storyboardUrl
    ? `<div class="ugc-output__storyboard-wrap">
        <span class="ugc-brief-label">Storyboard</span>
        <img class="ugc-output__storyboard" src="${output.storyboardUrl}" alt="Storyboard grid" />
       </div>`
    : "";

  const video = output.videoUrl
    ? `<div class="ugc-output__video-wrap">
        <span class="ugc-brief-label">Video</span>
        <video class="ugc-output__video" controls playsinline src="${output.videoUrl}"></video>
       </div>`
    : "";

  const audio = output.audioUrl
    ? `<div>
        <span class="ugc-brief-label">Voiceover</span>
        <audio class="ugc-output__audio" controls src="${output.audioUrl}"></audio>
       </div>`
    : "";

  const beats = (output.script?.beatSheet || [])
    .map((beat, i) => `<li><span class="ugc-beat-num">${i + 1}</span>${escapeHtml(beat)}</li>`)
    .join("");

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
        <div class="ugc-output__header-left">
          <strong class="ugc-output__brand">${escapeHtml(output.brandName || "UGC Output")}</strong>
          <span class="ugc-output__meta">${escapeHtml(output.platform || "tiktok")} · ${escapeHtml(output.voiceId || "voice")}</span>
        </div>
        ${output.postId ? `<span class="ugc-output__id">${escapeHtml(output.postId.slice(0, 8))}</span>` : ""}
      </div>

      <div class="ugc-output__media">
        ${storyboardImg}
        ${video}
      </div>

      ${audio}

      ${output.script?.fullScript ? `
        <div class="ugc-output__script-block">
          <span class="ugc-brief-label">Full script</span>
          <p class="ugc-output__script">${escapeHtml(output.script.fullScript)}</p>
        </div>
      ` : ""}

      ${beats ? `
        <div>
          <span class="ugc-brief-label">Beat sheet</span>
          <ol class="ugc-output__beats">${beats}</ol>
        </div>
      ` : ""}

      <div class="ugc-output__actions">${actions}</div>
    </div>
  `;
}

// ── Voices ────────────────────────────────────────────────────────────────────

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

// ── Init ──────────────────────────────────────────────────────────────────────

export async function loadUgc() {
  renderUploads();
  renderOutput();
  await loadVoices();

  // Restore stage if we already have draft/output
  if (ugcState.lastOutput) {
    setStage("output");
    renderOutput();
  } else if (ugcState.draft) {
    setStage("brief");
    renderDraft();
  } else {
    setStage("empty");
  }
}

export function initUgcListeners() {
  // File uploads
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

  // Step 1 → Draft script
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
      ugcState.storyboard = null;
      ugcState.storyboardApproved = false;
      renderDraft();
      setStage("brief");
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "UGC draft failed.", true);
    } finally {
      els.ugcDraftButton.disabled = false;
    }
  });

  // Step 2 → Preview storyboard
  els.ugcStoryboardButton?.addEventListener("click", async () => {
    els.ugcStoryboardButton.disabled = true;
    setStatus("Generating storyboard…");
    try {
      await previewStoryboard();
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Storyboard failed.", true);
      setStage("brief");
    } finally {
      els.ugcStoryboardButton.disabled = false;
    }
  });

  // Storyboard → Approve
  els.ugcStoryboardApprove?.addEventListener("click", () => {
    approveStoryboard();
    setStatus("Storyboard approved. Choose a voice and generate.");
  });

  // Storyboard → Regenerate
  els.ugcStoryboardRegenerate?.addEventListener("click", async () => {
    const btn = els.ugcStoryboardRegenerate;
    btn.disabled = true;
    ugcState.storyboardApproved = false;
    els.ugcGenerateSection?.classList.add("hidden");
    setStatus("Regenerating storyboard…");
    try {
      await previewStoryboard();
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Storyboard failed.", true);
    } finally {
      btn.disabled = false;
    }
  });

  // Step 3 → Generate full UGC
  els.ugcGenerateForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("Generating UGC package…");
    els.ugcGenerateButton.disabled = true;

    setActiveStep(4); // step 3 done → step 4 (output) active

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
          uploadedAssetIds: ugcState.uploadedAssets.map((asset) => asset.id),
          storyboardPreviewId: ugcState.storyboard?.previewId
        }))
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "UGC generation failed.");
      ugcState.lastOutput = payload;
      setStage("output");
      renderOutput();
      setStatus("UGC package generated.");
      if (payload.postId) {
        document.dispatchEvent(new CustomEvent("studio:switch-view", { detail: "studio" }));
        await loadOutputIntoCanvas(payload.postId);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "UGC generation failed.", true);
      setActiveStep(3); // restore to generate step on failure
    } finally {
      els.ugcGenerateButton.disabled = false;
    }
  });
}
