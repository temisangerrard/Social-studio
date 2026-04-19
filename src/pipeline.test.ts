import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { brandProfileFromBrief, resolveContentType, runPipelineFromRequest, validateContentTypes } from "./pipeline.ts";
import type { BrandProfile, ContentTypeDefinition, GenerationRequest, PlannedPackage, Slide } from "./types.ts";

function makeRequest(): GenerationRequest {
  return {
    brandProfileId: "peppera",
    rawIdea: "Leftovers to dinner in minutes",
    notes: "Relatable and fast.",
    cards: [],
    references: [],
    platformTargets: ["tiktok"],
    goal: "Get more installs"
  };
}

function makeBrand(): BrandProfile {
  return brandProfileFromBrief({
    product: "Peppera",
    platform: "tiktok",
    format: "slideshow",
    pillar: "weeknight meals",
    audience: "Busy home cooks",
    tone: "Relatable and useful",
    goal: "Get more installs",
    idea: "Leftovers to dinner in minutes",
    ingredients: []
  });
}

function makeSlides(): Slide[] {
  return [
    {
      slide_number: 1,
      role: "hook",
      type: "generated_image",
      text: "You already have dinner in the fridge",
      image_prompt: "Fridge leftovers becoming dinner",
      visual_goal: "Show leftover ingredients with promise",
      layout: "image_focus",
      asset_path: null
    }
  ];
}

test("pipeline still writes metadata when slide rendering fails", async () => {
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "social-studio-pipeline-"));
  const request = makeRequest();
  const brand = makeBrand();
  const slides = makeSlides();
  const assetPath = path.join(outputRoot, "placeholder.svg");
  await fs.writeFile(assetPath, "<svg xmlns='http://www.w3.org/2000/svg'></svg>", "utf8");

  const plan: PlannedPackage = {
    hooks: ["Stop staring at random leftovers"],
    caption: "Turn leftovers into dinner with Peppera.",
    hashtags: ["#peppera", "#dinnerideas"],
    platformNotes: {
      tiktok: "Keep the opening fast."
    },
    slides
  };

  const metadata = await runPipelineFromRequest(request, brand, outputRoot, {
    planPackage: async () => ({ plan, provider: "fallback" }),
    generateSlideImages: async (inputSlides) =>
      inputSlides.map((slide) => ({
        ...slide,
        asset_path: assetPath
      })),
    renderPackageSlides: async () => {
      throw new Error("Renderer unavailable");
    }
  });

  assert.equal(metadata.render_status, "skipped");
  assert.match(metadata.render_error ?? "", /Renderer unavailable/);

  const postDir = path.join(outputRoot, metadata.post_id);
  const savedMetadata = JSON.parse(await fs.readFile(path.join(postDir, "metadata.json"), "utf8"));
  const caption = await fs.readFile(path.join(postDir, "caption.txt"), "utf8");
  const hooks = await fs.readFile(path.join(postDir, "hooks.txt"), "utf8");

  assert.equal(savedMetadata.render_status, "skipped");
  assert.match(savedMetadata.render_error, /Renderer unavailable/);
  assert.match(caption, /Peppera/);
  assert.match(hooks, /leftovers/i);
});


// ── resolveContentType tests ──────────────────────────────────────────────────

function makeBrandWithContentTypes(): BrandProfile {
  return {
    ...makeBrand(),
    defaultContentType: "recipe-carousel",
    contentTypes: [
      {
        id: "recipe-carousel",
        name: "Recipe Carousel",
        imageStyle: "food photography",
        platformTargets: ["instagram"],
        slideBlueprint: [
          { role: "hook", type: "text_only", textFields: ["title"], imagePromptTemplate: null, layout: "hook_cover" },
          { role: "recipe", type: "generated_image", textFields: ["recipeName"], imagePromptTemplate: "Food photo of {recipeName}", layout: "recipe_card" },
          { role: "cta", type: "text_only", textFields: ["headline"], imagePromptTemplate: null, layout: "cta_banner" }
        ]
      },
      {
        id: "single-recipe",
        name: "Single Recipe",
        imageStyle: "hero food shot",
        platformTargets: ["instagram"],
        slideBlueprint: [
          { role: "recipe", type: "generated_image", textFields: ["recipeName"], imagePromptTemplate: "Hero food photo", layout: "recipe_card" }
        ]
      }
    ]
  };
}

test("resolveContentType returns matching content type by id", () => {
  const brand = makeBrandWithContentTypes();
  const result = resolveContentType(brand, "single-recipe");
  assert.equal(result?.id, "single-recipe");
});

test("resolveContentType falls back to defaultContentType when id omitted", () => {
  const brand = makeBrandWithContentTypes();
  const result = resolveContentType(brand);
  assert.equal(result?.id, "recipe-carousel");
});

test("resolveContentType returns null when brand has no contentTypes", () => {
  const brand = makeBrand();
  const result = resolveContentType(brand);
  assert.equal(result, null);
});

test("resolveContentType falls back when contentTypeId doesn't match", () => {
  const brand = makeBrandWithContentTypes();
  const result = resolveContentType(brand, "nonexistent");
  assert.equal(result?.id, "recipe-carousel");
});

test("validateContentTypes skips invalid entries", () => {
  const brand: BrandProfile = {
    ...makeBrand(),
    contentTypes: [
      {
        id: "valid",
        name: "Valid",
        imageStyle: "test",
        platformTargets: ["instagram"],
        slideBlueprint: [
          { role: "hook", type: "text_only", textFields: ["title"], imagePromptTemplate: null, layout: "hook_cover" }
        ]
      },
      { id: "invalid" } as any // missing required fields
    ]
  };
  const valid = validateContentTypes(brand);
  assert.equal(valid.length, 1);
  assert.equal(valid[0].id, "valid");
});
