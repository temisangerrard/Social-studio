import type {
  BrandProfile,
  CreativeBriefInterpretation,
  CreativeDirection,
  CreativeFormat,
  CreativeProjectMemory,
  CreativeReviewFlag,
  CreativeSystemOutput,
  ImageStrategy,
  Platform,
  StoryboardSlide
} from "./types.ts";

export const GENERIC_PHRASES = [
  "discover",
  "unlock",
  "game changer",
  "revolutionize",
  "perfect for",
  "seamless",
  "hidden meals"
] as const;

interface CreativeInput {
  brand: BrandProfile;
  rawIntent: string;
  platform?: Platform;
  selectedDirectionId?: string;
}

function cleanJsonString(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function compact(value: string): string {
  let result = value;
  for (const phrase of GENERIC_PHRASES) {
    result = result.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "");
  }
  return result.replace(/\s+/g, " ").trim();
}

function has(raw: string, terms: string[]): boolean {
  const text = raw.toLowerCase();
  return terms.some((term) => text.includes(term));
}

function platformForIntent(brand: BrandProfile, rawIntent: string, explicit?: Platform): Platform {
  if (explicit) return explicit;
  if (has(rawIntent, ["linkedin", "thought leadership", "serious", "founder"])) return "linkedin";
  return brand.defaults.platformTargets[0] ?? "tiktok";
}

function formatForIntent(rawIntent: string, platform: Platform): CreativeFormat {
  if (has(rawIntent, ["ugc", "creator", "talking", "review"])) return has(rawIntent, ["founder"]) ? "creator-talking-video" : "ugc-short-video";
  if (has(rawIntent, ["trailer", "hype", "promo", "launch"])) return "promo-trailer";
  if (has(rawIntent, ["meme", "funny", "chaotic"])) return "meme-post";
  if (has(rawIntent, ["thought leadership", "serious", "founder", "insight"])) return "founder-thought-leadership";
  if (has(rawIntent, ["carousel", "slides", "education", "explainer"])) return "educational-carousel";
  if (has(rawIntent, ["image", "poster", "photo"])) return "image-led-post";
  return platform === "linkedin" ? "founder-thought-leadership" : "educational-carousel";
}

function toneForIntent(brand: BrandProfile, rawIntent: string): string {
  const tones = [brand.tone, brand.platformPersonality].filter(Boolean).join(", ");
  if (has(rawIntent, ["chaotic", "native", "funny", "meme"])) return `chaotic, social-native, ${tones}`;
  if (has(rawIntent, ["premium", "serious", "thought leadership"])) return `premium, authoritative, specific, ${tones}`;
  if (has(rawIntent, ["hype", "trailer", "bold"])) return `high-energy, sharp, ${tones}`;
  return tones || "specific, social-native, practical";
}

export function interpretCreativeIntent(input: CreativeInput): CreativeBriefInterpretation {
  const { brand, rawIntent } = input;
  const cleanIntent = compact(rawIntent);
  const platform = platformForIntent(brand, cleanIntent, input.platform);
  const format = formatForIntent(cleanIntent, platform);
  const inferredContext = [
    brand.category || brand.description,
    brand.valueProposition || brand.description,
    ...(brand.contentPillars ?? []).slice(0, 3)
  ].filter(Boolean);

  return {
    product: brand.name,
    goal: has(cleanIntent, ["install", "download", "signup", "connect wallet", "invest"]) ? brand.defaults.goal : brand.defaults.goal || "awareness",
    audience: brand.audience,
    format,
    tone: toneForIntent(brand, cleanIntent),
    platform,
    confidence: cleanIntent.length > 12 ? 0.82 : 0.64,
    inferredContext
  };
}

// ── Dynamic direction builder — reads brand profile, no hardcoded brand IDs ───

