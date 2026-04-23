# Creative Director Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a reusable backend creative operating system that turns sparse user intent into strategy, blueprints, production assets, variants, critique, refinement, and memory.

**Architecture:** Add a typed creative-system module beside the existing planner. It accepts product/brand context, creates structured creative plans, persists selected direction memory, and exposes backend endpoints for briefing and refinement. Existing generation can consume the creative plan without collapsing strategy, script, visuals, captions, and production instructions into one copy block.

**Tech Stack:** TypeScript, Node test runner, JSON file storage, existing GLM-compatible provider conventions.

---

### Task 1: Creative System Types

**Files:**
- Modify: `src/types.ts`
- Test: `src/creative-system.test.ts`

**Steps:**
1. Add top-level schemas for `CreativeSystemOutput`, `CreativeDirection`, `ContentBlueprint`, `ProductionAssets`, `CreativeVariant`, `CreativeReviewFlag`, and `CreativeProjectMemory`.
2. Add optional product profile context fields to `BrandProfile`: category, value proposition, platform personality, tone range, content pillars, banned phrases, preferred themes, good examples, bad examples.
3. Write failing tests asserting sparse input returns the required structured top-level keys and at least three directions.
4. Implement minimal deterministic generation.

### Task 2: Creative Engine

**Files:**
- Create: `src/creative-system.ts`
- Test: `src/creative-system.test.ts`

**Steps:**
1. Implement `interpretCreativeIntent` for sparse product/platform/format/tone inference.
2. Implement `generateCreativeDirections` with performance scores and format/platform fit.
3. Implement `buildContentBlueprint` and `buildProductionAssets` with format-specific behavior for UGC, carousel, thought leadership, image-led, meme, trailer, slideshow, explainer, ad, and insight card.
4. Implement anti-generic review flags and self-correction helpers.
5. Implement `refineCreativeProject` that updates the correct layer while preserving chosen direction memory.

### Task 3: Persistence + API

**Files:**
- Modify: `src/storage.ts`
- Modify: `src/server.ts`
- Test: `src/server.test.ts`

**Steps:**
1. Add JSON storage for creative projects under `workspace/creative-projects`.
2. Add `POST /api/creative/brief`.
3. Add `GET /api/creative/projects/:id`.
4. Add `POST /api/creative/projects/:id/refine`.
5. Add delete-upload regression test for `/api/uploads`.

### Task 4: Planner Integration

**Files:**
- Modify: `src/planner.ts`
- Modify: `src/ugc.ts`
- Modify: `src/pipeline.ts`
- Test: `src/pipeline.test.ts`, `src/ugc.test.ts`

**Steps:**
1. Allow generation requests to carry `creativeProjectId` or a `creativePlan`.
2. Use creative blueprint fields to seed hooks, captions, slide plans, image prompts, shot lists, and UGC scripts.
3. Preserve existing fallback behavior when no creative plan is supplied.

### Task 5: Verification

**Commands:**
- `node --import tsx --test src/creative-system.test.ts src/server.test.ts src/ugc.test.ts`
- `npm run typecheck`
- `npm test`
