import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildCreativeSystemOutput } from "./creative-system.ts";
import { brandProfileFromBrief, resolveContentType, runPipelineFromRequest, validateContentTypes } from "./pipeline.ts";
import type { AssetAnalysis, BrandProfile, ContentRecipeDefinition, ContentTypeDefinition, GenerationRequest, PlannedPackage, Slide, UploadedAsset } from "./types.ts";

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

function makeUploadedAsset(): UploadedAsset {
  return {
    id: "asset-1",
    filename: "leftover-pasta.jpg",
    mimeType: "image/jpeg",
    url: "/api/uploads/leftover-pasta.jpg",
    label: "Leftover pasta"
  };
}

function makeAssetAnalysis(): AssetAnalysis {
  return {
    assetId: "asset-1",
    assetType: "food_photo",
    subjectSummary: "A bowl of pasta",
    contentHints: ["recipe", "carousel"],
    channelHints: ["instagram"],
    confidence: 0.92,
    needsUserConfirmation: false,
    source: "fallback"
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

function makeBrandWithRecipes(): BrandProfile {
  const brand = makeBrand();
  const contentRecipes: ContentRecipeDefinition[] = [
    {
      id: "recipe",
      name: "Recipe",
      routeFamily: "recipe",
      workflowType: "slideshow",
      platformTargets: ["instagram", "tiktok"],
      defaultPriority: 100,
      preferredAssetTypes: ["food_photo"],
      contentTypeId: "recipe-carousel"
    }
  ];
  return {
    ...brand,
    contentRecipes,
    contentTypes: [
      {
        id: "recipe-carousel",
        name: "Recipe Carousel",
        imageStyle: "food photography",
        platformTargets: ["instagram", "tiktok"],
        slideBlueprint: [
          { role: "hook", type: "text_only", textFields: ["title"], imagePromptTemplate: null, layout: "hook_cover" },
          { role: "recipe", type: "generated_image", textFields: ["recipeName"], imagePromptTemplate: "Food photo of {recipeName}", layout: "recipe_card" },
          { role: "cta", type: "text_only", textFields: ["headline"], imagePromptTemplate: null, layout: "cta_banner" }
        ]
      }
    ]
  };
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

test("pipeline metadata includes routing decision and trace", async () => {
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "social-studio-routing-"));
  const assetPath = path.join(outputRoot, "placeholder.svg");
  await fs.writeFile(assetPath, "<svg xmlns='http://www.w3.org/2000/svg'></svg>", "utf8");

  const metadata = await runPipelineFromRequest(
    {
      ...makeRequest(),
      platformTargets: ["instagram"],
      uploadedAssets: [makeUploadedAsset()],
      assetAnalyses: [makeAssetAnalysis()],
      rawIdea: "Turn this food photo into a recipe carousel"
    },
    makeBrandWithRecipes(),
    outputRoot,
    {
      planPackage: async () => ({
        provider: "fallback",
        plan: {
          hooks: ["Turn leftovers into dinner"],
          caption: "Recipe caption",
          hashtags: ["#recipe"],
          platformNotes: { instagram: "keep it clear" },
          slides: makeSlides()
        }
      }),
      generateSlideImages: async (inputSlides) => inputSlides.map((slide) => ({ ...slide, asset_path: assetPath })),
      renderPackageSlides: async () => []
    }
  );

  assert.equal(metadata.content_recipe_id, "recipe");
  assert.equal(metadata.routing_decision?.routeFamily, "recipe");
  assert.equal(metadata.routing_trace?.decision.recipeId, "recipe");
  assert.equal(metadata.asset_analyses?.[0].assetType, "food_photo");
});

test("pipeline uses li post-id prefix for linkedin generations", async () => {
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "social-studio-linkedin-"));
  const metadata = await runPipelineFromRequest(
    {
      ...makeRequest(),
      platformTargets: ["linkedin"],
      rawIdea: "Write a LinkedIn post from this screenshot",
      uploadedAssets: [makeUploadedAsset()],
      assetAnalyses: [
        {
          ...makeAssetAnalysis(),
          assetType: "screenshot",
          contentHints: ["linkedin-post"],
          channelHints: ["linkedin"]
        }
      ]
    },
    {
      ...makeBrandWithRecipes(),
      contentRecipes: [
        {
          id: "linkedin-post",
          name: "LinkedIn Post",
          routeFamily: "linkedin-post",
          workflowType: "linkedin-text",
          platformTargets: ["linkedin"],
          defaultPriority: 120,
          preferredAssetTypes: ["screenshot"]
        }
      ]
    },
    outputRoot,
    {
      planPackage: async () => ({
        provider: "fallback",
        plan: {
          hooks: ["LinkedIn hook"],
          caption: "LinkedIn caption",
          hashtags: ["#linkedin"],
          platformNotes: { linkedin: "text only" },
          slides: []
        }
      }),
      generateSlideImages: async () => [],
      renderPackageSlides: async () => []
    }
  );

  assert.match(metadata.post_id, /_li_/);
  assert.equal(metadata.workflow_type, "linkedin-text");
});

