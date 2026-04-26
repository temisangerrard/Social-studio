/**
 * Pantry-to-Plate — Image Prompt Builder
 * Primary: fal.ai | Fallback: GPT Image 2 (gpt-image-1) when OPENAI_API_KEY set
 * Rule: no text baked into generated images — text added by render layer only
 */

import type { PantryBrandDefaults } from "./brandDefaults.ts";
import type { TemplateId } from "./captionRules.ts";

export type SlideRole = "hook" | "ingredient_grid" | "reveal_transition" | "dish_reveal" | "recipe_trio" | "cta";

export interface ImagePromptSpec {
  role: SlideRole;
  prompt: string;
  negativePrompt: string;
  primaryModel: string;
  fallbackModel: "gpt-image-1" | null;
  requiresImage: boolean;
  aspectRatio: "4:5" | "9:16" | "1:1";
}

const FOOD_BASE = "editorial food photography, soft natural window lighting, shallow depth of field, appetising and realistic, no text in image, no overlays, culturally flexible";
const NEG_BASE = "no text, no watermarks, no overlays, no distorted food, no plastic textures, no fake-looking food, no generic stock photo, no clinical wellness aesthetic, no diet framing, no calorie counters";

const TEXT_SLIDE = (role: SlideRole): ImagePromptSpec => ({
  role, prompt: "", negativePrompt: "", primaryModel: "fal-ai/flux/schnell",
  fallbackModel: null, requiresImage: false, aspectRatio: "4:5",
});

export function buildFridgeToDinnerPrompts(ingredients: string[], dishName: string, brand: PantryBrandDefaults): ImagePromptSpec[] {
  const items = ingredients.slice(0, 6).join(", ");
  return [
    TEXT_SLIDE("hook"),
    { role: "ingredient_grid", requiresImage: true, aspectRatio: "4:5",
      prompt: `${brand.imageStyle}. Flat lay of fresh ingredients on warm cream surface: ${items}. Each ingredient clearly visible, well-spaced, natural colours. ${FOOD_BASE}. Top-down.`,
      negativePrompt: `${NEG_BASE}, no dishes, no cooked food`,
      primaryModel: "fal-ai/nano-banana-2", fallbackModel: "gpt-image-1" },
    TEXT_SLIDE("reveal_transition"),
    { role: "dish_reveal", requiresImage: true, aspectRatio: "4:5",
      prompt: `${brand.imageStyle}. Beautifully plated ${dishName} on a ceramic plate. Warm terracotta and cream tones, soft side lighting, magazine food styling. ${FOOD_BASE}. 45-degree dining angle.`,
      negativePrompt: `${NEG_BASE}`,
      primaryModel: "fal-ai/nano-banana-2", fallbackModel: "gpt-image-1" },
  ];
}

export function buildWasteLessCookMorePrompts(leftovers: string[], dishName: string, brand: PantryBrandDefaults): ImagePromptSpec[] {
  const items = leftovers.slice(0, 5).join(", ");
  return [
    TEXT_SLIDE("hook"),
    { role: "ingredient_grid", requiresImage: true, aspectRatio: "4:5",
      prompt: `${brand.imageStyle}. Rustic arrangement of leftover ingredients on a wooden board: ${items}. Some items partly used. Honest, homely. ${FOOD_BASE}. Top-down.`,
      negativePrompt: `${NEG_BASE}, no rotting food, no mouldy food`,
      primaryModel: "fal-ai/nano-banana-2", fallbackModel: "gpt-image-1" },
    TEXT_SLIDE("reveal_transition"),
    { role: "dish_reveal", requiresImage: true, aspectRatio: "4:5",
      prompt: `${brand.imageStyle}. Beautifully finished ${dishName} in a wide ceramic bowl. Warm, homely but premium. Golden-brown tones, steam rising, simply garnished. ${FOOD_BASE}. 45-degree hero shot.`,
      negativePrompt: `${NEG_BASE}`,
      primaryModel: "fal-ai/nano-banana-2", fallbackModel: "gpt-image-1" },
  ];
}

export function buildWhatCanIMakePrompts(
  ingredients: string[],
  recipes: Array<{ name: string; description?: string }>,
  brand: PantryBrandDefaults
): ImagePromptSpec[] {
  const items = ingredients.slice(0, 5).join(", ");
  const recipeSpecs: ImagePromptSpec[] = recipes.slice(0, 3).map((r) => ({
    role: "dish_reveal" as SlideRole, requiresImage: true, aspectRatio: "1:1" as const,
    prompt: `${brand.imageStyle}. Close-up hero shot of ${r.name}. ${r.description ?? ""} Premium ceramic, warm cream and terracotta tones, soft natural light. ${FOOD_BASE}. Square 1:1.`,
    negativePrompt: NEG_BASE,
    primaryModel: "fal-ai/nano-banana-2", fallbackModel: "gpt-image-1" as const,
  }));
  return [
    TEXT_SLIDE("hook"),
    { role: "ingredient_grid", requiresImage: true, aspectRatio: "4:5",
      prompt: `${brand.imageStyle}. Clean flat lay of fresh ingredients on warm cream linen: ${items}. Well-spaced, clean, inviting. ${FOOD_BASE}. Top-down.`,
      negativePrompt: `${NEG_BASE}, no dishes, no cooked food`,
      primaryModel: "fal-ai/nano-banana-2", fallbackModel: "gpt-image-1" },
    TEXT_SLIDE("reveal_transition"),
    ...recipeSpecs,
  ];
}

export function buildImagePrompts(
  templateId: TemplateId,
  ingredients: string[],
  recipes: Array<{ name: string; description?: string }>,
  brand: PantryBrandDefaults
): ImagePromptSpec[] {
  const dish = recipes[0]?.name ?? "a delicious meal";
  if (templateId === "fridge_to_dinner")    return buildFridgeToDinnerPrompts(ingredients, dish, brand);
  if (templateId === "waste_less_cook_more") return buildWasteLessCookMorePrompts(ingredients, dish, brand);
  if (templateId === "what_can_i_make")     return buildWhatCanIMakePrompts(ingredients, recipes, brand);
  return buildFridgeToDinnerPrompts(ingredients, dish, brand);
}