function buildDynamicDirections(
  brand: BrandProfile,
  rawIntent: string,
  _format: CreativeFormat
): Array<Omit<CreativeDirection, "id" | "format" | "recommended_platform_fit" | "performance_score" | "brand_fit_score">> {
  const product = brand.name;
  const audience = brand.audience || "your audience";
  const description = brand.valueProposition || brand.description || product;
  const pillars = brand.contentPillars ?? [];
  const themes = brand.preferredThemes ?? [];
  const contextTheme = pillars[0] || themes[0] || rawIntent;
  const toneBase = brand.tone || "authentic, direct";
  const visualBase = brand.mascot ? `${brand.mascot.visualPrompt?.split(".")[0] || product} in scene` : "real product moment";

  return [
    {
      title: "The Specific Moment",
      angle: `Show ${product} through a concrete, specific moment that ${audience} will immediately recognise — not a product pitch, a real human situation that ${description}.`,
      why_it_works: "Specificity creates credibility. A real moment beats a product claim every time. Viewers see themselves.",
      emotional_driver: "recognition and relief",
      visual_style: `${toneBase} texture, close-up real-world detail, ${visualBase}, no corporate polish`,
      hook_style: "specific situation",
      hook_examples: [
        `The moment ${product} actually clicks for you.`,
        `This is what ${audience} do when ${rawIntent.slice(0, 50)}.`
      ]
    },
    {
      title: "Tension to Transformation",
      angle: `Open on the friction ${audience} feel before ${product} — then let the product do the work visually. No explanation, just the before and after.`,
      why_it_works: "Demonstrated transformation beats described features. The before/after arc is universally relatable across any category.",
      emotional_driver: "relief and earned control",
      visual_style: `before/after sequence, ${product} in action, payoff frame with brand color ${brand.visual?.primaryColor || ""}`,
      hook_style: "problem-first contrast",
      hook_examples: [
        `This used to take so much longer.`,
        `I didn't know ${product} could do this until I tried.`
      ]
    },
    {
      title: `The ${product} Angle on ${contextTheme || description}`,
      angle: `Give ${audience} a sharp, specific insight about ${contextTheme || description} that only someone who built ${product} would know — then let the product be the natural answer.`,
      why_it_works: "Insider knowledge signals authority without pitching. It earns trust, saves, and shares because it teaches something real.",
      emotional_driver: "authority, curiosity, and earned trust",
      visual_style: `clean editorial, ${toneBase}, proof or data moment, brand-consistent typography`,
      hook_style: "contrarian or insider insight",
      hook_examples: [
        `Here is what most ${audience} get wrong about ${contextTheme || description}.`,
        `The thing ${product} users know that everyone else is still guessing at.`
      ]
    }
  ];
}

// ── Dynamic storyboard builder — per-slide copy + image strategy ───────────────

