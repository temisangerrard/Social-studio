# Multi-Brand Social Studio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a canvas-first, multi-brand frontend and backend that turns a rough idea into a social content package using GLM for planning and fal.ai for visuals.

**Architecture:** Keep the current Node/TypeScript app, generalize Peppera-specific pipeline assumptions into a brand-aware generation system, add async APIs for brands/boards/jobs, and serve a browser frontend from the same server. Use filesystem persistence for profiles, boards, and run outputs.

**Tech Stack:** Node.js, TypeScript, Playwright, browser-native frontend, filesystem JSON persistence, GLM API, fal.ai API

---

### Task 1: Generalize the domain model

**Files:**
- Modify: `src/types.ts`
- Modify: `src/pipeline.ts`
- Modify: `src/script-generator.ts`
- Test: `src/__tests__/pipeline.test.ts`

**Steps:**
1. Write failing tests for brand-aware request normalization and non-Peppera generation.
2. Run targeted tests and verify failure.
3. Introduce new request/profile/board types and adapt pipeline entrypoints.
4. Run tests until green.

### Task 2: Add filesystem stores for brands and boards

**Files:**
- Create: `src/storage.ts`
- Create: `config/brands/default-peppera.json`
- Modify: `src/server.ts`
- Test: `src/__tests__/storage.test.ts`

**Steps:**
1. Write failing tests for listing, reading, saving, and validating brands/boards.
2. Run targeted tests and verify failure.
3. Implement JSON-backed stores and API wiring.
4. Run tests until green.

### Task 3: Add GLM planner integration

**Files:**
- Create: `src/planner.ts`
- Modify: `src/pipeline.ts`
- Modify: `src/types.ts`
- Test: `src/__tests__/planner.test.ts`

**Steps:**
1. Write failing tests for planner prompt assembly and structured output parsing.
2. Run targeted tests and verify failure.
3. Implement GLM provider with mock fallback and strict JSON parsing.
4. Run tests until green.

### Task 4: Replace Nano Banana-specific generation with fal.ai-backed asset generation

**Files:**
- Modify: `src/image-generator.ts`
- Modify: `src/types.ts`
- Modify: `src/pipeline.ts`
- Test: `src/__tests__/image-generator.test.ts`

**Steps:**
1. Write failing tests for fal.ai response normalization and placeholder fallback.
2. Run targeted tests and verify failure.
3. Implement fal.ai provider support and update metadata.
4. Run tests until green.

### Task 5: Expand output packaging

**Files:**
- Modify: `src/caption-generator.ts`
- Modify: `src/renderer.ts`
- Modify: `src/pipeline.ts`
- Test: `src/__tests__/pipeline.test.ts`

**Steps:**
1. Write failing tests for hook variants, hashtags, metadata, and packaged outputs.
2. Run targeted tests and verify failure.
3. Update pipeline output writing and rendering.
4. Run tests until green.

### Task 6: Build frontend entrypoint and canvas workspace

**Files:**
- Create: `public/index.html`
- Create: `public/app.css`
- Create: `public/app.js`
- Modify: `src/server.ts`
- Test: `src/__tests__/server.test.ts`

**Steps:**
1. Write failing API and static-file tests for the intended frontend flow.
2. Run targeted tests and verify failure.
3. Implement the canvas-first UI, job polling, and result rendering.
4. Run tests until green.

### Task 7: Update docs and verify end-to-end behavior

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Test: `npm run typecheck`

**Steps:**
1. Document setup for GLM and fal.ai.
2. Run typecheck and targeted tests.
3. Fix remaining issues.
4. Summarize the resulting UX and operational requirements.
