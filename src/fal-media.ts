import fs from "node:fs/promises";
import path from "node:path";
import type { ReferenceAsset, VideoOptions, WorkflowRecipe } from "./types.ts";

interface FalFileResult {
  url: string;
  content_type?: string;
  file_name?: string;
}

function sanitizeFilename(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 60000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function submitFalJob(model: string, input: unknown, falKey: string): Promise<unknown> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Key ${falKey}`
  };

  const submitResponse = await fetchWithTimeout(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers,
    body: JSON.stringify(input)
  });

  if (!submitResponse.ok) {
    const body = await submitResponse.text();
    throw new Error(`fal submit failed (${submitResponse.status}): ${body}`);
  }

  const submitPayload = (await submitResponse.json()) as {
    status_url: string;
    response_url: string;
  };

  for (let index = 0; index < 40; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const statusResponse = await fetchWithTimeout(submitPayload.status_url, { headers });
    if (!statusResponse.ok) {
      continue;
    }

    const statusPayload = (await statusResponse.json()) as { status?: string };
    if (statusPayload.status === "FAILED") {
      throw new Error("fal generation failed");
    }

    if (statusPayload.status !== "COMPLETED") {
      continue;
    }

    const resultResponse = await fetchWithTimeout(submitPayload.response_url, { headers });
    if (!resultResponse.ok) {
      throw new Error(`fal result fetch failed (${resultResponse.status})`);
    }

    return resultResponse.json();
  }

  throw new Error("fal generation timed out");
}

async function downloadToFile(url: string, outputPath: string): Promise<void> {
  const response = await fetchWithTimeout(url, {}, 120000);
  if (!response.ok) {
    throw new Error(`asset download failed (${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outputPath, buffer);
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
}): Promise<string | null> {
  const { prompt, assetsDir, fileStem, falKey, recipe, references = [] } = params;
  if (!falKey) {
    return null;
  }

  await fs.mkdir(assetsDir, { recursive: true });
  const input =
    recipe.operation === "image-edit"
      ? {
          prompt,
          image_urls: references.map((item) => item.url),
          num_images: 1,
          aspect_ratio: "9:16"
        }
      : {
          prompt,
          image_urls: references.map((item) => item.url),
          num_images: 1,
          aspect_ratio: "9:16"
        };

  const result = await submitFalJob(recipe.model, input, falKey);
  const image = firstImageUrl(result);
  if (!image?.url) {
    throw new Error("fal image result missing URL");
  }

  const ext = image.file_name?.split(".").pop() || "png";
  const outputPath = path.join(assetsDir, `${sanitizeFilename(fileStem)}.${ext}`);
  await downloadToFile(image.url, outputPath);
  return outputPath;
}

export async function generateFalVideoAsset(params: {
  prompt: string;
  assetsDir: string;
  fileStem: string;
  falKey?: string;
  recipe: WorkflowRecipe;
  references?: ReferenceAsset[];
  videoOptions: VideoOptions;
}): Promise<string | null> {
  const { prompt, assetsDir, fileStem, falKey, recipe, references = [], videoOptions } = params;
  if (!falKey) {
    return null;
  }

  await fs.mkdir(assetsDir, { recursive: true });

  const input =
    recipe.operation === "reference-video-generate"
      ? {
          prompt,
          generate_audio: videoOptions.withAudio,
          image_references: references.map((item, index) => ({
            image_url: item.url,
            type: "subject",
            ref_name: `subject${index + 1}`
          })),
          aspect_ratio: videoOptions.aspectRatio
        }
      : {
          prompt,
          duration: videoOptions.duration,
          aspect_ratio: videoOptions.aspectRatio,
          generate_audio: videoOptions.withAudio,
          negative_prompt: "blur, distort, and low quality"
        };

  let result: any;
  try {
    result = await submitFalJob(recipe.model, input, falKey);
  } catch (error) {
    console.warn(`[fal-media] Video job failed: ${error instanceof Error ? error.message : error}`);
    return null;
  }
  const video = firstVideoUrl(result);
  if (!video?.url) {
    console.warn("[fal-media] fal video result missing URL");
    return null;
  }

  const ext = video.file_name?.split(".").pop() || "mp4";
  const outputPath = path.join(assetsDir, `${sanitizeFilename(fileStem)}.${ext}`);
  await downloadToFile(video.url, outputPath);
  return outputPath;
}

