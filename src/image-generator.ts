import fs from "node:fs/promises";
import path from "node:path";
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

async function generateWithFal(prompt: string, falKey: string, model: string, referenceImageUrls?: string[], aspectRatio?: string): Promise<Buffer> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Key ${falKey}`
  };

  const isNanoBanana = model.includes("nano-banana");
  const isFlux = model.includes("flux");

  let input: Record<string, unknown>;
  if (isNanoBanana) {
    input = {
      prompt,
      aspect_ratio: aspectRatio ?? "1:1",
      num_images: 1,
    };
  } else if (isFlux) {
    // FLUX Pro / Schnell — uses image_size enum, no num_inference_steps
    const sizeMap: Record<string, string> = { "1:1": "square_hd", "4:5": "portrait_4_3", "9:16": "portrait_16_9" };
    input = {
      prompt,
      image_size: sizeMap[aspectRatio ?? "1:1"] ?? "square_hd",
      num_images: 1,
    };
  } else {
    input = {
      prompt,
      image_size: aspectRatio === "1:1" ? "square" : "portrait_16_9",
      num_images: 1,
      seed: Math.floor(Math.random() * 2147483647),
    };
  }

  const submitResponse = await fetchWithTimeout(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers,
    body: JSON.stringify(input)
  });

  if (!submitResponse.ok) {
    const body = await submitResponse.text();
    throw new Error(`fal.ai submit failed (${submitResponse.status}): ${body}`);
  }

  const submitPayload = (await submitResponse.json()) as {
    status_url: string;
    response_url: string;
  };

  for (let index = 0; index < 30; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const statusResponse = await fetchWithTimeout(submitPayload.status_url, { headers });
    if (!statusResponse.ok) {
      continue;
    }

    const statusPayload = (await statusResponse.json()) as { status?: string };
    if (statusPayload.status === "FAILED") {
      throw new Error("fal.ai generation failed");
    }

    if (statusPayload.status !== "COMPLETED") {
      continue;
    }

    const resultResponse = await fetchWithTimeout(submitPayload.response_url, { headers });
    if (!resultResponse.ok) {
      const errBody = await resultResponse.text().catch(() => "");
      throw new Error(`fal.ai result fetch failed (${resultResponse.status}): ${errBody.slice(0, 200)}`);
    }

    const resultPayload = (await resultResponse.json()) as {
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

    return Buffer.from(await imageResponse.arrayBuffer());
  }

  throw new Error("fal.ai generation timed out");
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
    mascotReferenceImages = []
  } = options;
  const colors = {
    primaryColor: brandColors.primaryColor ?? "#f04d23",
    secondaryColor: brandColors.secondaryColor ?? "#ffd9c8"
  };

  await fs.mkdir(assetsDir, { recursive: true });

  for (const slide of slides) {
    if (slide.type !== "generated_image" || !slide.image_prompt) {
      continue;
    }

    const extension = falKey ? "jpg" : "svg";
    const filename = `slide-${String(slide.slide_number).padStart(2, "0")}-${sanitizeFilename(slide.role)}.${extension}`;
    const filePath = path.join(assetsDir, filename);

    try {
      if (falKey) {
        // Determine aspect ratio from slide layout
        const isCarouselSlide = slide.layout === "hook_cover" || slide.layout === "problem_setup" || slide.layout === "recipe_card" || slide.layout === "cta_banner";
        const aspectRatio = isCarouselSlide ? "1:1" : "9:16";

        // Only send mascot reference images for mascot-inclusive slides (not food-only recipe slides)
        const isMascotSlide = slide.role === "hook" || slide.role === "problem" || slide.role === "cta";
        const refs = isMascotSlide ? mascotReferenceImages : [];

        const imageBuffer = await generateWithFal(slide.image_prompt, falKey, falModel, refs, aspectRatio);
        await fs.writeFile(filePath, imageBuffer);
        slide.asset_path = filePath;
      } else {
        await writeMockImage(filePath, slide.image_prompt, slide.slide_number, brandName, colors);
        slide.asset_path = filePath;
      }
    } catch (error) {
      console.warn(`[image-generator] Falling back to placeholder: ${(error as Error).message}`);
      const fallbackPath = filePath.replace(/\.[^.]+$/, ".svg");
      await writeMockImage(fallbackPath, slide.image_prompt, slide.slide_number, brandName, colors);
      slide.asset_path = fallbackPath;
    }
  }

  return slides;
}
