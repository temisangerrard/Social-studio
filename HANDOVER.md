# Social Studio — Handover Notes

**Live:** https://social-studio.fly.dev  
**Repo:** https://github.com/temisangerrard/Social-studio  
**Stack:** Node.js + TypeScript · Vanilla JS · Fly.io · fal.ai · GLM-4.5

---

## What it is

Multi-brand content generation platform. Turns a rough idea into a social media package — carousel images, UGC video scripts, captions, hashtags, hooks — for Peppera, Settley, AutoBett, EchoCart, TemisanGerrard. The canvas is a Figma-style infinite workspace where every generated asset is a draggable, expandable, downloadable node.

---

## Running locally

```bash
cd peppera-slideshow-factory
npm install
npx playwright install chromium
cp .env.example .env   # add keys
npm run server         # starts on :3000
npm test               # 75 tests
npm run typecheck
```

**Required env vars:**

| Key | Purpose |
|---|---|
| `FAL_KEY` | All image + video generation via fal.ai (covers GPT Image 2 too) |
| `GLM_API_KEY` | Content planning + creative briefs (Zhipu GLM-4.5) |
| `GLM_API_URL` | GLM endpoint URL |
| `GLM_MODEL` | Model override (default: `glm-4.5`) |
| `ELEVENLABS_API_KEY` | UGC voiceover generation |

GPT Image 2 (`fal-ai/gpt-image-1`) routes through `FAL_KEY` — no OpenAI key needed.

---

## Architecture

```
src/                        Backend (TypeScript, Node.js)
  server.ts                 HTTP server + every API route
  pipeline.ts               Core generation orchestrator
  planner.ts                GLM-powered slide/content planning
  image-generator.ts        fal.ai generation + GPT Image 2 fallback chain
  fal-media.ts              fal.ai async queue client (image + video)
  creative-system.ts        Creative brief engine (directions, storyboard, GLM)
  creative-director.ts      Style card → slide narrative
  style-library.ts          Built-in style presets
  routing.ts                Content recipe router
  workflow-engine.ts        WorkflowType → generation recipe
  ugc.ts                    UGC package: voiceover + video stitching
  renderer.ts               Playwright HTML → PNG
  storage.ts                Filesystem persistence
  types.ts                  All TypeScript types
  templates/                HTML slide templates (hook, recipe, CTA...)
  contentPacks/pantryToPlate/  Pantry-to-Plate template pack

public/                     Frontend (Vanilla JS ES modules)
  app.js                    Main orchestrator — bootstrap, event wiring
  canvas-engine.js          Infinite canvas: drag, zoom, artboards, persistence
  inspector.js              Asset lightbox + zoom/pan + nav + outputAssets helper
  generation.js             Generation pipeline client + caption bar
  library-view.js           Library grid + loadOutputIntoCanvas
  ugc.js                    UGC tab: draft script, generate, canvas load
  creative-brief.js         Creative Director: build / refine / approve
  css/index.css             Root @import — every CSS module loaded here
  css/canvas.css            Canvas, artboards, grid, overlays, action bar
  css/inspector.css         Inspector: permanently display:none
  css/modals.css            Asset lightbox + all other dialogs

config/brands/              Brand JSON files — baked into Docker image, survives deploys
workspace/                  Runtime data — ephemeral, wiped on every Fly.io deploy
  outputs/{postId}/         Generated assets + metadata.json
  brands/                   User-overridden brand profiles (lost on redeploy)
  uploads/                  Uploaded reference images (lost on redeploy)
```

**Critical:** Browser loads `public/css/index.css` via `@import`. `public/app.css` is **never loaded** — it is a dead file. All CSS changes must go in `public/css/`.

---

## The Canvas

- **Dark background** `#1c1c1c`, two-tier dot grid that scales with zoom/pan
- Artboards are **independent free nodes** — drag anywhere, positions saved to `localStorage`
- **Drag:** mousedown + move on any artboard (images have `pointer-events:none` — div handles events)
- **Zoom:** scroll wheel or pinch · **Pan:** drag the dark background
- **Double-click artboard** → full-screen lightbox viewer
- **Hover artboard** → action bar (Expand · Download · Edit · Duplicate · Delete)
- **Caption bar** above toolbar: caption copy · hashtag copy · Post to Instagram · Post to TikTok

