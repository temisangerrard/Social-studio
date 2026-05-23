/**
 * Canvas Engine — infinite workflow canvas with draggable nodes, bezier connections,
 * dot-grid background, and cursor-centered zoom/pan.
 *
 * Public API preserved for compatibility with app.js / generation.js / inspector.js.
 */

// ── TransformState ────────────────────────────────────────────────────────────

const ZOOM_STEP = 0.08;
const ZOOM_MIN = 0.05;
const ZOOM_MAX = 4;

export class TransformState {
  zoom = 1;
  panX = 0;
  panY = 0;

  applyWheelZoom(delta, cursorX, cursorY) {
    const canvasPt = this.screenToCanvas(cursorX, cursorY);
    const direction = delta > 0 ? -1 : 1;
    this.zoom *= 1 + direction * ZOOM_STEP;
    this.clampZoom();
    this.panX = cursorX - canvasPt.x * this.zoom;
    this.panY = cursorY - canvasPt.y * this.zoom;
  }

  applyPinchZoom(scaleDelta, centerX, centerY) {
    const canvasPt = this.screenToCanvas(centerX, centerY);
    this.zoom *= scaleDelta;
    this.clampZoom();
    this.panX = centerX - canvasPt.x * this.zoom;
    this.panY = centerY - canvasPt.y * this.zoom;
  }

  applyPan(dx, dy) {
    this.panX += dx;
    this.panY += dy;
  }

