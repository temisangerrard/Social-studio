import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkflowRecipe, buildWorkflowReferenceAssets, createReelPackageDraft } from "./workflow-engine.ts";
import type { BrandProfile, GenerationRequest, PlannedPackage } from "./types.ts";

const brand: BrandProfile = {
  id: "peppera",
  name: "Peppera",
  description: "Meal planner",
  tone: "helpful",
  audience: "busy home cooks",
  cta: "Download Peppera",
  logoPath: null,
  visual: {
    primaryColor: "#f04d23",
    secondaryColor: "#ffd9c8",
    accentColor: "#7a2413",
    surfaceColor: "#fff7f0"
  },
  defaults: {
    platformTargets: ["tiktok", "instagram"],
    goal: "installs",
    hashtags: ["#mealideas"]
  },
  providers: {
    plannerModel: "glm-4.5-air",
    imageModel: "fal-ai/nano-banana-2"
  },
  mascot: {
    name: "Peppera Mascot",
    description: "A green pepper mascot.",
    role: "face of the social account",
    visualPrompt: "Use the green pepper mascot as the main character.",
    usageRules: ["Keep the mascot consistent."],
    referenceImages: ["https://example.com/mascot-1.png", "https://example.com/mascot-2.png"]
  }
};

const baseRequest: GenerationRequest = {
  brandProfileId: "peppera",
  rawIdea: "Turn leftovers into dinner",
  notes: "",
  cards: [],
  references: [],
  platformTargets: ["tiktok"],
  goal: "installs",
  workflowType: "slideshow",
  visualMode: "mascot-led",
  deliveryTargets: "both"
};

test("workflow recipe routes reference video clips to pixverse", () => {
  const recipe = buildWorkflowRecipe({
    ...baseRequest,
    workflowType: "video-clip",
    referenceAssets: [{ id: "r1", label: "Mascot", url: "https://example.com/mascot.png", source: "brand", kind: "image" }],
    videoOptions: {
      duration: 5,
      aspectRatio: "9:16",
      withAudio: true,
      consistencyMode: "mascot-consistent"
    }
  });

  assert.equal(recipe.operation, "reference-video-generate");
  assert.match(recipe.model, /pixverse/i);
});

test("workflow recipe routes prompt-led clips to kling", () => {
  const recipe = buildWorkflowRecipe({
    ...baseRequest,
    workflowType: "video-clip",
    videoOptions: {
      duration: 5,
      aspectRatio: "9:16",
      withAudio: true,
      consistencyMode: "prompt-led"
    }
  });

  assert.equal(recipe.operation, "video-generate");
  assert.match(recipe.model, /kling/i);
});

test("mascot-led requests automatically include brand mascot references", () => {
  const references = buildWorkflowReferenceAssets(baseRequest, brand);
  assert.equal(references.length, 2);
  assert.equal(references[0].source, "brand");
});

test("reel package draft groups planned slides into clip briefs", () => {
  const plan: PlannedPackage = {
    hooks: ["Hook"],
    caption: "Caption",
    hashtags: ["#one"],
    platformNotes: { tiktok: "Fast" },
    slides: Array.from({ length: 8 }, (_, index) => ({
      slide_number: index + 1,
      role: index === 0 ? "hook" : index === 7 ? "cta" : "problem",
      type: "generated_image",
      text: `Slide ${index + 1}`,
      image_prompt: `Prompt ${index + 1}`,
      visual_goal: "",
      layout: "image_focus",
      asset_path: null
    }))
  };

  const reel = createReelPackageDraft(plan, baseRequest, brand);
  assert.equal(reel.clipBriefs.length, 3);
  assert.match(reel.voiceoverScript, /Peppera/i);
});
