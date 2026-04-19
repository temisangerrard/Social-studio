import { generateScript, generatePepperaCarousel, buildCartoonFoodPrompt } from "./script-generator.ts";
import type { BrandProfile, GenerationRequest, PlannedPackage, Slide, StructuredRecipe } from "./types.ts";

interface PlannerContext {
  brand: BrandProfile;
  request: GenerationRequest;
}

// ── Fallback Recipe Lookup Table ──────────────────────────────────────────────

type RecipeEntry = Omit<StructuredRecipe, "proTip" | "cost" | "serves"> & {
  proTip: string;
  cost: string;
  serves: string;
};

const RECIPE_LOOKUP: ReadonlyMap<string, RecipeEntry[]> = new Map([
  [
    "bread,eggs",
    [
      {
        recipeName: "Classic French Toast",
        ingredients: ["2 eggs", "2 slices bread", "splash of milk", "butter", "toppings of choice"],
        cookTime: "10 mins",
        steps: ["Whisk eggs with milk", "Dip bread slices", "Fry in butter until golden", "Add toppings and serve"],
        proTip: "Golden, buttery, dusted with sugar",
        cost: "~£0.80",
        serves: "1",
      },
      {
        recipeName: "Egg-in-a-Hole",
        ingredients: ["1 egg", "1 thick slice bread", "butter", "salt & pepper"],
        cookTime: "8 mins",
        steps: ["Cut a hole in the bread centre", "Fry bread in butter, crack egg into hole", "Cook until egg sets, flip once"],
        proTip: "Crispy edges, runny yolk centre",
        cost: "~£0.60",
        serves: "1",
      },
      {
        recipeName: "Savoury Bread Pudding",
        ingredients: ["2 eggs", "2 slices bread (cubed)", "milk", "cheese", "herbs"],
        cookTime: "25 mins",
        steps: ["Cube bread into a baking dish", "Whisk eggs with milk and pour over", "Top with cheese and herbs", "Bake at 180C until golden"],
        proTip: "Warm, cheesy, straight from the oven",
        cost: "~£1.00",
        serves: "1-2",
      },
      {
        recipeName: "Eggy Bread",
        ingredients: ["1 egg", "1 slice bread", "butter or oil", "salt", "dipping sauce"],
        cookTime: "5 mins",
        steps: ["Beat egg with salt", "Dip bread in egg", "Fry until golden on both sides"],
        proTip: "The 5-minute comfort classic",
        cost: "~£0.50",
        serves: "1",
      },
      {
        recipeName: "Faux Croque Madame",
        ingredients: ["2 eggs", "2 slices bread", "cheese", "ham or bacon", "butter"],
        cookTime: "15 mins",
        steps: ["Assemble cheese and ham between bread", "Fry sandwich in butter until crispy", "Top with a fried egg", "Season and serve"],
        proTip: "Melted cheese, crispy bread, fried egg on top",
        cost: "~£1.50",
        serves: "1",
      },
    ],
  ],
  [
    "chicken,rice",
    [
      {
        recipeName: "One-Pot Chicken & Rice",
        ingredients: ["2 chicken thighs", "1 cup rice", "chicken stock", "garlic", "onion"],
        cookTime: "30 mins",
        steps: ["Brown chicken in a pot", "Sauté garlic and onion", "Add rice and stock, simmer until cooked"],
        proTip: "Use thighs for juicier results",
        cost: "~£2.00",
        serves: "2",
      },
      {
        recipeName: "Chicken Fried Rice",
        ingredients: ["1 chicken breast", "2 cups cooked rice", "soy sauce", "egg", "spring onions"],
        cookTime: "15 mins",
        steps: ["Dice and fry chicken", "Push aside, scramble egg", "Add cold rice and soy sauce, toss together"],
        proTip: "Day-old rice works best",
        cost: "~£1.80",
        serves: "2",
      },
      {
        recipeName: "Chicken Rice Bowl",
        ingredients: ["1 chicken breast", "1 cup rice", "teriyaki sauce", "sesame seeds", "cucumber"],
        cookTime: "20 mins",
        steps: ["Cook rice", "Pan-fry chicken with teriyaki", "Slice and serve over rice with cucumber"],
        proTip: "Drizzle extra sauce on top",
        cost: "~£2.20",
        serves: "1",
      },
      {
        recipeName: "Creamy Chicken Risotto",
        ingredients: ["1 chicken breast", "1 cup arborio rice", "chicken stock", "parmesan", "butter"],
        cookTime: "35 mins",
        steps: ["Sauté diced chicken, set aside", "Toast rice, add stock gradually", "Stir in chicken, parmesan and butter"],
        proTip: "Keep stirring for creamy texture",
        cost: "~£2.50",
        serves: "2",
      },
      {
        recipeName: "Chicken & Rice Soup",
        ingredients: ["1 chicken breast", "0.5 cup rice", "chicken stock", "carrots", "celery"],
        cookTime: "25 mins",
        steps: ["Simmer chicken in stock", "Shred chicken, return to pot", "Add rice and veg, cook until tender"],
        proTip: "Squeeze lemon juice before serving",
        cost: "~£1.50",
        serves: "2",
      },
    ],
  ],
  [
    "cheese,pasta",
    [
      {
        recipeName: "Classic Mac & Cheese",
        ingredients: ["200g pasta", "100g cheddar cheese", "butter", "milk", "flour"],
        cookTime: "20 mins",
        steps: ["Cook pasta", "Make cheese sauce with butter, flour, milk and cheese", "Combine and serve"],
        proTip: "Add breadcrumbs on top and grill for crunch",
        cost: "~£1.20",
        serves: "2",
      },
      {
        recipeName: "Cacio e Pepe",
        ingredients: ["200g spaghetti", "100g pecorino cheese", "black pepper", "pasta water"],
        cookTime: "12 mins",
        steps: ["Cook pasta, reserve water", "Mix cheese with pepper and pasta water", "Toss with hot pasta until creamy"],
        proTip: "Use starchy pasta water for the sauce",
        cost: "~£1.50",
        serves: "2",
      },
      {
        recipeName: "Cheesy Pasta Bake",
        ingredients: ["200g penne", "150g mixed cheese", "tinned tomatoes", "garlic", "herbs"],
        cookTime: "30 mins",
        steps: ["Cook pasta", "Mix with tomato sauce and half the cheese", "Top with remaining cheese and bake"],
        proTip: "Use mozzarella for stretchy cheese pulls",
        cost: "~£1.80",
        serves: "2",
      },
      {
        recipeName: "One-Pot Cheesy Orzo",
        ingredients: ["150g orzo", "80g parmesan", "spinach", "garlic", "vegetable stock"],
        cookTime: "15 mins",
        steps: ["Sauté garlic, add orzo and stock", "Simmer until orzo is cooked", "Stir in spinach and parmesan"],
        proTip: "Add sun-dried tomatoes for extra flavour",
        cost: "~£1.40",
        serves: "1-2",
      },
      {
        recipeName: "Cheese & Pasta Frittata",
        ingredients: ["150g leftover pasta", "3 eggs", "80g cheese", "herbs", "butter"],
        cookTime: "15 mins",
        steps: ["Mix pasta with beaten eggs and cheese", "Pour into buttered pan", "Cook until set, flip or grill to finish"],
        proTip: "Great way to use leftover pasta",
        cost: "~£1.00",
        serves: "1-2",
      },
    ],
  ],
]);

