import fs from "node:fs/promises";
import path from "node:path";
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

  // If user uploaded an image, animate it
  const hasUploads = (request.uploadedAssets?.length ?? 0) > 0;
  if (hasUploads) {
    const firstImage = request.uploadedAssets?.find((a) => a.mimeType.startsWith("image/"));
    if (firstImage) {
      return {
        strategy: "image-to-video",
        duration: 15,
        aspectRatio: "9:16",
        resolution: "720p",
        generateAudio: true,
        sourceImageUrl: firstImage.url,
      };
    }
  }

  // Default: GPT Image 2 storyboard grid → Seedance 2.0 image-to-video
  return {
    strategy: "storyboard-to-video",
    duration: 15,
    aspectRatio: "9:16",
    resolution: "720p",
    generateAudio: true,
    storyboardPanels: 9,
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

// ── Strategy: GPT Image 2 storyboard → Seedance 2.0 image-to-video ───────────

async function runStoryboardToVideo(params: {
  prompt: string;
  config: VideoStrategyConfig;
  assetsDir: string;
  falKey: string;
  brand: BrandProfile;
}): Promise<{ videoPath: string; storyboardPath: string | null }> {
  const { prompt, config, assetsDir, falKey, brand } = params;
  const panels = config.storyboardPanels ?? 9;
  const cols = Math.ceil(Math.sqrt(panels));

  // Step 1: Generate storyboard grid via GPT Image 2
  const panelBeats = buildPanelBeats(panels);
  const storyboardPrompt = config.storyboardPrompt || [
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

  let storyboardPath: string | null = null;
  try {
    const imgResult = await submitAndPoll(MODELS.gptImage2, {
      prompt: storyboardPrompt,
      size: "1024x1024",
      quality: "high",
    }, falKey);
    const imgUrl = extractImageUrl(imgResult);
    if (imgUrl) {
      storyboardPath = path.join(assetsDir, "storyboard-grid.png");
      await downloadAsset(imgUrl, storyboardPath);
    }
  } catch (err) {
    console.warn(`[video-strategy] Storyboard generation failed: ${err instanceof Error ? err.message : err}`);
  }

  // Step 2: Use storyboard as input to Seedance 2.0 image-to-video
  const videoPromptText = config.videoPrompt || [
    `Animate this storyboard into a cinematic vertical video.`,
    `Move through each panel as a distinct shot with smooth transitions.`,
    ...buildPanelBeats(panels).map((beat, i) => {
      const cameras = ["fast cut", "slow dolly", "pan right", "handheld energy", "tracking shot", "push-in", "pull-back reveal", "overhead", "static hold"];
      return beat.replace(/\.$/, "") + `. Camera: ${cameras[i % cameras.length]}.`;
    }),
    `Story context: ${prompt}`,
    `Sound: natural ambient audio matching each scene.`,
    `Pacing: start fast, slow in the middle for the key moment, end clean.`,
  ].join(" ");

  const videoInput: Record<string, unknown> = {
    prompt: videoPromptText,
    duration: String(config.duration),
    aspect_ratio: config.aspectRatio,
    resolution: config.resolution ?? "720p",
    generate_audio: config.generateAudio,
  };
  if (storyboardPath) {
    // Convert local file to data URL for fal
    const data = await fs.readFile(storyboardPath);
    videoInput.image_url = `data:image/png;base64,${data.toString("base64")}`;
  }

  const model = storyboardPath ? MODELS.seedanceImage : MODELS.seedanceText;
  const result = await submitAndPoll(model, videoInput, falKey);
  const videoUrl = extractVideoUrl(result);
  if (!videoUrl) throw new Error("Seedance video result missing URL");

  const videoPath = path.join(assetsDir, "storyboard-video.mp4");
  await downloadAsset(videoUrl, videoPath);
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
  const imageUrl = config.sourceImageUrl;
  if (!imageUrl) throw new Error("image-to-video requires sourceImageUrl");

  // Prefer Seedance 2.0 for image-to-video (better quality + audio)
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
