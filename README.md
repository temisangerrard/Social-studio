# Social Studio

Social Studio is an assistant-first Node.js + TypeScript app for creating content across your products. The app loads the latest product context, interviews you one question at a time, builds a working brief in the background, and generates content through visible checkpoints while updating a live workspace.

## Default product context

The current build is wired around these products:

- Peppera from `temisangerrard/systemeats`
- Temisangerrard personal site from `temisangerrard/aos-studio`
- AutoBett from `temisangerrard/autonomous-arena-scaffold`
- EchoCart from `temisangerrard/echocart`
- Settley from `temisangerrard/settley-marketing`

The app is set up to treat those as the default context sources for assistant sessions.

## What the app does now

- starts with a single assistant-led input instead of a manual form flow
- asks one focused question at a time
- maintains assistant session state and inferred brief fields
- tracks checkpoints for strategy, hooks, visuals, and final package
- updates a live workspace as the assistant learns
- runs the existing generation pipeline for slides, captions, hashtags, and assets

## Current architecture

- `public/index.html` — assistant-first frontend entry point
- `public/app.css` — assistant/workspace styling
- `public/app.js` — session-driven interview flow and live workspace updates
- `src/server.ts` — API routes for brands, boards, assistant sessions, generation, and static serving
- `src/assistant.ts` — one-question-at-a-time assistant session logic
- `src/product-context.ts` — default product registry
- `src/storage.ts` — filesystem-backed storage for brands, boards, and assistant sessions
- `src/planner.ts` — GLM planner integration and deterministic fallback
- `src/pipeline.ts` — orchestration from request to packaged output
- `src/image-generator.ts` — fal.ai image generation with placeholder fallback
- `src/renderer.ts` — slide rendering via Playwright

## Setup

1. Install dependencies:

```bash
npm install
```

2. Install Playwright Chromium:

```bash
npx playwright install chromium
```

3. Copy the environment file:

```bash
cp .env.example .env
```

4. Add provider credentials if you want real planning and visual generation:

```env
GLM_API_KEY=your-glm-api-key
GLM_API_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions
GLM_MODEL=glm-4.5-air
FAL_KEY=your-fal-api-key
FAL_MODEL=fal-ai/flux/schnell
```

If `GLM_API_KEY` is missing, the planner falls back to deterministic local behavior. If `FAL_KEY` is missing, visual slots use placeholder SVGs.

## Running the app

Start the web app:

```bash
npm run server
```

If port `3000` is busy, run:

```bash
PORT=3001 npm run server
```

Then open the matching localhost URL.

## Legacy CLI flow

The original CLI brief flow still works:

```bash
npm run generate -- --brief ./examples/brief-peppera.json
```

## Testing

Run unit tests:

```bash
npm test
```

Run typecheck:

```bash
npm run typecheck
```

## Notes

- Persistence is filesystem-first in `config/brands`, `workspace/boards`, `workspace/sessions`, and `outputs`.
- The assistant-first UI is now the primary product direction.
- The generation pipeline still targets vertical social package outputs rather than full short-form video.