function buildDynamicStoryboard(
  brand: BrandProfile,
  direction: Pick<CreativeDirection, "angle" | "visual_style" | "emotional_driver" | "hook_examples" | "hook_style">,
  interpretation: CreativeBriefInterpretation
): StoryboardSlide[] {
  const product = brand.name;
  const audience = brand.audience || "the viewer";
  const hook = direction.hook_examples[0] || `The ${product} moment you didn't expect.`;
  const visual = direction.visual_style;
  const isVideo = interpretation.format.includes("video") || interpretation.format === "promo-trailer";
  const primaryColor = brand.visual?.primaryColor ?? "";
  const secondaryColor = brand.visual?.secondaryColor ?? "";
  const tone = brand.tone || "authentic";

  if (isVideo) {
    return [
      {
        slide_number: 1,
        role: "hook",
        copy: hook,
        image_strategy: "ai_generated" as ImageStrategy,
        image_prompt: `${visual}, first-frame pattern interrupt, strong visual contrast, hook text overlay zone at bottom third, no generic ad polish, vertical 9:16 format, ${primaryColor}`,
        visual_notes: "Must stop scroll in under 1 second. Bold, unexpected first frame. No logo, no intro — just the hook.",
        layout: "hook_cover"
      },
      {
        slide_number: 2,
        role: "problem",
        copy: `Before ${product} — ${direction.angle.split("—")[0] || direction.angle.slice(0, 80)}`,
        image_strategy: "ai_generated" as ImageStrategy,
        image_prompt: `${visual}, tension and friction, ${audience} relatable situation before the solution, authentic imperfect texture, vertical 9:16`,
        visual_notes: "Show the before-state. Make the viewer see themselves in this moment.",
        layout: "image_text_split"
      },
      {
        slide_number: 3,
        role: "reveal",
        copy: `Then ${product} changes it.`,
        image_strategy: "ai_generated" as ImageStrategy,
        image_prompt: `${product} product or app interface hero shot, clean, approachable, not corporate, ${primaryColor} accent, vertical 9:16`,
        visual_notes: "Product earns its reveal here. Keep it clean and real — not a promo shot.",
        layout: "image_focus"
      },
      {
        slide_number: 4,
        role: "payoff",
        copy: `The result: ${direction.emotional_driver}.`,
        image_strategy: "ai_generated" as ImageStrategy,
        image_prompt: `Transformation payoff visual, ${tone} feeling, ${visual}, visible positive outcome, optimistic lighting, vertical 9:16`,
        visual_notes: "Demonstrated outcome — the after-state. Show it, don't narrate it.",
        layout: "image_text_split"
      },
      {
        slide_number: 5,
        role: "cta",
        copy: brand.cta || `Try ${product}`,
        image_strategy: "reusable_template" as ImageStrategy,
        visual_notes: `Brand CTA template. Primary: ${primaryColor}, Secondary: ${secondaryColor}. Single clear action, no hard sell.`,
        layout: "cta_banner"
      }
    ];
  }

  // Carousel
  return [
    {
      slide_number: 1,
      role: "hook",
      copy: hook,
      image_strategy: "no_image_text_only" as ImageStrategy,
      visual_notes: `Bold text on high-contrast background. ${primaryColor} or deep neutral. Make slide 1 earn the swipe — no image needed, the words carry it.`,
      layout: "hook_cover"
    },
    {
      slide_number: 2,
      role: "problem",
      copy: direction.angle.split(".")[0] || direction.angle.slice(0, 100),
      image_strategy: "ai_generated" as ImageStrategy,
      image_prompt: `${visual}, tension or friction moment for ${audience}, emotionally resonant scene, ${tone} texture, editorial composition, no stock photo look`,
      visual_notes: "Image carries the tension. Copy is one sharp line — don't explain, make them feel it.",
      layout: "image_text_split"
    },
    {
      slide_number: 3,
      role: "reveal",
      copy: `${product} changes this.`,
      image_strategy: "ai_generated" as ImageStrategy,
      image_prompt: `${product} product moment, ${visual}, clean proof visual, brand-authentic not corporate, ${secondaryColor} accent tone, editorial composition`,
      visual_notes: "The product earns its place here. Show it doing real work, not being advertised.",
      layout: "image_focus"
    },
    {
      slide_number: 4,
      role: "payoff",
      copy: `The result: ${direction.emotional_driver}.`,
      image_strategy: "ai_generated" as ImageStrategy,
      image_prompt: `Visible transformation outcome, ${tone} tone, ${visual}, positive payoff, warm optimistic lighting, ${primaryColor} accent`,
      visual_notes: "Viewer sees the after-state clearly. Demonstrated outcome only — no describing what they're seeing.",
      layout: "image_text_split"
    },
    {
      slide_number: 5,
      role: "insight",
      copy: `What most ${audience} miss: ${direction.angle.split(",")[0] || "the thing that changes everything"}.`,
      image_strategy: "no_image_text_only" as ImageStrategy,
      visual_notes: "Text-only clarity slide. One sharp statement. High save and share rate on this slide type.",
      layout: "statement"
    },
    {
      slide_number: 6,
      role: "cta",
      copy: brand.cta || `Try ${product}`,
      image_strategy: "reusable_template" as ImageStrategy,
      visual_notes: `Branded CTA template. ${primaryColor}. Low friction ask — tell them exactly what to do next.`,
      layout: "cta_banner"
    }
  ];
}

