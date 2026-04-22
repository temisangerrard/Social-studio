import assert from "node:assert/strict";
import test from "node:test";

import { buildUgcOutputActions } from "./ugc-output.js";

test("UGC output actions include direct downloads and package export", () => {
  const actions = buildUgcOutputActions({
    postId: "peppera_tt_0042",
    platform: "tiktok",
    videoUrl: "/api/assets/peppera_tt_0042/video-clip-1.mp4",
    audioUrl: "/api/assets/peppera_tt_0042/ugc-voiceover.mp3"
  });

  assert.equal(actions[0].label, "Download Video");
  assert.equal(actions[0].href, "/api/assets/peppera_tt_0042/video-clip-1.mp4");
  assert.equal(actions[1].label, "Download Audio");
  assert.equal(actions[1].href, "/api/assets/peppera_tt_0042/ugc-voiceover.mp3");
  assert.equal(actions[2].label, "Export Package");
  assert.equal(actions[2].href, "/api/outputs/peppera_tt_0042/export/package");
});

test("UGC output actions add platform handoff links", () => {
  const actions = buildUgcOutputActions({
    postId: "peppera_ig_0042",
    platform: "instagram",
    videoUrl: "/api/assets/peppera_ig_0042/video-clip-1.mp4",
    audioUrl: null
  });

  assert.equal(actions.some((action) => /Instagram/i.test(action.label)), true);
  assert.equal(actions.some((action) => /TikTok/i.test(action.label)), false);
});