Position storage key: `canvas-state-v2-{postId}` in `localStorage`.  
Shape: `{ zoom, panX, panY, artboardPositions: [{ id, x, y, order }] }`.  
Clear: `localStorage.removeItem("canvas-state-v2-{postId}")` then reload.

---

## Generation Flows

### Studio
1. Enter idea + select brand/style/platform → **Generate**
2. First click: `POST /api/creative/brief` (GLM, 5–30s) → drawer opens with storyboard + image prompts + caption draft
3. Approve → `POST /api/generate` fires
4. Poll `GET /api/jobs/{jobId}` → artboards land on canvas when `status=done`

### UGC Tab
1. Enter angle/idea/notes → **Draft Script** (`POST /api/ugc/draft`)
2. Review beat sheet, hook, problem/outcome/CTA
3. Select voice + visual mode → **Generate UGC Video** (`POST /api/ugc/generate`)
4. Auto-loads storyboard PNG + video on canvas

### Quick Generate (agent/Hermes)
```bash
curl -X POST https://social-studio.fly.dev/api/generate/quick \
  -H 'Content-Type: application/json' \
  -d '{"brand":"peppera","idea":"5 easy Sunday dishes","platform":"instagram"}'
# → { jobId, status }
# Poll: GET /api/jobs/{jobId} until status="done" → result.post_id
```
`brand` is **required** — no silent default.

### WorkflowTypes

| Type | Output |
|---|---|
| `slideshow` | N image slides (brand imageModel via fal) |
| `linkedin-carousel` | LinkedIn-format image slides |
| `linkedin-text` | Caption + hashtags only, no images |
| `mascot-variants` | N mascot variant images |
| `reference-edit` | Single edited/refined image |
| `video-clip` | Single video clip (Kling or Pixverse) |
| `reel-package` | 3 video clips + voiceover (ElevenLabs) |
| `ugc-voiceover` | Storyboard grid PNG + stitched MP4 + voiceover |

---

## Image Generation Chain

```
pipeline.ts resolves WorkflowType + StyleCard
  ↓
image-generator.ts: for each slide with image_prompt
  1. Try: fal.ai primary model (brand.providers.imageModel)
  2. On failure → retry with fal-ai/gpt-image-1 (GPT Image 2)
  3. On failure → write mock SVG placeholder
  ↓
Stored: /app/workspace/outputs/{postId}/assets/generated/{filename}
Served: GET /api/assets/{postId}/{filename}
```

**To use GPT Image 2 for a brand:** Set `"imageModel": "fal-ai/gpt-image-1"` in brand `providers`. No other changes needed — `FAL_KEY` covers it.

**To add a new fal.ai model:** In `src/image-generator.ts`, add a detection branch in `generateWithFal()`:
```typescript
const isYourModel = model.includes("your-model-name");
if (isYourModel) {
  input = { prompt, your_param: "value" };
}
```

**Current imageModel per brand:** `peppera` → `fal-ai/flux-pro/v1.1` · all others → `fal-ai/flux/schnell`

---

## Full API Reference

### Brands
```
GET    /api/brands
GET    /api/brands/:id
POST   /api/brands                         { id, name, description, tone, visual, ... }
POST   /api/brands/:id/mascot-upload       { filename, dataUrl }
DELETE /api/brands/:id/mascot-refs/:index
```

### Generation
```
POST /api/generate              full generation (all workflow types + style control)
POST /api/generate/quick        { brand*, idea*, platform?, visualMode? }
GET  /api/jobs                  list all jobs (?status=pending|running|done|failed)
GET  /api/jobs/:jobId           poll → { status, stage, result } when done
```

### Outputs
```
GET    /api/outputs                              library list
GET    /api/outputs/:postId                      full metadata + artifacts + slides
GET    /api/outputs/:postId/text                 caption + hooks + hashtags
PATCH  /api/outputs/:postId                      update caption/hooks/hashtags
DELETE /api/outputs/:postId                      delete + remove all assets from disk
POST   /api/outputs/:postId/slides/:n/regenerate regenerate single slide image
GET    /api/outputs/:postId/export/pdf           Playwright carousel PDF
GET    /api/outputs/:postId/export/zip           platform-sized ZIP
GET    /api/outputs/:postId/export/package       full UGC package ZIP
GET    /api/outputs/:postId/routing-trace        inspect routing decision
```

