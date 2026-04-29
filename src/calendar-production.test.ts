import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCalendarGenerationRequest,
  createWeeklyCalendarPlan,
  normalizeCalendarSlotInput,
  summarizeCalendarOutput,
} from "./calendar-production.ts";
import type { BrandProfile, CalendarSlot, ContentPillar } from "./types.ts";

function makeBrand(): BrandProfile {
  return {
    id: "peppera",
    name: "Peppera",
    description: "Meal planning assistant",
    tone: "useful and witty",
    audience: "busy home cooks",
    cta: "Download Peppera",
    logoPath: null,
    visual: {
      primaryColor: "#f04d23",
      secondaryColor: "#ffd9c8",
      accentColor: "#7a2413",
      surfaceColor: "#fff7f0",
    },
    defaults: {
      platformTargets: ["tiktok", "instagram"],
      goal: "installs",
      hashtags: ["#mealplanning"],
    },
    providers: {
      plannerModel: "glm-4.5",
      imageModel: "fal-ai/flux/schnell",
    },
  };
}

function makePillar(): ContentPillar {
  return {
    id: "pillar-proof",
    brandProfileId: "peppera",
    name: "Proof Posts",
    description: "Show believable outcomes from using Peppera",
    frequency: "weekly",
    platforms: ["instagram"],
    defaultTone: "specific and practical",
    exampleIdeas: ["Turn three fridge leftovers into dinner"],
    defaultWorkflowType: "slideshow",
    defaultStyleCardId: "pantry-to-plate",
    defaultContentTypeId: "recipe-carousel",
    defaultGoal: "installs",
    defaultCta: "Try Peppera tonight",
  };
}

test("normalizeCalendarSlotInput preserves production brief fields", () => {
  const slot = normalizeCalendarSlotInput({
    date: "2026-05-04",
    brandProfileId: "peppera",
    platform: "instagram",
    pillar: "pillar-proof",
    idea: "Turn leftovers into dinner",
    status: "brief_ready",
    angle: "proof",
    format: "carousel",
    audience: "busy parents",
    cta: "Download Peppera",
    workflowType: "slideshow",
    styleCardId: "pantry-to-plate",
    contentTypeId: "recipe-carousel",
    notes: "Use concrete ingredient examples",
    references: ["workspace/uploads/fridge.png"],
    tags: ["proof"],
  });

  assert.equal(slot.status, "brief_ready");
  assert.equal(slot.angle, "proof");
  assert.equal(slot.format, "carousel");
  assert.equal(slot.workflowType, "slideshow");
  assert.equal(slot.styleCardId, "pantry-to-plate");
  assert.deepEqual(slot.references, ["workspace/uploads/fridge.png"]);
});

test("buildCalendarGenerationRequest combines slot, pillar, and brand defaults", () => {
  const slot = normalizeCalendarSlotInput({
    id: "slot-1",
    date: "2026-05-04",
    brandProfileId: "peppera",
    platform: "instagram",
    pillar: "pillar-proof",
    idea: "Turn leftovers into dinner",
    status: "brief_ready",
    angle: "proof",
    format: "carousel",
    audience: "busy parents",
    cta: "Download Peppera",
    notes: "Use eggs and rice",
  });

  const request = buildCalendarGenerationRequest(slot, makeBrand(), makePillar());

  assert.equal(request.brandProfileId, "peppera");
  assert.equal(request.workflowType, "slideshow");
  assert.equal(request.contentTypeId, "recipe-carousel");
  assert.equal(request.styleControl.styleCardId, "pantry-to-plate");
  assert.equal(request.platformTargets[0], "instagram");
  assert.match(request.rawIdea, /Turn leftovers into dinner/);
  assert.match(request.rawIdea, /Pillar: Proof Posts/);
  assert.match(request.notes ?? "", /Audience: busy parents/);
  assert.equal(request.calendarSlotId, "slot-1");
});

test("createWeeklyCalendarPlan balances weekday slots across pillars and angles", () => {
  const pillars: ContentPillar[] = [
    makePillar(),
    {
      ...makePillar(),
      id: "pillar-education",
      name: "Kitchen Education",
      exampleIdeas: ["How to plan dinner before 5pm"],
      platforms: ["tiktok"],
    },
  ];

  const plan = createWeeklyCalendarPlan({
    weekDates: ["2026-05-04", "2026-05-05", "2026-05-06", "2026-05-07", "2026-05-08", "2026-05-09", "2026-05-10"],
    brandProfileId: "peppera",
    pillars,
    existingSlots: [],
  });

  assert.equal(plan.length, 5);
  assert.deepEqual(plan.map((slot) => slot.date), ["2026-05-04", "2026-05-05", "2026-05-06", "2026-05-07", "2026-05-08"]);
  assert.deepEqual(plan.map((slot) => slot.angle), ["proof", "education", "product", "opinion", "conversion"]);
  assert.ok(new Set(plan.map((slot) => slot.pillar)).size > 1);
});

test("summarizeCalendarOutput creates a slot thumbnail and review status", () => {
  const summary = summarizeCalendarOutput({
    post_id: "peppera_ig_0001",
    artifacts: [{ kind: "image", asset_path: "workspace/outputs/peppera_ig_0001/assets/generated/hero.jpg" }],
    caption: "Dinner is handled.",
  } as any);

  assert.equal(summary.outputPostId, "peppera_ig_0001");
  assert.equal(summary.status, "needs_review");
  assert.equal(summary.thumbnailUrl, "/api/assets/peppera_ig_0001/hero.jpg");
  assert.match(summary.captionPreview ?? "", /Dinner/);
});
