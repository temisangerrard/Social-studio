import assert from "node:assert/strict";
import test from "node:test";

import type { BrandProfile } from "./types.ts";
import { buildUgcPromptContext, normalizeUgcDraft } from "./ugc.ts";

const brand: BrandProfile = {
  id: "peppera",
  name: "Peppera",
  description: "Meal planning app for busy people.",
  tone: "clear, direct",
  audience: "busy home cooks",
  cta: "Download Peppera",
  logoPath: null,
  visual: {
    primaryColor: "#f04d23",
    secondaryColor: "#ffd9c8",
    accentColor: "#7a2413",
    surfaceColor: "#fff7f0"
  },
  defaults: {
    platformTargets: ["tiktok", "instagram"],
    goal: "installs",
    hashtags: ["#mealideas"]
  },
  providers: {
    plannerModel: "glm-4.5-air",
    imageModel: "fal-ai/nano-banana-2"
  }
};

test("normalizeUgcDraft fills full script structure", () => {
  const draft = normalizeUgcDraft(
    {
      hook: "I stopped guessing dinner.",
      problem: "I was wasting time every evening.",
      productMoment: "Peppera turns ingredients into meal ideas.",
      outcome: "Now dinner is planned in minutes.",
      cta: "Download Peppera.",
      toneNotes: "Relieved, practical"
    },
    brand
  );

  assert.match(draft.fullScript, /Peppera/i);
  assert.equal(draft.beatSheet.length, 4);
  assert.ok(draft.onScreenText.length >= 3);
});

test("buildUgcPromptContext includes brand, platform, and script beats", () => {
  const prompt = buildUgcPromptContext({
    brand,
    platform: "tiktok",
    visualMode: "product-demo",
    script: {
      hook: "Hook",
      problem: "Problem",
      productMoment: "Product moment",
      outcome: "Outcome",
      cta: "CTA",
      toneNotes: "Direct",
      fullScript: "Hook Problem Product moment Outcome CTA",
      beatSheet: ["Open on creator", "Show app"],
      onScreenText: ["Stop guessing dinner"]
    }
  });

  assert.match(prompt, /Peppera/i);
  assert.match(prompt, /tiktok/i);
  assert.match(prompt, /product-demo/i);
  assert.match(prompt, /Show app/i);
});
