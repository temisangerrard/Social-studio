import { els } from "./dom-refs.js";
import { studioState } from "./state.js";
import { escapeHtml } from "./app-helpers.js";
import { showStatus } from "./ui-utils.js";

export function creativeBriefSignature({ brandProfileId, platform, rawIntent }) {
  return [brandProfileId || "", platform || "", (rawIntent || "").trim()].join("::");
}

export function currentCreativeBriefSignature() {
  return creativeBriefSignature({
    brandProfileId: els.studioProductSelect?.value,
    platform: els.studioPlatformSelect?.value,
    rawIntent: els.studioIdeaInput?.value
  });
}

export function approvedCreativePlanForGeneration(state = studioState) {
  if (!state.creativeBriefApproved || !state.creativeProject) return {};
  if (state.creativeBriefSignature !== currentCreativeBriefSignature()) return {};
  return {
    creativeProjectId: state.creativeProject.id,
    creativePlan: state.creativeProject.creativePlan
  };
}

function directionCard(direction, selectedId) {
  const isSelected = direction.id === selectedId;
  return `
    <button class="creative-direction-card ${isSelected ? "is-selected" : ""}" type="button" data-direction-id="${escapeHtml(direction.id)}">
      <span class="creative-direction-card__score">${Math.round(direction.performance_score || 0)}</span>
      <strong>${escapeHtml(direction.title)}</strong>
      <span>${escapeHtml(direction.format || "")} · ${escapeHtml(direction.emotional_driver || "")}</span>
      <p>${escapeHtml(direction.angle || "")}</p>
      <small>${escapeHtml(direction.why_it_works || "")}</small>
    </button>
  `;
}

export function renderCreativeBrief(project = studioState.creativeProject) {
  if (!els.creativeBriefPanel) return;
  if (!project?.creativePlan) {
    els.creativeBriefPanel.innerHTML = `<p class="drawer-empty-hint">Enter an idea, then build a creative brief to review directions before generating.</p>`;
    els.creativeBriefActions?.classList.add("hidden");
    return;
  }

  const plan = project.creativePlan;
  const brief = plan.brief_interpretation;
  const selectedId = plan.recommended_direction_id;
  const selected = plan.proposed_directions.find((direction) => direction.id === selectedId) || plan.proposed_directions[0];
  const hooks = (plan.production_assets.headline_options || []).slice(0, 3).map((hook) => `<li>${escapeHtml(hook)}</li>`).join("");
  const beats = (plan.content_blueprint.beat_sheet || []).slice(0, 5).map((beat) => `<li>${escapeHtml(beat)}</li>`).join("");
  const flags = (plan.review_flags || []).map((flag) => `<span>${escapeHtml(flag.replace(/_/g, " "))}</span>`).join("");

  els.creativeBriefPanel.innerHTML = `
    <div class="creative-brief-summary">
      <div>
        <span class="creative-brief-summary__label">Interpreted as</span>
        <strong>${escapeHtml(brief.format)} for ${escapeHtml(brief.platform)}</strong>
        <p>${escapeHtml(brief.audience)} · ${escapeHtml(brief.tone)}</p>
      </div>
      <span class="creative-brief-summary__confidence">${Math.round((brief.confidence || 0) * 100)}%</span>
    </div>
    <div class="creative-direction-grid">
      ${(plan.proposed_directions || []).map((direction) => directionCard(direction, selectedId)).join("")}
    </div>
    <div class="creative-blueprint">
      <div>
        <span class="creative-brief-summary__label">Recommended</span>
        <strong>${escapeHtml(selected?.title || "Direction")}</strong>
        <p>${escapeHtml(plan.content_blueprint.editing_style || "")}</p>
      </div>
      <div class="creative-blueprint__lists">
        <div><span>Hooks</span><ul>${hooks}</ul></div>
        <div><span>Beats</span><ul>${beats}</ul></div>
      </div>
      ${flags ? `<div class="creative-review-flags">${flags}</div>` : ""}
    </div>
  `;
  els.creativeBriefActions?.classList.remove("hidden");
}

function setCreativeProject(project) {
  studioState.creativeProject = project;
  studioState.creativeBriefApproved = false;
  studioState.creativeBriefSignature = currentCreativeBriefSignature();
  renderCreativeBrief(project);
}

export async function buildCreativeBrief({ selectedDirectionId } = {}) {
  const rawIntent = els.studioIdeaInput?.value?.trim() || "";
  if (!rawIntent) {
    showStatus("Enter an idea first.");
    return null;
  }
  if (els.creativeBriefBuild) {
    els.creativeBriefBuild.disabled = true;
    els.creativeBriefBuild.textContent = "Thinking…";
  }
  showStatus("Building creative directions…");
  try {
    const res = await fetch("/api/creative/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandProfileId: els.studioProductSelect?.value,
        platform: els.studioPlatformSelect?.value,
        rawIntent,
        selectedDirectionId
      })
    });
    const project = await res.json();
    if (!res.ok) throw new Error(project.error || "Creative brief failed.");
    setCreativeProject(project);
    showStatus("Creative brief ready. Pick a direction or approve it.");
    return project;
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "Creative brief failed.");
    return null;
  } finally {
    if (els.creativeBriefBuild) {
      els.creativeBriefBuild.disabled = false;
      els.creativeBriefBuild.textContent = "Build brief";
    }
  }
}

export async function refineCreativeBrief() {
  const project = studioState.creativeProject;
  const feedback = els.creativeBriefFeedback?.value?.trim() || "";
  if (!project || !feedback) return null;
  if (els.creativeBriefRefine) {
    els.creativeBriefRefine.disabled = true;
    els.creativeBriefRefine.textContent = "Refining…";
  }
  try {
    const res = await fetch(`/api/creative/projects/${project.id}/refine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback })
    });
    const refined = await res.json();
    if (!res.ok) throw new Error(refined.error || "Refinement failed.");
    setCreativeProject(refined);
    els.creativeBriefFeedback.value = "";
    showStatus("Creative brief refined.");
    return refined;
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "Refinement failed.");
    return null;
  } finally {
    if (els.creativeBriefRefine) {
      els.creativeBriefRefine.disabled = false;
      els.creativeBriefRefine.textContent = "Refine";
    }
  }
}

export function approveCreativeBrief() {
  if (!studioState.creativeProject) return false;
  studioState.creativeBriefApproved = true;
  studioState.creativeBriefSignature = currentCreativeBriefSignature();
  showStatus("Creative direction approved. Generating…");
  return true;
}

export function invalidateCreativeBrief() {
  studioState.creativeBriefApproved = false;
}

export function initCreativeBriefListeners({ generateApproved } = {}) {
  els.creativeBriefBuild?.addEventListener("click", () => buildCreativeBrief());
  els.creativeBriefRefine?.addEventListener("click", () => refineCreativeBrief());
  els.creativeBriefApprove?.addEventListener("click", () => {
    if (approveCreativeBrief()) generateApproved?.();
  });
  els.creativeBriefPanel?.addEventListener("click", async (event) => {
    const card = event.target.closest("[data-direction-id]");
    if (!card) return;
    await buildCreativeBrief({ selectedDirectionId: card.dataset.directionId });
  });
}
