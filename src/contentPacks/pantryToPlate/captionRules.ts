/**
 * Pantry-to-Plate — Caption Rules
 *
 * Rules for caption, hashtag, and hook copy for all three templates.
 * Brand voice and CTAs are injected from brandDefaults.
 */

import type { PantryBrandDefaults } from "./brandDefaults.ts";

export type TemplateId = "fridge_to_dinner" | "waste_less_cook_more" | "what_can_i_make";

export interface CaptionRuleSet {
  captionOpeners: string[];
  captionStructure: string;
  hookOptions: string[];
  hashtagCount: { min: number; max: number };
  avoidPhrases: string[];
  toneReminders: string[];
}

const FRIDGE_TO_DINNER_RULES: CaptionRuleSet = {
  captionOpeners: [
    "Staring into your fridge wondering what to make?",
    "You already have everything you need.",
    "That random fridge situation? We've got you.",
    "Dinner doesn't require a grocery run.",
    "Open fridge. See ingredients. Make dinner.",
  ],
  captionStructure:
    "opener → what ingredients → what you can make → CTA. Keep it under 150 chars before the hashtags. Conversational, not formal.",
  hookOptions: [
    "What's in your fridge? →",
    "Fridge check → dinner idea in 30 mins",
    "Got {ingredient1} and {ingredient2}? Here's dinner.",
    "Stop staring. Start cooking. →",
    "Your fridge already has dinner in it.",
  ],
  hashtagCount: { min: 6, max: 10 },
  avoidPhrases: [
    "diet", "calories", "weight loss", "healthy eating", "clean eating",
    "guilt-free", "macro", "transformation", "low-cal",
  ],
  toneReminders: [
    "Sound like a friend who cooks, not a nutritionist",
    "Practical first, playful second",
    "Never shame the fridge — celebrate it",
  ],
};

const WASTE_LESS_COOK_MORE_RULES: CaptionRuleSet = {
  captionOpeners: [
    "Don't throw that away.",
    "That leftover is actually dinner.",
    "Your bin doesn't need that. Your stomach does.",
    "Halfway through the week, full of potential.",
    "Leftovers aren't sad. They're a head start.",
  ],
  captionStructure:
    "opener → name the leftovers → what they become → CTA. Warm, anti-waste framing. Not preachy — celebratory.",
  hookOptions: [
    "Don't throw this away →",
    "Leftover {ingredient}? Make this instead.",
    "Your fridge scraps = tonight's dinner",
    "Half an onion + leftover rice = →",
    "This counts as cooking. Trust.",
  ],
  hashtagCount: { min: 6, max: 10 },
  avoidPhrases: [
    "diet", "calories", "clean eating", "weight loss",
    "food guilt", "indulge", "cheat meal",
  ],
  toneReminders: [
    "Anti-waste but not preachy",
    "Celebratory, not moralising",
    "Make it feel like a win, not a duty",
  ],
};

const WHAT_CAN_I_MAKE_RULES: CaptionRuleSet = {
  captionOpeners: [
    "What can I make with…",
    "3 ingredients. 3 dinner ideas.",
    "You typed the ingredients. We found the recipes.",
    "Got {ingredient1}, {ingredient2}, {ingredient3}? Pick a recipe →",
    "Which one are you making tonight?",
  ],
  captionStructure:
    "opener → list ingredients → tease the 3 ideas → ask the question (which one?) → CTA. Conversational, creates engagement.",
  hookOptions: [
    "What can I make with {ingredient1} and {ingredient2}?",
    "3 recipes from {ingredient1}, {ingredient2}, {ingredient3}",
    "You have {ingredients}. We found dinner.",
    "Pick one →",
    "This is what {ingredients} can become →",
  ],
  hashtagCount: { min: 6, max: 10 },
  avoidPhrases: [
    "diet", "calories", "macros", "healthy", "clean eating", "weight loss",
  ],
  toneReminders: [
    "Make it feel like a game, not a chore",
    "Ask a question — get comments",
    "Short, punchy, specific to the ingredients",
  ],
};

const RULES_MAP: Record<TemplateId, CaptionRuleSet> = {
  fridge_to_dinner: FRIDGE_TO_DINNER_RULES,
  waste_less_cook_more: WASTE_LESS_COOK_MORE_RULES,
  what_can_i_make: WHAT_CAN_I_MAKE_RULES,
};

export function getCaptionRules(templateId: TemplateId): CaptionRuleSet {
  return RULES_MAP[templateId];
}

/**
 * Build a complete caption prompt for the GLM/planner to fill in.
 */
export function buildCaptionPrompt(
  templateId: TemplateId,
  ingredients: string[],
  dishName: string,
  brand: PantryBrandDefaults
): string {
  const rules = getCaptionRules(templateId);
  const ingredientList = ingredients.join(", ");
  const cta = brand.ctaOptions[0];

  return `Write a social media caption for a ${templateId.replace(/_/g, " ")} post.

Ingredients shown: ${ingredientList}
Dish / outcome: ${dishName}
Brand CTA: ${cta}

Caption structure: ${rules.captionStructure}

Caption opener options (pick or adapt one):
${rules.captionOpeners.map((o) => `- ${o}`).join("\n")}

Tone reminders:
${rules.toneReminders.map((r) => `- ${r}`).join("\n")}

Strictly avoid these words and phrases: ${rules.avoidPhrases.join(", ")}

Brand tone: ${brand.tone}

Write the caption text only. Do not include hashtags in the caption body — they will be added separately.
Keep it under 150 characters before hashtags.`;
}

/**
 * Select hashtags for a given template, trimmed to the brand's allowed count.
 */
export function selectHashtags(
  templateId: TemplateId,
  brand: PantryBrandDefaults,
  ingredients: string[] = []
): string[] {
  const rules = getCaptionRules(templateId);
  const baseHashtags = brand.hashtags.slice(0, rules.hashtagCount.max);

  // Add ingredient-specific hashtags if they're common foods
  const ingredientTags = ingredients
    .filter((i) => i.length > 2 && i.length < 20)
    .slice(0, 2)
    .map((i) => `#${i.toLowerCase().replace(/[^a-z]/g, "")}`);

  return [...baseHashtags, ...ingredientTags].slice(0, rules.hashtagCount.max);
}
