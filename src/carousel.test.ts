import assert from "node:assert/strict";
import test from "node:test";
import fc from "fast-check";
import type { Slide, SlideRole, SlideLayout, SlideType, StructuredRecipe } from "./types.ts";

/**
 * Validates: Requirements 1.2, 1.3
 *
 * Property: For any Slide with role "recipe", the recipe field is defined
 * with non-empty recipeName and non-empty ingredients array.
 * For any Slide with a non-recipe role, recipe may be undefined.
 */

const nonRecipeRoles: SlideRole[] = [
  "hook", "problem", "escalation", "reaction",
  "discovery", "meal_reveal", "benefit", "cta",
];

const allRoles: SlideRole[] = [...nonRecipeRoles, "recipe"];

const slideLayouts: SlideLayout[] = [
  "hook", "statement", "image_text_split", "image_focus", "cta",
  "hook_cover", "problem_setup", "recipe_card", "cta_banner",
];

const slideTypes: SlideType[] = ["text_only", "generated_image"];

const arbStructuredRecipe: fc.Arbitrary<StructuredRecipe> = fc.record({
  recipeName: fc.string({ minLength: 1 }),
  ingredients: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 10 }),
  cookTime: fc.string({ minLength: 1 }),
  steps: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 4 }),
  proTip: fc.option(fc.string(), { nil: undefined }),
  cost: fc.option(fc.string(), { nil: undefined }),
  serves: fc.option(fc.string(), { nil: undefined }),
});

const arbRecipeSlide: fc.Arbitrary<Slide> = fc.record({
  slide_number: fc.integer({ min: 1, max: 20 }),
  role: fc.constant("recipe" as SlideRole),
  type: fc.constantFrom(...slideTypes),
  text: fc.string(),
  image_prompt: fc.option(fc.string(), { nil: null }),
  visual_goal: fc.string(),
  layout: fc.constantFrom(...slideLayouts),
  recipe: arbStructuredRecipe,
});

const arbNonRecipeSlide: fc.Arbitrary<Slide> = fc.record({
  slide_number: fc.integer({ min: 1, max: 20 }),
  role: fc.constantFrom(...nonRecipeRoles),
  type: fc.constantFrom(...slideTypes),
  text: fc.string(),
  image_prompt: fc.option(fc.string(), { nil: null }),
  visual_goal: fc.string(),
  layout: fc.constantFrom(...slideLayouts),
  recipe: fc.constant(undefined),
});

test("[PBT] recipe slides have defined recipe with non-empty recipeName and ingredients", () => {
  fc.assert(
    fc.property(arbRecipeSlide, (slide) => {
      assert.equal(slide.role, "recipe");
      assert.ok(slide.recipe !== undefined, "recipe field must be defined for recipe slides");
      assert.ok(slide.recipe!.recipeName.length > 0, "recipeName must be non-empty");
      assert.ok(slide.recipe!.ingredients.length > 0, "ingredients must be non-empty");
    }),
    { numRuns: 100 }
  );
});

test("[PBT] non-recipe slides accept undefined recipe", () => {
  fc.assert(
    fc.property(arbNonRecipeSlide, (slide) => {
      assert.notEqual(slide.role, "recipe");
      // For non-recipe roles, recipe may be undefined — this is valid
      assert.equal(slide.recipe, undefined);
    }),
    { numRuns: 100 }
  );
});

import type { ContentBrief, BrandProfile, BrandMascot } from "./types.ts";
import { generatePepperaCarousel } from "./script-generator.ts";

// ── Generators for Peppera carousel PBT tests ──────────────────────────────

const arbIngredient = fc.constantFrom(
  "eggs", "bread", "chicken", "rice", "peppers", "pasta", "cheese",
  "tomatoes", "onions", "potatoes", "butter", "milk", "garlic", "beans"
);

const arbIngredients = fc.array(arbIngredient, { minLength: 1, maxLength: 5 });

const arbMascot: fc.Arbitrary<BrandMascot> = fc.record({
  name: fc.constant("Peppera"),
  description: fc.constant("A cute green bell pepper mascot"),
  role: fc.constant("Main character"),
  visualPrompt: fc.constant(
    "A cute anthropomorphic green bell pepper character named Peppera. Round bulbous body narrowing at the top, bright lime-green skin with subtle darker green vertical ridges. Large expressive oval eyes with white sclera and small black pupils, thin curved black eyebrows, small open-mouth smile. Wears a red bandana tied around the top of the head with the knot visible on the right side. Simple thin black-stroke arms and legs with small rounded hands and feet. Flat 2D cartoon illustration style with bold outlines, vibrant saturated colors, no shading or gradients. Solid color background."
  ),
  usageRules: fc.constant([]),
  referenceImages: fc.constant([]),
});

