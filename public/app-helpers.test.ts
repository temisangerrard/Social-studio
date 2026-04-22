import assert from "node:assert/strict";
import test from "node:test";
import { getPlatformPublishLinks, getWorkspaceAssetUrl } from "./app-helpers.js";

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
