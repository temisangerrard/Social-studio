# DESIGN.md — Social Studio

Design system for AI coding agents. Drop this in the project root and any AI tool understands how the UI should look.

---

## Brand

- **Name**: Social Studio
- **Wordmark font**: Newsreader (italic, serif)
- **Body font**: Manrope (sans-serif)
- **Voice**: Direct, builder-first, no-BS. Not corporate. Not startup-cute. Professional creative tool.

---

## Colors

| Token | Value | Usage |
|---|---|---|
| `--background` | `#faf9f4` | Page background — warm off-white |
| `--surface` | `#ffffff` | Cards, panels, inputs |
| `--surface-soft` | `#f4f4ee` | Muted surface for secondary areas |
| `--surface-muted` | `#edefe7` | Placeholder backgrounds |
| `--ink` | `#2f342d` | Primary text |
| `--muted` | `#5c6058` | Secondary text, labels |
| `--outline` | `#afb3aa` | Borders, dividers |
| `--brand` | `#5f5e5b` | Brand neutral |
| `--brand-strong` | `#43433e` | Headings, strong brand elements |
| `--highlight` | `#6f5c45` | Accent — warm brown, used for active states |
| `--accent` | `#fee4c6` | Warm highlight backgrounds |

### Shadows

```css
--shadow-soft: 0 4px 20px rgba(47, 52, 45, 0.04), 0 12px 40px rgba(47, 52, 45, 0.08);
--shadow-float: 0 18px 42px rgba(47, 52, 45, 0.12);
```

---

## Typography

| Element | Font | Size | Weight | Notes |
|---|---|---|---|---|
| Wordmark | Newsreader italic | 1.7rem | 400 | Serif, italic |
| Page heading | Newsreader | clamp(2.2rem, 4vw, 3.1rem) | 400 | Serif, line-height 0.95 |
| Section heading | Newsreader | 1.6–1.8rem | 400 | Serif |
| Eyebrow / label | Manrope | 0.68rem | 800 | Uppercase, letter-spacing 0.18em |
| Body text | Manrope | 0.82–0.92rem | 400 | line-height 1.5–1.6 |
| Button text | Manrope | 0.72–0.78rem | 700–800 | Uppercase, letter-spacing 0.08–0.18em |
| Small text | Manrope | 0.62–0.72rem | 600–800 | Labels, badges, metadata |

---

## Spacing

- **Base unit**: 4px
- **Component padding**: 12–18px
- **Card padding**: 18–22px
- **Section gap**: 16–24px
- **Page padding**: 24–32px
- **Topbar height**: 64px (56px on mobile)

---

## Border Radius

| Element | Radius |
|---|---|
| Buttons | 10–14px |
| Cards | 14–18px |
| Modals | 18–24px |
| Pills / badges | 999px |
| Inputs | 10–14px |
| Artboards | 12–14px |

---

## Components

### Primary Button
```css
padding: 10px 20px;
border-radius: 10px;
background: var(--brand-strong);
color: #faf7f2;
font-size: 0.78rem;
font-weight: 700;
letter-spacing: 0.08em;
text-transform: uppercase;
```

### Ghost Button
```css
border: 1px solid rgba(95, 94, 91, 0.16);
padding: 10px 12px;
border-radius: 12px;
background: rgba(255, 255, 255, 0.78);
color: var(--brand-strong);
font-size: 0.72rem;
font-weight: 800;
letter-spacing: 0.12em;
text-transform: uppercase;
```

### Card
```css
border-radius: 18px;
padding: 18px;
background: rgba(255, 255, 255, 0.86);
box-shadow: var(--shadow-soft);
```

### Input / Select
```css
border: 1px solid rgba(175, 179, 170, 0.35);
background: rgba(255, 255, 255, 0.84);
border-radius: 14px;
padding: 12px 14px;
color: var(--ink);
```

### Floating Toolbar
```css
position: fixed;
bottom: 24px;
left: 50%;
transform: translateX(-50%);
padding: 8px 12px;
background: rgba(255, 255, 255, 0.95);
backdrop-filter: blur(16px);
border-radius: 16px;
box-shadow: 0 8px 32px rgba(47, 52, 45, 0.12);
```

### Drawer (slide-from-left)
```css
position: fixed;
top: var(--topbar-h);
left: 0;
bottom: 0;
width: 320px;
background: rgba(250, 249, 244, 0.97);
backdrop-filter: blur(16px);
border-right: 1px solid rgba(175, 179, 170, 0.15);
box-shadow: 4px 0 24px rgba(47, 52, 45, 0.08);
```

