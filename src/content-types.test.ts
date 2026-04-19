import assert from "node:assert/strict";
import test from "node:test";
import fc from "fast-check";
import { generateFromBlueprint } from "./script-generator.ts";
import { resolveContentType, validateContentTypes } from "./pipeline.ts";
import { generatePepperaCarousel } from "./script-generator.ts";
import { fallbackPlanSocialPackage } from "./planner.ts";
import type {
  BrandProfile,
  ContentBrief,
  ContentTypeDefinition,
  GenerationRequest,
  Platform,
  SlideBlueprintEntry,
  SlideType,
} from "./types.ts";

// ── Shared Arbitraries ────────────────────────────────────────────────────────

const arbPlatform: fc.Arbitrary<Platform> = fc.constantFrom("instagram", "tiktok", "linkedin");

const arbSlideType: fc.Arbitrary<SlideType> = fc.constantFrom("text_only", "generated_image");

const arbBlueprintEntry: fc.Arbitrary<SlideBlueprintEntry> = fc.record({
  role: fc.stringMatching(/^[a-z_]{2,20}$/),
  type: arbSlideType,
  textFields: fc.array(fc.stringMatching(/^[a-zA-Z]{2,15}$/), { minLength: 1, maxLength: 4 }),
  imagePromptTemplate: fc.oneof(
    fc.constant(null),
    fc.string({ minLength: 3, maxLength: 80 })
  ),
  layout: fc.stringMatching(/^[a-z_]{3,20}$/),
});

const arbContentType: fc.Arbitrary<ContentTypeDefinition> = fc.record({
  id: fc.stringMatching(/^[a-z][a-z0-9-]{2,25}$/),
  name: fc.string({ minLength: 2, maxLength: 40 }),
  imageStyle: fc.string({ minLength: 5, maxLength: 100 }),
  platformTargets: fc.array(arbPlatform, { minLength: 1, maxLength: 3 }),
  slideBlueprint: fc.array(arbBlueprintEntry, { minLength: 1, maxLength: 10 }),
});

const arbContentBrief: fc.Arbitrary<ContentBrief> = fc.record({
  product: fc.string({ minLength: 1, maxLength: 20 }),
  platform: fc.constant("instagram" as Platform),
  format: fc.constant("slideshow" as const),
  pillar: fc.string({ minLength: 1, maxLength: 20 }),
  audience: fc.string({ minLength: 1, maxLength: 30 }),
  tone: fc.string({ minLength: 1, maxLength: 20 }),
  ingredients: fc.constant([]),
  goal: fc.string({ minLength: 1, maxLength: 20 }),
  idea: fc.string({ minLength: 1, maxLength: 60 }),
});

const arbBrandProfile: fc.Arbitrary<BrandProfile> = fc.record({
  id: fc.stringMatching(/^[a-z]{3,15}$/),
  name: fc.string({ minLength: 2, maxLength: 20 }),
  description: fc.string({ minLength: 5, maxLength: 60 }),
  tone: fc.string({ minLength: 3, maxLength: 30 }),
  audience: fc.string({ minLength: 3, maxLength: 30 }),
  cta: fc.string({ minLength: 3, maxLength: 30 }),
  logoPath: fc.constant(null),
  visual: fc.record({
    primaryColor: fc.constant("#333333"),
    secondaryColor: fc.constant("#cccccc"),
    accentColor: fc.constant("#f5f5f5"),
    surfaceColor: fc.constant("#ffffff"),
  }),
  defaults: fc.record({
    platformTargets: fc.constant(["instagram" as Platform]),
    goal: fc.constant("awareness"),
    hashtags: fc.constant(["#test"]),
  }),
  providers: fc.record({
    plannerModel: fc.constant("glm-4.5"),
    imageModel: fc.constant("fal-ai/flux/schnell"),
  }),
});

// ── Property 2: Blueprint-to-slides structural correctness ────────────────────
// **Validates: Requirements 8.1, 8.5, 9.1, 9.3, 9.4, 9.5**

