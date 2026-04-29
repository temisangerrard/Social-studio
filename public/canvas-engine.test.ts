import assert from "node:assert/strict";
import test from "node:test";
import { TransformState, PointerStateMachine } from "./canvas-engine.js";

// ── Defaults ──────────────────────────────────────────────────────────────────

test("TransformState defaults to zoom=1, panX=0, panY=0", () => {
  const t = new TransformState();
  assert.equal(t.zoom, 1);
  assert.equal(t.panX, 0);
  assert.equal(t.panY, 0);
});

// ── toCSSTransform ────────────────────────────────────────────────────────────

test("toCSSTransform returns correct format at defaults", () => {
  const t = new TransformState();
  assert.equal(t.toCSSTransform(), "translate(0px, 0px) scale(1)");
});

test("toCSSTransform reflects current state", () => {
  const t = new TransformState();
  t.zoom = 0.85;
  t.panX = -120;
  t.panY = 40;
  assert.equal(t.toCSSTransform(), "translate(-120px, 40px) scale(0.85)");
});

// ── clampZoom ─────────────────────────────────────────────────────────────────

test("clampZoom constrains zoom to minimum 0.1", () => {
  const t = new TransformState();
  t.zoom = -5;
  t.clampZoom();
  assert.equal(t.zoom, 0.1);
});

test("clampZoom constrains zoom to maximum 5.0", () => {
  const t = new TransformState();
  t.zoom = 10;
  t.clampZoom();
  assert.equal(t.zoom, 5.0);
});

test("clampZoom leaves valid zoom unchanged", () => {
  const t = new TransformState();
  t.zoom = 1.5;
  t.clampZoom();
  assert.equal(t.zoom, 1.5);
});

// ── applyPan ──────────────────────────────────────────────────────────────────

test("applyPan adds delta to panX and panY", () => {
  const t = new TransformState();
  t.panX = 10;
  t.panY = 20;
  t.applyPan(5, -3);
  assert.equal(t.panX, 15);
  assert.equal(t.panY, 17);
});

// ── screenToCanvas / canvasToScreen ───────────────────────────────────────────

test("screenToCanvas converts correctly at default state", () => {
  const t = new TransformState();
  const pt = t.screenToCanvas(100, 200);
  assert.equal(pt.x, 100);
  assert.equal(pt.y, 200);
});

test("screenToCanvas accounts for pan and zoom", () => {
  const t = new TransformState();
  t.zoom = 2;
  t.panX = 50;
  t.panY = 100;
  // canvasX = (100 - 50) / 2 = 25
  // canvasY = (200 - 100) / 2 = 50
  const pt = t.screenToCanvas(100, 200);
  assert.equal(pt.x, 25);
  assert.equal(pt.y, 50);
});

test("canvasToScreen is the inverse of screenToCanvas", () => {
  const t = new TransformState();
  t.zoom = 1.5;
  t.panX = -30;
  t.panY = 60;

  const screen = { x: 200, y: 300 };
  const canvas = t.screenToCanvas(screen.x, screen.y);
  const back = t.canvasToScreen(canvas.x, canvas.y);

  assert.ok(Math.abs(back.x - screen.x) < 1e-9);
  assert.ok(Math.abs(back.y - screen.y) < 1e-9);
});

// ── applyWheelZoom ────────────────────────────────────────────────────────────

test("applyWheelZoom with negative delta zooms in", () => {
  const t = new TransformState();
  const oldZoom = t.zoom;
  t.applyWheelZoom(-1, 400, 300);
  assert.ok(t.zoom > oldZoom, "zoom should increase on negative delta");
});

test("applyWheelZoom with positive delta zooms out", () => {
  const t = new TransformState();
  const oldZoom = t.zoom;
  t.applyWheelZoom(1, 400, 300);
  assert.ok(t.zoom < oldZoom, "zoom should decrease on positive delta");
});

