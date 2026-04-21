/**
 * Canvas screenshot tests — per-brand, per-content-type.
 *
 * Instead of full Playwright browser tests, these verify that
 * `buildArtboardDescriptors` produces the correct artboard count and types
 * for every brand × content-type combination using real brand configs.
 *
 * For each content type we:
 *   1. Build a mock PostMetadata matching the slideBlueprint
 *   2. Call buildArtboardDescriptors
 *   3. Assert artboard count matches blueprint length
 *   4. Assert image slides have valid assetUrl, text-only slides have null assetUrl
 *   5. Assert no error-state conditions (no undefined slide_numbers, no broken IDs)
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { buildArtboardDescriptors, resolveAssetUrl } from "../public/canvas-engine.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

interface BlueprintEntry {
  role: string;
  type: "text_only" | "generated_image";
  textFields: string[];
  imagePromptTemplate: string | null;
  layout: string;
}

interface ContentTypeDef {
  id: string;
  name: string;
  imageStyle: string;
  platformTargets: string[];
  slideBlueprint: BlueprintEntry[];
}

interface BrandConfig {
  id: string;
  name: string;
  contentTypes?: ContentTypeDef[];
}

const BRANDS_DIR = path.resolve("config", "brands");

async function loadBrand(filename: string): Promise<BrandConfig> {
  const raw = await fs.readFile(path.join(BRANDS_DIR, filename), "utf8");
  return JSON.parse(raw);
}

/**
 * Build a mock PostMetadata output from a content type's slideBlueprint.
 * Simulates what the pipeline produces: artifacts with asset_path for
 * generated_image slides, null for text_only slides, render_status "skipped".
 */
function buildMockOutput(
  brand: BrandConfig,
  contentType: ContentTypeDef,
  renderStatus: "skipped" | "complete" = "skipped"
) {
  const postId = `${brand.id}_ig_0001`;
  const slides = contentType.slideBlueprint.map((entry, i) => ({
    slide_number: i + 1,
    role: entry.role,
    type: entry.type,
    text: `${entry.role} text for ${contentType.name}`,
    image_prompt: entry.imagePromptTemplate ?? null,
    visual_goal: "",
    layout: entry.layout,
    asset_path:
      entry.type === "generated_image"
        ? `/tmp/outputs/${postId}/assets/generated/${entry.role}-${i + 1}.jpg`
        : null,
  }));

  const artifacts = slides.map((slide, i) => ({
    id: `slide-${String(i + 1).padStart(2, "0")}`,
    kind: "image" as const,
    role: slide.role,
    title: slide.text,
    prompt: slide.image_prompt ?? slide.text,
    asset_path: slide.asset_path,
    preview_path: slide.asset_path,
    slide_number: i + 1,
    source_asset_id: null,
    variant_group: null,
  }));

  return {
    post_id: postId,
    product: brand.name,
    caption: `Caption for ${contentType.name}`,
    hooks: [`Hook for ${contentType.name}`],
    hashtags: [`#${brand.id}`],
    slides,
    artifacts,
    render_status: renderStatus,
  };
}

/**
 * Reusable assertion: no artboard descriptor should be in an error state.
 * Error state = assetUrl is empty string (which triggers img.src="" → error handler).
 * Valid states: non-null string URL, or null (text placeholder).
 */
function assertNoErrorStates(descriptors: any[], label: string) {
  for (const desc of descriptors) {
    assert.notEqual(
      desc.assetUrl,
      "",
      `${label}: artboard "${desc.id}" has empty-string assetUrl (would trigger error state)`
    );
    // id must not contain "undefined"
    assert.ok(
      !desc.id.includes("undefined"),
      `${label}: artboard id "${desc.id}" contains "undefined"`
    );
    // slideNumber must be a valid number
    assert.equal(
      typeof desc.slideNumber,
      "number",
      `${label}: artboard "${desc.id}" slideNumber is not a number`
    );
    assert.ok(
      !Number.isNaN(desc.slideNumber),
      `${label}: artboard "${desc.id}" slideNumber is NaN`
    );
  }
}

/**
 * Assert that text-only slides produce descriptors with null assetUrl
 * (styled placeholder) rather than error states.
 */
function assertTextOnlyPlaceholders(
  descriptors: any[],
  blueprint: BlueprintEntry[],
  label: string
) {
  for (let i = 0; i < blueprint.length; i++) {
    if (blueprint[i].type === "text_only") {
      assert.equal(
        descriptors[i].assetUrl,
        null,
        `${label}: text-only slide at index ${i} (role="${blueprint[i].role}") should have null assetUrl for placeholder, got "${descriptors[i].assetUrl}"`
      );
    }
  }
}

