import fs from "node:fs/promises";
import path from "node:path";
import type { Platform, PostFormat, PostMetadata, RenderResult } from "./types.ts";
import { selectTemplate } from "./templates/index.ts";

export function resolveViewport(platform: Platform, format: PostFormat): { width: number; height: number } {
  if (platform === "instagram" && format === "carousel") {
    return { width: 1080, height: 1080 };
  }
  return { width: 1080, height: 1920 };
}

async function exists(filePath: string | null | undefined): Promise<boolean> {
  if (!filePath) return false;
  try { await fs.access(filePath); return true; } catch { return false; }
}

async function imageToDataUrl(filePath: string): Promise<string | null> {
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === ".svg" ? "image/svg+xml" : "image/jpeg";
    return `data:${mime};base64,${data.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function renderSlides(metadata: PostMetadata): Promise<RenderResult[]> {
  await fs.mkdir(metadata.slides_dir, { recursive: true });

  const { chromium } = await import("playwright");
  // On Linux (production), use the system Chromium installed via apt
  const executablePath = process.platform === "linux"
    ? (process.env.CHROMIUM_PATH ?? "/usr/bin/chromium")
    : undefined;
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    ...(executablePath ? { executablePath } : {})
  });
  const viewport = resolveViewport(metadata.platform, metadata.format);
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();

  const results: RenderResult[] = [];

  try {
    for (const slide of metadata.slides) {
      let imageDataUrl: string | null = null;
      if (await exists(slide.asset_path)) {
        imageDataUrl = await imageToDataUrl(slide.asset_path!);
      }

      const templateFn = selectTemplate(slide.layout);
      const html = templateFn({
        slide,
        productName: metadata.product,
        imageDataUrl,
        brandVisual: metadata.brand_profile.visual,
        slideCount: metadata.slides.length,
      });

      const outputPath = path.join(
        metadata.slides_dir,
        `slide-${String(slide.slide_number).padStart(2, "0")}.png`
      );

      await page.setContent(html, { waitUntil: "load" });
      await page.evaluate(async () => {
        await document.fonts.ready;
        const images = Array.from(document.images);
        await Promise.all(
          images.map((img) =>
            new Promise<void>((resolve) => {
              if (img.complete) { resolve(); return; }
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            })
          )
        );
      });

      await page.screenshot({ path: outputPath, type: "png" });
      results.push({ slideNumber: slide.slide_number, outputPath });
    }
  } finally {
    await context.close();
    await browser.close();
  }

  return results;
}
