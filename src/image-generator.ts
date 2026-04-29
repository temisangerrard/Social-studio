import fs from "node:fs/promises";
import path from "node:path";
import {
  buildFalImageInput,
  completeGenerationMetadata,
  failedGenerationMetadata,
  imageGenerationQueue,
  submitFalQueueJob,
} from "./generation-provider.ts";
import type { Slide } from "./types.ts";

interface ImageGeneratorOptions {
  assetsDir: string;
  falKey?: string;
  falModel?: string;
  brandName?: string;
  brandColors?: {
    primaryColor?: string;
    secondaryColor?: string;
  };
  mascotReferenceImages?: string[];
  uploadedAssets?: Array<{ id: string; url: string; mimeType: string; filename: string }>;
  onProgress?: (slideNumber: number, total: number, status: string) => void;
}

function sanitizeFilename(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function mockSvg(
  prompt: string,
  slideNumber: number,
  brandName: string,
  colors: { primaryColor: string; secondaryColor: string }
): string {
  const lines = [
    `Mock visual ${slideNumber}`,
    prompt.length > 74 ? `${prompt.slice(0, 71)}...` : prompt
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" viewBox="0 0 1080 1440">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colors.secondaryColor}"/>
      <stop offset="100%" stop-color="${colors.primaryColor}"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1440" fill="url(#bg)" rx="48"/>
  <circle cx="820" cy="280" r="220" fill="#ffffff" fill-opacity="0.15"/>
  <circle cx="260" cy="1160" r="250" fill="#111111" fill-opacity="0.08"/>
  <g>
    <rect x="88" y="88" width="904" height="1264" rx="40" fill="#ffffff" fill-opacity="0.56" stroke="#ffffff" stroke-opacity="0.7"/>
    <text x="140" y="240" font-size="128" font-family="Inter, Arial, sans-serif">✦</text>
    <text x="140" y="360" font-size="42" font-weight="700" fill="#111111" font-family="Inter, Arial, sans-serif">${escapeXml(brandName)} Placeholder</text>
    <text x="140" y="458" font-size="34" fill="#3f2b22" font-family="Inter, Arial, sans-serif">${escapeXml(lines[0])}</text>
    <foreignObject x="140" y="520" width="780" height="560">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Inter, Arial, sans-serif; font-size: 32px; line-height: 1.35; color: #3f2b22;">
        ${escapeXml(lines[1])}
      </div>
    </foreignObject>
  </g>
</svg>`;
}

async function writeMockImage(
  filePath: string,
  prompt: string,
  slideNumber: number,
  brandName: string,
  colors: { primaryColor: string; secondaryColor: string }
): Promise<void> {
  await fs.writeFile(filePath, mockSvg(prompt, slideNumber, brandName, colors), "utf8");
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function generateWithFal(
  prompt: string,
  falKey: string,
  model: string,
  referenceImageUrls?: string[],
  aspectRatio?: string
): Promise<{ buffer: Buffer; payload: Record<string, unknown>; requestId: string | null; outputUrl: string }> {
  const payload = buildFalImageInput({
    model,
    prompt,
    aspectRatio: aspectRatio ?? "1:1",
    referenceImageUrls,
  });
  const queued = await imageGenerationQueue.run(() => submitFalQueueJob({ model, payload, falKey, maxPolls: 30 }));
  const resultPayload = queued.result as {
    images?: Array<{ url: string }>;
    image?: { url: string };
  };
  const imageUrl = resultPayload.images?.[0]?.url ?? resultPayload.image?.url;
  if (!imageUrl) {
    throw new Error("fal.ai returned no images");
  }

  const imageResponse = await fetchWithTimeout(imageUrl, {});
  if (!imageResponse.ok) {
    throw new Error(`generated image download failed (${imageResponse.status})`);
  }

  return {
    buffer: Buffer.from(await imageResponse.arrayBuffer()),
    payload,
    requestId: queued.requestId,
    outputUrl: imageUrl,
  };
}

export async function generateImagesForSlides(
  slides: Slide[],
  options: ImageGeneratorOptions
): Promise<Slide[]> {
  const {
    assetsDir,
    falKey,
    falModel = "fal-ai/flux/schnell",
    brandName = "Brand",
    brandColors = {},
    mascotReferenceImages = [],
    onProgress
  } = options;
  const colors = {
    primaryColor: brandColors.primaryColor ?? "#f04d23",
    secondaryColor: brandColors.secondaryColor ?? "#ffd9c8"
  };

  await fs.mkdir(assetsDir, { recursive: true });

  const imageSlides = slides.filter((s) => s.type === "generated_image" && s.image_prompt);
  const totalImages = imageSlides.length;
  let imageIndex = 0;

  for (const slide of slides) {
    if (slide.type !== "generated_image" || !slide.image_prompt) {
      continue;
    }

    imageIndex++;
    const recipeName = slide.recipe?.recipeName || slide.role;

    // Check if this slide uses an uploaded asset
    if (slide.uploaded_asset_url) {
      const ext = slide.uploaded_asset_url.split('.').pop()?.split('?')[0] || 'jpg';
      const filename = `slide-${String(slide.slide_number).padStart(2, "0")}-${sanitizeFilename(slide.role)}.${ext}`;
      const filePath = path.join(assetsDir, filename);

      try {
        // Normalize relative URLs (e.g. /api/uploads/file.jpg) to absolute
        const assetUrl = slide.uploaded_asset_url.startsWith("/")
          ? `http://localhost:${process.env.PORT || 3000}${slide.uploaded_asset_url}`
          : slide.uploaded_asset_url;
        const response = await fetchWithTimeout(assetUrl, {});
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          await fs.writeFile(filePath, buffer);
          slide.asset_path = filePath;
          if (onProgress) onProgress(imageIndex, totalImages, `Using uploaded image for ${recipeName} (${imageIndex}/${totalImages})`);
          console.log(`[image-generator] Using uploaded asset ${imageIndex}/${totalImages}: ${recipeName}`);
          continue; // Skip FAL generation
        }
      } catch (error) {
        console.warn(`[image-generator] Failed to download uploaded asset, falling back to generation: ${(error as Error).message}`);
        // Fall through to normal generation
      }
    }

    if (onProgress) onProgress(imageIndex, totalImages, `Generating ${recipeName} (${imageIndex}/${totalImages})`);
    console.log(`[image-generator] Generating ${imageIndex}/${totalImages}: ${recipeName}`);

    const extension = falKey ? "jpg" : "svg";
    const filename = `slide-${String(slide.slide_number).padStart(2, "0")}-${sanitizeFilename(slide.role)}.${extension}`;
    const filePath = path.join(assetsDir, filename);
    let requestedAspectRatio = "1:1";
    let requestedRefs: string[] = [];

    try {
      if (falKey) {
        // Determine aspect ratio from slide layout
        const isCarouselSlide = slide.layout === "hook_cover" || slide.layout === "problem_setup" || slide.layout === "recipe_card" || slide.layout === "cta_banner" || slide.layout === "ingredient_card" || slide.layout === "reveal_split";
        const aspectRatio = isCarouselSlide ? "1:1" : "9:16";
        requestedAspectRatio = aspectRatio;

        // Mascot reference images only for mascot-inclusive slides
        const isMascotSlide = slide.role === "hook" || slide.role === "problem" || slide.role === "cta";
        const refs = isMascotSlide ? mascotReferenceImages : [];
        requestedRefs = refs;

        const generated = await generateWithFal(slide.image_prompt, falKey, falModel, refs, aspectRatio);
        await fs.writeFile(filePath, generated.buffer);
        slide.asset_path = filePath;
        slide.generation = completeGenerationMetadata({
          provider: "fal",
          model: falModel,
          payload: generated.payload,
          requestId: generated.requestId,
          outputUrl: generated.outputUrl,
          assetPath: filePath,
        });
      } else {
        await writeMockImage(filePath, slide.image_prompt, slide.slide_number, brandName, colors);
        slide.asset_path = filePath;
        slide.generation = {
          provider: "mock",
          model: "mock-svg",
          status: "complete",
          payload: { prompt: slide.image_prompt },
          output_url: null,
          generated_at: new Date().toISOString(),
          retryable: false,
        };
      }
    } catch (error) {
      console.warn(`[image-generator] Real generation failed: ${(error as Error).message}`);
      slide.asset_path = null;
      slide.generation = failedGenerationMetadata({
        provider: "fal",
        model: falModel,
        prompt: slide.image_prompt,
        payload: buildFalImageInput({ model: falModel, prompt: slide.image_prompt, aspectRatio: requestedAspectRatio, referenceImageUrls: requestedRefs }),
        error
      });
    }
  }

  return slides;
}
