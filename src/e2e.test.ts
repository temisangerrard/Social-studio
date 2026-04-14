/**
 * End-to-end tests for the full generation pipeline.
 *
 * These tests run the complete flow: generate request → plan → image generation
 * → render → output files on disk. FAL and GLM are mocked so no real API keys
 * are needed, but the full pipeline code executes.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runPipelineFromRequest } from "./pipeline.ts";
import type { BrandProfile, GenerationRequest, PlannedPackage, PostMetadata, RenderResult, Slide } from "./types.ts";

const PEPPERA_BRAND: BrandProfile = {
  id: "peppera",
  name: "Peppera",
  description: "AI meal planning app",
  tone: "helpful, witty, clean",
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
    platformTargets: ["tiktok"],
    goal: "installs",
    hashtags: ["#peppera", "#mealideas"]
  },
  providers: {
    plannerModel: "glm-4.5",
    imageModel: "fal-ai/nano-banana-2"
  },
  mascot: {
    name: "Peppera",
    description: "Cheerful green bell pepper mascot",
    role: "Main character",
    visualPrompt: "A cute anthropomorphic green bell pepper character",
    usageRules: ["Always include in mascot-led slides"],
    referenceImages: [
      "https://raw.githubusercontent.com/temisangerrard/Social-studio/main/assets/mascot/peppera-hero.png"
    ]
  }
};

function makeRequest(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    brandProfileId: "peppera",
    rawIdea: "3 ingredients stressed cooks always forget",
    cards: [],
    references: [],
    platformTargets: ["tiktok"],
    goal: "Get more installs",
    workflowType: "slideshow",
    visualMode: "mascot-led",
    ...overrides
  };
}

function makePlan(slides: Slide[]): PlannedPackage {
  return {
    hooks: [
      "You always forget these 3 ingredients",
      "Your dinner is missing these right now"
    ],
    caption: "Stop forgetting these 3 ingredients. Peppera reminds you automatically. Download now.",
    hashtags: ["#peppera", "#mealprep", "#cookingtips", "#easydinners"],
    platformNotes: { tiktok: "Hook fast, use trending sound" },
    slides
  };
}

function makeSlides(): Slide[] {
  return [
    { slide_number: 1, role: "hook", type: "text_only", text: "You always forget these 3 ingredients", image_prompt: null, visual_goal: "Grab attention", layout: "hook", asset_path: null },
    { slide_number: 2, role: "problem", type: "generated_image", text: "Mid-cook panic. Missing the one thing.", image_prompt: "Stressed home cook staring into open fridge, looking panicked, kitchen background", visual_goal: "Relatable problem", layout: "image_text_split", asset_path: null },
    { slide_number: 3, role: "escalation", type: "text_only", text: "You've ordered takeout instead. Again.", image_prompt: null, visual_goal: "Escalate the pain", layout: "statement", asset_path: null },
    { slide_number: 4, role: "reaction", type: "generated_image", text: "What if you never had to guess?", image_prompt: "Peppera mascot with wide eyes, shocked expression, pointing forward", visual_goal: "Emotional pivot", layout: "image_text_split", asset_path: null },
    { slide_number: 5, role: "discovery", type: "text_only", text: "Peppera shows you what to cook with what you have", image_prompt: null, visual_goal: "Introduce solution", layout: "statement", asset_path: null },
    { slide_number: 6, role: "meal_reveal", type: "generated_image", text: "Tonight: garlic butter pasta. 4 ingredients.", image_prompt: "Steaming bowl of garlic butter pasta on a clean kitchen counter, overhead shot, warm lighting", visual_goal: "Appetising meal reveal", layout: "image_focus", asset_path: null },
    { slide_number: 7, role: "benefit", type: "text_only", text: "No more wasted food. No more takeout guilt.", image_prompt: null, visual_goal: "State the benefit", layout: "statement", asset_path: null },
    { slide_number: 8, role: "cta", type: "text_only", text: "Download Peppera free →", image_prompt: null, visual_goal: "Drive installs", layout: "cta", asset_path: null }
  ];
}

// Simulate what FAL returns for a generated image
function makeFakeImageBuffer(): Buffer {
  // Minimal valid 1×1 JPEG
  return Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
    "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARC AABAAEDASIAAhEBAxEB/8QAFgAB" +
    "AQEAAAAAAAAAAAAAAAAABgUE/8QAIBAAAgIBBQEBAAAAAAAAAAAAAQIDBAUREiExQf/EABQBAQAAAAAA" +
    "AAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKxp2mafp1v9tptnb2kH" +
    "oiQgD+g4AAUAAAAAAAAB/9k=",
    "base64"
  );
}

test("E2E: full slideshow pipeline produces output files on disk", async () => {
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "social-studio-e2e-"));
  const slides = makeSlides();
  const plan = makePlan(slides);
  const fakeImage = makeFakeImageBuffer();

  const metadata = await runPipelineFromRequest(makeRequest(), PEPPERA_BRAND, outputRoot, {
    planPackage: async () => ({ plan, provider: "fallback" }),
    generateSlideImages: async (inputSlides) =>
      Promise.all(
        inputSlides.map(async (slide) => {
          if (slide.type !== "generated_image" || !slide.image_prompt) return slide;
          const assetPath = path.join(outputRoot, `${slide.slide_number}.jpg`);
          await fs.writeFile(assetPath, fakeImage);
          return { ...slide, asset_path: assetPath };
        })
      ),
    renderPackageSlides: async (meta: PostMetadata): Promise<RenderResult[]> => {
      await fs.mkdir(meta.slides_dir, { recursive: true });
      return Promise.all(
        meta.slides.map(async (s, i) => {
          const file = path.join(meta.slides_dir, `slide-0${i + 1}.png`);
          await fs.writeFile(file, fakeImage);
          return { slideNumber: s.slide_number, outputPath: file, success: true } as RenderResult;
        })
      );
    }
  });

  const postDir = path.join(outputRoot, metadata.post_id);

  // metadata.json exists and is complete
  const saved = JSON.parse(await fs.readFile(path.join(postDir, "metadata.json"), "utf8"));
  assert.equal(saved.product.toLowerCase(), "peppera");
  assert.equal(saved.platform, "tiktok");
  assert.ok(saved.caption.length > 0, "caption must not be empty");
  assert.ok(Array.isArray(saved.hooks) && saved.hooks.length > 0, "hooks must be present");
  assert.ok(Array.isArray(saved.hashtags) && saved.hashtags.length > 0, "hashtags must be present");
  assert.equal(saved.slides.length, 8, "must have 8 slides");

  // text files exist and have content
  const caption = await fs.readFile(path.join(postDir, "caption.txt"), "utf8");
  const hooks = await fs.readFile(path.join(postDir, "hooks.txt"), "utf8");
  const hashtags = await fs.readFile(path.join(postDir, "hashtags.txt"), "utf8");
  assert.ok(caption.trim().length > 0, "caption.txt must have content");
  assert.ok(hooks.trim().length > 0, "hooks.txt must have content");
  assert.ok(hashtags.trim().length > 0, "hashtags.txt must have content");

  // rendered slides exist on disk
  const slidesDir = path.join(postDir, "slides");
  const slideFiles = await fs.readdir(slidesDir);
  assert.ok(slideFiles.length === 8, `expected 8 slide PNGs, got ${slideFiles.length}`);
  assert.ok(slideFiles.every((f) => f.endsWith(".png")), "all slides must be PNG");

  // generated image assets exist for image slides
  const imageSlideSlugs = slides
    .filter((s) => s.type === "generated_image")
    .map((s) => s.slide_number);
  assert.ok(imageSlideSlugs.length === 3, "test fixture must have 3 image slides");
  for (const n of imageSlideSlugs) {
    const asset = metadata.slides[n - 1]?.asset_path;
    assert.ok(asset, `slide ${n} (image type) must have asset_path set`);
    await assert.doesNotReject(fs.access(asset), `asset file must exist on disk: ${asset}`);
  }

  await fs.rm(outputRoot, { recursive: true, force: true });
});

test("E2E: image slides without FAL key fall back to SVG placeholders", async () => {
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "social-studio-e2e-nokey-"));
  const slides = makeSlides();
  const plan = makePlan(slides);

  const metadata = await runPipelineFromRequest(makeRequest(), PEPPERA_BRAND, outputRoot, {
    planPackage: async () => ({ plan, provider: "fallback" }),
    generateSlideImages: async (inputSlides) => {
      // Simulate no FAL key: write SVG placeholders
      return Promise.all(
        inputSlides.map(async (slide) => {
          if (slide.type !== "generated_image" || !slide.image_prompt) return slide;
          const assetPath = path.join(outputRoot, `${slide.slide_number}.svg`);
          await fs.writeFile(assetPath, "<svg xmlns='http://www.w3.org/2000/svg'><rect width='100' height='100'/></svg>", "utf8");
          return { ...slide, asset_path: assetPath };
        })
      );
    },
    renderPackageSlides: async (meta: PostMetadata): Promise<RenderResult[]> => {
      await fs.mkdir(meta.slides_dir, { recursive: true });
      return Promise.all(meta.slides.map(async (s, i) => {
        const file = path.join(meta.slides_dir, `slide-0${i + 1}.png`);
        await fs.writeFile(file, Buffer.alloc(1));
        return { slideNumber: s.slide_number, outputPath: file, success: true } as RenderResult;
      }));
    }
  });

  // All image slides must still have asset_path (even if SVG)
  const imageSlides = metadata.slides.filter((s) => s.type === "generated_image");
  assert.ok(imageSlides.length > 0, "must have image slides");
  for (const slide of imageSlides) {
    assert.ok(slide.asset_path, `slide ${slide.slide_number} must have asset_path even with placeholder`);
    await assert.doesNotReject(fs.access(slide.asset_path), `placeholder must exist on disk`);
  }

  assert.equal(metadata.render_status, "complete");

  await fs.rm(outputRoot, { recursive: true, force: true });
});

test("E2E: mascot-led request passes reference images to image generator", async () => {
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "social-studio-e2e-mascot-"));
  const slides = makeSlides();
  const plan = makePlan(slides);

  let capturedReferenceImages: string[] | undefined;

  await runPipelineFromRequest(makeRequest({ visualMode: "mascot-led" }), PEPPERA_BRAND, outputRoot, {
    planPackage: async () => ({ plan, provider: "fallback" }),
    generateSlideImages: async (inputSlides, options) => {
      capturedReferenceImages = (options as { mascotReferenceImages?: string[] })?.mascotReferenceImages;
      return inputSlides;
    },
    renderPackageSlides: async (meta: PostMetadata): Promise<RenderResult[]> => {
      await fs.mkdir(meta.slides_dir, { recursive: true });
      return Promise.all(meta.slides.map(async (s, i) => {
        const file = path.join(meta.slides_dir, `slide-0${i + 1}.png`);
        await fs.writeFile(file, Buffer.alloc(1));
        return { slideNumber: s.slide_number, outputPath: file, success: true } as RenderResult;
      }));
    }
  });

  assert.ok(
    Array.isArray(capturedReferenceImages) && capturedReferenceImages.length > 0,
    "mascot reference images must be passed to image generator for mascot-led requests"
  );
  assert.ok(
    capturedReferenceImages!.every((url) => url.includes("github") || url.startsWith("http")),
    "reference image URLs must be permanent HTTP URLs"
  );

  await fs.rm(outputRoot, { recursive: true, force: true });
});
