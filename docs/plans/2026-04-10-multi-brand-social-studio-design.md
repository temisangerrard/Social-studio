# Multi-Brand Social Studio Design

**Date:** 2026-04-10

## Goal

Turn the current Peppera-only slideshow generator into a multi-brand social content studio with a canvas-first frontend. A user should be able to arrive with a rough idea, arrange supporting thoughts visually, select a brand profile, and generate a complete phase-1 social package using GLM for planning and fal.ai for visuals.

## Product Shape

The product is a browser-based workspace served by the existing Node application. It supports multiple products through reusable brand profiles. The primary UX is a canvas board where idea fragments can be created, positioned, resized, grouped, and then converted into a structured generation request.

Phase-1 outputs:

- branded vertical slide deck images
- captions
- hook/title variants
- image prompts and generated visual assets
- hashtags
- platform metadata
- reusable brand profile association

Phase-1 excludes direct short-form video rendering, voiceover generation, and subtitle timelines.

## Architecture

The application stays in one TypeScript codebase and evolves the existing pipeline instead of replacing it.

Major layers:

- **Frontend workspace:** canvas-first interface for idea capture, layout, and generation review.
- **Brand profiles:** reusable JSON-backed product configuration including tone, audience defaults, CTA, colors, logo, and provider preferences.
- **Intake normalization:** converts the freeform canvas state into a strict generation request schema.
- **GLM planner:** transforms the normalized request into structured content outputs.
- **fal.ai asset generation:** creates visuals for slides or fallback placeholders when visual generation fails.
- **Renderer/exporter:** renders branded slide assets and writes a complete output package.
- **Job API:** async generation endpoints with status polling and output listing.

## Interaction Model

Main frontend surfaces:

- **Brand Switcher:** choose or create a profile for any product.
- **Canvas Board:** draggable and resizable idea cards arranged spatially.
- **Prompt Dock:** raw idea capture and quick expansion tools.
- **Generation Panel:** platform selection, asset preferences, and override controls.
- **Results Workspace:** generated slides, captions, prompts, hashtags, and metadata.
- **History Rail:** recent runs by brand.

Workflow:

1. Select a brand profile.
2. Enter a rough idea and optional notes/assets.
3. Expand and arrange idea cards on the canvas.
4. Submit the board state for generation.
5. Track progress through planning, visual generation, and rendering.
6. Review outputs and selectively regenerate parts.

## Data Model

New persisted entities:

- `config/brands/*.json` for reusable brand profiles
- `workspace/boards/*.json` for saved board state
- `outputs/<run-id>/` for generation artifacts and metadata

Key request model:

- `brandProfileId`
- `rawIdea`
- `platformTargets`
- `cards`
- `notes`
- `references`
- `generationOptions`

Each card stores:

- id
- type
- text
- x/y position
- width/height
- optional tags/group

## Generation Flow

1. **Normalize**
   Convert canvas content into a structured request with fields like idea, audience angle, proof points, CTA, and visual direction.

2. **Plan with GLM**
   Send the normalized request plus the selected brand profile to GLM and require structured JSON output.

3. **Generate visuals with fal.ai**
   Generate images only for slides/assets that need them.

4. **Render and package**
   Render branded slides, save generated copy, write metadata, and expose the run through the UI.

## Failure Handling

- GLM failures should return explicit planning-stage errors and preserve request context in run metadata.
- fal.ai failures should degrade to branded placeholders where possible so copy-first outputs still complete.
- Frontend status must show stage-by-stage progress.

## Testing Strategy

- schema tests for brand profiles and board payloads
- planner output parsing tests for GLM structured responses
- provider normalization tests for fal.ai responses
- API tests for job creation, polling, listing, and saved board/profile flows
- renderer smoke tests for generated slide exports
- frontend interaction tests for canvas editing and generation submission

## Recommended Build Strategy

Extend the existing repo in place. The current code already has a usable orchestration layer, renderer, and server. The right move is to generalize the types and pipeline around brand-aware generation rather than start from scratch.
