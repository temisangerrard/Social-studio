/**
 * Pantry-to-Plate — Template Pack Entry Point
 *
 * Exposes: generateIdea, generateCreativeBrief, generateImagePrompts, generateRenderPlan
 * Works for Peppera today. Swap brandId for any other brand.
 */

import type { TemplateId } from "./captionRules.ts";
import { getBrandDefaults, type PantryBrandDefaults } from "./brandDefaults.ts";
import { buildImagePrompts, type ImagePromptSpec } from "./prompts.ts";
import { getTemplateLayout, type TemplateLayout, type PantrySlideSpec } from "./layouts.ts";
import { buildCaptionPrompt, selectHashtags, getCaptionRules } from "./captionRules.ts";

// ── Types ───────────────────────────────────────────────────────────────────

export interface PantryIdeaInput {
  rawText: string;
  brandId: string;
  platform: "instagram" | "tiktok" | "linkedin";
}

export interface PantryIdea {
  suggestedTemplate: TemplateId;
  templateReason: string;
  ingredients: string[];
  suggestedDish: string;
}

export interface PantryCreativeBrief {
  templateId: TemplateId;
  ingredients: string[];
  recipes: Array<{ name: string; description: string; cookTime?: string }>;
  hookHeadline: string;
  hookSubtitle: string;
  revealHeadline: string;
  revealBody: string;
  captionPrompt: string;
  hashtags: string[];
  brand: PantryBrandDefaults;
  layout: TemplateLayout;
}

export interface PantryAsset {
  slideNumber: number;
  role: string;
  imageUrl: string | null;
  prompt: ImagePromptSpec | null;
}

export interface PantryRenderSlide {
  slideNumber: number;
  role: string;
  layout: string;
  type: "text_only" | "generated_image";
  imageUrl: string | null;
  textContent: Record<string, string>;
  imagePrompt: string | null;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
}

export interface PantryRenderPlan {
  postId: string;
  templateId: TemplateId;
  platform: string;
  slideCount: number;
  slides: PantryRenderSlide[];
  caption: string;
  hashtags: string[];
  imagePrompts: ImagePromptSpec[];
}

// ── Functions ───────────────────────────────────────────────────────────────

function extractIngredients(raw: string): string[] {
  return raw.split(/[,\n]+/)
    .map((s) => s.trim().toLowerCase().replace(/^(and|with|plus|&)\s+/i, ""))
    .filter((s) => s.length > 1 && s.length < 40);
}

export function generateIdea(input: PantryIdeaInput): PantryIdea {
  const text = input.rawText.toLowerCase();
  const ingredients = extractIngredients(input.rawText);
  if (/what.*make|3.*ideas/.test(text))
    return { suggestedTemplate: "what_can_i_make", templateReason: "Multiple recipe options requested", ingredients, suggestedDish: "multiple options" };
  if (/leftover|throw away|waste|day-old|stale/.test(text))
    return { suggestedTemplate: "waste_less_cook_more", templateReason: "Leftover framing detected", ingredients, suggestedDish: "a dish from leftovers" };
  return { suggestedTemplate: "fridge_to_dinner", templateReason: "Ingredient list → fridge-to-dinner reveal", ingredients, suggestedDish: "a dinner from your ingredients" };
}

