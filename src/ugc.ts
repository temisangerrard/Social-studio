import fs from "node:fs/promises";
import path from "node:path";

import type { BrandProfile, CreativeSystemOutput, Platform, PostMetadata, UploadedAsset } from "./types.ts";
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
  script?: UgcScriptDraft;
  creativeProjectId?: string;
  creativePlan?: CreativeSystemOutput;
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

function listOrEmpty(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

export function buildUgcDraftFromCreativePlan(plan: CreativeSystemOutput, brand: BrandProfile): UgcScriptDraft {
  const headlines = listOrEmpty(plan.production_assets?.headline_options);
  const scriptLines = listOrEmpty(plan.production_assets?.script);
  const voiceover = listOrEmpty(plan.production_assets?.voiceover_version);
  const onScreenText = listOrEmpty(plan.production_assets?.on_screen_text);
  const beatSheet = listOrEmpty(plan.content_blueprint?.beat_sheet);
  const narrativeArc = listOrEmpty(plan.content_blueprint?.narrative_arc);
  const directions = Array.isArray(plan.proposed_directions) ? plan.proposed_directions : [];
  const direction = directions.find((item) => item.id === plan.recommended_direction_id) ?? directions[0];
  const hookExamples = listOrEmpty(direction?.hook_examples);

  return normalizeUgcDraft(
    {
      hook: headlines[0] || scriptLines[0] || hookExamples[0] || `${brand.name} in one line.`,
      problem: scriptLines[1] || direction?.angle || narrativeArc[0] || brand.description,
      productMoment: scriptLines[2] || direction?.why_it_works || `${brand.name} shows the product moment clearly.`,
      outcome: scriptLines[3] || direction?.emotional_driver || narrativeArc.at(-1) || brand.cta,
      cta: brand.cta,
      toneNotes: plan.brief_interpretation?.tone || brand.tone,
      fullScript: [...(voiceover.length > 0 ? voiceover : scriptLines), brand.cta].filter(Boolean).join(" "),
      beatSheet,
      onScreenText: onScreenText.length > 0 ? onScreenText : headlines
    },
    brand
  );
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
  const { brand, platform, voiceId, visualMode, creativePlan, creativeProjectId, uploadedAssets = [], outputRoot } = params;
  const script = creativePlan
    ? buildUgcDraftFromCreativePlan(creativePlan, brand)
    : normalizeUgcDraft((params.script || {}) as Partial<UgcScriptDraft> & Record<string, unknown>, brand);
  const videoPrompt = buildUgcPromptContext({ brand, platform, visualMode, script });
  const metadata = await runPipelineFromRequest(
    {
      brandProfileId: brand.id,
      rawIdea: videoPrompt,
      notes: script.fullScript,
      creativeProjectId,
      creativePlan,
      cards: [],
      references: [],
      uploadedAssets,
      platformTargets: [platform],
      goal: brand.defaults.goal || "awareness",
      workflowType: "video-clip",
      visualMode: "mixed",
      deliveryTargets: platform,
      styleControl: {
        styleCardId: "ugc-voiceover-story",
        generationMode: "reference-match",
        referenceLockStrength: "loose"
      },
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

  metadata.voiceover = {
    script: script.fullScript,
    audioPath: voiceResult.audioPath,
    voiceId: voiceResult.voiceId,
    durationEstimate: voiceResult.durationEstimate
  };
  await fs.writeFile(path.join(metadata.output_dir, "ugc-script.json"), `${JSON.stringify(script, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(metadata.output_dir, "ugc-script.txt"), `${script.fullScript}\n`, "utf8");
  await fs.writeFile(path.join(metadata.output_dir, "beat-sheet.txt"), `${script.beatSheet.join("\n")}\n`, "utf8");
  await fs.writeFile(path.join(metadata.output_dir, "on-screen-text.txt"), `${script.onScreenText.join("\n")}\n`, "utf8");
  await fs.writeFile(path.join(metadata.output_dir, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

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