const arbBrandProfile: fc.Arbitrary<BrandProfile> = fc.record({
  id: fc.constant("peppera"),
  name: fc.constant("Peppera"),
  description: fc.constant("Meal planning assistant"),
  tone: fc.constant("helpful, witty, clean"),
  audience: fc.constant("busy home cooks"),
  cta: fc.constant("Download Peppera"),
  logoPath: fc.constant(null),
  visual: fc.record({
    primaryColor: fc.constant("#4A7C59"),
    secondaryColor: fc.constant("#D9532F"),
    accentColor: fc.constant("#F5F5DC"),
    surfaceColor: fc.constant("#FFFFFF"),
  }),
  defaults: fc.record({
    platformTargets: fc.constant(["instagram" as const]),
    goal: fc.constant("installs"),
    hashtags: fc.constant(["#mealideas"]),
  }),
  providers: fc.record({
    plannerModel: fc.constant("glm-4.5"),
    imageModel: fc.constant("fal-ai/nano-banana-2"),
  }),
  mascot: arbMascot,
});

const arbContentBrief: fc.Arbitrary<ContentBrief> = arbIngredients.chain((ingredients) =>
  fc.record({
    product: fc.constant("Peppera"),
    platform: fc.constant("instagram" as const),
    format: fc.constant("carousel" as const),
    pillar: fc.constant("pantry chaos"),
    audience: fc.constant("UK home cooks"),
    tone: fc.constant("funny, useful, relatable"),
    ingredients: fc.constant(ingredients),
    goal: fc.constant("installs"),
    idea: fc.constant("5 meals from random ingredients"),
  })
);

/**
 * Validates: Requirement 2.1
 *
 * Property: generatePepperaCarousel always returns exactly 8 slides
 * with roles [hook, problem, recipe, recipe, recipe, recipe, recipe, cta]
 * and sequential slide_number 1–8 for any valid brief with ingredients.
 */
test("[PBT] generatePepperaCarousel returns 8 slides with correct roles and sequential numbering", () => {
  fc.assert(
    fc.property(arbContentBrief, arbBrandProfile, (brief, brand) => {
      const slides = generatePepperaCarousel(brief, brand);

      assert.equal(slides.length, 8, "must produce exactly 8 slides");

      const expectedRoles: SlideRole[] = [
        "hook", "problem", "recipe", "recipe", "recipe", "recipe", "recipe", "cta",
      ];
      const actualRoles = slides.map((s) => s.role);
      assert.deepEqual(actualRoles, expectedRoles, "roles must match expected sequence");

      for (let i = 0; i < 8; i++) {
        assert.equal(slides[i].slide_number, i + 1, `slide ${i} must have slide_number ${i + 1}`);
      }
    }),
    { numRuns: 100 }
  );
});

/**
 * Validates: Requirement 3.3
 *
 * Property: no image prompt from generatePepperaCarousel contains
 * "realistic food photography", "photo", "photograph", or "shallow depth of field"
 * (case-insensitive).
 */
test("[PBT] no image prompt contains photorealistic terms", () => {
  fc.assert(
    fc.property(arbContentBrief, arbBrandProfile, (brief, brand) => {
      const slides = generatePepperaCarousel(brief, brand);
      const forbidden = [
        "realistic food photography",
        "photo",
        "photograph",
        "shallow depth of field",
      ];

      for (const slide of slides) {
        if (slide.image_prompt) {
          const lower = slide.image_prompt.toLowerCase();
          for (const term of forbidden) {
            assert.ok(
              !lower.includes(term),
              `Slide ${slide.slide_number} image_prompt must not contain "${term}", got: "${slide.image_prompt.slice(0, 80)}..."`
            );
          }
        }
      }
    }),
    { numRuns: 100 }
  );
});

/**
 * Validates: Requirement 3.1, 3.4
 *
 * Property: for every slide with role in {hook, problem, cta}, the image_prompt
 * contains the mascot visualPrompt string or key mascot descriptors from brand config.
 */
