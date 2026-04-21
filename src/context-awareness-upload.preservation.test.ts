/**
 * Preservation Property Tests — Context Awareness Image Upload
 *
 * These tests capture baseline behavior for NON-upload requests.
 * They MUST PASS on the current unfixed code, confirming behavior
 * that must be preserved after the fix is applied.
 *
 * Preservation Condition: requests where uploadedAssets is empty or undefined
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6, 3.7
 */
import { describe, it, expect } from "vitest";
import { buildPlannerPrompt } from "./planner.ts";
import { runPipelineFromRequest } from "./pipeline.ts";
import type {
  BrandProfile,
  GenerationRequest,
  Slide,
  PlannedPackage,
} from "./types.ts";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// ── Test Fixtures ─────────────────────────────────────────────────────────────

function makeBrand(overrides?: Partial<BrandProfile>): BrandProfile {
  return {
    id: "testbrand",
    name: "TestBrand",
    description: "Test brand for preservation tests",
    tone: "friendly",
    audience: "developers",
    cta: "Try TestBrand",
    logoPath: null,
    visual: {
      primaryColor: "#333333",
      secondaryColor: "#eeeeee",
      accentColor: "#0066ff",
      surfaceColor: "#ffffff",
    },
    defaults: {
      platformTargets: ["instagram"],
      goal: "awareness",
      hashtags: ["#test"],
    },
    providers: {
      plannerModel: "glm-4.5",
      imageModel: "fal-ai/flux/schnell",
    },
    ...overrides,
  };
}

function makeRequest(overrides?: Partial<GenerationRequest>): GenerationRequest {
  return {
    brandProfileId: "testbrand",
    rawIdea: "Create a slideshow about productivity tips",
    notes: "",
    cards: [
      {
        id: "card-1",
        type: "idea",
        text: "Productivity tips for developers",
        x: 0,
        y: 0,
        width: 240,
        height: 180,
        tags: ["idea"],
      },
    ],
    references: [],
    platformTargets: ["instagram"],
    goal: "awareness",
    workflowType: "slideshow",
    uploadedAssets: [],
    ...overrides,
  };
}

function makePepperaBrand(): BrandProfile {
  return makeBrand({
    id: "peppera",
    name: "Peppera",
    description: "Recipe app for students",
    tone: "playful",
    audience: "students",
    cta: "Download Peppera",
  });
}

function makePepperaRequest(): GenerationRequest {
  return makeRequest({
    brandProfileId: "peppera",
    rawIdea: "5 meals from eggs and bread",
    platformTargets: ["instagram"],
    workflowType: "slideshow",
    uploadedAssets: [],
  });
}

function makeMockSlides(): Slide[] {
  return [
    {
      slide_number: 1,
      role: "hook",
      type: "generated_image",
      text: "Productivity hack #1",
      image_prompt: "Modern workspace with clean desk",
      visual_goal: "Grab attention",
      layout: "image_focus",
      asset_path: null,
    },
    {
      slide_number: 2,
      role: "problem",
      type: "generated_image",
      text: "Too many distractions",
      image_prompt: "Cluttered desk with notifications",
      visual_goal: "Show the problem",
      layout: "image_text_split",
      asset_path: null,
    },
    {
      slide_number: 3,
      role: "discovery",
      type: "generated_image",
      text: "Focus mode activated",
      image_prompt: "Clean minimal workspace",
      visual_goal: "Show the solution",
      layout: "image_focus",
      asset_path: null,
    },
  ];
}

// ── Preservation Property Tests ───────────────────────────────────────────────

