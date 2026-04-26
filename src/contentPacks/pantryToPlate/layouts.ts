/**
 * Pantry-to-Plate — Layout Definitions
 *
 * Defines the slide blueprint (slide count, roles, layout types, text fields)
 * for each template. Used by pipeline to build GenerationRequest slide structures.
 */

import type { TemplateId } from "./captionRules.ts";

export interface PantrySlideSpec {
  slideNumber: number;
  role: string;
  layout: string;
  textFields: string[];
  imagePromptTemplate: string | null;
  type: "text_only" | "generated_image";
}

export interface TemplateLayout {
  id: TemplateId;
  name: string;
  description: string;
  slideCount: number;
  slides: PantrySlideSpec[];
}

/** FRIDGE_TO_DINNER: 4 slides */
const FRIDGE_TO_DINNER_LAYOUT: TemplateLayout = {
  id: "fridge_to_dinner",
  name: "Fridge to Dinner",
  description: "Show ingredients → reveal what you can cook from them",
  slideCount: 4,
  slides: [
    {
      slideNumber: 1,
      role: "hook",
      layout: "hook_cover",
      type: "text_only",
      textFields: ["headline", "subtitle"],
      imagePromptTemplate: null,
    },
    {
      slideNumber: 2,
      role: "ingredient_grid",
      layout: "ingredient_card",
      type: "generated_image",
      textFields: ["ingredientList"],
      imagePromptTemplate: "Flat lay of fresh ingredients: {ingredientList}. Top-down, warm cream surface, editorial food photography.",
    },
    {
      slideNumber: 3,
      role: "reveal_transition",
      layout: "problem_setup",
      type: "text_only",
      textFields: ["headline", "body"],
      imagePromptTemplate: null,
    },
    {
      slideNumber: 4,
      role: "dish_reveal",
      layout: "recipe_card",
      type: "generated_image",
      textFields: ["recipeName", "cookTime", "cta"],
      imagePromptTemplate: "Beautifully plated {recipeName}. Warm terracotta tones, ceramic plate, 45-degree angle, editorial food photography.",
    },
  ],
};

/** WASTE_LESS_COOK_MORE: 4 slides */
const WASTE_LESS_COOK_MORE_LAYOUT: TemplateLayout = {
  id: "waste_less_cook_more",
  name: "Waste Less Cook More",
  description: "Turn leftovers and random ingredients into something great",
  slideCount: 4,
  slides: [
    {
      slideNumber: 1,
      role: "hook",
      layout: "hook_cover",
      type: "text_only",
      textFields: ["headline", "subtitle"],
      imagePromptTemplate: null,
    },
    {
      slideNumber: 2,
      role: "ingredient_grid",
      layout: "ingredient_card",
      type: "generated_image",
      textFields: ["ingredientList"],
      imagePromptTemplate: "Rustic arrangement of leftover ingredients on wooden board: {ingredientList}. Honest, homely, editorial food photography.",
    },
    {
      slideNumber: 3,
      role: "reveal_transition",
      layout: "reveal_split",
      type: "text_only",
      textFields: ["headline", "body"],
      imagePromptTemplate: null,
    },
    {
      slideNumber: 4,
      role: "dish_reveal",
      layout: "recipe_card",
      type: "generated_image",
      textFields: ["recipeName", "cookTime", "cta"],
      imagePromptTemplate: "Beautifully finished {recipeName} in a wide ceramic bowl. Golden-brown, steam rising, editorial food photography.",
    },
  ],
};

/** WHAT_CAN_I_MAKE: 6 slides (hook + ingredients + transition + 3 recipe options) */
const WHAT_CAN_I_MAKE_LAYOUT: TemplateLayout = {
  id: "what_can_i_make",
  name: "What Can I Make",
  description: "Give 3–5 ingredients, get 3 recipe ideas back",
  slideCount: 6,
  slides: [
    {
      slideNumber: 1,
      role: "hook",
      layout: "hook_cover",
      type: "text_only",
      textFields: ["headline", "subtitle"],
      imagePromptTemplate: null,
    },
    {
      slideNumber: 2,
      role: "ingredient_grid",
      layout: "ingredient_card",
      type: "generated_image",
      textFields: ["ingredientList"],
      imagePromptTemplate: "Clean flat lay of fresh ingredients on warm cream linen: {ingredientList}. Top-down, editorial food photography.",
    },
    {
      slideNumber: 3,
      role: "reveal_transition",
      layout: "problem_setup",
      type: "text_only",
      textFields: ["headline", "body"],
      imagePromptTemplate: null,
    },
    {
      slideNumber: 4,
      role: "recipe_option_1",
      layout: "recipe_card",
      type: "generated_image",
      textFields: ["recipeName", "cookTime"],
      imagePromptTemplate: "Close-up hero shot of {recipeName}. Premium ceramic, warm cream tones, soft natural light, editorial food photography. Square.",
    },
    {
      slideNumber: 5,
      role: "recipe_option_2",
      layout: "recipe_card",
      type: "generated_image",
      textFields: ["recipeName", "cookTime"],
      imagePromptTemplate: "Close-up hero shot of {recipeName}. Premium ceramic, warm cream tones, soft natural light, editorial food photography. Square.",
    },
    {
      slideNumber: 6,
      role: "recipe_option_3",
      layout: "recipe_card",
      type: "generated_image",
      textFields: ["recipeName", "cookTime", "cta"],
      imagePromptTemplate: "Close-up hero shot of {recipeName}. Premium ceramic, warm cream tones, soft natural light, editorial food photography. Square.",
    },
  ],
};

const LAYOUT_MAP: Record<TemplateId, TemplateLayout> = {
  fridge_to_dinner: FRIDGE_TO_DINNER_LAYOUT,
  waste_less_cook_more: WASTE_LESS_COOK_MORE_LAYOUT,
  what_can_i_make: WHAT_CAN_I_MAKE_LAYOUT,
};

export function getTemplateLayout(templateId: TemplateId): TemplateLayout {
  return LAYOUT_MAP[templateId];
}

export function getAllTemplateLayouts(): TemplateLayout[] {
  return Object.values(LAYOUT_MAP);
}