function selectedDirection(directions: CreativeDirection[], id?: string): CreativeDirection {
  return directions.find((direction) => direction.id === id) ?? directions[0];
}

function blueprintFor(direction: CreativeDirection, interpretation: CreativeBriefInterpretation) {
  const isVideo = direction.format.includes("video") || direction.format === "promo-trailer";
  const isThought = direction.format === "founder-thought-leadership";
  return {
    narrative_arc: isThought
      ? ["name the market tension", "explain the shift", "show the implication", "make the product the natural next step"]
      : ["start with tension", "make it visual", "show the product doing work", "land the transformation", "close with a native CTA"],
    beat_sheet: isVideo
      ? ["0-1s pattern interrupt", "1-3s context and tension", "3-6s product moment", "6-9s visible payoff", "final CTA beat"]
      : ["cover hook", "problem frame", "insight or mechanism", "proof moment", "CTA or save-worthy takeaway"],
    creative_notes: [
      "specific > generic",
      "demonstrated outcome > described feature",
      "first frame must create a question",
      `emotional driver: ${direction.emotional_driver}`
    ],
    editing_style: isVideo ? "fast native cuts, imperfect human texture, no corporate polish" : "clean sequence, one idea per slide, strong cover contrast",
    cta_style: interpretation.goal === "installs" ? "soft direct-response, show why to act now" : "trust-led next step, no hard sell",
    pacing_guidance: isVideo ? "open fast, breathe on proof, cut before the thought feels finished" : "one thought per frame; make slide 2 earn the swipe",
    on_screen_text_strategy: "short, spoken-language overlays that add tension rather than repeating the script"
  };
}

function assetsFor(brand: BrandProfile, direction: CreativeDirection, interpretation: CreativeBriefInterpretation) {
  const product = brand.name;
  const hooks = direction.hook_examples;
  const isCarousel = direction.format.includes("carousel") || direction.format.includes("thought") || direction.format === "insight-card";
  const script = [
    hooks[0],
    direction.angle,
    `Then ${product} creates the proof moment: ${direction.why_it_works}`,
    brand.cta
  ].map(compact).filter(Boolean);

  return {
    script,
    on_screen_text: [hooks[0], direction.emotional_driver, brand.cta].map(compact),
    shot_list: [
      `Opening frame: ${direction.hook_style} with a clear pattern interrupt`,
      `Context frame: show the user situation for ${interpretation.audience}`,
      `Product frame: ${product} doing the actual work`,
      `Payoff frame: visible before/after or conclusion`,
      `CTA frame: ${brand.cta}, native and low-friction`
    ],
    image_prompts: [
      `${direction.visual_style}, ${product}, ${interpretation.tone}, first-frame hook, no generic ad polish`,
      `specific proof visual for ${direction.angle}, brand colors ${brand.visual.primaryColor} and ${brand.visual.secondaryColor}`,
      `final payoff visual, ${direction.emotional_driver}, platform-native composition`
    ].map(compact),
    slide_plan: isCarousel
      ? ["Hook cover", "The tension", "The shift", "The proof", "The takeaway", "CTA"].map((item) => `${item}: ${direction.angle}`)
      : [],
    caption_options: [
      `${hooks[0]} ${direction.why_it_works} ${brand.cta}.`,
      `${direction.title}: ${direction.angle} ${brand.cta}.`
    ].map(compact),
    headline_options: hooks.map(compact),
    render_prompts: [
      `Render as ${direction.format} for ${interpretation.platform}; keep visual style: ${direction.visual_style}`,
      `Avoid corporate templates; preserve ${brand.name} brand tone: ${brand.tone}`
    ],
    voiceover_version: script,
    thumbnail_or_cover_text: [hooks[0], direction.title].map(compact)
  };
}