test("applyWheelZoom preserves the canvas point under cursor", () => {
  const t = new TransformState();
  t.zoom = 1.5;
  t.panX = -100;
  t.panY = 50;

  const cursorX = 400;
  const cursorY = 300;

  // Canvas point under cursor before zoom
  const before = t.screenToCanvas(cursorX, cursorY);

  t.applyWheelZoom(-1, cursorX, cursorY);

  // Canvas point under cursor after zoom
  const after = t.screenToCanvas(cursorX, cursorY);

  assert.ok(Math.abs(after.x - before.x) < 1e-9, `x: ${after.x} should equal ${before.x}`);
  assert.ok(Math.abs(after.y - before.y) < 1e-9, `y: ${after.y} should equal ${before.y}`);
});

test("applyWheelZoom clamps zoom to bounds", () => {
  const t = new TransformState();
  t.zoom = 5.0;
  t.applyWheelZoom(-1, 0, 0); // try to zoom in past max
  assert.equal(t.zoom, 5.0);
});

// ── applyPinchZoom ────────────────────────────────────────────────────────────

test("applyPinchZoom scales zoom by scaleDelta", () => {
  const t = new TransformState();
  t.zoom = 1.0;
  t.applyPinchZoom(1.5, 400, 300);
  assert.ok(Math.abs(t.zoom - 1.5) < 1e-9);
});

test("applyPinchZoom preserves the canvas point at midpoint", () => {
  const t = new TransformState();
  t.zoom = 0.8;
  t.panX = 50;
  t.panY = -30;

  const cx = 300;
  const cy = 250;

  const before = t.screenToCanvas(cx, cy);
  t.applyPinchZoom(1.2, cx, cy);
  const after = t.screenToCanvas(cx, cy);

  assert.ok(Math.abs(after.x - before.x) < 1e-9, `x: ${after.x} should equal ${before.x}`);
  assert.ok(Math.abs(after.y - before.y) < 1e-9, `y: ${after.y} should equal ${before.y}`);
});

test("applyPinchZoom clamps zoom to bounds", () => {
  const t = new TransformState();
  t.zoom = 2.5;
  t.applyPinchZoom(2.0, 0, 0); // 2.5 * 2.0 = 5.0, should clamp to 5.0
  assert.equal(t.zoom, 5.0);
});

// @ts-nocheck — canvas-engine.js is a vanilla JS module; TS types are not available
import { buildArtboardDescriptors, buildOverlayDescriptors, ArtboardManager, resolveAssetUrl } from "./canvas-engine.js";
import fc from "fast-check";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeOutput(slideCount = 3) {
  const slides = Array.from({ length: slideCount }, (_, i) => ({
    slide_number: i + 1,
    role: i === 0 ? "hook" : i === slideCount - 1 ? "cta" : "benefit",
    type: "generated_image",
    text: `Slide ${i + 1} text`,
    image_prompt: `prompt for slide ${i + 1}`,
    layout: "hook",
  }));

  return {
    post_id: "peppera_ig_0014",
    product: "Peppera",
    caption: "This is the caption",
    hooks: ["Hook one", "Hook two"],
    hashtags: ["#food", "#recipe"],
    slides,
    artifacts: [],
    render_status: "complete",
  };
}

function makeOutputWithArtifacts() {
  return {
    post_id: "peppera_ig_0015",
    product: "Peppera",
    caption: "Artifact caption",
    hooks: ["Art hook"],
    hashtags: ["#art"],
    slides: [],
    artifacts: [
      { id: "art-1", kind: "image", role: "hero", title: "Hero Image", prompt: "hero prompt", asset_path: "outputs/peppera_ig_0015/assets/generated/hero.jpg" },
      { id: "art-2", kind: "video", role: "clip", title: "Video Clip", prompt: "clip prompt", asset_path: "outputs/peppera_ig_0015/assets/generated/clip.mp4" },
    ],
    render_status: "complete",
  };
}

// ── buildArtboardDescriptors ──────────────────────────────────────────────────

test("buildArtboardDescriptors returns empty array for null input", () => {
  assert.deepEqual(buildArtboardDescriptors(null), []);
});

test("buildArtboardDescriptors returns empty array for output with no slides or artifacts", () => {
  assert.deepEqual(buildArtboardDescriptors({ slides: [], artifacts: [] }), []);
});

