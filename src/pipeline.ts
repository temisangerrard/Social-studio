import fs from "node:fs/promises";
import path from "node:path";
import { generateFalImageAsset, generateFalVideoAsset } from "./fal-media.ts";
import { generateImagesForSlides } from "./image-generator.ts";
import { planSocialPackage, assignUploadedAssetsToSlides, assignUploadedAssetsToCarouselSlides } from "./planner.ts";
import { renderSlides } from "./renderer.ts";
import { buildRoutingTrace, routeGenerationRequest } from "./routing.ts";
import {
  buildWorkflowRecipe,
  buildWorkflowReferenceAssets,
  createReelPackageDraft,
  resolveDeliveryTargets,
  resolveVariantCount,
  resolveVideoOptions,
  resolveWorkflowType
} from "./workflow-engine.ts";
import { generateSlidesFromStyle, buildStructuredPrompt } from "./creative-director.ts";
import { listBuiltinPresets, resolveStyleCard } from "./style-library.ts";
import { generateVoiceover } from "./voice-generator.ts";
import type {
  BrandProfile,
  ContentBrief,
  ContentTypeDefinition,
  GenerationRequest,
  GeneratedArtifact,
  PipelineOptions,
  Platform,
  PostMetadata,
  StyleCard,
  StyleControlledRequest,
  UploadedAsset,
  AssetAnalysis
} from "./types.ts";

interface PipelineDependencies {
  planPackage: typeof planSocialPackage;
  generateSlideImages: typeof generateImagesForSlides;
  renderPackageSlides: typeof renderSlides;
}

// ── Content Type Validation ───────────────────────────────────────────────────

function isValidBlueprintEntry(entry: unknown): boolean {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.role === "string" &&
    (e.type === "text_only" || e.type === "generated_image") &&
    Array.isArray(e.textFields) &&
    (e.imagePromptTemplate === null || typeof e.imagePromptTemplate === "string") &&
    typeof e.layout === "string"
  );
}

function isValidContentType(ct: unknown): boolean {
  if (!ct || typeof ct !== "object") return false;
  const c = ct as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    typeof c.name === "string" &&
    typeof c.imageStyle === "string" &&
    Array.isArray(c.platformTargets) &&
    Array.isArray(c.slideBlueprint) &&
    (c.slideBlueprint as unknown[]).length > 0 &&
    (c.slideBlueprint as unknown[]).every(isValidBlueprintEntry)
  );
}

export function validateContentTypes(brand: BrandProfile): ContentTypeDefinition[] {
  if (!Array.isArray(brand.contentTypes)) return [];
  const valid: ContentTypeDefinition[] = [];
  for (const ct of brand.contentTypes) {
    if (isValidContentType(ct)) {
      valid.push(ct);
    } else {
      console.warn(`[pipeline] Skipping invalid content type in brand "${brand.id}":`, (ct as any)?.id ?? "unknown");
    }
  }
  return valid;
}

// ── Content Type Resolution ───────────────────────────────────────────────────

export function resolveContentType(
  brand: BrandProfile,
  contentTypeId?: string
): ContentTypeDefinition | null {
  const validTypes = validateContentTypes(brand);
  if (validTypes.length === 0) return null;

  // Try explicit contentTypeId first
  if (contentTypeId) {
    const match = validTypes.find((ct) => ct.id === contentTypeId);
    if (match) return match;
    console.warn(`[pipeline] Content type "${contentTypeId}" not found for brand "${brand.id}", trying default`);
  }

  // Fall back to defaultContentType
  if (brand.defaultContentType) {
    const defaultMatch = validTypes.find((ct) => ct.id === brand.defaultContentType);
    if (defaultMatch) return defaultMatch;
    console.warn(`[pipeline] Default content type "${brand.defaultContentType}" not found for brand "${brand.id}", using first`);
  }

  // Fall back to first valid content type
  return validTypes[0];
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
      primaryColor: "#893516",
      secondaryColor: "#FFDBC9",
      accentColor: "#FEF8F3",
      surfaceColor: "#FFFFFF"
    },
    defaults: {
      platformTargets: [brief.platform],
      goal: brief.goal,
      hashtags: [`#${slugify(brief.product)}`, "#socialcontent"]
    },
    providers: {
      plannerModel: process.env.GLM_MODEL ?? "glm-4.5-air",
      imageModel: process.env.FAL_MODEL ?? "fal-ai/nano-banana-2"
    }
  };
}