function variantsFor(): CreativeSystemOutput["variants"] {
  return [
    { label: "safer / cleaner", difference: "More polished and brand-safe.", script_adjustments: ["reduce slang", "make proof clearer"], visual_adjustments: ["cleaner framing", "less chaotic cuts"] },
    { label: "bolder / more viral", difference: "Stronger first-frame tension and faster payoff.", script_adjustments: ["sharpen the confession", "increase contrast"], visual_adjustments: ["more motion", "harder first-frame pattern interrupt"] },
    { label: "funnier", difference: "More self-aware and native.", script_adjustments: ["add human aside", "make the problem more relatable"], visual_adjustments: ["reaction shot", "messier real-world texture"] },
    { label: "premium", difference: "More restrained and elevated.", script_adjustments: ["less slang", "more confidence"], visual_adjustments: ["more whitespace", "slower camera"] },
    { label: "more direct-response", difference: "Clearer action and product benefit.", script_adjustments: ["stronger CTA", "show outcome earlier"], visual_adjustments: ["product UI closer", "CTA end frame"] }
  ];
}

function reviewFlags(rawIntent: string, outputText: string): CreativeReviewFlag[] {
  const flags = new Set<CreativeReviewFlag>();
  if (GENERIC_PHRASES.some((phrase) => rawIntent.toLowerCase().includes(phrase))) flags.add("too_generic");
  if (/corporate|professional marketing|brand voice/i.test(rawIntent)) flags.add("too_brandlike");
  if (outputText.length < 600) flags.add("too_safe");
  return Array.from(flags);
}

export function buildCreativeSystemOutput(input: CreativeInput): CreativeSystemOutput {
  const interpretation = interpretCreativeIntent(input);
  const seeds = buildDynamicDirections(input.brand, compact(input.rawIntent), interpretation.format);

  const directions: CreativeDirection[] = seeds.slice(0, 5).map((seed, index) => ({
    ...seed,
    id: `${slug(seed.title)}-${index + 1}`,
    format: interpretation.format,
    recommended_platform_fit: interpretation.platform === "linkedin" ? ["linkedin"] : ["tiktok", "instagram"],
    performance_score: 92 - index * 6,
    brand_fit_score: 88 - index * 4
  }));

  const recommended = selectedDirection(directions, input.selectedDirectionId);
  const storyboard = buildDynamicStoryboard(input.brand, recommended, interpretation);
  const content_blueprint = blueprintFor(recommended, interpretation);
  const production_assets = assetsFor(input.brand, recommended, interpretation);
  const caption = compact([recommended.hook_examples[0], recommended.angle, input.brand.cta].filter(Boolean).join(" "));
  const hashtags = input.brand.defaults.hashtags ?? [];

  const output: CreativeSystemOutput = {
    brief_interpretation: interpretation,
    proposed_directions: directions,
    recommended_direction_id: recommended.id,
    content_blueprint,
    production_assets,
    storyboard,
    caption,
    hashtags,
    variants: variantsFor(),
    review_flags: []
  };
  output.review_flags = reviewFlags(input.rawIntent, JSON.stringify(output));
  return output;
}

