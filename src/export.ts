import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import archiver from "archiver";
import { Writable } from "node:stream";
import { chromium } from "playwright";

// ── Platform sizing presets ───────────────────────────────────────────────────
const PLATFORM_SIZES: Record<string, { w: number; h: number }> = {
  instagram: { w: 1080, h: 1080 },
  tiktok: { w: 1080, h: 1920 },
  linkedin: { w: 1200, h: 627 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
async function loadSlideImages(outputDir: string): Promise<{ name: string; buf: Buffer }[]> {
  const slidesDir = path.join(outputDir, "slides");
  const assetsDir = path.join(outputDir, "assets", "generated");
  const results: { name: string; buf: Buffer }[] = [];

  // Try slides/ first, then assets/generated/
  for (const dir of [slidesDir, assetsDir]) {
    try {
      const files = (await fs.readdir(dir)).filter((f) => /\.(png|jpe?g|webp|svg)$/i.test(f)).sort();
      for (const file of files) {
        results.push({ name: file, buf: await fs.readFile(path.join(dir, file)) });
      }
      if (results.length) return results;
    } catch { /* dir doesn't exist */ }
  }
  return results;
}

// ── PDF carousel export ───────────────────────────────────────────────────────
export async function exportPdf(outputDir: string): Promise<Buffer> {
  const slides = await loadSlideImages(outputDir);
  if (!slides.length) throw new Error("No slides found to export.");

  // Build an HTML page with one slide per "page" at 1200x627 (LinkedIn carousel)
  const slideWidth = 1200;
  const slideHeight = 627;
  const htmlSlides = slides.map((s) => {
    const b64 = s.buf.toString("base64");
    const mime = s.name.endsWith(".svg") ? "image/svg+xml" : "image/png";
    return `<div class="slide"><img src="data:${mime};base64,${b64}" /></div>`;
  }).join("\n");

  const html = `<!DOCTYPE html><html><head><style>
    * { margin: 0; padding: 0; }
    @page { size: ${slideWidth}px ${slideHeight}px; margin: 0; }
    .slide { width: ${slideWidth}px; height: ${slideHeight}px; page-break-after: always; display: flex; align-items: center; justify-content: center; background: #fff; }
    .slide img { max-width: 100%; max-height: 100%; object-fit: contain; }
  </style></head><body>${htmlSlides}</body></html>`;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      width: `${slideWidth}px`,
      height: `${slideHeight}px`,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ── Platform-sized zip export ─────────────────────────────────────────────────
async function resizeImage(buf: Buffer, w: number, h: number, name: string): Promise<Buffer> {
  // SVGs can't be resized with sharp easily — skip
  if (name.endsWith(".svg")) return buf;
  return sharp(buf).resize(w, h, { fit: "cover", position: "center" }).png().toBuffer();
}

export async function exportZip(
  outputDir: string,
  platforms: string[] = ["instagram", "tiktok", "linkedin"]
): Promise<Buffer> {
  const slides = await loadSlideImages(outputDir);
  if (!slides.length) throw new Error("No slides found to export.");

  // Collect into a buffer
  const chunks: Buffer[] = [];
  const writable = new Writable({
    write(chunk, _enc, cb) { chunks.push(chunk); cb(); },
  });

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.pipe(writable);

  for (const platform of platforms) {
    const size = PLATFORM_SIZES[platform];
    if (!size) continue;
    for (const slide of slides) {
      const resized = await resizeImage(slide.buf, size.w, size.h, slide.name);
      const ext = slide.name.endsWith(".svg") ? "svg" : "png";
      const baseName = slide.name.replace(/\.[^.]+$/, "");
      archive.append(resized, { name: `${platform}/${baseName}.${ext}` });
    }
  }

  await archive.finalize();
  await new Promise<void>((resolve) => writable.on("finish", resolve));
  return Buffer.concat(chunks);
}
