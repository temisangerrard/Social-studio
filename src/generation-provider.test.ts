import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFalImageInput,
  buildFalVideoInput,
  createGenerationQueue,
  failedGenerationMetadata,
} from "./generation-provider.ts";

test("buildFalImageInput maps model-specific image options", () => {
  assert.deepEqual(
    buildFalImageInput({
      model: "fal-ai/flux/schnell",
      prompt: "bright food photo",
      aspectRatio: "9:16",
      referenceImageUrls: ["https://example.com/ref.png"],
    }),
    {
      prompt: "bright food photo",
      image_size: "portrait_16_9",
      num_images: 1,
    }
  );

  assert.deepEqual(
    buildFalImageInput({
      model: "fal-ai/gpt-image-1",
      prompt: "storyboard grid",
      aspectRatio: "1:1",
    }),
    {
      prompt: "storyboard grid",
      size: "1024x1024",
      n: 1,
      quality: "high",
    }
  );
});

test("buildFalVideoInput preserves video controls and references", () => {
  assert.deepEqual(
    buildFalVideoInput({
      operation: "reference-video-generate",
      prompt: "keep mascot consistent",
      aspectRatio: "9:16",
      duration: 8,
      resolution: "720p",
      generateAudio: true,
      referenceImageUrls: ["https://example.com/peppera.png"],
    }),
    {
      prompt: "keep mascot consistent",
      duration: "8",
      aspect_ratio: "9:16",
      resolution: "720p",
      generate_audio: true,
      image_references: [
        {
          image_url: "https://example.com/peppera.png",
          type: "subject",
          ref_name: "Image1",
        },
      ],
    }
  );
});

test("generation queue runs jobs sequentially when maxConcurrent is one", async () => {
  const queue = createGenerationQueue({ maxConcurrent: 1, minDelayMs: 0 });
  const events: string[] = [];

  const first = queue.run(async () => {
    events.push("first:start");
    await new Promise((resolve) => setTimeout(resolve, 20));
    events.push("first:end");
    return "first";
  });
  const second = queue.run(async () => {
    events.push("second:start");
    events.push("second:end");
    return "second";
  });

  assert.deepEqual(await Promise.all([first, second]), ["first", "second"]);
  assert.deepEqual(events, ["first:start", "first:end", "second:start", "second:end"]);
});

test("failedGenerationMetadata records provider failure without an asset", () => {
  const metadata = failedGenerationMetadata({
    provider: "fal",
    model: "fal-ai/kling-video/v3/pro/text-to-video",
    prompt: "video prompt",
    payload: { prompt: "video prompt" },
    error: new Error("rate limited"),
  });

  assert.equal(metadata.provider, "fal");
  assert.equal(metadata.status, "failed");
  assert.equal(metadata.asset_path, null);
  assert.equal(metadata.retryable, true);
  assert.match(metadata.error ?? "", /rate limited/);
  assert.deepEqual(metadata.payload, { prompt: "video prompt" });
});
