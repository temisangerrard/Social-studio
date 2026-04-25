import assert from "node:assert/strict";
import test from "node:test";
import fc from "fast-check";
import { buildCanvasCards, formatRelativeTime, getPlatformPublishLinks, getWorkflowPresets, getWorkspaceAssetUrl } from "./app-helpers.js";

test("canvas cards include every generated asset with asset URLs", () => {
  const cards = buildCanvasCards(
    {
      goal: "Get installs",
      audience: "Busy home cooks",
      offer: "Turn leftovers into dinner",
      tone: "Relatable",
      platform: "TikTok"
    },
    {
      post_id: "peppera_tt_0013",
      render_status: "skipped",
      slides: Array.from({ length: 8 }, (_, index) => ({
        slide_number: index + 1,
        role: `role-${index + 1}`,
        text: `Slide ${index + 1}`,
        asset_path: `/tmp/slide-${String(index + 1).padStart(2, "0")}.jpg`
      }))
    },
    (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`
  );

  const assetCards = cards.filter((card) => card.type === "asset");
  assert.equal(assetCards.length, 8);
  assert.equal(assetCards[0].assetUrl, "/api/assets/peppera_tt_0013/slide-01.jpg");
});

test("workspace asset URL falls back to rendered slide path when needed", () => {
  const url = getWorkspaceAssetUrl(
    {
      post_id: "peppera_tt_0014",
      render_status: "complete"
    },
    {
      slide_number: 3,
      asset_path: null
    }
  );

  assert.equal(url, "/api/slides/peppera_tt_0014/slide-03.png");
});

test("publish links include direct TikTok and Instagram destinations", () => {
  const links = getPlatformPublishLinks("Peppera");
  assert.equal(links.length, 3);
  assert.match(links[0].href, /tiktok\.com/);
  assert.match(links[1].href, /instagram\.com/);
  assert.match(links[2].href, /linkedin\.com/);
});

test("canvas cards include generated artifacts when workflow outputs do not have slides", () => {
  const cards = buildCanvasCards(
    {
      goal: "Get installs",
      audience: "Busy home cooks",
      offer: "Turn leftovers into dinner",
      tone: "Relatable",
      platform: "TikTok"
    },
    {
      post_id: "peppera_tt_0020",
      render_status: "skipped",
      slides: [],
      artifacts: [
        {
          id: "artifact-1",
          kind: "image",
          role: "variant",
          title: "Variant 1",
          asset_path: "/tmp/variant-1.png"
        }
      ]
    },
    (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`
  );

  const assetCards = cards.filter((card) => card.type === "asset");
  assert.equal(assetCards.length, 1);
  assert.equal(assetCards[0].assetUrl, "/api/assets/peppera_tt_0020/variant-1.png");
});

test("workflow presets surface all content workflows", () => {
  const presets = getWorkflowPresets();
  assert.deepEqual(
    presets.map((preset) => preset.id),
    ["slideshow", "linkedin-carousel", "linkedin-text", "mascot-variants", "reference-edit", "video-clip", "reel-package"]
  );
});


// ── Property 7: Relative timestamp formatting ───────────────────────────

test("Feature: library-state-management, Property 7: timestamps within 7 days return relative phrase", () => {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const relativePattern = /just now|minutes? ago|hours? ago|days? ago/;

  fc.assert(
    fc.property(
      // Generate an offset between 0ms and 7 days in milliseconds
      fc.integer({ min: 0, max: SEVEN_DAYS_MS }),
      (offsetMs) => {
        const timestamp = new Date(Date.now() - offsetMs).toISOString();
        const result = formatRelativeTime(timestamp);
        assert.match(result, relativePattern, `Expected relative phrase for offset ${offsetMs}ms, got "${result}"`);
      }
    ),
    { numRuns: 200 }
  );
});

test("Feature: library-state-management, Property 7: timestamps older than 7 days return absolute date", () => {
  const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;
  const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000;
  // Absolute dates from toLocaleDateString("en-US", {month:"short", day:"numeric", year:"numeric"})
  // produce patterns like "Jan 15, 2026"
  const absoluteDatePattern = /[A-Z][a-z]{2} \d{1,2}, \d{4}/;

  fc.assert(
    fc.property(
      // Generate an offset between 8 days and 10 years ago
      fc.integer({ min: EIGHT_DAYS_MS, max: TEN_YEARS_MS }),
      (offsetMs) => {
        const timestamp = new Date(Date.now() - offsetMs).toISOString();
        const result = formatRelativeTime(timestamp);
        assert.match(result, absoluteDatePattern, `Expected absolute date for offset ${offsetMs}ms, got "${result}"`);
      }
    ),
    { numRuns: 200 }
  );
});