export function buildCreativeSystemPrompt(input: CreativeInput, fallback: CreativeSystemOutput): string {
  const brand = input.brand;
  return [
    "You are the Creative Director of a social content studio. Your job is to turn a raw idea and a brand profile into a production-ready creative brief with a slide-by-slide storyboard.",
    "You think like a platform-native content strategist — not a copywriter, not an ad agency.",
    "",
    "Brand profile (read this carefully — every output must be grounded in this, no generic content):",
    JSON.stringify({
      name: brand.name,
      description: brand.description,
      category: brand.category,
      valueProposition: brand.valueProposition,
      audience: brand.audience,
      tone: brand.tone,
      toneRange: brand.toneRange,
      platformPersonality: brand.platformPersonality,
      contentPillars: brand.contentPillars,
      preferredThemes: brand.preferredThemes,
      visual: brand.visual,
      mascot: brand.mascot ? { name: brand.mascot.name, role: brand.mascot.role, usageRules: brand.mascot.usageRules } : null,
      cta: brand.cta,
      defaultHashtags: brand.defaults.hashtags,
      bannedPhrases: [...GENERIC_PHRASES, ...(brand.bannedPhrases ?? [])],
      goodContentExamples: brand.goodContentExamples,
      badContentExamples: brand.badContentExamples
    }, null, 2),
    "",
    `Raw idea from user: "${input.rawIntent}"`,
    `Platform: ${input.platform ?? "infer from brand defaults"}`,
    "",
    "Your deliverables:",
    "1. Interpret the intent — infer format, tone, platform, and audience fit from the brand profile.",
    "2. Generate 3 distinct creative directions with real angles, not generic directions.",
    "   Each direction must feel like it was written for THIS brand and THIS audience specifically.",
    "   Directions must have concrete hook examples — opening lines that would stop the scroll.",
    "3. Build a slide-by-slide storyboard for the recommended direction:",
    "   - 5-7 slides for video/UGC formats, 6-8 slides for carousels",
    "   - Each slide needs: role, copy (actual slide text — not a description of it), image_strategy, image_prompt (if needed), visual_notes",
    "   - image_strategy must be one of: ai_generated | asset_library | reusable_template | no_image_text_only",
    "   - Hook slides: usually ai_generated or no_image_text_only",
    "   - Middle/payoff slides: ai_generated with specific, cinematically-described prompts",
    "   - CTA slide: reusable_template",
    "   - image_prompt must be a rich, specific FAL.ai-ready prompt — not a description, an actual generation prompt",
    "4. Write a ready-to-post caption and hashtag list.",
    "5. Flag anything that could make this content generic, ad-like, or weak.",
    "",
    "Quality rules:",
    "- copy on each slide must be the actual text that would appear — not 'headline here' or 'describe product'",
    "- image_prompt must be specific enough to generate the right visual without further editing",
    "- the hook (slide 1 copy) must be something a real person would say — not marketing language",
    "- every direction and storyboard slide must be grounded in the brand profile above",
    "",
    "Return JSON only — match this exact schema (same top-level keys, same structure):",
    JSON.stringify(fallback, null, 2)
  ].join("\n");
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((i) => typeof i === "string");
}

function isStoryboardSlide(v: unknown): v is StoryboardSlide {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.slide_number === "number" &&
    typeof s.role === "string" &&
    typeof s.copy === "string" &&
    typeof s.image_strategy === "string" &&
    typeof s.visual_notes === "string" &&
    typeof s.layout === "string"
  );
}

function isCreativeSystemOutput(value: unknown): value is CreativeSystemOutput {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (
    !o.brief_interpretation ||
    !Array.isArray(o.proposed_directions) ||
    typeof o.recommended_direction_id !== "string" ||
    !Array.isArray(o.variants) ||
    !Array.isArray(o.review_flags)
  ) return false;

  const bp = o.content_blueprint as Record<string, unknown> | undefined;
  if (!bp || typeof bp !== "object") return false;
  if (!isStringArray(bp.narrative_arc) || !isStringArray(bp.beat_sheet) || !isStringArray(bp.creative_notes)) return false;
  if (typeof bp.editing_style !== "string" || typeof bp.cta_style !== "string" || typeof bp.pacing_guidance !== "string" || typeof bp.on_screen_text_strategy !== "string") return false;

  const pa = o.production_assets as Record<string, unknown> | undefined;
  if (!pa || typeof pa !== "object") return false;
  for (const key of ["script", "on_screen_text", "shot_list", "image_prompts", "slide_plan", "caption_options", "headline_options", "render_prompts", "voiceover_version", "thumbnail_or_cover_text"] as const) {
    if (!isStringArray(pa[key])) return false;
  }

  if (!Array.isArray(o.storyboard) || !o.storyboard.every(isStoryboardSlide)) return false;

  return true;
}

