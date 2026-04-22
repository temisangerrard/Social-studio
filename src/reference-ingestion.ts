import type { StyleCard, UploadedAsset, AssetAnalysis } from "./types.ts";

// ── Reference Ingestion Pipeline ──────────────────────────────────────────────
// Upload 3–10 reference posts → analyze visual patterns → extract style card → save preset
//
// Flow: Reference Ingestion → Style Analysis → Style Card Creation → Save Preset

export interface ReferenceAnalysis {
  typographyStyle: string;
  spacing: string;
  textDensity: string;
  imageToTextRatio: string;
  mood: string;
  layoutPatterns: string[];
  colorTreatment: string;
  contentRhythm: string;
  imageStyle: string;
  layoutStyle: string;
  copyStyle: string;
}

// ── Analyze References ────────────────────────────────────────────────────────

function analyzeTypography(analyses: AssetAnalysis[]): string {
  const hasEditorial = analyses.some((a) => /serif|editorial|magazine/i.test(a.subjectSummary));
  const hasBold = analyses.some((a) => /bold|condensed|heavy/i.test(a.subjectSummary));
  if (hasEditorial) return "editorial serif, high contrast, large headline with small body";
  if (hasBold) return "bold condensed sans-serif, oversized type, tight tracking";
  return "clean sans-serif, balanced weight, readable body text";
}

function analyzeSpacing(analyses: AssetAnalysis[]): string {
  const hasMinimal = analyses.some((a) => /minimal|clean|whitespace/i.test(a.subjectSummary));
  return hasMinimal ? "generous whitespace, clean margins, breathing room" : "moderate spacing, structured grid";
}

function analyzeMood(analyses: AssetAnalysis[]): string {
  const summaries = analyses.map((a) => a.subjectSummary.toLowerCase()).join(" ");
  if (/premium|luxury|editorial/.test(summaries)) return "premium, curated, intelligent";
  if (/bold|strong|impact/.test(summaries)) return "bold, confrontational, disruptive";
  if (/warm|personal|human/.test(summaries)) return "warm, personal, authentic";
  return "clean, modern, professional";
}

function analyzeColorTreatment(analyses: AssetAnalysis[]): string {
  const summaries = analyses.map((a) => a.subjectSummary.toLowerCase()).join(" ");
  if (/monochrome|black.and.white|bw/.test(summaries)) return "monochrome, high contrast";
  if (/muted|neutral|soft/.test(summaries)) return "muted neutral palette with dark type";
  if (/warm|golden|earth/.test(summaries)) return "warm earth tones with natural accents";
  return "balanced palette with brand accent";
}

function analyzeLayoutPatterns(analyses: AssetAnalysis[]): string[] {
  const patterns: string[] = [];
  const summaries = analyses.map((a) => a.subjectSummary.toLowerCase()).join(" ");
  if (/full.bleed|edge.to.edge/.test(summaries)) patterns.push("full-bleed image");
  if (/text.block|text.panel/.test(summaries)) patterns.push("text block separation");
  if (/grid|column/.test(summaries)) patterns.push("structured grid");
  if (/centered|centre/.test(summaries)) patterns.push("centered composition");
  if (/portrait|face|person/.test(summaries)) patterns.push("portrait-led");
  if (patterns.length === 0) patterns.push("image-text split", "clean margins");
  return patterns;
}

function inferImageStyle(analysis: ReferenceAnalysis): string {
  if (/monochrome/.test(analysis.colorTreatment)) return "high contrast black and white editorial";
  if (/editorial|premium/.test(analysis.mood)) return "cinematic documentary editorial";
  if (/warm|personal/.test(analysis.mood)) return "natural light portraiture";
  return "clean editorial photography";
}

function inferLayoutStyle(analysis: ReferenceAnalysis): string {
  if (analysis.layoutPatterns.includes("full-bleed image")) return "minimal magazine carousel";
  if (analysis.layoutPatterns.includes("portrait-led")) return "portrait card with text panel";
  if (analysis.layoutPatterns.includes("structured grid")) return "structured editorial grid";
  return "clean image-text split layout";
}

export function analyzeReferences(analyses: AssetAnalysis[]): ReferenceAnalysis {
  const typography = analyzeTypography(analyses);
  const spacing = analyzeSpacing(analyses);
  const mood = analyzeMood(analyses);
  const colorTreatment = analyzeColorTreatment(analyses);
  const layoutPatterns = analyzeLayoutPatterns(analyses);

  const result: ReferenceAnalysis = {
    typographyStyle: typography,
    spacing,
    textDensity: analyses.length > 5 ? "medium" : "low",
    imageToTextRatio: "70:30",
    mood,
    layoutPatterns,
    colorTreatment,
    contentRhythm: `${analyses.length}-slide pacing with visual-led flow`,
    imageStyle: "",
    layoutStyle: "",
    copyStyle: `${mood.split(",")[0]} commentary`,
  };

  result.imageStyle = inferImageStyle(result);
  result.layoutStyle = inferLayoutStyle(result);

  return result;
}

// ── Style Card Creation from Analysis ─────────────────────────────────────────

export function createStyleCardFromAnalysis(
  analysis: ReferenceAnalysis,
  name: string,
  intent: string
): StyleCard {
  const now = new Date().toISOString();
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return {
    id,
    name,
    intent,
    imageStyle: analysis.imageStyle,
    layoutStyle: analysis.layoutStyle,
    copyStyle: analysis.copyStyle,
    visualTraits: {
      layout: analysis.layoutPatterns,
      typography: [analysis.typographyStyle],
      colorMode: analysis.colorTreatment,
      imageTreatment: [analysis.imageStyle.split(" ")[0]],
      composition: analysis.layoutPatterns.slice(0, 3),
      tone: analysis.mood.split(", "),
    },
    contentRules: {
      maxTextWordsPerSlide: analysis.textDensity === "high" ? 60 : analysis.textDensity === "medium" ? 45 : 25,
      headlineRequired: analysis.layoutPatterns.includes("text block separation"),
      bodyRequired: true,
      captionStyle: `${analysis.mood.split(",")[0]} and concise`,
      avoid: ["generic marketing gradients", "emoji-heavy design", "cluttered collage", "stock-photo business aesthetic"],
    },
    generationRequirements: {
      needsImage: true,
      needsLayoutEngine: true,
      needsTypographyPairing: true,
    },
    negativeConstraints: [
      "no startup gradients",
      "no emoji overlays",
      "no overly saturated AI look",
      "no generic motivational poster composition",
      "no cramped copy",
      "no Canva-style template clutter",
    ],
    source: "extracted",
    createdAt: now,
    updatedAt: now,
  };
}

// ── Full Pipeline: References → Style Card ────────────────────────────────────

export function ingestReferencesAndCreateStyleCard(
  analyses: AssetAnalysis[],
  name: string,
  intent: string
): { analysis: ReferenceAnalysis; styleCard: StyleCard } {
  const analysis = analyzeReferences(analyses);
  const styleCard = createStyleCardFromAnalysis(analysis, name, intent);
  return { analysis, styleCard };
}
