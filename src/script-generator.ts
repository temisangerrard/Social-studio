import type { BrandProfile, ContentBrief, Slide, SlideRole, StructuredRecipe } from "./types.ts";

const SLIDE_BLUEPRINT: Array<{
  role: SlideRole;
  textFn: (ingredients: string[], brief: ContentBrief) => string;
  promptFn: (ingredients: string[]) => string;
}> = [
  {
    role: "hook",
    textFn: (ing, _) => `got ${joinIngredients(ing)} and no plan`,
    promptFn: (ing) =>
      `A chaotic kitchen scene, overhead shot of a cluttered counter with random ingredients${ing.length ? ` including ${joinIngredients(ing)}` : ""} scattered everywhere, open fridge in background, warm realistic food photography, dramatic lighting, vertical 9:16 crop, no text, no people`
  },
  {
    role: "problem",
    textFn: () => `I can't eat the same thing again`,
    promptFn: (ing) =>
      `Close-up of a sad plain meal on a plate, same boring dinner, dull lighting, beige tones, relatable everyday food struggle, realistic food photography, vertical 9:16 crop, no text, no people`
  },
  {
    role: "escalation",
    textFn: () => `takeaway is calling my name`,
    promptFn: (ing) =>
      `Hand scrolling through a food delivery app on a phone screen at night, soft warm ambient lighting, takeaway menus scattered on a table, guilty food ordering mood, realistic lifestyle photography, vertical 9:16 crop, no text, no people`
  },
  {
    role: "reaction",
    textFn: () => `my fridge is judging me`,
    promptFn: (ing) =>
      `An open fridge with sparse random items${ing.length ? ` — ${joinIngredients(ing)}` : ""}, dramatic light spilling from inside, empty shelves, sad leftover containers, realistic kitchen photography, moody atmosphere, vertical 9:16 crop, no text, no people`
  },
  {
    role: "discovery",
    textFn: () => `Peppera turns leftovers into meals`,
    promptFn: (ing) =>
      `Beautiful overhead shot of ${joinIngredients(ing)} arranged neatly on a clean wooden surface, fresh ingredients ready to transform, bright natural daylight, editorial food photography, hope and possibility, vertical 9:16 crop, no text, no people`
  },
  {
    role: "meal_reveal",
    textFn: (ing, _) => buildMealName(ing),
    promptFn: (ing) =>
      `Stunning hero shot of a delicious homemade dish made from ${joinIngredients(ing)}, beautifully plated on a modern ceramic bowl, garnished with fresh herbs, warm food photography lighting, shallow depth of field, restaurant-quality presentation, vertical 9:16 crop, no text, no people`
  },
  {
    role: "benefit",
    textFn: () => `less waste, faster dinners`,
    promptFn: (ing) =>
      `Split composition: a clean organised pantry with labelled jars and fresh ingredients on one side, a warm home-cooked meal on the other, bright aspirational kitchen photography, lifestyle editorial feel, vertical 9:16 crop, no text, no people`
  },
  {
    role: "cta",
    textFn: (_, brief) => brief.goal === "installs" ? `cook from what you've got` : `try Peppera tonight`,
    promptFn: (ing) =>
      `A warm inviting kitchen scene with a phone displaying a meal planning app beside fresh ingredients on a marble counter, golden hour light streaming through a window, aspirational modern home cooking lifestyle, vertical 9:16 crop, no text, no people`
  }
];

