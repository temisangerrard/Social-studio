import type {
  BrandProfile,
  CreativeBrief,
  GenerationMode,
  GenerationRequest,
  RenderSpec,
  Slide,
  SlideRole,
  StructuredPromptOutput,
  StyleCard,
  StyleControlledRequest,
  TextDensity,
} from "./types.ts";

// ── Creative Direction Engine ─────────────────────────────────────────────────
// Converts a style card + topic into a structured creative brief, then produces
// separated image/layout/copy prompts instead of one monolithic prompt.

interface DirectorInput {
  style: StyleCard;
  request: GenerationRequest;
  brand: BrandProfile;
  control: StyleControlledRequest;
}

// ── Creative Brief Builder ────────────────────────────────────────────────────

function inferVisualAngle(style: StyleCard, topic: string): string {
  const toneJoin = style.visualTraits.tone.join(", ");
  return `${toneJoin} visual treatment for: ${topic}. Image style: ${style.imageStyle}. Composition: ${style.visualTraits.composition.join(", ")}`;
}

function inferSlideNarrative(style: StyleCard, topic: string, slideCount: number): string[] {
  const narrative: string[] = [];
  if (style.contentRules.headlineRequired) narrative.push("Opening hook / headline slide");
  const bodySlides = Math.max(1, slideCount - (style.contentRules.headlineRequired ? 2 : 1));
  for (let i = 0; i < bodySlides; i++) narrative.push(`Content slide ${i + 1}: develop the narrative`);
  narrative.push("Closing CTA / takeaway slide");
  return narrative;
}

function inferTypographyMood(style: StyleCard): string {
  return style.visualTraits.typography.join(", ");
}

function inferCopyDensity(style: StyleCard, override?: TextDensity): TextDensity {
  if (override) return override;
  const max = style.contentRules.maxTextWordsPerSlide;
  if (max <= 25) return "low";
  if (max <= 45) return "medium";
  return "high";
}

export function buildCreativeBrief(input: DirectorInput): CreativeBrief {
  const { style, request, control } = input;
  const topic = request.rawIdea || "untitled topic";
  const density = inferCopyDensity(style, control.textDensity);

  return {
    styleCardId: style.id,
    styleName: style.name,
    topic,
    visualAngle: inferVisualAngle(style, topic),
    slideNarrative: inferSlideNarrative(style, topic, 5),
    imageBrief: `${style.imageStyle}. Treatment: ${style.visualTraits.imageTreatment.join(", ")}. Avoid: ${style.negativeConstraints.slice(0, 5).join(", ")}`,
    layoutBrief: `${style.layoutStyle}. Layout: ${style.visualTraits.layout.join(", ")}`,
    copyDensity: density,
    typographyMood: inferTypographyMood(style),
    renderRecommendation: `Use ${style.layoutStyle} with ${style.visualTraits.colorMode}. Generation mode: ${control.generationMode ?? "image-first"}`,
  };
}

// ── Structured Prompt Builder ─────────────────────────────────────────────────

function buildImagePrompt(style: StyleCard, brief: CreativeBrief, brand: BrandProfile): string {
  const parts = [
    style.imageStyle,
    brief.visualAngle,
    `Color: ${style.visualTraits.colorMode}`,
    `Composition: ${style.visualTraits.composition.join(", ")}`,
    `Treatment: ${style.visualTraits.imageTreatment.join(", ")}`,
  ];
  if (brand.visual.primaryColor) parts.push(`Brand accent: ${brand.visual.primaryColor}`);
  parts.push(`AVOID: ${style.negativeConstraints.join(", ")}`);
  return parts.join(". ");
}

function buildLayoutPrompt(style: StyleCard, brief: CreativeBrief): string {
  return [
    style.layoutStyle,
    `Layout: ${style.visualTraits.layout.join(", ")}`,
    `Typography: ${brief.typographyMood}`,
    `Copy density: ${brief.copyDensity}`,
    `Max words per slide: ${style.contentRules.maxTextWordsPerSlide}`,
    style.contentRules.headlineRequired ? "Headline required" : "Headline optional",
  ].join(". ");
}

function buildTextOverlayRules(style: StyleCard): string {
  return [
    `Caption style: ${style.contentRules.captionStyle}`,
    `Body required: ${style.contentRules.bodyRequired}`,
    `Avoid: ${style.contentRules.avoid.join(", ")}`,
  ].join(". ");
}