function normalizeIngredientKey(ingredients: string[]): string {
  return [...ingredients].map((i) => i.trim().toLowerCase()).sort().join(",");
}

function generateGenericRecipes(ingredients: string[]): StructuredRecipe[] {
  const ingList = ingredients.map((i) => i.trim()).filter(Boolean);
  const label = ingList.length > 0 ? ingList.join(" & ") : "Pantry Staples";
  const names = [
    `Quick ${label} Stir-Fry`,
    `${label} Omelette`,
    `One-Pot ${label} Bowl`,
    `${label} Wrap`,
    `Baked ${label} Surprise`,
  ];
  return names.map((name, i) => ({
    recipeName: name,
    ingredients: [
      ...ingList.map((ing) => `${ing}`),
      "salt & pepper",
      "olive oil",
    ],
    cookTime: `${10 + i * 5} mins`,
    steps: ["Prepare all ingredients", "Cook using your preferred method", "Season and serve"],
    proTip: "Adjust seasoning to taste",
    cost: `~£${(1 + i * 0.3).toFixed(2)}`,
    serves: "1-2",
  }));
}

export function generateFallbackRecipes(ingredients: string[]): StructuredRecipe[] {
  const key = normalizeIngredientKey(ingredients);
  const lookup = RECIPE_LOOKUP.get(key);
  if (lookup) {
    return lookup.map((r) => ({ ...r }));
  }

  // Try partial matches — find the first key whose ingredients are all present
  const normalised = new Set(ingredients.map((i) => i.trim().toLowerCase()));
  for (const [mapKey, recipes] of RECIPE_LOOKUP) {
    const keyIngredients = mapKey.split(",");
    if (keyIngredients.every((ki) => normalised.has(ki))) {
      return recipes.map((r) => ({ ...r }));
    }
  }

  return generateGenericRecipes(ingredients);
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
    "CRITICAL CONSISTENCY RULES:",
    "- Treat the mascot as the recurring face of the social account.",
    "- Every image_prompt that includes the mascot MUST start with the full mascot visualPrompt text above.",
    "- Only vary pose and expression per slide role. Never vary body shape, colors, bandana, face proportions, or art style.",
    "- Do NOT add text overlays, watermarks, or photorealistic elements — the mascot is strictly flat 2D cartoon.",
    "- If a slide is food-only (meal_reveal, benefit), do NOT include the mascot in image_prompt."
  ];
}

