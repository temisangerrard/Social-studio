export type Platform = "tiktok" | "instagram" | "linkedin";
export type DeliveryTarget = "tiktok" | "instagram" | "linkedin" | "both" | "all";
export type PostFormat = "slideshow" | "carousel" | "text-only";
export type WorkflowType = "slideshow" | "mascot-variants" | "reference-edit" | "video-clip" | "reel-package" | "linkedin-carousel" | "linkedin-text" | "ugc-faceless" | "ugc-voiceover";
export type VisualMode = "mascot-led" | "food-led" | "mixed";
export type ConsistencyMode = "prompt-led" | "mascot-consistent";

// ── Video Strategy System ─────────────────────────────────────────────────────

export type VideoStrategy =
  | "storyboard-to-video"   // GPT Image 2 storyboard grid → Seedance 2.0 image-to-video
  | "seedance-multishot"    // Seedance 2.0 text-to-video with Shot 1/2/3 labels + native audio
  | "seedance-reference"    // Seedance 2.0 reference-to-video with brand assets
  | "kling-text"            // Kling 3.0 text-to-video (single shot)
  | "image-to-video";       // Animate an existing image via Seedance 2.0 or Kling i2v

export interface VideoStrategyConfig {
  strategy: VideoStrategy;
  duration: number;           // seconds (4-15 for Seedance, 5/10 for Kling)
  aspectRatio: "9:16" | "16:9" | "1:1";
  resolution?: "480p" | "720p";
  generateAudio: boolean;
  /** For storyboard-to-video: number of panels in the grid (default 9 = 3×3) */
  storyboardPanels?: number;
  /** For image-to-video: source image URL or path */
  sourceImageUrl?: string;
  /** For seedance-reference: reference image URLs (up to 9) */
  referenceImageUrls?: string[];
  /** For seedance-reference: reference audio URL */
  referenceAudioUrl?: string;
  /** Override the storyboard image generation prompt (GPT Image 2) */
  storyboardPrompt?: string;
  /** Override the video generation prompt (Seedance / Kling) */
  videoPrompt?: string;
}
export type AssetType = "food_photo" | "product_photo" | "person_photo" | "screenshot" | "logo" | "document" | "unknown";
export type ContentRouteFamily = "carousel" | "edited-image" | "recipe" | "flyer" | "linkedin-post" | "infographic";
export type ContentHint = ContentRouteFamily;
export type SlideRole =
  | "hook"
  | "problem"
  | "escalation"
  | "reaction"
  | "discovery"
  | "meal_reveal"
  | "benefit"
  | "cta"
  | "recipe";

export type SlideType = "text_only" | "generated_image";
export type SlideLayout =
  | "hook"
  | "statement"
  | "image_text_split"
  | "image_focus"
  | "cta"
  | "hook_cover"
  | "problem_setup"
  | "recipe_card"
  | "cta_banner"
  // Pantry-to-Plate pack layouts
  | "ingredient_card"   // Grid of ingredient images with labels
  | "reveal_split"      // Before (ingredients) → After (dish) split
  | "recipe_trio";      // Three recipe options in a tiled layout

// ── Content Type System ───────────────────────────────────────────────────────

export interface SlideBlueprintEntry {
  role: string;
  type: SlideType;
  textFields: string[];
  imagePromptTemplate: string | null;
  layout: string;
}

export interface ContentTypeDefinition {
  id: string;
  name: string;
  slideBlueprint: SlideBlueprintEntry[];
  imageStyle: string;
  platformTargets: Platform[];
}

export interface ContentRecipeDefinition {
  id: string;
  name: string;
  routeFamily: ContentRouteFamily;
  workflowType: WorkflowType;
  platformTargets: Platform[];
  defaultPriority: number;
  preferredAssetTypes?: AssetType[];
  requiredAssetTypes?: AssetType[];
  contentTypeId?: string;
  copyStyleHint?: string;
  visualStyleHint?: string;
}

export type BoardCardType =
  | "idea"
  | "hook"
  | "audience"
  | "problem"
  | "cta"
  | "proof"
  | "visual"
  | "note"
  | "goal"
  | "asset";

export interface ContentBrief {
  product: string;
  platform: Platform;
  format: PostFormat;
  pillar: string;
  audience: string;
  tone: string;
  ingredients?: string[];
  goal: string;
  idea: string;
}

export interface BrandVisualSettings {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  surfaceColor: string;
  textColor?: string;
  textSecondary?: string;
  fontFamily?: string;
}

export interface BrandDefaults {
  platformTargets: Platform[];
  goal: string;
  hashtags: string[];
}

export interface BrandProviders {
  plannerModel: string;
  imageModel: string;
}