/**
 * Assert that generated_image slides produce descriptors with valid assetUrl.
 */
function assertImageSlidesHaveUrls(
  descriptors: any[],
  blueprint: BlueprintEntry[],
  label: string
) {
  for (let i = 0; i < blueprint.length; i++) {
    if (blueprint[i].type === "generated_image") {
      assert.ok(
        descriptors[i].assetUrl !== null && descriptors[i].assetUrl !== "",
        `${label}: generated_image slide at index ${i} (role="${blueprint[i].role}") should have a valid assetUrl, got ${descriptors[i].assetUrl}`
      );
      assert.ok(
        descriptors[i].assetUrl.startsWith("/api/"),
        `${label}: assetUrl should start with /api/, got "${descriptors[i].assetUrl}"`
      );
    }
  }
}


// ── 6.2 Peppera — recipe-carousel ─────────────────────────────────────────────

test("Peppera — recipe-carousel: 7 artboards (5 images + 2 text placeholders), no error states", async () => {
  const brand = await loadBrand("peppera.json");
  const ct = brand.contentTypes!.find((c) => c.id === "recipe-carousel")!;
  assert.ok(ct, "recipe-carousel content type must exist");
  assert.equal(ct.slideBlueprint.length, 7, "blueprint should have 7 entries");

  const output = buildMockOutput(brand, ct);
  const descriptors = buildArtboardDescriptors(output);

  assert.equal(descriptors.length, 7, "should produce 7 artboards");
  assertNoErrorStates(descriptors, "Peppera/recipe-carousel");
  assertTextOnlyPlaceholders(descriptors, ct.slideBlueprint, "Peppera/recipe-carousel");
  assertImageSlidesHaveUrls(descriptors, ct.slideBlueprint, "Peppera/recipe-carousel");

  // Verify: 5 image slides + 2 text-only (hook + cta)
  const imageCount = ct.slideBlueprint.filter((e) => e.type === "generated_image").length;
  const textCount = ct.slideBlueprint.filter((e) => e.type === "text_only").length;
  assert.equal(imageCount, 5, "should have 5 generated_image slides");
  assert.equal(textCount, 2, "should have 2 text_only slides");
});

// ── 6.3 Peppera — single-recipe ──────────────────────────────────────────────

test("Peppera — single-recipe: 1 artboard with image", async () => {
  const brand = await loadBrand("peppera.json");
  const ct = brand.contentTypes!.find((c) => c.id === "single-recipe")!;
  assert.ok(ct, "single-recipe content type must exist");

  const output = buildMockOutput(brand, ct);
  const descriptors = buildArtboardDescriptors(output);

  assert.equal(descriptors.length, 1, "should produce 1 artboard");
  assertNoErrorStates(descriptors, "Peppera/single-recipe");
  assertImageSlidesHaveUrls(descriptors, ct.slideBlueprint, "Peppera/single-recipe");
});

// ── 6.4 Peppera — cooking-tip ────────────────────────────────────────────────

test("Peppera — cooking-tip: 1 artboard with image", async () => {
  const brand = await loadBrand("peppera.json");
  const ct = brand.contentTypes!.find((c) => c.id === "cooking-tip")!;
  assert.ok(ct, "cooking-tip content type must exist");

  const output = buildMockOutput(brand, ct);
  const descriptors = buildArtboardDescriptors(output);

  assert.equal(descriptors.length, 1, "should produce 1 artboard");
  assertNoErrorStates(descriptors, "Peppera/cooking-tip");
  assertImageSlidesHaveUrls(descriptors, ct.slideBlueprint, "Peppera/cooking-tip");
});

// ── 6.5 Peppera — ingredient-spotlight ───────────────────────────────────────

test("Peppera — ingredient-spotlight: 3 artboards (hero + 2 recipes)", async () => {
  const brand = await loadBrand("peppera.json");
  const ct = brand.contentTypes!.find((c) => c.id === "ingredient-spotlight")!;
  assert.ok(ct, "ingredient-spotlight content type must exist");

  const output = buildMockOutput(brand, ct);
  const descriptors = buildArtboardDescriptors(output);

  assert.equal(descriptors.length, 3, "should produce 3 artboards");
  assertNoErrorStates(descriptors, "Peppera/ingredient-spotlight");
  assertImageSlidesHaveUrls(descriptors, ct.slideBlueprint, "Peppera/ingredient-spotlight");

  // All 3 are generated_image
  const imageCount = ct.slideBlueprint.filter((e) => e.type === "generated_image").length;
  assert.equal(imageCount, 3, "all 3 slides should be generated_image");
});

