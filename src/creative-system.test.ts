import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCreativeSystemPrompt,
  buildCreativeSystemOutput,
  refineCreativeProject,
  GENERIC_PHRASES
} from "./creative-system.ts";
import type { BrandProfile, CreativeProjectMemory } from "./types.ts";

const peppera: BrandProfile = {
  id: "peppera",
  name: "Peppera",
  description: "A meal-planning assistant that turns rough ingredients into practical dinner ideas.",
  tone: "warm, calm, personal, lightly premium",
  audience: "busy home cooks",
  cta: "Download Peppera",
  logoPath: null,
  visual: {
    primaryColor: "#893516",
    secondaryColor: "#FFDBC9",
    accentColor: "#FEF8F3",
    surfaceColor: "#FFFFFF"
  },
  defaults: {
    platformTargets: ["tiktok", "instagram"],
    goal: "installs",
    hashtags: ["#mealideas"]
  },
  providers: {
    plannerModel: "glm-4.5",
    imageModel: "fal-ai/flux-pro/v1.1"
  },
  platformPersonality: "warm, kitchen-native, a little chaotic but useful",
  contentPillars: ["pantry rescue", "busy weeknight dinners", "anti-takeout"],
  bannedPhrases: ["unlock", "game changer", "revolutionize"]
};

const settley: BrandProfile = {
  ...peppera,
  id: "settley",
  name: "Settley",
  description: "Tokenised real estate platform for fractional property ownership.",
  tone: "authoritative, clear, trustworthy, premium",
  audience: "retail investors and property-curious millennials",
  cta: "Invest in Property",
  platformPersonality: "premium, calm, category-defining, trust-led",
  contentPillars: ["real-world assets", "property access", "market education"]
};

test("creative system expands sparse Peppera input into strategy, blueprint, assets, variants, and critique", () => {
  const output = buildCreativeSystemOutput({
    brand: peppera,
    rawIntent: "Peppera pantry meals but chaotic",
    platform: "tiktok"
  });

  assert.equal(output.brief_interpretation.product, "Peppera");
  assert.equal(output.brief_interpretation.platform, "tiktok");
  assert.match(output.brief_interpretation.tone, /chaotic|warm|personal/i);
  assert.ok(output.proposed_directions.length >= 3);
  assert.ok(output.proposed_directions.some((direction) => /food but no food|pantry|takeout|chaotic/i.test(`${direction.title} ${direction.angle}`)));
  assert.ok(output.recommended_direction_id);
  assert.ok(output.content_blueprint.beat_sheet.length >= 4);
  assert.ok(output.production_assets.shot_list.length > 0);
  assert.ok(output.production_assets.image_prompts.length > 0);
  assert.ok(output.variants.some((variant) => variant.label === "bolder / more viral"));
});

test("creative system infers premium thought leadership for Settley from sparse input", () => {
  const output = buildCreativeSystemOutput({
    brand: settley,
    rawIntent: "Settley serious thought leadership slides"
  });

  assert.equal(output.brief_interpretation.product, "Settley");
  assert.match(output.brief_interpretation.format, /thought|carousel|leadership/i);
  assert.match(output.brief_interpretation.tone, /premium|authoritative|serious/i);
  assert.ok(output.proposed_directions.some((direction) => /category|market|trust|why now|asset/i.test(`${direction.title} ${direction.angle}`)));
  assert.ok(output.production_assets.slide_plan.length >= 4);
});

test("creative system flags and avoids generic banned phrases", () => {
  const output = buildCreativeSystemOutput({
    brand: peppera,
    rawIntent: "Write a seamless game changer ad that helps users discover perfect hidden meals"
  });

  assert.ok(output.review_flags.includes("too_generic"));
  const serialised = JSON.stringify(output).toLowerCase();
  for (const phrase of GENERIC_PHRASES) {
    assert.equal(serialised.includes(phrase), false, `output should avoid "${phrase}"`);
  }
});

test("creative system prompt embeds brand profile, storyboard schema, and generation rules", () => {
  const fallback = buildCreativeSystemOutput({
    brand: peppera,
    rawIntent: "Peppera pantry meals but chaotic",
    platform: "tiktok"
  });
  const prompt = buildCreativeSystemPrompt({
    brand: peppera,
    rawIntent: "Peppera pantry meals but chaotic",
    platform: "tiktok"
  }, fallback);

  assert.match(prompt, /Creative Director/);
  assert.match(prompt, /slide-by-slide storyboard/);
  assert.match(prompt, /image_strategy/);
  assert.match(prompt, /ai_generated/);
  assert.match(prompt, /Return JSON only/);
  assert.match(prompt, /proposed_directions/);
  assert.match(prompt, /Peppera/);
  assert.match(prompt, /busy home cooks/);
});

test("refinement updates the intended layer without losing chosen direction memory", () => {
  const initial = buildCreativeSystemOutput({
    brand: peppera,
    rawIntent: "Peppera pantry meals but chaotic",
    platform: "tiktok"
  });
  const memory: CreativeProjectMemory = {
    id: "creative-1",
    brandProfileId: "peppera",
    rawIntent: "Peppera pantry meals but chaotic",
    selectedDirectionId: initial.recommended_direction_id,
    creativePlan: initial,
    refinementNotes: [],
    createdAt: "2026-04-23T09:00:00.000Z",
    updatedAt: "2026-04-23T09:00:00.000Z"
  };

  const refined = refineCreativeProject(memory, "less ad-like, make it funnier and more native");

  assert.equal(refined.selectedDirectionId, memory.selectedDirectionId);
  assert.ok(refined.refinementNotes.at(-1)?.includes("less ad-like"));
  assert.match(refined.creativePlan.content_blueprint.editing_style, /native|funnier|less ad-like/i);
  assert.ok(refined.creativePlan.review_flags.includes("refined"));
});