### Assets
```
GET /api/assets/:postId/:filename    generated image or video
GET /api/slides/:postId/:filename    Playwright-rendered slide PNG
GET /api/uploads/:filename           uploaded reference image
GET /api/brand-assets/:brandId/:n    mascot reference image
```

### Creative Brief
```
POST /api/creative/brief                  { brandProfileId, platform, rawIntent } → plan (GLM, 5-30s)
GET  /api/creative/projects/:id           saved creative project
POST /api/creative/projects/:id/refine    { feedback } → refined plan
```

### Styles
```
GET    /api/styles
POST   /api/styles
GET    /api/styles/:id
DELETE /api/styles/:id
POST   /api/styles/from-references   { analyses, name, intent } → style from reference images
POST   /api/styles/match             { idea, brandProfileId } → best matching styleCardId
POST   /api/styles/preview-plan      preview what a style card will generate
```

Built-in IDs: `editorial-cultural-carousel` · `bold-monochrome-manifesto` · `founder-profile-spotlight` · `magazine-info-slide` · `portrait-quote-card` · `event-explainer-carousel` · `ugc-faceless-story` · `ugc-voiceover-story` · `pantry-to-plate`

### Pantry-to-Plate
```
POST /api/pantry/idea          { brand, idea, platform }          → template suggestion + ingredients
POST /api/pantry/brief         { brand, idea, recipes?, platform } → full creative brief
POST /api/pantry/render-plan   { brand, idea, assets?, caption? } → render-ready slide JSON
```

### UGC
```
POST /api/ugc/draft     { brandProfileId, platform, idea, notes } → script draft
POST /api/ugc/generate  { brandProfileId, platform, voiceId, script } → UGC package
GET  /api/voices        ElevenLabs voices
```

### Uploads
```
GET    /api/uploads              list uploaded assets
POST   /api/uploads              { filename, dataUrl } → upload
DELETE /api/uploads              { id } → remove
POST   /api/uploads/analyze      { assetId } → AI type analysis
```

### Calendar + Pillars
```
GET/POST /api/calendar · DELETE /api/calendar/:slotId · POST /api/calendar/batch-generate
GET/POST /api/pillars · DELETE /api/pillars/:id
```

### System
```
GET  /api/health               status + brands + capabilities
GET  /api/openapi.json         OpenAPI 3.0 spec
GET  /api/storage/usage        disk usage
GET  /api/admin/routing-tree   static routing tree
POST /api/routes/preview       preview routing decision for a request
```

---

## The Lightbox Viewer

`openAssetPreview(url, title, kind, artboards, startIndex)` in `public/inspector.js`.

**Images:** wheel zoom (0.5×–8×), click-drag to pan, double-click stage = reset, ← → = prev/next.  
**Videos:** native player, autoplay on load, pauses on navigate, zoom/pan disabled.

**To extend** (e.g. "Copy prompt" button):
1. Add `<button>` to `#asset-lightbox-topbar` in `index.html`
2. Wire handler in `initAssetModalListeners()` in `public/inspector.js`
3. Current descriptor: `_lbBoards[_lbIdx]` → `{ id, label, type, assetUrl, prompt, role, slideNumber }`

---

## Adding a New Template Pack

Reference: `src/contentPacks/pantryToPlate/`

**Five required files:**
```
src/contentPacks/yourPack/
  brandDefaults.ts   getBrandDefaults(brandId) → { tone, imageStyle, colorPalette, ctaOptions, hashtags, negativeConstraints }
  captionRules.ts    getCaptionRules(templateId) → { captionOpeners, hookOptions, avoidPhrases, hashtagCount }
  layouts.ts         getTemplateLayout(templateId) → { slides: [{ role, layout, type, textFields, imagePromptTemplate }] }
  prompts.ts         buildImagePrompts(templateId, inputs, brand) → ImagePromptSpec[]
  templates.ts       → exports: generateIdea, generateCreativeBrief, generateImagePrompts, generateRenderPlan
```

