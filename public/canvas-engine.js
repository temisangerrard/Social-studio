/**
 * Canvas Engine — infinite canvas with zoom, pan, and artboard management.
 * Pure vanilla JS ES module, no build step required.
 *
 * @module canvas-engine
 */

// ── TransformState ────────────────────────────────────────────────────────────

/** Zoom step applied per wheel scroll event. */
const ZOOM_STEP = 0.1;

/** Minimum allowed zoom level. */
const ZOOM_MIN = 0.1;

/** Maximum allowed zoom level. */
const ZOOM_MAX = 5.0;

/**
 * Manages the transform matrix (zoom + pan) for the infinite canvas.
 *
 * Coordinate conversion formulas:
 * - screenToCanvas: canvasX = (screenX - panX) / zoom
 * - canvasToScreen: screenX = canvasX * zoom + panX
 *
 * Zoom is always centered on the cursor/midpoint so the canvas-space point
 * under the pointer stays at the same screen position before and after zoom.
 */
export class TransformState {
  /** @type {number} Current zoom level (0.1–5.0). */
  zoom = 1;

  /** @type {number} Horizontal pan offset in screen pixels. */
  panX = 0;

  /** @type {number} Vertical pan offset in screen pixels. */
  panY = 0;

  /**
   * Apply a wheel-based zoom step centered on the cursor position.
   *
   * Positive delta → zoom out, negative delta → zoom in (matching native
   * wheel event deltaY convention).
   *
   * The algorithm:
   * 1. Compute the canvas-space point under the cursor before zoom.
   * 2. Apply the zoom step.
   * 3. Adjust pan so the same canvas-space point remains under the cursor.
   *
   * @param {number} delta - Wheel deltaY (positive = zoom out, negative = zoom in).
   * @param {number} cursorX - Cursor screen-space X.
   * @param {number} cursorY - Cursor screen-space Y.
   */
  applyWheelZoom(delta, cursorX, cursorY) {
    // Canvas-space point under cursor before zoom
    const canvasPt = this.screenToCanvas(cursorX, cursorY);

    // Apply zoom step: positive delta = zoom out, negative = zoom in
    const direction = delta > 0 ? -1 : 1;
    this.zoom += direction * ZOOM_STEP;
    this.clampZoom();

    // Adjust pan so canvasPt stays at the same screen position
    this.panX = cursorX - canvasPt.x * this.zoom;
    this.panY = cursorY - canvasPt.y * this.zoom;
  }

  /**
   * Apply a pinch-zoom centered on the midpoint between two touch points.
   *
   * scaleDelta is the ratio of new pinch distance to old pinch distance
   * (e.g. 1.05 means fingers moved apart by 5%).
   *
   * @param {number} scaleDelta - Ratio of new distance / old distance.
   * @param {number} centerX - Midpoint screen-space X.
   * @param {number} centerY - Midpoint screen-space Y.
   */
  applyPinchZoom(scaleDelta, centerX, centerY) {
    // Canvas-space point at the midpoint before zoom
    const canvasPt = this.screenToCanvas(centerX, centerY);

    // Apply proportional zoom
    this.zoom *= scaleDelta;
    this.clampZoom();

    // Adjust pan so canvasPt stays at the same screen position
    this.panX = centerX - canvasPt.x * this.zoom;
    this.panY = centerY - canvasPt.y * this.zoom;
  }

  /**
   * Apply a pan delta (from mouse drag or two-finger drag).
   *
   * @param {number} dx - Horizontal delta in screen pixels.
   * @param {number} dy - Vertical delta in screen pixels.
   */
  applyPan(dx, dy) {
    this.panX += dx;
    this.panY += dy;
  }