test("[PBT] mascot slides contain mascot visualPrompt in image_prompt", () => {
  fc.assert(
    fc.property(arbContentBrief, arbBrandProfile, (brief, brand) => {
      const slides = generatePepperaCarousel(brief, brand);
      const mascotRoles: SlideRole[] = ["hook", "problem", "cta"];
      const mascotVisualPrompt = brand.mascot?.visualPrompt ?? "";

      for (const slide of slides) {
        if (mascotRoles.includes(slide.role)) {
          assert.ok(
            slide.image_prompt !== null && slide.image_prompt !== undefined,
            `Slide ${slide.slide_number} (${slide.role}) must have an image_prompt`
          );
          assert.ok(
            slide.image_prompt!.includes(mascotVisualPrompt),
            `Slide ${slide.slide_number} (${slide.role}) image_prompt must contain the mascot visualPrompt`
          );
        }
      }
    }),
    { numRuns: 100 }
  );
});

import { generateFallbackRecipes, fallbackPlanSocialPackage } from "./planner.ts";
import type { GenerationRequest } from "./types.ts";

// ── Generators for Planner PBT tests ──────────────────────────────────────────

const arbNonEmptyIngredients = fc.array(arbIngredient, { minLength: 1, maxLength: 5 });

const arbPepperaBrand: fc.Arbitrary<BrandProfile> = fc.record({
  id: fc.constant("peppera"),
  name: fc.constant("Peppera"),
  description: fc.constant("Meal planning assistant"),
  tone: fc.constant("helpful, witty, clean"),
  audience: fc.constant("busy home cooks"),
  cta: fc.constant("Download Peppera"),
  logoPath: fc.constant(null),
  visual: fc.record({
    primaryColor: fc.constant("#4A7C59"),
    secondaryColor: fc.constant("#D9532F"),
    accentColor: fc.constant("#F5F5DC"),
    surfaceColor: fc.constant("#FFFFFF"),
  }),
  defaults: fc.record({
    platformTargets: fc.constant(["instagram" as const]),
    goal: fc.constant("installs"),
    hashtags: fc.constant(["#mealideas"]),
  }),
  providers: fc.record({
    plannerModel: fc.constant("glm-4.5"),
    imageModel: fc.constant("fal-ai/nano-banana-2"),
  }),
  mascot: arbMascot,
});

const arbPepperaRequest: fc.Arbitrary<GenerationRequest> = fc.record({
  brandProfileId: fc.constant("peppera"),
  rawIdea: fc.constant("5 meals from eggs and bread"),
  cards: fc.constant([]),
  references: fc.constant([]),
  platformTargets: fc.constant(["instagram" as const]),
  goal: fc.constant("installs"),
});

/**
 * Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6
 *
 * Property: fallback planner with any non-empty ingredient list produces
 * 5 Recipe_Slides each with valid StructuredRecipe (non-empty recipeName,
 * 3–10 ingredients, non-empty cookTime, 1–4 steps).
 */
test("[PBT] fallback planner produces 5 recipe slides with valid StructuredRecipe", () => {
  fc.assert(
    fc.property(arbNonEmptyIngredients, (ingredients) => {
      const recipes = generateFallbackRecipes(ingredients);

      assert.equal(recipes.length, 5, "must produce exactly 5 recipes");

      for (let i = 0; i < recipes.length; i++) {
        const r = recipes[i];
        assert.ok(
          r.recipeName.length > 0,
          `Recipe ${i} must have non-empty recipeName`
        );
        assert.ok(
          r.ingredients.length >= 3 && r.ingredients.length <= 10,
          `Recipe ${i} must have 3–10 ingredients, got ${r.ingredients.length}`
        );
        assert.ok(
          r.cookTime.length > 0,
          `Recipe ${i} must have non-empty cookTime`
        );
        assert.ok(
          r.steps.length >= 1 && r.steps.length <= 4,
          `Recipe ${i} must have 1–4 steps, got ${r.steps.length}`
        );
      }
    }),
    { numRuns: 100 }
  );
});

/**
 * Validates: Requirements 2.4, 4.2
 *
 * Property: all 5 recipe names in a fallback-planned carousel are distinct.
 */
test("[PBT] all 5 recipe names in fallback-planned carousel are distinct", () => {
  fc.assert(
    fc.property(arbNonEmptyIngredients, (ingredients) => {
      const recipes = generateFallbackRecipes(ingredients);
      const names = recipes.map((r) => r.recipeName);
      const uniqueNames = new Set(names);

      assert.equal(
        uniqueNames.size,
        names.length,
        `All recipe names must be distinct, got: ${JSON.stringify(names)}`
      );
    }),
    { numRuns: 100 }
  );
});