  clampZoom() {
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.zoom));
  }

  toCSSTransform() {
    return `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }

  screenToCanvas(screenX, screenY) {
    return {
      x: (screenX - this.panX) / this.zoom,
      y: (screenY - this.panY) / this.zoom,
    };
  }

  canvasToScreen(canvasX, canvasY) {
    return {
      x: canvasX * this.zoom + this.panX,
      y: canvasY * this.zoom + this.panY,
    };
  }

  fitToRect(rect, padding = 80) {
    const stage = document.getElementById("studio-canvas-stage");
    if (!stage) return;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const contentW = rect.width + padding * 2;
    const contentH = rect.height + padding * 2;
    this.zoom = Math.min(w / contentW, h / contentH, 1.5);
    this.clampZoom();
    this.panX = (w - contentW * this.zoom) / 2 - (rect.x - padding) * this.zoom;
    this.panY = (h - contentH * this.zoom) / 2 - (rect.y - padding) * this.zoom;
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const NODE_W = 320;
const SNAP_GRID = 16;

function snapToGrid(v) {
  return Math.round(v / SNAP_GRID) * SNAP_GRID;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function capitalizeRole(s) {
  const cleaned = String(s || "").replace(/_/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// ── Artboard Descriptor Builder ───────────────────────────────────────────────

function detectType(item) {
  if (item.kind === "video") return "video";
  if (item.kind === "document") return "document";
  if (item.type === "generated_image" || item.type === "text_only") return "image";
  if (item.kind) return item.kind;
  return "image";
}

export function resolveAssetUrl(output, item, slides = [], hintSlideNumber = null) {
  if (!output || !item) return null;

  if (item.asset_path) {
    const filename = item.asset_path.split("/").pop();
    if (filename && output.post_id && !filename.endsWith(".txt")) {
      return `/api/assets/${output.post_id}/${filename}`;
    }
  }

  if (item.preview_path) {
    const filename = item.preview_path.split("/").pop();
    if (filename && output.post_id && !filename.endsWith(".txt")) {
      return `/api/assets/${output.post_id}/${filename}`;
    }
  }

  const slideNumber = item.slide_number ?? hintSlideNumber;

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

  if (typeof slideNumber === "number" && !Number.isNaN(slideNumber) && output.render_status !== "skipped") {
    return `/api/slides/${output.post_id}/slide-${pad2(slideNumber)}.png`;
  }

  return null;
}

/**
 * Build artboard descriptors arranged as a workflow chain.
 * Nodes are placed in a 2-column grid initially; users drag freely after.
 */
export function buildArtboardDescriptors(output) {
  if (!output) return [];

  const items = (output.artifacts && output.artifacts.length)
    ? output.artifacts
    : (output.slides || []);
  const slides = output.slides || [];
  const platform = output.platform || (output.platform_targets && output.platform_targets[0]) || "";

  const artboardH = platform === "tiktok" ? 420 : platform === "instagram" ? 336 : 320;

  return items.map((item, index) => {
    const slideNumber = item.slide_number ?? (index + 1);
    const role = item.role || "slide";
    const type = detectType(item);
    const label = `${pad2(slideNumber)} — ${capitalizeRole(role)}`;
    const assetUrl = resolveAssetUrl(output, item, slides, slideNumber);

    // 2-column grid layout
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 200 + col * (NODE_W + 80);
    const y = 120 + row * (artboardH + 100);

    return {
      id: item.id || `artboard-${pad2(slideNumber)}`,
      type,
      role,
      label,
      assetUrl,
      slideNumber,
      prompt: item.image_prompt || item.prompt || "",
      text: item.text || item.title || "",
      provider: item.provider || item.generation?.provider || "",
      model: item.model || item.generation?.model || "",
      requestId: item.request_id || item.generation?.request_id || null,
      status: item.status || item.generation?.status || (assetUrl ? "complete" : ""),
      error: item.error || item.generation?.error || null,
      payload: item.payload || item.generation?.payload || null,
      outputUrl: item.output_url || item.generation?.output_url || null,
      generatedAt: item.generated_at || item.generation?.generated_at || null,
      retryable: item.retryable ?? item.generation?.retryable ?? false,
      x,
      y,
      width: NODE_W,
      height: artboardH,
      isVariant: false,
      originalId: null,
      order: index,
    };
  });
}

// ── Overlay Descriptor Builder ────────────────────────────────────────────────

export function buildOverlayDescriptors(output) {
  if (!output) return [];

  const platform = output.platform || (output.platform_targets && output.platform_targets[0]) || "";
  const artboardH = platform === "tiktok" ? 420 : platform === "instagram" ? 336 : 320;
  const items = (output.artifacts && output.artifacts.length) ? output.artifacts : (output.slides || []);
  const COLS = 2;
  const numRows = Math.max(1, Math.ceil(items.length / COLS));

  const belowY = 120 + numRows * (artboardH + 100) - 100 + 64;
  const overlayWidth = 340;
  const overlays = [];
  let y = belowY;

  if (output.caption) {
    overlays.push({
      id: "overlay-caption",
      type: "caption",
      text: output.caption,
      x: 200,
      y,
      width: overlayWidth,
      height: 120,
    });
    y += 140;
  }

  const hooks = output.hooks || [];
  hooks.forEach((hook, i) => {
    overlays.push({
      id: `overlay-hook-${i}`,
      type: "hook",
      text: hook,
      x: 200,
      y,
      width: overlayWidth,
      height: 120,
    });
    y += 140;
  });

  const hashtags = output.hashtags || [];
  if (hashtags.length) {
    overlays.push({
      id: "overlay-hashtags",
      type: "hashtag",
      text: hashtags.join(" "),
      x: 200,
      y,
      width: overlayWidth,
      height: 120,
    });
  }

  return overlays;
}

export function buildStrategyCard(output) {
  const d = output?.routing_decision;
  if (!d) return null;
  return {
    id: "strategy-card",
    workflowType: d.workflowType || output.workflow_type || "slideshow",
    platform: (output.platform_targets || [])[0] || "",
    recipeId: d.recipeId || d.contentTypeId || "",
    confidence: typeof d.confidence === "number" ? d.confidence : null,
    x: 200,
    y: 24,
    width: 480,
  };
}

// ── Selection ─────────────────────────────────────────────────────────────────

class Selection {
  constructor() {
    this._selected = null;
    this._listeners = [];
  }

  select(id) {
    this._selected = id;
    this._emit();
  }

  deselect() {
    this._selected = null;
    this._emit();
  }

  getSelected() {
    return this._selected;
  }

  onChange(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(l => l !== fn); };
  }

  _emit() {
    for (const fn of this._listeners) fn(this._selected);
  }
}

// ── Connection Manager ────────────────────────────────────────────────────────

class ConnectionManager {
  connections = [];

  autoConnect(artboards) {
    this.connections = [];
    for (let i = 0; i < artboards.length - 1; i++) {
      this.connections.push({
        id: `conn-${artboards[i].id}-to-${artboards[i + 1].id}`,
        from: artboards[i].id,
        to: artboards[i + 1].id,
      });
    }
  }

  getConnections() { return [...this.connections]; }

  render(svgEl, artboards) {
    if (!svgEl) return;
    svgEl.innerHTML = "";

    // Defs for arrow marker
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "arrowhead");
    marker.setAttribute("markerWidth", "10");
    marker.setAttribute("markerHeight", "7");
    marker.setAttribute("refX", "10");
    marker.setAttribute("refY", "3.5");
    marker.setAttribute("orient", "auto");
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", "0 0, 10 3.5, 0 7");
    polygon.setAttribute("fill", "#94a3b8");
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svgEl.appendChild(defs);

    for (const conn of this.connections) {
      const fromNode = artboards.find(a => a.id === conn.from);
      const toNode = artboards.find(a => a.id === conn.to);
      if (!fromNode || !toNode) continue;

      const fromX = fromNode.x + fromNode.width;
      const fromY = fromNode.y + (fromNode.height || 300) / 2;
      const toX = toNode.x;
      const toY = toNode.y + (toNode.height || 300) / 2;

      const dx = Math.abs(toX - fromX);
      const cpOffset = Math.max(dx * 0.4, 60);

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M ${fromX} ${fromY} C ${fromX + cpOffset} ${fromY}, ${toX - cpOffset} ${toY}, ${toX} ${toY}`);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#94a3b8");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("marker-end", "url(#arrowhead)");
      svgEl.appendChild(path);
    }
  }
}