const MASCOT_EXCLUDED_ROLES: ReadonlySet<Slide["role"]> = new Set(["meal_reveal", "benefit"]);

const ACTION_BY_ROLE: Readonly<Record<Slide["role"], string>> = {
  hook: "introducing the idea with excitement, one arm raised",
  problem: "looking frustrated or confused, scratching head",
  escalation: "expressing exaggerated struggle, arms up in defeat",
  reaction: "wide-eyed shocked expression, mouth open",
  discovery: "smiling brightly with eyes wide, pointing forward",
  meal_reveal: "presenting the finished food proudly",
  benefit: "demonstrating the benefit clearly",
  cta: "waving and pointing toward camera invitingly",
  recipe: "presenting the dish proudly"
};

const EXPRESSION_BY_ROLE: Readonly<Record<Slide["role"], string>> = {
  hook: "excited smile",
  problem: "frustrated frown with raised eyebrows",
  escalation: "exaggerated despair face",
  reaction: "wide-eyed shock",
  discovery: "bright optimistic smile",
  meal_reveal: "proud smile",
  benefit: "confident smile with thumbs up",
  cta: "friendly inviting wave",
  recipe: "proud smile"
};

function shouldIncludeMascot(
  role: Slide["role"],
  visualMode: NonNullable<GenerationRequest["visualMode"]>
): boolean {
  if (visualMode === "food-led") {
    return false;
  }

  if (visualMode === "mixed" && MASCOT_EXCLUDED_ROLES.has(role)) {
    return false;
  }

  return true;
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

  if (!shouldIncludeMascot(role, visualMode)) {
    return prompt;
  }

  const mascot = brand.mascot;
  const action = ACTION_BY_ROLE[role];
  const expression = EXPRESSION_BY_ROLE[role];

  return [
    mascot.visualPrompt,
    `Character pose: ${action}.`,
    `Facial expression: ${expression}.`,
    `IMPORTANT: Keep the mascot design identical to the reference — same body shape, same red bandana, same face proportions, same art style. Only the pose and expression change.`,
    `Scene: ${prompt}`
  ].join(" ");
}

export function buildPlannerPrompt({ brand, request }: PlannerContext): string {
  const visualMode = resolveVisualMode(request);
  const isPeppera = brand.id === "peppera" || brand.name === "Peppera";

  const baseLines = [
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
  ];

  if (isPeppera) {
    baseLines.push(
      "",
      "PEPPERA CAROUSEL FORMAT:",
      "Slides must contain exactly 7 items with roles: hook, recipe, recipe, recipe, recipe, recipe, cta.",
      "The hook and cta slides are text-only (no image generation needed).",
      "Each recipe slide MUST include a `recipe` object with these fields:",
      "  - recipeName: string (a recognisable, real meal name)",
      "  - ingredients: string[] (3–10 specific items with quantities, e.g. '2 large eggs')",
      "  - cookTime: string (realistic duration, e.g. '15 mins')",
      "  - steps: string[] (1–4 concise cooking steps)",
      "  - proTip: string (optional helpful cooking tip)",
      "  - cost: string (optional estimated cost, e.g. '~£1.00')",
      "  - serves: string (optional serving size, e.g. '1-2')",
      "",
      "All 5 recipe names must be distinct real meals that can be made from the given ingredients.",
      "Use 2D cartoon illustration style for all image prompts — no photorealistic terms.",
      "When generating image_prompt for mascot slides (hook, problem, cta), ALWAYS prepend the full mascot visualPrompt.",
    );
  } else {
    baseLines.push(
      "Slides must contain 8 items using roles hook, problem, escalation, reaction, discovery, meal_reveal, benefit, cta.",
      "Use generated_image for problem, reaction, and meal_reveal. Use text_only for the rest unless the idea strongly needs visuals.",
      "When generating image_prompt for mascot-led slides, ALWAYS prepend the full mascot visualPrompt. Only vary pose and expression.",
    );
  }

  return baseLines.join("\n");
}