// ── 6.6 EchoCart — product-demo ──────────────────────────────────────────────

test("EchoCart — product-demo: 4 artboards (3 images + 1 text CTA), no error states", async () => {
  const brand = await loadBrand("echocart.json");
  const ct = brand.contentTypes!.find((c) => c.id === "product-demo")!;
  assert.ok(ct, "product-demo content type must exist");

  const output = buildMockOutput(brand, ct);
  const descriptors = buildArtboardDescriptors(output);

  assert.equal(descriptors.length, 4, "should produce 4 artboards");
  assertNoErrorStates(descriptors, "EchoCart/product-demo");
  assertTextOnlyPlaceholders(descriptors, ct.slideBlueprint, "EchoCart/product-demo");
  assertImageSlidesHaveUrls(descriptors, ct.slideBlueprint, "EchoCart/product-demo");

  const imageCount = ct.slideBlueprint.filter((e) => e.type === "generated_image").length;
  const textCount = ct.slideBlueprint.filter((e) => e.type === "text_only").length;
  assert.equal(imageCount, 3, "should have 3 generated_image slides");
  assert.equal(textCount, 1, "should have 1 text_only slide (CTA)");
});

// ── 6.7 EchoCart — feature-announcement ──────────────────────────────────────

test("EchoCart — feature-announcement: 1 artboard rendered", async () => {
  const brand = await loadBrand("echocart.json");
  const ct = brand.contentTypes!.find((c) => c.id === "feature-announcement")!;
  assert.ok(ct, "feature-announcement content type must exist");

  const output = buildMockOutput(brand, ct);
  const descriptors = buildArtboardDescriptors(output);

  assert.equal(descriptors.length, 1, "should produce 1 artboard");
  assertNoErrorStates(descriptors, "EchoCart/feature-announcement");
  assertImageSlidesHaveUrls(descriptors, ct.slideBlueprint, "EchoCart/feature-announcement");
});

// ── 6.8 EchoCart — comparison ────────────────────────────────────────────────

test("EchoCart — comparison: 3 artboards rendered", async () => {
  const brand = await loadBrand("echocart.json");
  const ct = brand.contentTypes!.find((c) => c.id === "comparison")!;
  assert.ok(ct, "comparison content type must exist");

  const output = buildMockOutput(brand, ct);
  const descriptors = buildArtboardDescriptors(output);

  assert.equal(descriptors.length, 3, "should produce 3 artboards");
  assertNoErrorStates(descriptors, "EchoCart/comparison");
  assertImageSlidesHaveUrls(descriptors, ct.slideBlueprint, "EchoCart/comparison");
});

// ── 6.9 Settley — property-showcase ──────────────────────────────────────────

test("Settley — property-showcase: 5 artboards (4 images + 1 text CTA), no error states", async () => {
  const brand = await loadBrand("settley.json");
  const ct = brand.contentTypes!.find((c) => c.id === "property-showcase")!;
  assert.ok(ct, "property-showcase content type must exist");

  const output = buildMockOutput(brand, ct);
  const descriptors = buildArtboardDescriptors(output);

  assert.equal(descriptors.length, 5, "should produce 5 artboards");
  assertNoErrorStates(descriptors, "Settley/property-showcase");
  assertTextOnlyPlaceholders(descriptors, ct.slideBlueprint, "Settley/property-showcase");
  assertImageSlidesHaveUrls(descriptors, ct.slideBlueprint, "Settley/property-showcase");

  const imageCount = ct.slideBlueprint.filter((e) => e.type === "generated_image").length;
  const textCount = ct.slideBlueprint.filter((e) => e.type === "text_only").length;
  assert.equal(imageCount, 4, "should have 4 generated_image slides");
  assert.equal(textCount, 1, "should have 1 text_only slide (CTA)");
});

// ── 6.10 Settley — market-insight ────────────────────────────────────────────

test("Settley — market-insight: 3 artboards (2 images + 1 text CTA)", async () => {
  const brand = await loadBrand("settley.json");
  const ct = brand.contentTypes!.find((c) => c.id === "market-insight")!;
  assert.ok(ct, "market-insight content type must exist");

  const output = buildMockOutput(brand, ct);
  const descriptors = buildArtboardDescriptors(output);

  assert.equal(descriptors.length, 3, "should produce 3 artboards");
  assertNoErrorStates(descriptors, "Settley/market-insight");
  assertTextOnlyPlaceholders(descriptors, ct.slideBlueprint, "Settley/market-insight");
  assertImageSlidesHaveUrls(descriptors, ct.slideBlueprint, "Settley/market-insight");

  const imageCount = ct.slideBlueprint.filter((e) => e.type === "generated_image").length;
  const textCount = ct.slideBlueprint.filter((e) => e.type === "text_only").length;
  assert.equal(imageCount, 2, "should have 2 generated_image slides");
  assert.equal(textCount, 1, "should have 1 text_only slide (CTA)");
});

