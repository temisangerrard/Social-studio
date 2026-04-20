import fs from "node:fs/promises";
import path from "node:path";
import type { AssetAnalysis, AssetType, BrandProfile, ContentHint, Platform, UploadedAsset } from "./types.ts";

const VALID_ASSET_TYPES: AssetType[] = ["food_photo", "product_photo", "person_photo", "screenshot", "logo", "document", "unknown"];
const VALID_CONTENT_HINTS: ContentHint[] = ["carousel", "edited-image", "recipe", "flyer", "linkedin-post", "infographic"];
const VALID_CHANNEL_HINTS: Platform[] = ["instagram", "tiktok", "linkedin"];

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, value));
}

function isAssetType(value: unknown): value is AssetType {
  return typeof value === "string" && VALID_ASSET_TYPES.includes(value as AssetType);
}

function normalizeContentHints(value: unknown): ContentHint[] {
  return unique((Array.isArray(value) ? value : []).filter((item): item is ContentHint =>
    typeof item === "string" && VALID_CONTENT_HINTS.includes(item as ContentHint)
  ));
}

function normalizeChannelHints(value: unknown): Platform[] {
  return unique((Array.isArray(value) ? value : []).filter((item): item is Platform =>
    typeof item === "string" && VALID_CHANNEL_HINTS.includes(item as Platform)
  ));
}

function filenameStem(filename: string): string {
  return path.basename(filename, path.extname(filename)).replace(/[-_]+/g, " ").trim();
}

function inferAssetType(combinedText: string, asset: UploadedAsset): AssetType {
  const text = combinedText.toLowerCase();
  if (text.includes("logo")) return "logo";
  if (text.includes("screenshot") || text.includes("screen") || text.includes("ui")) return "screenshot";
  if (text.includes("document") || text.includes("pdf") || asset.mimeType === "application/pdf") return "document";
  if (text.includes("recipe") || text.includes("food") || text.includes("meal") || text.includes("pasta") || text.includes("dish")) return "food_photo";
  if (text.includes("person") || text.includes("portrait") || text.includes("selfie") || text.includes("team")) return "person_photo";
  if (asset.mimeType.startsWith("image/")) return "product_photo";
  return "unknown";
}

function inferContentHints(combinedText: string): ContentHint[] {
  const text = combinedText.toLowerCase();
  const hints: ContentHint[] = [];
  if (/\brecipe\b|\bcook\b|\bmeal\b|\bdinner\b|\bfood\b/u.test(text)) hints.push("recipe");
  if (/\bcarousel\b|\bslides?\b|\bswipe\b/u.test(text)) hints.push("carousel");
  if (/\blinkedin\b|\bthought leadership\b|\btext post\b/u.test(text)) hints.push("linkedin-post");
  if (/\bflyer\b|\bposter\b|\blaunch\b|\bannouncement\b/u.test(text)) hints.push("flyer");
  if (/\binfographic\b|\bdata\b|\bstats?\b|\bbreakdown\b/u.test(text)) hints.push("infographic");
  if (/\bedit\b|\blogo\b|\boverlay\b|\bcta\b/u.test(text)) hints.push("edited-image");
  return unique(hints);
}

function inferChannelHints(combinedText: string): Platform[] {
  const text = combinedText.toLowerCase();
  const hints: Platform[] = [];
  if (text.includes("linkedin")) hints.push("linkedin");
  if (text.includes("tiktok")) hints.push("tiktok");
  if (text.includes("instagram")) hints.push("instagram");
  return unique(hints);
}

function buildFallbackAnalysis(asset: UploadedAsset, prompt: string): AssetAnalysis {
  const combinedText = `${asset.filename} ${asset.label ?? ""} ${asset.notes ?? ""} ${prompt}`.trim();
  const assetType = inferAssetType(combinedText, asset);
  const contentHints = inferContentHints(combinedText);
  const channelHints = inferChannelHints(combinedText);
  const label = asset.label?.trim() || asset.notes?.trim() || filenameStem(asset.filename) || "Uploaded asset";

  return {
    assetId: asset.id,
    assetType,
    subjectSummary: label,
    contentHints,
    channelHints,
    confidence: assetType === "unknown" ? 0.35 : 0.62,
    needsUserConfirmation: assetType === "unknown",
    source: "fallback"
  };
}

function cleanJsonString(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }
  return trimmed.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
}

export function normalizeAssetAnalysis(input: unknown, asset: UploadedAsset): AssetAnalysis {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const confidence = clampConfidence(record.confidence);
  return {
    assetId: typeof record.assetId === "string" ? record.assetId : asset.id,
    assetType: isAssetType(record.assetType) ? record.assetType : "unknown",
    subjectSummary: typeof record.subjectSummary === "string" && record.subjectSummary.trim()
      ? record.subjectSummary.trim()
      : asset.label?.trim() || asset.notes?.trim() || filenameStem(asset.filename) || "Uploaded asset",
    contentHints: normalizeContentHints(record.contentHints),
    channelHints: normalizeChannelHints(record.channelHints),
    confidence,
    needsUserConfirmation: typeof record.needsUserConfirmation === "boolean" ? record.needsUserConfirmation : confidence < 0.55,
    source: record.source === "glm" ? "glm" : "fallback"
  };
}

async function analyzeWithGlmProvider(asset: UploadedAsset, brand: BrandProfile, prompt: string, assetDataUrl?: string): Promise<Partial<AssetAnalysis>> {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey || !assetDataUrl) {
    throw new Error("GLM vision unavailable");
  }

  const apiUrl = process.env.GLM_API_URL ?? "https://open.bigmodel.cn/api/paas/v4/chat/completions";
  const model = process.env.GLM_MODEL ?? brand.providers.plannerModel ?? "glm-4.5";

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Classify uploaded marketing assets and respond with strict JSON only."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                `Brand: ${brand.name}`,
                `Prompt: ${prompt}`,
                `Known label: ${asset.label ?? "none"}`,
                `Known notes: ${asset.notes ?? "none"}`,
                "Return JSON with: assetType, subjectSummary, contentHints, channelHints, confidence, needsUserConfirmation."
              ].join("\n")
            },
            {
              type: "image_url",
              image_url: {
                url: assetDataUrl
              }
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`GLM request failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("GLM response did not include message content");
  }
  return JSON.parse(cleanJsonString(content)) as Partial<AssetAnalysis>;
}

export async function analyzeUploadedAsset(
  asset: UploadedAsset,
  brand: BrandProfile,
  prompt: string,
  options?: {
    analyzeWithProvider?: (asset: UploadedAsset, brand: BrandProfile, prompt: string) => Promise<Partial<AssetAnalysis>>;
    assetDataUrl?: string;
  }
): Promise<AssetAnalysis> {
  try {
    const provider = options?.analyzeWithProvider
      ?? ((nextAsset: UploadedAsset, nextBrand: BrandProfile, nextPrompt: string) =>
        analyzeWithGlmProvider(nextAsset, nextBrand, nextPrompt, options?.assetDataUrl));
    const raw = await provider(asset, brand, prompt);
    return {
      ...normalizeAssetAnalysis({ ...raw, source: "glm" }, asset),
      source: "glm"
    };
  } catch {
    return buildFallbackAnalysis(asset, prompt);
  }
}

export async function filePathToDataUrl(filePath: string, mimeType: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
