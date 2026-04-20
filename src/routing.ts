import type {
  AssetAnalysis,
  BrandProfile,
  ContentRecipeDefinition,
  ContentRouteFamily,
  DeliveryTarget,
  GenerationIntent,
  GenerationRequest,
  Platform,
  RoutingCandidate,
  RoutingDecision,
  RoutingTrace
} from "./types.ts";

const ROUTING_TREE_VERSION = "2026-04-20-v1";

const ROUTE_FAMILY_KEYWORDS: Record<ContentRouteFamily, RegExp> = {
  "carousel": /\bcarousel\b|\bslides?\b|\bslideshow\b|\bswipe\b/u,
  "edited-image": /\bedit(?:ed)?\b|\boverlay\b|\blogo\b|\bpromo\b|\bposter\b|\btext underneath\b/u,
  "recipe": /\brecipe\b|\bcook(?:ing)?\b|\bmeal\b|\bdinner\b|\bingredient\b|\bfood\b/u,
  "flyer": /\bflyer\b|\bposter\b|\bevent\b|\blaun?ch\b|\bannouncement\b/u,
  "linkedin-post": /\blinkedin\b|\bthought leadership\b|\btext post\b/u,
  "infographic": /\binfographic\b|\bdata\b|\bstats?\b|\bexplainer\b|\bbreakdown\b/u
};

