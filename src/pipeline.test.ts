import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { brandProfileFromBrief, runPipelineFromRequest } from "./pipeline.ts";
import type { BrandProfile, GenerationRequest, PlannedPackage, Slide } from "./types.ts";

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