function toLowerList(items: string[] | undefined): string[] {
  return (items ?? []).map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function joinIngredients(ingredients: string[]): string {
  if (ingredients.length === 0) return "random bits from the fridge";
  if (ingredients.length === 1) return ingredients[0];
  if (ingredients.length === 2) return `${ingredients[0]} and ${ingredients[1]}`;
  return `${ingredients.slice(0, -1).join(", ")} and ${ingredients[ingredients.length - 1]}`;
}

function titleCase(text: string): string {
  return text.split(" ").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function buildMealName(ingredients: string[]): string {
  const [first = "Pantry", second = "Pepper", third = "Bowl"] = ingredients.map(titleCase);
  return `${first} & ${second} ${third}`;
}

export function generateScript(brief: ContentBrief): Slide[] {
  const ingredients = toLowerList(brief.ingredients);

  return SLIDE_BLUEPRINT.map((entry, index) => ({
    slide_number: index + 1,
    role: entry.role,
    type: "generated_image" as const,
    text: entry.textFn(ingredients, brief),
    image_prompt: entry.promptFn(ingredients),
    visual_goal: "",
    layout: "image_focus" as const,
    asset_path: null
  }));
}


/**
 * Builds a mascot image prompt following the proven pattern:
 * full character description + pose + 2D flat vector style + composition + --ar 1:1
 */
export function buildMascotSlidePrompt(
  mascotPrompt: string,
  pose: string,
  expression: string,
  scene: string
): string {
  return `${mascotPrompt}, ${pose}, ${expression}, ${scene}, 2D flat vector illustration style, bright cheerful colors, clean simple shapes, professional social media content design, centered composition, high-quality illustration --ar 1:1`;
}

/**
 * Builds a 2D cartoon food illustration prompt — no photorealistic terms.
 */
export function buildCartoonFoodPrompt(
  recipeName: string,
  ingredients: string[]
): string {
  const ingredientList = joinIngredients(ingredients);
  return `Delicious ${recipeName} illustration, a beautifully plated dish made with ${ingredientList}, served on a white ceramic plate, appetizing presentation with vibrant garnishes, warm inviting lighting with soft shadows, 2D cartoon illustration aesthetic, bright vibrant colors, bold outlines, clean simple background with subtle texture, professional food art quality, appetizing and inviting presentation, top-down flat lay view slightly angled, plate centered in frame --ar 1:1`;
}

/**
 * Generates a Peppera "5 Meals From [Ingredient]" carousel with exactly 7 slides:
 * 1 hook (text-only, brand colours), 5 recipe cards (food image + recipe text), 1 CTA (text-only)
 * No mascot image generation — just food illustrations and branded text slides.
 */
export function generatePepperaCarousel(
  brief: ContentBrief,
  brandConfig: BrandProfile
): Slide[] {
  const ingredients = toLowerList(brief.ingredients);
  const ingredientLabel = joinIngredients(ingredients.map(titleCase));

  const slides: Slide[] = [];

  // Slide 1: Hook (text-only, no image generation)
  slides.push({
    slide_number: 1,
    role: "hook",
    type: "text_only",
    text: `5 Meals From JUST ${ingredientLabel} 🍳\nWhen your fridge is giving... minimal`,
    image_prompt: null,
    visual_goal: "Bold title card with brand colours",
    layout: "hook_cover",
    asset_path: null,
  });

  // Slides 2–6: Recipes (food image + recipe text)
  for (let i = 0; i < 5; i++) {
    const recipe: StructuredRecipe = {
      recipeName: `Recipe ${i + 1}`,
      ingredients: ingredients.length > 0 ? [...ingredients] : ["ingredient 1", "ingredient 2", "ingredient 3"],
      cookTime: "15 mins",
      steps: ["Prepare ingredients", "Cook and serve"],
      proTip: "Season to taste",
      cost: "~£1.00",
      serves: "1-2",
    };

    slides.push({
      slide_number: i + 2,
      role: "recipe",
      type: "generated_image",
      text: `🍳 RECIPE ${i + 1}: ${recipe.recipeName.toUpperCase()}`,
      image_prompt: buildCartoonFoodPrompt(recipe.recipeName, recipe.ingredients),
      visual_goal: `Food illustration for ${recipe.recipeName}`,
      layout: "recipe_card",
      asset_path: null,
      recipe,
    });
  }

  // Slide 7: CTA (text-only, no image generation)
  const ctaText = brandConfig.cta || "Download Peppera";
  slides.push({
    slide_number: 7,
    role: "cta",
    type: "text_only",
    text: `Want 10,000+ MORE recipes like these?\n📱 ${ctaText} FREE\nWhich recipe are you trying first? Comment 1-5 below! 👇`,
    image_prompt: null,
    visual_goal: "CTA card with brand colours and engagement question",
    layout: "cta_banner",
    asset_path: null,
  });

  return slides;
}