function validateRecipe(raw: unknown): StructuredRecipe | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const recipeName = typeof r.recipeName === "string" ? r.recipeName.trim() : "";
  if (!recipeName) return undefined;

  const ingredients = Array.isArray(r.ingredients)
    ? r.ingredients.map((i) => String(i).trim()).filter(Boolean)
    : [];
  if (ingredients.length === 0) return undefined;

  const cookTime = typeof r.cookTime === "string" ? r.cookTime.trim() : "";
  if (!cookTime) return undefined;

  const steps = Array.isArray(r.steps)
    ? r.steps.map((s) => String(s).trim()).filter(Boolean)
    : [];
  if (steps.length === 0) return undefined;

  return {
    recipeName,
    ingredients,
    cookTime,
    steps,
    proTip: typeof r.proTip === "string" ? r.proTip : undefined,
    cost: typeof r.cost === "string" ? r.cost : undefined,
    serves: typeof r.serves === "string" ? r.serves : undefined,
  };
}

export function parsePlannerResponse(text: string): PlannedPackage {
  const parsed = JSON.parse(cleanJsonString(text)) as PlannedPackage;
  return {
    hooks: (Array.isArray(parsed.hooks) ? parsed.hooks : []).map((item) => String(item)),
    caption: String(parsed.caption ?? ""),
    hashtags: (Array.isArray(parsed.hashtags) ? parsed.hashtags : []).map((item) => normalizeHashtag(String(item))).filter(Boolean),
    platformNotes: parsed.platformNotes ?? {},
    slides: (Array.isArray(parsed.slides) ? parsed.slides : []).map((slide) => {
      const base = {
        ...slide,
        asset_path: slide.asset_path ?? null,
      };
      // Extract and validate recipe field if present
      const recipe = validateRecipe((slide as unknown as Record<string, unknown>).recipe);
      if (recipe) {
        return { ...base, recipe } as Slide;
      }
      return base as Slide;
    }),
  };
}