describe("Preservation: No-upload requests produce expected output", () => {
  /**
   * **Validates: Requirements 3.1**
   *
   * buildPlannerPrompt() with no uploads should produce a prompt
   * containing "Uploaded asset summaries: none".
   */
  it("buildPlannerPrompt with no uploads shows 'none'", () => {
    const request = makeRequest({ uploadedAssets: [] });
    const brand = makeBrand();

    const prompt = buildPlannerPrompt({ brand, request });

    expect(prompt).toContain("Uploaded asset summaries: none");
  });

  it("buildPlannerPrompt with undefined uploadedAssets shows 'none'", () => {
    const request = makeRequest({ uploadedAssets: undefined });
    const brand = makeBrand();

    const prompt = buildPlannerPrompt({ brand, request });

    expect(prompt).toContain("Uploaded asset summaries: none");
  });

  /**
   * **Validates: Requirements 3.1, 3.5**
   *
   * Pipeline with no uploads produces slides where every generated_image
   * slide gets a non-null asset_path from the mock image generator.
   * No slide has uploaded_asset_url set.
   */
  it("pipeline with no uploads produces slides with AI-generated asset_path", async () => {
    const outputRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "preservation-pipeline-")
    );
    const request = makeRequest({ uploadedAssets: [] });
    const brand = makeBrand();
    const mockSlides = makeMockSlides();

    const metadata = await runPipelineFromRequest(request, brand, outputRoot, {
      planPackage: async () => ({
        plan: {
          hooks: ["Productivity hack"],
          caption: "Productivity tips",
          hashtags: ["#productivity"],
          platformNotes: {},
          slides: mockSlides,
        } as PlannedPackage,
        provider: "fallback" as const,
      }),
      generateSlideImages: async (slides: Slide[], options: any) => {
        // Mock image generator: assigns asset_path to generated_image slides
        return slides.map((s) => {
          if (s.type === "generated_image" && s.image_prompt) {
            return { ...s, asset_path: `/mock/assets/slide-${s.slide_number}.svg` };
          }
          return s;
        });
      },
      renderPackageSlides: async () => [],
    });

    // Every generated_image slide should have a non-null asset_path
    const generatedImageSlides = metadata.slides.filter(
      (s) => s.type === "generated_image"
    );
    expect(generatedImageSlides.length).toBeGreaterThan(0);
    for (const slide of generatedImageSlides) {
      expect(slide.asset_path).not.toBeNull();
      expect(slide.asset_path).toBeDefined();
    }

    // No slide should have uploaded_asset_url set
    for (const slide of metadata.slides) {
      expect((slide as any).uploaded_asset_url).toBeUndefined();
    }
  });

  /**
   * **Validates: Requirements 3.2**
   *
   * Mascot reference images are passed unchanged to the image generator
   * when no uploads exist.
   */
  it("mascot reference images are passed unchanged to image generator", async () => {
    const outputRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "preservation-mascot-")
    );
    const mascotRefs = [
      "https://example.com/mascot/pose1.png",
      "https://example.com/mascot/pose2.png",
    ];
    const brand = makeBrand({
      mascot: {
        name: "TestMascot",
        description: "A friendly test mascot",
        role: "brand ambassador",
        visualPrompt: "A cute cartoon mascot",
        usageRules: ["Always include in hook slides"],
        referenceImages: mascotRefs,
      },
    });
    const request = makeRequest({ uploadedAssets: [] });
    const mockSlides = makeMockSlides();

    let capturedOptions: Record<string, unknown> | null = null;

    await runPipelineFromRequest(request, brand, outputRoot, {
      planPackage: async () => ({
        plan: {
          hooks: ["Test hook"],
          caption: "Test caption",
          hashtags: ["#test"],
          platformNotes: {},
          slides: mockSlides,
        } as PlannedPackage,
        provider: "fallback" as const,
      }),
      generateSlideImages: async (slides: Slide[], options: any) => {
        capturedOptions = options;
        return slides.map((s) => ({ ...s, asset_path: "/mock/path.svg" }));
      },
      renderPackageSlides: async () => [],
    });

    // mascotReferenceImages should be passed to image generator matching brand config
    expect(capturedOptions).not.toBeNull();
    expect((capturedOptions as any).mascotReferenceImages).toEqual(mascotRefs);
  });

  /**
   * **Validates: Requirements 3.6**
   *
   * Peppera carousel with no uploads: hook and CTA slides remain
   * type: "text_only" with null image_prompt.
   */
  it("Peppera carousel text-only slides preserved", async () => {
    const outputRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "preservation-peppera-")
    );
    const brand = makePepperaBrand();
    const request = makePepperaRequest();

    const metadata = await runPipelineFromRequest(request, brand, outputRoot, {
      planPackage: async ({ brand: b, request: r }) => {
        // Use the real fallback planner to get Peppera carousel slides
        const { fallbackPlanSocialPackage } = await import("./planner.ts");
        const plan = fallbackPlanSocialPackage({ brand: b, request: r });
        return { plan, provider: "fallback" as const };
      },
      generateSlideImages: async (slides: Slide[]) => {
        return slides.map((s) => {
          if (s.type === "generated_image" && s.image_prompt) {
            return { ...s, asset_path: `/mock/assets/slide-${s.slide_number}.svg` };
          }
          return s;
        });
      },
      renderPackageSlides: async () => [],
    });

    // Find hook and CTA slides
    const hookSlides = metadata.slides.filter((s) => s.role === "hook");
    const ctaSlides = metadata.slides.filter((s) => s.role === "cta");

    expect(hookSlides.length).toBeGreaterThan(0);
    expect(ctaSlides.length).toBeGreaterThan(0);

    // Hook and CTA should be text_only with null image_prompt
    for (const slide of [...hookSlides, ...ctaSlides]) {
      expect(slide.type).toBe("text_only");
      expect(slide.image_prompt).toBeNull();
    }
  });
});
