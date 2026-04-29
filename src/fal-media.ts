import fs from "node:fs/promises";
import path from "node:path";
import {
  buildFalImageInput,
  buildFalVideoInput,
  completeGenerationMetadata,
  downloadAsset,
  failedGenerationMetadata,
  imageGenerationQueue,
  submitFalQueueJob,
  videoGenerationQueue,
  type GenerationMetadata,
} from "./generation-provider.ts";
import type { ReferenceAsset, VideoOptions, WorkflowRecipe } from "./types.ts";

interface FalFileResult {
  url: string;
  content_type?: string;
  file_name?: string;
}

export interface GeneratedAssetResult {
  assetPath: string | null;
  generation: GenerationMetadata;
}

function sanitizeFilename(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function firstImageUrl(result: any): FalFileResult | null {
  return result?.images?.[0] ?? result?.image ?? null;
}

function firstVideoUrl(result: any): FalFileResult | null {
  return result?.video ?? result?.videos?.[0] ?? null;
}

export async function generateFalImageAsset(params: {
  prompt: string;
  assetsDir: string;
  fileStem: string;
  falKey?: string;
  recipe: WorkflowRecipe;
  references?: ReferenceAsset[];
}): Promise<GeneratedAssetResult | null> {
  const { prompt, assetsDir, fileStem, falKey, recipe, references = [] } = params;
  if (!falKey) return null;

  await fs.mkdir(assetsDir, { recursive: true });
  const payload =
    recipe.operation === "image-edit"
      ? {
          prompt,
          image_urls: references.map((item) => item.url),
          num_images: 1,
          aspect_ratio: "9:16",
        }
      : buildFalImageInput({
          model: recipe.model,
          prompt,
          aspectRatio: "9:16",
          referenceImageUrls: references.map((item) => item.url),
        });

  try {
    const queued = await imageGenerationQueue.run(() => submitFalQueueJob({ model: recipe.model, payload, falKey }));
    const image = firstImageUrl(queued.result);
    if (!image?.url) throw new Error("fal image result missing URL");

    const ext = image.file_name?.split(".").pop() || "png";
    const outputPath = path.join(assetsDir, `${sanitizeFilename(fileStem)}.${ext}`);
    await downloadAsset(image.url, outputPath);
    return {
      assetPath: outputPath,
      generation: completeGenerationMetadata({
        provider: "fal",
        model: recipe.model,
        requestId: queued.requestId,
        payload,
        outputUrl: image.url,
        assetPath: outputPath,
      }),
    };
  } catch (error) {
    return {
      assetPath: null,
      generation: failedGenerationMetadata({
        provider: "fal",
        model: recipe.model,
        prompt,
        payload,
        error,
      }),
    };
  }
}

export async function generateFalVideoAsset(params: {
  prompt: string;
  assetsDir: string;
  fileStem: string;
  falKey?: string;
  recipe: WorkflowRecipe;
  references?: ReferenceAsset[];
  videoOptions: VideoOptions;
}): Promise<GeneratedAssetResult | null> {
  const { prompt, assetsDir, fileStem, falKey, recipe, references = [], videoOptions } = params;
  if (!falKey) return null;

  await fs.mkdir(assetsDir, { recursive: true });
  const payload = buildFalVideoInput({
    operation: recipe.operation === "reference-video-generate" ? "reference-video-generate" : "video-generate",
    prompt,
    duration: videoOptions.duration,
    aspectRatio: videoOptions.aspectRatio,
    generateAudio: videoOptions.withAudio,
    resolution: "720p",
    negativePrompt: "blur, distort, and low quality",
    referenceImageUrls: references.map((item) => item.url),
  });

  try {
    const queued = await videoGenerationQueue.run(() => submitFalQueueJob({ model: recipe.model, payload, falKey, maxPolls: 90, pollIntervalMs: 3000 }));
    const video = firstVideoUrl(queued.result);
    if (!video?.url) throw new Error("fal video result missing URL");

    const ext = video.file_name?.split(".").pop() || "mp4";
    const outputPath = path.join(assetsDir, `${sanitizeFilename(fileStem)}.${ext}`);
    await downloadAsset(video.url, outputPath);
    return {
      assetPath: outputPath,
      generation: completeGenerationMetadata({
        provider: "fal",
        model: recipe.model,
        requestId: queued.requestId,
        payload,
        outputUrl: video.url,
        assetPath: outputPath,
      }),
    };
  } catch (error) {
    console.warn(`[fal-media] Video job failed: ${error instanceof Error ? error.message : error}`);
    return {
      assetPath: null,
      generation: failedGenerationMetadata({
        provider: "fal",
        model: recipe.model,
        prompt,
        payload,
        error,
      }),
    };
  }
}
