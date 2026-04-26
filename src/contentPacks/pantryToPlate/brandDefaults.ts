/**
 * Pantry-to-Plate — Brand Defaults
 *
 * Peppera-specific defaults applied when brandId === "peppera".
 * Swap these out for other brands to reuse the pack with different voice/style.
 */

export interface PantryBrandDefaults {
  tone: string;
  visualStyle: string;
  imageStyle: string;
  colorPalette: {
    background: string;
    text: string;
    accent: string;
    surface: string;
  };
  ctaOptions: string[];
  hashtags: string[];
  negativeConstraints: string[];
  audienceContext: string;
  positioningNote: string;
}

/** Peppera brand defaults for Pantry-to-Plate content */
export const PEPPERA_PANTRY_DEFAULTS: PantryBrandDefaults = {
  tone: "helpful, warm, practical, lightly playful — never diet-focused, never calorie-deficit, never weight-loss framing",
  visualStyle: "warm cream background · sage and olive accents · terracotta food warmth · editorial food photography · soft natural window light · premium but homely · magazine-style typography · minimal clutter",
  imageStyle:
    "editorial food photography, soft natural window lighting, warm cream and terracotta tones, ingredients and dishes shot from above or at 45 degrees, shallow depth of field, premium home-cooking aesthetic, no text baked into images, no plastic or fake-looking food, no distorted plates",
  colorPalette: {
    background: "#FAF6EF",  // warm cream
    text: "#2C1810",        // deep warm brown
    accent: "#B07A5A",      // terracotta
    surface: "#E8E0D0",     // sage-tinted surface
  },
  ctaOptions: [
    "Try your ingredients on Peppera",
    "Turn your kitchen into dinner",
    "Find recipes from what you have",
    "Cook with what's already there",
    "Download Peppera — free",
  ],
  hashtags: [
    "#pantryrecipes",
    "#fridgetofork",
    "#easydinners",
    "#mealideas",
    "#cookwithwhatyouhave",
    "#reducefoodwaste",
    "#homecooking",
    "#quickmeals",
    "#peppera",
    "#kitchenhacks",
  ],
  negativeConstraints: [
    "no diet language",
    "no calorie counting",
    "no weight loss framing",
    "no transformation before/after framing",
    "no clinical wellness design",
    "no fake-looking food",
    "no plastic food textures",
    "no distorted plates",
    "no text baked into generated images",
    "no generic stock-photo feel",
    "no overly saturated AI-look",
    "no messy unreadable layouts",
    "no random text inside images",
  ],
  audienceContext: "busy home cooks who want practical meal ideas from ingredients they already have",
  positioningNote:
    "Peppera is a pantry-first meal planning app. Core message: turn what you already have into something delicious. Not a meal-kit, not a diet app, not a calorie tracker.",
};

/** Generic fallback defaults for non-Peppera brands */
export const GENERIC_PANTRY_DEFAULTS: PantryBrandDefaults = {
  tone: "helpful, practical, warm, encouraging",
  visualStyle: "clean food photography, natural lighting, neutral background with warm accents",
  imageStyle:
    "editorial food photography, natural lighting, appetising and realistic, culturally flexible, no text baked into images",
  colorPalette: {
    background: "#FAFAF8",
    text: "#1A1A14",
    accent: "#7A6B5A",
    surface: "#F0EDE8",
  },
  ctaOptions: [
    "Try it now",
    "Cook with what you have",
    "Turn leftovers into dinner",
  ],
  hashtags: [
    "#mealideas",
    "#easydinners",
    "#cookwithwhatyouhave",
    "#homecooking",
    "#quickmeals",
  ],
  negativeConstraints: [
    "no diet language",
    "no calorie counting",
    "no text baked into generated images",
    "no fake-looking food",
    "no generic stock-photo feel",
  ],
  audienceContext: "home cooks looking for quick meal inspiration",
  positioningNote: "Help users cook delicious meals from ingredients they already have.",
};

export function getBrandDefaults(brandId: string): PantryBrandDefaults {
  if (brandId === "peppera") return PEPPERA_PANTRY_DEFAULTS;
  return GENERIC_PANTRY_DEFAULTS;
}
