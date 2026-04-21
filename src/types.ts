export type Platform = "tiktok" | "instagram" | "linkedin";
export type DeliveryTarget = "tiktok" | "instagram" | "linkedin" | "both" | "all";
export type PostFormat = "slideshow" | "carousel" | "text-only";
export type WorkflowType = "slideshow" | "mascot-variants" | "reference-edit" | "video-clip" | "reel-package" | "linkedin-carousel" | "linkedin-text";
export type VisualMode = "mascot-led" | "food-led" | "mixed";
export type ConsistencyMode = "prompt-led" | "mascot-consistent";
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
  | "cta_banner";

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
  mascot?: BrandMascot;
  contentTypes?: ContentTypeDefinition[];
  defaultContentType?: string;
  contentRecipes?: ContentRecipeDefinition[];
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

export interface AssistantMessage {
  id: string;
  role: "assistant" | "user" | "system";
  text: string;
  createdAt: string;
}

export interface InferredBrief {
  goal: string;
  audience: string;
  offer: string;
  tone: string;
  platform: string;
}

export interface CheckpointState {
  strategy: "pending" | "active" | "done";
  hooks: "pending" | "active" | "done";
  visuals: "pending" | "active" | "done";
  finalPackage: "pending" | "active" | "done";
}

export interface AssistantSession {
  id: string;
  productId: string;
  status: "interviewing" | "generating" | "done";
  currentQuestion: string;
  messages: AssistantMessage[];
  inferredBrief: InferredBrief;
  checkpoints: CheckpointState;
  workspaceCards: BoardCard[];
  createdAt: string;
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
  variantCount?: number;
  deliveryTargets?: DeliveryTarget;
  contentTypeId?: string;
  routingDecision?: RoutingDecision;
  routingTrace?: RoutingTrace;
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
  uploaded_assets?: UploadedAsset[];
  asset_analyses?: AssetAnalysis[];
  routing_decision?: RoutingDecision;
  routing_trace?: RoutingTrace;
  slides: Slide[];
  artifacts?: GeneratedArtifact[];
  reel_package?: ReelPackageDraft | null;
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
