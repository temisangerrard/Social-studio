import type { BrandProfile, CalendarSlot, ContentPillar, GenerationRequest, Platform, PostMetadata, WorkflowType } from "./types.ts";

const DEFAULT_ANGLES = ["proof", "education", "product", "opinion", "conversion"] as const;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asPlatform(value: unknown, fallback: Platform = "instagram"): Platform {
  return value === "instagram" || value === "tiktok" || value === "linkedin" ? value : fallback;
}

function asWorkflowType(value: unknown, fallback: WorkflowType = "slideshow"): WorkflowType {
  const allowed: WorkflowType[] = ["slideshow", "mascot-variants", "reference-edit", "video-clip", "reel-package", "linkedin-carousel", "linkedin-text", "ugc-faceless", "ugc-voiceover"];
  return allowed.includes(value as WorkflowType) ? value as WorkflowType : fallback;
}

export function normalizeCalendarSlotInput(input: Record<string, unknown>): CalendarSlot {
  const now = new Date().toISOString();
  return {
    id: asString(input.id, ""),
    date: asString(input.date, new Date().toISOString().slice(0, 10)),
    brandProfileId: asString(input.brandProfileId, "peppera"),
    platform: asPlatform(input.platform),
    pillar: asString(input.pillar),
    idea: asString(input.idea),
    status: asString(input.status, "idea") as CalendarSlot["status"],
    outputPostId: asString(input.outputPostId) || undefined,
    jobId: asString(input.jobId) || undefined,
    angle: asString(input.angle) || undefined,
    format: asString(input.format) || undefined,
    audience: asString(input.audience) || undefined,
    cta: asString(input.cta) || undefined,
    notes: asString(input.notes) || undefined,
    workflowType: input.workflowType ? asWorkflowType(input.workflowType) : undefined,
    styleCardId: asString(input.styleCardId) || undefined,
    contentTypeId: asString(input.contentTypeId) || undefined,
    thumbnailUrl: asString(input.thumbnailUrl) || undefined,
    captionPreview: asString(input.captionPreview) || undefined,
    error: typeof input.error === "string" ? input.error : null,
    references: Array.isArray(input.references) ? input.references.filter((item): item is string => typeof item === "string") : [],
    tags: Array.isArray(input.tags) ? input.tags.filter((item): item is string => typeof item === "string") : [],
    createdAt: asString(input.createdAt, now),
    updatedAt: now,
  };
}

export function buildCalendarGenerationRequest(slot: CalendarSlot, brand: BrandProfile, pillar?: ContentPillar | null): GenerationRequest {
  const workflowType = slot.workflowType ?? pillar?.defaultWorkflowType ?? (slot.platform === "linkedin" ? "linkedin-carousel" : "slideshow");
  const styleCardId = slot.styleCardId ?? pillar?.defaultStyleCardId;
  const contentTypeId = slot.contentTypeId ?? pillar?.defaultContentTypeId;
  const audience = slot.audience || brand.audience;
  const cta = slot.cta || pillar?.defaultCta || brand.cta;
  const angle = slot.angle || "production";
  const notes = [
    slot.notes,
    `Audience: ${audience}`,
    `CTA: ${cta}`,
    `Format: ${slot.format || workflowType}`,
    `Calendar date: ${slot.date}`,
  ].filter(Boolean).join("\n");

  return {
    brandProfileId: slot.brandProfileId,
    rawIdea: [
      slot.idea,
      pillar ? `Pillar: ${pillar.name}. ${pillar.description}` : "",
      `Angle: ${angle}.`,
    ].filter(Boolean).join("\n"),
    notes,
    cards: [],
    references: [],
    platformTargets: [slot.platform],
    goal: pillar?.defaultGoal || brand.defaults?.goal || "awareness",
    workflowType,
    visualMode: "mascot-led",
    deliveryTargets: slot.platform,
    contentTypeId,
    calendarSlotId: slot.id,
    styleControl: {
      styleCardId: styleCardId || "editorial-cultural-carousel",
      generationMode: "image-first",
    },
  } as GenerationRequest;
}

export function createWeeklyCalendarPlan(params: {
  weekDates: string[];
  brandProfileId: string;
  pillars: ContentPillar[];
  existingSlots: CalendarSlot[];
}): CalendarSlot[] {
  const existingDates = new Set(params.existingSlots.filter((slot) => slot.brandProfileId === params.brandProfileId).map((slot) => slot.date));
  const weekdays = params.weekDates.slice(0, 5).filter((date) => !existingDates.has(date));
  const usablePillars = params.pillars.filter((pillar) => !pillar.brandProfileId || pillar.brandProfileId === params.brandProfileId);
  if (!usablePillars.length) return [];

  return weekdays.map((date, index) => {
    const pillar = usablePillars[index % usablePillars.length];
    const idea = pillar.exampleIdeas[index % Math.max(1, pillar.exampleIdeas.length)] || `${pillar.name}: ${DEFAULT_ANGLES[index % DEFAULT_ANGLES.length]} post`;
    return normalizeCalendarSlotInput({
      date,
      brandProfileId: params.brandProfileId,
      platform: pillar.platforms[0] || "instagram",
      pillar: pillar.id,
      idea,
      status: "brief_ready",
      angle: DEFAULT_ANGLES[index % DEFAULT_ANGLES.length],
      format: index === 4 ? "single-image" : "carousel",
      workflowType: pillar.defaultWorkflowType ?? "slideshow",
      styleCardId: pillar.defaultStyleCardId,
      contentTypeId: pillar.defaultContentTypeId,
      cta: pillar.defaultCta,
      tags: [pillar.name, DEFAULT_ANGLES[index % DEFAULT_ANGLES.length]],
    });
  });
}

function assetUrlFromPath(postId: string, assetPath?: string | null): string | undefined {
  if (!assetPath) return undefined;
  const filename = assetPath.split("/").pop();
  return filename ? `/api/assets/${postId}/${filename}` : undefined;
}

export function summarizeCalendarOutput(metadata: PostMetadata): Partial<CalendarSlot> {
  const firstArtifact = metadata.artifacts?.find((artifact) => artifact.asset_path);
  const firstSlide = metadata.slides?.find((slide) => slide.asset_path);
  return {
    outputPostId: metadata.post_id,
    status: "needs_review",
    thumbnailUrl: assetUrlFromPath(metadata.post_id, firstArtifact?.asset_path ?? firstSlide?.asset_path),
    captionPreview: metadata.caption ? metadata.caption.slice(0, 180) : undefined,
    error: null,
  };
}
