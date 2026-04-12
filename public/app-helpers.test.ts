import assert from "node:assert/strict";
import test from "node:test";
import { buildCanvasCards, getPlatformPublishLinks, getWorkflowPresets, getWorkspaceAssetUrl } from "./app-helpers.js";

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
  assert.equal(links.length, 2);
  assert.match(links[0].href, /tiktok\.com/);
  assert.match(links[1].href, /instagram\.com/);
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

test("workflow presets surface the five content workflows", () => {
  const presets = getWorkflowPresets();
  assert.deepEqual(
    presets.map((preset) => preset.id),
    ["slideshow", "mascot-variants", "reference-edit", "video-clip", "reel-package"]
  );
});
