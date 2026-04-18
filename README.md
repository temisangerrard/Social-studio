# Social Studio

Social Studio is a multi-brand content generation and operations platform for running end-to-end organic marketing across all the products you are building.

The app turns rough prompts into brand-aware, platform-aware content packages for TikTok, Instagram, and LinkedIn. It supports content calendars, content pillars, batch generation, and agent-driven workflows through a comprehensive API.

## Product goal

Social Studio exists to help you run organic marketing as a system instead of a one-off creative task.

That means the app should help you:

- generate content for multiple products from one place
- tailor outputs to each brand's voice, positioning, and growth goals
- plan content calendars with pillars and weekly scheduling
- batch-generate an entire week of content in one action
- create ideas that are designed for reach, retention, and conversion
- turn rough prompts into publishable social packages quickly
- support repeatable content production without losing brand quality
- be fully operable by AI agents through the API

## Brands

The studio currently supports these brands:

- **Peppera** — AI meal engine with mascot-led content
- **AutoBett** — Onchain autonomous betting platform
- **Settley** — Tokenised real estate platform
- **EchoCart** — Voice-driven shopping agent
- **Temisan Gerrard** — Personal brand / AI consultant
- **Mira** — Autonomous GTM agent
- **Hermes Agent** — AI operations agent

## What the app does now

- supports multiple brands and product contexts
- runs an assistant-first workflow that collects missing information one question at a time
- builds a structured brief behind the scenes
- generates hooks, slide copy, captions, hashtags, and supporting assets
- packages outputs for TikTok, Instagram, and LinkedIn workflows
- content calendar with weekly planning and pillar-based scheduling
- batch generation for multiple calendar slots at once
- content pillars system for repeatable content themes
- keeps a live workspace so generation is visible while the package is being built
- stores brand configs, sessions, boards, calendar slots, and outputs on disk
- comprehensive API for agent-driven content operations

## Agent API

Social Studio exposes a full REST API designed for AI agent integration. See `/api/openapi.json` for the complete spec.

Key agent workflows:

1. **Quick generate**: `POST /api/generate/quick` — brand + idea + platform → job
2. **Calendar planning**: `POST /api/calendar` — schedule content ideas to dates
3. **Batch generate**: `POST /api/calendar/batch-generate` — generate all planned slots
4. **Content pillars**: `POST /api/pillars` — define repeatable content themes
5. **Poll results**: `GET /api/jobs/{jobId}` — check generation progress
6. **Get outputs**: `GET /api/outputs/{postId}/text` — retrieve captions, hooks, hashtags

## Current direction

The current app is aimed at workflows like:

- "Give me a Monday inspiration post for this brand"
- "Turn this product angle into a TikTok slideshow"
- "Create a viral hook set for a product launch"
- "Generate a complete social package for TikTok and Instagram"

The intended outcome is content that is not just aesthetically valid, but strategically useful for organic growth.

## What the app does now

- supports multiple brands and product contexts
- runs an assistant-first workflow that collects missing information one question at a time
- builds a structured brief behind the scenes
- generates hooks, slide copy, captions, hashtags, and supporting assets
- packages outputs for TikTok and Instagram workflows
- keeps a live workspace so generation is visible while the package is being built
- stores brand configs, sessions, boards, and outputs on disk

## Tech stack

This repository is a Node.js + TypeScript app with a browser-based frontend.

- `GLM` is used for planning, structured content generation, and strategy-oriented output shaping
- `fal.ai` is used for visual generation
- `Playwright` is used for rendering slide outputs
- filesystem storage is used for local persistence
- `tsx` is used for local execution

If provider credentials are missing, parts of the system fall back locally so the app can still be exercised without full production generation.

## Architecture

- `public/index.html` — primary web UI (Studio, Calendar, Library views)
- `public/app.js` — assistant/session/calendar frontend logic
- `public/app.css` — frontend styles
- `public/openapi.json` — OpenAPI 3.0 spec for agent integration
- `src/server.ts` — HTTP server and API routes
- `src/assistant.ts` — assistant-led content intake flow
- `src/planner.ts` — GLM planning integration and fallback behavior
- `src/pipeline.ts` — content generation orchestration
- `src/image-generator.ts` — fal.ai image generation flow
- `src/renderer.ts` — rendered output generation via Playwright
- `src/product-context.ts` — default product context loading
- `src/workflow-engine.ts` — workflow type routing and recipe building
- `src/storage.ts` — filesystem-backed persistence (brands, boards, sessions, calendar, pillars)
- `config/brands/` — per-brand configuration (7 brands)
- `workspace/` — working sessions, boards, calendar slots, pillars, and job state
- `outputs/` — generated deliverables

## Setup

Install dependencies:

```bash
npm install
```

Install Playwright Chromium:

```bash
npx playwright install chromium
```

Create your environment file:

```bash
cp .env.example .env
```

Add provider credentials:

```env
GLM_API_KEY=your-glm-api-key
GLM_API_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions
GLM_MODEL=glm-4.5-air
FAL_KEY=your-fal-api-key
FAL_MODEL=fal-ai/flux/schnell
```

## Running the app

Start the web app:

```bash
npm run server
```

If port `3000` is busy:

```bash
PORT=3001 npm run server
```

Then open the matching localhost URL in your browser.

## CLI generation

The CLI flow still works for direct generation runs:

```bash
npm run generate -- --brief ./examples/brief-peppera.json
```

## Testing

Run tests:

```bash
npm test
```

Run type checks:

```bash
npm run typecheck
```

## Standard for future work

The bar for this product is not "can it generate content."

The bar is:

- can it produce content that feels native to each brand
- can it help create organic growth loops for your products
- can it shape outputs for virality without drifting off-brand
- can it reduce the amount of manual editing needed before publishing
- can it become a reliable operating system for end-to-end organic marketing

That is the direction this repository is meant to support.