// ── Template Colour Passthrough PBT ──────────────────────────────────────────

import { renderHookCoverTemplate } from "./templates/hook-cover.ts";
import { renderProblemSetupTemplate } from "./templates/problem-setup.ts";
import { renderRecipeCardTemplate } from "./templates/recipe-card.ts";
import { renderCtaBannerTemplate } from "./templates/cta-banner.ts";
import type { CarouselTemplateInput } from "./templates/types.ts";
import type { BrandVisualSettings } from "./types.ts";

// Arbitrary hex colour: #RRGGBB with uppercase hex digits (avoids collisions with common HTML words)
const arbHexColor: fc.Arbitrary<string> = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map(([r, g, b]) => `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`);

const arbBrandVisual: fc.Arbitrary<BrandVisualSettings> = fc.record({
  primaryColor: arbHexColor,
  secondaryColor: arbHexColor,
  accentColor: arbHexColor,
  surfaceColor: arbHexColor,
});

function makeTemplateInput(brandVisual: BrandVisualSettings, role: SlideRole, layout: SlideLayout): CarouselTemplateInput {
  return {
    slide: {
      slide_number: 1,
      role,
      type: "generated_image",
      text: "Test Title\nTest subtitle line",
      image_prompt: null,
      visual_goal: "test",
      layout,
      recipe: role === "recipe" ? {
        recipeName: "Test Recipe",
        ingredients: ["1 egg", "2 slices bread", "butter"],
        cookTime: "10 mins",
        steps: ["Step one", "Step two"],
        proTip: "A handy tip",
        cost: "£0.80",
        serves: "1",
      } : undefined,
    },
    productName: "Peppera",
    imageDataUrl: null,
    brandVisual,
    slideCount: 8,
  };
}

/**
 * Validates: Requirements 9.2, 9.3 (Property 8: Template Colour Passthrough)
 *
 * Property: for any BrandVisualSettings input, the HTML output of each template
 * contains the primaryColor, secondaryColor, and accentColor hex values from that input.
 */
test("[PBT] template HTML contains brand primaryColor, secondaryColor, and accentColor", () => {
  fc.assert(
    fc.property(arbBrandVisual, (brandVisual) => {
      const templates: Array<{ name: string; html: string }> = [
        { name: "hook_cover", html: renderHookCoverTemplate(makeTemplateInput(brandVisual, "hook", "hook_cover")) },
        { name: "problem_setup", html: renderProblemSetupTemplate(makeTemplateInput(brandVisual, "problem", "problem_setup")) },
        { name: "recipe_card", html: renderRecipeCardTemplate(makeTemplateInput(brandVisual, "recipe", "recipe_card")) },
        { name: "cta_banner", html: renderCtaBannerTemplate(makeTemplateInput(brandVisual, "cta", "cta_banner")) },
      ];

      for (const { name, html } of templates) {
        assert.ok(
          html.includes(brandVisual.primaryColor),
          `${name} template must contain primaryColor ${brandVisual.primaryColor}`
        );
        assert.ok(
          html.includes(brandVisual.secondaryColor),
          `${name} template must contain secondaryColor ${brandVisual.secondaryColor}`
        );
        assert.ok(
          html.includes(brandVisual.accentColor),
          `${name} template must contain accentColor ${brandVisual.accentColor}`
        );
      }
    }),
    { numRuns: 100 }
  );
});


// ── Hashtag Format PBT (Task 7.4) ──────────────────────────────────────────

/**
 * Validates: Requirement 7.4 (Property 6: Hashtag Format Invariant)
 *
 * Property: every hashtag in the fallback planner output starts with "#"
 * and contains no whitespace.
 */
test("[PBT] every hashtag in fallback planner output starts with '#' and contains no whitespace", () => {
  fc.assert(
    fc.property(arbPepperaBrand, arbPepperaRequest, (brand, request) => {
      const plan = fallbackPlanSocialPackage({ brand, request });

      assert.ok(plan.hashtags.length > 0, "hashtags array must not be empty");

      for (const tag of plan.hashtags) {
        assert.ok(
          tag.startsWith("#"),
          `Hashtag "${tag}" must start with "#"`
        );
        assert.ok(
          !/\s/.test(tag),
          `Hashtag "${tag}" must not contain whitespace`
        );
      }
    }),
    { numRuns: 100 }
  );
});