test("pipeline persists creative project memory on generated metadata", async () => {
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "social-studio-creative-"));
  const brand = makeBrand();
  const creativePlan = buildCreativeSystemOutput({
    brand,
    rawIntent: "Peppera pantry meals but chaotic UGC",
    platform: "tiktok"
  });

  const metadata = await runPipelineFromRequest(
    {
      ...makeRequest(),
      rawIdea: "Peppera pantry meals but chaotic UGC",
      workflowType: "slideshow",
      creativeProjectId: "creative-01",
      creativePlan,
      styleControl: { styleCardId: "editorial-bite", generationMode: "text-first" }
    },
    brand,
    outputRoot,
    {
      planPackage: async ({ request }) => ({
        provider: "fallback",
        plan: {
          hooks: request.creativePlan?.production_assets.headline_options.slice(0, 3) ?? ["fallback"],
          caption: request.creativePlan?.production_assets.caption_options[0] ?? "fallback",
          hashtags: ["#ugc"],
          platformNotes: { tiktok: "creative plan aware" },
          slides: makeSlides()
        }
      }),
      generateSlideImages: async () => [],
      renderPackageSlides: async () => []
    }
  );

  assert.equal(metadata.creative_project_id, "creative-01");
  assert.equal(metadata.creative_plan?.recommended_direction_id, creativePlan.recommended_direction_id);

  const savedMetadata = JSON.parse(await fs.readFile(path.join(outputRoot, metadata.post_id, "metadata.json"), "utf8"));
  assert.equal(savedMetadata.creative_project_id, "creative-01");
  assert.equal(savedMetadata.creative_plan.recommended_direction_id, creativePlan.recommended_direction_id);
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


// ── Task 4.3: Artifact slide_number and id validation ─────────────────────────

test("pipeline artifacts have numeric slide_number >= 1 and id without 'undefined'", async () => {
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "social-studio-artifact-check-"));
  const assetPath = path.join(outputRoot, "placeholder.svg");
  await fs.writeFile(assetPath, "<svg xmlns='http://www.w3.org/2000/svg'></svg>", "utf8");

  const metadata = await runPipelineFromRequest(
    makeRequest(),
    makeBrand(),
    outputRoot,
    {
      planPackage: async () => ({
        provider: "fallback",
        plan: {
          hooks: ["Hook line"],
          caption: "Caption text",
          hashtags: ["#test"],
          platformNotes: { tiktok: "fast" },
          // Deliberately omit slide_number to test the pipeline assigns it
          slides: [
            { role: "hook", type: "text_only", text: "Hook", image_prompt: null, visual_goal: "", layout: "hook_cover", asset_path: null },
            { role: "recipe", type: "generated_image", text: "Recipe card", image_prompt: "Food photo", visual_goal: "Show food", layout: "recipe_card", asset_path: null },
            { role: "cta", type: "text_only", text: "Download now", image_prompt: null, visual_goal: "", layout: "cta_banner", asset_path: null },
          ]
        }
      }),
      generateSlideImages: async (inputSlides) =>
        inputSlides.map((slide) => ({ ...slide, asset_path: assetPath })),
      renderPackageSlides: async () => []
    }
  );

  assert.ok(metadata.artifacts && metadata.artifacts.length > 0, "Should have artifacts");
  for (const artifact of metadata.artifacts!) {
    assert.equal(typeof artifact.slide_number, "number", `slide_number should be a number, got ${typeof artifact.slide_number}`);
    assert.ok(!Number.isNaN(artifact.slide_number), "slide_number should not be NaN");
    assert.ok(artifact.slide_number >= 1, `slide_number should be >= 1, got ${artifact.slide_number}`);
    assert.ok(!artifact.id.includes("undefined"), `artifact id should not contain "undefined", got "${artifact.id}"`);
  }
});