function scrubGenericPhrases(output: CreativeSystemOutput): CreativeSystemOutput {
  const copy = JSON.parse(JSON.stringify(output)) as CreativeSystemOutput;
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") return compact(value);
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      for (const [key, nested] of Object.entries(value)) {
        (value as Record<string, unknown>)[key] = walk(nested);
      }
    }
    return value;
  };
  return walk(copy) as CreativeSystemOutput;
}

export async function generateCreativeSystemOutput(input: CreativeInput): Promise<CreativeSystemOutput> {
  const fallback = buildCreativeSystemOutput(input);
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) return fallback;

  const apiUrl = process.env.GLM_API_URL ?? "https://open.bigmodel.cn/api/paas/v4/chat/completions";
  const model = process.env.GLM_MODEL ?? input.brand.providers.plannerModel ?? "glm-4.5";
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.85,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a creative director. Return production-ready structured JSON for a social content creative system. Every output must be brand-specific, platform-native, and storyboard-ready."
          },
          {
            role: "user",
            content: buildCreativeSystemPrompt(input, fallback)
          }
        ]
      })
    });
    if (!response.ok) throw new Error(`Creative system request failed (${response.status})`);
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Creative system response did not include message content");
    const parsed = JSON.parse(cleanJsonString(content)) as unknown;
    if (!isCreativeSystemOutput(parsed)) throw new Error("Creative system response did not match schema");
    const scrubbed = scrubGenericPhrases(parsed);
    scrubbed.review_flags = Array.from(new Set([...scrubbed.review_flags, ...reviewFlags(input.rawIntent, JSON.stringify(scrubbed))]));
    // Ensure caption and hashtags are populated even if AI omits them
    if (!scrubbed.caption) scrubbed.caption = fallback.caption;
    if (!scrubbed.hashtags?.length) scrubbed.hashtags = fallback.hashtags;
    return scrubbed;
  } catch (error) {
    console.warn(`[creative-system] Falling back to local creative engine: ${(error as Error).message}`);
    return fallback;
  }
}

export function refineCreativeProject(memory: CreativeProjectMemory, feedback: string): CreativeProjectMemory {
  const plan: CreativeSystemOutput = JSON.parse(JSON.stringify(memory.creativePlan));
  const note = compact(feedback);
  plan.refinementNotes = [...(plan.refinementNotes ?? []), note];
  plan.review_flags = Array.from(new Set([...plan.review_flags, "refined"]));

  if (/less ad|native|funny|funnier|chaotic|premium|founder/i.test(feedback)) {
    plan.content_blueprint.editing_style = compact(`${plan.content_blueprint.editing_style}; refined to feel ${note}`);
    plan.storyboard = plan.storyboard.map((slide) => ({
      ...slide,
      visual_notes: compact(`${slide.visual_notes}; tone adjustment: ${note}`)
    }));
  }
  if (/hook|opening|first/i.test(feedback)) {
    plan.production_assets.headline_options = plan.production_assets.headline_options.map((headline) => compact(`${headline} — sharper first frame`));
    if (plan.storyboard[0]) {
      plan.storyboard[0] = { ...plan.storyboard[0], visual_notes: compact(`${plan.storyboard[0].visual_notes}; sharpen hook based on: ${note}`) };
    }
  }
  if (/visual|image|premium|chaotic/i.test(feedback)) {
    plan.production_assets.image_prompts = plan.production_assets.image_prompts.map((prompt) => compact(`${prompt}; refinement: ${note}`));
    plan.storyboard = plan.storyboard.map((slide) => ({
      ...slide,
      image_prompt: slide.image_prompt ? compact(`${slide.image_prompt}; visual refinement: ${note}`) : slide.image_prompt
    }));
  }

  return {
    ...memory,
    creativePlan: plan,
    refinementNotes: [...memory.refinementNotes, note],
    updatedAt: new Date().toISOString()
  };
}