// ── Pointer Manager ───────────────────────────────────────────────────────────
// Stub for backward compatibility with app.js overlay editing

class PointerManager {
  setEditingActive() {}
}

// ── CanvasEngine ──────────────────────────────────────────────────────────────

export class CanvasEngine {
  constructor(stageEl, options = {}) {
    this.stage = stageEl;
    this.transform = new TransformState();
    this._selection = new Selection();
    this._connections = new ConnectionManager();
    this._pointer = new PointerManager();

    this._artboards = [];
    this._overlays = [];
    this._strategyCard = null;
    this._output = null;

    this._domNodes = new Map();
    this._domOverlays = new Map();
    this._svgConnections = null;
    this._transformContainer = null;
    this._gridBg = null;
    this._nodesContainer = null;
    this._overlaysContainer = null;

    this._drag = null;
    this._pan = null;

    // Callbacks from options
    this._onSelect = options.onSelect || null;
    this._onZoomChange = options.onZoomChange || null;
    this._onReorder = options.onReorder || null;
    this._onRegenerate = options.onRegenerate || null;
    this._onDownload = options.onDownload || null;
    this._onDelete = options.onDelete || null;
    this._onDuplicate = options.onDuplicate || null;
    this._toolbarEl = options.toolbarEl || null;

    // Expose artboards array for app.js direct access
    this._artboardManager = {
      artboards: this._artboards,
      overlays: this._overlays,
      strategyCard: null,
    };

    this._init();
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  _init() {
    this.stage.innerHTML = "";
    this.stage.style.overflow = "hidden";
    this.stage.style.position = "relative";

    // Dot grid background
    this._gridBg = document.createElement("div");
    this._gridBg.className = "canvas-dot-grid";
    this._gridBg.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:0;";
    this.stage.appendChild(this._gridBg);

    // Transform container
    this._transformContainer = document.createElement("div");
    this._transformContainer.className = "canvas-transform";
    this._transformContainer.style.cssText = "position:absolute;top:0;left:0;transform-origin:0 0;z-index:1;";
    this.stage.appendChild(this._transformContainer);

    // SVG layer for connections
    this._svgConnections = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this._svgConnections.className = "canvas-connector-svg";
    this._svgConnections.style.cssText = "position:absolute;top:0;left:0;width:1px;height:1px;overflow:visible;pointer-events:none;z-index:1;";
    this._transformContainer.appendChild(this._svgConnections);

    // Nodes container
    this._nodesContainer = document.createElement("div");
    this._nodesContainer.className = "canvas-nodes";
    this._nodesContainer.style.cssText = "position:absolute;top:0;left:0;z-index:2;";
    this._transformContainer.appendChild(this._nodesContainer);

    // Overlays container
    this._overlaysContainer = document.createElement("div");
    this._overlaysContainer.className = "canvas-overlays";
    this._overlaysContainer.style.cssText = "position:absolute;top:0;left:0;z-index:3;";
    this._transformContainer.appendChild(this._overlaysContainer);

    // Progress pill
    const progressPill = document.createElement("div");
    progressPill.id = "canvas-progress-pill";
    progressPill.className = "canvas-progress-pill hidden";
    progressPill.setAttribute("aria-live", "polite");
    progressPill.innerHTML = `<span class="canvas-progress-pill__dot"></span><span id="canvas-progress-text">Working…</span>`;
    this.stage.appendChild(progressPill);

    // Empty state
    const emptyState = document.createElement("div");
    emptyState.id = "canvas-empty";
    emptyState.className = "canvas-empty";
    emptyState.innerHTML = `<h3>What do you want to create?</h3><p>Choose a style, enter your idea, and hit generate.</p>`;
    this.stage.appendChild(emptyState);

    // AI prompt bar
    const aiPrompt = document.createElement("form");
    aiPrompt.id = "canvas-ai-prompt";
    aiPrompt.className = "canvas-ai-prompt hidden";
    aiPrompt.autocomplete = "off";
    aiPrompt.innerHTML = `<input id="canvas-ai-input" type="text" placeholder="Adjust the tone… / Swap the visual… / Try a different hook…" /><button type="submit" class="canvas-ai-submit">Refine</button><span id="canvas-ai-status" class="canvas-ai-status hidden"></span>`;
    this.stage.appendChild(aiPrompt);

    this._bindEvents();
    this._updateTransform();
  }

  // ── Events ────────────────────────────────────────────────────────────────

  _bindEvents() {
    // Pan: middle mouse or space+drag on empty area
    this.stage.addEventListener("mousedown", (e) => {
      if (e.button === 1 || (e.button === 0 && e.target === this.stage)) {
        e.preventDefault();
        this._pan = {
          startX: e.clientX,
          startY: e.clientY,
          startPanX: this.transform.panX,
          startPanY: this.transform.panY,
        };
        this.stage.style.cursor = "grabbing";
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (this._pan) {
        this.transform.panX = this._pan.startPanX + (e.clientX - this._pan.startX);
        this.transform.panY = this._pan.startPanY + (e.clientY - this._pan.startY);
        this._updateTransform();
      }
      if (this._drag) {
        const canvasPt = this.transform.screenToCanvas(e.clientX, e.clientY);
        const node = this._artboards.find(a => a.id === this._drag.nodeId);
        if (node) {
          node.x = snapToGrid(canvasPt.x - this._drag.offsetX);
          node.y = snapToGrid(canvasPt.y - this._drag.offsetY);
          const el = this._domNodes.get(node.id);
          if (el) {
            el.style.left = `${node.x}px`;
            el.style.top = `${node.y}px`;
          }
          this._connections.render(this._svgConnections, this._artboards);
        }
      }
    });

    window.addEventListener("mouseup", () => {
      this._pan = null;
      this._drag = null;
      this.stage.style.cursor = "";
    });

    // Wheel zoom
    this.stage.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.transform.applyWheelZoom(e.deltaY, e.clientX, e.clientY);
      this._updateTransform();
      this._updateGridBg();
    }, { passive: false });

    // Double-click to fit
    this.stage.addEventListener("dblclick", (e) => {
      if (e.target === this.stage) this.fitAll();
    });

    // Deselect on background click
    this.stage.addEventListener("click", (e) => {
      if (e.target === this.stage) {
        this._selection.deselect();
        this._clearSelectionRing();
      }
    });
  }