test("buildArtboardDescriptors creates one descriptor per slide", () => {
  const output = makeOutput(4);
  const descriptors = buildArtboardDescriptors(output);
  assert.equal(descriptors.length, 4);
});

test("buildArtboardDescriptors assigns correct labels", () => {
  const output = makeOutput(3);
  const descriptors = buildArtboardDescriptors(output);
  assert.equal(descriptors[0].label, "01 — Hook");
  assert.equal(descriptors[1].label, "02 — Benefit");
  assert.equal(descriptors[2].label, "03 — Cta");
});

test("buildArtboardDescriptors arranges in horizontal strip with 48px gaps", () => {
  const output = makeOutput(3);
  const descriptors = buildArtboardDescriptors(output);

  // First artboard at x=420
  assert.equal(descriptors[0].x, 420);
  assert.equal(descriptors[0].y, 80);

  // Second artboard at x = 420 + 540 + 48 = 1008
  assert.equal(descriptors[1].x, 1008);

  // Third artboard at x = 1008 + 540 + 48 = 1596
  assert.equal(descriptors[2].x, 1596);

  // All at same y
  assert.equal(descriptors[1].y, 80);
  assert.equal(descriptors[2].y, 80);
});

test("buildArtboardDescriptors sets correct dimensions", () => {
  const output = makeOutput(1);
  const desc = buildArtboardDescriptors(output)[0];
  assert.equal(desc.width, 540);
  assert.equal(desc.height, 540);
});

test("buildArtboardDescriptors resolves slide asset URLs", () => {
  const output = makeOutput(2);
  const descriptors = buildArtboardDescriptors(output);
  assert.equal(descriptors[0].assetUrl, "/api/slides/peppera_ig_0014/slide-01.png");
  assert.equal(descriptors[1].assetUrl, "/api/slides/peppera_ig_0014/slide-02.png");
});

test("buildArtboardDescriptors prefers artifacts over slides", () => {
  const output = makeOutputWithArtifacts();
  const descriptors = buildArtboardDescriptors(output);
  assert.equal(descriptors.length, 2);
  assert.equal(descriptors[0].id, "art-1");
  assert.equal(descriptors[0].type, "image");
  assert.equal(descriptors[1].id, "art-2");
  assert.equal(descriptors[1].type, "video");
});

test("buildArtboardDescriptors resolves artifact asset URLs", () => {
  const output = makeOutputWithArtifacts();
  const descriptors = buildArtboardDescriptors(output);
  assert.equal(descriptors[0].assetUrl, "/api/assets/peppera_ig_0015/hero.jpg");
  assert.equal(descriptors[1].assetUrl, "/api/assets/peppera_ig_0015/clip.mp4");
});

test("buildArtboardDescriptors preserves playable video and failed generation metadata", () => {
  const output = {
    post_id: "peppera_tt_0020",
    platform: "tiktok",
    slides: [],
    artifacts: [
      {
        id: "video-ok",
        kind: "video",
        role: "ugc-video",
        title: "Playable video",
        prompt: "final prompt",
        asset_path: "workspace/outputs/peppera_tt_0020/assets/generated/video-ok.mp4",
        provider: "fal",
        model: "bytedance/seedance-2.0/text-to-video",
        request_id: "req_123",
        status: "complete",
        payload: { prompt: "final prompt", generate_audio: true },
      },
      {
        id: "video-failed",
        kind: "video",
        role: "ugc-video",
        title: "Failed video",
        prompt: "failed prompt",
        asset_path: null,
        provider: "fal",
        model: "fal-ai/kling-video/v3/pro/text-to-video",
        status: "failed",
        error: "rate limited",
        payload: { prompt: "failed prompt" },
      },
    ],
    render_status: "skipped",
  };

  const descriptors = buildArtboardDescriptors(output);
  assert.equal(descriptors[0].type, "video");
  assert.equal(descriptors[0].assetUrl, "/api/assets/peppera_tt_0020/video-ok.mp4");
  assert.equal(descriptors[0].status, "complete");
  assert.equal(descriptors[0].provider, "fal");
  assert.deepEqual(descriptors[0].payload, { prompt: "final prompt", generate_audio: true });
  assert.equal(descriptors[1].type, "video");
  assert.equal(descriptors[1].assetUrl, null);
  assert.equal(descriptors[1].status, "failed");
  assert.match(descriptors[1].error, /rate limited/);
});