export interface BrandMascot {
  name: string;
  description: string;
  role: string;
  visualPrompt: string;
  usageRules: string[];
  referenceImages: string[];
}

export interface BrandProfile {
  id: string;
  name: string;
  description: string;
  tone: string;
  audience: string;
  cta: string;
  logoPath: string | null;
  visual: BrandVisualSettings;
  defaults: BrandDefaults;
  providers: BrandProviders;
  category?: string;
  valueProposition?: string;
  platformPersonality?: string;
  toneRange?: string[];
  contentPillars?: string[];
  bannedPhrases?: string[];
  preferredThemes?: string[];
  goodContentExamples?: string[];
  badContentExamples?: string[];
  mascot?: BrandMascot;
  contentTypes?: ContentTypeDefinition[];
  defaultContentType?: string;
  contentRecipes?: ContentRecipeDefinition[];
  defaultStyleCardId?: string;
  visualModes?: VisualMode[];
}

export interface BoardCard {
  id: string;
  type: BoardCardType;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tags: string[];
  assetUrl?: string;
}

export interface BoardReference {
  id: string;
  label: string;
  type: "text" | "image" | "url";
  value: string;
}

export interface ReferenceAsset {
  id: string;
  label: string;
  url: string;
  source: "brand" | "run" | "asset";
  kind: "image";
}

export interface UserAssetAnnotation {
  label?: string;
  notes?: string;
}

export interface UploadedAsset extends UserAssetAnnotation {
  id: string;
  url: string;
  mimeType: string;
  filename: string;
}

export interface AssetAnalysis {
  assetId: string;
  assetType: AssetType;
  subjectSummary: string;
  contentHints: ContentHint[];
  channelHints: Platform[];
  confidence: number;
  needsUserConfirmation: boolean;
  source: "glm" | "fallback";
}

export interface GenerationIntent {
  platform: Platform;
  prompt: string;
  assetTypes: AssetType[];
  contentHints: ContentHint[];
  channelHints: Platform[];
  requiresConfirmation: boolean;
}

export interface RoutingCandidate {
  recipeId: string;
  routeFamily: ContentRouteFamily;
  workflowType: WorkflowType;
  score: number;
  status: "selected" | "rejected";
  reasons: string[];
}

export interface RoutingDecision {
  recipeId: string;
  routeFamily: ContentRouteFamily;
  workflowType: WorkflowType;
  platformTargets: Platform[];
  deliveryTargets: DeliveryTarget;
  contentTypeId?: string;
  selectedBy: "router" | "override";
  reasonSummary: string;
  requiresConfirmation: boolean;
  candidates: RoutingCandidate[];
}

export interface RoutingTrace {
  decision: RoutingDecision;
  intent: GenerationIntent;
  assetAnalyses: AssetAnalysis[];
  treeVersion: string;
  traceLines: string[];
}

export interface VideoOptions {
  duration: 5 | 10 | 15;
  aspectRatio: "9:16" | "16:9" | "1:1";
  withAudio: boolean;
  consistencyMode: ConsistencyMode;
}

export interface BoardDocument {
  id: string;
  brandProfileId: string;
  title: string;
  rawIdea: string;
  notes: string;
  cards: BoardCard[];
  references: BoardReference[];
  updatedAt: string;
}

export interface ProductContextSource {
  repo: string;
  localPath?: string;
}

export interface ProductContextDefinition {
  id: string;
  name: string;
  sources: ProductContextSource[];
}

export interface ResolvedProductContext {
  productId: string;
  productName: string;
  summary: string;
  source: "local" | "registry";
  repo: string;
}

export interface GenerationRequest {
  brandProfileId: string;
  boardId?: string;
  rawIdea: string;
  notes?: string;
  cards: BoardCard[];
  references: BoardReference[];
  platformTargets: Platform[];
  goal: string;
  visualMode?: VisualMode;
  workflowType?: WorkflowType;
  referenceAssets?: ReferenceAsset[];
  uploadedAssets?: UploadedAsset[];
  assetAnalyses?: AssetAnalysis[];
  routingOverride?: {
    recipeId?: string;
    workflowType?: WorkflowType;
    routeFamily?: ContentRouteFamily;
    contentTypeId?: string;
  };
  targetAssetId?: string;
  videoOptions?: VideoOptions;
  videoStrategy?: VideoStrategyConfig;
  variantCount?: number;
  deliveryTargets?: DeliveryTarget;
  contentTypeId?: string;
  routingDecision?: RoutingDecision;
  routingTrace?: RoutingTrace;
  creativeProjectId?: string;
  creativePlan?: CreativeSystemOutput;
  styleControl: StyleControlledRequest;
}