**Wire API route in `src/server.ts`:**
```typescript
if (url.pathname === "/api/yourpack/idea" && req.method === "POST") {
  const { generateIdea } = await import("./contentPacks/yourPack/templates.ts");
  const body = await parseJsonBody(req);
  if (!body.brand || !body.idea) return json({ error: "brand and idea required" }, { status: 400 });
  return json(generateIdea({ rawText: body.idea as string, brandId: body.brand as string, platform: "instagram" }));
}
```

**Add StyleCard to `src/style-library.ts`** — appears in Styles picker automatically.

**Add contentRecipes to brand JSON** — routing auto-selects for matching intent:
```json
{ "id": "your-template", "routeFamily": "recipe", "workflowType": "slideshow",
  "defaultPriority": 115, "visualStyleHint": "your-style-card-id" }
```

Higher `defaultPriority` = selected first. Current Peppera priorities: `fridge_to_dinner` 115, `waste_less_cook_more` 110, `what_can_i_make` 105, `recipe-carousel` 100.

---

## Brand Profiles

`config/brands/{id}.json` — baked into Docker image.  
`workspace/brands/{id}.json` — user overrides, **wiped on redeploy**.

**To add a brand:** `POST /api/brands` with the full profile JSON, or add file to `config/brands/`.  
**To change image model:** Set `providers.imageModel` — any fal.ai model ID.

```json
{
  "id": "peppera",
  "providers": { "plannerModel": "glm-4.5", "imageModel": "fal-ai/flux-pro/v1.1" },
  "visual": { "primaryColor": "#893516", "secondaryColor": "#FFDBC9", ... },
  "mascot": { "name": "Peppera", "visualPrompt": "...", "referenceImages": ["..."] },
  "contentRecipes": [ ... ],
  "defaultStyleCardId": "editorial-cultural-carousel"
}
```

---

## Deployment

```bash
flyctl deploy --remote-only --strategy immediate   # deploy from current local branch
flyctl secrets set KEY=value --app social-studio   # add/update env var
flyctl logs --app social-studio                    # live logs
flyctl releases --app social-studio                # deployment history
```

**Storage is ephemeral.** Every deploy wipes `/app/workspace/`. Only `config/brands/` (baked into image) survives. For persistence: mount a Fly.io volume or move outputs to R2/S3.

**CI/CD:** GitHub Actions → typecheck + 75 tests must pass before merge. Workflow: `.github/workflows/deploy.yml`.

---

## Open PRs

| PR | Branch | Status |
|---|---|---|
| #47 | feat/lightbox-caption-bar | Open, CI ✅ — lightbox, caption bar, dark canvas, Codex P2 fix |
| #45 | fix/canvas-image-display | Open — older work, verify before merging |

---

## Extension Points

| What | How |
|---|---|
| **Persistent outputs** | Mount Fly.io volume or move `OUTPUTS_ROOT` to Cloudflare R2 / S3 |
| **Direct TikTok/IG publish** | TikTok Content Posting API · Instagram Graph API |
| **New image model** | Branch in `generateWithFal()` in `image-generator.ts` + set `imageModel` in brand JSON |
| **New template pack** | Follow `src/contentPacks/pantryToPlate/` — 5 files + API route + StyleCard |
| **New brand** | `POST /api/brands` or add JSON to `config/brands/` |
| **Multi-select on canvas** | Extend `SelectionManager` to track `Set<string>` of selected IDs |
| **Resize artboards** | Add corner handle elements + `ResizeStateMachine` state in `canvas-engine.js` |
| **Credit guard** | Wrap `POST /api/generate` call in `generation.js` with cost estimate confirm dialog |
| **Per-slide regenerate from action bar** | Wire Regenerate button → `POST /api/outputs/:postId/slides/:n/regenerate` |
| **Analytics** | Fire events on generate / expand / download / copy (PostHog, Plausible) |
| **Settley / AutoBett packs** | Add brand-specific template packs — same pattern as pantryToPlate |
