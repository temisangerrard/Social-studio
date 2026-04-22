import assert from "node:assert/strict";
import test from "node:test";

import { buildUgcDraftRequest, buildUgcGenerateRequest } from "./ugc-request.js";

test("UGC draft request ignores studio routing state", () => {
  const request = buildUgcDraftRequest({
    brandId: "peppera",
    platform: "tiktok",
    idea: "Why this meal planner is saving my week",
    notes: "Focus on busy parents",
    studioRoutePreview: {
      decision: {
        workflowType: "linkedin-text",
        deliveryTargets: "linkedin"
      }
    }
  });

  assert.deepEqual(request, {
    brandProfileId: "peppera",
    platform: "tiktok",
    idea: "Why this meal planner is saving my week",
    notes: "Focus on busy parents"
  });
});

test("UGC generate request includes approved script and voice context only", () => {
  const request = buildUgcGenerateRequest({
    brandId: "peppera",
    platform: "instagram",
    voiceId: "voice_123",
    visualMode: "product-demo",
    script: {
      hook: "I finally stopped guessing dinner.",
      problem: "Meal planning used to eat up my evening.",
      productMoment: "Now I drop ingredients in and get meal ideas instantly.",
      outcome: "I spend less time stressing and more time cooking.",
      cta: "Try Peppera if dinner planning keeps dragging you down.",
      toneNotes: "Direct, relieved, grounded",
      fullScript: "I finally stopped guessing dinner...",
      beatSheet: ["Hook to camera", "Show fridge", "Show app", "CTA"],
      onScreenText: ["Stop guessing dinner", "Use what you have", "Plan faster"]
    },
    uploadedAssetIds: ["asset-1", "asset-2"],
    selectedStyleId: "ugc-voiceover-story",
    routePreview: {
      decision: {
        workflowType: "slideshow",
        contentTypeId: "recipe-carousel"
      }
    }
  });

  assert.equal(request.brandProfileId, "peppera");
  assert.equal(request.platform, "instagram");
  assert.equal(request.voiceId, "voice_123");
  assert.equal(request.visualMode, "product-demo");
  assert.equal(request.script.fullScript, "I finally stopped guessing dinner...");
  assert.deepEqual(request.uploadedAssetIds, ["asset-1", "asset-2"]);
  assert.equal("routePreview" in request, false);
  assert.equal("selectedStyleId" in request, false);
});
