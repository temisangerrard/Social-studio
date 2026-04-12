import { generateScript } from "./script-generator.ts";
import type { BrandProfile, GenerationRequest, PlannedPackage, Slide } from "./types.ts";

interface PlannerContext {
  brand: BrandProfile;
  request: GenerationRequest;
}

function resolveVisualMode(request: GenerationRequest): NonNullable<GenerationRequest["visualMode"]> {
  return request.visualMode ?? "mascot-led";
}

function cleanJsonString(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function normalizeHashtag(tag: string): string {
  const trimmed = tag.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("#") ? trimmed : `#${trimmed.replace(/^#+/, "")}`;
}

function cardSummary(request: GenerationRequest): string {
  if (request.cards.length === 0) {
    return "- no cards";
  }

  return request.cards
    .map((card) => `- [${card.type}] ${card.text}`)
    .join("\n");
}

function mascotSummary(brand: BrandProfile): string[] {
  const mascot = brand.mascot;
  if (!mascot) {
    return [];
  }

  return [
    `Mascot name: ${mascot.name}`,
    `Mascot role: ${mascot.role}`,
    `Mascot description: ${mascot.description}`,
    `Mascot visual prompt: ${mascot.visualPrompt}`,
    `Mascot usage rules: ${mascot.usageRules.join(" | ") || "none"}`,
    `Mascot reference images: ${mascot.referenceImages.join(", ") || "none"}`,
    "Treat the mascot as the recurring face of the social account and feature it in visual variants unless the slide is explicitly food-only."
  ];
}

function applyMascotToPrompt(
  prompt: string | null,
  brand: BrandProfile,
  role: Slide["role"],
  visualMode: NonNullable<GenerationRequest["visualMode"]>
): string | null {
  if (!prompt || !brand.mascot) {
    return prompt;
  }

  if (visualMode === "food-led" && (role === "meal_reveal" || role === "benefit" || role === "cta")) {
    return prompt;
  }

  if (visualMode === "food-led" && role === "discovery") {
    return prompt;
  }

  if (visualMode === "mixed" && (role === "meal_reveal" || role === "benefit")) {
    return prompt;
  }

  const actionByRole: Record<Slide["role"], string> = {
    hook: "showing up as the main character introducing the idea",
    problem: "reacting to the problem as the main character",
    escalation: "living through the struggle in a playful way",
    reaction: "making the emotional reaction obvious and expressive",
    discovery: "discovering the solution with optimism",
    meal_reveal: "presenting the finished food proudly",
    benefit: "demonstrating the benefit clearly",
    cta: "inviting the audience to act"
  };

  return `${brand.mascot.visualPrompt} ${brand.mascot.description} Show the mascot ${actionByRole[role]}. ${prompt}`;
}

export function buildPlannerPrompt({ brand, request }: PlannerContext): string {
  const visualMode = resolveVisualMode(request);
  return [
    "You are planning a complete phase-1 social content package.",
    "Return JSON only with keys: hooks, caption, hashtags, platformNotes, slides.",
    `Brand: ${brand.name}`,
    `Brand description: ${brand.description}`,
    `Brand tone: ${brand.tone}`,
    `Brand audience: ${brand.audience}`,
    `Brand CTA: ${brand.cta}`,
    ...mascotSummary(brand),
    `Goal: ${request.goal}`,
    `Visual mode: ${visualMode}`,
    `Platforms: ${request.platformTargets.join(", ")}`,
    `Raw idea: ${request.rawIdea}`,
    `Notes: ${request.notes ?? "none"}`,
    "Canvas cards:",
    cardSummary(request),
    "Slides must contain 8 items using roles hook, problem, escalation, reaction, discovery, meal_reveal, benefit, cta.",
    "Use generated_image only for problem, reaction, and meal_reveal unless the idea strongly requires otherwise.",
    "Keep slide copy concise and social-ready."
  ].join("\n");
}

export function parsePlannerResponse(text: string): PlannedPackage {
  const parsed = JSON.parse(cleanJsonString(text)) as PlannedPackage;
  return {
    hooks: (parsed.hooks ?? []).map((item) => String(item)),
    caption: String(parsed.caption ?? ""),
    hashtags: (parsed.hashtags ?? []).map((item) => normalizeHashtag(String(item))).filter(Boolean),
    platformNotes: parsed.platformNotes ?? {},
    slides: (parsed.slides ?? []).map((slide) => ({
      ...slide,
      asset_path: slide.asset_path ?? null
    })) as Slide[]
  };
}

function topCardsByType(request: GenerationRequest, type: string): string[] {
  return request.cards
    .filter((card) => card.type === type)
    .map((card) => card.text.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export function fallbackPlanSocialPackage({ brand, request }: PlannerContext): PlannedPackage {
  const visualMode = resolveVisualMode(request);
  const hookSeed = topCardsByType(request, "hook")[0] || request.rawIdea;
  const problemSeed = topCardsByType(request, "problem")[0] || "Dinner indecision is hitting again";
  const visualSeed = topCardsByType(request, "visual")[0] || request.rawIdea;
  const proofSeed = topCardsByType(request, "proof")[0] || "It turns rough ingredients into an actual plan";
  const ctaSeed = topCardsByType(request, "cta")[0] || brand.cta;
  const hooks = [
    hookSeed,
    `When dinner starts with "${request.rawIdea.slice(0, 42)}${request.rawIdea.length > 42 ? "..." : ""}"`,
    `${brand.name} for the "${problemSeed.toLowerCase()}" crowd`
  ];

  const slides = generateScript({
    product: brand.name,
    platform: request.platformTargets[0] ?? "tiktok",
    format: "slideshow",
    pillar: "idea-to-social",
    audience: brand.audience,
    tone: brand.tone,
    ingredients: [],
    goal: request.goal,
    idea: hookSeed
  }).map((slide, index) => {
    if (index === 1) {
      return {
        ...slide,
        text: problemSeed,
        image_prompt: applyMascotToPrompt(`${visualSeed}, social-adjacent brand visual, no text`, brand, slide.role, visualMode)
      };
    }

    if (index === 4) {
      return {
        ...slide,
        text: `${brand.name} turns this into a publishable concept`,
        image_prompt: applyMascotToPrompt(slide.image_prompt, brand, slide.role, visualMode)
      };
    }

    if (index === 6) {
      return {
        ...slide,
        text: proofSeed,
        image_prompt: applyMascotToPrompt(slide.image_prompt, brand, slide.role, visualMode)
      };
    }

    if (index === 7) {
      return {
        ...slide,
        text: ctaSeed,
        image_prompt: applyMascotToPrompt(slide.image_prompt, brand, slide.role, visualMode)
      };
    }

    return {
      ...slide,
      image_prompt: applyMascotToPrompt(slide.image_prompt, brand, slide.role, visualMode)
    };
  });

  return {
    hooks,
    caption: `${hooks[0]}. ${brand.name} helps ${brand.audience.toLowerCase()} turn rough ideas into clean social outputs. ${ctaSeed}.`,
    hashtags: Array.from(new Set([...brand.defaults.hashtags, "#contentstudio", "#socialworkflow"])).map(normalizeHashtag),
    platformNotes: {
      tiktok: "Lead with the most surprising hook and keep slide copy sharp.",
      instagram: "Use the strongest visual cover and cleaner CTA framing."
    },
    slides
  };
}

export async function planSocialPackage(
  context: PlannerContext
): Promise<{ plan: PlannedPackage; provider: "glm" | "fallback" }> {
  const apiKey = process.env.GLM_API_KEY;
  const apiUrl = process.env.GLM_API_URL ?? "https://open.bigmodel.cn/api/paas/v4/chat/completions";
  const model = process.env.GLM_MODEL ?? context.brand.providers.plannerModel ?? "glm-4.5";

  if (!apiKey) {
    return {
      plan: fallbackPlanSocialPackage(context),
      provider: "fallback"
    };
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You generate structured JSON for social content planning."
          },
          {
            role: "user",
            content: buildPlannerPrompt(context)
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

    return {
      plan: parsePlannerResponse(content),
      provider: "glm"
    };
  } catch (error) {
    console.warn(`[planner] Falling back to local planner: ${(error as Error).message}`);
    return {
      plan: fallbackPlanSocialPackage(context),
      provider: "fallback"
    };
  }
}