function normalizePriority(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function inferRouteFamilyFromLegacyContentType(id: string, name: string): ContentRouteFamily {
  const fingerprint = `${id} ${name}`.toLowerCase();
  if (fingerprint.includes("recipe")) return "recipe";
  if (fingerprint.includes("linkedin")) return "linkedin-post";
  if (fingerprint.includes("flyer")) return "flyer";
  if (fingerprint.includes("infographic")) return "infographic";
  if (fingerprint.includes("edit")) return "edited-image";
  return "carousel";
}

function workflowForRouteFamily(routeFamily: ContentRouteFamily) {
  if (routeFamily === "linkedin-post") return "linkedin-text" as const;
  if (routeFamily === "edited-image" || routeFamily === "flyer") return "reference-edit" as const;
  return "slideshow" as const;
}

function defaultPriorityForRouteFamily(routeFamily: ContentRouteFamily): number {
  if (routeFamily === "recipe") return 100;
  if (routeFamily === "linkedin-post") return 95;
  if (routeFamily === "edited-image") return 90;
  if (routeFamily === "flyer") return 85;
  if (routeFamily === "infographic") return 80;
  return 70;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function deriveBrandContentRecipes(brand: BrandProfile): ContentRecipeDefinition[] {
  if (Array.isArray(brand.contentRecipes) && brand.contentRecipes.length > 0) {
    return brand.contentRecipes.map((recipe) => ({
      ...recipe,
      defaultPriority: normalizePriority(recipe.defaultPriority, defaultPriorityForRouteFamily(recipe.routeFamily))
    }));
  }

  return (brand.contentTypes ?? []).map((contentType) => {
    const routeFamily = inferRouteFamilyFromLegacyContentType(contentType.id, contentType.name);
    return {
      id: contentType.id,
      name: contentType.name,
      routeFamily,
      workflowType: workflowForRouteFamily(routeFamily),
      platformTargets: contentType.platformTargets,
      defaultPriority: defaultPriorityForRouteFamily(routeFamily),
      contentTypeId: contentType.id
    };
  });
}

function inferContentHints(request: GenerationRequest, assetAnalyses: AssetAnalysis[]): ContentRouteFamily[] {
  const prompt = `${request.rawIdea} ${request.notes ?? ""}`.toLowerCase();
  const hints = assetAnalyses.flatMap((analysis) => analysis.contentHints);
  for (const [routeFamily, pattern] of Object.entries(ROUTE_FAMILY_KEYWORDS) as Array<[ContentRouteFamily, RegExp]>) {
    if (pattern.test(prompt)) {
      hints.push(routeFamily);
    }
  }
  if ((request.platformTargets[0] ?? "instagram") === "linkedin") {
    hints.push("linkedin-post");
  }
  return unique(hints);
}

function buildIntent(request: GenerationRequest, assetAnalyses: AssetAnalysis[]): GenerationIntent {
  return {
    platform: request.platformTargets[0] ?? "instagram",
    prompt: request.rawIdea,
    assetTypes: unique(assetAnalyses.map((analysis) => analysis.assetType)),
    contentHints: inferContentHints(request, assetAnalyses),
    channelHints: unique(assetAnalyses.flatMap((analysis) => analysis.channelHints)),
    requiresConfirmation: assetAnalyses.some((analysis) => analysis.needsUserConfirmation)
  };
}

function deliveryTargetsForPlatform(platform: Platform): DeliveryTarget {
  return platform;
}

function scoreRecipe(
  recipe: ContentRecipeDefinition,
  intent: GenerationIntent
): { score: number; reasons: string[]; rejected: boolean } {
  let score = recipe.defaultPriority;
  const reasons: string[] = [`base priority ${recipe.defaultPriority}`];

  if (!recipe.platformTargets.includes(intent.platform)) {
    return {
      score: -1000,
      reasons: [`unsupported on ${intent.platform}`],
      rejected: true
    };
  }

  if (intent.contentHints.includes(recipe.routeFamily)) {
    score += 40;
    reasons.push(`prompt/assets suggest ${recipe.routeFamily}`);
  }

  if (recipe.preferredAssetTypes?.length) {
    const matching = recipe.preferredAssetTypes.filter((assetType) => intent.assetTypes.includes(assetType));
    if (matching.length > 0) {
      score += matching.length * 20;
      reasons.push(`asset match: ${matching.join(", ")}`);
    }
  }

  if (recipe.requiredAssetTypes?.length) {
    const missing = recipe.requiredAssetTypes.filter((assetType) => !intent.assetTypes.includes(assetType));
    if (missing.length > 0) {
      return {
        score: -1000,
        reasons: [`missing required asset types: ${missing.join(", ")}`],
        rejected: true
      };
    }
  }

  if (recipe.routeFamily === "linkedin-post" && intent.platform === "linkedin") {
    score += 50;
    reasons.push("linkedin platform selected");
  }

  if ((recipe.routeFamily === "edited-image" || recipe.routeFamily === "flyer") && intent.assetTypes.length === 0) {
    score -= 25;
    reasons.push("image-edit route without uploaded asset");
  }

  if (intent.channelHints.includes(intent.platform)) {
    score += 5;
    reasons.push(`asset channel hints include ${intent.platform}`);
  }

  return { score, reasons, rejected: false };
}

function candidateFromRecipe(
  recipe: ContentRecipeDefinition,
  score: number,
  reasons: string[],
  status: "selected" | "rejected"
): RoutingCandidate {
  return {
    recipeId: recipe.id,
    routeFamily: recipe.routeFamily,
    workflowType: recipe.workflowType,
    score,
    status,
    reasons
  };
}

function applyOverride(
  recipes: ContentRecipeDefinition[],
  request: GenerationRequest,
  fallbackDecision: RoutingDecision
): RoutingDecision {
  const override = request.routingOverride;
  if (!override) {
    return fallbackDecision;
  }

  const recipe = recipes.find((item) => item.id === override.recipeId)
    ?? recipes.find((item) => item.routeFamily === override.routeFamily)
    ?? recipes.find((item) => item.workflowType === override.workflowType);

  if (!recipe) {
    return fallbackDecision;
  }

  return {
    ...fallbackDecision,
    recipeId: recipe.id,
    routeFamily: override.routeFamily ?? recipe.routeFamily,
    workflowType: override.workflowType ?? recipe.workflowType,
    contentTypeId: override.contentTypeId ?? recipe.contentTypeId,
    selectedBy: "override",
    reasonSummary: `manual override to ${recipe.name}`
  };
}

export function routeGenerationRequest(params: {
  brand: BrandProfile;
  request: GenerationRequest;
  assetAnalyses: AssetAnalysis[];
}): RoutingDecision {
  const recipes = deriveBrandContentRecipes(params.brand);
  const intent = buildIntent(params.request, params.assetAnalyses);

  if (recipes.length === 0) {
    const fallback: RoutingDecision = {
      recipeId: "default-carousel",
      routeFamily: intent.platform === "linkedin" ? "linkedin-post" : "carousel",
      workflowType: intent.platform === "linkedin" ? "linkedin-text" : "slideshow",
      platformTargets: [intent.platform],
      deliveryTargets: params.request.deliveryTargets ?? deliveryTargetsForPlatform(intent.platform),
      selectedBy: "router",
      reasonSummary: "brand has no recipe config, using deterministic fallback",
      requiresConfirmation: intent.requiresConfirmation,
      candidates: []
    };
    return applyOverride(recipes, params.request, fallback);
  }

  const scored = recipes.map((recipe) => {
    const result = scoreRecipe(recipe, intent);
    return {
      recipe,
      score: result.score,
      reasons: result.reasons,
      rejected: result.rejected
    };
  });

  scored.sort((left, right) => right.score - left.score || right.recipe.defaultPriority - left.recipe.defaultPriority);
  const winner = scored[0];
  const candidates = scored.map((entry, index) =>
    candidateFromRecipe(
      entry.recipe,
      entry.score,
      entry.reasons,
      index === 0 && !entry.rejected ? "selected" : "rejected"
    )
  );

  const decision: RoutingDecision = {
    recipeId: winner.recipe.id,
    routeFamily: winner.recipe.routeFamily,
    workflowType: winner.recipe.workflowType,
    platformTargets: [intent.platform],
    deliveryTargets: params.request.deliveryTargets ?? deliveryTargetsForPlatform(intent.platform),
    contentTypeId: winner.recipe.contentTypeId,
    selectedBy: "router",
    reasonSummary: winner.reasons.join("; "),
    requiresConfirmation: intent.requiresConfirmation || winner.score < 60,
    candidates
  };

  return applyOverride(recipes, params.request, decision);
}

export function buildRoutingTrace(params: {
  brand: BrandProfile;
  request: GenerationRequest;
  assetAnalyses: AssetAnalysis[];
}): RoutingTrace {
  const intent = buildIntent(params.request, params.assetAnalyses);
  const decision = routeGenerationRequest(params);
  return {
    decision,
    intent,
    assetAnalyses: params.assetAnalyses,
    treeVersion: ROUTING_TREE_VERSION,
    traceLines: [
      `brand: ${params.brand.id}`,
      `platform: ${intent.platform}`,
      `asset types: ${intent.assetTypes.join(", ") || "none"}`,
      `content hints: ${intent.contentHints.join(", ") || "none"}`,
      `selected recipe: ${decision.recipeId}`,
      `selected route family: ${decision.routeFamily}`,
      `workflow: ${decision.workflowType}`
    ]
  };
}

export function explainRoutingTree(): string {
  return [
    "Deterministic routing tree",
    "1. Collect prompt, selected brand, selected platform, uploaded asset analyses, and optional user labels.",
    "2. Build generation intent from prompt keywords, asset types, content hints, and channel hints.",
    "3. Filter brand-supported recipes to platform-compatible routes.",
    "4. Score each route family using prompt hints, asset-type matches, and recipe priority.",
    "5. Select the top-scoring route. Families: carousel, edited-image, recipe, flyer, linkedin-post, infographic.",
    "6. If confidence is low or analysis is unclear, keep the deterministic choice but flag confirmation."
  ].join("\n");
}