function topCardsByType(request: GenerationRequest, type: string): string[] {
  return request.cards
    .filter((card) => card.type === type)
    .map((card) => card.text.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function isPepperaCarouselBrief(brand: BrandProfile, request: GenerationRequest): boolean {
  return (brand.id === "peppera" || brand.name === "Peppera") &&
    (request.platformTargets.includes("instagram") || request.workflowType === "linkedin-carousel");
}

function extractIngredients(request: GenerationRequest): string[] {
  // Try to extract ingredients from cards or rawIdea
  const ingredientCards = request.cards
    .filter((c) => c.type === "visual" || c.type === "idea")
    .map((c) => c.text.trim())
    .filter(Boolean);

  // Parse ingredients from rawIdea if it mentions specific items
  const rawWords = request.rawIdea.toLowerCase();
  const commonIngredients = ["eggs", "bread", "chicken", "rice", "pasta", "cheese", "potatoes", "tomatoes", "onions", "peppers", "butter", "milk", "garlic", "beans"];
  const found = commonIngredients.filter((ing) => rawWords.includes(ing));

  return found.length > 0 ? found : ingredientCards.length > 0 ? ingredientCards : ["eggs", "bread"];
}

export function fallbackPlanSocialPackage({ brand, request }: PlannerContext): PlannedPackage {
  // Detect Peppera carousel briefs
  if (isPepperaCarouselBrief(brand, request)) {
    return fallbackPlanPepperaCarousel({ brand, request });
  }

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

function fallbackPlanPepperaCarousel({ brand, request }: PlannerContext): PlannedPackage {
  const ingredients = extractIngredients(request);
  const recipes = generateFallbackRecipes(ingredients);

  const brief: import("./types.ts").ContentBrief = {
    product: brand.name,
    platform: request.platformTargets[0] ?? "instagram",
    format: "carousel",
    pillar: "pantry chaos",
    audience: brand.audience,
    tone: brand.tone,
    ingredients,
    goal: request.goal,
    idea: request.rawIdea,
  };

  const slides = generatePepperaCarousel(brief, brand);

  // Fill in recipe data from fallback recipes on the 5 recipe slides
  let recipeIndex = 0;
  for (const slide of slides) {
    if (slide.role === "recipe" && recipeIndex < recipes.length) {
      const recipe = recipes[recipeIndex];
      slide.recipe = recipe;
      slide.text = recipe.recipeName;
      // Rebuild image prompt to match the actual recipe name
      slide.image_prompt = buildCartoonFoodPrompt(recipe.recipeName, recipe.ingredients);
      recipeIndex++;
    }
  }

  const ingredientLabel = ingredients.map((i) => i.charAt(0).toUpperCase() + i.slice(1)).join(" + ");
  const hookSeed = `5 Meals From JUST ${ingredientLabel}`;
  const ctaSeed = brand.cta || "Download Peppera";

  const hooks = [
    hookSeed,
    `When your fridge only has ${ingredientLabel.toLowerCase()}`,
    `${ingredientLabel} → 5 actual meals (no takeaway needed)`,
  ];

  const caption = `${hookSeed} 🍳 Yes, really! Swipe through for 5 easy ${ingredientLabel.toLowerCase()} recipes perfect for ${brand.audience.toLowerCase()}. Save this post and try one tonight! ${ctaSeed} for 10,000+ more recipes 📲`;

  return {
    hooks,
    caption,
    hashtags: Array.from(new Set([
      ...brand.defaults.hashtags,
      "#cookwithpeppera",
      "#ukfoodie",
      "#studentcooking",
      "#budgetmeals",
      "#mealideas",
      "#easycooking",
      "#quickmeals",
    ])).map(normalizeHashtag),
    platformNotes: {
      instagram: "Use the strongest visual cover and cleaner CTA framing.",
    },
    slides,
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

    const glmPlan = parsePlannerResponse(content);

    // For Peppera carousels, merge GLM's recipe data onto our structured carousel
    if (isPepperaCarouselBrief(context.brand, context.request)) {
      const ingredients = extractIngredients(context.request);
      const brief: import("./types.ts").ContentBrief = {
        product: context.brand.name,
        platform: context.request.platformTargets[0] ?? "instagram",
        format: "carousel",
        pillar: "pantry chaos",
        audience: context.brand.audience,
        tone: context.brand.tone,
        ingredients,
        goal: context.request.goal,
        idea: context.request.rawIdea,
      };
      const structuredSlides = generatePepperaCarousel(brief, context.brand);

      // Extract recipes from GLM response
      const glmRecipes = glmPlan.slides
        .map((s) => s.recipe)
        .filter((r): r is StructuredRecipe => r !== undefined && r !== null);

      // Merge GLM recipes onto our structured recipe slides
      let recipeIdx = 0;
      for (const slide of structuredSlides) {
        if (slide.role === "recipe" && recipeIdx < glmRecipes.length) {
          slide.recipe = glmRecipes[recipeIdx];
          slide.text = glmRecipes[recipeIdx].recipeName;
          slide.image_prompt = buildCartoonFoodPrompt(glmRecipes[recipeIdx].recipeName, glmRecipes[recipeIdx].ingredients);
          recipeIdx++;
        }
      }

      // If GLM didn't return enough recipes, fill from fallback
      if (recipeIdx < 5) {
        const fallbackRecipes = generateFallbackRecipes(ingredients);
        for (const slide of structuredSlides) {
          if (slide.role === "recipe" && (!slide.recipe || !slide.recipe.recipeName)) {
            if (recipeIdx < fallbackRecipes.length) {
              slide.recipe = fallbackRecipes[recipeIdx];
              slide.text = fallbackRecipes[recipeIdx].recipeName;
              slide.image_prompt = buildCartoonFoodPrompt(fallbackRecipes[recipeIdx].recipeName, fallbackRecipes[recipeIdx].ingredients);
            }
            recipeIdx++;
          }
        }
      }

      return {
        plan: {
          hooks: glmPlan.hooks.length > 0 ? glmPlan.hooks : [`5 Meals From ${ingredients.join(" + ")}`],
          caption: glmPlan.caption,
          hashtags: glmPlan.hashtags,
          platformNotes: glmPlan.platformNotes,
          slides: structuredSlides,
        },
        provider: "glm"
      };
    }

    return {
      plan: glmPlan,
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