export interface StructuredRecipe {
  recipeName: string;
  ingredients: string[];
  cookTime: string;
  steps: string[];
  proTip?: string;
  cost?: string;
  serves?: string;
}

export interface Slide {
  slide_number: number;
  role: SlideRole;
  type: SlideType;
  text: string;
  image_prompt: string | null;
  visual_goal: string;
  layout: SlideLayout;
  asset_path?: string | null;
  uploaded_asset_url?: string | null;
  recipe?: StructuredRecipe;
}

export interface PlannedPackage {
  hooks: string[];
  caption: string;
  hashtags: string[];
  platformNotes: Partial<Record<Platform, string>>;
  slides: Slide[];
}

export interface GeneratedArtifact {
  id: string;
  kind: "image" | "video" | "document";
  role: string;
  title: string;
  prompt: string;
  asset_path?: string | null;
  preview_path?: string | null;
  slide_number?: number;
  source_asset_id?: string | null;
  variant_group?: string | null;
}

export interface ReelClipBrief {
  id: string;
  title: string;
  prompt: string;
  references: string[];
}

export interface ReelPackageDraft {
  clipBriefs: ReelClipBrief[];
  voiceoverScript: string;
  subtitleDraft: string;
}

export interface WorkflowRecipe {
  workflowType: WorkflowType;
  operation: "image-generate" | "image-edit" | "video-generate" | "reference-video-generate" | "planner-only";
  model: string;
}

export interface PostMetadata {
  post_id: string;
  product: string;
  platform: Platform;
  format: PostFormat;
  workflow_type?: WorkflowType;
  delivery_targets?: DeliveryTarget;
  content_type_id?: string;
  content_recipe_id?: string;
  caption: string;
  hooks: string[];
  hashtags: string[];
  platform_notes: Partial<Record<Platform, string>>;
  brief: ContentBrief;
  brand_profile: BrandProfile;
  generation_request: GenerationRequest;
  creative_project_id?: string;
  creative_plan?: CreativeSystemOutput;
  uploaded_assets?: UploadedAsset[];
  asset_analyses?: AssetAnalysis[];
  routing_decision?: RoutingDecision;
  routing_trace?: RoutingTrace;
  slides: Slide[];
  artifacts?: GeneratedArtifact[];
  reel_package?: ReelPackageDraft | null;
  voiceover?: {
    script: string;
    audioPath: string | null;
    voiceId: string;
    durationEstimate: number;
  } | null;
  output_dir: string;
  assets_dir: string;
  slides_dir: string;
  created_at: string;
  planner_provider: "glm" | "fallback";
  image_provider: "fal" | "mock" | "fal_with_fallback";
  render_status?: "complete" | "skipped";
  render_error?: string | null;
}

export interface PipelineOptions {
  briefPath: string;
  outputRoot?: string;
}

export interface ImageGenerationResult {
  slideNumber: number;
  assetPath: string | null;
  prompt: string;
  provider: "mock" | "fal";
}

export interface RenderResult {
  slideNumber: number;
  outputPath: string;
}

export interface FalImageConfig {
  apiKey?: string;
  model?: string;
}

// ── Content Calendar ──────────────────────────────────────────────────────────

export type CalendarSlotStatus = "idea" | "planned" | "generating" | "ready" | "published";