test("[PBT] Property 2: generateFromBlueprint produces structurally correct slides", () => {
  fc.assert(
    fc.property(arbContentType, arbContentBrief, arbBrandProfile, (contentType, brief, brand) => {
      const slides = generateFromBlueprint(contentType, brief, brand);

      // (a) array length equals blueprint length
      assert.equal(slides.length, contentType.slideBlueprint.length,
        `Expected ${contentType.slideBlueprint.length} slides, got ${slides.length}`);

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        const entry = contentType.slideBlueprint[i];

        // (b) role matches
        assert.equal(slide.role, entry.role, `Slide ${i} role mismatch`);

        // (c) layout matches
        assert.equal(slide.layout, entry.layout, `Slide ${i} layout mismatch`);

        // (d) type matches
        assert.equal(slide.type, entry.type, `Slide ${i} type mismatch`);

        // (e) slide_number sequential from 1
        assert.equal(slide.slide_number, i + 1, `Slide ${i} slide_number should be ${i + 1}`);

        // (f) text_only slides have null image_prompt
        if (entry.type === "text_only") {
          assert.equal(slide.image_prompt, null, `Slide ${i} (text_only) must have null image_prompt`);
        }
      }
    }),
    { numRuns: 100 }
  );
});

// ── Property 3: ImageStyle application to image prompts ───────────────────────
// **Validates: Requirements 8.4, 9.2**

test("[PBT] Property 3: generated_image slides contain imageStyle in image_prompt", () => {
  // Use content types with non-empty imageStyle
  const arbContentTypeWithStyle = arbContentType.filter(ct => ct.imageStyle.trim().length > 0);

  fc.assert(
    fc.property(arbContentTypeWithStyle, arbContentBrief, arbBrandProfile, (contentType, brief, brand) => {
      const slides = generateFromBlueprint(contentType, brief, brand);

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        const entry = contentType.slideBlueprint[i];

        if (entry.type === "generated_image") {
          assert.ok(slide.image_prompt !== null,
            `Slide ${i} (generated_image) must have non-null image_prompt`);
          assert.ok(slide.image_prompt!.includes(contentType.imageStyle),
            `Slide ${i} image_prompt must contain imageStyle "${contentType.imageStyle}"`);
        }
      }
    }),
    { numRuns: 100 }
  );
});

// ── Property 4: Peppera recipe-carousel backward compatibility ────────────────
// **Validates: Requirements 2.6, 8.6**

test("[PBT] Property 4: Peppera recipe-carousel produces 7 slides with correct structure", () => {
  const arbPepperaBrief: fc.Arbitrary<ContentBrief> = fc.record({
    product: fc.constant("Peppera"),
    platform: fc.constant("instagram" as Platform),
    format: fc.constant("carousel" as const),
    pillar: fc.constant("pantry chaos"),
    audience: fc.constant("busy home cooks"),
    tone: fc.constant("warm, calm"),
    ingredients: fc.array(
      fc.constantFrom("eggs", "bread", "chicken", "rice", "pasta", "cheese"),
      { minLength: 1, maxLength: 4 }
    ),
    goal: fc.constant("installs"),
    idea: fc.constant("5 meals from random ingredients"),
  });

  const arbPepperaBrand: fc.Arbitrary<BrandProfile> = fc.record({
    id: fc.constant("peppera"),
    name: fc.constant("Peppera"),
    description: fc.constant("Meal planning assistant"),
    tone: fc.constant("warm, calm"),
    audience: fc.constant("busy home cooks"),
    cta: fc.constant("Download Peppera"),
    logoPath: fc.constant(null),
    visual: fc.record({
      primaryColor: fc.constant("#893516"),
      secondaryColor: fc.constant("#FFDBC9"),
      accentColor: fc.constant("#FEF8F3"),
      surfaceColor: fc.constant("#FFFFFF"),
    }),
    defaults: fc.record({
      platformTargets: fc.constant(["instagram" as Platform]),
      goal: fc.constant("installs"),
      hashtags: fc.constant(["#mealideas"]),
    }),
    providers: fc.record({
      plannerModel: fc.constant("glm-4.5"),
      imageModel: fc.constant("fal-ai/flux-pro/v1.1"),
    }),
  });

  fc.assert(
    fc.property(arbPepperaBrief, arbPepperaBrand, (brief, brand) => {
      const slides = generatePepperaCarousel(brief, brand);

      assert.equal(slides.length, 7, "must produce exactly 7 slides");

      // Expected roles
      const expectedRoles = ["hook", "recipe", "recipe", "recipe", "recipe", "recipe", "cta"];
      assert.deepEqual(slides.map(s => s.role), expectedRoles);

      // Expected types
      const expectedTypes = ["text_only", "generated_image", "generated_image", "generated_image", "generated_image", "generated_image", "text_only"];
      assert.deepEqual(slides.map(s => s.type), expectedTypes);

      // Expected layouts
      const expectedLayouts = ["hook_cover", "recipe_card", "recipe_card", "recipe_card", "recipe_card", "recipe_card", "cta_banner"];
      assert.deepEqual(slides.map(s => s.layout), expectedLayouts);

      // Sequential slide numbers
      for (let i = 0; i < slides.length; i++) {
        assert.equal(slides[i].slide_number, i + 1);
      }
    }),
    { numRuns: 100 }
  );
});