  /**
   * Constrain zoom to the allowed range [0.1, 5.0].
   */
  clampZoom() {
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.zoom));
  }

  /**
   * Return the CSS transform string for the canvas container.
   *
   * @returns {string} CSS transform value, e.g. "translate(120px, -40px) scale(0.85)".
   */
  toCSSTransform() {
    return `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }

  /**
   * Convert screen-space coordinates to canvas-space coordinates.
   *
   * @param {number} screenX - Screen-space X.
   * @param {number} screenY - Screen-space Y.
   * @returns {{ x: number, y: number }} Canvas-space coordinates.
   */
  screenToCanvas(screenX, screenY) {
    return {
      x: (screenX - this.panX) / this.zoom,
      y: (screenY - this.panY) / this.zoom,
    };
  }

  /**
   * Convert canvas-space coordinates to screen-space coordinates.
   *
   * @param {number} canvasX - Canvas-space X.
   * @param {number} canvasY - Canvas-space Y.
   * @returns {{ x: number, y: number }} Screen-space coordinates.
   */
  canvasToScreen(canvasX, canvasY) {
    return {
      x: canvasX * this.zoom + this.panX,
      y: canvasY * this.zoom + this.panY,
    };
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Default artboard width (half of 1080 for reasonable canvas display). */
const ARTBOARD_W = 540;

/** Default artboard height (half of 1080). */
const ARTBOARD_H = 540;

/**
 * Derive artboard height from platform so artboards have correct aspect ratios.
 * TikTok → 9:16, Instagram → 4:5, LinkedIn → 1:1 (default).
 * @param {string} platform
 * @returns {number}
 */
function artboardHeightForPlatform(platform) {
  if (platform === "tiktok") return Math.round(ARTBOARD_W * (16 / 9));  // 960
  if (platform === "instagram") return Math.round(ARTBOARD_W * (5 / 4)); // 675
  return ARTBOARD_H; // 540 — square fallback (linkedin, unknown)
}

/** Horizontal gap between artboards in the slide strip. */
const STRIP_GAP = 48;

/** X offset where the slide strip begins. */
const STRIP_START_X = 420;

/** Y offset for the slide strip. */
const STRIP_START_Y = 80;

/** Overlay column X position (left of artboard strip). */
const OVERLAY_X = 40;

/** Overlay column starting Y position. */
const OVERLAY_START_Y = 80;

/** Overlay width. */
const OVERLAY_W = 340;

/** Overlay height used only for zoom-to-fit bounds — actual height is CSS auto. */
const OVERLAY_H = 180;

/** Vertical gap between overlays. */
const OVERLAY_GAP = 16;

/** Strategy card position — pinned above the artboard strip. */
const STRATEGY_CARD_X = STRIP_START_X;
const STRATEGY_CARD_Y = 8;
const STRATEGY_CARD_W = 480;

/** Grid snap size in canvas-space pixels. */
const SNAP_GRID = 8;

// ── Artboard Descriptor Builder (Task 2.1) ────────────────────────────────────

/**
 * Pad a number to 2 digits with leading zero.
 * @param {number} n
 * @returns {string}
 */
function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Capitalise the first letter of a string and replace underscores with spaces.
 * @param {string} s
 * @returns {string}
 */
function capitalizeRole(s) {
  const cleaned = String(s || "").replace(/_/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Determine the artboard type from a slide or artifact object.
 * @param {object} item - A slide or artifact from PostMetadata.
 * @returns {'image'|'video'|'document'}
 */
function detectType(item) {
  if (item.kind === "video") return "video";
  if (item.kind === "document") return "document";
  // Slides are always images unless explicitly typed otherwise
  if (item.type === "generated_image" || item.type === "text_only") return "image";
  if (item.kind) return item.kind;
  return "image";
}

/**
 * Build the asset URL for a slide or artifact.
 *
 * @param {object} output - The PostMetadata object.
 * @param {object} item   - A slide or artifact.
 * @param {Array<object>} [slides] - Optional slides array for cross-referencing artifacts against slides.
 * @param {number|null} [hintSlideNumber] - Fallback slide number when item lacks slide_number (e.g. artifacts).
 * @returns {string|null}
 */
export function resolveAssetUrl(output, item, slides = [], hintSlideNumber = null) {
  if (!output || !item) return null;

  // Direct asset_path on the item (set by FAL generation or mock SVG)
  if (item.asset_path) {
    const filename = item.asset_path.split("/").pop();
    // Skip mock placeholder files (.txt) — they are not renderable assets
    if (filename && output.post_id && !filename.endsWith(".txt")) {
      return `/api/assets/${output.post_id}/${filename}`;
    }
  }

  // preview_path fallback (same value as asset_path in current pipeline)
  if (item.preview_path) {
    const filename = item.preview_path.split("/").pop();
    if (filename && output.post_id && !filename.endsWith(".txt")) {
      return `/api/assets/${output.post_id}/${filename}`;
    }
  }

  // Artifacts don't carry slide_number — use the hint computed from index
  const slideNumber = item.slide_number ?? hintSlideNumber;

  // Cross-reference the matching slide's asset_path
  if (Array.isArray(slides) && typeof slideNumber === "number" && !Number.isNaN(slideNumber)) {
    const matchingSlide = slides.find((s) => s.slide_number === slideNumber);
    if (matchingSlide?.asset_path) {
      const filename = matchingSlide.asset_path.split("/").pop();
      if (filename && output.post_id) {
        return `/api/assets/${output.post_id}/${filename}`;
      }
    }
  }

  if (item.kind === "video") return null;

  // Rendered slide PNG fallback (only when renderer actually ran)
  if (typeof slideNumber === "number" && !Number.isNaN(slideNumber) && output.render_status !== "skipped") {
    return `/api/slides/${output.post_id}/slide-${pad2(slideNumber)}.png`;
  }

  return null;
}

/**
 * Build an array of ArtboardDescriptor objects from a PostMetadata output.
 *
 * Each descriptor contains position, size, label, and asset information for
 * rendering on the infinite canvas. Artboards are arranged in a horizontal
 * strip starting at (STRIP_START_X, STRIP_START_Y) with STRIP_GAP spacing.
 *
 * @param {object} output - PostMetadata from the server.
 * @returns {Array<object>} Array of ArtboardDescriptor objects.
 */
export function buildArtboardDescriptors(output) {
  if (!output) return [];

  // Prefer artifacts if present, otherwise use slides
  const items = (output.artifacts && output.artifacts.length)
    ? output.artifacts
    : (output.slides || []);
  const slides = output.slides || [];

  // Derive platform from output for correct aspect ratio
  const platform = output.platform || (output.platform_targets && output.platform_targets[0]) || "";
  const artboardH = artboardHeightForPlatform(platform);

  let x = STRIP_START_X;

  return items.map((item, index) => {
    const slideNumber = item.slide_number ?? (index + 1);
    const role = item.role || "slide";
    const type = detectType(item);
    const label = `${pad2(slideNumber)} — ${capitalizeRole(role)}`;
    const assetUrl = resolveAssetUrl(output, item, slides, slideNumber);

    const descriptor = {
      id: item.id || `artboard-${pad2(slideNumber)}`,
      type,
      role,
      label,
      assetUrl,
      slideNumber,
      prompt: item.image_prompt || item.prompt || "",
      text: item.text || item.title || "",
      x,
      y: STRIP_START_Y,
      width: ARTBOARD_W,
      height: artboardH,
      isVariant: false,
      originalId: null,
      order: index,
    };

    x += ARTBOARD_W + STRIP_GAP;

    return descriptor;
  });
}

// ── Content Overlay Descriptor Builder (Task 2.3) ─────────────────────────────

/**
 * Build an array of ContentOverlayDescriptor objects from a PostMetadata output.
 *
 * Creates overlays for: caption (1), each hook (N), and hashtags (1).
 * Positioned in a vertical column at x=OVERLAY_X, starting at y=OVERLAY_START_Y.
 *
 * @param {object} output - PostMetadata from the server.
 * @returns {Array<object>} Array of ContentOverlayDescriptor objects.
 */
export function buildOverlayDescriptors(output) {
  if (!output) return [];

  const overlays = [];
  let y = OVERLAY_START_Y;

  // Caption overlay
  if (output.caption) {
    overlays.push({
      id: "overlay-caption",
      type: "caption",
      text: output.caption,
      x: OVERLAY_X,
      y,
      width: OVERLAY_W,
      height: OVERLAY_H,
    });
    y += OVERLAY_H + OVERLAY_GAP;
  }

  // Hook overlays (one per hook)
  const hooks = output.hooks || [];
  hooks.forEach((hook, i) => {
    overlays.push({
      id: `overlay-hook-${i}`,
      type: "hook",
      text: hook,
      x: OVERLAY_X,
      y,
      width: OVERLAY_W,
      height: OVERLAY_H,
    });
    y += OVERLAY_H + OVERLAY_GAP;
  });

  // Hashtags overlay
  const hashtags = output.hashtags || [];
  if (hashtags.length) {
    overlays.push({
      id: "overlay-hashtags",
      type: "hashtag",
      text: hashtags.join(" "),
      x: OVERLAY_X,
      y,
      width: OVERLAY_W,
      height: OVERLAY_H,
    });
  }

  return overlays;
}

/**
 * Build a strategy card descriptor from output routing metadata.
 * Returns null if no routing decision exists.
 * @param {object} output
 * @returns {object|null}
 */
export function buildStrategyCard(output) {
  const d = output?.routing_decision;
  if (!d) return null;
  return {
    id: "strategy-card",
    workflowType: d.workflowType || output.workflow_type || "slideshow",
    platform: (output.platform_targets || [])[0] || "",
    recipeId: d.recipeId || d.contentTypeId || "",
    confidence: typeof d.confidence === "number" ? d.confidence : null,
    x: STRATEGY_CARD_X,
    y: STRATEGY_CARD_Y,
    width: STRATEGY_CARD_W,
  };
}

// ── ArtboardManager (Task 2.5) ────────────────────────────────────────────────

/**
 * Manages artboard and overlay descriptors and reconciles them to the DOM.
 *
 * The reconciler creates, updates, and removes DOM elements inside a container
 * element to match the current descriptor arrays. Image artboards show a
 * skeleton shimmer while loading and an error placeholder on failure.
 */
export class ArtboardManager {
  /** @type {Array<object>} */
  artboards = [];

  /** @type {Array<object>} */
  overlays = [];

  /** @type {object|null} */
  strategyCard = null;

  /**
   * @param {Array<object>} artboards - ArtboardDescriptor array.
   * @param {Array<object>} overlays  - ContentOverlayDescriptor array.
   */
  constructor(artboards = [], overlays = []) {
    this.artboards = artboards;
    this.overlays = overlays;
  }

  /**
   * Reconcile the DOM inside `containerEl` to match the current descriptors.
   *
   * - Creates new elements for descriptors without a matching DOM node.
   * - Updates position/content for existing elements.
   * - Removes DOM nodes that no longer have a matching descriptor.
   *
   * @param {HTMLElement} containerEl - The `.canvas-transform` container.
   */
  reconcile(containerEl) {
    if (!containerEl) return;

    // ── Reconcile artboards ──────────────────────────────────────────────
    const existingArtboards = new Map();
    containerEl.querySelectorAll(".canvas-artboard").forEach((el) => {
      existingArtboards.set(el.dataset.artboardId, el);
    });

    const activeArtboardIds = new Set();

    for (const desc of this.artboards) {
      activeArtboardIds.add(desc.id);

      let el = existingArtboards.get(desc.id);
      if (!el) {
        el = this._createArtboardElement(desc);
        containerEl.appendChild(el);
      }

      // Update position
      el.style.left = `${desc.x}px`;
      el.style.top = `${desc.y}px`;
      el.style.width = `${desc.width}px`;
      el.style.height = `${desc.height}px`;

      // Update label
      const labelEl = el.querySelector(".canvas-artboard__label");
      if (labelEl) labelEl.textContent = desc.label;

      // Update badge
      const badgeEl = el.querySelector(".canvas-artboard__badge");
      if (badgeEl) badgeEl.textContent = desc.type.toUpperCase();
    }

    // Remove stale artboard elements
    for (const [id, el] of existingArtboards) {
      if (!activeArtboardIds.has(id)) {
        el.remove();
      }
    }

    // ── Reconcile overlays ───────────────────────────────────────────────
    const existingOverlays = new Map();
    containerEl.querySelectorAll(".canvas-overlay").forEach((el) => {
      existingOverlays.set(el.dataset.overlayId, el);
    });

    const activeOverlayIds = new Set();

    for (const desc of this.overlays) {
      activeOverlayIds.add(desc.id);

      let el = existingOverlays.get(desc.id);
      if (!el) {
        el = this._createOverlayElement(desc);
        containerEl.appendChild(el);
      }

      // Update position — height is driven by CSS (auto)
      el.style.left = `${desc.x}px`;
      el.style.top = `${desc.y}px`;
      el.style.width = `${desc.width}px`;

      // Update body text without destroying the card structure
      const bodyEl = el.querySelector(".canvas-overlay__body");
      if (bodyEl) bodyEl.textContent = desc.text;
    }

    // Remove stale overlay elements
    for (const [id, el] of existingOverlays) {
      if (!activeOverlayIds.has(id)) {
        el.remove();
      }
    }

    // Reflow overlay y positions based on actual rendered heights
    let overlayY = OVERLAY_START_Y;
    for (const desc of this.overlays) {
      desc.y = overlayY;
      const el = containerEl.querySelector(`[data-overlay-id="${desc.id}"]`);
      if (el) {
        el.style.top = `${overlayY}px`;
        overlayY += el.offsetHeight + OVERLAY_GAP;
      } else {
        overlayY += OVERLAY_H + OVERLAY_GAP;
      }
    }

    // ── Reconcile strategy card ──────────────────────────────────────────
    const existingCard = containerEl.querySelector(".canvas-strategy-card");
    if (this.strategyCard) {
      const desc = this.strategyCard;
      const el = existingCard || this._createStrategyCardElement(desc);
      if (!existingCard) containerEl.appendChild(el);
      el.style.left = `${desc.x}px`;
      el.style.top = `${desc.y}px`;
      el.style.width = `${desc.width}px`;
      // Update content
      const badge = el.querySelector(".strategy-card__workflow");
      if (badge) badge.textContent = desc.workflowType;
      const platform = el.querySelector(".strategy-card__platform");
      if (platform) platform.textContent = desc.platform;
      const recipe = el.querySelector(".strategy-card__recipe");
      if (recipe) recipe.textContent = desc.recipeId;
      const conf = el.querySelector(".strategy-card__confidence");
      if (conf) conf.textContent = desc.confidence != null ? `${Math.round(desc.confidence * 100)}%` : "—";
    } else if (existingCard) {
      existingCard.remove();
    }
  }

  /**
   * Create a DOM element for an artboard descriptor.
   *
   * Structure: div.canvas-artboard > (img|video) + span.label + span.badge
   * Shows skeleton shimmer while loading, error placeholder on failure.
   *
   * @param {object} desc - ArtboardDescriptor.
   * @returns {HTMLElement}
   */
  _createArtboardElement(desc) {
    const el = document.createElement("div");
    el.className = "canvas-artboard";
    el.dataset.artboardId = desc.id;
    el.dataset.type = desc.type;
    el.style.position = "absolute";

    // Content card — rendered when there is no image/video asset.
    // Covers: text-only slides, CTA slides, video briefs (mock .txt), script outputs.
    if (!desc.assetUrl) {
      el.classList.add("canvas-artboard--content-card");

      const roleIcons = { cta: "→", hook: "🎯", benefit: "✦", recipe: "🍽", script: "📄", video: "▶", clip: "▶", ugc: "▶" };
      const icon = roleIcons[desc.role] || "✦";

      const card = document.createElement("div");
      card.className = "canvas-artboard__content-card";

      const roleBar = document.createElement("div");
      roleBar.className = "canvas-artboard__content-role";
      roleBar.textContent = `${icon} ${capitalizeRole(desc.role)}`;
      card.appendChild(roleBar);

      if (desc.text) {
        const body = document.createElement("p");
        body.className = "canvas-artboard__content-body";
        body.textContent = desc.text;
        card.appendChild(body);
      }

      if (desc.prompt && desc.prompt !== desc.text) {
        const prompt = document.createElement("p");
        prompt.className = "canvas-artboard__content-prompt";
        prompt.textContent = desc.prompt;
        card.appendChild(prompt);
      }

      el.appendChild(card);

      // Label
      const label = document.createElement("span");
      label.className = "canvas-artboard__label";
      label.textContent = desc.label;
      el.appendChild(label);

      // Badge
      const badge = document.createElement("span");
      badge.className = "canvas-artboard__badge";
      badge.textContent = desc.type.toUpperCase();
      el.appendChild(badge);

      return el;
    }

    // Start with skeleton shimmer
    el.classList.add("canvas-artboard--loading");

    // Media element
    if (desc.type === "video") {
      el.classList.add("canvas-artboard--video");

      const video = document.createElement("video");
      video.muted = true;
      video.setAttribute("playsinline", "");
      video.preload = "metadata";
      video.src = desc.assetUrl || "";
      video.addEventListener("loadeddata", () => {
        el.classList.remove("canvas-artboard--loading");
      });
      video.addEventListener("error", () => {
        el.classList.remove("canvas-artboard--loading");
        el.classList.add("canvas-artboard--error");
        video.remove();
        playBtn.remove();
        const errDiv = document.createElement("div");
        errDiv.className = "canvas-artboard__error";
        errDiv.textContent = desc.role || "Error";
        el.prepend(errDiv);
      });
      // When video ends, restore the play overlay
      video.addEventListener("ended", () => {
        video.controls = false;
        video.muted = true;
        video.currentTime = 0;
        playBtn.classList.remove("canvas-artboard__play--hidden");
        el.classList.remove("canvas-artboard--playing");
      });
      el.appendChild(video);

      // Play overlay button — sits above the video, click to play inline with sound
      const playBtn = document.createElement("button");
      playBtn.className = "canvas-artboard__play";
      playBtn.setAttribute("aria-label", "Play video");
      playBtn.setAttribute("type", "button");
      playBtn.innerHTML = `<svg width="36" height="36" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="rgba(0,0,0,0.55)"/><polygon points="14,11 28,18 14,25" fill="white"/></svg>`;
      playBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // don't bubble to selection handler
        video.muted = false;
        video.controls = true;
        video.play().catch(() => {
          // Autoplay blocked — still show controls so user can click native play
        });
        playBtn.classList.add("canvas-artboard__play--hidden");
        el.classList.add("canvas-artboard--playing");
      });
      el.appendChild(playBtn);
    } else {
      // Image (default for image and document types)
      const img = document.createElement("img");
      img.src = desc.assetUrl || "";
      img.alt = desc.label || "";
      img.loading = "lazy";
      img.addEventListener("load", () => {
        el.classList.remove("canvas-artboard--loading");
      });
      img.addEventListener("error", () => {
        el.classList.remove("canvas-artboard--loading");
        el.classList.add("canvas-artboard--error");
        img.remove();
        const errDiv = document.createElement("div");
        errDiv.className = "canvas-artboard__error";
        errDiv.textContent = desc.role || "Error";
        el.prepend(errDiv);
      });
      el.appendChild(img);
    }

    // Label
    const label = document.createElement("span");
    label.className = "canvas-artboard__label";
    label.textContent = desc.label;
    el.appendChild(label);

    // Badge
    const badge = document.createElement("span");
    badge.className = "canvas-artboard__badge";
    badge.textContent = desc.type.toUpperCase();
    el.appendChild(badge);

    return el;
  }

  /**
   * Create a DOM element for the strategy card.
   * Structure: div.canvas-strategy-card > badge + platform + recipe + confidence
   * @param {object} desc
   * @returns {HTMLElement}
   */
  _createStrategyCardElement(desc) {
    const el = document.createElement("div");
    el.className = "canvas-strategy-card";
    el.dataset.strategyCard = "true";
    el.style.position = "absolute";

    el.innerHTML = `<div class="strategy-card__row">
      <span class="strategy-card__workflow">${desc.workflowType}</span>
      <span class="strategy-card__platform">${desc.platform}</span>
    </div>
    <div class="strategy-card__row">
      <span class="strategy-card__label">Recipe</span>
      <span class="strategy-card__recipe">${desc.recipeId}</span>
    </div>
    <div class="strategy-card__row">
      <span class="strategy-card__label">Confidence</span>
      <span class="strategy-card__confidence">${desc.confidence != null ? Math.round(desc.confidence * 100) + "%" : "—"}</span>
    </div>`;

    return el;
  }

  /**
   * Create a DOM element for a content overlay descriptor.
   * Structure: div.canvas-overlay > header(chip + copy-btn) + p.body
   *
   * @param {object} desc - ContentOverlayDescriptor.
   * @returns {HTMLElement}
   */
  _createOverlayElement(desc) {
    const el = document.createElement("div");
    el.className = `canvas-overlay canvas-overlay--${desc.type}`;
    el.dataset.overlayId = desc.id;
    el.style.position = "absolute";

    const typeLabel = { caption: "Caption", hook: "Hook", hashtag: "Hashtags" }[desc.type] || desc.type;

    // Header row: type chip + copy button
    const header = document.createElement("div");
    header.className = "canvas-overlay__header";

    const chip = document.createElement("span");
    chip.className = "canvas-overlay__chip";
    chip.textContent = typeLabel;
    header.appendChild(chip);

    const copyBtn = document.createElement("button");
    copyBtn.className = "canvas-overlay__copy";
    copyBtn.type = "button";
    copyBtn.title = `Copy ${typeLabel.toLowerCase()}`;
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const text = el.querySelector(".canvas-overlay__body")?.textContent || desc.text;
      navigator.clipboard?.writeText(text).catch(() => {});
      copyBtn.textContent = "✓";
      setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
    });
    header.appendChild(copyBtn);
    el.appendChild(header);

    // Text body
    const body = document.createElement("p");
    body.className = "canvas-overlay__body";
    body.textContent = desc.text;
    el.appendChild(body);

    return el;
  }
}

// ── PointerStateMachine (Task 4.1) ────────────────────────────────────────────

/**
 * @typedef {'idle'|'panning'|'dragging'|'pinching'} PointerState
 */

/**
 * Manages pointer/touch input and dispatches to the correct canvas behavior.
 *
 * States: idle, panning, dragging, pinching
 * - idle + pointerdown on empty space → panning
 * - idle + pointerdown on artboard → dragging
 * - idle + two-finger touchstart → pinching
 * - All states → idle on pointerup/touchend
 */
export class PointerStateMachine {
  /** @type {PointerState} */
  state = "idle";

  /** @type {TransformState} */
  _transform;

  /** @type {HTMLElement} */
  _stageEl;

  /** @type {HTMLElement} */
  _transformEl;

  /** @type {ArtboardManager} */
  _artboardManager;

  /** @type {function|null} */
  _onReorder;

  /** @type {function|null} */
  _onDragStart;

  /** @type {function|null} */
  _onDragEnd;

  /** @type {{x: number, y: number}|null} Last pointer screen position for delta calc. */
  _lastPointer = null;

  /** @type {HTMLElement|null} The artboard element currently being dragged. */
  _dragTarget = null;

  /** @type {HTMLElement|null} The drop position indicator element. */
  _dropIndicatorEl = null;

  /** @type {{x: number, y: number}|null} Original canvas-space position of dragged artboard. */
  _dragOrigPos = null;

  /** @type {number} Initial pinch distance. */
  _pinchStartDist = 0;

  /** @type {boolean} Whether a rAF is pending for transform updates. */
  _rafPending = false;

  /**
   * @param {HTMLElement} stageEl - The .studio-canvas-stage element.
   * @param {HTMLElement} transformEl - The .canvas-transform container.
   * @param {TransformState} transformState
   * @param {ArtboardManager} artboardManager
   * @param {object} [callbacks]
   * @param {function} [callbacks.onReorder]
   * @param {function} [callbacks.onDragStart]
   * @param {function} [callbacks.onDragEnd]
   * @param {function} [callbacks.onTransformChange]
   */
  constructor(stageEl, transformEl, transformState, artboardManager, callbacks = {}) {
    this._stageEl = stageEl;
    this._transformEl = transformEl;
    this._transform = transformState;
    this._artboardManager = artboardManager;
    this._onReorder = callbacks.onReorder || null;
    this._onDragStart = callbacks.onDragStart || null;
    this._onDragEnd = callbacks.onDragEnd || null;
    this._onTransformChange = callbacks.onTransformChange || null;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
    this._onWheel = this._onWheel.bind(this);

    this._bindEvents();
  }

  _bindEvents() {
    this._stageEl.addEventListener("pointerdown", this._onPointerDown);
    this._stageEl.addEventListener("pointermove", this._onPointerMove);
    this._stageEl.addEventListener("pointerup", this._onPointerUp);
    this._stageEl.addEventListener("pointercancel", this._onPointerUp);
    this._stageEl.addEventListener("touchstart", this._onTouchStart, { passive: false });
    this._stageEl.addEventListener("touchmove", this._onTouchMove, { passive: false });
    this._stageEl.addEventListener("touchend", this._onTouchEnd);
    this._stageEl.addEventListener("wheel", this._onWheel, { passive: false });
  }

  /**
   * Find the closest .canvas-artboard or .canvas-overlay ancestor of an element.
   * @param {HTMLElement} el
   * @returns {HTMLElement|null}
   */
  _findDraggable(el) {
    let node = el;
    while (node && node !== this._stageEl) {
      if (node.classList && (node.classList.contains("canvas-artboard") || node.classList.contains("canvas-overlay") || node.classList.contains("canvas-strategy-card"))) return node;
      node = node.parentElement;
    }
    return null;
  }

  /**
   * Find the closest .canvas-artboard ancestor of an element, if any.
   * @param {HTMLElement} el
   * @returns {HTMLElement|null}
   */
  _findArtboard(el) {
    let node = el;
    while (node && node !== this._stageEl) {
      if (node.classList && node.classList.contains("canvas-artboard")) return node;
      node = node.parentElement;
    }
    return null;
  }

  /** @type {boolean} When true, suppress pan/drag to allow inline text editing. */
  _editingActive = false;

  /**
   * Set the editing-active flag to suppress pan and drag gestures.
   * @param {boolean} active
   */
  setEditingActive(active) {
    this._editingActive = !!active;
  }

  /** @param {PointerEvent} e */
  _onPointerDown(e) {
    if (this.state !== "idle") return;
    // Ignore right-click
    if (e.button !== 0) return;
    // Suppress pan/drag while inline editing is active
    if (this._editingActive) return;
    // Don't drag when clicking interactive elements inside overlays
    if (e.target.closest("button, a, input, textarea, [contenteditable]")) return;

    const artboard = this._findDraggable(e.target);
    this._lastPointer = { x: e.clientX, y: e.clientY };
    const shouldPanViewport = e.pointerType === "touch";

    if (artboard && !shouldPanViewport) {
      this.state = "dragging";
      this._dragTarget = artboard;
      this._dragOrigPos = {
        x: parseFloat(artboard.style.left) || 0,
        y: parseFloat(artboard.style.top) || 0,
      };
      artboard.classList.add("canvas-artboard--dragging");
      if (this._onDragStart) this._onDragStart(artboard);
      this._stageEl.setPointerCapture(e.pointerId);
    } else {
      this.state = "panning";
      this._stageEl.setPointerCapture(e.pointerId);
    }
  }

  /** @param {PointerEvent} e */
  _onPointerMove(e) {
    if (!this._lastPointer) return;
    const dx = e.clientX - this._lastPointer.x;
    const dy = e.clientY - this._lastPointer.y;
    this._lastPointer = { x: e.clientX, y: e.clientY };

    if (this.state === "panning") {
      this._transform.applyPan(dx, dy);
      this._scheduleTransformUpdate();
    } else if (this.state === "dragging" && this._dragTarget) {
      // Move element in canvas-space: screen delta / zoom
      const canvasDx = dx / this._transform.zoom;
      const canvasDy = dy / this._transform.zoom;
      const curLeft = parseFloat(this._dragTarget.style.left) || 0;
      const curTop = parseFloat(this._dragTarget.style.top) || 0;
      const rawX = curLeft + canvasDx;
      const rawY = curTop + canvasDy;
      const snappedX = Math.round(rawX / SNAP_GRID) * SNAP_GRID;
      const snappedY = Math.round(rawY / SNAP_GRID) * SNAP_GRID;
      this._dragTarget.style.left = `${snappedX}px`;
      this._dragTarget.style.top = `${snappedY}px`;

      // Show drop position indicator for artboards only
      if (this._dragTarget.classList.contains("canvas-artboard")) {
        this._updateDropIndicator(snappedX);
      }
    }
  }

  /** @param {PointerEvent} e */
  _onPointerUp(e) {
    if (this.state === "dragging" && this._dragTarget) {
      this._dragTarget.classList.remove("canvas-artboard--dragging");
      if (this._dragTarget.classList.contains("canvas-overlay")) {
        // Update overlay descriptor position
        const id = this._dragTarget.dataset.overlayId;
        const desc = this._artboardManager.overlays.find((o) => o.id === id);
        if (desc) {
          desc.x = parseFloat(this._dragTarget.style.left) || 0;
          desc.y = parseFloat(this._dragTarget.style.top) || 0;
        }
      } else if (this._dragTarget.classList.contains("canvas-strategy-card")) {
        // Update strategy card descriptor position
        const desc = this._artboardManager.strategyCard;
        if (desc) {
          desc.x = parseFloat(this._dragTarget.style.left) || 0;
          desc.y = parseFloat(this._dragTarget.style.top) || 0;
        }
      } else {
        this._removeDropIndicator();
        this._snapToStrip(this._dragTarget);
      }
      if (this._onDragEnd) this._onDragEnd(this._dragTarget);
      this._dragTarget = null;
      this._dragOrigPos = null;
    }
    this.state = "idle";
    this._lastPointer = null;
  }

  /**
   * Get distance between two touch points.
   * @param {Touch} t1
   * @param {Touch} t2
   * @returns {number}
   */
  _touchDist(t1, t2) {
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** @param {TouchEvent} e */
  _onTouchStart(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      this.state = "pinching";
      this._pinchStartDist = this._touchDist(e.touches[0], e.touches[1]);
    }
  }

  /** @param {TouchEvent} e */
  _onTouchMove(e) {
    if (e.touches.length >= 2) {
      e.preventDefault(); // Prevent browser zoom
    }
    if (this.state === "pinching" && e.touches.length === 2) {
      const newDist = this._touchDist(e.touches[0], e.touches[1]);
      const scaleDelta = newDist / this._pinchStartDist;
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      this._transform.applyPinchZoom(scaleDelta, cx, cy);
      this._pinchStartDist = newDist;
      this._scheduleTransformUpdate();
    }
  }

  /** @param {TouchEvent} e */
  _onTouchEnd(e) {
    if (this.state === "pinching" && e.touches.length < 2) {
      this.state = "idle";
    }
  }

  /** @param {WheelEvent} e */
  _onWheel(e) {
    e.preventDefault();
    if (this._rafPending) return; // Debounce to one per frame
    this._transform.applyWheelZoom(e.deltaY, e.clientX, e.clientY);
    this._scheduleTransformUpdate();
  }

  /** Schedule a rAF to apply the transform to the DOM. */
  _scheduleTransformUpdate() {
    if (this._rafPending) return;
    this._rafPending = true;
    requestAnimationFrame(() => {
      this._transformEl.style.transform = this._transform.toCSSTransform();
      this._rafPending = false;
      if (this._onTransformChange) this._onTransformChange();
    });
  }

  /**
   * Show or move the drop position indicator (vertical line) between artboards.
   * Calculates where the dragged artboard would be inserted based on its x position.
   * @param {number} draggedX - Current x position of the dragged artboard in canvas space.
   */
  _updateDropIndicator(draggedX) {
    const descriptors = this._artboardManager.artboards;
    if (!descriptors || descriptors.length < 2) return;

    const draggedId = this._dragTarget ? this._dragTarget.dataset.artboardId : null;
    // Get sorted non-dragged artboards
    const others = [...descriptors]
      .filter((d) => d.id !== draggedId)
      .sort((a, b) => a.x - b.x);

    if (!others.length) return;

    // Find insertion index
    let insertIdx = others.length;
    for (let i = 0; i < others.length; i++) {
      const midX = others[i].x + others[i].width / 2;
      if (draggedX < midX) {
        insertIdx = i;
        break;
      }
    }

    // Calculate indicator x position (between artboards or at edges)
    let indicatorX;
    if (insertIdx === 0) {
      indicatorX = others[0].x - STRIP_GAP / 2;
    } else if (insertIdx >= others.length) {
      const last = others[others.length - 1];
      indicatorX = last.x + last.width + STRIP_GAP / 2;
    } else {
      const prev = others[insertIdx - 1];
      indicatorX = prev.x + prev.width + STRIP_GAP / 2;
    }

    // Use the first artboard's y and height for the indicator
    const refArtboard = others[0];
    const indicatorY = refArtboard.y;
    const indicatorH = refArtboard.height;

    // Create or reuse indicator element
    if (!this._dropIndicatorEl) {
      this._dropIndicatorEl = document.createElement("div");
      this._dropIndicatorEl.className = "canvas-drop-indicator";
      this._transformEl.appendChild(this._dropIndicatorEl);
    }

    this._dropIndicatorEl.style.left = `${indicatorX - 1}px`;
    this._dropIndicatorEl.style.top = `${indicatorY}px`;
    this._dropIndicatorEl.style.height = `${indicatorH}px`;
  }

  /**
   * Remove the drop position indicator from the DOM.
   */
  _removeDropIndicator() {
    if (this._dropIndicatorEl) {
      this._dropIndicatorEl.remove();
      this._dropIndicatorEl = null;
    }
  }

  /**
   * Snap a dropped artboard to the nearest strip position and reorder.
   * @param {HTMLElement} droppedEl
   */
  _snapToStrip(droppedEl) {
    const droppedId = droppedEl.dataset.artboardId;
    const descriptors = this._artboardManager.artboards;
    if (!descriptors.length) return;

    const droppedX = parseFloat(droppedEl.style.left) || 0;

    // Find the insertion index based on x position
    const sorted = [...descriptors].sort((a, b) => a.x - b.x);
    let insertIdx = sorted.length;
    for (let i = 0; i < sorted.length; i++) {
      const midX = sorted[i].x + sorted[i].width / 2;
      if (droppedX < midX) {
        insertIdx = i;
        break;
      }
    }

    // Build new order: remove dragged, insert at new position
    const oldOrder = sorted.map((d) => d.id);
    const filtered = oldOrder.filter((id) => id !== droppedId);
    if (insertIdx > filtered.length) insertIdx = filtered.length;
    filtered.splice(insertIdx, 0, droppedId);

    // Recalculate positions and update descriptors
    let x = STRIP_START_X;
    for (const id of filtered) {
      const desc = descriptors.find((d) => d.id === id);
      if (desc) {
        desc.x = x;
        desc.y = STRIP_START_Y;
        x += desc.width + STRIP_GAP;
      }
    }

    // Update order indices and labels
    for (let i = 0; i < filtered.length; i++) {
      const desc = descriptors.find((d) => d.id === filtered[i]);
      if (desc) {
        desc.order = i;
        desc.label = `${pad2(i + 1)} — ${capitalizeRole(desc.role)}`;
      }
    }

    // Reconcile DOM
    if (this._transformEl) {
      this._artboardManager.reconcile(this._transformEl);
    }

    if (this._onReorder) {
      this._onReorder(filtered);
    }
  }

  /** Remove all event listeners. */
  destroy() {
    this._stageEl.removeEventListener("pointerdown", this._onPointerDown);
    this._stageEl.removeEventListener("pointermove", this._onPointerMove);
    this._stageEl.removeEventListener("pointerup", this._onPointerUp);
    this._stageEl.removeEventListener("pointercancel", this._onPointerUp);
    this._stageEl.removeEventListener("touchstart", this._onTouchStart);
    this._stageEl.removeEventListener("touchmove", this._onTouchMove);
    this._stageEl.removeEventListener("touchend", this._onTouchEnd);
    this._stageEl.removeEventListener("wheel", this._onWheel);
  }
}

// ── SelectionManager (Task 5.1, 5.3) ─────────────────────────────────────────

/**
 * Manages artboard selection state. Enforces exclusive selection (at most one
 * artboard selected at any time). Supports click-to-select, click-empty-to-deselect,
 * and keyboard arrow navigation.
 */
export class SelectionManager {
  /** @type {string|null} ID of the currently selected artboard. */
  _selectedId = null;

  /** @type {HTMLElement} */
  _stageEl;

  /** @type {ArtboardManager} */
  _artboardManager;

  /** @type {function|null} */
  _onSelect;

  /** @type {string} CSS class applied to selected artboards. */
  static SELECTED_CLASS = "canvas-artboard--selected";

  /** @type {function|null} */
  _onDelete;

  /**
   * @param {HTMLElement} stageEl - The .studio-canvas-stage element.
   * @param {ArtboardManager} artboardManager
   * @param {object} [callbacks]
   * @param {function} [callbacks.onSelect] - Called with the selected descriptor or null.
   * @param {function} [callbacks.onDelete] - Called with the artboard ID when delete is confirmed.
   */
  constructor(stageEl, artboardManager, callbacks = {}) {
    this._stageEl = stageEl;
    this._artboardManager = artboardManager;
    this._onSelect = callbacks.onSelect || null;
    this._onDelete = callbacks.onDelete || null;

    this._onClick = this._onClick.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);

    this._stageEl.addEventListener("click", this._onClick);
    document.addEventListener("keydown", this._onKeyDown);
  }

  /**
   * Get the currently selected artboard descriptor, or null.
   * @returns {object|null}
   */
  getSelected() {
    if (!this._selectedId) return null;
    return this._artboardManager.artboards.find((d) => d.id === this._selectedId) || null;
  }

  /**
   * Programmatically select an artboard by ID.
   * @param {string|null} id
   */
  select(id) {
    // Deselect previous
    if (this._selectedId) {
      const prevEl = this._stageEl.querySelector(
        `.canvas-artboard[data-artboard-id="${this._selectedId}"]`
      );
      if (prevEl) prevEl.classList.remove(SelectionManager.SELECTED_CLASS);
    }

    this._selectedId = id;

    // Select new
    if (id) {
      const el = this._stageEl.querySelector(
        `.canvas-artboard[data-artboard-id="${id}"]`
      );
      if (el) el.classList.add(SelectionManager.SELECTED_CLASS);
    }

    const desc = this.getSelected();
    if (this._onSelect) this._onSelect(desc);
  }

  /** Deselect all. */
  deselect() {
    this.select(null);
  }

  /**
   * Find the closest .canvas-artboard ancestor of an element.
   * @param {HTMLElement} el
   * @returns {HTMLElement|null}
   */
  _findArtboard(el) {
    let node = el;
    while (node && node !== this._stageEl) {
      if (node.classList && node.classList.contains("canvas-artboard")) return node;
      node = node.parentElement;
    }
    return null;
  }

  /** @param {MouseEvent} e */
  _onClick(e) {
    const artboard = this._findArtboard(e.target);
    if (artboard) {
      this.select(artboard.dataset.artboardId);
    } else {
      // Clicked on empty canvas space — deselect
      this.deselect();
    }
  }

  /**
   * Keyboard navigation: arrow keys move selection between adjacent artboards,
   * Escape deselects the current artboard, Delete/Backspace removes selected artboard.
   * @param {KeyboardEvent} e
   */
  _onKeyDown(e) {
    // Don't handle keys when InlineEditor (contenteditable) is active
    const active = document.activeElement;
    if (active && (active.isContentEditable || active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
      return;
    }

    // Escape deselects
    if (e.key === "Escape") {
      if (this._selectedId) {
        this.deselect();
        e.preventDefault();
      }
      return;
    }

    // Delete/Backspace removes selected artboard after confirmation
    if (e.key === "Delete" || e.key === "Backspace") {
      if (this._selectedId && this._onDelete) {
        e.preventDefault();
        const confirmed = confirm("Delete this artboard?");
        if (confirmed) {
          const idToDelete = this._selectedId;
          this.deselect();
          this._onDelete(idToDelete);
        }
      }
      return;
    }

    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;

    const sorted = [...this._artboardManager.artboards].sort((a, b) => a.order - b.order);
    if (!sorted.length) return;

    const currentIdx = this._selectedId
      ? sorted.findIndex((d) => d.id === this._selectedId)
      : -1;

    let nextIdx;
    if (e.key === "ArrowRight") {
      nextIdx = currentIdx < 0 ? 0 : Math.min(currentIdx + 1, sorted.length - 1);
    } else {
      nextIdx = currentIdx < 0 ? 0 : Math.max(currentIdx - 1, 0);
    }

    this.select(sorted[nextIdx].id);
    e.preventDefault();
  }

  /** Remove all event listeners. */
  destroy() {
    this._stageEl.removeEventListener("click", this._onClick);
    document.removeEventListener("keydown", this._onKeyDown);
  }
}

// ── ContextMenu (Task 7.1) ────────────────────────────────────────────────────

/**
 * Right-click / long-press context menu for artboards.
 * Displays action items (Regenerate, Download, Duplicate, Delete) at pointer position.
 */
export class ContextMenu {
  /** @type {HTMLElement} */
  _stageEl;

  /** @type {object} Callback functions for menu actions. */
  _callbacks;

  /** @type {HTMLElement|null} The menu DOM element. */
  _menuEl = null;

  /** @type {object|null} The artboard descriptor the menu was opened for. */
  _artboardDesc = null;

  /**
   * @param {HTMLElement} stageEl - The .studio-canvas-stage element.
   * @param {object} callbacks
   * @param {function} [callbacks.onRegenerate] - Called with artboardDesc.
   * @param {function} [callbacks.onDownload] - Called with artboardDesc.
   * @param {function} [callbacks.onDelete] - Called with artboardDesc.
   * @param {function} [callbacks.onDuplicate] - Called with artboardDesc.
   */
  constructor(stageEl, callbacks = {}) {
    this._stageEl = stageEl;
    this._callbacks = callbacks;

    this._onDocumentClick = this._onDocumentClick.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  /**
   * Show the context menu at the given screen coordinates for an artboard.
   *
   * @param {number} x - Screen-space X (e.g. from event.clientX).
   * @param {number} y - Screen-space Y (e.g. from event.clientY).
   * @param {object} artboardDesc - The ArtboardDescriptor for the target artboard.
   */
  show(x, y, artboardDesc) {
    // Hide any existing menu first
    this.hide();

    this._artboardDesc = artboardDesc;

    // Build menu DOM
    const menu = document.createElement("div");
    menu.className = "canvas-context-menu";
    menu.style.position = "fixed";
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.zIndex = "9999";

    const actions = [
      { label: "Regenerate", key: "onRegenerate", dangerous: false },
      { label: "Download", key: "onDownload", dangerous: false },
      { label: "Duplicate", key: "onDuplicate", dangerous: false },
      { label: "Delete", key: "onDelete", dangerous: true },
    ];

    for (const action of actions) {
      const item = document.createElement("div");
      item.className = "canvas-context-menu__item";
      item.textContent = action.label;
      item.dataset.action = action.key;

      if (action.dangerous) {
        item.dataset.dangerous = "true";
        item.classList.add("canvas-context-menu__item--dangerous");
      }

      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const cb = this._callbacks[action.key];
        if (cb) cb(this._artboardDesc);
        this.hide();
      });

      menu.appendChild(item);
    }

    document.body.appendChild(menu);
    this._menuEl = menu;

    // Attach document-level listeners to close on outside click or Escape
    // Use setTimeout to avoid the same click that opened the menu from closing it
    setTimeout(() => {
      document.addEventListener("click", this._onDocumentClick, true);
      document.addEventListener("keydown", this._onKeyDown);
    }, 0);
  }

  /**
   * Hide and remove the context menu from the DOM.
   */
  hide() {
    if (this._menuEl) {
      this._menuEl.remove();
      this._menuEl = null;
    }
    this._artboardDesc = null;
    document.removeEventListener("click", this._onDocumentClick, true);
    document.removeEventListener("keydown", this._onKeyDown);
  }

  /**
   * Clean up all event listeners. Call when the engine is destroyed.
   */
  destroy() {
    this.hide();
  }

  /**
   * Handle clicks outside the menu to close it.
   * @param {MouseEvent} e
   */
  _onDocumentClick(e) {
    if (this._menuEl && !this._menuEl.contains(e.target)) {
      this.hide();
    }
  }

  /**
   * Handle Escape key to close the menu.
   * @param {KeyboardEvent} e
   */
  _onKeyDown(e) {
    if (e.key === "Escape") {
      this.hide();
    }
  }
}

// ── ZoomControlsUI (Task 7.1, 7.2) ───────────────────────────────────────────

/**
 * Renders a fixed-position zoom toolbar at the bottom-left of the stage.
 * Includes +, -, fit buttons and a percentage label.
 */
export class ZoomControlsUI {
  /** @type {HTMLElement} */
  _stageEl;

  /** @type {TransformState} */
  _transform;

  /** @type {HTMLElement|null} */
  _toolbarEl = null;

  /** @type {HTMLElement|null} */
  _labelEl = null;

  /** @type {function|null} */
  _onTransformChange;

  /** @type {ArtboardManager} */
  _artboardManager;

  /**
   * @param {HTMLElement} stageEl
   * @param {TransformState} transformState
   * @param {ArtboardManager} artboardManager
   * @param {object} [callbacks]
   * @param {function} [callbacks.onTransformChange]
   */
  constructor(stageEl, transformState, artboardManager, callbacks = {}) {
    this._stageEl = stageEl;
    this._transform = transformState;
    this._artboardManager = artboardManager;
    this._onTransformChange = callbacks.onTransformChange || null;
  }

  /**
   * Build and insert the zoom controls.
   *
   * If a `targetContainer` is provided (e.g. the #studio-quick-form toolbar),
   * the controls are rendered inline inside that container. Otherwise they
   * fall back to being appended to the stage element.
   *
   * @param {HTMLElement} transformEl - The .canvas-transform element to apply transforms to.
   * @param {HTMLElement} [targetContainer] - Optional container to render into (e.g. toolbar).
   */
  render(transformEl, targetContainer) {
    if (this._toolbarEl) return; // Already rendered

    this._transformEl = transformEl;

    const toolbar = document.createElement("div");
    toolbar.className = "canvas-zoom-controls";

    // Zoom out button
    const btnOut = document.createElement("button");
    btnOut.className = "canvas-zoom-btn";
    btnOut.type = "button";
    btnOut.dataset.action = "zoom-out";
    btnOut.textContent = "−";
    btnOut.setAttribute("aria-label", "Zoom out");
    btnOut.addEventListener("click", (e) => { e.preventDefault(); this._stepZoom(-1); });

    // Zoom label
    const label = document.createElement("span");
    label.className = "canvas-zoom-label";
    label.textContent = this._formatZoom();
    this._labelEl = label;

    // Zoom in button
    const btnIn = document.createElement("button");
    btnIn.className = "canvas-zoom-btn";
    btnIn.type = "button";
    btnIn.dataset.action = "zoom-in";
    btnIn.textContent = "+";
    btnIn.setAttribute("aria-label", "Zoom in");
    btnIn.addEventListener("click", (e) => { e.preventDefault(); this._stepZoom(1); });

    // Fit-to-view button
    const btnFit = document.createElement("button");
    btnFit.className = "canvas-zoom-btn";
    btnFit.type = "button";
    btnFit.dataset.action = "zoom-fit";
    btnFit.textContent = "Fit";
    btnFit.setAttribute("aria-label", "Zoom to fit");
    btnFit.addEventListener("click", (e) => { e.preventDefault(); this._zoomToFit(); });

    toolbar.appendChild(btnOut);
    toolbar.appendChild(label);
    toolbar.appendChild(btnIn);
    toolbar.appendChild(btnFit);

    // Render into the target container (toolbar) if provided, otherwise stage
    const host = targetContainer || this._stageEl;

    // Add a visual divider before zoom controls when inside the toolbar
    if (targetContainer) {
      const divider = document.createElement("div");
      divider.className = "toolbar-divider";
      host.appendChild(divider);
    }

    host.appendChild(toolbar);
    this._toolbarEl = toolbar;
  }

  /**
   * Update the zoom percentage label.
   */
  updateLabel() {
    if (this._labelEl) {
      this._labelEl.textContent = this._formatZoom();
    }
  }

  /**
   * Format the current zoom as a percentage string.
   * @returns {string}
   */
  _formatZoom() {
    return `${Math.round(this._transform.zoom * 100)}%`;
  }

  /**
   * Step zoom in or out by 0.1, centered on viewport center.
   * @param {number} direction - 1 for zoom in, -1 for zoom out.
   */
  _stepZoom(direction) {
    const rect = this._stageEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // Negative delta = zoom in (matching applyWheelZoom convention)
    this._transform.applyWheelZoom(-direction, cx, cy);
    this._applyTransform();
  }

  /**
   * Apply the current transform to the DOM and notify.
   */
  _applyTransform() {
    if (this._transformEl) {
      this._transformEl.style.transform = this._transform.toCSSTransform();
    }
    this.updateLabel();
    if (this._onTransformChange) this._onTransformChange();
  }

  /**
   * Calculate and apply zoom-to-fit for all artboards.
   */
  _zoomToFit() {
    const result = calcZoomToFit(
      this._artboardManager.artboards,
      this._stageEl.clientWidth,
      this._stageEl.clientHeight
    );
    this._transform.zoom = result.zoom;
    this._transform.panX = result.panX;
    this._transform.panY = result.panY;
    this._applyTransform();
  }

  /** Remove the toolbar from the DOM. */
  destroy() {
    if (this._toolbarEl) {
      this._toolbarEl.remove();
      this._toolbarEl = null;
    }
  }
}

/**
 * Calculate zoom and pan to fit all artboards within a viewport with padding.
 *
 * @param {Array<object>} artboards - Array of ArtboardDescriptor objects.
 * @param {number} viewportW - Viewport width in pixels.
 * @param {number} viewportH - Viewport height in pixels.
 * @param {number} [padding=48] - Padding in screen pixels.
 * @returns {{ zoom: number, panX: number, panY: number }}
 */
export function calcZoomToFit(artboards, viewportW, viewportH, padding = 48) {
  if (!artboards || !artboards.length) {
    return { zoom: 1, panX: 0, panY: 0 };
  }

  // Calculate bounding box of all artboards in canvas-space
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const a of artboards) {
    minX = Math.min(minX, a.x);
    minY = Math.min(minY, a.y);
    maxX = Math.max(maxX, a.x + a.width);
    maxY = Math.max(maxY, a.y + a.height);
  }

  const contentW = maxX - minX;
  const contentH = maxY - minY;

  if (contentW <= 0 || contentH <= 0) {
    return { zoom: 1, panX: 0, panY: 0 };
  }

  // Available viewport space after padding
  const availW = viewportW - padding * 2;
  const availH = viewportH - padding * 2;

  if (availW <= 0 || availH <= 0) {
    return { zoom: ZOOM_MIN, panX: padding, panY: padding };
  }

  // Zoom to fit: scale so content fits in available space
  let zoom = Math.min(availW / contentW, availH / contentH);
  zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));

  // Center the content in the viewport
  const panX = padding + (availW - contentW * zoom) / 2 - minX * zoom;
  const panY = padding + (availH - contentH * zoom) / 2 - minY * zoom;

  return { zoom, panX, panY };
}

// ── ConnectorRenderer (Task 7.4) ──────────────────────────────────────────────

/**
 * Renders SVG connector lines between content overlays and the first artboard,
 * and dashed lines from variant artboards to their originals.
 * Skips connectors to off-screen elements (viewport culling).
 */
export class ConnectorRenderer {
  /** @type {SVGSVGElement|null} */
  _svgEl = null;

  /** @type {HTMLElement} */
  _transformEl;

  /** @type {ArtboardManager} */
  _artboardManager;

  /** @type {TransformState} */
  _transform;

  /** @type {number} Viewport width for culling. */
  _viewportW = 0;

  /** @type {number} Viewport height for culling. */
  _viewportH = 0;

  /**
   * @param {HTMLElement} transformEl - The .canvas-transform container.
   * @param {ArtboardManager} artboardManager
   * @param {TransformState} transformState
   */
  constructor(transformEl, artboardManager, transformState) {
    this._transformEl = transformEl;
    this._artboardManager = artboardManager;
    this._transform = transformState;
  }

  /**
   * Create or get the SVG element inside the transform container.
   * @returns {SVGSVGElement}
   */
  _ensureSvg() {
    if (!this._svgEl) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "canvas-connector-svg");
      svg.style.position = "absolute";
      svg.style.top = "0";
      svg.style.left = "0";
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.pointerEvents = "none";
      svg.style.overflow = "visible";
      this._transformEl.prepend(svg);
      this._svgEl = svg;
    }
    return this._svgEl;
  }

  /**
   * Update viewport dimensions for culling calculations.
   * @param {number} w
   * @param {number} h
   */
  setViewport(w, h) {
    this._viewportW = w;
    this._viewportH = h;
  }

  /**
   * Check if a canvas-space rect is visible in the current viewport (with 200px buffer).
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @returns {boolean}
   */
  _isVisible(x, y, w, h) {
    const buffer = 200;
    const screen = this._transform.canvasToScreen(x, y);
    const screenR = this._transform.canvasToScreen(x + w, y + h);
    return (
      screenR.x >= -buffer &&
      screen.x <= this._viewportW + buffer &&
      screenR.y >= -buffer &&
      screen.y <= this._viewportH + buffer
    );
  }

  /**
   * Redraw all connector lines.
   */
  render() {
    const svg = this._ensureSvg();
    // Clear existing paths
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const artboards = this._artboardManager.artboards;
    const overlays = this._artboardManager.overlays;

    if (!artboards.length) return;

    // Find the first artboard in the strip (lowest order)
    const firstArtboard = [...artboards]
      .filter((a) => !a.isVariant)
      .sort((a, b) => a.order - b.order)[0];

    if (!firstArtboard) return;

    // Draw lines from each overlay to the first artboard
    for (const overlay of overlays) {
      // Skip if either endpoint is off-screen
      if (
        !this._isVisible(overlay.x, overlay.y, overlay.width, overlay.height) &&
        !this._isVisible(firstArtboard.x, firstArtboard.y, firstArtboard.width, firstArtboard.height)
      ) {
        continue;
      }

      const x1 = overlay.x + overlay.width;
      const y1 = overlay.y + overlay.height / 2;
      const x2 = firstArtboard.x;
      const y2 = firstArtboard.y + firstArtboard.height / 2;

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(x1));
      line.setAttribute("y1", String(y1));
      line.setAttribute("x2", String(x2));
      line.setAttribute("y2", String(y2));
      line.setAttribute("stroke", "#94a3b8");
      line.setAttribute("stroke-width", "1.5");
      line.setAttribute("stroke-opacity", "0.5");
      svg.appendChild(line);
    }

    // Draw dashed lines from variant artboards to their originals
    for (const variant of artboards.filter((a) => a.isVariant && a.originalId)) {
      const original = artboards.find((a) => a.id === variant.originalId);
      if (!original) continue;

      // Skip if both are off-screen
      if (
        !this._isVisible(variant.x, variant.y, variant.width, variant.height) &&
        !this._isVisible(original.x, original.y, original.width, original.height)
      ) {
        continue;
      }

      const x1 = original.x + original.width / 2;
      const y1 = original.y + original.height;
      const x2 = variant.x + variant.width / 2;
      const y2 = variant.y;

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(x1));
      line.setAttribute("y1", String(y1));
      line.setAttribute("x2", String(x2));
      line.setAttribute("y2", String(y2));
      line.setAttribute("stroke", "#94a3b8");
      line.setAttribute("stroke-width", "1.5");
      line.setAttribute("stroke-dasharray", "6 4");
      line.setAttribute("stroke-opacity", "0.6");
      svg.appendChild(line);

      // "variant of" label
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String((x1 + x2) / 2));
      text.setAttribute("y", String((y1 + y2) / 2 - 6));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", "#94a3b8");
      text.setAttribute("font-size", "11");
      text.textContent = "variant of";
      svg.appendChild(text);
    }
  }

  /** Remove the SVG element. */
  destroy() {
    if (this._svgEl) {
      this._svgEl.remove();
      this._svgEl = null;
    }
  }
}

// ── PersistenceManager (Task 9.1) ─────────────────────────────────────────────

/**
 * Handles localStorage read/write for canvas state.
 * Keys are formatted as `canvas-state-{postId}`.
 * Handles QuotaExceededError silently and clears corrupt JSON.
 */
export class PersistenceManager {
  /**
   * Save canvas state to localStorage.
   * @param {string} postId
   * @param {object} canvasState - { zoom, panX, panY, artboardOrder }
   */
  static save(postId, canvasState) {
    if (!postId) return;
    const key = `canvas-state-${postId}`;
    try {
      const data = {
        postId,
        zoom: canvasState.zoom,
        panX: canvasState.panX,
        panY: canvasState.panY,
        artboardOrder: canvasState.artboardOrder || [],
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      // QuotaExceededError or other storage errors — silently skip
      if (typeof console !== "undefined") {
        console.warn("PersistenceManager: failed to save canvas state", err);
      }
    }
  }

  /**
   * Load canvas state from localStorage.
   * @param {string} postId
   * @returns {object|null} The saved canvas state, or null if not found/corrupt.
   */
  static load(postId) {
    if (!postId) return null;
    const key = `canvas-state-${postId}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      // Basic validation
      if (
        typeof data.zoom !== "number" ||
        typeof data.panX !== "number" ||
        typeof data.panY !== "number"
      ) {
        // Corrupt data — clear it
        localStorage.removeItem(key);
        return null;
      }
      return data;
    } catch (err) {
      // Corrupt JSON — clear the key
      try {
        localStorage.removeItem(`canvas-state-${postId}`);
      } catch (_) {
        // Ignore
      }
      return null;
    }
  }

  /**
   * Remove persisted state for a post.
   * @param {string} postId
   */
  static clear(postId) {
    if (!postId) return;
    try {
      localStorage.removeItem(`canvas-state-${postId}`);
    } catch (_) {
      // Ignore
    }
  }
}

