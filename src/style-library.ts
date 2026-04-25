import type { StyleCard } from "./types.ts";

// ── Built-in Presets ──────────────────────────────────────────────────────────

const NEGATIVE_DEFAULTS: string[] = [
  "no startup gradients",
  "no floating UI mockups unless requested",
  "no random 3D icons",
  "no emoji overlays",
  "no overly saturated AI look",
  "no generic motivational poster composition",
  "no cramped copy",
  "no stock-photo business aesthetic",
  "no excessive text effects",
  "no Canva-style template clutter",
];

function makePreset(partial: Omit<StyleCard, "source" | "createdAt" | "updatedAt">): StyleCard {
  const now = new Date().toISOString();
  return { ...partial, source: "builtin", createdAt: now, updatedAt: now };
}

export const BUILTIN_PRESETS: StyleCard[] = [
  makePreset({
    id: "editorial-cultural-carousel",
    name: "Editorial Cultural Carousel",
    intent: "Instagram carousel for cultural commentary, events, and art storytelling",
    imageStyle: "cinematic documentary editorial",
    layoutStyle: "minimal magazine carousel",
    copyStyle: "curated cultural commentary",
    visualTraits: {
      layout: ["full-bleed image top", "text block bottom", "high whitespace", "centered composition"],
      typography: ["editorial serif", "high contrast serif", "large headline", "small supporting body"],
      colorMode: "muted neutral background with dark type",
      imageTreatment: ["photographic", "cinematic", "documentary", "soft natural grading"],
      composition: ["image-led", "clean margins", "luxury magazine pacing"],
      tone: ["curated", "intelligent", "cultural", "premium"],
    },
    contentRules: {
      maxTextWordsPerSlide: 45,
      headlineRequired: false,
      bodyRequired: true,
      captionStyle: "editorial and concise",
      avoid: ["generic marketing gradients", "emoji-heavy design", "tech startup visuals", "cluttered collage"],
    },
    generationRequirements: { needsImage: true, needsLayoutEngine: true, needsTypographyPairing: true },
    negativeConstraints: [...NEGATIVE_DEFAULTS, "no tech startup visuals", "no cluttered collage"],
  }),

  makePreset({
    id: "bold-monochrome-manifesto",
    name: "Bold Monochrome Manifesto",
    intent: "Big statements and campaign messages — poster-like impact",
    imageStyle: "high contrast black and white editorial",
    layoutStyle: "oversized type poster",
    copyStyle: "manifesto — short, punchy, declarative",
    visualTraits: {
      layout: ["full-bleed type", "centered single statement", "minimal graphic elements"],
      typography: ["oversized condensed sans", "ultra bold weight", "tight tracking"],
      colorMode: "black and white only",
      imageTreatment: ["monochrome", "high contrast", "grain texture"],
      composition: ["type-led", "poster-like", "disruptive"],
      tone: ["bold", "confrontational", "authoritative", "disruptive"],
    },
    contentRules: {
      maxTextWordsPerSlide: 20,
      headlineRequired: true,
      bodyRequired: false,
      captionStyle: "sharp and provocative",
      avoid: ["colour gradients", "decorative elements", "soft tones", "rounded shapes"],
    },
    generationRequirements: { needsImage: false, needsLayoutEngine: true, needsTypographyPairing: true },
    negativeConstraints: [...NEGATIVE_DEFAULTS, "no colour", "no decorative elements", "no soft tones"],
  }),

  makePreset({
    id: "founder-profile-spotlight",
    name: "Founder / Profile Spotlight",
    intent: "Interviews, featured people, community stories — human-centered",
    imageStyle: "cinematic portraiture with natural light",
    layoutStyle: "portrait card with clean text panel",
    copyStyle: "biographical — name hierarchy, short explainer",
    visualTraits: {
      layout: ["portrait-led", "rounded card or clean text panel", "strong name hierarchy"],
      typography: ["clean sans-serif", "bold name", "light body text"],
      colorMode: "warm neutral with brand accent",
      imageTreatment: ["photographic", "portrait", "natural light", "shallow depth of field"],
      composition: ["human-centered", "face-forward", "intimate framing"],
      tone: ["personal", "warm", "authentic", "professional"],
    },
    contentRules: {
      maxTextWordsPerSlide: 35,
      headlineRequired: true,
      bodyRequired: true,
      captionStyle: "personal and direct",
      avoid: ["abstract graphics", "busy backgrounds", "corporate headshot style"],
    },
    generationRequirements: { needsImage: true, needsLayoutEngine: true, needsTypographyPairing: true },
    negativeConstraints: [...NEGATIVE_DEFAULTS, "no abstract graphics", "no corporate headshot style"],
  }),

  makePreset({
    id: "magazine-info-slide",
    name: "Magazine Info Slide",
    intent: "Data-driven content, stats, breakdowns — editorial infographic feel",
    imageStyle: "clean data visualization with editorial photography",
    layoutStyle: "structured grid with clear hierarchy",
    copyStyle: "informational — stat callouts, concise explanations",
    visualTraits: {
      layout: ["structured grid", "stat callouts", "clear section breaks"],
      typography: ["tabular numbers", "bold stat display", "small label text"],
      colorMode: "light background with dark type and one accent",
      imageTreatment: ["photographic accents", "clean icons", "data visualization"],
      composition: ["information-led", "scannable", "editorial grid"],
      tone: ["informative", "credible", "clean", "modern"],
    },
    contentRules: {
      maxTextWordsPerSlide: 60,
      headlineRequired: true,
      bodyRequired: true,
      captionStyle: "factual and engaging",
      avoid: ["decorative illustrations", "busy patterns", "handwritten fonts"],
    },
    generationRequirements: { needsImage: false, needsLayoutEngine: true, needsTypographyPairing: true },
    negativeConstraints: [...NEGATIVE_DEFAULTS, "no decorative illustrations", "no handwritten fonts"],
  }),

  makePreset({
    id: "portrait-quote-card",
    name: "Portrait + Quote Card",
    intent: "Quotes, testimonials, pull quotes — elegant and shareable",
    imageStyle: "editorial portrait or abstract texture",
    layoutStyle: "centered quote with attribution",
    copyStyle: "quotation — large pull quote, small attribution",
    visualTraits: {
      layout: ["centered quote block", "large quotation marks", "attribution below"],
      typography: ["elegant serif for quote", "small caps for attribution"],
      colorMode: "muted background with high contrast quote text",
      imageTreatment: ["photographic portrait", "abstract texture", "soft gradient"],
      composition: ["text-centered", "generous whitespace", "elegant"],
      tone: ["thoughtful", "elegant", "shareable", "premium"],
    },
    contentRules: {
      maxTextWordsPerSlide: 30,
      headlineRequired: false,
      bodyRequired: true,
      captionStyle: "reflective and concise",
      avoid: ["busy backgrounds", "multiple fonts", "decorative borders"],
    },
    generationRequirements: { needsImage: false, needsLayoutEngine: true, needsTypographyPairing: true },
    negativeConstraints: [...NEGATIVE_DEFAULTS, "no busy backgrounds", "no decorative borders"],
  }),

  makePreset({
    id: "event-explainer-carousel",
    name: "Event Explainer Carousel",
    intent: "Event recaps, how-it-works, step-by-step explainers",
    imageStyle: "documentary event photography with editorial crop",
    layoutStyle: "numbered sequence with image-text pairs",
    copyStyle: "explanatory — step labels, concise descriptions",
    visualTraits: {
      layout: ["numbered steps", "image-text pairs", "progress indicators"],
      typography: ["bold step numbers", "clean body text", "consistent sizing"],
      colorMode: "brand-tinted background with clear type",
      imageTreatment: ["documentary", "event photography", "action shots"],
      composition: ["sequential", "paced", "easy to follow"],
      tone: ["informative", "energetic", "accessible", "structured"],
    },
    contentRules: {
      maxTextWordsPerSlide: 40,
      headlineRequired: true,
      bodyRequired: true,
      captionStyle: "informative with energy",
      avoid: ["abstract visuals", "unrelated stock photos", "walls of text"],
    },
    generationRequirements: { needsImage: true, needsLayoutEngine: true, needsTypographyPairing: true },
    negativeConstraints: [...NEGATIVE_DEFAULTS, "no abstract visuals", "no unrelated stock photos"],
  }),
  makePreset({
    id: "ugc-faceless-explainer",
    name: "UGC Faceless Explainer",
    intent: "Faceless TikTok/Reels content — voiceover + visuals, no on-camera talent needed",
    imageStyle: "clean product shots, screen recordings, b-roll footage style",
    layoutStyle: "full-bleed visual with subtitle overlay",
    copyStyle: "conversational script — hook, problem, solution, CTA",
    visualTraits: {
      layout: ["full-bleed visual", "subtitle bar bottom", "progress indicator"],
      typography: ["bold subtitle sans", "high contrast on dark bg", "word-by-word highlight"],
      colorMode: "dark overlay with white subtitles",
      imageTreatment: ["product photography", "screen capture", "stock b-roll", "kinetic text"],
      composition: ["vertical 9:16", "visual-led with text overlay", "fast-paced cuts"],
      tone: ["conversational", "relatable", "informative", "scroll-stopping"],
    },
    contentRules: {
      maxTextWordsPerSlide: 15,
      headlineRequired: false,
      bodyRequired: true,
      captionStyle: "casual, direct, first-person",
      avoid: ["corporate tone", "long sentences", "complex vocabulary", "static slides"],
    },
    generationRequirements: { needsImage: true, needsLayoutEngine: true, needsTypographyPairing: true },
    negativeConstraints: [...NEGATIVE_DEFAULTS, "no static presentation slides", "no corporate tone"],
  }),

  makePreset({
    id: "ugc-voiceover-story",
    name: "UGC Voiceover Story",
    intent: "Story-driven UGC with AI voiceover — product reviews, tutorials, day-in-my-life",
    imageStyle: "lifestyle photography, POV shots, authentic texture",
    layoutStyle: "story sequence with voiceover narration",
    copyStyle: "first-person narrative — authentic, unscripted feel",
    visualTraits: {
      layout: ["story sequence", "scene transitions", "subtitle overlay"],
      typography: ["casual sans-serif subtitles", "handwritten accents"],
      colorMode: "natural warm tones with soft overlay",
      imageTreatment: ["lifestyle", "POV", "authentic", "slightly imperfect"],
      composition: ["vertical 9:16", "intimate framing", "natural movement"],
      tone: ["authentic", "personal", "trustworthy", "relatable"],
    },
    contentRules: {
      maxTextWordsPerSlide: 20,
      headlineRequired: false,
      bodyRequired: true,
      captionStyle: "first-person, conversational, like talking to a friend",
      avoid: ["polished corporate", "third-person", "marketing speak", "perfect lighting"],
    },
    generationRequirements: { needsImage: true, needsLayoutEngine: true, needsTypographyPairing: true },
    negativeConstraints: [...NEGATIVE_DEFAULTS, "no corporate polish", "no third-person narration", "no marketing speak"],
  }),
];

// ── Style Library ─────────────────────────────────────────────────────────────

const builtinMap = new Map(BUILTIN_PRESETS.map((p) => [p.id, p]));

export function getBuiltinPreset(id: string): StyleCard | null {
  return builtinMap.get(id) ?? null;
}

export function listBuiltinPresets(): StyleCard[] {
  return [...BUILTIN_PRESETS];
}

export function resolveStyleCard(
  id: string,
  customCards: StyleCard[]
): StyleCard | null {
  return customCards.find((c) => c.id === id) ?? builtinMap.get(id) ?? null;
}
