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
  // UGC presets get a proper spoken script structure
  if (style.id.startsWith("ugc-faceless")) {
    return [
      `Hook: attention-grabbing opening line about ${topic} — stop the scroll`,
      `Problem: the frustration or pain point that ${topic} solves — make it relatable`,
      `Discovery: introduce the product/solution — "I found this thing that..."`,
      `Demo: show how it works — product in action, screen recording, or result`,
      `Benefit: the transformation or outcome — what changed after using it`,
      `CTA: tell them what to do — "link in bio" / "try it" / "comment if you want this"`,
    ];
  }
  if (style.id.startsWith("ugc-voiceover")) {
    return [
      `Scene 1: set the context — "so I've been using ${topic} for a week now..."`,
      `Scene 2: the honest experience — what it's actually like, first impressions`,
      `Scene 3: the moment it clicked — the specific thing that made it worth it`,
      `Scene 4: who it's for and who should skip it — authentic recommendation`,
      `Scene 5: final verdict and CTA — "honestly, if you [need], just try it"`,
    ];
  }

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
  control: StyleControlledRequest,
  slideIndex: number
): string | null {
  if (!style.generationRequirements.needsImage && slideRole !== "hook") return null;

  // UGC: scene-specific visual direction
  if (style.id.startsWith("ugc-faceless")) {
    const scenes: Record<number, string> = {
      0: `POV shot of someone scrolling their phone, notification or app screen visible, relatable everyday moment, vertical 9:16, ${topic}`,
      1: `Close-up of a frustrated person's hands or a messy/cluttered scene representing the problem ${topic} solves, authentic texture, vertical 9:16`,
      2: `Clean product shot or app interface of ${brand.name}, hero angle, soft natural lighting, minimal background, vertical 9:16`,
      3: `Screen recording style or hands-on demo of ${brand.name} in use, showing the key feature, vertical 9:16`,
      4: `Before/after or transformation result from using ${brand.name}, bright optimistic lighting, vertical 9:16`,
      5: `${brand.name} logo or product with a clear call-to-action overlay zone, clean composition, vertical 9:16`,
    };
    return `${scenes[slideIndex] ?? scenes[2]}. AVOID: ${style.negativeConstraints.slice(0, 4).join(", ")}`;
  }

  if (style.id.startsWith("ugc-voiceover")) {
    const scenes: Record<number, string> = {
      0: `Lifestyle POV shot, first-person perspective, cozy or everyday setting related to ${topic}, authentic imperfect lighting, vertical 9:16`,
      1: `Close-up detail shot of ${brand.name} product or interface, natural light, slightly shallow depth of field, vertical 9:16`,
      2: `Reaction moment or "aha" expression, warm tones, genuine feeling, ${brand.name} visible in background, vertical 9:16`,
      3: `Real-world context shot showing who uses ${brand.name}, lifestyle setting, diverse and authentic, vertical 9:16`,
      4: `Final hero shot of ${brand.name}, clean but not corporate, approachable and trustworthy, vertical 9:16`,
    };
    return `${scenes[slideIndex] ?? scenes[1]}. AVOID: ${style.negativeConstraints.slice(0, 4).join(", ")}`;
  }

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
    const imgPrompt = needsImage ? slideImagePrompt(style, brand, role, topic, control, i) : null;

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
