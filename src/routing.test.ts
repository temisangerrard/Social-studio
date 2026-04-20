import assert from "node:assert/strict";
import test from "node:test";
import { brandProfileFromBrief } from "./pipeline.ts";
import { deriveBrandContentRecipes, explainRoutingTree, routeGenerationRequest } from "./routing.ts";
import type { AssetAnalysis, BrandProfile, GenerationRequest, UploadedAsset } from "./types.ts";

function makeBrand(overrides: Partial<BrandProfile> = {}): BrandProfile {
  return {
    ...brandProfileFromBrief({
      product: "Peppera",
      platform: "instagram",
      format: "slideshow",
      pillar: "recipes",
      audience: "Busy home cooks",
      tone: "Warm",
      goal: "installs",
      idea: "Use leftovers",
      ingredients: []
    }),
    contentRecipes: [
      {
        id: "recipe",
        name: "Recipe",
        routeFamily: "recipe",
        workflowType: "slideshow",
        platformTargets: ["instagram", "tiktok"],
        defaultPriority: 100,
        preferredAssetTypes: ["food_photo"],
        contentTypeId: "recipe-carousel"
      },
      {
        id: "edited-image",
        name: "Edited Image",
        routeFamily: "edited-image",
        workflowType: "reference-edit",
        platformTargets: ["instagram", "linkedin"],
        defaultPriority: 80,
        preferredAssetTypes: ["product_photo", "logo", "person_photo"]
      },
      {
        id: "linkedin-post",
        name: "LinkedIn Post",
        routeFamily: "linkedin-post",
        workflowType: "linkedin-text",
        platformTargets: ["linkedin"],
        defaultPriority: 90,
        preferredAssetTypes: ["screenshot", "document", "product_photo"]
      }
    ],
    ...overrides
  };
}

function makeRequest(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    brandProfileId: "peppera",
    rawIdea: "Turn one food photo into a useful recipe post",
    notes: "",
    cards: [],
    references: [],
    platformTargets: ["instagram"],
    goal: "installs",
    uploadedAssets: [],
    ...overrides
  };
}

function makeAsset(id: string): UploadedAsset {
  return {
    id,
    filename: `${id}.jpg`,
    mimeType: "image/jpeg",
    url: `/api/uploads/${id}.jpg`
  };
}

function makeAnalysis(assetId: string, overrides: Partial<AssetAnalysis> = {}): AssetAnalysis {
  return {
    assetId,
    assetType: "food_photo",
    subjectSummary: "Plated pasta",
    contentHints: ["recipe", "carousel"],
    channelHints: ["instagram"],
    confidence: 0.91,
    needsUserConfirmation: false,
    source: "fallback",
    ...overrides
  };
}

test("router picks recipe route for food-photo plus recipe prompt", () => {
  const brand = makeBrand();
  const asset = makeAsset("food-1");
  const decision = routeGenerationRequest({
    brand,
    request: makeRequest({ uploadedAssets: [asset] }),
    assetAnalyses: [makeAnalysis(asset.id)]
  });

  assert.equal(decision.routeFamily, "recipe");
  assert.equal(decision.workflowType, "slideshow");
  assert.equal(decision.contentTypeId, "recipe-carousel");
  assert.match(decision.reasonSummary, /recipe/i);
});

test("router picks edited-image route for promo photo with logo-like intent", () => {
  const brand = makeBrand();
  const asset = makeAsset("promo-1");
  const decision = routeGenerationRequest({
    brand,
    request: makeRequest({
      rawIdea: "Make a flyer for this launch photo with logo and CTA underneath",
      uploadedAssets: [asset],
      platformTargets: ["instagram"]
    }),
    assetAnalyses: [
      makeAnalysis(asset.id, {
        assetType: "product_photo",
        subjectSummary: "Launch promo image",
        contentHints: ["flyer", "edited-image"],
        channelHints: ["instagram"]
      })
    ]
  });

  assert.equal(decision.routeFamily, "edited-image");
  assert.equal(decision.workflowType, "reference-edit");
});

test("router picks linkedin-post route without requiring image-heavy workflow", () => {
  const brand = makeBrand();
  const decision = routeGenerationRequest({
    brand,
    request: makeRequest({
      rawIdea: "Write a LinkedIn post explaining why commerce should be voice first",
      platformTargets: ["linkedin"],
      uploadedAssets: []
    }),
    assetAnalyses: []
  });

  assert.equal(decision.routeFamily, "linkedin-post");
  assert.equal(decision.workflowType, "linkedin-text");
});

test("router respects brand-supported recipes and falls back deterministically", () => {
  const brand = makeBrand({
    contentRecipes: [
      {
        id: "carousel",
        name: "Carousel",
        routeFamily: "carousel",
        workflowType: "slideshow",
        platformTargets: ["instagram", "tiktok"],
        defaultPriority: 50
      }
    ]
  });

  const decision = routeGenerationRequest({
    brand,
    request: makeRequest({
      rawIdea: "Create something useful from this",
      uploadedAssets: [makeAsset("unknown-1")]
    }),
    assetAnalyses: [
      makeAnalysis("unknown-1", {
        assetType: "unknown",
        contentHints: [],
        confidence: 0.22,
        needsUserConfirmation: true
      })
    ]
  });

  assert.equal(decision.routeFamily, "carousel");
  assert.equal(decision.candidates[0].status, "selected");
  assert.equal(decision.requiresConfirmation, true);
});

test("deriveBrandContentRecipes falls back to legacy contentTypes when recipes are absent", () => {
  const brand = brandProfileFromBrief({
    product: "EchoCart",
    platform: "instagram",
    format: "slideshow",
    pillar: "product",
    audience: "Shoppers",
    tone: "Clean",
    goal: "awareness",
    idea: "Show the product",
    ingredients: []
  });
  brand.contentTypes = [
    {
      id: "product-demo",
      name: "Product Demo",
      imageStyle: "product UI",
      platformTargets: ["instagram"],
      slideBlueprint: [
        { role: "problem", type: "generated_image", textFields: ["problemText"], imagePromptTemplate: "problem", layout: "image_focus" }
      ]
    }
  ];

  const recipes = deriveBrandContentRecipes(brand);
  assert.equal(recipes.length, 1);
  assert.equal(recipes[0].contentTypeId, "product-demo");
});

test("static routing tree exposes the route families for admin viewing", () => {
  const tree = explainRoutingTree();
  assert.match(tree, /recipe/i);
  assert.match(tree, /edited-image/i);
  assert.match(tree, /linkedin-post/i);
});