export interface CalendarSlot {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  brandProfileId: string;
  platform: Platform;
  pillar: string;
  idea: string;
  status: CalendarSlotStatus;
  outputPostId?: string;
  jobId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContentPillar {
  id: string;
  brandProfileId: string;
  name: string;
  description: string;
  frequency: "daily" | "2x-week" | "weekly" | "biweekly";
  platforms: Platform[];
  defaultTone?: string;
  exampleIdeas: string[];
}

export interface CalendarWeek {
  weekStart: string; // ISO date YYYY-MM-DD (Monday)
  slots: CalendarSlot[];
}

export interface BatchGenerationRequest {
  slotIds: string[];
  brandProfileId: string;
  visualMode?: VisualMode;
  deliveryTargets?: DeliveryTarget;
}

// ── Style-Controlled Creative Pipeline ────────────────────────────────────────

export type GenerationMode = "image-first" | "layout-first" | "reference-match" | "brand-adapted";
export type TextDensity = "low" | "medium" | "high";
export type ReferenceLockStrength = "loose" | "medium" | "tight";
export type ImageTreatment = "photographic" | "illustrated" | "collage" | "monochrome";

export interface StyleVisualTraits {
  layout: string[];
  typography: string[];
  colorMode: string;
  imageTreatment: string[];
  composition: string[];
  tone: string[];
}

export interface StyleContentRules {
  maxTextWordsPerSlide: number;
  headlineRequired: boolean;
  bodyRequired: boolean;
  captionStyle: string;
  avoid: string[];
}

export interface StyleGenerationRequirements {
  needsImage: boolean;
  needsLayoutEngine: boolean;
  needsTypographyPairing: boolean;
}

export interface StyleCard {
  id: string;
  name: string;
  intent: string;
  imageStyle: string;
  layoutStyle: string;
  copyStyle: string;
  visualTraits: StyleVisualTraits;
  contentRules: StyleContentRules;
  generationRequirements: StyleGenerationRequirements;
  negativeConstraints: string[];
  source: "builtin" | "extracted" | "custom";
  createdAt: string;
  updatedAt: string;
}

export interface CreativeBrief {
  styleCardId: string;
  styleName: string;
  topic: string;
  visualAngle: string;
  slideNarrative: string[];
  imageBrief: string;
  layoutBrief: string;
  copyDensity: TextDensity;
  typographyMood: string;
  renderRecommendation: string;
}

export interface RenderSpec {
  aspectRatio: string;
  safeMargins: number;
  textAlignment: string;
  imageCrop: string;
}

export interface StructuredPromptOutput {
  creativeBrief: CreativeBrief;
  imagePrompt: string;
  layoutPrompt: string;
  textOverlayRules: string;
  renderSpec: RenderSpec;
}

export interface UgcBrief {
  hook?: string;
  problem?: string;
  productMoment?: string;
  outcome?: string;
  cta?: string;
  toneNotes?: string;
}

export interface StyleControlledRequest {
  styleCardId: string;
  generationMode?: GenerationMode;
  textDensity?: TextDensity;
  referenceLockStrength?: ReferenceLockStrength;
  imageTreatment?: ImageTreatment;
  ugcBrief?: UgcBrief;
}

// ── Creative Operating System ────────────────────────────────────────────────

export type CreativeFormat =
  | "ugc-short-video"
  | "creator-talking-video"
  | "image-led-post"
  | "meme-post"
  | "educational-carousel"
  | "founder-thought-leadership"
  | "promo-trailer"
  | "slideshow-video"
  | "product-explainer"
  | "ad-creative"
  | "insight-card";

export type CreativeReviewFlag =
  | "too_safe"
  | "too_generic"
  | "too_brandlike"
  | "too_static"
  | "too_adlike"
  | "weak_hook"
  | "refined";

export interface CreativeBriefInterpretation {
  product: string;
  goal: string;
  audience: string;
  format: CreativeFormat;
  tone: string;
  platform: Platform;
  confidence: number;
  inferredContext: string[];
}

export interface CreativeDirection {
  id: string;
  title: string;
  format: CreativeFormat;
  angle: string;
  why_it_works: string;
  emotional_driver: string;
  visual_style: string;
  hook_style: string;
  recommended_platform_fit: Platform[];
  hook_examples: string[];
  performance_score: number;
  brand_fit_score: number;
}

export interface ContentBlueprint {
  narrative_arc: string[];
  beat_sheet: string[];
  creative_notes: string[];
  editing_style: string;
  cta_style: string;
  pacing_guidance: string;
  on_screen_text_strategy: string;
}

export interface ProductionAssets {
  script: string[];
  on_screen_text: string[];
  shot_list: string[];
  image_prompts: string[];
  slide_plan: string[];
  caption_options: string[];
  headline_options: string[];
  render_prompts: string[];
  voiceover_version: string[];
  thumbnail_or_cover_text: string[];
}

export interface CreativeVariant {
  label: string;
  difference: string;
  script_adjustments: string[];
  visual_adjustments: string[];
}

export type ImageStrategy =
  | "ai_generated"
  | "asset_library"
  | "reusable_template"
  | "no_image_text_only";

export interface StoryboardSlide {
  slide_number: number;
  role: string;
  copy: string;
  image_strategy: ImageStrategy;
  image_prompt?: string;
  visual_notes: string;
  layout: string;
}

export interface CreativeSystemOutput {
  brief_interpretation: CreativeBriefInterpretation;
  proposed_directions: CreativeDirection[];
  recommended_direction_id: string;
  content_blueprint: ContentBlueprint;
  production_assets: ProductionAssets;
  variants: CreativeVariant[];
  review_flags: CreativeReviewFlag[];
  storyboard: StoryboardSlide[];
  caption: string;
  hashtags: string[];
  refinementNotes?: string[];
}

export interface CreativeProjectMemory {
  id: string;
  brandProfileId: string;
  rawIntent: string;
  selectedDirectionId: string;
  creativePlan: CreativeSystemOutput;
  refinementNotes: string[];
  createdAt: string;
  updatedAt: string;
}
