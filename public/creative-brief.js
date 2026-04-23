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

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function listHtml(items) {
  return safeArray(items).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function tagList(items) {
  return safeArray(items).map((t) => `<span>${escapeHtml(String(t))}</span>`).join("");
}

function directionCard(direction, selectedId) {
  const isSelected = direction.id === selectedId;
  const platforms = tagList(direction.recommended_platform_fit);
  const hookExamples = safeArray(direction.hook_examples).slice(0, 2).map((h) => `<li>${escapeHtml(h)}</li>`).join("");
  return `
    <button class="creative-direction-card ${isSelected ? "is-selected" : ""}" type="button" data-direction-id="${escapeHtml(direction.id)}">
      <span class="creative-direction-card__score">${Math.round(direction.performance_score || 0)}</span>
      <strong>${escapeHtml(direction.title)}</strong>
      <span>${escapeHtml(direction.format || "")} · ${escapeHtml(direction.emotional_driver || "")}</span>
      <p>${escapeHtml(direction.angle || "")}</p>
      <small>${escapeHtml(direction.why_it_works || "")}</small>
      ${direction.visual_style ? `<span class="creative-direction-card__meta">${escapeHtml(direction.visual_style)}</span>` : ""}
      ${direction.hook_style ? `<span class="creative-direction-card__meta">${escapeHtml(direction.hook_style)}</span>` : ""}
      ${hookExamples ? `<ul class="creative-direction-card__hooks">${hookExamples}</ul>` : ""}
      <div class="creative-direction-card__footer">
        ${platforms ? `<span class="creative-direction-card__platforms">${platforms}</span>` : ""}
        ${direction.brand_fit_score ? `<span class="creative-direction-card__brand-fit">Brand fit ${Math.round(direction.brand_fit_score)}</span>` : ""}
      </div>
    </button>
  `;
}

function variantCard(variant) {
  return `
    <div class="creative-variant-card">
      <strong>${escapeHtml(variant.label)}</strong>
      <p>${escapeHtml(variant.difference)}</p>
      <div class="creative-variant-card__adjustments">
        ${safeArray(variant.script_adjustments).map((a) => `<span>${escapeHtml(a)}</span>`).join("")}
        ${safeArray(variant.visual_adjustments).map((a) => `<span class="creative-variant-card__visual">${escapeHtml(a)}</span>`).join("")}
      </div>
    </div>
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
  const bp = plan.content_blueprint;
  const pa = plan.production_assets;
  const selectedId = plan.recommended_direction_id;
  const selected = plan.proposed_directions.find((d) => d.id === selectedId) || plan.proposed_directions[0];
  const flags = tagList((plan.review_flags || []).map((f) => f.replace(/_/g, " ")));

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
      ${(plan.proposed_directions || []).map((d) => directionCard(d, selectedId)).join("")}
    </div>

    <div class="creative-blueprint">
      <div>
        <span class="creative-brief-summary__label">Recommended</span>
        <strong>${escapeHtml(selected?.title || "Direction")}</strong>
        <p>${escapeHtml(bp.editing_style || "")}</p>
      </div>

      <div class="creative-blueprint__lists">
        <div><span>Narrative Arc</span><ul>${listHtml(bp.narrative_arc)}</ul></div>
        <div><span>Beats</span><ul>${listHtml(bp.beat_sheet)}</ul></div>
        <div><span>Creative Notes</span><ul>${listHtml(bp.creative_notes)}</ul></div>
      </div>

      <div class="creative-blueprint__meta">
        ${bp.pacing_guidance ? `<div><span class="creative-brief-summary__label">Pacing</span><p>${escapeHtml(bp.pacing_guidance)}</p></div>` : ""}
        ${bp.cta_style ? `<div><span class="creative-brief-summary__label">CTA Style</span><p>${escapeHtml(bp.cta_style)}</p></div>` : ""}
        ${bp.on_screen_text_strategy ? `<div><span class="creative-brief-summary__label">On-Screen Text</span><p>${escapeHtml(bp.on_screen_text_strategy)}</p></div>` : ""}
      </div>

      ${flags ? `<div class="creative-review-flags">${flags}</div>` : ""}
    </div>

    <div class="creative-production">
      <span class="creative-brief-summary__label">Production Assets</span>
      <div class="creative-production__grid">
        ${pa.script?.length ? `<div><span>Script</span><ol>${listHtml(pa.script)}</ol></div>` : ""}
        ${pa.shot_list?.length ? `<div><span>Shot List</span><ol>${listHtml(pa.shot_list)}</ol></div>` : ""}
        ${pa.caption_options?.length ? `<div><span>Captions</span><ul>${listHtml(pa.caption_options)}</ul></div>` : ""}
        ${pa.image_prompts?.length ? `<div><span>Image Prompts</span><ul>${listHtml(pa.image_prompts)}</ul></div>` : ""}
        ${pa.slide_plan?.length ? `<div><span>Slide Plan</span><ol>${listHtml(pa.slide_plan)}</ol></div>` : ""}
        ${pa.voiceover_version?.length ? `<div><span>Voiceover</span><ol>${listHtml(pa.voiceover_version)}</ol></div>` : ""}
        ${pa.headline_options?.length ? `<div><span>Hooks</span><ul>${listHtml(pa.headline_options)}</ul></div>` : ""}
      </div>
    </div>

    ${(plan.variants || []).length ? `
    <div class="creative-variants">
      <span class="creative-brief-summary__label">Variants</span>
      <div class="creative-variants__grid">
        ${plan.variants.map(variantCard).join("")}
      </div>
    </div>` : ""}
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
