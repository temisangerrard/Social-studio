import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAssetAnalysis, analyzeUploadedAsset } from "./upload-intake.ts";
import type { AssetAnalysis, BrandProfile, UploadedAsset } from "./types.ts";

function makeBrand(): BrandProfile {
  return {
    id: "peppera",
    name: "Peppera",
    description: "Meal planner",
    tone: "Warm",
    audience: "Busy home cooks",
    cta: "Download Peppera",
    logoPath: null,
    visual: {
      primaryColor: "#893516",
      secondaryColor: "#FFDBC9",
      accentColor: "#FEF8F3",
      surfaceColor: "#FFFFFF"
    },
    defaults: {
      platformTargets: ["instagram"],
      goal: "installs",
      hashtags: ["#mealideas"]
    },
    providers: {
      plannerModel: "glm-4.5",
      imageModel: "fal-ai/flux-pro/v1.1"
    }
  };
}

function makeAsset(): UploadedAsset {
  return {
    id: "asset-1",
    filename: "pasta-photo.jpg",
    mimeType: "image/jpeg",
    url: "/api/uploads/pasta-photo.jpg"
  };
}

test("normalizeAssetAnalysis constrains unknown values into valid enums", () => {
  const normalized = normalizeAssetAnalysis(
    {
      assetType: "banana",
      subjectSummary: "Pasta bowl",
      contentHints: ["recipe", "weird"],
      channelHints: ["instagram", "mars"],
      confidence: 2
    },
    makeAsset()
  );

  assert.equal(normalized.assetType, "unknown");
  assert.deepEqual(normalized.contentHints, ["recipe"]);
  assert.deepEqual(normalized.channelHints, ["instagram"]);
  assert.equal(normalized.confidence, 1);
});

test("normalizeAssetAnalysis flags low-confidence results for confirmation", () => {
  const normalized = normalizeAssetAnalysis(
    {
      assetType: "food_photo",
      subjectSummary: "Unclear meal",
      contentHints: ["recipe"],
      channelHints: ["instagram"],
      confidence: 0.3
    },
    makeAsset()
  );

  assert.equal(normalized.needsUserConfirmation, true);
});

test("analyzeUploadedAsset falls back deterministically when provider output is missing", async () => {
  const asset = makeAsset();
  const result = await analyzeUploadedAsset(asset, makeBrand(), "Turn this into a recipe post", {
    analyzeWithProvider: async () => {
      throw new Error("provider unavailable");
    }
  });

  assert.equal(result.assetId, asset.id);
  assert.equal(result.source, "fallback");
  assert.match(result.subjectSummary, /pasta|recipe|upload/i);
});

test("analyzeUploadedAsset preserves provider classifications when valid", async () => {
  const asset = makeAsset();
  const providerResult: Partial<AssetAnalysis> = {
    assetId: asset.id,
    assetType: "food_photo",
    subjectSummary: "A bowl of pasta",
    contentHints: ["recipe", "carousel"],
    channelHints: ["instagram"],
    confidence: 0.88,
    needsUserConfirmation: false,
    source: "glm"
  };

  const result = await analyzeUploadedAsset(asset, makeBrand(), "Recipe carousel", {
    analyzeWithProvider: async () => providerResult
  });

  assert.equal(result.assetType, "food_photo");
  assert.deepEqual(result.contentHints, ["recipe", "carousel"]);
  assert.equal(result.source, "glm");
});