test("buildArtboardDescriptors falls back to rendered slide PNGs for artifact entries without asset paths", () => {
  const output = {
    post_id: "peppera_ig_0016",
    slides: [
      {
        slide_number: 1,
        role: "hook",
        type: "text_only",
        text: "Hook slide",
        image_prompt: null,
        asset_path: null,
      },
      {
        slide_number: 2,
        role: "recipe",
        type: "generated_image",
        text: "Recipe slide",
        image_prompt: "recipe prompt",
        asset_path: "outputs/peppera_ig_0016/assets/generated/slide-02.jpg",
      },
    ],
    artifacts: [
      {
        id: "artboard-01",
        slide_number: 1,
        kind: "image",
        role: "hook",
        title: "Hook slide",
        asset_path: null,
        preview_path: null,
      },
      {
        id: "artboard-02",
        slide_number: 2,
        kind: "image",
        role: "recipe",
        title: "Recipe slide",
        asset_path: "outputs/peppera_ig_0016/assets/generated/slide-02.jpg",
        preview_path: "outputs/peppera_ig_0016/assets/generated/slide-02.jpg",
      },
    ],
    render_status: "complete",
  };

  const descriptors = buildArtboardDescriptors(output);
  assert.equal(descriptors[0].assetUrl, "/api/slides/peppera_ig_0016/slide-01.png");
  assert.equal(descriptors[1].assetUrl, "/api/assets/peppera_ig_0016/slide-02.jpg");
});

test("buildArtboardDescriptors sets order and isVariant correctly", () => {
  const output = makeOutput(2);
  const descriptors = buildArtboardDescriptors(output);
  assert.equal(descriptors[0].order, 0);
  assert.equal(descriptors[1].order, 1);
  assert.equal(descriptors[0].isVariant, false);
  assert.equal(descriptors[0].originalId, null);
});

// ── buildOverlayDescriptors ───────────────────────────────────────────────────

test("buildOverlayDescriptors returns empty array for null input", () => {
  assert.deepEqual(buildOverlayDescriptors(null), []);
});

test("buildOverlayDescriptors creates caption + hooks + hashtags overlays", () => {
  const output = makeOutput(2);
  const overlays = buildOverlayDescriptors(output);
  // 1 caption + 2 hooks + 1 hashtags = 4
  assert.equal(overlays.length, 4);
  assert.equal(overlays[0].type, "caption");
  assert.equal(overlays[1].type, "hook");
  assert.equal(overlays[2].type, "hook");
  assert.equal(overlays[3].type, "hashtag");
});

test("buildOverlayDescriptors positions overlays in a column at x=60", () => {
  const output = makeOutput(1);
  const overlays = buildOverlayDescriptors(output);
  for (const o of overlays) {
    assert.equal(o.x, 60);
  }
});

test("buildOverlayDescriptors spaces overlays vertically with 20px gap", () => {
  const output = makeOutput(1);
  const overlays = buildOverlayDescriptors(output);
  // caption at y=80, hook at y=80+200+20=300, hashtags at y=300+200+20=520
  assert.equal(overlays[0].y, 80);
  assert.equal(overlays[1].y, 300);  // hook
  assert.equal(overlays[2].y, 520);  // hook 2
  assert.equal(overlays[3].y, 740);  // hashtags
});

test("buildOverlayDescriptors sets correct dimensions", () => {
  const output = makeOutput(1);
  const overlays = buildOverlayDescriptors(output);
  for (const o of overlays) {
    assert.equal(o.width, 320);
    assert.equal(o.height, 200);
  }
});

test("buildOverlayDescriptors joins hashtags with spaces", () => {
  const output = makeOutput(1);
  const overlays = buildOverlayDescriptors(output);
  const hashtagOverlay = overlays.find((o) => o.type === "hashtag");
  assert.equal(hashtagOverlay.text, "#food #recipe");
});

test("buildOverlayDescriptors skips missing sections", () => {
  const output = { caption: "", hooks: [], hashtags: [] };
  const overlays = buildOverlayDescriptors(output);
  assert.equal(overlays.length, 0);
});