// ── Viewport Culling (Task 9.3) ───────────────────────────────────────────────

/**
 * Classify artboards as visible or hidden based on viewport bounds + buffer.
 * Sets `loading="lazy"` on off-screen artboard images.
 *
 * @param {Array<object>} artboards - ArtboardDescriptor array.
 * @param {TransformState} transform - Current transform state.
 * @param {number} viewportW - Viewport width.
 * @param {number} viewportH - Viewport height.
 * @param {HTMLElement} containerEl - The .canvas-transform container.
 * @param {number} [buffer=200] - Buffer in screen pixels.
 * @returns {Array<{id: string, visible: boolean}>} Visibility classification.
 */
export function classifyVisibility(artboards, transform, viewportW, viewportH, containerEl, buffer = 200) {
  const results = [];

  for (const a of artboards) {
    const topLeft = transform.canvasToScreen(a.x, a.y);
    const bottomRight = transform.canvasToScreen(a.x + a.width, a.y + a.height);

    const visible =
      bottomRight.x >= -buffer &&
      topLeft.x <= viewportW + buffer &&
      bottomRight.y >= -buffer &&
      topLeft.y <= viewportH + buffer;

    results.push({ id: a.id, visible });

    // Update lazy loading on the DOM element
    if (containerEl) {
      const el = containerEl.querySelector(`.canvas-artboard[data-artboard-id="${a.id}"]`);
      if (el) {
        const img = el.querySelector("img");
        if (img) {
          img.loading = visible ? "eager" : "lazy";
        }
      }
    }
  }

  return results;
}