/**
 * Tries to load the brand profile from config/brands/{id}.json,
 * falls back to brandProfileFromBrief if not found.
 */
async function loadOrCreateBrandProfile(brief: ContentBrief): Promise<BrandProfile> {
  const id = slugify(brief.product);
  const configPath = path.resolve("config", "brands", `${id}.json`);
  try {
    const raw = await fs.readFile(configPath, "utf8");
    return JSON.parse(raw) as BrandProfile;
  } catch {
    return brandProfileFromBrief(brief);
  }
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
    deliveryTargets: brief.platform,
    styleControl: { styleCardId: listBuiltinPresets()[0].id, generationMode: "image-first" }
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
    uploadedAssets: Array.isArray(request.uploadedAssets) ? (request.uploadedAssets as UploadedAsset[]) : [],
    assetAnalyses: Array.isArray(request.assetAnalyses) ? (request.assetAnalyses as AssetAnalysis[]) : [],
    platformTargets: request.platformTargets as Platform[],
    goal: typeof request.goal === "string" ? request.goal : "awareness",
    workflowType:
      request.workflowType === "slideshow" ||
      request.workflowType === "mascot-variants" ||
      request.workflowType === "reference-edit" ||
      request.workflowType === "video-clip" ||
      request.workflowType === "reel-package" ||
      request.workflowType === "linkedin-carousel" ||
      request.workflowType === "linkedin-text" ||
      request.workflowType === "ugc-faceless" ||
      request.workflowType === "ugc-voiceover"
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
      request.deliveryTargets === "tiktok" || request.deliveryTargets === "instagram" || request.deliveryTargets === "both" || request.deliveryTargets === "linkedin" || request.deliveryTargets === "all"
        ? request.deliveryTargets
        : "both",
    contentTypeId: typeof request.contentTypeId === "string" ? request.contentTypeId : undefined,
    routingOverride:
      request.routingOverride && typeof request.routingOverride === "object"
        ? (request.routingOverride as GenerationRequest["routingOverride"])
        : undefined,
    routingDecision:
      request.routingDecision && typeof request.routingDecision === "object"
        ? (request.routingDecision as GenerationRequest["routingDecision"])
        : undefined,
    routingTrace:
      request.routingTrace && typeof request.routingTrace === "object"
        ? (request.routingTrace as GenerationRequest["routingTrace"])
        : undefined,
    styleControl:
      request.styleControl && typeof request.styleControl === "object"
        ? (request.styleControl as GenerationRequest["styleControl"])
        : { styleCardId: listBuiltinPresets()[0].id, generationMode: "image-first" as const }
  };
}

async function readBrief(briefPath: string): Promise<ContentBrief> {
  const raw = await fs.readFile(briefPath, "utf8");
  return normalizeBrief(JSON.parse(raw));
}

