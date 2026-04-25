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

const STRATEGY_LABELS = {
  ai_generated: { label: "AI Image", color: "#7c3aed" },
  asset_library: { label: "Asset Library", color: "#0369a1" },
  reusable_template: { label: "Template", color: "#15803d" },
  no_image_text_only: { label: "Text Only", color: "#64748b" }
};

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}


function listHtml(items) {
  return (items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function tagList(items) {
  return (items || []).map((t) => `<span>${escapeHtml(String(t))}</span>`).join("");
}

function strategyBadge(strategy) {
  const s = STRATEGY_LABELS[strategy] || { label: strategy, color: "#64748b" };
  return `<span class="sb-strategy-badge" style="--badge-color:${s.color}">${escapeHtml(s.label)}</span>`;
}

function storyboardSlideHtml(slide) {
  const badge = strategyBadge(slide.image_strategy);
  const hasPrompt = slide.image_strategy === "ai_generated" && slide.image_prompt;
  return `
    <div class="sb-slide">
      <div class="sb-slide__header">
        <span class="sb-slide__number">${slide.slide_number}</span>
        <span class="sb-slide__role">${escapeHtml(slide.role)}</span>
        ${badge}
      </div>
      <p class="sb-slide__copy">${escapeHtml(slide.copy || "")}</p>
      ${hasPrompt ? `<details class="sb-slide__prompt"><summary>Image prompt</summary><p>${escapeHtml(slide.image_prompt)}</p></details>` : ""}
      ${slide.visual_notes ? `<p class="sb-slide__notes">${escapeHtml(slide.visual_notes)}</p>` : ""}
    </div>
  `;
}

function directionCard(direction, selectedId) {
  const isSelected = direction.id === selectedId;
  const hookExamples = safeArray(direction.hook_examples).slice(0, 2).map((h) => `<li>${escapeHtml(h)}</li>`).join("");
  return `
    <button class="creative-direction-card ${isSelected ? "is-selected" : ""}" type="button" data-direction-id="${escapeHtml(direction.id)}">
      <div class="creative-direction-card__scores">
        <span class="creative-direction-card__score" title="Performance score">${Math.round(direction.performance_score || 0)}</span>
        ${direction.brand_fit_score ? `<span class="creative-direction-card__brand-fit">Brand ${Math.round(direction.brand_fit_score)}</span>` : ""}
      </div>
      <strong>${escapeHtml(direction.title)}</strong>
      <span class="creative-direction-card__driver">${escapeHtml(direction.emotional_driver || "")}</span>
      <p>${escapeHtml(direction.angle || "")}</p>
      ${hookExamples ? `<ul class="creative-direction-card__hooks">${hookExamples}</ul>` : ""}
    </button>
  `;
}

function variantCard(variant) {
  return `
    <div class="creative-variant-card">
      <strong>${escapeHtml(variant.label)}</strong>
      <p>${escapeHtml(variant.difference)}</p>
      <div class="creative-variant-card__adjustments">
        ${(variant.script_adjustments || []).map((a) => `<span>${escapeHtml(a)}</span>`).join("")}
        ${(variant.visual_adjustments || []).map((a) => `<span class="creative-variant-card__visual">${escapeHtml(a)}</span>`).join("")}
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
  const selectedId = plan.recommended_direction_id;
  const selected = plan.proposed_directions.find((d) => d.id === selectedId) || plan.proposed_directions[0];
  const storyboard = safeArray(plan.storyboard);
  const flags = (plan.review_flags || []).map((f) => f.replace(/_/g, " "));

  els.creativeBriefPanel.innerHTML = `
    <div class="creative-brief-summary">
      <div>
        <strong>${escapeHtml(brief.product)} · ${escapeHtml(brief.format)}</strong>
        <p>${escapeHtml(brief.audience)} · ${escapeHtml(brief.platform)}</p>
      </div>
      <span class="creative-brief-summary__confidence" title="Confidence">${Math.round((brief.confidence || 0) * 100)}%</span>
    </div>

    ${storyboard.length ? `
    <div class="sb-section">
      <div class="sb-section__header">
        <span class="creative-brief-summary__label">Storyboard</span>
        <span class="sb-section__count">${storyboard.length} slides · ${escapeHtml(selected?.title || "")}</span>
      </div>
      <div class="sb-grid">
        ${storyboard.map(storyboardSlideHtml).join("")}
      </div>
      ${plan.caption ? `
      <div class="sb-caption">
        <span class="creative-brief-summary__label">Caption</span>
        <p>${escapeHtml(plan.caption)}</p>
        ${safeArray(plan.hashtags).length ? `<p class="sb-caption__tags">${safeArray(plan.hashtags).map((t) => escapeHtml(t)).join(" ")}</p>` : ""}
      </div>` : ""}
    </div>` : ""}

    <details class="creative-brief-directions">
      <summary>
        <span class="creative-brief-summary__label">Creative Directions (${(plan.proposed_directions || []).length})</span>
      </summary>
      <div class="creative-direction-grid">
        ${(plan.proposed_directions || []).map((d) => directionCard(d, selectedId)).join("")}
      </div>
    </details>

    <details class="creative-brief-blueprint">
      <summary><span class="creative-brief-summary__label">Blueprint & Production</span></summary>
      <div class="creative-blueprint">
        <p>${escapeHtml(bp.editing_style || "")}</p>
        <div class="creative-blueprint__lists">
          <div><span>Narrative Arc</span><ul>${listHtml(bp.narrative_arc)}</ul></div>
          <div><span>Beat Sheet</span><ul>${listHtml(bp.beat_sheet)}</ul></div>
          <div><span>Creative Notes</span><ul>${listHtml(bp.creative_notes)}</ul></div>
        </div>
        <div class="creative-blueprint__meta">
          ${bp.pacing_guidance ? `<div><span class="creative-brief-summary__label">Pacing</span><p>${escapeHtml(bp.pacing_guidance)}</p></div>` : ""}
          ${bp.cta_style ? `<div><span class="creative-brief-summary__label">CTA</span><p>${escapeHtml(bp.cta_style)}</p></div>` : ""}
        </div>
      </div>
    </details>

    ${flags.length ? `<div class="creative-review-flags">${flags.map((f) => `<span>${escapeHtml(f)}</span>`).join("")}</div>` : ""}
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
