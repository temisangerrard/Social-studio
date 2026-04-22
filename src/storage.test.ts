import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createStorage } from "./storage.ts";
import type { BoardDocument, BrandProfile } from "./types.ts";

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "social-studio-storage-"));
}

test("storage persists and lists brand profiles", async () => {
  const root = await makeTempDir();
  const storage = createStorage(root);

  const profile: BrandProfile = {
    id: "brand-peppera",
    name: "Peppera",
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
      platformTargets: ["tiktok", "instagram"],
      goal: "installs",
      hashtags: ["#mealideas", "#weeknightdinner"]
    },
    providers: {
      plannerModel: "glm-4.7",
      imageModel: "fal-ai/flux/schnell"
    }
  };

  await storage.saveBrandProfile(profile);

  const listed = await storage.listBrandProfiles();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, "brand-peppera");

  const loaded = await storage.getBrandProfile("brand-peppera");
  assert.equal(loaded?.name, "Peppera");
  assert.equal(loaded?.visual.primaryColor, "#f04d23");
});

test("storage persists boards with card layout data", async () => {
  const root = await makeTempDir();
  const storage = createStorage(root);

  const board: BoardDocument = {
    id: "board-01",
    brandProfileId: "brand-peppera",
    title: "Leftover dinner brainstorm",
    rawIdea: "Turn random fridge bits into posts",
    notes: "Focus on installs",
    cards: [
      {
        id: "card-1",
        type: "hook",
        text: "What can I cook with random ingredients?",
        x: 120,
        y: 80,
        width: 260,
        height: 180,
        tags: ["hook", "problem"]
      }
    ],
    references: [],
    updatedAt: "2026-04-10T10:00:00.000Z"
  };

  await storage.saveBoard(board);

  const listed = await storage.listBoards();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, "board-01");

  const loaded = await storage.getBoard("board-01");
  assert.equal(loaded?.cards[0].x, 120);
  assert.equal(loaded?.cards[0].height, 180);
});