async function nextPostId(outputRoot: string, product: string, platform: string): Promise<string> {
  await fs.mkdir(outputRoot, { recursive: true });
  const entries = await fs.readdir(outputRoot, { withFileTypes: true });
  const normalizedPlatform = platform.toLowerCase();
  const platformCode =
    normalizedPlatform === "tiktok"
      ? "tt"
      : normalizedPlatform === "linkedin"
        ? "li"
        : "ig";
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

async function createPlaceholderVideoArtifact(params: {
  prompt: string;
  title: string;
  assetsDir: string;
  fileStem: string;
}): Promise<string> {
  await fs.mkdir(params.assetsDir, { recursive: true });
  const placeholderPath = path.join(params.assetsDir, `${params.fileStem}.txt`);
  await fs.writeFile(placeholderPath, `[MOCK VIDEO]\nPrompt: ${params.prompt}\nTitle: ${params.title}\n`, "utf8");
  return placeholderPath;
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
  let assetPath = await generateFalVideoAsset({
    prompt: params.prompt,
    assetsDir: params.assetsDir,
    fileStem: params.artifactId,
    falKey: process.env.FAL_KEY,
    recipe,
    references,
    videoOptions
  });

  if (!assetPath) {
    console.warn(`[pipeline] Video generation returned null for ${params.artifactId}, writing placeholder`);
    assetPath = await createPlaceholderVideoArtifact({
      prompt: params.prompt,
      title: params.title,
      assetsDir: params.assetsDir,
      fileStem: params.artifactId
    });
  }

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
  const root = outputRoot ?? path.resolve("workspace", "outputs");
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

  const assetAnalyses = request.assetAnalyses ?? [];
  const routingDecision = request.routingDecision ?? routeGenerationRequest({
    brand: brandProfile,
    request,
    assetAnalyses
  });
  const routingTrace = request.routingTrace ?? buildRoutingTrace({
    brand: brandProfile,
    request,
    assetAnalyses
  });

  const shouldPreferRouting = assetAnalyses.length > 0 || (request.uploadedAssets?.length ?? 0) > 0 || !!request.routingOverride;
  const effectiveContentTypeId = shouldPreferRouting ? (routingDecision.contentTypeId ?? request.contentTypeId) : request.contentTypeId;

  // Resolve content type from brand config
  const contentType = resolveContentType(brandProfile, effectiveContentTypeId);

  const { plan, provider } = await planner({
    brand: brandProfile,
    request: {
      ...request,
      contentTypeId: effectiveContentTypeId,
      routingDecision,
      routingTrace
    },
    contentType: contentType ?? undefined
  });
  const isUgcWorkflow = request.workflowType === "ugc-faceless" || request.workflowType === "ugc-voiceover";
  const hasExplicitStyle = isUgcWorkflow || (!!requestInput.styleControl?.styleCardId);
  const workflowType = hasExplicitStyle ? resolveWorkflowType(request) : (shouldPreferRouting ? routingDecision.workflowType : resolveWorkflowType(request));
  const deliveryTargets = shouldPreferRouting ? routingDecision.deliveryTargets : resolveDeliveryTargets(request);

  const isPepperaCarousel =
    !hasExplicitStyle &&
    (routingDecision.routeFamily === "recipe" ||
    ((brandProfile.id === "peppera" || brandProfile.name === "Peppera") && workflowType === "slideshow"));

  const brief: ContentBrief = {
    product: brandProfile.name,
    platform: request.platformTargets[0] ?? "tiktok",
    format: isPepperaCarousel ? "carousel" : "slideshow",
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
    platform: isPepperaCarousel ? "instagram" : brief.platform,
    format: isPepperaCarousel ? "carousel" : "slideshow",
    workflow_type: workflowType,
    delivery_targets: deliveryTargets,
    content_type_id: contentType?.id,
    content_recipe_id: routingDecision.recipeId,
    caption: plan.caption,
    hooks: plan.hooks,
    hashtags: plan.hashtags,
    platform_notes: plan.platformNotes,
    brief,
    brand_profile: brandProfile,
    generation_request: {
      ...request,
      contentTypeId: effectiveContentTypeId,
      routingDecision,
      routingTrace
    },
    uploaded_assets: request.uploadedAssets ?? [],
    asset_analyses: assetAnalyses,
    routing_decision: routingDecision,
    routing_trace: routingTrace,
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

  if (workflowType === "slideshow" || workflowType === "linkedin-carousel") {
    // ── Style-controlled generation path (always active) ────────────────────
    const styleControl = request.styleControl;
    let slidesToProcess = plan.slides;

    let style = resolveStyleCard(styleControl.styleCardId, []);
    if (!style) {
      console.warn(`[pipeline] Style card not found: ${styleControl.styleCardId} — falling back to default preset`);
      style = listBuiltinPresets()[0];
    }

    console.log(`[pipeline] Using style card: ${style.name}`);
    const control: StyleControlledRequest = {
      styleCardId: style.id,
      generationMode: styleControl.generationMode ?? "image-first",
      textDensity: styleControl.textDensity,
      imageTreatment: styleControl.imageTreatment,
      referenceLockStrength: styleControl.referenceLockStrength,
    };
    const styledSlides = generateSlidesFromStyle({ style, request, brand: brandProfile, control });
    // Merge planner copy with style-directed image prompts and layout
    slidesToProcess = styledSlides.map((styled, i) => {
      const plannerSlide = plan.slides[i];
      return {
        ...styled,
        text: plannerSlide?.text ?? styled.text,
      };
    });

    // Ensure uploaded assets are assigned to slides even if the planner didn't set them
    const hasUploads = (request.uploadedAssets ?? []).length > 0;
    const alreadyAssigned = slidesToProcess.some((s: any) => s.uploaded_asset_url != null);
    const finalSlides = (hasUploads && !alreadyAssigned)
      ? (isPepperaCarousel
          ? assignUploadedAssetsToCarouselSlides(slidesToProcess, request)
          : assignUploadedAssetsToSlides(slidesToProcess, request))
      : slidesToProcess;

    // Ensure every slide has a slide_number BEFORE any downstream processing
    // (planner may omit it — we derive from array index)
    finalSlides.forEach((s: any, i: number) => {
      s.slide_number = i + 1;
    });

    const slidesWithAssets = await imageGenerator(finalSlides, {
      assetsDir,
      falKey: process.env.FAL_KEY,
      falModel: process.env.FAL_MODEL ?? brandProfile.providers.imageModel,
      brandName: brandProfile.name,
      brandColors: {
        primaryColor: brandProfile.visual.primaryColor,
        secondaryColor: brandProfile.visual.secondaryColor
      },
      mascotReferenceImages: brandProfile.mascot?.referenceImages ?? [],
      uploadedAssets: (request.uploadedAssets ?? []).map(a => ({
        id: a.id,
        url: a.url,
        mimeType: a.mimeType,
        filename: a.filename
      }))
    });
    metadata.slides = slidesWithAssets;
    metadata.artifacts = slidesWithAssets.map((slide, index) => {
      // Guard: if slide_number is still undefined or NaN after the loop, default to index + 1
      const slideNumber = (typeof slide.slide_number === "number" && !Number.isNaN(slide.slide_number))
        ? slide.slide_number
        : index + 1;
      return {
        id: `slide-${String(slideNumber).padStart(2, "0")}`,
        kind: "image" as const,
        role: slide.role,
        title: slide.text,
        prompt: slide.image_prompt ?? slide.text,
        asset_path: slide.asset_path ?? null,
        preview_path: slide.asset_path ?? null,
        slide_number: slideNumber,
        source_asset_id: null,
        variant_group: null,
      };
    });

    try {
      await renderer(metadata);
    } catch (error) {
      metadata.render_status = "skipped";
      metadata.render_error = error instanceof Error ? error.message : String(error);
    }
  } else if (workflowType === "linkedin-text") {
    metadata.render_status = "skipped";
  } else if (workflowType === "ugc-faceless" || workflowType === "ugc-voiceover") {
    // UGC: generate slides (visuals) + voiceover audio
    const finalSlides = plan.slides;
    finalSlides.forEach((s: any, i: number) => { s.slide_number = i + 1; });

    const slidesWithAssets = await imageGenerator(finalSlides, {
      assetsDir,
      falKey: process.env.FAL_KEY,
      falModel: process.env.FAL_MODEL ?? brandProfile.providers.imageModel,
      brandName: brandProfile.name,
      brandColors: {
        primaryColor: brandProfile.visual.primaryColor,
        secondaryColor: brandProfile.visual.secondaryColor
      },
    });
    metadata.slides = slidesWithAssets;
    metadata.artifacts = slidesWithAssets.map((slide, index) => ({
      id: `slide-${String(index + 1).padStart(2, "0")}`,
      kind: "image" as const,
      role: slide.role,
      title: slide.text,
      prompt: slide.image_prompt ?? slide.text,
      asset_path: slide.asset_path ?? null,
      preview_path: slide.asset_path ?? null,
      source_asset_id: null,
      variant_group: null,
    }));

    // Generate voiceover script from slide narrative (not generic slide text)
    const voiceoverScript = metadata.slides
      .map((s: any) => s.text)
      .filter((t: string) => t && !t.startsWith("Content slide"))
      .join("\n\n");

    const voiceResult = await generateVoiceover(
      voiceoverScript,
      assetsDir,
      "voiceover"
    );
    metadata.voiceover = {
      script: voiceoverScript,
      audioPath: voiceResult.audioPath,
      voiceId: voiceResult.voiceId,
      durationEstimate: voiceResult.durationEstimate,
    };

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

    // Generate voiceover for the reel package
    const voiceResult = await generateVoiceover(
      metadata.reel_package.voiceoverScript,
      assetsDir,
      "voiceover"
    );
    metadata.voiceover = {
      script: metadata.reel_package.voiceoverScript,
      audioPath: voiceResult.audioPath,
      voiceId: voiceResult.voiceId,
      durationEstimate: voiceResult.durationEstimate,
    };

    metadata.render_status = "skipped";
  }

  await writeRunFiles(metadata);
  return metadata;
}

export async function runPipeline(options: PipelineOptions): Promise<PostMetadata> {
  const briefInput = await readBrief(path.resolve(options.briefPath));
  const brief = normalizeBrief(briefInput);
  const brandProfile = await loadOrCreateBrandProfile(brief);
  return runPipelineFromRequest(requestFromBrief(brief), brandProfile, options.outputRoot ?? path.resolve("workspace", "outputs"));
}
