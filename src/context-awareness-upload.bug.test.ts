/**
 * Bug Condition Exploration Tests — Context Awareness Image Upload
 *
 * These tests encode the EXPECTED (fixed) behavior. They are expected to FAIL
 * on the current unfixed code, confirming the bug exists.
 *
 * Bug Condition: When uploadedAssets is non-empty and workflowType is
 * "slideshow" or "linkedin-carousel", the pipeline ignores uploaded assets.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.5
 */
import { describe, it, expect } from "vitest";
import { buildPlannerPrompt } from "./planner.ts";
import { runPipelineFromRequest } from "./pipeline.ts";
import type {
  BrandProfile,
  GenerationRequest,
  Slide,
  PlannedPackage,
  UploadedAsset,
  AssetAnalysis,
} from "./types.ts";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// ── Test Fixtures ─────────────────────────────────────────────────────────────

function makeBrand(): BrandProfile {
  return {
    id: "testbrand",
    name: "TestBrand",
    description: "Test brand for bug exploration",
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
  };
}

function makeUploadedAsset(): UploadedAsset {
  return {
    id: "upload-photo-1",
    url: "https://cdn.example.com/uploads/headshot-abc123.jpg",
    mimeType: "image/jpeg",
    filename: "headshot.jpg",
    label: "LinkedIn headshot",
  };
}

function makeAssetAnalysis(): AssetAnalysis {
  return {
    assetId: "upload-photo-1",
    assetType: "person_photo",
    subjectSummary: "Professional headshot for LinkedIn",
    contentHints: ["carousel"],
    channelHints: ["instagram"],
    confidence: 0.95,
    needsUserConfirmation: false,
    source: "fallback",
  };
}

function makeRequestWithUploads(): GenerationRequest {
  return {
    brandProfileId: "testbrand",
    rawIdea: "Create a slideshow about AI trends with my photo",
    notes: "",
    cards: [
      {
        id: "card-1",
        type: "idea",
        text: "AI trends in 2026",
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
    uploadedAssets: [makeUploadedAsset()],
    assetAnalyses: [makeAssetAnalysis()],
  };
}

function makeMockSlides(): Slide[] {
  return [
    {
      slide_number: 1,
      role: "hook",
      type: "generated_image",
      text: "AI is changing everything",
      image_prompt: "Futuristic AI concept art",
      visual_goal: "Grab attention",
      layout: "image_focus",
      asset_path: null,
    },
    {
      slide_number: 2,
      role: "problem",
      type: "generated_image",
      text: "Most people are falling behind",
      image_prompt: "Person looking confused at technology",
      visual_goal: "Show the problem",
      layout: "image_text_split",
      asset_path: null,
    },
  ];
}

// ── Bug Condition Exploration Tests ───────────────────────────────────────────

describe("Bug Condition: Pipeline ignores uploaded assets", () => {
  /**
   * **Validates: Requirements 1.2**
   *
   * buildPlannerPrompt() should include actual asset URLs so the planner
   * can assign uploaded assets to specific slides. Currently it only
   * includes text summaries like "person_photo: Professional headshot".
   */
  it("buildPlannerPrompt includes uploaded asset URLs, not just text summaries", () => {
    const request = makeRequestWithUploads();
    const brand = makeBrand();

    const prompt = buildPlannerPrompt({ brand, request });

    // The prompt should contain the actual URL of the uploaded asset
    expect(prompt).toContain("https://cdn.example.com/uploads/headshot-abc123.jpg");
  });

  /**
   * **Validates: Requirements 1.3, 1.5**
   *
   * When the pipeline runs with uploaded assets, the image generator
   * should receive uploadedAssets in its options. Currently the pipeline
   * only passes mascotReferenceImages.
   */
  it("pipeline forwards uploadedAssets to image generator options", async () => {
    const outputRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "bug-explore-pipeline-")
    );
    const request = makeRequestWithUploads();
    const brand = makeBrand();
    const mockSlides = makeMockSlides();

    let capturedOptions: Record<string, unknown> | null = null;

    const metadata = await runPipelineFromRequest(request, brand, outputRoot, {
      planPackage: async () => ({
        plan: {
          hooks: ["AI is changing everything"],
          caption: "AI trends post",
          hashtags: ["#ai"],
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

    // The image generator should have received uploadedAssets in its options
    expect(capturedOptions).not.toBeNull();
    expect(capturedOptions).toHaveProperty("uploadedAssets");
    expect((capturedOptions as any).uploadedAssets).toBeInstanceOf(Array);
    expect((capturedOptions as any).uploadedAssets.length).toBeGreaterThan(0);
  });

  /**
   * **Validates: Requirements 1.1, 1.5**
   *
   * When uploaded assets exist, at least one slide should have
   * uploaded_asset_url set so the image generator can use the uploaded
   * image instead of generating an AI image. Currently no slide ever
   * gets uploaded_asset_url because the field doesn't exist on Slide.
   */
  it("at least one slide has uploaded_asset_url set when uploads exist", async () => {
    const outputRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "bug-explore-slides-")
    );
    const request = makeRequestWithUploads();
    const brand = makeBrand();
    const mockSlides = makeMockSlides();

    const metadata = await runPipelineFromRequest(request, brand, outputRoot, {
      planPackage: async () => ({
        plan: {
          hooks: ["AI is changing everything"],
          caption: "AI trends post",
          hashtags: ["#ai"],
          platformNotes: {},
          slides: mockSlides,
        } as PlannedPackage,
        provider: "fallback" as const,
      }),
      generateSlideImages: async (slides: Slide[]) => {
        return slides.map((s) => ({ ...s, asset_path: "/mock/path.svg" }));
      },
      renderPackageSlides: async () => [],
    });

    // At least one slide should have uploaded_asset_url set
    const slidesWithUploadedAsset = metadata.slides.filter(
      (s: any) => s.uploaded_asset_url != null
    );
    expect(slidesWithUploadedAsset.length).toBeGreaterThan(0);
  });
});
