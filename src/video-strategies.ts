import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  completeGenerationMetadata,
  failedGenerationMetadata,
} from "./generation-provider.ts";
import type {
  BrandProfile,
  GeneratedArtifact,
  GenerationRequest,
  VideoStrategy,
  VideoStrategyConfig,
} from "./types.ts";

const exec = promisify(execFile);
const UPLOADS_ROOT = path.join(process.cwd(), "workspace", "uploads");

// ── fal.ai model endpoints ────────────────────────────────────────────────────

const MODELS = {
  // Seedance 2.0
  seedanceText: "bytedance/seedance-2.0/text-to-video",
  seedanceImage: "bytedance/seedance-2.0/image-to-video",
  seedanceRef: "bytedance/seedance-2.0/reference-to-video",
  // Kling 3.0
  klingText: "fal-ai/kling-video/v3/pro/text-to-video",
  klingImage: "fal-ai/kling-video/v3/pro/image-to-video",
  // GPT Image 2 (storyboard generation)
  gptImage2: "openai/gpt-image-2",
} as const;

// ── Shared fal helpers ────────────────────────────────────────────────────────

async function fetchFal(url: string, init: RequestInit, timeoutMs = 60000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function submitAndPoll(model: string, input: unknown, falKey: string): Promise<any> {
  const headers = { "Content-Type": "application/json", Authorization: `Key ${falKey}` };
  const res = await fetchFal(`https://queue.fal.run/${model}`, {
    method: "POST", headers, body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fal submit failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const { status_url, response_url } = (await res.json()) as { status_url: string; response_url: string };

  // Poll — video generation can take 2+ minutes
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const statusRes = await fetchFal(status_url, { headers }).catch(() => null);
    if (!statusRes?.ok) continue;
    const status = (await statusRes.json()) as { status?: string };
    if (status.status === "FAILED") throw new Error("fal generation failed");
    if (status.status !== "COMPLETED") continue;
    const resultRes = await fetchFal(response_url, { headers });
    if (!resultRes.ok) throw new Error(`fal result fetch failed (${resultRes.status})`);
    return resultRes.json();
  }
  throw new Error("fal generation timed out (4.5 min)");
}

async function downloadAsset(url: string, outputPath: string): Promise<void> {
  const res = await fetchFal(url, {}, 120000);
  if (!res.ok) throw new Error(`asset download failed (${res.status})`);
  await fs.writeFile(outputPath, Buffer.from(await res.arrayBuffer()));
}

function extractVideoUrl(result: any): string | null {
  return result?.video?.url ?? result?.videos?.[0]?.url ?? null;
}

function extractImageUrl(result: any): string | null {
  return result?.images?.[0]?.url ?? result?.image?.url ?? result?.output?.url ?? null;
}

// Resolve any image reference (local path, /api/uploads/ URL, or external URL) to a form
// Seedance can accept. External URLs are returned as-is; local files become base64 data URLs.
async function imageToDataUrl(imagePathOrUrl: string): Promise<string> {
  if (imagePathOrUrl.startsWith("data:")) return imagePathOrUrl;
  if (imagePathOrUrl.startsWith("http://") || imagePathOrUrl.startsWith("https://")) {
    return imagePathOrUrl;
  }
  let filePath = imagePathOrUrl;
  if (imagePathOrUrl.startsWith("/api/uploads/")) {
    const filename = path.basename(imagePathOrUrl.slice("/api/uploads/".length));
    filePath = path.join(UPLOADS_ROOT, filename);
  }
  const data = await fs.readFile(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg"
    : ext === "gif" ? "image/gif"
    : ext === "webp" ? "image/webp"
    : "image/png";
  return `data:${mime};base64,${data.toString("base64")}`;
}

// Concatenate multiple video clip files into one MP4 using ffmpeg.
async function stitchClips(clipPaths: string[], outputPath: string, assetsDir: string): Promise<void> {
  const concatContent = clipPaths.map((p) => `file '${p}'`).join("\n");
  const concatFile = path.join(assetsDir, "clips-concat.txt");
  await fs.writeFile(concatFile, concatContent, "utf8");
  try {
    await exec("ffmpeg", [
      "-y", "-f", "concat", "-safe", "0", "-i", concatFile,
      "-c:v", "libx264", "-preset", "fast", "-crf", "23",
      "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart",
      outputPath,
    ], { timeout: 120_000 });
  } finally {
    await fs.unlink(concatFile).catch(() => {});
  }
}

// ── Default strategy config ───────────────────────────────────────────────────

export function defaultVideoStrategy(): VideoStrategyConfig {
  return {
    strategy: "seedance-multishot",
    duration: 10,
    aspectRatio: "9:16",
    resolution: "720p",
    generateAudio: true,
  };
}

export function resolveVideoStrategy(request: GenerationRequest, brand: BrandProfile): VideoStrategyConfig {
  if (request.videoStrategy) return request.videoStrategy;

  const uploadedImages = (request.uploadedAssets ?? []).filter((a) => a.mimeType.startsWith("image/"));

  // Multiple uploaded images → animate each and stitch
  if (uploadedImages.length > 1) {
    return {
      strategy: "frames-to-video",
      duration: 15,
      aspectRatio: "9:16",
      resolution: "720p",
      generateAudio: false,
      sourceImageUrls: uploadedImages.map((a) => a.url),
    };
  }

  // Single uploaded image → animate it
  if (uploadedImages.length === 1) {
    return {
      strategy: "image-to-video",
      duration: 15,
      aspectRatio: "9:16",
      resolution: "720p",
      generateAudio: true,
      sourceImageUrl: uploadedImages[0].url,
    };
  }

  // Default: GPT Image 2 key frames → Seedance clips → stitched video
  return {
    strategy: "storyboard-to-video",
    duration: 15,
    aspectRatio: "9:16",
    resolution: "720p",
    generateAudio: false,
    storyboardPanels: 3,
  };
}

// ── Panel beat generator ───────────────────────────────────────────────────────

function buildPanelBeats(panels: number): string[] {
  const beats: Array<{ label: string; desc: string }> = [
    { label: "Hook", desc: "grab attention immediately with a bold visual or question" },
    { label: "Setup", desc: "show the problem or starting situation" },
    { label: "Context", desc: "establish the world, environment, or character" },
    { label: "Action", desc: "the key moment, product in use, transformation happening" },
    { label: "Escalation", desc: "build tension or momentum" },
    { label: "Climax", desc: "the peak moment, the big reveal" },
    { label: "Payoff", desc: "the satisfying result or outcome" },
    { label: "Resolution", desc: "wrap up, show the benefit" },
    { label: "CTA", desc: "brand logo or call to action, clean and memorable" },
  ];
  const selected = beats.slice(0, panels);
  // If fewer beats than panels, repeat "Action" for middle panels
  while (selected.length < panels) {
    selected.splice(selected.length - 1, 0, { label: "Action", desc: "continuation of the key sequence" });
  }
  return selected.map((b, i) => `Panel ${i + 1}: ${b.label} — ${b.desc}.`);
}

// ── Storyboard prompt builder (shared) ────────────────────────────────────────

function buildStoryboardPrompt(prompt: string, brand: BrandProfile, panels: number, override?: string): string {
  if (override) return override;
  const cols = Math.ceil(Math.sqrt(panels));
  const panelBeats = buildPanelBeats(panels);
  return [
    `Create a ${cols}×${cols} storyboard grid (${panels} panels) for a vertical 9:16 short-form video ad.`,
    `Brand: ${brand.name} — ${brand.description || ""}.`,
    `Visual tone: ${brand.tone || "bold, modern"}.`,
    `Brand colors: ${brand.visual.primaryColor} primary, ${brand.visual.secondaryColor} secondary.`,
    brand.mascot ? `Character: ${brand.mascot.name} — ${brand.mascot.description}. ${brand.mascot.visualPrompt}.` : "",
    `Story: ${prompt}`,
    ...panelBeats,
    `Style: Each panel is a distinct camera shot. Use varied angles — close-ups, overhead, wide shots.`,
    `Panels should have clear visual progression and cinematic composition.`,
    `No text overlays in the panels. Pure visual storytelling.`,
  ].filter(Boolean).join(" ");
}

// ── Standalone storyboard preview generator (called by /api/ugc/storyboard) ──

export async function generateStoryboardPreview(params: {
  prompt: string;
  brand: BrandProfile;
  panels?: number;
  outputDir: string;
  falKey: string;
  promptOverride?: string;
}): Promise<{ storyboardPath: string }> {
  const { prompt, brand, panels = 9, outputDir, falKey, promptOverride } = params;
  const storyboardPrompt = buildStoryboardPrompt(prompt, brand, panels, promptOverride);
  const imgResult = await submitAndPoll(MODELS.gptImage2, {
    prompt: storyboardPrompt,
    size: "1024x1024",
    quality: "high",
  }, falKey);
  const imgUrl = extractImageUrl(imgResult);
  if (!imgUrl) throw new Error("Storyboard generation returned no image URL");
  await fs.mkdir(outputDir, { recursive: true });
  const storyboardPath = path.join(outputDir, "storyboard-grid.png");
  await downloadAsset(imgUrl, storyboardPath);
  return { storyboardPath };
}

// ── Strategy: frames-to-video ─────────────────────────────────────────────────
// Accepts any ordered set of images (generated or uploaded), animates each with
// Seedance image-to-video, then stitches the clips into one MP4.

async function runFramesToVideo(params: {
  imagePaths: string[];
  prompts: string[];
  config: VideoStrategyConfig;
  assetsDir: string;
  falKey: string;
}): Promise<string> {
  const { imagePaths, prompts, config, assetsDir, falKey } = params;
  if (imagePaths.length === 0) throw new Error("frames-to-video requires at least one image");

  // Seedance image-to-video minimum is 5 s; cap per-clip so total ≈ config.duration
  const clipDuration = Math.max(5, Math.min(10, Math.ceil(config.duration / imagePaths.length)));

  const clipPaths: string[] = [];
  for (let i = 0; i < imagePaths.length; i++) {
    const imageUrl = await imageToDataUrl(imagePaths[i]);
    const framePrompt = prompts[i] ?? prompts[0] ?? `Animate this image with smooth cinematic motion.`;

    const result = await submitAndPoll(MODELS.seedanceImage, {
      prompt: framePrompt,
      image_url: imageUrl,
      duration: String(clipDuration),
      aspect_ratio: config.aspectRatio,
      resolution: config.resolution ?? "720p",
      generate_audio: false,
    }, falKey);

    const videoUrl = extractVideoUrl(result);
    if (!videoUrl) throw new Error(`Seedance image-to-video returned no URL for frame ${i + 1}`);

    const clipPath = path.join(assetsDir, `frame-${i + 1}-clip.mp4`);
    await downloadAsset(videoUrl, clipPath);
    clipPaths.push(clipPath);
  }

  const videoPath = path.join(assetsDir, "frames-video.mp4");
  if (clipPaths.length === 1) {
    await fs.rename(clipPaths[0], videoPath);
  } else {
    await stitchClips(clipPaths, videoPath, assetsDir);
  }
  return videoPath;
}

// ── Strategy: GPT Image 2 storyboard → Seedance 2.0 image-to-video ───────────

// Three-beat structure used for key frame generation.
const KEY_FRAME_BEATS = [
  { label: "Hook",   cameraHint: "fast cut, bold angle",      desc: "attention-grabbing opening moment" },
  { label: "Action", cameraHint: "tracking shot, handheld",   desc: "the key moment or product in use" },
  { label: "CTA",    cameraHint: "slow pull-back, clean",     desc: "resolution or call to action" },
] as const;

async function runStoryboardToVideo(params: {
  prompt: string;
  config: VideoStrategyConfig;
  assetsDir: string;
  falKey: string;
  brand: BrandProfile;
}): Promise<{ videoPath: string; storyboardPath: string | null }> {
  const { prompt, config, assetsDir, falKey, brand } = params;

  // Preserve the composite grid only as a display artifact (copied from preview if available).
  let storyboardPath: string | null = null;
  if (config.storyboardImagePath) {
    storyboardPath = path.join(assetsDir, "storyboard-grid.png");
    try {
      await fs.copyFile(config.storyboardImagePath, storyboardPath);
    } catch (err) {
      console.warn(`[video-strategy] Failed to copy storyboard grid: ${err instanceof Error ? err.message : err}`);
      storyboardPath = null;
    }
  }

  // Generate individual 9:16 key frames — one per beat — for Seedance to animate.
  // This gives Seedance a proper single-scene starting image rather than a grid thumbnail.
  const brandLine = `Brand: ${brand.name}${brand.description ? ` — ${brand.description}` : ""}.`;
  const toneLine = `Visual tone: ${brand.tone || "bold, modern"}.`;
  const colorLine = `Brand colors: ${brand.visual?.primaryColor ?? ""} primary.`;
  const mascotLine = brand.mascot ? `Character: ${brand.mascot.name} — ${brand.mascot.visualPrompt}.` : "";

  const framePaths: string[] = [];
  for (let i = 0; i < KEY_FRAME_BEATS.length; i++) {
    const beat = KEY_FRAME_BEATS[i];
    const framePrompt = [
      `Cinematic vertical 9:16 portrait frame.`,
      `Scene: ${beat.label} — ${beat.desc}.`,
      brandLine, toneLine, colorLine, mascotLine,
      `Story: ${prompt}`,
      `Style: high production value, photorealistic or stylized per brand tone. No text overlays.`,
    ].filter(Boolean).join(" ");

    try {
      const result = await submitAndPoll(MODELS.gptImage2, {
        prompt: framePrompt,
        size: "1024x1536",
        quality: "high",
      }, falKey);
      const frameUrl = extractImageUrl(result);
      if (frameUrl) {
        const framePath = path.join(assetsDir, `key-frame-${i + 1}.png`);
        await downloadAsset(frameUrl, framePath);
        framePaths.push(framePath);
      }
    } catch (err) {
      console.warn(`[video-strategy] Key frame ${i + 1} (${beat.label}) generation failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Build per-frame animation prompts for Seedance.
  const baseVideoPrompt = config.videoPrompt ?? prompt;
  const frameVideoPrompts = KEY_FRAME_BEATS.map((beat) =>
    `${beat.label} scene: ${beat.desc}. ${baseVideoPrompt}. Camera: ${beat.cameraHint}. Smooth motion, no text.`
  );

  // If key frame generation failed entirely, fall back to text-to-video.
  if (framePaths.length === 0) {
    console.warn("[video-strategy] All key frames failed — falling back to Seedance text-to-video");
    const result = await submitAndPoll(MODELS.seedanceText, {
      prompt: baseVideoPrompt,
      duration: String(config.duration),
      aspect_ratio: config.aspectRatio,
      resolution: config.resolution ?? "720p",
      generate_audio: config.generateAudio,
    }, falKey);
    const videoUrl = extractVideoUrl(result);
    if (!videoUrl) throw new Error("Seedance text-to-video result missing URL");
    const videoPath = path.join(assetsDir, "storyboard-video.mp4");
    await downloadAsset(videoUrl, videoPath);
    return { videoPath, storyboardPath };
  }

  // Animate each key frame with Seedance, then stitch into the final video.
  const videoPath = await runFramesToVideo({
    imagePaths: framePaths,
    prompts: frameVideoPrompts,
    config,
    assetsDir,
    falKey,
  });

  return { videoPath, storyboardPath };
}

// ── Strategy: Seedance 2.0 multi-shot text-to-video ───────────────────────────

async function runSeedanceMultishot(params: {
  scenes: Array<{ title: string; prompt: string }>;
  config: VideoStrategyConfig;
  assetsDir: string;
  falKey: string;
}): Promise<string> {
  const { scenes, config, assetsDir, falKey } = params;

  // Build multi-shot prompt with cinematic direction per shot
  const shotPrompt = config.videoPrompt || scenes
    .map((s, i) => {
      const cameraHints = [
        "close-up, fast cut",
        "medium shot, slow pan",
        "overhead angle, steady",
        "tracking shot, handheld energy",
        "wide shot, dolly in",
        "extreme close-up, rack focus",
        "pull-back reveal",
        "static hold, clean composition",
      ];
      const camera = cameraHints[i % cameraHints.length];
      return `Shot ${i + 1}: ${s.prompt}. Camera: ${camera}.`;
    })
    .join(" ");

  const result = await submitAndPoll(MODELS.seedanceText, {
    prompt: shotPrompt,
    duration: String(config.duration),
    aspect_ratio: config.aspectRatio,
    resolution: config.resolution ?? "720p",
    generate_audio: config.generateAudio,
  }, falKey);

  const videoUrl = extractVideoUrl(result);
  if (!videoUrl) throw new Error("Seedance multishot result missing URL");

  const videoPath = path.join(assetsDir, "multishot-video.mp4");
  await downloadAsset(videoUrl, videoPath);
  return videoPath;
}

// ── Strategy: Seedance 2.0 reference-to-video ─────────────────────────────────

async function runSeedanceReference(params: {
  prompt: string;
  config: VideoStrategyConfig;
  assetsDir: string;
  falKey: string;
}): Promise<string> {
  const { prompt, config, assetsDir, falKey } = params;
  const refs = config.referenceImageUrls ?? [];

  // Build prompt with @Image1, @Image2 tags
  const refTags = refs.map((_, i) => `@Image${i + 1}`).join(", ");
  const refPrefix = refs.length > 0 ? `${refTags} are the brand reference images. ` : "";
  const fullPrompt = refPrefix + (config.videoPrompt || `Keep the character and product visually consistent with these references. ${prompt}. Cinematic camera movement, smooth transitions between scenes.`);

  const input: Record<string, unknown> = {
    prompt: fullPrompt,
    duration: String(config.duration),
    aspect_ratio: config.aspectRatio,
    resolution: config.resolution ?? "720p",
    generate_audio: config.generateAudio,
    image_references: refs.map((url, i) => ({
      image_url: url,
      type: "subject",
      ref_name: `Image${i + 1}`,
    })),
  };

  if (config.referenceAudioUrl) {
    input.audio_references = [{ audio_url: config.referenceAudioUrl }];
  }

  const result = await submitAndPoll(MODELS.seedanceRef, input, falKey);
  const videoUrl = extractVideoUrl(result);
  if (!videoUrl) throw new Error("Seedance reference result missing URL");

  const videoPath = path.join(assetsDir, "reference-video.mp4");
  await downloadAsset(videoUrl, videoPath);
  return videoPath;
}

// ── Strategy: Kling 3.0 text-to-video ─────────────────────────────────────────

async function runKlingText(params: {
  prompt: string;
  config: VideoStrategyConfig;
  assetsDir: string;
  falKey: string;
}): Promise<string> {
  const { prompt, config, assetsDir, falKey } = params;

  const klingPrompt = config.videoPrompt || `${prompt}. Cinematic composition, smooth motion, high production value.`;
  const result = await submitAndPoll(MODELS.klingText, {
    prompt: klingPrompt,
    duration: config.duration <= 5 ? 5 : 10,
    aspect_ratio: config.aspectRatio,
    generate_audio: config.generateAudio,
    negative_prompt: "blur, distort, low quality",
  }, falKey);

  const videoUrl = extractVideoUrl(result);
  if (!videoUrl) throw new Error("Kling text result missing URL");

  const videoPath = path.join(assetsDir, "kling-video.mp4");
  await downloadAsset(videoUrl, videoPath);
  return videoPath;
}

// ── Strategy: Image-to-video (Seedance or Kling) ─────────────────────────────

async function runImageToVideo(params: {
  prompt: string;
  config: VideoStrategyConfig;
  assetsDir: string;
  falKey: string;
}): Promise<string> {
  const { prompt, config, assetsDir, falKey } = params;
  if (!config.sourceImageUrl) throw new Error("image-to-video requires sourceImageUrl");

  // Resolve to data URL so Seedance can accept local uploads as well as external URLs.
  const imageUrl = await imageToDataUrl(config.sourceImageUrl);

  const animatePrompt = config.videoPrompt || `Animate this image into a cinematic video. ${prompt}. Slow camera push-in, subtle motion on the subject, natural ambient sound.`;
  const result = await submitAndPoll(MODELS.seedanceImage, {
    prompt: animatePrompt,
    image_url: imageUrl,
    duration: String(config.duration),
    aspect_ratio: config.aspectRatio,
    resolution: config.resolution ?? "720p",
    generate_audio: config.generateAudio,
  }, falKey);

  const videoUrl = extractVideoUrl(result);
  if (!videoUrl) throw new Error("Image-to-video result missing URL");

  const videoPath = path.join(assetsDir, "animated-video.mp4");
  await downloadAsset(videoUrl, videoPath);
  return videoPath;
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export interface VideoStrategyResult {
  artifacts: GeneratedArtifact[];
  strategy: VideoStrategy;
}

export async function executeVideoStrategy(params: {
  scenes: Array<{ title: string; prompt: string; role: string }>;
  config: VideoStrategyConfig;
  assetsDir: string;
  falKey?: string;
  brand: BrandProfile;
  request: GenerationRequest;
}): Promise<VideoStrategyResult> {
  const { scenes, config, assetsDir, falKey, brand, request } = params;

  if (!falKey) {
    const prompt = scenes.map((s) => s.prompt).join("\n");
    return {
      strategy: config.strategy,
      artifacts: [{
        id: "mock-video",
        kind: "video",
        role: "ugc-video",
        title: `${brand.name} Video (mock)`,
        prompt,
        asset_path: null,
        preview_path: null,
        source_asset_id: null,
        variant_group: null,
        provider: "mock",
        model: "mock-video",
        status: "failed",
        error: "Video generation skipped because no provider key is configured.",
        payload: { strategy: config.strategy, prompt },
        generated_at: new Date().toISOString(),
        retryable: false,
      }],
    };
  }

  await fs.mkdir(assetsDir, { recursive: true });
  const combinedPrompt = scenes.map((s) => s.prompt).join(". ");

  try {
    switch (config.strategy) {
      case "storyboard-to-video": {
        const { videoPath, storyboardPath } = await runStoryboardToVideo({
          prompt: combinedPrompt, config, assetsDir, falKey, brand,
        });
        const artifacts: GeneratedArtifact[] = [];
        if (storyboardPath) {
          artifacts.push({
            id: "storyboard-grid", kind: "image", role: "storyboard",
            title: "Storyboard Grid", prompt: combinedPrompt,
            asset_path: storyboardPath, preview_path: storyboardPath,
            source_asset_id: null, variant_group: null,
          });
        }
        artifacts.push({
          id: "storyboard-video", kind: "video", role: "ugc-video",
          title: `${brand.name} Storyboard Video`, prompt: combinedPrompt,
          asset_path: videoPath, preview_path: videoPath,
          source_asset_id: storyboardPath ? "storyboard-grid" : null,
          variant_group: null,
          ...completeGenerationMetadata({
            provider: "fal", model: storyboardPath ? MODELS.seedanceImage : MODELS.seedanceText,
            payload: { strategy: config.strategy, prompt: combinedPrompt, config },
            assetPath: videoPath,
          }),
        });
        return { strategy: config.strategy, artifacts };
      }

      case "frames-to-video": {
        const imageUrls = config.sourceImageUrls ?? [];
        if (imageUrls.length === 0) throw new Error("frames-to-video requires sourceImageUrls");
        const videoPath = await runFramesToVideo({
          imagePaths: imageUrls,
          prompts: config.frameVideoPrompts ?? [combinedPrompt],
          config,
          assetsDir,
          falKey,
        });
        return {
          strategy: config.strategy,
          artifacts: [{
            id: "frames-video", kind: "video", role: "ugc-video",
            title: `${brand.name} Video`, prompt: combinedPrompt,
            asset_path: videoPath, preview_path: videoPath,
            source_asset_id: null, variant_group: null,
            ...completeGenerationMetadata({
              provider: "fal", model: MODELS.seedanceImage,
              payload: { strategy: config.strategy, prompt: combinedPrompt, config },
              assetPath: videoPath,
            }),
          }],
        };
      }

      case "seedance-multishot": {
        const videoPath = await runSeedanceMultishot({ scenes, config, assetsDir, falKey });
        return {
          strategy: config.strategy,
          artifacts: [{
            id: "multishot-video", kind: "video", role: "ugc-video",
            title: `${brand.name} Multi-Shot Video`, prompt: combinedPrompt,
            asset_path: videoPath, preview_path: videoPath,
            source_asset_id: null, variant_group: null,
            ...completeGenerationMetadata({
              provider: "fal", model: MODELS.seedanceText,
              payload: { strategy: config.strategy, prompt: combinedPrompt, config },
              assetPath: videoPath,
            }),
          }],
        };
      }

      case "seedance-reference": {
        const videoPath = await runSeedanceReference({ prompt: combinedPrompt, config, assetsDir, falKey });
        return {
          strategy: config.strategy,
          artifacts: [{
            id: "reference-video", kind: "video", role: "ugc-video",
            title: `${brand.name} Reference Video`, prompt: combinedPrompt,
            asset_path: videoPath, preview_path: videoPath,
            source_asset_id: null, variant_group: null,
            ...completeGenerationMetadata({
              provider: "fal", model: MODELS.seedanceRef,
              payload: { strategy: config.strategy, prompt: combinedPrompt, config },
              assetPath: videoPath,
            }),
          }],
        };
      }

      case "kling-text": {
        const videoPath = await runKlingText({ prompt: combinedPrompt, config, assetsDir, falKey });
        return {
          strategy: config.strategy,
          artifacts: [{
            id: "kling-video", kind: "video", role: "ugc-video",
            title: `${brand.name} Video`, prompt: combinedPrompt,
            asset_path: videoPath, preview_path: videoPath,
            source_asset_id: null, variant_group: null,
            ...completeGenerationMetadata({
              provider: "fal", model: MODELS.klingText,
              payload: { strategy: config.strategy, prompt: combinedPrompt, config },
              assetPath: videoPath,
            }),
          }],
        };
      }

      case "image-to-video": {
        const videoPath = await runImageToVideo({ prompt: combinedPrompt, config, assetsDir, falKey });
        return {
          strategy: config.strategy,
          artifacts: [{
            id: "animated-video", kind: "video", role: "ugc-video",
            title: `${brand.name} Animated Video`, prompt: combinedPrompt,
            asset_path: videoPath, preview_path: videoPath,
            source_asset_id: null, variant_group: null,
            ...completeGenerationMetadata({
              provider: "fal", model: MODELS.seedanceImage,
              payload: { strategy: config.strategy, prompt: combinedPrompt, config },
              assetPath: videoPath,
            }),
          }],
        };
      }
    }
  } catch (err) {
    console.error(`[video-strategy] ${config.strategy} failed: ${err instanceof Error ? err.message : err}`);
    const generation = failedGenerationMetadata({
      provider: "fal",
      model: config.strategy,
      prompt: combinedPrompt,
      payload: { strategy: config.strategy, prompt: combinedPrompt, config },
      error: err,
    });
    return {
      strategy: config.strategy,
      artifacts: [{
        id: "fallback-video", kind: "video", role: "ugc-video",
        title: `${brand.name} Video (failed)`, prompt: combinedPrompt,
        asset_path: null, preview_path: null,
        source_asset_id: null, variant_group: null,
        provider: generation.provider,
        model: generation.model,
        request_id: generation.request_id,
        status: generation.status,
        error: generation.error,
        payload: generation.payload,
        output_url: generation.output_url,
        generated_at: generation.generated_at,
        retryable: generation.retryable,
      }],
    };
  }
}