// ── Export Helpers (Task 12.1, 12.3) ──────────────────────────────────────────

/**
 * Map an artboard type to a file extension.
 * @param {string} type - 'image', 'video', or 'document'
 * @param {string} [assetUrl] - Optional URL to infer extension from.
 * @returns {string}
 */
function typeToExt(type, assetUrl) {
  if (assetUrl) {
    const urlExt = assetUrl.split(".").pop()?.split("?")[0];
    if (urlExt && /^(png|jpg|jpeg|webp|mp4|webm|pdf)$/i.test(urlExt)) return urlExt.toLowerCase();
  }
  if (type === "video") return "mp4";
  if (type === "document") return "pdf";
  return "png";
}

/**
 * Build a download filename for an artboard: {NN}-{role}.{ext}
 * @param {object} desc - ArtboardDescriptor
 * @returns {string}
 */
export function buildDownloadFilename(desc) {
  const num = pad2(typeof desc.slideNumber === "number" ? desc.slideNumber : (desc.order + 1));
  const role = String(desc.role || "slide").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const ext = typeToExt(desc.type, desc.assetUrl);
  return `${num}-${role}.${ext}`;
}

/**
 * Download a single artboard's asset file.
 * Fetches the file and triggers a browser download with the correct filename.
 *
 * @param {object} desc - ArtboardDescriptor with assetUrl, slideNumber, role, type.
 * @returns {Promise<void>}
 */