// ── 6.11 AutoBett — feature-highlight ────────────────────────────────────────

test("AutoBett — feature-highlight: 3 artboards (2 images + 1 text CTA), no error states", async () => {
  const brand = await loadBrand("autobett.json");
  const ct = brand.contentTypes!.find((c) => c.id === "feature-highlight")!;
  assert.ok(ct, "feature-highlight content type must exist");

  const output = buildMockOutput(brand, ct);
  const descriptors = buildArtboardDescriptors(output);

  assert.equal(descriptors.length, 3, "should produce 3 artboards");
  assertNoErrorStates(descriptors, "AutoBett/feature-highlight");
  assertTextOnlyPlaceholders(descriptors, ct.slideBlueprint, "AutoBett/feature-highlight");
  assertImageSlidesHaveUrls(descriptors, ct.slideBlueprint, "AutoBett/feature-highlight");

  const imageCount = ct.slideBlueprint.filter((e) => e.type === "generated_image").length;
  const textCount = ct.slideBlueprint.filter((e) => e.type === "text_only").length;
  assert.equal(imageCount, 2, "should have 2 generated_image slides");
  assert.equal(textCount, 1, "should have 1 text_only slide (CTA)");
});

// ── 6.12 AutoBett — odds-showcase ────────────────────────────────────────────

test("AutoBett — odds-showcase: 5 artboards (4 images + 1 text CTA)", async () => {
  const brand = await loadBrand("autobett.json");
  const ct = brand.contentTypes!.find((c) => c.id === "odds-showcase")!;
  assert.ok(ct, "odds-showcase content type must exist");

  const output = buildMockOutput(brand, ct);
  const descriptors = buildArtboardDescriptors(output);

  assert.equal(descriptors.length, 5, "should produce 5 artboards");
  assertNoErrorStates(descriptors, "AutoBett/odds-showcase");
  assertTextOnlyPlaceholders(descriptors, ct.slideBlueprint, "AutoBett/odds-showcase");
  assertImageSlidesHaveUrls(descriptors, ct.slideBlueprint, "AutoBett/odds-showcase");

  const imageCount = ct.slideBlueprint.filter((e) => e.type === "generated_image").length;
  const textCount = ct.slideBlueprint.filter((e) => e.type === "text_only").length;
  assert.equal(imageCount, 4, "should have 4 generated_image slides");
  assert.equal(textCount, 1, "should have 1 text_only slide (CTA)");
});

// ── 6.13 Temisan Gerrard — thought-leadership ────────────────────────────────

test("Temisan Gerrard — thought-leadership: 1 artboard rendered", async () => {
  const brand = await loadBrand("temisangerrard.json");
  const ct = brand.contentTypes!.find((c) => c.id === "thought-leadership")!;
  assert.ok(ct, "thought-leadership content type must exist");

  const output = buildMockOutput(brand, ct);
  const descriptors = buildArtboardDescriptors(output);

  assert.equal(descriptors.length, 1, "should produce 1 artboard");
  assertNoErrorStates(descriptors, "TemisanGerrard/thought-leadership");
  assertImageSlidesHaveUrls(descriptors, ct.slideBlueprint, "TemisanGerrard/thought-leadership");
});

// ── 6.14 Temisan Gerrard — thread-carousel ───────────────────────────────────

test("Temisan Gerrard — thread-carousel: 5 artboards (hook text + 3 images + CTA text), no error states", async () => {
  const brand = await loadBrand("temisangerrard.json");
  const ct = brand.contentTypes!.find((c) => c.id === "thread-carousel")!;
  assert.ok(ct, "thread-carousel content type must exist");

  const output = buildMockOutput(brand, ct);
  const descriptors = buildArtboardDescriptors(output);

  assert.equal(descriptors.length, 5, "should produce 5 artboards");
  assertNoErrorStates(descriptors, "TemisanGerrard/thread-carousel");
  assertTextOnlyPlaceholders(descriptors, ct.slideBlueprint, "TemisanGerrard/thread-carousel");
  assertImageSlidesHaveUrls(descriptors, ct.slideBlueprint, "TemisanGerrard/thread-carousel");

  const imageCount = ct.slideBlueprint.filter((e) => e.type === "generated_image").length;
  const textCount = ct.slideBlueprint.filter((e) => e.type === "text_only").length;
  assert.equal(imageCount, 3, "should have 3 generated_image slides");
  assert.equal(textCount, 2, "should have 2 text_only slides (hook + CTA)");
});