// ── Property 1: Content type config validation ────────────────────────────────
// **Validates: Requirements 1.1, 1.2, 1.3, 1.5**

test("[PBT] Property 1: validateContentTypes accepts valid configs and rejects invalid ones", () => {
  // Valid content types should all pass
  fc.assert(
    fc.property(
      fc.array(arbContentType, { minLength: 1, maxLength: 5 }),
      arbBrandProfile,
      (contentTypes, brand) => {
        const brandWithTypes = { ...brand, contentTypes };
        const valid = validateContentTypes(brandWithTypes);
        assert.equal(valid.length, contentTypes.length,
          "All valid content types should pass validation");
      }
    ),
    { numRuns: 100 }
  );
});

test("[PBT] Property 1: validateContentTypes rejects configs with missing fields", () => {
  // Generate content types with one field removed
  const arbInvalidContentType = arbContentType.map(ct => {
    const fields = ["id", "name", "imageStyle", "platformTargets", "slideBlueprint"] as const;
    const fieldToRemove = fields[Math.floor(Math.random() * fields.length)];
    const copy = { ...ct } as Record<string, unknown>;
    delete copy[fieldToRemove];
    return copy as unknown as ContentTypeDefinition;
  });

  fc.assert(
    fc.property(arbInvalidContentType, arbBrandProfile, (invalidCt, brand) => {
      const brandWithTypes = { ...brand, contentTypes: [invalidCt] };
      const valid = validateContentTypes(brandWithTypes);
      assert.equal(valid.length, 0,
        "Content type with missing required field should be rejected");
    }),
    { numRuns: 100 }
  );
});

// ── Property 7: Default content type fallback ─────────────────────────────────
// **Validates: Requirements 8.3**

test("[PBT] Property 7: resolveContentType falls back to defaultContentType when id omitted", () => {
  fc.assert(
    fc.property(
      fc.array(arbContentType, { minLength: 1, maxLength: 5 }),
      arbBrandProfile,
      (contentTypes, brand) => {
        const defaultCt = contentTypes[0];
        const brandWithTypes = {
          ...brand,
          contentTypes,
          defaultContentType: defaultCt.id,
        };
        const resolved = resolveContentType(brandWithTypes);
        assert.ok(resolved !== null, "Should resolve a content type");
        assert.equal(resolved!.id, defaultCt.id,
          "Should resolve to the default content type");
      }
    ),
    { numRuns: 100 }
  );
});

// ── Property 6: Backward compatibility without content types ──────────────────
// **Validates: Requirements 12.1, 12.2**

test("[PBT] Property 6: brands without contentTypes get null from resolveContentType", () => {
  fc.assert(
    fc.property(arbBrandProfile, (brand) => {
      // Ensure no contentTypes
      const brandWithout = { ...brand, contentTypes: undefined, defaultContentType: undefined };
      const resolved = resolveContentType(brandWithout);
      assert.equal(resolved, null,
        "Brand without contentTypes should resolve to null");
    }),
    { numRuns: 100 }
  );
});

test("[PBT] Property 6: fallback planner produces 8 slides for non-Peppera brands without contentTypes", () => {
  const arbNonPepperaBrand = arbBrandProfile.map(b => ({
    ...b,
    id: b.id === "peppera" ? "otherbrand" : b.id,
    name: b.name === "Peppera" ? "OtherBrand" : b.name,
    contentTypes: undefined,
    defaultContentType: undefined,
  }));

  const arbRequest: fc.Arbitrary<GenerationRequest> = fc.record({
    brandProfileId: fc.constant("otherbrand"),
    rawIdea: fc.string({ minLength: 5, maxLength: 60 }),
    cards: fc.constant([]),
    references: fc.constant([]),
    platformTargets: fc.constant(["instagram" as Platform]),
    goal: fc.constant("awareness"),
  });

  fc.assert(
    fc.property(arbNonPepperaBrand, arbRequest, (brand, request) => {
      const plan = fallbackPlanSocialPackage({ brand, request });
      assert.equal(plan.slides.length, 8,
        "Non-Peppera brand without contentTypes should get 8 slides");
    }),
    { numRuns: 100 }
  );
});