test("buildOverlayDescriptors handles output with only caption", () => {
  const output = { caption: "Just a caption", hooks: [], hashtags: [] };
  const overlays = buildOverlayDescriptors(output);
  assert.equal(overlays.length, 1);
  assert.equal(overlays[0].type, "caption");
  assert.equal(overlays[0].text, "Just a caption");
});

// ── ArtboardManager ───────────────────────────────────────────────────────────

// Minimal DOM mock for node:test environment
function createMockContainer() {
  const children = [];
  const el = {
    _children: children,
    querySelectorAll(selector) {
      return children.filter((c) => {
        if (selector === ".canvas-artboard") return c.className?.includes("canvas-artboard") && !c.className?.includes("canvas-overlay");
        if (selector === ".canvas-overlay") return c.className?.includes("canvas-overlay");
        return false;
      });
    },
    appendChild(child) {
      children.push(child);
    },
  };
  return el;
}

function createMockElement(tag = "div") {
  const el = {
    tagName: tag.toUpperCase(),
    className: "",
    dataset: {},
    style: {},
    textContent: "",
    _children: [],
    _listeners: {},
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); el.className = [...this._classes].join(" "); },
      remove(c) { this._classes.delete(c); el.className = [...this._classes].join(" "); },
      contains(c) { return this._classes.has(c); },
    },
    querySelector(sel) {
      return el._children.find((c) => {
        if (sel === ".canvas-artboard__label") return c.className === "canvas-artboard__label";
        if (sel === ".canvas-artboard__badge") return c.className === "canvas-artboard__badge";
        return false;
      }) || null;
    },
    querySelectorAll(sel) {
      return el._children.filter((c) => {
        if (sel === ".canvas-artboard") return c.className?.includes("canvas-artboard") && !c.className?.includes("canvas-overlay");
        if (sel === ".canvas-overlay") return c.className?.includes("canvas-overlay");
        return false;
      });
    },
    appendChild(child) { el._children.push(child); },
    prepend(child) { el._children.unshift(child); },
    remove() { /* no-op in mock */ },
    setAttribute(k, v) { el[k] = v; },
    addEventListener(evt, fn) {
      if (!el._listeners[evt]) el._listeners[evt] = [];
      el._listeners[evt].push(fn);
    },
  };
  return el;
}

// Patch global document for ArtboardManager._createArtboardElement
const origDocument = globalThis.document;

test("ArtboardManager constructor accepts descriptors", () => {
  const mgr = new ArtboardManager([{ id: "a1" }], [{ id: "o1" }]);
  assert.equal(mgr.artboards.length, 1);
  assert.equal(mgr.overlays.length, 1);
});

test("ArtboardManager.reconcile does nothing with null container", () => {
  const mgr = new ArtboardManager([], []);
  // Should not throw
  mgr.reconcile(null);
});


// ── resolveAssetUrl unit tests (Task 4.1) ─────────────────────────────────────

test("resolveAssetUrl: artifact with asset_path + render_status skipped returns valid URL", () => {
  const output = { post_id: "peppera_ig_0020", render_status: "skipped" };
  const item = { asset_path: "/tmp/outputs/peppera_ig_0020/assets/generated/hero.jpg", slide_number: 1 };
  const url = resolveAssetUrl(output, item);
  assert.equal(url, "/api/assets/peppera_ig_0020/hero.jpg");
});

test("resolveAssetUrl: artifact with null asset_path + render_status skipped returns null", () => {
  const output = { post_id: "peppera_ig_0020", render_status: "skipped" };
  const item = { asset_path: null, slide_number: 1 };
  const url = resolveAssetUrl(output, item);
  assert.equal(url, null);
});

test("resolveAssetUrl: slide with slide_number + render_status complete returns /api/slides/ URL", () => {
  const output = { post_id: "peppera_ig_0020", render_status: "complete" };
  const item = { asset_path: null, slide_number: 3 };
  const url = resolveAssetUrl(output, item);
  assert.equal(url, "/api/slides/peppera_ig_0020/slide-03.png");
});