### Inspector (floating right panel)
```css
position: fixed;
top: calc(var(--topbar-h) + 16px);
right: 16px;
bottom: 96px;
width: 340px;
background: rgba(250, 249, 244, 0.97);
backdrop-filter: blur(16px);
border: 1px solid rgba(175, 179, 170, 0.15);
border-radius: 18px;
box-shadow: 0 12px 48px rgba(47, 52, 45, 0.14);
```

---

## Layout

- **Studio view**: Full-viewport canvas with floating toolbar at bottom, drawer from left, inspector from right
- **Canvas**: Infinite pan/zoom with artboard-based layout. Dot grid background.
- **Calendar view**: 7-column grid, max-width 1200px centered
- **Library view**: 3-column card grid, max-width 1100px centered
- **Topbar**: Fixed, 64px, frosted glass effect (`backdrop-filter: blur(18px)`)

---

## Interaction Patterns

- **Hover**: Cards lift 3px with shadow upgrade
- **Selection**: 3px outline in `--highlight` with 2px offset
- **Loading**: Shimmer gradient animation on skeleton elements
- **Progress**: Floating pill at top-center of canvas with pulsing dot
- **Drag**: Scale 1.03, elevated shadow, 0.9 opacity
- **Transitions**: 150ms ease for most, 250ms cubic-bezier for panels

---

## Style-Controlled Creative Pipeline

The generation system uses structured style cards, not single prompts.

### Style Card Schema
Each visual preset is a `StyleCard` with:
- `imageStyle` — cinematic documentary editorial, high contrast B&W, etc.
- `layoutStyle` — minimal magazine carousel, oversized type poster, etc.
- `copyStyle` — curated cultural commentary, manifesto, biographical
- `visualTraits` — layout rules, typography, color mode, composition, tone
- `contentRules` — max words per slide, headline/body requirements, avoid list
- `negativeConstraints` — hard rules to prevent generic AI output

### Generation Flow
1. User selects brand + style preset + generation mode
2. Creative Director builds structured brief (visual angle, slide narrative, image brief, layout brief)
3. Structured prompts generated separately: image prompt, layout prompt, copy prompt, render spec
4. Preview plan shown before final render (optional approval step)
5. Assets generated with style-aware prompts and negative constraints

### Built-in Presets
- Editorial Cultural Carousel — premium editorial, serif-led, museum pacing
- Bold Monochrome Manifesto — B&W, oversized condensed type, poster-like
- Founder/Profile Spotlight — portrait-led, human-centered, warm
- Magazine Info Slide — data-driven, editorial infographic
- Portrait + Quote Card — elegant, centered quote, shareable
- Event Explainer Carousel — documentary, numbered steps, sequential

---

## Responsive Breakpoints

| Breakpoint | Behavior |
|---|---|
| > 1120px | Full layout — drawer + canvas + inspector |
| 641–1120px | Collapsed sidebar, stacked panels |
| ≤ 640px | Mobile — full-width toolbar wraps, drawer/inspector overlay, vertical artboard layout |

---

## File Structure

```
public/
  index.html          — Single-page app shell
  app.js              — Orchestrator, bootstrap, event wiring
  app.css             — All styles (single file)
  state.js            — Reactive state store
  dom-refs.js         — Cached DOM element references
  generation.js       — Generation pipeline (poll, merge, download)
  canvas-engine.js    — Infinite canvas with artboards
  inspector.js        — Right panel for asset details
  references.js       — Reference chips and route preview
  upload-manager.js   — Upload queue and asset management
  ui-utils.js         — Shared UI helpers
  calendar-view.js    — Calendar view logic
  library-view.js     — Library view logic
  brand-editor.js     — Brand config editor
  inline-editor.js    — Contenteditable inline editing

src/
  server.ts           — HTTP server and API routes
  pipeline.ts         — Generation orchestration
  planner.ts          — GLM planning integration
  creative-director.ts — Style-controlled creative direction engine
  style-library.ts    — Style card presets and resolution
  reference-ingestion.ts — Reference analysis → style card extraction
  image-generator.ts  — fal.ai image generation
  renderer.ts         — Playwright slide rendering
  storage.ts          — Filesystem persistence
  routing.ts          — Content routing decisions
  workflow-engine.ts  — Workflow type resolution
  assistant.ts        — Chat-based content intake
```
