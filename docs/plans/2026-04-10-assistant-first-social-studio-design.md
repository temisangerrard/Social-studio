# Assistant-First Social Studio Design

**Date:** 2026-04-10

## Goal

Redesign Social Studio so the default experience is a guided assistant that interviews the user one question at a time, silently loads the latest product context, builds a working brief in the background, and generates content through staged checkpoints without requiring the user to operate the canvas manually.

## Product Context Sources

The app should treat these repositories as default product context sources:

- `temisangerrard/systemeats` — Peppera
- `temisangerrard/aos-studio` — Temisangerrard personal site
- `temisangerrard/autonomous-arena-scaffold` — AutoBett
- `temisangerrard/echocart` — EchoCart
- `temisangerrard/settley-marketing` — Settley

On each new session, the app should always load the latest stable context from local workspace when available and GitHub otherwise. That context remains invisible by default.

## Core Experience

The app opens into a single assistant-led conversation surface with one primary input. The assistant asks one focused question at a time and continuously updates an internal working model of:

- product
- goal
- audience
- offer
- proof
- tone
- platform
- visual direction
- constraints

The assistant should:

- infer product from the user’s first message where possible
- ask clarifying questions only one at a time
- update the canvas automatically with extracted thoughts and inferred content blocks
- move into generation automatically once it has enough context
- continue through checkpoints unless the user interrupts

## Checkpoints

The assistant should move through these visible checkpoints:

1. Strategy summary
2. Hooks and angles
3. Visuals and slides
4. Final caption, hashtags, and metadata

Each checkpoint should surface progress in the UI, but the assistant should not pause for explicit approval unless interrupted.

## UI Shape

The current canvas-first shell becomes assistant-first.

Primary surfaces:

- **Assistant Thread** — the main conversation area with one primary input
- **Live Workspace** — a canvas-like artifact board that auto-populates from the interview and generation process
- **Checkpoint Rail** — progress and stage visibility
- **Generated Assets on Canvas** — visual outputs should appear directly on the workspace, not only in a side panel

The user should feel like they are directing an operator, not filling out a tool.

## Behavioral Model

The assistant acts as:

- interviewer
- strategist
- content planner
- asset coordinator
- packaging assistant

The app should feel like the central place the user comes to create content across products, not only slideshow posts.

## Data Model

New session state should include:

- selected/inferred product
- resolved product context source
- assistant thread messages
- current interview question
- inferred brief fields
- checkpoint states
- working canvas artifacts
- generated outputs and assets

## Backend Shape

The backend needs:

- product context resolvers for local and GitHub-backed sources
- session storage for conversation + checkpoint state
- staged generation orchestration
- APIs for starting/updating assistant sessions
- APIs for streaming or polling checkpoint progress

## Frontend Shape

The frontend should:

- prioritize the assistant conversation over forms
- keep a single prominent input
- show only the current question and recent thread
- update the workspace as the assistant learns
- attach generated assets to the workspace directly

## Recommended Implementation Strategy

Refactor in place:

1. Add product context resolution and assistant session models.
2. Replace the current page shell with an assistant-first layout.
3. Reuse the existing generation pipeline, but invoke it through staged checkpoints.
4. Keep the canvas logic, but make it assistant-driven instead of user-driven by default.
