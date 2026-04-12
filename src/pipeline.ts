import fs from "node:fs/promises";
import path from "node:path";
import { generateFalImageAsset, generateFalVideoAsset } from "./fal-media.ts";
import { generateImagesForSlides } from "./image-generator.ts";
import { planSocialPackage } from "./planner.ts";
import { renderSlides } from "./renderer.ts";
import {
  buildWorkflowRecipe,
  buildWorkflowReferenceAssets,
  createReelPackageDraft,
  resolveDeliveryTargets,
  resolveVariantCount,
  resolveVideoOptions,
  resolveWorkflowType
} from "./workflow-engine.ts";
import type {
  BrandProfile,
  ContentBrief,
  GenerationRequest,
  GeneratedArtifact,
  PipelineOptions,
  Platform,
  PostMetadata
} from "./types.ts";

interface PipelineDependencies {
  planPackage: typeof planSocialPackage;
  generateSlideImages: typeof generateImagesForSlides;
  renderPackageSlides: typeof renderSlides;
}

let environmentLoaded = false;

async function loadEnvironment(): Promise<void> {
  if (environmentLoaded) {
    return;
  }

  try {
    const dotenv = await import("dotenv");
    dotenv.config();
  } catch {
    // Optional.
  }

  environmentLoaded = true;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function brandProfileFromBrief(brief: ContentBrief): BrandProfile {
  return {
    id: slugify(brief.product),
    name: brief.product,
    description: `${brief.product} social profile`,
    tone: brief.tone,
    audience: brief.audience,
    cta: brief.goal === "installs" ? `Download ${brief.product}` : `Try ${brief.product}`,
    logoPath: null,
    visual: {
      primaryColor: "#f04d23",
      secondaryColor: "#ffd9c8",
      accentColor: "#7a2413",
      surfaceColor: "#fff7f0"
    },
    defaults: {
      platformTargets: [brief.platform],
      goal: brief.goal,
      hashtags: [`#${slugify(brief.product)}`, "#socialcontent"]
    },
    providers: {
      plannerModel: process.env.GLM_MODEL ?? "glm-4.5-air",
      imageModel: process.env.FAL_MODEL ?? "fal-ai/flux/schnell"
    }
  };
}

function requestFromBrief(brief: ContentBrief): GenerationRequest {
  return {
    brandProfileId: slugify(brief.product),
    rawIdea: brief.idea,
    notes: `Pillar: ${brief.pillar}. Ingredients: ${(brief.ingredients ?? []).join(", ") || "none"}.`,
    cards: [
      {
        id: "brief-idea",
        type: "idea",
        text: brief.idea,
        x: 80,
        y: 80,
        width: 280,
        height: 180,
        tags: ["idea"]
      },
      {
        id: "brief-audience",
        type: "audience",
        text: brief.audience,
        x: 420,
        y: 80,
        width: 240,
        height: 160,
        tags: ["audience"]
      }
    ],
    references: [],
    platformTargets: [brief.platform],
    goal: brief.goal,
    workflowType: "slideshow",
    deliveryTargets: brief.platform
  };
}

function normalizeBrief(input: unknown): ContentBrief {
  if (!input || typeof input !== "object") {
    throw new Error("Brief must be a JSON object.");
  }

  const brief = input as Record<string, unknown>;
  const requiredStrings = ["product", "platform", "format", "pillar", "audience", "tone", "goal", "idea"];
  for (const key of requiredStrings) {
    if (typeof brief[key] !== "string" || !String(brief[key]).trim()) {
      throw new Error(`Brief is missing required string field: ${key}`);
    }
  }

  const ingredients = brief.ingredients;
  if (ingredients !== undefined && (!Array.isArray(ingredients) || ingredients.some((item) => typeof item !== "string"))) {
    throw new Error("Brief field 'ingredients' must be an array of strings when provided.");
  }

  if (brief.platform !== "tiktok" && brief.platform !== "instagram") {
    throw new Error("Brief field 'platform' must be either 'tiktok' or 'instagram'.");
  }

  return {
    product: String(brief.product),
    platform: brief.platform as Platform,
    format: "slideshow",
    pillar: String(brief.pillar),
    audience: String(brief.audience),
    tone: String(brief.tone),
    ingredients: (ingredients as string[] | undefined) ?? [],
    goal: String(brief.goal),
    idea: String(brief.idea)
  };
}

function normalizeRequest(input: unknown): GenerationRequest {
  if (!input || typeof input !== "object") {
    throw new Error("Generation request must be a JSON object.");
  }

  const request = input as Record<string, unknown>;
  const videoOptions =
    request.videoOptions && typeof request.videoOptions === "object"
      ? (request.videoOptions as Record<string, unknown>)
      : null;
  if (typeof request.brandProfileId !== "string" || !request.brandProfileId.trim()) {
    throw new Error("Generation request is missing brandProfileId.");
  }
  if (typeof request.rawIdea !== "string" || !request.rawIdea.trim()) {
    throw new Error("Generation request is missing rawIdea.");
  }
  if (!Array.isArray(request.cards)) {
    throw new Error("Generation request is missing cards.");
  }
  if (!Array.isArray(request.platformTargets) || request.platformTargets.length === 0) {
    throw new Error("Generation request is missing platformTargets.");
  }

  return {
    brandProfileId: request.brandProfileId,
    boardId: typeof request.boardId === "string" ? request.boardId : undefined,
    rawIdea: request.rawIdea,
    notes: typeof request.notes === "string" ? request.notes : "",
    cards: request.cards as GenerationRequest["cards"],
    references: Array.isArray(request.references) ? (request.references as GenerationRequest["references"]) : [],
    referenceAssets: Array.isArray(request.referenceAssets) ? (request.referenceAssets as GenerationRequest["referenceAssets"]) : [],
    platformTargets: request.platformTargets as Platform[],
    goal: typeof request.goal === "string" ? request.goal : "awareness",
    workflowType:
      request.workflowType === "slideshow" ||
      request.workflowType === "mascot-variants" ||
      request.workflowType === "reference-edit" ||
      request.workflowType === "video-clip" ||
      request.workflowType === "reel-package"
        ? request.workflowType
        : "slideshow",
    visualMode:
      request.visualMode === "mascot-led" || request.visualMode === "food-led" || request.visualMode === "mixed"
        ? request.visualMode
        : "mascot-led",
    targetAssetId: typeof request.targetAssetId === "string" ? request.targetAssetId : undefined,
    videoOptions:
      videoOptions
        ? {
            duration: videoOptions.duration === 10 || videoOptions.duration === 15 ? videoOptions.duration : 5,
            aspectRatio:
              videoOptions.aspectRatio === "16:9" || videoOptions.aspectRatio === "1:1"
                ? videoOptions.aspectRatio
                : "9:16",
            withAudio: videoOptions.withAudio !== false,
            consistencyMode: videoOptions.consistencyMode === "mascot-consistent" ? "mascot-consistent" : "prompt-led"
          }
        : undefined,
    variantCount: typeof request.variantCount === "number" ? request.variantCount : undefined,
    deliveryTargets:
      request.deliveryTargets === "tiktok" || request.deliveryTargets === "instagram" || request.deliveryTargets === "both"
        ? request.deliveryTargets
        : "both"
  };
}

async function readBrief(briefPath: string): Promise<ContentBrief> {
  const raw = await fs.readFile(briefPath, "utf8");
  return normalizeBrief(JSON.parse(raw));
}

async function nextPostId(outputRoot: string, product: string, platform: string): Promise<string> {
  await fs.mkdir(outputRoot, { recursive: true });
  const entries = await fs.readdir(outputRoot, { withFileTypes: true });
  const platformCode = platform.toLowerCase() === "tiktok" ? "tt" : "ig";
  const prefix = `${slugify(product)}_${platformCode}_`;
  const numbers = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => Number(entry.name.replace(prefix, "")))
    .filter((value) => Number.isFinite(value));
  const nextNumber = (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}

async function writeRunFiles(metadata: PostMetadata): Promise<void> {
  await fs.writeFile(path.join(metadata.output_dir, "caption.txt"), `${metadata.caption}\n`, "utf8");
  await fs.writeFile(path.join(metadata.output_dir, "hooks.txt"), `${metadata.hooks.join("\n")}\n`, "utf8");
  await fs.writeFile(path.join(metadata.output_dir, "hashtags.txt"), `${metadata.hashtags.join(" ")}\n`, "utf8");
  if (metadata.reel_package) {
    await fs.writeFile(path.join(metadata.output_dir, "voiceover.txt"), `${metadata.reel_package.voiceoverScript}\n`, "utf8");
    await fs.writeFile(path.join(metadata.output_dir, "subtitles.txt"), `${metadata.reel_package.subtitleDraft}\n`, "utf8");
    await fs.writeFile(
      path.join(metadata.output_dir, "clip-briefs.json"),
      `${JSON.stringify(metadata.reel_package.clipBriefs, null, 2)}\n`,
      "utf8"
    );
  }
  await fs.writeFile(path.join(metadata.output_dir, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}

async function createPlaceholderImageArtifact(params: {
  prompt: string;
  title: string;
  role: string;
  assetsDir: string;
  brandName: string;
  brandColors: { primaryColor: string; secondaryColor: string };
}): Promise<string | null> {
  const slides = await generateImagesForSlides(
    [
      {
        slide_number: 1,
        role: "problem",
        type: "generated_image",
        text: params.title,
        image_prompt: params.prompt,
        visual_goal: "",
        layout: "image_focus",
        asset_path: null
      }
    ],
    {
      assetsDir: params.assetsDir,
      falKey: undefined,
      brandName: params.brandName,
      brandColors: params.brandColors
    }
  );

  return slides[0]?.asset_path ?? null;
}

async function createImageArtifact(params: {
  prompt: string;
  title: string;
  role: string;
  artifactId: string;
  assetsDir: string;
  brandProfile: BrandProfile;
  request: GenerationRequest;
  sourceAssetId?: string;
}): Promise<GeneratedArtifact> {
  const recipe = buildWorkflowRecipe(params.request);
  const references = buildWorkflowReferenceAssets(params.request, params.brandProfile);
  let assetPath = await generateFalImageAsset({
    prompt: params.prompt,
    assetsDir: params.assetsDir,
    fileStem: params.artifactId,
    falKey: process.env.FAL_KEY,
    recipe,
    references
  });

  if (!assetPath) {
    assetPath = await createPlaceholderImageArtifact({
      prompt: params.prompt,
      title: params.title,
      role: params.role,
      assetsDir: params.assetsDir,
      brandName: params.brandProfile.name,
      brandColors: {
        primaryColor: params.brandProfile.visual.primaryColor,
        secondaryColor: params.brandProfile.visual.secondaryColor
      }
    });
  }

  return {
    id: params.artifactId,
    kind: "image",
    role: params.role,
    title: params.title,
    prompt: params.prompt,
    asset_path: assetPath,
    preview_path: assetPath,
    source_asset_id: params.sourceAssetId ?? null,
    variant_group: params.request.workflowType === "mascot-variants" ? "variant-pack" : null
  };
}

async function createVideoArtifact(params: {
  prompt: string;
  title: string;
  role: string;
  artifactId: string;
  assetsDir: string;
  brandProfile: BrandProfile;
  request: GenerationRequest;
}): Promise<GeneratedArtifact> {
  const recipe = buildWorkflowRecipe(params.request);
  const references = buildWorkflowReferenceAssets(params.request, params.brandProfile);
  const videoOptions = resolveVideoOptions(params.request);
  const assetPath = await generateFalVideoAsset({
    prompt: params.prompt,
    assetsDir: params.assetsDir,
    fileStem: params.artifactId,
    falKey: process.env.FAL_KEY,
    recipe,
    references,
    videoOptions
  });

  return {
    id: params.artifactId,
    kind: "video",
    role: params.role,
    title: params.title,
    prompt: params.prompt,
    asset_path: assetPath,
    preview_path: assetPath,
    source_asset_id: params.request.targetAssetId ?? null,
    variant_group: params.request.workflowType === "reel-package" ? "reel-clips" : null
  };
}

export async function runPipelineFromRequest(
  requestInput: GenerationRequest,
  brandProfile: BrandProfile,
  outputRoot?: string,
  dependencies?: Partial<PipelineDependencies>
): Promise<PostMetadata> {
  await loadEnvironment();
  const root = outputRoot ?? path.resolve("outputs");
  const request = normalizeRequest(requestInput);
  const postId = await nextPostId(root, brandProfile.name, request.platformTargets[0] ?? "tiktok");
  const postDir = path.join(root, postId);
  const assetsDir = path.join(postDir, "assets", "generated");
  const slidesDir = path.join(postDir, "slides");
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.mkdir(slidesDir, { recursive: true });

  const planner = dependencies?.planPackage ?? planSocialPackage;
  const imageGenerator = dependencies?.generateSlideImages ?? generateImagesForSlides;
  const renderer = dependencies?.renderPackageSlides ?? renderSlides;

  const { plan, provider } = await planner({
    brand: brandProfile,
    request
  });
  const workflowType = resolveWorkflowType(request);
  const deliveryTargets = resolveDeliveryTargets(request);

  const brief: ContentBrief = {
    product: brandProfile.name,
    platform: request.platformTargets[0] ?? "tiktok",
    format: "slideshow",
    pillar: "canvas-planning",
    audience: brandProfile.audience,
    tone: brandProfile.tone,
    goal: request.goal,
    idea: request.rawIdea,
    ingredients: []
  };

  const metadata: PostMetadata = {
    post_id: postId,
    product: brandProfile.name,
    platform: brief.platform,
    format: "slideshow",
    workflow_type: workflowType,
    delivery_targets: deliveryTargets,
    caption: plan.caption,
    hooks: plan.hooks,
    hashtags: plan.hashtags,
    platform_notes: plan.platformNotes,
    brief,
    brand_profile: brandProfile,
    generation_request: request,
    slides: [],
    artifacts: [],
    reel_package: null,
    output_dir: postDir,
    assets_dir: assetsDir,
    slides_dir: slidesDir,
    created_at: new Date().toISOString(),
    planner_provider: provider,
    image_provider: process.env.FAL_KEY ? "fal" : "mock",
    render_status: "complete",
    render_error: null
  };

  if (workflowType === "slideshow") {
    const slidesWithAssets = await imageGenerator(plan.slides, {
      assetsDir,
      falKey: process.env.FAL_KEY,
      falModel: process.env.FAL_MODEL ?? brandProfile.providers.imageModel,
      brandName: brandProfile.name,
      brandColors: {
        primaryColor: brandProfile.visual.primaryColor,
        secondaryColor: brandProfile.visual.secondaryColor
      },
      mascotReferenceImages: brandProfile.mascot?.referenceImages ?? []
    });
    metadata.slides = slidesWithAssets;
    metadata.artifacts = slidesWithAssets.map((slide) => ({
      id: `slide-${String(slide.slide_number).padStart(2, "0")}`,
      kind: "image",
      role: slide.role,
      title: slide.text,
      prompt: slide.image_prompt ?? slide.text,
      asset_path: slide.asset_path ?? null,
      preview_path: slide.asset_path ?? null,
      source_asset_id: null,
      variant_group: null
    }));

    try {
      await renderer(metadata);
    } catch (error) {
      metadata.render_status = "skipped";
      metadata.render_error = error instanceof Error ? error.message : String(error);
    }
  } else if (workflowType === "mascot-variants") {
    const count = resolveVariantCount(request);
    const variantAngles = ["hero framing", "playful kitchen pose", "product showcase", "reaction moment", "overhead layout", "close-up expression", "editorial composition", "social cover composition"];
    metadata.artifacts = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        createImageArtifact({
          prompt: `${request.rawIdea}. Variant direction: ${variantAngles[index] ?? "social variation"}.`,
          title: `${brandProfile.name} Variant ${index + 1}`,
          role: "variant",
          artifactId: `variant-${index + 1}`,
          assetsDir,
          brandProfile,
          request
        })
      )
    );
    metadata.render_status = "skipped";
  } else if (workflowType === "reference-edit") {
    metadata.artifacts = [
      await createImageArtifact({
        prompt: request.rawIdea,
        title: "Refined Variant",
        role: "reference-edit",
        artifactId: "reference-edit-1",
        assetsDir,
        brandProfile,
        request,
        sourceAssetId: request.targetAssetId
      })
    ];
    metadata.render_status = "skipped";
  } else if (workflowType === "video-clip") {
    metadata.artifacts = [
      await createVideoArtifact({
        prompt: request.rawIdea,
        title: `${brandProfile.name} Video Clip`,
        role: "video-clip",
        artifactId: "video-clip-1",
        assetsDir,
        brandProfile,
        request
      })
    ];
    metadata.render_status = "skipped";
  } else if (workflowType === "reel-package") {
    metadata.reel_package = createReelPackageDraft(plan, request, brandProfile);
    const clipRequest: GenerationRequest = {
      ...request,
      workflowType: "video-clip"
    };
    metadata.artifacts = await Promise.all(
      metadata.reel_package.clipBriefs.map((clip, index) =>
        createVideoArtifact({
          prompt: clip.prompt,
          title: clip.title,
          role: "reel-clip",
          artifactId: `reel-clip-${index + 1}`,
          assetsDir,
          brandProfile,
          request: clipRequest
        })
      )
    );
    metadata.render_status = "skipped";
  }

  await writeRunFiles(metadata);
  return metadata;
}

export async function runPipelineFromBrief(
  briefInput: ContentBrief,
  outputRoot?: string
): Promise<PostMetadata> {
  const brief = normalizeBrief(briefInput);
  return runPipelineFromRequest(requestFromBrief(brief), brandProfileFromBrief(brief), outputRoot);
}

export async function runPipeline(options: PipelineOptions): Promise<PostMetadata> {
  const brief = await readBrief(path.resolve(options.briefPath));
  return runPipelineFromBrief(brief, options.outputRoot ?? path.resolve("outputs"));
}