test("resolveAssetUrl: artifact with null asset_path cross-references slide asset_path", () => {
  const output = { post_id: "peppera_ig_0020", render_status: "skipped" };
  const item = { asset_path: null, slide_number: 2 };
  const slides = [
    { slide_number: 1, asset_path: "/tmp/outputs/slide-01.jpg" },
    { slide_number: 2, asset_path: "/tmp/outputs/slide-02.jpg" },
  ];
  const url = resolveAssetUrl(output, item, slides);
  assert.equal(url, "/api/assets/peppera_ig_0020/slide-02.jpg");
});

// ── buildArtboardDescriptors with render_status: "skipped" (Task 4.2) ─────────

test("buildArtboardDescriptors: skipped render — artifacts with asset_path have valid assetUrl", () => {
  const output = {
    post_id: "peppera_ig_0021",
    render_status: "skipped",
    slides: [
      { slide_number: 1, role: "hook", type: "text_only", text: "Hook text", asset_path: null },
      { slide_number: 2, role: "recipe", type: "generated_image", text: "Recipe", asset_path: "/tmp/recipe.jpg" },
    ],
    artifacts: [
      { id: "slide-01", kind: "image", role: "hook", title: "Hook text", asset_path: null, slide_number: 1 },
      { id: "slide-02", kind: "image", role: "recipe", title: "Recipe", asset_path: "/tmp/recipe.jpg", slide_number: 2 },
    ],
    caption: "Test",
    hooks: [],
    hashtags: [],
  };
  const descriptors = buildArtboardDescriptors(output);
  assert.equal(descriptors.length, 2);
  // Artifact with asset_path should have a valid URL
  assert.equal(descriptors[1].assetUrl, "/api/assets/peppera_ig_0021/recipe.jpg");
});

test("buildArtboardDescriptors: skipped render — text-only artifacts have assetUrl null (not error)", () => {
  const output = {
    post_id: "peppera_ig_0022",
    render_status: "skipped",
    slides: [
      { slide_number: 1, role: "hook", type: "text_only", text: "Hook text", asset_path: null },
    ],
    artifacts: [
      { id: "slide-01", kind: "image", role: "hook", title: "Hook text", asset_path: null, slide_number: 1 },
    ],
    caption: "Test",
    hooks: [],
    hashtags: [],
  };
  const descriptors = buildArtboardDescriptors(output);
  assert.equal(descriptors.length, 1);
  // Text-only artifact with no asset_path should have null assetUrl (graceful, not error)
  assert.equal(descriptors[0].assetUrl, null);
});

// ── Property-based preservation tests (Task 5) ───────────────────────────────

// **Validates: Requirements 3.1, 3.3**
// Property 3: For any artifact with a valid asset_path, resolveAssetUrl returns
// /api/assets/{postId}/{filename} preserving existing behavior.
test("[PBT: Property 3] resolveAssetUrl preserves /api/assets/ URL for artifacts with valid asset_path", () => {
  const postIdArb = fc.stringMatching(/^[a-z]{3,8}_[a-z]{2}_\d{4}$/);
  const filenameArb = fc.stringMatching(/^[a-z][a-z0-9_-]{0,20}\.(jpg|png|webp|svg)$/);
  const renderStatusArb = fc.constantFrom("complete", "skipped");

  fc.assert(
    fc.property(
      postIdArb,
      filenameArb,
      renderStatusArb,
      (postId, filename, renderStatus) => {
        const output = { post_id: postId, render_status: renderStatus };
        const item = { asset_path: `/some/path/to/${filename}`, slide_number: 1 };
        const url = resolveAssetUrl(output, item);
        assert.ok(url !== null, "URL should not be null for artifact with asset_path");
        assert.ok(url.startsWith("/api/assets/"), `URL should start with /api/assets/, got: ${url}`);
        assert.ok(url.endsWith(filename), `URL should end with filename "${filename}", got: ${url}`);
        assert.equal(url, `/api/assets/${postId}/${filename}`);
      }
    ),
    { numRuns: 200 }
  );
});