  // ── Transform / Grid ──────────────────────────────────────────────────────

  _updateTransform() {
    if (this._transformContainer) {
      this._transformContainer.style.transform = this.transform.toCSSTransform();
    }
  }

  _updateGridBg() {
    if (!this._gridBg) return;
    const gridSize = 32 * this.transform.zoom;
    if (gridSize < 6) {
      this._gridBg.style.backgroundImage = "none";
      return;
    }
    const panX = this.transform.panX % gridSize;
    const panY = this.transform.panY % gridSize;
    const opacity = Math.min(1, Math.max(0.05, (this.transform.zoom - 0.1) * 0.5));
    this._gridBg.style.backgroundImage = `radial-gradient(circle, rgba(148,163,184,${opacity}) 1px, transparent 1px)`;
    this._gridBg.style.backgroundSize = `${gridSize}px ${gridSize}px`;
    this._gridBg.style.backgroundPosition = `${panX}px ${panY}px`;
  }

  // ── Node Rendering ────────────────────────────────────────────────────────

  _createNodeElement(desc) {
    const el = document.createElement("div");
    el.className = "canvas-artboard";
    el.dataset.artboardId = desc.id;
    el.style.cssText = `position:absolute;left:${desc.x}px;top:${desc.y}px;width:${desc.width}px;height:${desc.height}px;`;

    // Header bar
    const header = document.createElement("div");
    header.className = "canvas-artboard__header";
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#f8fafc;border-radius:12px 12px 0 0;border-bottom:1px solid #e2e8f0;";

    const title = document.createElement("span");
    title.className = "canvas-artboard__label";
    title.style.cssText = "position:static;font-size:12px;font-weight:600;color:#475569;";
    title.textContent = desc.label;
    header.appendChild(title);

    const badge = document.createElement("span");
    badge.className = "canvas-artboard__badge";
    badge.textContent = desc.status === "complete" ? "DONE" : desc.error ? "ERR" : desc.status || "WAITING";
    if (desc.status === "complete") badge.style.background = "rgba(22,101,52,0.15)";
    else if (desc.error) badge.style.background = "rgba(153,27,27,0.15)";
    header.appendChild(badge);

    el.appendChild(header);

    // Media area
    const mediaArea = document.createElement("div");
    mediaArea.className = "canvas-artboard__media";
    mediaArea.style.cssText = "position:relative;background:#f1f5f9;overflow:hidden;cursor:pointer;height:calc(100% - 64px);display:flex;align-items:center;justify-content:center;";

    if (desc.type === "video" && desc.assetUrl) {
      const video = document.createElement("video");
      video.src = desc.assetUrl;
      video.controls = true;
      video.playsInline = true;
      video.style.cssText = "width:100%;height:100%;object-fit:contain;display:block;";
      mediaArea.appendChild(video);
    } else if (desc.assetUrl) {
      const img = document.createElement("img");
      img.src = desc.assetUrl;
      img.alt = desc.label;
      img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
      img.onload = () => el.classList.remove("canvas-artboard--loading");
      img.onerror = () => {
        el.classList.add("canvas-artboard--error");
        mediaArea.innerHTML = `<div class="canvas-artboard__error">Failed to load</div>`;
      };
      mediaArea.appendChild(img);
      el.classList.add("canvas-artboard--loading");
    } else {
      mediaArea.innerHTML = `<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">Generating…</div>`;
    }
    el.appendChild(mediaArea);

    // Connection ports
    const outPort = document.createElement("div");
    outPort.className = "canvas-node__port canvas-node__port--out";
    outPort.style.cssText = "position:absolute;right:-6px;top:50%;transform:translateY(-50%);width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid #cbd5e1;z-index:5;";
    el.appendChild(outPort);

    const inPort = document.createElement("div");
    inPort.className = "canvas-node__port canvas-node__port--in";
    inPort.style.cssText = "position:absolute;left:-6px;top:50%;transform:translateY(-50%);width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid #cbd5e1;z-index:5;";
    el.appendChild(inPort);

    // Click to select / open
    mediaArea.addEventListener("click", (e) => {
      e.stopPropagation();
      this._selection.select(desc.id);
      this._applySelectionRing(desc.id);
      this._onSelect?.(desc);
    });

    // Drag handle: header
    header.style.cursor = "grab";
    header.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const canvasPt = this.transform.screenToCanvas(e.clientX, e.clientY);
      this._drag = {
        nodeId: desc.id,
        offsetX: canvasPt.x - desc.x,
        offsetY: canvasPt.y - desc.y,
      };
      header.style.cursor = "grabbing";
    });
    header.addEventListener("mouseup", () => { header.style.cursor = "grab"; });

    return el;
  }

  _applySelectionRing(nodeId) {
    this._clearSelectionRing();
    const el = this._domNodes.get(nodeId);
    if (el) {
      el.classList.add("canvas-artboard--selected");
    }
  }

  _clearSelectionRing() {
    this._domNodes.forEach(el => el.classList.remove("canvas-artboard--selected"));
  }

  // ── Overlay Rendering ─────────────────────────────────────────────────────

  _createOverlayElement(desc) {
    const el = document.createElement("div");
    el.className = `canvas-overlay canvas-overlay--${desc.type}`;
    el.dataset.overlayId = desc.id;
    el.style.cssText = `position:absolute;left:${desc.x}px;top:${desc.y}px;width:${desc.width}px;`;

    const card = document.createElement("div");
    card.style.cssText = "background:rgba(255,255,255,0.95);border:1px solid rgba(175,179,170,0.18);border-radius:14px;padding:16px;box-shadow:0 2px 12px rgba(47,52,45,0.06);";

    const typeLabel = document.createElement("div");
    typeLabel.className = "canvas-overlay__chip";
    typeLabel.textContent = desc.type;
    card.appendChild(typeLabel);

    const body = document.createElement("p");
    body.className = "canvas-overlay__body";
    body.textContent = desc.text;
    card.appendChild(body);

    // Copy button
    const copyBtn = document.createElement("button");
    copyBtn.className = "canvas-overlay__copy";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => {
      navigator.clipboard?.writeText(desc.text);
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
    });
    card.appendChild(copyBtn);

    el.appendChild(card);

    // Drag overlay
    card.style.cursor = "grab";
    card.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const canvasPt = this.transform.screenToCanvas(e.clientX, e.clientY);
      const dragOverlay = {
        offsetX: canvasPt.x - desc.x,
        offsetY: canvasPt.y - desc.y,
      };

      const onMove = (ev) => {
        const pt = this.transform.screenToCanvas(ev.clientX, ev.clientY);
        desc.x = snapToGrid(pt.x - dragOverlay.offsetX);
        desc.y = snapToGrid(pt.y - dragOverlay.offsetY);
        el.style.left = `${desc.x}px`;
        el.style.top = `${desc.y}px`;
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        card.style.cursor = "grab";
      };

      card.style.cursor = "grabbing";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });

    return el;
  }

  // ── Scheduling ────────────────────────────────────────────────────────────

  _scheduleUpdate(fn) {
    requestAnimationFrame(fn);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Load output metadata, build artboards and overlays, render to DOM.
   * @param {object} output - PostMetadata from the server.
   * @param {object} [brief] - Reserved for future.
   */
  loadOutput(output, brief) {
    this._output = output;
    this._selection.deselect();

    const artboards = buildArtboardDescriptors(output);
    const overlays = buildOverlayDescriptors(output);

    this._artboards = artboards;
    this._overlays = overlays;
    this._strategyCard = buildStrategyCard(output);

    // Sync reference for app.js
    this._artboardManager.artboards = this._artboards;
    this._artboardManager.overlays = this._overlays;
    this._artboardManager.strategyCard = this._strategyCard;

    // Hide empty state
    const emptyEl = document.getElementById("canvas-empty");
    if (emptyEl) emptyEl.classList.add("hidden");

    // Clear old DOM
    this._domNodes.forEach(el => el.remove());
    this._domNodes.clear();
    this._domOverlays.forEach(el => el.remove());
    this._domOverlays.clear();

    // Create nodes
    for (const desc of artboards) {
      const el = this._createNodeElement(desc);
      this._nodesContainer.appendChild(el);
      this._domNodes.set(desc.id, el);
    }

    // Create overlays
    for (const desc of overlays) {
      const el = this._createOverlayElement(desc);
      this._overlaysContainer.appendChild(el);
      this._domOverlays.set(desc.id, el);
    }

    // Auto-connect
    this._connections.autoConnect(artboards);
    this._connections.render(this._svgConnections, artboards);

    // Zoom to fit
    if (artboards.length) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const a of artboards) {
        minX = Math.min(minX, a.x);
        minY = Math.min(minY, a.y);
        maxX = Math.max(maxX, a.x + a.width);
        maxY = Math.max(maxY, a.y + (a.height || 300));
      }
      this.transform.fitToRect({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
      this._updateTransform();
      this._updateGridBg();
    }

    if (this._onZoomChange) this._onZoomChange(this.transform.zoom);
  }

  /**
   * Add an uploaded image as a new artboard node.
   * @param {{ filename: string, url: string, mimeType: string }} uploadResult
   */
  addUploadedArtboard(uploadResult) {
    const order = this._artboards.length;
    const slideNumber = order + 1;
    const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Position after the last artboard
    let x = 200;
    if (this._artboards.length) {
      const last = this._artboards.reduce((a, b) => (a.x + a.width > b.x + b.width ? a : b));
      x = last.x + last.width + 48;
    }

    const desc = {
      id,
      type: "image",
      role: "uploaded",
      label: `${pad2(slideNumber)} — Uploaded`,
      assetUrl: uploadResult.url,
      slideNumber,
      prompt: "",
      text: uploadResult.filename || "",
      x,
      y: 120,
      width: NODE_W,
      height: 320,
      isVariant: false,
      originalId: null,
      order,
    };

    this._artboards.push(desc);
    const el = this._createNodeElement(desc);
    this._nodesContainer.appendChild(el);
    this._domNodes.set(desc.id, el);

    // Reconnect
    this._connections.autoConnect(this._artboards);
    this._connections.render(this._svgConnections, this._artboards);

    return desc;
  }

  /**
   * Remove an artboard by ID.
   * @param {string} id
   */
  removeArtboard(id) {
    const idx = this._artboards.findIndex(d => d.id === id);
    if (idx === -1) return;

    if (this._selection.getSelected() === id) {
      this._selection.deselect();
      this._clearSelectionRing();
    }

    this._artboards.splice(idx, 1);
    const el = this._domNodes.get(id);
    if (el) el.remove();
    this._domNodes.delete(id);

    this._connections.autoConnect(this._artboards);
    this._connections.render(this._svgConnections, this._artboards);
  }

  /**
   * Duplicate an artboard by ID.
   * @param {string} id
   */
  duplicateArtboard(id) {
    const source = this._artboards.find(d => d.id === id);
    if (!source) return;

    const newId = `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const desc = {
      ...source,
      id: newId,
      x: source.x + source.width + 48,
      y: source.y,
      isVariant: true,
      originalId: source.id,
      label: source.label + " (copy)",
    };

    this._artboards.push(desc);
    const el = this._createNodeElement(desc);
    this._nodesContainer.appendChild(el);
    this._domNodes.set(desc.id, el);

    this._connections.autoConnect(this._artboards);
    this._connections.render(this._svgConnections, this._artboards);

    return desc;
  }

  getArtboards() { return [...this._artboards]; }

  getSelectedArtboard() {
    const id = this._selection.getSelected();
    return this._artboards.find(a => a.id === id) || null;
  }

  selectArtboard(id) {
    this._selection.select(id);
    this._applySelectionRing(id);
    const desc = this._artboards.find(a => a.id === id);
    if (desc) this._onSelect?.(desc);
  }

  fitAll() {
    if (!this._artboards.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const a of this._artboards) {
      minX = Math.min(minX, a.x);
      minY = Math.min(minY, a.y);
      maxX = Math.max(maxX, a.x + a.width);
      maxY = Math.max(maxY, a.y + (a.height || 300));
    }
    this.transform.fitToRect({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
    this._updateTransform();
    this._updateGridBg();
  }

  set onSelect(fn) { this._onSelect = fn; }

  // Stub for backward compatibility
  reconcile() {}
  render() {}
}

// ── Downloads ─────────────────────────────────────────────────────────────────

export async function downloadArtboard(artboard) {
  if (!artboard?.assetUrl) return;
  const a = document.createElement("a");
  a.href = artboard.assetUrl;
  a.download = (artboard.label || "asset").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  a.click();
}

export async function downloadAllAsZip(artboardsOrEngine, output) {
  // Support both old API (artboards array, output) and new (canvasEngine)
  const artboards = Array.isArray(artboardsOrEngine)
    ? artboardsOrEngine
    : (artboardsOrEngine.getArtboards ? artboardsOrEngine.getArtboards() : []);

  if (!artboards.length) return;

  if (typeof JSZip === "undefined") {
    console.error("JSZip not loaded");
    return;
  }

  const zip = new JSZip();
  const folder = zip.folder("social-studio");

  for (const board of artboards) {
    if (board.assetUrl) {
      try {
        const res = await fetch(board.assetUrl);
        const blob = await res.blob();
        const ext = board.type === "video" ? "mp4" : "png";
        folder.file(`${board.label || board.id}.${ext}`, blob);
      } catch (e) {
        console.warn(`Failed to download ${board.id}:`, e);
      }
    }
  }

  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = "social-studio.zip";
  a.click();
  URL.revokeObjectURL(url);
}
