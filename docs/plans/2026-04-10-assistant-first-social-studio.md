# Assistant-First Social Studio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild Social Studio into an assistant-first content workspace that interviews the user one question at a time, auto-loads latest product context, updates the workspace live, and generates content through interruptible checkpoints.

**Architecture:** Keep the current Node/TypeScript app, add product context resolvers and assistant session state on the backend, then replace the canvas-first frontend with an assistant-led interface that drives the existing generation pipeline in stages.

**Tech Stack:** Node.js, TypeScript, browser-native frontend, filesystem JSON persistence, GitHub connector, GLM planner, fal.ai image generation, Playwright renderer

---

### Task 1: Add product context and assistant session models

**Files:**
- Modify: `src/types.ts`
- Create: `src/context.ts`
- Modify: `src/storage.ts`
- Test: `src/storage.test.ts`

**Steps:**
1. Write failing tests for product context registry and assistant session persistence.
2. Run tests to verify failure.
3. Implement minimal session/context types and storage helpers.
4. Run tests until green.

### Task 2: Add latest-context resolution for the five products

**Files:**
- Create: `src/product-context.ts`
- Modify: `src/server.ts`
- Test: `src/context.test.ts`

**Steps:**
1. Write failing tests for repo-to-product mapping and fallback context resolution.
2. Run tests to verify failure.
3. Implement local-first, GitHub-fallback context loading.
4. Run tests until green.

### Task 3: Add assistant interview orchestration

**Files:**
- Create: `src/assistant.ts`
- Modify: `src/server.ts`
- Modify: `src/planner.ts`
- Test: `src/assistant.test.ts`

**Steps:**
1. Write failing tests for one-question-at-a-time interview flow and checkpoint progression.
2. Run tests to verify failure.
3. Implement minimal assistant state machine and API endpoints.
4. Run tests until green.

### Task 4: Rebuild the frontend shell around the assistant thread

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.css`
- Modify: `public/app.js`

**Steps:**
1. Replace the current rail-led layout with assistant-first composition.
2. Add single-input conversation thread and checkpoint UI.
3. Keep the canvas/workspace as a live artifact surface.
4. Verify the frontend still loads and events wire correctly.

### Task 5: Connect checkpoints to live workspace updates

**Files:**
- Modify: `public/app.js`
- Modify: `src/server.ts`
- Modify: `src/pipeline.ts`

**Steps:**
1. Add staged generation progress handling.
2. Reflect inferred brief fields and generated assets on the workspace.
3. Ensure generated assets land on the canvas, not only the results rail.
4. Verify end-to-end state transitions.

### Task 6: Update docs and verification

**Files:**
- Modify: `README.md`
- Test: `npm test`
- Test: `npm run typecheck`

**Steps:**
1. Document the assistant-first workflow and product context model.
2. Run tests and typecheck.
3. Fix remaining issues.
4. Summarize runtime limitations if local server execution cannot be verified in sandbox.
