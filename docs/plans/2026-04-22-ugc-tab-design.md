# UGC Tab Design

**Goal**

Split UGC out of the shared Studio workflow into a dedicated top-level workspace so UGC scripting, voice, and video generation no longer depend on the slideshow/editorial route-preview and style-selection state machine.

**Context**

Today, UGC is embedded inside `Studio` through UGC style presets and a conditional brief panel. Even after fixing style routing precedence, the UGC path still shares toolbar controls, route preview, workflow state, and generation orchestration with non-UGC creation. That coupling creates product confusion and makes UGC behavior sensitive to code paths that should not apply.

**Decision**

Create a separate `UGC` top-level tab with:

- its own view and navigation entry
- its own frontend state object and controller module
- its own request builders and backend endpoints
- its own script-draft and video-generation flow

The `Studio` tab remains for slideshow/editorial/reference work only. UGC presets are removed from the `Studio` style picker so users cannot enter UGC through the legacy path.

**Architecture**

The split happens at both the UI and request layers.

- `Studio` keeps the existing canvas-first generation model.
- `UGC` becomes a form-first workflow that drafts a script, lets the user edit/approve it, then generates audio/video.
- Brand context remains shared and reusable.
- Routing, style-preview, route-preview, and legacy workflow overrides do not participate in UGC generation.

**UGC Workspace**

The `UGC` tab should contain:

- brand selector
- platform selector
- idea / angle input
- optional product details or notes
- optional uploaded assets for inspiration or cutaways
- generated script fields
- generated shot list / beat list
- voice selection controls
- generate-video action
- recent output / status area

This is intentionally not the canvas toolbar. The UGC tab should feel like a dedicated production tool rather than a special mode hidden inside Studio.

**Backend Flow**

UGC should use dedicated endpoints:

- `POST /api/ugc/draft`
- `POST /api/ugc/generate`

`/api/ugc/draft` returns structured script data:

- hook
- problem
- product moment
- outcome
- cta
- tone notes
- full script
- scene beats / shot list
- on-screen text suggestions

`/api/ugc/generate` accepts the approved draft plus brand/platform/voice selections and produces UGC output metadata. It can reuse shared storage and asset utilities, but it should not call into the Studio route-preview workflow selection path.

**State Isolation**

Create a dedicated `ugcState` instead of piggybacking on `studioState`.

At minimum:

- selected brand
- selected platform
- draft status
- approved script data
- selected voice
- selected assets
- generation status
- recent output

This prevents Studio’s `workflowType`, `selectedStyleId`, `routePreview`, and `ugcBriefApproved` state from affecting UGC behavior.

**Frontend Boundaries**

Expected new modules:

- `public/ugc.js`
- `public/ugc-state.js`
- `public/ugc-dom-refs.js`

Expected shared modules to update:

- `public/index.html`
- `public/dom-refs.js`
- `public/app.js`

If practical, UGC-specific CSS should also move into a dedicated stylesheet block or file rather than relying on the current `ugc-brief` styles embedded in Studio.

**Studio Cleanup**

Studio should no longer expose UGC as a style option.

- remove UGC presets from the main style selector grouping
- remove the assumption that `selectedStyleId.startsWith("ugc-")` is a Studio concern
- leave existing non-UGC style routing intact

This is a product-level cleanup, not just a UI hide.

**Testing**

Add focused tests for:

- UGC view/request building remains isolated from Studio route preview
- manual Studio style selection still works after UGC removal
- Studio style picker no longer exposes UGC presets
- UGC draft/generate request builders produce the expected payloads

**Risks**

- Shared helper functions may still implicitly assume UGC lives in Studio.
- Existing output display code may be too Studio-shaped for UGC results.
- The current backend may already bake UGC assumptions into shared generation paths.

If those assumptions appear during implementation, prefer extracting shared primitives rather than reconnecting UGC to the Studio pipeline.
