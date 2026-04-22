import type {
  BrandProfile,
  DeliveryTarget,
  GenerationRequest,
  PlannedPackage,
  ReelClipBrief,
  ReelPackageDraft,
  ReferenceAsset,
  VisualMode,
  VideoOptions,
  WorkflowRecipe,
  WorkflowType
} from "./types.ts";

export function resolveWorkflowType(request: GenerationRequest): WorkflowType {
  return request.workflowType ?? "slideshow";
}

export function resolveVisualMode(request: GenerationRequest): VisualMode {
  return request.visualMode ?? "mascot-led";
}

export function resolveDeliveryTargets(request: GenerationRequest): DeliveryTarget {
  return request.deliveryTargets ?? "both";
}

export function resolveVariantCount(request: GenerationRequest): number {
  return Math.max(4, Math.min(8, request.variantCount ?? 4));
}

export function resolveVideoOptions(request: GenerationRequest): VideoOptions {
  return {
    duration: request.videoOptions?.duration ?? 5,
    aspectRatio: request.videoOptions?.aspectRatio ?? "9:16",
    withAudio: request.videoOptions?.withAudio ?? true,
    consistencyMode: request.videoOptions?.consistencyMode ?? "prompt-led"
  };
}

export function buildWorkflowReferenceAssets(request: GenerationRequest, brand: BrandProfile): ReferenceAsset[] {
  const uploadedAssetReferences = (request.uploadedAssets ?? [])
    .filter((asset) => asset.mimeType.startsWith("image/"))
    .map((asset) => ({
      id: asset.id,
      label: asset.label || asset.filename,
      url: asset.url,
      source: "asset" as const,
      kind: "image" as const
    }));

  const references = [...uploadedAssetReferences, ...(request.referenceAssets ?? [])];

  if (brand.mascot) {
    const mascotReferences = (brand.mascot.referenceImages ?? []).map((url, index) => ({
      id: `brand-mascot-${index + 1}`,
      label: `${brand.mascot?.name ?? brand.name} Reference ${index + 1}`,
      url,
      source: "brand" as const,
      kind: "image" as const
    }));

    for (const reference of mascotReferences) {
      if (!references.some((existing) => existing.url === reference.url)) {
        references.push(reference);
      }
    }
  }

  return references;
}

export function buildWorkflowRecipe(request: GenerationRequest): WorkflowRecipe {
  const workflowType = resolveWorkflowType(request);
  const videoOptions = resolveVideoOptions(request);

  if (workflowType === "reference-edit") {
    return {
      workflowType,
      operation: "image-edit",
      model: "fal-ai/nano-banana-2/edit"
    };
  }

  if (workflowType === "mascot-variants") {
    return {
      workflowType,
      operation: "image-generate",
      model: "fal-ai/nano-banana-2"
    };
  }

  if (workflowType === "video-clip") {
    if (videoOptions.consistencyMode === "mascot-consistent" || (request.referenceAssets?.length ?? 0) > 0) {
      return {
        workflowType,
        operation: "reference-video-generate",
        model: "fal-ai/pixverse/c1/reference-to-video"
      };
    }

    return {
      workflowType,
      operation: "video-generate",
      model: "fal-ai/kling-video/v2.6/pro/text-to-video"
    };
  }

  if (workflowType === "reel-package") {
    return {
      workflowType,
      operation: "planner-only",
      model: "planner-first"
    };
  }

  if (workflowType === "linkedin-carousel") {
    return {
      workflowType,
      operation: "image-generate",
      model: "fal-ai/flux/schnell"
    };
  }

  if (workflowType === "linkedin-text") {
    return {
      workflowType,
      operation: "planner-only",
      model: "planner-first"
    };
  }

  if (workflowType === "ugc-faceless" || workflowType === "ugc-voiceover") {
    return {
      workflowType,
      operation: "image-generate",
      model: "fal-ai/flux/schnell"
    };
  }

  return {
    workflowType,
    operation: "image-generate",
    model: "fal-ai/nano-banana-2"
  };
}

function makeClipBrief(id: string, title: string, prompt: string, references: string[]): ReelClipBrief {
  return { id, title, prompt, references };
}

export function createReelPackageDraft(
  plan: PlannedPackage,
  request: GenerationRequest,
  brand: BrandProfile
): ReelPackageDraft {
  const references = buildWorkflowReferenceAssets(request, brand).map((item) => item.url);
  const clipBriefs = [
    makeClipBrief(
      "clip-1",
      "Hook and problem",
      `${plan.slides[0]?.text ?? "Hook"}. ${plan.slides[1]?.text ?? "Problem"}. ${plan.slides[2]?.image_prompt ?? plan.slides[2]?.text ?? ""}`.trim(),
      references
    ),
    makeClipBrief(
      "clip-2",
      "Discovery and reveal",
      `${plan.slides[3]?.text ?? ""}. ${plan.slides[4]?.text ?? ""}. ${plan.slides[5]?.image_prompt ?? plan.slides[5]?.text ?? ""}`.trim(),
      references
    ),
    makeClipBrief(
      "clip-3",
      "Benefit and CTA",
      `${plan.slides[6]?.text ?? ""}. ${plan.slides[7]?.text ?? ""}`.trim(),
      references
    )
  ];

  return {
    clipBriefs,
    voiceoverScript: `${brand.name} reel for ${resolveDeliveryTargets(request)}: ${plan.caption}`,
    subtitleDraft: clipBriefs.map((clip) => clip.title).join("\n")
  };
}
