import type {
  BrandProfile,
  CreativeBriefInterpretation,
  CreativeDirection,
  CreativeFormat,
  CreativeProjectMemory,
  CreativeReviewFlag,
  CreativeSystemOutput,
  Platform
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
  if (has(rawIntent, ["meme", "funny", "chaotic"])) return "ugc-short-video";
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

function directionSeeds(brand: BrandProfile, rawIntent: string, format: CreativeFormat): Array<Omit<CreativeDirection, "id" | "format" | "recommended_platform_fit" | "performance_score" | "brand_fit_score">> {
  const product = brand.name;
  if (brand.id === "peppera" || /meal|pantry|food|cook/i.test(`${brand.description} ${rawIntent}`)) {
    return [
      {
        title: "Food But No Food",
        angle: "The painfully relatable moment where the fridge has ingredients, but your brain says there is nothing to eat.",
        why_it_works: "It starts with a recognisable tension, then pays it off with a demonstrated dinner transformation.",
        emotional_driver: "relief after mild kitchen chaos",
        visual_style: "handheld kitchen POV, real pantry clutter, warm food payoff",
        hook_style: "relatable confession",
        hook_examples: ["I have food, but somehow I have no food.", "This is what I make when my fridge looks unserious."]
      },
      {
        title: "Anti-Takeout Save",
        angle: `${product} interrupts the expensive default of ordering food by turning leftovers into a fast plan.`,
        why_it_works: "Money tension plus visible transformation gives the viewer a reason to keep watching.",
        emotional_driver: "control and small financial win",
        visual_style: "receipt contrast, pantry scan, plated meal reveal",
        hook_style: "cost contrast",
        hook_examples: ["I nearly ordered again, then checked what I already had.", "This saved my lazy dinner budget."]
      },
      {
        title: "Pantry Roulette",
        angle: "Treat random ingredients like a challenge and let the product turn the chaos into a dinner idea.",
        why_it_works: "A game-like premise creates curiosity and rewatchable reveal energy.",
        emotional_driver: "playful curiosity",
        visual_style: "quick cuts, ingredient closeups, timer energy, creator reaction",
        hook_style: "challenge setup",
        hook_examples: ["Three random ingredients. One actual dinner.", "Pantry roulette should not have worked this well."]
      }
    ];
  }

  if (brand.id === "settley" || /real estate|property|asset|invest/i.test(`${brand.description} ${rawIntent}`)) {
    return [
      {
        title: "The Property Access Gap",
        angle: "Explain why property ownership feels further away and how fractional real assets change the entry point.",
        why_it_works: "It connects a macro pain to a concrete category shift without sounding like a sales deck.",
        emotional_driver: "trust and earned access",
        visual_style: "minimal premium slides, architectural detail, restrained data moments",
        hook_style: "category insight",
        hook_examples: ["The old property ladder has a new entry point.", "Most people do not need a whole property to start thinking like an owner."]
      },
      {
        title: "Why Now for Real-World Assets",
        angle: "Frame tokenised property as a serious bridge between digital liquidity and tangible assets.",
        why_it_works: "It gives investors a timely thesis instead of a generic product explanation.",
        emotional_driver: "authority and timing",
        visual_style: "black-on-white editorial, clean charts, property textures",
        hook_style: "market timing",
        hook_examples: ["The next serious crypto story may not look like crypto.", "Real-world assets are where the grown-up capital is watching."]
      },
      {
        title: "Trust Before Yield",
        angle: "Lead with transparency, asset backing, and investor confidence before mentioning returns.",
        why_it_works: "It counters skepticism directly and matches the brand's premium trust position.",
        emotional_driver: "security",
        visual_style: "documentary property visuals, calm typography, proof-led sequencing",
        hook_style: "trust objection",
        hook_examples: ["Before yield, ask what backs it.", "The most important part of an investment platform is not the headline rate."]
      }
    ];
  }

  if (brand.id === "autobett" || /bet|crypto|onchain|agent|sports/i.test(`${brand.description} ${rawIntent}`)) {
    return [
      {
        title: "Agent Takes the Bet",
        angle: "Turn AI betting into a cinematic handoff from manual overthinking to autonomous execution.",
        why_it_works: "It makes an abstract onchain product feel like a trailer with a simple before/after.",
        emotional_driver: "hype and delegation",
        visual_style: "neon odds board, fast sports cuts, wallet UI flashes",
        hook_style: "trailer cold open",
        hook_examples: ["What if your betting wallet had an agent?", "You set the risk. The agent hunts the edge."]
      },
      {
        title: "DeFi Meets Sportsbook",
        angle: "Position the product as crypto-native market automation rather than another betting app.",
        why_it_works: "It speaks to degens in their language while keeping the mechanism clear.",
        emotional_driver: "status and novelty",
        visual_style: "dark UI, odds movement, smart-contract visual metaphors",
        hook_style: "category mashup",
        hook_examples: ["This is not a sportsbook. It is an onchain betting agent.", "Prediction markets just got an autopilot."]
      },
      {
        title: "Risk Dial Drama",
        angle: "Build tension around choosing risk parameters and watching the system execute.",
        why_it_works: "A visible control moment gives the trailer a clear action and payoff.",
        emotional_driver: "control under pressure",
        visual_style: "risk dial closeups, countdown cuts, win/loss dashboard",
        hook_style: "control tension",
        hook_examples: ["Set the risk. Let it run.", "The most dangerous button is the one you understand."]
      }
    ];
  }

  return [
    {
      title: "Specific Before Generic",
      angle: `${brand.name} shown through a concrete user moment rather than a broad product claim.`,
      why_it_works: "Specific context creates credibility and makes the output easier to film.",
      emotional_driver: "clarity",
      visual_style: "real use case, close-up detail, proof moment",
      hook_style: "specific situation",
      hook_examples: [`The moment ${brand.name} actually becomes useful.`, "This is the use case people remember."]
    },
    {
      title: "Problem to Proof",
      angle: "Open on friction, show the product doing the work, end on a visible outcome.",
      why_it_works: "Demonstrated outcome beats feature description.",
      emotional_driver: "relief",
      visual_style: "before/after sequence, product-in-action, clean payoff",
      hook_style: "problem-first",
      hook_examples: ["This used to take way too long.", "Here is the part nobody explains."]
    },
    {
      title: "Founder Explains the Shift",
      angle: "A founder-style insight that names the market change behind the product.",
      why_it_works: "Authority framing makes even simple products feel strategically important.",
      emotional_driver: "authority",
      visual_style: "talking head plus simple visual proof",
      hook_style: "contrarian insight",
      hook_examples: ["The category is changing in one specific way.", "Most teams are explaining this backwards."]
    }
  ];
}

export function generateCreativeDirections(input: CreativeInput, interpretation = interpretCreativeIntent(input)): CreativeDirection[] {
  return directionSeeds(input.brand, compact(input.rawIntent), interpretation.format)
    .slice(0, 5)
    .map((seed, index) => ({
      ...seed,
      id: `${slug(seed.title)}-${index + 1}`,
      format: index === 0 ? interpretation.format : seed.title.includes("Founder") ? "founder-thought-leadership" : interpretation.format,
      recommended_platform_fit: interpretation.platform === "linkedin" ? ["linkedin"] : ["tiktok", "instagram"],
      performance_score: 92 - index * 6,
      brand_fit_score: 88 - index * 4
    }));
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
  const directions = generateCreativeDirections(input, interpretation);
  const recommended = selectedDirection(directions, input.selectedDirectionId);
  const content_blueprint = blueprintFor(recommended, interpretation);
  const production_assets = assetsFor(input.brand, recommended, interpretation);
  const output: CreativeSystemOutput = {
    brief_interpretation: interpretation,
    proposed_directions: directions,
    recommended_direction_id: recommended.id,
    content_blueprint,
    production_assets,
    variants: variantsFor(),
    review_flags: []
  };
  output.review_flags = reviewFlags(input.rawIntent, JSON.stringify(output));
  return output;
}

export function buildCreativeSystemPrompt(input: CreativeInput, fallback: CreativeSystemOutput): string {
  const brand = input.brand;
  return [
    "You are the creative engine of a social content studio, not a form-filling copy generator.",
    "Operate as these internal roles: Brief Interpreter, Creative Strategist, Platform-Native Writer, Visual Director, Performance Editor, and Refinement Agent.",
    "Interpret sparse input, infer missing context from the product profile, propose multiple strong directions, build production-ready assets, and self-correct generic output before returning.",
    "",
    "Product profile:",
    JSON.stringify({
      name: brand.name,
      category: brand.category,
      description: brand.description,
      audience: brand.audience,
      valueProposition: brand.valueProposition,
      visualIdentity: brand.visual,
      platformPersonality: brand.platformPersonality,
      toneRange: brand.toneRange,
      contentPillars: brand.contentPillars,
      bannedPhrases: [...GENERIC_PHRASES, ...(brand.bannedPhrases ?? [])],
      preferredThemes: brand.preferredThemes,
      goodContentExamples: brand.goodContentExamples,
      badContentExamples: brand.badContentExamples,
      cta: brand.cta
    }, null, 2),
    "",
    `Sparse user intent: ${input.rawIntent}`,
    `Requested platform, if any: ${input.platform ?? "infer"}`,
    "",
    "Pipeline requirements:",
    "1. Intent Interpretation: infer product, audience, format, tone, objective, and platform fit.",
    "2. Creative Strategy Generation: return 3-5 ranked directions with performance and brand-fit scores.",
    "3. Content Blueprint: create narrative arc, beat sheet, pacing, visual moments, on-screen text strategy, CTA, and editing notes.",
    "4. Production Assets: produce script, shot list, image prompts, slide plan, captions, headlines, thumbnail text, voiceover, and render prompts.",
    "5. Review: flag weak/generic/ad-like/static issues and revise before returning.",
    "",
    "Performance heuristics to use: hook strength, curiosity gap, emotional contrast, relatability, authority, pattern interrupt, visual payoff, transformation, tension/release, social-native phrasing, rewatchability, cut cadence, scroll-stopping first frame, specificity, and demonstrated outcome.",
    "Do not use empty phrases like discover, unlock, game changer, revolutionize, perfect for, seamless, or hidden meals.",
    "Return JSON only matching this schema and keep the same top-level keys:",
    JSON.stringify(fallback, null, 2)
  ].join("\n");
}

function isCreativeSystemOutput(value: unknown): value is CreativeSystemOutput {
  if (!value || typeof value !== "object") return false;
  const output = value as Partial<CreativeSystemOutput>;
  return Boolean(
    output.brief_interpretation &&
    Array.isArray(output.proposed_directions) &&
    typeof output.recommended_direction_id === "string" &&
    output.content_blueprint &&
    output.production_assets &&
    Array.isArray(output.variants) &&
    Array.isArray(output.review_flags)
  );
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
            content: "You return production-ready structured JSON for a multi-stage social content creative operating system."
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
  }
  if (/hook|opening|first/i.test(feedback)) {
    plan.production_assets.headline_options = plan.production_assets.headline_options.map((headline) => compact(`${headline} — sharper first frame`));
  }
  if (/visual|image|premium|chaotic/i.test(feedback)) {
    plan.production_assets.image_prompts = plan.production_assets.image_prompts.map((prompt) => compact(`${prompt}; refinement: ${note}`));
  }

  return {
    ...memory,
    creativePlan: plan,
    refinementNotes: [...memory.refinementNotes, note],
    updatedAt: new Date().toISOString()
  };
}