// ── 6.15 Temisan Gerrard — case-study ────────────────────────────────────────

test("Temisan Gerrard — case-study: 4 artboards (3 images + 1 text CTA)", async () => {
  const brand = await loadBrand("temisangerrard.json");
  const ct = brand.contentTypes!.find((c) => c.id === "case-study")!;
  assert.ok(ct, "case-study content type must exist");

  const output = buildMockOutput(brand, ct);
  const descriptors = buildArtboardDescriptors(output);

  assert.equal(descriptors.length, 4, "should produce 4 artboards");
  assertNoErrorStates(descriptors, "TemisanGerrard/case-study");
  assertTextOnlyPlaceholders(descriptors, ct.slideBlueprint, "TemisanGerrard/case-study");
  assertImageSlidesHaveUrls(descriptors, ct.slideBlueprint, "TemisanGerrard/case-study");

  const imageCount = ct.slideBlueprint.filter((e) => e.type === "generated_image").length;
  const textCount = ct.slideBlueprint.filter((e) => e.type === "text_only").length;
  assert.equal(imageCount, 3, "should have 3 generated_image slides");
  assert.equal(textCount, 1, "should have 1 text_only slide (CTA)");
});

// ── 6.16 Text-only placeholder verification ──────────────────────────────────

test("Text-only placeholder verification: all brands' text_only slides produce null assetUrl (placeholder, not error)", async () => {
  const brandFiles = ["peppera.json", "echocart.json", "settley.json", "autobett.json", "temisangerrard.json"];

  for (const file of brandFiles) {
    const brand = await loadBrand(file);
    if (!brand.contentTypes) continue;

    for (const ct of brand.contentTypes) {
      const hasTextOnly = ct.slideBlueprint.some((e) => e.type === "text_only");
      if (!hasTextOnly) continue;

      const output = buildMockOutput(brand, ct);
      const descriptors = buildArtboardDescriptors(output);
      const label = `${brand.name}/${ct.id}`;

      assertNoErrorStates(descriptors, label);
      assertTextOnlyPlaceholders(descriptors, ct.slideBlueprint, label);

      // Verify text-only descriptors have text content for the placeholder
      for (let i = 0; i < ct.slideBlueprint.length; i++) {
        if (ct.slideBlueprint[i].type === "text_only") {
          assert.ok(
            descriptors[i].text && descriptors[i].text.length > 0,
            `${label}: text-only artboard at index ${i} should have non-empty text for placeholder display`
          );
        }
      }
    }
  }
});

// ── 6.17 Full canvas proof: verify all brand/content-type combos ─────────────

test("Full canvas proof: every brand × content-type produces correct artboard count with no errors", async () => {
  const brandFiles = ["peppera.json", "echocart.json", "settley.json", "autobett.json", "temisangerrard.json"];
  const results: Array<{ brand: string; contentType: string; artboards: number; images: number; textOnly: number; status: string }> = [];

  for (const file of brandFiles) {
    const brand = await loadBrand(file);
    if (!brand.contentTypes) continue;

    for (const ct of brand.contentTypes) {
      const output = buildMockOutput(brand, ct);
      const descriptors = buildArtboardDescriptors(output);
      const label = `${brand.name}/${ct.id}`;

      // Core assertions
      assert.equal(
        descriptors.length,
        ct.slideBlueprint.length,
        `${label}: artboard count should match blueprint length`
      );
      assertNoErrorStates(descriptors, label);

      const imageCount = ct.slideBlueprint.filter((e) => e.type === "generated_image").length;
      const textCount = ct.slideBlueprint.filter((e) => e.type === "text_only").length;
      const withUrl = descriptors.filter((d: any) => d.assetUrl !== null).length;
      const withNull = descriptors.filter((d: any) => d.assetUrl === null).length;

      assert.equal(withUrl, imageCount, `${label}: artboards with URLs should match generated_image count`);
      assert.equal(withNull, textCount, `${label}: artboards with null assetUrl should match text_only count`);

      results.push({
        brand: brand.name,
        contentType: ct.id,
        artboards: descriptors.length,
        images: imageCount,
        textOnly: textCount,
        status: "pass",
      });
    }
  }

  // Log summary for visual review
  console.log("\n── Canvas Proof Summary ──────────────────────────────────────");
  for (const r of results) {
    console.log(`  ✓ ${r.brand}/${r.contentType}: ${r.artboards} artboards (${r.images} img + ${r.textOnly} text)`);
  }
  console.log(`  Total: ${results.length} brand×content-type combinations verified\n`);
});