export async function downloadArtboard(desc) {
  if (!desc || !desc.assetUrl) return;
  const res = await fetch(desc.assetUrl);
  if (!res.ok) throw new Error(`Failed to fetch asset: ${res.status}`);
  const blob = await res.blob();
  const filename = buildDownloadFilename(desc);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Download all primary strip outputs + caption as a ZIP file.
 * Excludes variant artboards. Uses JSZip (expected on window.JSZip).
 *
 * @param {Array<object>} artboards - All ArtboardDescriptor objects.
 * @param {object} output - PostMetadata with caption, post_id.
 * @returns {Promise<void>}
 */
export async function downloadAllAsZip(artboards, output) {
  const JSZip = window.JSZip;
  if (!JSZip) throw new Error("JSZip not loaded.");

  const zip = new JSZip();

  // Only include primary (non-variant) artboards
  const primary = artboards.filter((a) => !a.isVariant);

  await Promise.all(primary.map(async (desc) => {
    if (!desc.assetUrl) return;
    try {
      const res = await fetch(desc.assetUrl);
      if (!res.ok) return;
      const blob = await res.blob();
      zip.file(buildDownloadFilename(desc), blob);
    } catch (_) {
      // Skip failed fetches silently
    }
  }));

  // Add caption text file
  if (output && output.caption) {
    zip.file("caption.txt", output.caption);
  }

  const content = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(content);
  a.download = `${(output && output.post_id) || "assets"}-package.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── CanvasEngine (Task 11.1, 11.2) ────────────────────────────────────────────

/**
 * Main orchestrator class that wires all canvas subsystems together.
 * This is the primary entry point for app.js integration.
 *
 * @example
 * const engine = new CanvasEngine(document.querySelector('.studio-canvas-stage'), {
 *   onSelect: (artboard) => { },
 *   onReorder: (orderedIds) => { },
 *   onZoomChange: (zoom) => { },
 * });
 * engine.loadOutput(postMetadata);
 */
export class CanvasEngine {
  /** @type {HTMLElement} */
  _stageEl;

  /** @type {HTMLElement} */
  _transformEl;

  /** @type {TransformState} */
  _transform;

  /** @type {ArtboardManager} */
  _artboardManager;

  /** @type {PointerStateMachine} */
  _pointer;

  /** @type {SelectionManager} */
  _selection;

  /** @type {ConnectorRenderer} */
  _connectors;

  /** @type {ZoomControlsUI} */
  _zoomControls;

  /** @type {object|null} Current output metadata. */
  _output = null;

  /** @type {function|null} */
  _onSelect;

  /** @type {function|null} */
  _onReorder;

  /** @type {function|null} */
  _onZoomChange;

  /** @type {number} rAF id for batched updates. */
  _rafId = 0;

  /** @type {ContextMenu} */
  _contextMenu;

  /** @type {number|null} Long-press timer ID for touch context menu. */
  _longPressTimer = null;

  /** @type {{x: number, y: number}|null} Touch start position for long-press detection. */
  _longPressStart = null;

  /** Long-press threshold in ms. */
  static LONG_PRESS_MS = 500;

  /** Max movement (px) allowed during long-press before cancelling. */
  static LONG_PRESS_MOVE_THRESHOLD = 10;

  /**
   * @param {HTMLElement} stageEl - The .studio-canvas-stage element.
   * @param {object} [options]
   * @param {function} [options.onSelect] - Called with selected artboard descriptor or null.
   * @param {function} [options.onReorder] - Called with array of ordered artboard IDs.
   * @param {function} [options.onZoomChange] - Called with current zoom level.
   * @param {function} [options.onRegenerate] - Context menu: called with artboard descriptor.
   * @param {function} [options.onDownload] - Context menu: called with artboard descriptor.
   * @param {function} [options.onDelete] - Context menu: called with artboard descriptor.
   * @param {function} [options.onDuplicate] - Context menu: called with artboard descriptor.
   * @param {HTMLElement} [options.toolbarEl] - Optional toolbar element to render zoom controls into.
   */
  constructor(stageEl, options = {}) {
    this._stageEl = stageEl;
    this._onSelect = options.onSelect || null;
    this._onReorder = options.onReorder || null;
    this._onZoomChange = options.onZoomChange || null;

    // Set touch-action: none to prevent browser gesture conflicts
    this._stageEl.style.touchAction = "none";

    // Create .canvas-transform container
    this._transformEl = document.createElement("div");
    this._transformEl.className = "canvas-transform";
    this._stageEl.appendChild(this._transformEl);

    // Initialize subsystems
    this._transform = new TransformState();
    this._artboardManager = new ArtboardManager();

    // Apply grid background after transform state exists.
    this._applyGridBackground();

    const onTransformChange = () => {
      this._updateGridBackground();
      this._updateVisibility();
      this._connectors.render();
      this._zoomControls.updateLabel();
      if (this._onZoomChange) this._onZoomChange(this._transform.zoom);
    };

    this._pointer = new PointerStateMachine(
      this._stageEl,
      this._transformEl,
      this._transform,
      this._artboardManager,
      {
        onReorder: (orderedIds) => {
          this._connectors.render();
          if (this._onReorder) this._onReorder(orderedIds);
          this._persistState();
        },
        onTransformChange,
      }
    );

    this._selection = new SelectionManager(
      this._stageEl,
      this._artboardManager,
      {
        onSelect: (desc) => {
          if (this._onSelect) this._onSelect(desc);
        },
        onDelete: (id) => {
          this.removeArtboard(id);
        },
      }
    );

    this._connectors = new ConnectorRenderer(
      this._transformEl,
      this._artboardManager,
      this._transform
    );

    this._zoomControls = new ZoomControlsUI(
      this._stageEl,
      this._transform,
      this._artboardManager,
      { onTransformChange }
    );

    this._zoomControls.render(this._transformEl, options.toolbarEl || null);

    // ── Context Menu wiring (Task 7.2) ──────────────────────────────────────
    this._contextMenu = new ContextMenu(this._stageEl, {
      onRegenerate: options.onRegenerate || null,
      onDownload: options.onDownload || null,
      onDelete: options.onDelete || null,
      onDuplicate: options.onDuplicate || null,
    });

    // Right-click context menu on artboards
    this._onContextMenu = this._onContextMenu.bind(this);
    this._stageEl.addEventListener("contextmenu", this._onContextMenu);

    // Long-press detection for touch devices
    this._onLongPressStart = this._onLongPressStart.bind(this);
    this._onLongPressMove = this._onLongPressMove.bind(this);
    this._onLongPressEnd = this._onLongPressEnd.bind(this);
    this._stageEl.addEventListener("touchstart", this._onLongPressStart, { passive: true });
    this._stageEl.addEventListener("touchmove", this._onLongPressMove, { passive: true });
    this._stageEl.addEventListener("touchend", this._onLongPressEnd);
    this._stageEl.addEventListener("touchcancel", this._onLongPressEnd);
  }

  /**
   * Load output metadata, build artboards and overlays, reconcile DOM,
   * and restore or apply default layout.
   *
   * @param {object} output - PostMetadata from the server.
   * @param {object} [brief] - Optional brief data (unused currently, reserved for future).
   */
  loadOutput(output, brief) {
    this._output = output;

    // Build descriptors
    const artboards = buildArtboardDescriptors(output);
    const overlays = buildOverlayDescriptors(output);

    console.log("[canvas-engine] loadOutput:", output?.post_id);
    console.log("[canvas-engine] artboards:", artboards.length, artboards.map(a => `${a.label} → ${a.assetUrl}`));
    console.log("[canvas-engine] overlays:", overlays.length);

    this._artboardManager.artboards = artboards;
    this._artboardManager.overlays = overlays;
    this._artboardManager.strategyCard = buildStrategyCard(output);

    // Batch DOM updates into rAF
    this._scheduleUpdate(() => {
      this._artboardManager.reconcile(this._transformEl);

      // Try to restore persisted state
      const postId = output && output.post_id;
      const saved = postId ? PersistenceManager.load(postId) : null;

      if (saved) {
        this.restoreCanvasState(saved);
      } else if (artboards.length) {
        // Apply default zoom-to-fit
        const fit = calcZoomToFit(
          artboards,
          this._stageEl.clientWidth,
          this._stageEl.clientHeight
        );
        this._transform.zoom = fit.zoom;
        this._transform.panX = fit.panX;
        this._transform.panY = fit.panY;
      }

      this._transformEl.style.transform = this._transform.toCSSTransform();
      this._updateGridBackground();
      this._zoomControls.updateLabel();

      // Update viewport for connectors and culling
      this._connectors.setViewport(this._stageEl.clientWidth, this._stageEl.clientHeight);
      this._connectors.render();
      this._updateVisibility();

      if (this._onZoomChange) this._onZoomChange(this._transform.zoom);
    });
  }

  /**
   * Add an uploaded image as a new artboard on the canvas.
   *
   * Creates an ArtboardDescriptor from the upload result, positions it after
   * the last existing artboard in the horizontal strip, appends it to the
   * artboard manager, and reconciles the DOM.
   *
   * @param {{ filename: string, url: string, mimeType: string }} uploadResult
   * @returns {object} The created ArtboardDescriptor.
   */
  addUploadedArtboard(uploadResult) {
    const artboards = this._artboardManager.artboards;

    // Calculate x position after the last artboard
    let x = STRIP_START_X;
    if (artboards.length) {
      const last = artboards.reduce((a, b) => (a.x + a.width > b.x + b.width ? a : b));
      x = last.x + last.width + STRIP_GAP;
    }

    const order = artboards.length;
    const slideNumber = order + 1;
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const descriptor = {
      id,
      type: 'image',
      role: 'uploaded',
      label: `${pad2(slideNumber)} — Uploaded`,
      assetUrl: uploadResult.url,
      slideNumber,
      prompt: '',
      text: uploadResult.filename || '',
      x,
      y: STRIP_START_Y,
      width: ARTBOARD_W,
      height: ARTBOARD_H,
      isVariant: false,
      originalId: null,
      order,
    };

    artboards.push(descriptor);

    this._scheduleUpdate(() => {
      this._artboardManager.reconcile(this._transformEl);
      this._connectors.render();
      this._updateVisibility();
    });

    return descriptor;
  }

  /**
   * Remove an artboard from the canvas by ID.
   *
   * Filters the artboard from the manager's array, deselects it if it was
   * selected, reconciles the DOM, updates connectors, and persists state.
   *
   * @param {string} id - The artboard ID to remove.
   */
  removeArtboard(id) {
    const artboards = this._artboardManager.artboards;
    const idx = artboards.findIndex((d) => d.id === id);
    if (idx === -1) return;

    // Deselect if the removed artboard was selected
    const selected = this._selection.getSelected();
    if (selected && selected.id === id) {
      this._selection.deselect();
    }

    // Remove from array
    this._artboardManager.artboards = artboards.filter((d) => d.id !== id);

    this._scheduleUpdate(() => {
      this._artboardManager.reconcile(this._transformEl);
      this._connectors.render();
      this._updateVisibility();
      this._persistState();
    });
  }

  /**
   * Duplicate an artboard by ID.
   *
   * Clones the artboard descriptor with a new unique ID and offsets its x
   * position by the artboard width plus the strip gap. The duplicate is
   * appended to the artboards array and the DOM is reconciled.
   *
   * @param {string} id - The artboard ID to duplicate.
   * @returns {object|null} The new duplicated descriptor, or null if not found.
   */
  duplicateArtboard(id) {
    const artboards = this._artboardManager.artboards;
    const source = artboards.find((d) => d.id === id);
    if (!source) return null;

    const newId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `dup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const duplicate = {
      ...source,
      id: newId,
      x: source.x + source.width + STRIP_GAP,
      isVariant: true,
      originalId: source.id,
      order: artboards.length,
      label: `${pad2(artboards.length + 1)} — ${capitalizeRole(source.role)}`,
    };

    artboards.push(duplicate);

    this._scheduleUpdate(() => {
      this._artboardManager.reconcile(this._transformEl);
      this._connectors.render();
      this._updateVisibility();
    });

    return duplicate;
  }

  /**
   * Get the currently selected artboard descriptor.
   * @returns {object|null}
   */
  getSelectedArtboard() {
    return this._selection.getSelected();
  }

  /**
   * Programmatically reorder artboards.
   * @param {Array<string>} orderedIds - Array of artboard IDs in desired order.
   */
  setArtboardOrder(orderedIds) {
    let x = STRIP_START_X;
    for (let i = 0; i < orderedIds.length; i++) {
      const desc = this._artboardManager.artboards.find((d) => d.id === orderedIds[i]);
      if (desc) {
        desc.x = x;
        desc.y = STRIP_START_Y;
        desc.order = i;
        desc.label = `${pad2(i + 1)} — ${capitalizeRole(desc.role)}`;
        x += desc.width + STRIP_GAP;
      }
    }
    this._scheduleUpdate(() => {
      this._artboardManager.reconcile(this._transformEl);
      this._connectors.render();
      this._persistState();
    });
  }

  /**
   * Get the current canvas state for persistence.
   * @returns {{ zoom: number, panX: number, panY: number, artboardOrder: string[] }}
   */
  getCanvasState() {
    const orderedIds = [...this._artboardManager.artboards]
      .sort((a, b) => a.order - b.order)
      .map((d) => d.id);
    return {
      zoom: this._transform.zoom,
      panX: this._transform.panX,
      panY: this._transform.panY,
      artboardOrder: orderedIds,
    };
  }

  /**
   * Restore a previously saved canvas state.
   * @param {object} state - { zoom, panX, panY, artboardOrder }
   */
  restoreCanvasState(state) {
    if (!state) return;
    if (typeof state.zoom === "number") this._transform.zoom = state.zoom;
    if (typeof state.panX === "number") this._transform.panX = state.panX;
    if (typeof state.panY === "number") this._transform.panY = state.panY;
    this._transform.clampZoom();

    if (Array.isArray(state.artboardOrder) && state.artboardOrder.length) {
      this.setArtboardOrder(state.artboardOrder);
    }

    this._transformEl.style.transform = this._transform.toCSSTransform();
    this._updateGridBackground();
    this._zoomControls.updateLabel();
    if (this._onZoomChange) this._onZoomChange(this._transform.zoom);
  }

  /**
   * Get the current output metadata.
   * @returns {object|null}
   */
  getOutput() {
    return this._output;
  }

  /**
   * Get all artboard descriptors.
   * @returns {Array<object>}
   */
  getArtboards() {
    return this._artboardManager.artboards;
  }

  /**
   * Rearrange artboards vertically (for mobile/narrow viewports).
   * All artboards share the same x position, stacked with consistent spacing.
   */
  arrangeVertical() {
    const artboards = this._artboardManager.artboards;
    if (!artboards.length) return;
    const x = 40;
    let y = 40;
    const gap = 32;
    for (const a of artboards) {
      a.x = x;
      a.y = y;
      y += a.height + gap;
    }
    // Also reposition overlays above the artboards
    const overlays = this._artboardManager.overlays;
    let oy = 40;
    for (const o of overlays) {
      o.x = x;
      o.y = oy;
      oy += o.height + 16;
    }
    // Shift artboards below overlays
    if (overlays.length) {
      const overlayBottom = oy + 20;
      for (const a of artboards) {
        a.y += overlayBottom - 40;
      }
    }
    this._scheduleUpdate(() => {
      this._artboardManager.reconcile(this._transformEl);
      this._connectors.render();
    });
  }

  /**
   * Rearrange artboards horizontally (default desktop layout).
   */
  arrangeHorizontal() {
    const artboards = this._artboardManager.artboards;
    if (!artboards.length) return;
    let x = STRIP_START_X;
    for (const a of artboards) {
      a.x = x;
      a.y = STRIP_START_Y;
      x += a.width + STRIP_GAP;
    }
    this._scheduleUpdate(() => {
      this._artboardManager.reconcile(this._transformEl);
      this._connectors.render();
    });
  }

  // ── Context Menu Event Handlers (Task 7.2) ─────────────────────────────────

  /**
   * Find the artboard element at a given target element (walks up the DOM).
   * @param {HTMLElement} el
   * @returns {HTMLElement|null}
   */
  _findArtboardEl(el) {
    let node = el;
    while (node && node !== this._stageEl) {
      if (node.classList && node.classList.contains("canvas-artboard")) return node;
      node = node.parentElement;
    }
    return null;
  }

  /**
   * Get the artboard descriptor for a given artboard DOM element.
   * @param {HTMLElement} artboardEl
   * @returns {object|null}
   */
  _getDescriptorForEl(artboardEl) {
    if (!artboardEl) return null;
    const id = artboardEl.dataset.artboardId;
    return this._artboardManager.artboards.find((d) => d.id === id) || null;
  }

  /**
   * Handle right-click (contextmenu) event on the stage.
   * Shows context menu if an artboard was right-clicked.
   * @param {MouseEvent} e
   */
  _onContextMenu(e) {
    const artboardEl = this._findArtboardEl(e.target);
    if (!artboardEl) return; // Let default context menu show on empty space

    e.preventDefault();
    const desc = this._getDescriptorForEl(artboardEl);
    if (desc) {
      this._contextMenu.show(e.clientX, e.clientY, desc);
    }
  }

  /**
   * Handle touchstart for long-press detection.
   * Starts a 500ms timer; if the touch doesn't move significantly, triggers context menu.
   * @param {TouchEvent} e
   */
  _onLongPressStart(e) {
    // Only detect long-press for single-finger touches
    if (e.touches.length !== 1) {
      this._cancelLongPress();
      return;
    }

    const touch = e.touches[0];
    const artboardEl = this._findArtboardEl(touch.target);
    if (!artboardEl) return; // Only trigger on artboards

    this._longPressStart = { x: touch.clientX, y: touch.clientY };

    this._longPressTimer = setTimeout(() => {
      this._longPressTimer = null;
      const desc = this._getDescriptorForEl(artboardEl);
      if (desc && this._longPressStart) {
        this._contextMenu.show(this._longPressStart.x, this._longPressStart.y, desc);
      }
      this._longPressStart = null;
    }, CanvasEngine.LONG_PRESS_MS);
  }

  /**
   * Handle touchmove — cancel long-press if finger moves too far.
   * @param {TouchEvent} e
   */
  _onLongPressMove(e) {
    if (!this._longPressTimer || !this._longPressStart) return;

    const touch = e.touches[0];
    const dx = touch.clientX - this._longPressStart.x;
    const dy = touch.clientY - this._longPressStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > CanvasEngine.LONG_PRESS_MOVE_THRESHOLD) {
      this._cancelLongPress();
    }
  }

  /**
   * Handle touchend/touchcancel — cancel long-press timer.
   * @param {TouchEvent} e
   */
  _onLongPressEnd(e) {
    this._cancelLongPress();
  }

  /**
   * Cancel any pending long-press timer.
   */
  _cancelLongPress() {
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }
    this._longPressStart = null;
  }

  /**
   * Clean up all event listeners and DOM elements.
   */
  destroy() {
    this._pointer.destroy();
    this._selection.destroy();
    this._connectors.destroy();
    this._zoomControls.destroy();
    this._contextMenu.destroy();
    this._cancelLongPress();
    this._stageEl.removeEventListener("contextmenu", this._onContextMenu);
    this._stageEl.removeEventListener("touchstart", this._onLongPressStart);
    this._stageEl.removeEventListener("touchmove", this._onLongPressMove);
    this._stageEl.removeEventListener("touchend", this._onLongPressEnd);
    this._stageEl.removeEventListener("touchcancel", this._onLongPressEnd);
    if (this._transformEl && this._transformEl.parentNode) {
      this._transformEl.remove();
    }
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
    }
  }

  /**
   * Batch a DOM update into requestAnimationFrame.
   * @param {function} fn
   */
  _scheduleUpdate(fn) {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = requestAnimationFrame(() => {
      fn();
      this._rafId = 0;
    });
  }

  /**
   * Persist current canvas state to localStorage.
   */
  _persistState() {
    const postId = this._output && this._output.post_id;
    if (postId) {
      PersistenceManager.save(postId, this.getCanvasState());
    }
  }

  /**
   * Update viewport culling / lazy loading.
   */
  _updateVisibility() {
    classifyVisibility(
      this._artboardManager.artboards,
      this._transform,
      this._stageEl.clientWidth,
      this._stageEl.clientHeight,
      this._transformEl
    );
  }

  /**
   * Apply the dot-grid background pattern to the stage.
   * Uses CSS radial-gradient that scales with zoom.
   */
  _applyGridBackground() {
    this._updateGridBackground();
  }

  /**
   * Update the grid background to scale with the current zoom level.
   */
  _updateGridBackground() {
    const gridSize = 24 * this._transform.zoom;
    const offsetX = this._transform.panX % gridSize;
    const offsetY = this._transform.panY % gridSize;
    this._stageEl.style.backgroundImage =
      `radial-gradient(circle, rgba(175,179,170,0.35) 1px, transparent 1px)`;
    this._stageEl.style.backgroundSize = `${gridSize}px ${gridSize}px`;
    this._stageEl.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
  }
}
