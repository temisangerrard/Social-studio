import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { generateImagesForSlides } from "./image-generator.ts";
import type { Slide } from "./types.ts";

test("image generator writes placeholders without a fal key", async () => {
  const assetsDir = await fs.mkdtemp(path.join(os.tmpdir(), "social-studio-images-"));
  const slides: Slide[] = [
    {
      slide_number: 1,
      role: "problem",
      type: "generated_image",
      text: "Dinner chaos",
      image_prompt: "A cluttered kitchen counter at dusk",
      visual_goal: "Show relatable chaos",
      layout: "image_text_split",
      asset_path: null
    }
  ];

  const result = await generateImagesForSlides(slides, {
    assetsDir,
    falKey: undefined,
    brandName: "Peppera",
    brandColors: {
      primaryColor: "#f04d23",
      secondaryColor: "#ffd9c8"
    }
  });

  assert.ok(result[0].asset_path);
  assert.equal(path.extname(result[0].asset_path ?? ""), ".svg");
  const contents = await fs.readFile(result[0].asset_path!, "utf8");
  assert.match(contents, /Peppera Placeholder/);
});

test("image generator marks real fal failures without writing placeholders", async () => {
  const assetsDir = await fs.mkdtemp(path.join(os.tmpdir(), "social-studio-images-fallback-"));
  const slides: Slide[] = [
    {
      slide_number: 1,
      role: "problem",
      type: "generated_image",
      text: "Dinner chaos",
      image_prompt: "A cluttered kitchen counter at dusk",
      visual_goal: "Show relatable chaos",
      layout: "image_text_split",
      asset_path: null
    }
  ];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("network unavailable");
  };

  try {
    const result = await generateImagesForSlides(slides, {
      assetsDir,
      falKey: "test-key",
      falModel: "fal-ai/flux/schnell",
      brandName: "Peppera",
      brandColors: {
        primaryColor: "#f04d23",
        secondaryColor: "#ffd9c8"
      }
    });

    assert.equal(result[0].asset_path, null);
    assert.equal(result[0].generation?.status, "failed");
    assert.equal(result[0].generation?.provider, "fal");
    assert.match(result[0].generation?.error ?? "", /network unavailable/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