export function generateCreativeBrief(
  idea: PantryIdea, brandId: string,
  recipes: Array<{ name: string; description: string; cookTime?: string }> = [],
  _platform: string = "instagram"
): PantryCreativeBrief {
  const brand = getBrandDefaults(brandId);
  const layout = getTemplateLayout(idea.suggestedTemplate);
  const r = recipes.length > 0 ? recipes : [{ name: idea.suggestedDish, description: `Made from ${idea.ingredients.join(", ")}`, cookTime: "30 mins" }];
  const t = idea.suggestedTemplate;
  const hooks: Record<TemplateId, string> = {
    fridge_to_dinner: "What's in your fridge?",
    waste_less_cook_more: "Don't throw this away",
    what_can_i_make: `What can I make with ${idea.ingredients.slice(0, 3).join(", ")}?`,
  };
  const subs: Record<TemplateId, string> = {
    fridge_to_dinner: idea.ingredients.slice(0, 4).join(" · "),
    waste_less_cook_more: `${idea.ingredients.slice(0, 3).join(", ")} → dinner tonight`,
    what_can_i_make: "Swipe for 3 ideas →",
  };
  const reveals: Record<TemplateId, string> = {
    fridge_to_dinner: "We'll show you what to make",
    waste_less_cook_more: "Turn it into…",
    what_can_i_make: "Here are 3 ideas",
  };
  const bodies: Record<TemplateId, string> = {
    fridge_to_dinner: `${idea.ingredients.length} ingredients → ${r[0].name}`,
    waste_less_cook_more: "One pan. 30 minutes. Zero waste.",
    what_can_i_make: "Pick the one that looks best 👇",
  };
  return {
    templateId: t, ingredients: idea.ingredients, recipes: r,
    hookHeadline: hooks[t], hookSubtitle: subs[t],
    revealHeadline: reveals[t], revealBody: bodies[t],
    captionPrompt: buildCaptionPrompt(t, idea.ingredients, r[0].name, brand),
    hashtags: selectHashtags(t, brand, idea.ingredients),
    brand, layout,
  };
}

export function generateImagePrompts(brief: PantryCreativeBrief): ImagePromptSpec[] {
  return buildImagePrompts(brief.templateId, brief.ingredients, brief.recipes, brief.brand);
}

function interp(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

export function generateRenderPlan(
  brief: PantryCreativeBrief, assets: PantryAsset[],
  platform: "instagram" | "tiktok" | "linkedin" = "instagram",
  generatedCaption?: string
): PantryRenderPlan {
  const postId = `pantry_${brief.templateId}_${Date.now()}`;
  const imageMap = new Map(assets.map((a) => [a.slideNumber, a]));
  const imagePrompts = generateImagePrompts(brief);
  const slides: PantryRenderSlide[] = brief.layout.slides.map((spec: PantrySlideSpec) => {
    const asset = imageMap.get(spec.slideNumber);
    const r = brief.recipes[0];
    const recipeMatch = spec.role.match(/recipe_option_(\d+)/);
    const rIdx = recipeMatch ? brief.recipes[parseInt(recipeMatch[1]) - 1] : r;
    const textContent: Record<string, string> = {
      headline: spec.role === "hook" ? brief.hookHeadline : spec.role === "reveal_transition" ? brief.revealHeadline : "",
      subtitle: spec.role === "hook" ? brief.hookSubtitle : "",
      body: spec.role === "reveal_transition" ? brief.revealBody : "",
      ingredientList: brief.ingredients.join(", "),
      recipeName: rIdx?.name ?? r?.name ?? "",
      cookTime: rIdx?.cookTime ?? r?.cookTime ?? "",
      cta: brief.brand.ctaOptions[0],
    };
    return {
      slideNumber: spec.slideNumber, role: spec.role, layout: spec.layout, type: spec.type,
      imageUrl: asset?.imageUrl ?? null, textContent,
      imagePrompt: spec.imagePromptTemplate ? interp(spec.imagePromptTemplate, textContent) : null,
      backgroundColor: brief.brand.colorPalette.background,
      textColor: brief.brand.colorPalette.text,
      accentColor: brief.brand.colorPalette.accent,
    };
  });
  const caption = generatedCaption ?? `${brief.hookHeadline} ${brief.ingredients.slice(0, 3).join(", ")} → ${brief.recipes[0].name}. ${brief.brand.ctaOptions[0]}`;
  return { postId, templateId: brief.templateId, platform, slideCount: slides.length, slides, caption, hashtags: brief.hashtags, imagePrompts };
}