// **Validates: Requirements 3.2**
// Property 4: For slides with render_status "complete" and valid slide_number,
// resolveAssetUrl returns /api/slides/{postId}/slide-{nn}.png.
test("[PBT: Property 4] resolveAssetUrl preserves /api/slides/ URL for complete renders", () => {
  const postIdArb = fc.stringMatching(/^[a-z]{3,8}_[a-z]{2}_\d{4}$/);
  const slideNumberArb = fc.integer({ min: 1, max: 20 });

  fc.assert(
    fc.property(
      postIdArb,
      slideNumberArb,
      (postId, slideNumber) => {
        const output = { post_id: postId, render_status: "complete" };
        const item = { asset_path: null, slide_number: slideNumber };
        const url = resolveAssetUrl(output, item);
        const nn = String(slideNumber).padStart(2, "0");
        const expected = `/api/slides/${postId}/slide-${nn}.png`;
        assert.equal(url, expected, `Expected ${expected}, got ${url}`);
      }
    ),
    { numRuns: 200 }
  );
});

// ── PointerStateMachine touch vs mouse tests ──────────────────────────────────

test("PointerStateMachine uses panning for touch drags started on an artboard", () => {
  const stageEl = createMockElement("div");
  stageEl.setPointerCapture = () => {};

  const transformEl = createMockElement("div");
  const transform = new TransformState();
  const artboardManager = new ArtboardManager();
  const psm = new PointerStateMachine(stageEl, transformEl, transform, artboardManager);

  const artboard = createMockElement("div");
  artboard.classList.add("canvas-artboard");
  artboard.setPointerCapture = () => {};
  artboard.parentElement = stageEl;

  psm._onPointerDown({
    button: 0,
    pointerType: "touch",
    clientX: 120,
    clientY: 80,
    pointerId: 7,
    target: artboard,
  });

  assert.equal(psm.state, "panning");
  assert.equal(psm._dragTarget, null);
});

test("PointerStateMachine keeps artboard dragging for mouse drags started on an artboard", () => {
  const stageEl = createMockElement("div");
  stageEl.setPointerCapture = () => {};

  const transformEl = createMockElement("div");
  const transform = new TransformState();
  const artboardManager = new ArtboardManager();
  const psm = new PointerStateMachine(stageEl, transformEl, transform, artboardManager);

  const artboard = createMockElement("div");
  artboard.classList.add("canvas-artboard");
  artboard.style.left = "420px";
  artboard.style.top = "80px";
  artboard.setPointerCapture = () => {};
  artboard.parentElement = stageEl;

  psm._onPointerDown({
    button: 0,
    pointerType: "mouse",
    clientX: 120,
    clientY: 80,
    pointerId: 8,
    target: artboard,
  });

  assert.equal(psm.state, "dragging");
  assert.equal(psm._dragTarget, artboard);
});

test("CanvasEngine constructor initializes without reading transform before setup", async () => {
  const origDocumentRef = globalThis.document;
  const origRAF = globalThis.requestAnimationFrame;
  const origCAF = globalThis.cancelAnimationFrame;
  const origLocalStorage = globalThis.localStorage;

  const stageEl = createMockElement("div");
  stageEl.clientWidth = 1280;
  stageEl.clientHeight = 720;
  stageEl.addEventListener = () => {};
  stageEl.removeEventListener = () => {};
  stageEl.appendChild = (child) => { stageEl._children.push(child); child.parentNode = stageEl; };
  stageEl.querySelectorAll = (selector) => {
    return stageEl._children.filter((child) => child.className?.includes(selector.replace(".", "")));
  };

  globalThis.document = {
    createElement: createMockElement,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  globalThis.requestAnimationFrame = (fn) => {
    fn();
    return 1;
  };
  globalThis.cancelAnimationFrame = () => {};
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };

  try {
    const { CanvasEngine } = await import(`./canvas-engine.js?canvas-engine-constructor=${Date.now()}`);
    assert.doesNotThrow(() => new CanvasEngine(stageEl, {}));
  } finally {
    globalThis.document = origDocumentRef;
    globalThis.requestAnimationFrame = origRAF;
    globalThis.cancelAnimationFrame = origCAF;
    globalThis.localStorage = origLocalStorage;
  }
});
