import path from "node:path";

import type { BrandProfile, Platform, PostMetadata, UploadedAsset } from "./types.ts";
import { generateVoiceover } from "./voice-generator.ts";
import { runPipelineFromRequest } from "./pipeline.ts";

export interface UgcScriptDraft {
  hook: string;
  problem: string;
  productMoment: string;
  outcome: string;
  cta: string;
  toneNotes: string;
  fullScript: string;
  beatSheet: string[];
  onScreenText: string[];
}

export interface UgcGenerateParams {
  brand: BrandProfile;
  platform: Platform;
  voiceId: string;
  visualMode: string;
  script: UgcScriptDraft;
  uploadedAssets?: UploadedAsset[];
  outputRoot: string;
}

export function normalizeUgcDraft(
  partial: Partial<UgcScriptDraft> & Record<string, unknown>,
  brand: BrandProfile
): UgcScriptDraft {
  const hook = String(partial.hook || `I didn't know ${brand.name} could do this until last week.`).trim();
  const problem = String(partial.problem || `${brand.name} fixes the planning problem that used to eat my evening.`).trim();
  const productMoment = String(partial.productMoment || `${brand.name} turns what I already have into a clear next move.`).trim();
  const outcome = String(partial.outcome || `Now I spend less time deciding and more time actually cooking.`).trim();
  const cta = String(partial.cta || brand.cta || `Try ${brand.name}.`).trim();
  const toneNotes = String(partial.toneNotes || brand.tone || "direct, grounded").trim();
  const beatSheet = Array.isArray(partial.beatSheet) && partial.beatSheet.length > 0
    ? partial.beatSheet.map((item) => String(item).trim()).filter(Boolean)
    : [
        "Open with creator-to-camera hook",
        "Show the frustration or before state",
        `Show ${brand.name} solving the problem`,
        "Land the outcome and CTA"
      ];
  const onScreenText = Array.isArray(partial.onScreenText) && partial.onScreenText.length > 0
    ? partial.onScreenText.map((item) => String(item).trim()).filter(Boolean)
    : [hook, problem, outcome];
  const fullScript = String(
    partial.fullScript ||
    `${hook} ${problem} ${productMoment} ${outcome} ${cta}`
  ).trim();

  return {
    hook,
    problem,
    productMoment,
    outcome,
    cta,
    toneNotes,
    fullScript,
    beatSheet,
    onScreenText
  };
}

export function buildUgcPromptContext(params: {
  brand: BrandProfile;
  platform: Platform;
  visualMode: string;
  script: UgcScriptDraft;
}): string {
  const { brand, platform, visualMode, script } = params;
  return [
    `${brand.name} UGC video for ${platform}.`,
    `Audience: ${brand.audience}. Tone: ${script.toneNotes || brand.tone}.`,
    `Visual mode: ${visualMode}.`,
    `Hook: ${script.hook}`,
    `Problem: ${script.problem}`,
    `Product moment: ${script.productMoment}`,
    `Outcome: ${script.outcome}`,
    `CTA: ${script.cta}`,
    `Scene beats: ${script.beatSheet.join(" | ")}`
  ].join(" ");
}

function assetUrlFromPath(postId: string, filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  return `/api/assets/${postId}/${path.basename(filePath)}`;
}

export async function generateUgcPackage(params: UgcGenerateParams): Promise<{
  postId: string;
  brandName: string;
  platform: Platform;
  voiceId: string;
  videoUrl: string | null;
  audioUrl: string | null;
  script: UgcScriptDraft;
  metadata: PostMetadata;
}> {
  const { brand, platform, voiceId, visualMode, script, uploadedAssets = [], outputRoot } = params;
  const videoPrompt = buildUgcPromptContext({ brand, platform, visualMode, script });
  const metadata = await runPipelineFromRequest(
    {
      brandProfileId: brand.id,
      rawIdea: videoPrompt,
      notes: script.fullScript,
      cards: [],
      references: [],
      uploadedAssets,
      platformTargets: [platform],
      goal: brand.defaults.goal || "awareness",
      workflowType: "video-clip",
      visualMode: "mixed",
      deliveryTargets: platform,
      videoOptions: {
        duration: 5,
        aspectRatio: "9:16",
        withAudio: false,
        consistencyMode: "prompt-led"
      }
    },
    brand,
    outputRoot
  );

  const voiceResult = await generateVoiceover(
    script.fullScript,
    metadata.assets_dir,
    "ugc-voiceover",
    { voiceId }
  );

  const videoArtifact = (metadata.artifacts || []).find((artifact) => artifact.kind === "video");

  return {
    postId: metadata.post_id,
    brandName: brand.name,
    platform,
    voiceId: voiceResult.voiceId,
    videoUrl: videoArtifact?.asset_path ? assetUrlFromPath(metadata.post_id, videoArtifact.asset_path) : null,
    audioUrl: assetUrlFromPath(metadata.post_id, voiceResult.audioPath),
    script,
    metadata
  };
}