function buildRenderSpec(style: StyleCard, control: StyleControlledRequest): RenderSpec {
  const isCarousel = style.visualTraits.layout.some((l) => l.includes("carousel") || l.includes("sequence"));
  return {
    aspectRatio: isCarousel ? "4:5" : "9:16",
    safeMargins: 80,
    textAlignment: style.visualTraits.layout.includes("centered composition") ? "center" : "left",
    imageCrop: style.visualTraits.composition.includes("image-led") ? "top-weighted portrait crop" : "center crop",
  };
}

export function buildStructuredPrompt(input: DirectorInput): StructuredPromptOutput {
  const brief = buildCreativeBrief(input);
  return {
    creativeBrief: brief,
    imagePrompt: buildImagePrompt(input.style, brief, input.brand),
    layoutPrompt: buildLayoutPrompt(input.style, brief),
    textOverlayRules: buildTextOverlayRules(input.style),
    renderSpec: buildRenderSpec(input.style, input.control),
  };
}

// ── Slide Generation from Style Card ──────────────────────────────────────────

function roleForIndex(index: number, total: number, style: StyleCard): SlideRole {
  if (index === 0 && style.contentRules.headlineRequired) return "hook";
  if (index === total - 1) return "cta";
  return "benefit";
}

function slideImagePrompt(
  style: StyleCard,
  brand: BrandProfile,
  slideRole: SlideRole,
  topic: string,
  control: StyleControlledRequest
): string | null {
  if (!style.generationRequirements.needsImage && slideRole !== "hook") return null;

  const parts = [
    style.imageStyle,
    `${slideRole} visual for: ${topic}`,
    `Treatment: ${style.visualTraits.imageTreatment.join(", ")}`,
    `Composition: ${style.visualTraits.composition.join(", ")}`,
    `Color: ${style.visualTraits.colorMode}`,
  ];

  if (control.imageTreatment) parts.push(`Override treatment: ${control.imageTreatment}`);
  if (brand.visual.primaryColor) parts.push(`Brand accent: ${brand.visual.primaryColor}`);
  parts.push(`AVOID: ${style.negativeConstraints.slice(0, 6).join(", ")}`);

  return parts.join(". ");
}

export function generateSlidesFromStyle(input: DirectorInput): Slide[] {
  const { style, request, brand, control } = input;
  const brief = buildCreativeBrief(input);
  const slideCount = brief.slideNarrative.length;
  const topic = request.rawIdea || "untitled";

  return brief.slideNarrative.map((narrative, i) => {
    const role = roleForIndex(i, slideCount, style);
    const needsImage = style.generationRequirements.needsImage || role === "hook";
    const imgPrompt = needsImage ? slideImagePrompt(style, brand, role, topic, control) : null;

    return {
      slide_number: i + 1,
      role,
      type: needsImage ? "generated_image" : "text_only",
      text: narrative,
      image_prompt: imgPrompt,
      visual_goal: `${style.name} — ${role}`,
      layout: role === "hook" ? "hook_cover" : role === "cta" ? "cta_banner" : "image_focus",
      asset_path: null,
    } satisfies Slide;
  });
}

// ── Preview Plan (approval step before render) ────────────────────────────────

export interface PreviewPlan {
  selectedPreset: string;
  selectionReason: string;
  slideDirections: Array<{ slideNumber: number; role: string; direction: string; imageDirection: string }>;
  copyDensity: TextDensity;
  typographyMood: string;
  renderRecommendation: string;
}

export function buildPreviewPlan(input: DirectorInput): PreviewPlan {
  const brief = buildCreativeBrief(input);
  const slides = generateSlidesFromStyle(input);

  return {
    selectedPreset: input.style.name,
    selectionReason: `Matched "${input.style.intent}" to topic "${brief.topic}"`,
    slideDirections: slides.map((s) => ({
      slideNumber: s.slide_number,
      role: s.role,
      direction: s.text,
      imageDirection: s.image_prompt ?? "text-only slide",
    })),
    copyDensity: brief.copyDensity,
    typographyMood: brief.typographyMood,
    renderRecommendation: brief.renderRecommendation,
  };
}
