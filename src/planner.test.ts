import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPlannerPrompt,
  fallbackPlanSocialPackage,
  parsePlannerResponse
} from "./planner.ts";
import type { BrandProfile, GenerationRequest } from "./types.ts";

const brand: BrandProfile = {
  id: "brand-peppera",
  name: "PepperaTest",
  description: "Meal-planning assistant",
  tone: "helpful and cheeky",
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
    platformTargets: ["tiktok"],
    goal: "installs",
    hashtags: ["#mealideas", "#leftovers"]
  },
  providers: {
    plannerModel: "glm-4.7",
    imageModel: "fal-ai/flux/schnell"
  },
  mascot: {
    name: "Peppera Mascot",
    description: "A cheerful green pepper character with a red bandana, big friendly eyes, and simple cartoon limbs.",
    role: "The recurring face of Peppera social content.",
    visualPrompt: "Use the cheerful green pepper mascot as the lead character in the frame.",
    usageRules: [
      "Keep the mascot consistent across variants.",
      "Use the mascot as the main character for TikTok and Instagram content."
    ],
    referenceImages: [
      "/Users/temisan/Downloads/_eb08f432-f4af-414e-90f1-9876eb34f85c.jpeg",
      "/Users/temisan/Downloads/slide 1.png",
      "/Users/temisan/Downloads/slide 2 .png"
    ]
  }
};

const request: GenerationRequest = {
  brandProfileId: "brand-peppera",
  boardId: "board-01",
  rawIdea: "I have random ingredients and no plan",
  notes: "Keep it witty but useful",
  cards: [
    {
      id: "card-1",
      type: "hook",
      text: "Dinner panic at 6pm",
      x: 0,
      y: 0,
      width: 240,
      height: 180,
      tags: ["hook"]
    }
  ],
  references: [],
  platformTargets: ["tiktok", "instagram"],
  goal: "installs",
  visualMode: "mascot-led"
};

test("planner prompt includes brand and board context", () => {
  const prompt = buildPlannerPrompt({ brand, request });
  assert.match(prompt, /Peppera/);
  assert.match(prompt, /Dinner panic at 6pm/);
  assert.match(prompt, /tiktok, instagram/i);
  assert.match(prompt, /Peppera Mascot/);
  assert.match(prompt, /slide 1\.png/);
  assert.match(prompt, /Visual mode: mascot-led/);
});

test("planner parses JSON wrapped in markdown fences", () => {
  const parsed = parsePlannerResponse(`\`\`\`json
{
  "hooks": ["Hook 1", "Hook 2"],
  "caption": "Caption body",
  "hashtags": ["#one", "#two"],
  "platformNotes": {
    "tiktok": "Fast opener",
    "instagram": "More polished cover"
  },
  "slides": [
    {
      "slide_number": 1,
      "role": "hook",
      "type": "text_only",
      "text": "Hook 1",
      "image_prompt": null,
      "visual_goal": "Lead with contrast",
      "layout": "hook"
    }
  ]
}
\`\`\``);

  assert.equal(parsed.caption, "Caption body");
  assert.equal(parsed.slides[0].role, "hook");
  assert.equal(parsed.hashtags[1], "#two");
});

test("fallback planner returns social package shape without external API", () => {
  const result = fallbackPlanSocialPackage({ brand, request });
  assert.equal(result.hooks.length >= 3, true);
  assert.equal(result.slides.length, 8);
  assert.match(result.caption, /Peppera/i);
  assert.match(result.slides[1].image_prompt ?? "", /green pepper mascot/i);
  assert.match(result.slides[5].image_prompt ?? "", /green pepper mascot/i);
});

test("food-led visual mode keeps mascot out of food reveal prompts", () => {
  const result = fallbackPlanSocialPackage({
    brand,
    request: {
      ...request,
      visualMode: "food-led"
    }
  });

  assert.doesNotMatch(result.slides[5].image_prompt ?? "", /green pepper mascot/i);
  assert.doesNotMatch(result.slides[6].image_prompt ?? "", /green pepper mascot/i);
});
