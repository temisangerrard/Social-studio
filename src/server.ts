import fs from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createInitialAssistantSession, generateAssistantReply } from "./assistant.ts";
import type { AssistantMessage } from "./types.ts";
import { runPipelineFromBrief, runPipelineFromRequest } from "./pipeline.ts";
import { defaultProductRegistry, registerBrandDescription, resolveProductContext } from "./product-context.ts";
import { createStorage } from "./storage.ts";
import type { AssistantSession, BatchGenerationRequest, BoardDocument, BrandProfile, CalendarSlot, ContentPillar, GenerationRequest, PostMetadata } from "./types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
loadEnv({ path: path.join(PROJECT_ROOT, ".env") });
const PUBLIC_ROOT = path.join(PROJECT_ROOT, "public");
const OUTPUTS_ROOT = path.join(PROJECT_ROOT, "workspace", "outputs");
const UPLOADS_ROOT = path.join(PROJECT_ROOT, "workspace", "uploads");
const JOBS_ROOT = path.join(PROJECT_ROOT, "workspace", "jobs");
const PORT = Number(process.env.PORT ?? 3000);
const storage = createStorage(PROJECT_ROOT);

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm"
]);

export function resolvePublicAssetPath(urlPath: string, publicRoot = PUBLIC_ROOT): string | null {
  if (urlPath.includes("..")) {
    return null;
  }

  const normalizedPath = path.posix.normalize(urlPath);
  if (!normalizedPath.startsWith("/")) {
    return null;
  }

  const relativePath = normalizedPath.slice(1);
  if (!relativePath || relativePath.includes("..")) {
    return null;
  }

  const resolvedPath = path.join(publicRoot, relativePath);
  const relativeToRoot = path.relative(publicRoot, resolvedPath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    return null;
  }

  return resolvedPath;
}

export function sanitizeStoredFilename(filename: string): string {
  const extension = path.extname(filename).toLowerCase();
  const basename = path.basename(filename, extension);
  const safeBase = basename
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const safeExt = extension.replace(/[^.a-z0-9]+/g, "");
  return `${safeBase || "upload"}${safeExt || ""}`;
}

export function decodeDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
  const match = /^data:([^;]+);base64,(.+)$/u.exec(dataUrl);
  if (!match) {
    throw new Error("Invalid data URL.");
  }
  const [, mimeType, encoded] = match;
  return {
    mimeType,
    buffer: Buffer.from(encoded, "base64")
  };
}

function uploadExtensionForMimeType(mimeType: string): string {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "video/mp4") return ".mp4";
  if (mimeType === "video/webm") return ".webm";
  return "";
}

interface Job {
  id: string;
  status: "pending" | "running" | "done" | "failed";
  stage: "queued" | "planning" | "generating" | "rendering" | "done" | "failed";
  progress?: string;
  brief?: Record<string, unknown>;
  request?: GenerationRequest;
  result?: PostMetadata;
  error?: string;
  createdAt: string;
}

const jobs = new Map<string, Job>();

async function saveJob(job: Job): Promise<void> {
  await fs.mkdir(JOBS_ROOT, { recursive: true });
  await fs.writeFile(path.join(JOBS_ROOT, `${job.id}.json`), JSON.stringify(job, null, 2));
}

async function loadPersistedJobs(): Promise<void> {
  try {
    const entries = await fs.readdir(JOBS_ROOT);
    await Promise.all(
      entries
        .filter((e) => e.endsWith(".json"))
        .map(async (entry) => {
          try {
            const raw = await fs.readFile(path.join(JOBS_ROOT, entry), "utf8");
            const job = JSON.parse(raw) as Job;
            // Mark interrupted in-progress jobs as failed
            if (job.status === "running" || job.status === "pending") {
              job.status = "failed";
              job.stage = "failed";
              job.error = "Server restarted while job was in progress";
              await saveJob(job);
            }
            jobs.set(job.id, job);
          } catch {
            // skip corrupt files
          }
        })
    );
  } catch {
    // jobs directory doesn't exist yet
  }
}

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

async function seedBrandProfiles(): Promise<void> {
  const configBrandsDir = path.join(PROJECT_ROOT, "config", "brands");
  let entries: string[];
  try {
    entries = await fs.readdir(configBrandsDir);
  } catch {
    return;
  }

  await Promise.all(
    entries
      .filter((f) => f.endsWith(".json") && !f.startsWith("default-"))
      .map(async (file) => {
        const id = file.replace(".json", "");
        const existing = await storage.getBrandProfile(id);
        if (existing) return;
        try {
          const raw = await fs.readFile(path.join(configBrandsDir, file), "utf8");
          await storage.saveBrandProfile(JSON.parse(raw) as BrandProfile);
          console.log(`[startup] Seeded brand profile: ${id}`);
        } catch {
          // skip malformed files
        }
      })
  );
}

async function ensureDefaultBrandProfile(): Promise<void> {
  // no-op: brands are now seeded at startup via seedBrandProfiles()
}

async function readBrandProfile(brandId: string): Promise<BrandProfile | null> {
  return storage.getBrandProfile(brandId);
}

async function listOutputs(): Promise<Array<{ postId: string; createdAt: string; product: string; platform: string }>> {
  try {
    const entries = await fs.readdir(OUTPUTS_ROOT, { withFileTypes: true });
    const results: Array<{ postId: string; createdAt: string; product: string; platform: string }> = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      try {
        const metadata = JSON.parse(await fs.readFile(path.join(OUTPUTS_ROOT, entry.name, "metadata.json"), "utf8")) as PostMetadata;
        results.push({
          postId: entry.name,
          createdAt: metadata.created_at,
          product: metadata.product,
          platform: metadata.platform
        });
      } catch {
        results.push({
          postId: entry.name,
          createdAt: "",
          product: "",
          platform: ""
        });
      }
    }

    return results.sort((a, b) => b.postId.localeCompare(a.postId));
  } catch {
    return [];
  }
}

async function readOutput(postId: string): Promise<PostMetadata | null> {
  try {
    const raw = await fs.readFile(path.join(OUTPUTS_ROOT, postId, "metadata.json"), "utf8");
    return JSON.parse(raw) as PostMetadata;
  } catch {
    return null;
  }
}

async function serveFile(filePath: string): Promise<Response> {
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      ext === ".html"
        ? "text/html; charset=utf-8"
        : ext === ".css"
          ? "text/css; charset=utf-8"
          : ext === ".js"
            ? "application/javascript; charset=utf-8"
            : ext === ".json"
              ? "application/json; charset=utf-8"
              : ext === ".txt"
                ? "text/plain; charset=utf-8"
            : ext === ".png"
              ? "image/png"
              : ext === ".svg"
                ? "image/svg+xml"
                : ext === ".jpg" || ext === ".jpeg"
                  ? "image/jpeg"
                  : ext === ".mp4"
                    ? "video/mp4"
                    : ext === ".webm"
                      ? "video/webm"
                  : "application/octet-stream";

    return new Response(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store"
      }
    });
  } catch {
    return json({ error: "Not found" }, { status: 404 });
  }
}

async function parseJsonBody(req: Request): Promise<Record<string, unknown>> {
  const payload = await req.json();
  return asRecord(payload);
}

function normalizeBoard(input: Record<string, unknown>): BoardDocument {
  const now = new Date().toISOString();
  return {
    id: typeof input.id === "string" && input.id.trim() ? input.id : makeId("board"),
    brandProfileId: typeof input.brandProfileId === "string" ? input.brandProfileId : "peppera",
    title: typeof input.title === "string" && input.title.trim() ? input.title : "Untitled board",
    rawIdea: typeof input.rawIdea === "string" ? input.rawIdea : "",
    notes: typeof input.notes === "string" ? input.notes : "",
    cards: Array.isArray(input.cards) ? (input.cards as BoardDocument["cards"]) : [],
    references: Array.isArray(input.references) ? (input.references as BoardDocument["references"]) : [],
    updatedAt: now
  };
}

function normalizeAssistantSession(input: Record<string, unknown>): AssistantSession {
  const session = input as unknown as Partial<AssistantSession>;
  const now = new Date().toISOString();

  return {
    id: session.id ?? makeId("session"),
    productId: session.productId ?? "peppera",
    status: session.status ?? "interviewing",
    currentQuestion: session.currentQuestion ?? "What are you trying to make today?",
    messages: session.messages ?? [],
    inferredBrief: session.inferredBrief ?? {
      goal: "",
      audience: "",
      offer: "",
      tone: "",
      platform: ""
    },
    checkpoints: session.checkpoints ?? {
      strategy: "pending",
      hooks: "pending",
      visuals: "pending",
      finalPackage: "pending"
    },
    workspaceCards: session.workspaceCards ?? [],
    createdAt: session.createdAt ?? now,
    updatedAt: now
  };
}

async function startGeneration(body: Record<string, unknown>): Promise<{ jobId: string; status: string }> {
  const jobId = makeId("gen");
  const job: Job = {
    id: jobId,
    status: "pending",
    stage: "queued",
    createdAt: new Date().toISOString()
  };
  jobs.set(jobId, job);
  await saveJob(job);

  const isLegacyBrief = typeof body.product === "string" && typeof body.idea === "string";
  if (isLegacyBrief) {
    job.brief = body;
  } else {
    job.request = body as unknown as GenerationRequest;
  }

  void (async () => {
    job.status = "running";
    job.stage = "planning";
    await saveJob(job);

    try {
      if (job.brief) {
        const result = await runPipelineFromBrief(job.brief as any, OUTPUTS_ROOT);
        job.result = result;
        job.status = "done";
        job.stage = "done";
        await saveJob(job);
        return;
      }

      const request = job.request!;
      const brand = await storage.getBrandProfile(request.brandProfileId);
      if (!brand) {
        throw new Error(`Brand profile not found: ${request.brandProfileId}`);
      }

      job.stage = "generating";
      await saveJob(job);
      const result = await runPipelineFromRequest(request, brand, OUTPUTS_ROOT);
      job.result = result;
      job.status = "done";
      job.stage = "done";
      await saveJob(job);
    } catch (error) {
      console.error(`[job ${job.id}] Generation failed:`, error instanceof Error ? error.message : error);
      job.status = "failed";
      job.stage = "failed";
      job.error = error instanceof Error ? error.message : String(error);
      await saveJob(job);
    }
  })();

  return { jobId, status: job.status };
}

async function handleRequest(req: Request): Promise<Response> {
  await ensureDefaultBrandProfile();
  const url = new URL(req.url);

  if (url.pathname === "/api/brands" && req.method === "GET") {
    return json(await storage.listBrandProfiles());
  }

  if (url.pathname.startsWith("/api/brands/") && req.method === "GET") {
    const brandId = url.pathname.slice("/api/brands/".length);
    const brand = await readBrandProfile(brandId);
    return brand ? json(brand) : json({ error: "Brand not found" }, { status: 404 });
  }

  if (url.pathname === "/api/products" && req.method === "GET") {
    return json(defaultProductRegistry);
  }

  if (url.pathname.startsWith("/api/products/") && url.pathname.endsWith("/context") && req.method === "GET") {
    const productId = url.pathname.replace("/api/products/", "").replace("/context", "");
    return json(await resolveProductContext(productId));
  }

  if (url.pathname === "/api/assistant/sessions" && req.method === "GET") {
    return json(await storage.listAssistantSessions());
  }

  if (url.pathname === "/api/assistant/sessions" && req.method === "POST") {
    const body = await parseJsonBody(req);
    const productId = typeof body.productId === "string" ? body.productId : "peppera";
    const context = await resolveProductContext(productId);
    const session = createInitialAssistantSession(productId, context);
    await storage.saveAssistantSession(session);
    return json(session);
  }

  if (url.pathname.startsWith("/api/assistant/sessions/") && req.method === "GET") {
    const sessionId = url.pathname.slice("/api/assistant/sessions/".length);
    const session = await storage.getAssistantSession(sessionId);
    return session ? json(session) : json({ error: "Session not found" }, { status: 404 });
  }

  if (url.pathname.startsWith("/api/assistant/sessions/") && url.pathname.endsWith("/reply") && req.method === "POST") {
    const sessionId = url.pathname.slice("/api/assistant/sessions/".length).replace(/\/reply$/, "");
    const session = await storage.getAssistantSession(sessionId);
    if (!session) {
      return json({ error: "Session not found" }, { status: 404 });
    }

    const body = await parseJsonBody(req);
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return json({ error: "text is required" }, { status: 400 });
    }

    const nowStr = new Date().toISOString();
    const userMsg: AssistantMessage = { id: makeId("msg"), role: "user", text, createdAt: nowStr };
    session.messages.push(userMsg);

    const brand = await storage.getBrandProfile(session.productId);
    const { reply, updatedBrief, shouldGenerate } = await generateAssistantReply(session, text, brand);

    const assistantMsg: AssistantMessage = { id: makeId("msg"), role: "assistant", text: reply, createdAt: new Date().toISOString() };
    session.messages.push(assistantMsg);
    session.inferredBrief = updatedBrief;
    session.currentQuestion = reply;
    session.updatedAt = new Date().toISOString();

    await storage.saveAssistantSession(session);
    return json({ session, shouldGenerate });
  }

  if (url.pathname.startsWith("/api/assistant/sessions/") && req.method === "POST") {
    const sessionId = url.pathname.slice("/api/assistant/sessions/".length);
    const existing = await storage.getAssistantSession(sessionId);
    if (!existing) {
      return json({ error: "Session not found" }, { status: 404 });
    }

    const body = await parseJsonBody(req);
    const updated = normalizeAssistantSession({
      ...existing,
      ...body,
      id: sessionId,
      createdAt: existing.createdAt
    });
    await storage.saveAssistantSession(updated);
    return json(updated);
  }

  if (url.pathname === "/api/brands" && req.method === "POST") {
    const body = await parseJsonBody(req);
    await storage.saveBrandProfile(body as unknown as BrandProfile);
    return json({ ok: true });
  }

  if (url.pathname === "/api/boards" && req.method === "GET") {
    return json(await storage.listBoards());
  }

  if (url.pathname.startsWith("/api/boards/") && req.method === "GET") {
    const boardId = url.pathname.slice("/api/boards/".length);
    const board = await storage.getBoard(boardId);
    return board ? json(board) : json({ error: "Board not found" }, { status: 404 });
  }

  if (url.pathname === "/api/boards" && req.method === "POST") {
    const body = await parseJsonBody(req);
    const board = normalizeBoard(body);
    await storage.saveBoard(board);
    return json(board);
  }

  if (url.pathname === "/api/uploads" && req.method === "POST") {
    const body = await parseJsonBody(req);
    const filename = typeof body.filename === "string" ? body.filename : "upload";
    const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
    const { mimeType, buffer } = decodeDataUrl(dataUrl);
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
      return json({ error: "Unsupported upload type" }, { status: 400 });
    }

    const desiredName = sanitizeStoredFilename(filename);
    const extension = path.extname(desiredName) || uploadExtensionForMimeType(mimeType);
    const stem = path.basename(desiredName, path.extname(desiredName)) || "upload";
    const storedName = `${stem}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}${extension}`;
    await fs.mkdir(UPLOADS_ROOT, { recursive: true });
    await fs.writeFile(path.join(UPLOADS_ROOT, storedName), buffer);
    return json({
      filename: storedName,
      url: `/api/uploads/${storedName}`,
      mimeType
    });
  }

  if (url.pathname === "/api/generate" && req.method === "POST") {
    const body = await parseJsonBody(req);
    return json(await startGeneration(body));
  }

  if (url.pathname.startsWith("/api/jobs/") && req.method === "GET") {
    const jobId = url.pathname.slice("/api/jobs/".length);
    const job = jobs.get(jobId);
    return job ? json(job) : json({ error: "Job not found" }, { status: 404 });
  }

  if (url.pathname === "/api/outputs" && req.method === "GET") {
    return json(await listOutputs());
  }

  // PATCH /api/outputs/:postId — merge partial metadata
  if (url.pathname.startsWith("/api/outputs/") && !url.pathname.includes("/slides/") && !url.pathname.endsWith("/text") && req.method === "PATCH") {
    const postId = url.pathname.slice("/api/outputs/".length);
    const existing = await readOutput(postId);
    if (!existing) return json({ error: "Output not found" }, { status: 404 });
    let patch: Record<string, unknown>;
    try {
      patch = await parseJsonBody(req);
    } catch {
      return json({ error: "Invalid JSON" }, { status: 400 });
    }
    // Deep merge: top-level fields overwrite, slides merge by slide_number
    const merged: Record<string, unknown> = { ...existing, ...patch };
    if (Array.isArray(patch.slides) && Array.isArray(existing.slides)) {
      const mergedSlides = [...existing.slides];
      for (const patchSlide of patch.slides as Array<Record<string, unknown>>) {
        const idx = mergedSlides.findIndex((s: any) => s.slide_number === patchSlide.slide_number);
        if (idx >= 0) {
          mergedSlides[idx] = { ...mergedSlides[idx], ...patchSlide };
        } else {
          mergedSlides.push(patchSlide as any);
        }
      }
      merged.slides = mergedSlides;
    }
    await fs.writeFile(path.join(OUTPUTS_ROOT, postId, "metadata.json"), JSON.stringify(merged, null, 2));
    return json(merged);
  }

  // POST /api/outputs/:postId/slides/:slideNumber/regenerate — single slide regen
  if (url.pathname.match(/^\/api\/outputs\/[^/]+\/slides\/\d+\/regenerate$/) && req.method === "POST") {
    const parts = url.pathname.split("/");
    const postId = parts[3];
    const slideNumber = Number(parts[5]);
    const existing = await readOutput(postId);
    if (!existing) return json({ error: "Output not found" }, { status: 404 });
    const slide = (existing.slides || []).find((s: any) => s.slide_number === slideNumber);
    if (!slide) return json({ error: "Slide not found" }, { status: 404 });
    let body: Record<string, unknown>;
    try {
      body = await parseJsonBody(req);
    } catch {
      return json({ error: "Invalid JSON" }, { status: 400 });
    }
    const imagePrompt = typeof body.image_prompt === "string" ? body.image_prompt : slide.image_prompt;
    try {
      const { generateImagesForSlides } = await import("./image-generator.ts");
      const assetsDir = path.join(OUTPUTS_ROOT, postId, "assets", "generated");
      const brandVisual = (existing as any).brand_profile?.visual || {};
      const updatedSlides = await generateImagesForSlides(
        [{ ...slide, image_prompt: imagePrompt }],
        {
          assetsDir,
          falKey: process.env.FAL_KEY,
          brandName: (existing as any).brand_profile?.name || "Brand",
          brandColors: { primaryColor: brandVisual.primaryColor || "#f04d23", secondaryColor: brandVisual.secondaryColor || "#ffd9c8" }
        }
      );
      const updatedSlide = updatedSlides[0];
      // Update metadata
      const slideIdx = existing.slides.findIndex((s: any) => s.slide_number === slideNumber);
      if (slideIdx >= 0) {
        existing.slides[slideIdx] = { ...existing.slides[slideIdx], asset_path: updatedSlide.asset_path, image_prompt: imagePrompt };
      }
      await fs.writeFile(path.join(OUTPUTS_ROOT, postId, "metadata.json"), JSON.stringify(existing, null, 2));
      return json({ slide: existing.slides[slideIdx] });
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : "Regeneration failed" }, { status: 500 });
    }
  }

  if (url.pathname.startsWith("/api/outputs/") && req.method === "GET") {
    const postId = url.pathname.slice("/api/outputs/".length);
    const output = await readOutput(postId);
    return output ? json(output) : json({ error: "Output not found" }, { status: 404 });
  }

  if (url.pathname.startsWith("/api/slides/") && req.method === "GET") {
    const parts = url.pathname.replace("/api/slides/", "").split("/");
    const postId = parts[0];
    const filename = parts.slice(1).join("/");
    return serveFile(path.join(OUTPUTS_ROOT, postId, "slides", filename));
  }

  if (url.pathname.startsWith("/api/assets/") && req.method === "GET") {
    const parts = url.pathname.replace("/api/assets/", "").split("/");
    const postId = parts[0];
    const filename = parts.slice(1).join("/");
    return serveFile(path.join(OUTPUTS_ROOT, postId, "assets", "generated", filename));
  }

  if (url.pathname.startsWith("/api/uploads/") && req.method === "GET") {
    const filename = path.basename(url.pathname.slice("/api/uploads/".length));
    return serveFile(path.join(UPLOADS_ROOT, filename));
  }

  if (url.pathname.startsWith("/api/brand-assets/") && req.method === "GET") {
    const parts = url.pathname.replace("/api/brand-assets/", "").split("/");
    const brandId = parts[0];
    const index = Number(parts[1]);
    const brand = await readBrandProfile(brandId);
    const assetPath = brand?.mascot?.referenceImages?.[index];
    if (!assetPath) return json({ error: "Brand asset not found" }, { status: 404 });
    // Remote URLs (GitHub raw, tmpfiles, etc) — redirect directly
    if (assetPath.startsWith("http://") || assetPath.startsWith("https://")) {
      return new Response(null, { status: 302, headers: { Location: assetPath } });
    }
    // Uploaded assets are stored as /api/uploads/<filename> — serve from uploads dir
    if (assetPath.startsWith("/api/uploads/")) {
      const filename = path.basename(assetPath);
      return serveFile(path.join(UPLOADS_ROOT, filename));
    }
    return serveFile(assetPath);
  }

  if (url.pathname.startsWith("/api/brands/") && url.pathname.endsWith("/mascot-upload") && req.method === "POST") {
    const brandId = url.pathname.replace("/api/brands/", "").replace("/mascot-upload", "");
    const brand = await readBrandProfile(brandId);
    if (!brand) return json({ error: "Brand not found" }, { status: 404 });

    const body = await parseJsonBody(req);
    const filename = typeof body.filename === "string" ? body.filename : "mascot-ref";
    const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
    const { mimeType, buffer } = decodeDataUrl(dataUrl);
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
      return json({ error: "Unsupported upload type" }, { status: 400 });
    }

    const desiredName = sanitizeStoredFilename(filename);
    const extension = path.extname(desiredName) || uploadExtensionForMimeType(mimeType);
    const stem = path.basename(desiredName, path.extname(desiredName)) || "mascot-ref";
    const storedName = `${stem}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}${extension}`;
    await fs.mkdir(UPLOADS_ROOT, { recursive: true });
    await fs.writeFile(path.join(UPLOADS_ROOT, storedName), buffer);

    const uploadedUrl = `/api/uploads/${storedName}`;
    const mascot = brand.mascot ?? { name: `${brand.name} Mascot`, description: "", role: "", visualPrompt: "", usageRules: [], referenceImages: [] };
    mascot.referenceImages = [...mascot.referenceImages, uploadedUrl];
    await storage.saveBrandProfile({ ...brand, mascot });

    return json({ url: uploadedUrl, referenceImages: mascot.referenceImages });
  }

  if (url.pathname.startsWith("/api/brands/") && url.pathname.includes("/mascot-refs/") && req.method === "DELETE") {
    const withoutPrefix = url.pathname.replace("/api/brands/", "");
    const [brandId, , indexStr] = withoutPrefix.split("/");
    const index = Number(indexStr);
    const brand = await readBrandProfile(brandId);
    if (!brand || !brand.mascot) return json({ error: "Brand not found" }, { status: 404 });
    brand.mascot.referenceImages = brand.mascot.referenceImages.filter((_, i) => i !== index);
    await storage.saveBrandProfile(brand);
    return json({ referenceImages: brand.mascot.referenceImages });
  }

  // --- Calendar API ---

  if (url.pathname === "/api/calendar" && req.method === "GET") {
    return json(await storage.listCalendarSlots());
  }

  if (url.pathname === "/api/calendar" && req.method === "POST") {
    const body = await parseJsonBody(req);
    const slot: CalendarSlot = {
      id: body.id as string || makeId("slot"),
      date: body.date as string || new Date().toISOString().slice(0, 10),
      brandProfileId: body.brandProfileId as string || "peppera",
      platform: (body.platform as CalendarSlot["platform"]) || "instagram",
      pillar: body.pillar as string || "",
      idea: body.idea as string || "",
      status: (body.status as CalendarSlot["status"]) || "idea",
      outputPostId: body.outputPostId as string | undefined,
      jobId: body.jobId as string | undefined,
      tags: Array.isArray(body.tags) ? body.tags as string[] : [],
      createdAt: body.createdAt as string || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await storage.saveCalendarSlot(slot);
    return json(slot);
  }

  if (url.pathname.startsWith("/api/calendar/") && !url.pathname.includes("/batch") && req.method === "PUT") {
    const slotId = url.pathname.slice("/api/calendar/".length);
    const existing = await storage.getCalendarSlot(slotId);
    if (!existing) return json({ error: "Slot not found" }, { status: 404 });
    const body = await parseJsonBody(req);
    const updated: CalendarSlot = {
      ...existing,
      ...body as Partial<CalendarSlot>,
      id: slotId,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    };
    await storage.saveCalendarSlot(updated);
    return json(updated);
  }

  if (url.pathname.startsWith("/api/calendar/") && req.method === "DELETE") {
    const slotId = url.pathname.slice("/api/calendar/".length);
    await storage.deleteCalendarSlot(slotId);
    return json({ ok: true });
  }

  if (url.pathname === "/api/calendar/batch-generate" && req.method === "POST") {
    const body = await parseJsonBody(req) as unknown as BatchGenerationRequest;
    const slotIds = body.slotIds || [];
    const results: Array<{ slotId: string; jobId?: string; error?: string }> = [];

    for (const slotId of slotIds) {
      const slot = await storage.getCalendarSlot(slotId);
      if (!slot || !slot.idea) {
        results.push({ slotId, error: "Slot not found or has no idea" });
        continue;
      }
      const brand = await storage.getBrandProfile(slot.brandProfileId);
      if (!brand) {
        results.push({ slotId, error: "Brand not found" });
        continue;
      }
      const request: Record<string, unknown> = {
        brandProfileId: slot.brandProfileId,
        rawIdea: slot.idea,
        cards: [],
        references: [],
        platformTargets: [slot.platform],
        goal: brand.defaults?.goal || "awareness",
        workflowType: "slideshow",
        visualMode: body.visualMode || "mascot-led",
        deliveryTargets: body.deliveryTargets || slot.platform
      };
      try {
        const { jobId } = await startGeneration(request);
        slot.status = "generating";
        slot.jobId = jobId;
        slot.updatedAt = new Date().toISOString();
        await storage.saveCalendarSlot(slot);
        results.push({ slotId, jobId });
      } catch (error) {
        results.push({ slotId, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return json({ results });
  }

  // --- Content Pillars API ---

  if (url.pathname === "/api/pillars" && req.method === "GET") {
    return json(await storage.listContentPillars());
  }

  if (url.pathname === "/api/pillars" && req.method === "POST") {
    const body = await parseJsonBody(req);
    const pillar: ContentPillar = {
      id: body.id as string || makeId("pillar"),
      brandProfileId: body.brandProfileId as string || "peppera",
      name: body.name as string || "Untitled Pillar",
      description: body.description as string || "",
      frequency: (body.frequency as ContentPillar["frequency"]) || "weekly",
      platforms: Array.isArray(body.platforms) ? body.platforms as ContentPillar["platforms"] : ["instagram"],
      defaultTone: body.defaultTone as string | undefined,
      exampleIdeas: Array.isArray(body.exampleIdeas) ? body.exampleIdeas as string[] : []
    };
    await storage.saveContentPillar(pillar);
    return json(pillar);
  }

  if (url.pathname.startsWith("/api/pillars/") && req.method === "DELETE") {
    const pillarId = url.pathname.slice("/api/pillars/".length);
    await storage.deleteContentPillar(pillarId);
    return json({ ok: true });
  }

  // --- OpenClaw / agent-friendly endpoints ---

  if (url.pathname === "/api/health" && req.method === "GET") {
    return json({
      status: "ok",
      version: "1.0.0",
      brands: (await storage.listBrandProfiles()).map((b) => b.id),
      capabilities: ["generate", "mascot-variants", "reference-edit", "video-clip", "reel-package"]
    });
  }

  if (url.pathname === "/api/jobs" && req.method === "GET") {
    const all = [...jobs.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const status = url.searchParams.get("status");
    return json(status ? all.filter((j) => j.status === status) : all);
  }

  if (url.pathname === "/api/generate/quick" && req.method === "POST") {
    const body = await parseJsonBody(req);
    const brandId = typeof body.brand === "string" ? body.brand : "peppera";
    const idea = typeof body.idea === "string" ? body.idea.trim() : "";
    if (!idea) {
      return json({ error: "idea is required" }, { status: 400 });
    }
    const brand = await storage.getBrandProfile(brandId);
    if (!brand) {
      return json({ error: `Brand not found: ${brandId}` }, { status: 404 });
    }
    const platform = typeof body.platform === "string" ? body.platform : "tiktok";
    const visualMode = typeof body.visualMode === "string" ? body.visualMode : "mascot-led";
    const request: GenerationRequest = {
      brandProfileId: brandId,
      rawIdea: idea,
      cards: [],
      references: [],
      platformTargets: [platform as "tiktok" | "instagram"],
      goal: "installs",
      workflowType: "slideshow",
      visualMode: visualMode as GenerationRequest["visualMode"],
      deliveryTargets: platform as GenerationRequest["deliveryTargets"]
    };
    return json(await startGeneration(request as unknown as Record<string, unknown>));
  }

  if (url.pathname.startsWith("/api/outputs/") && url.pathname.endsWith("/text") && req.method === "GET") {
    const postId = url.pathname.replace("/api/outputs/", "").replace("/text", "");
    const output = await readOutput(postId);
    if (!output) return json({ error: "Output not found" }, { status: 404 });
    return json({
      caption: output.caption,
      hooks: output.hooks,
      hashtags: output.hashtags,
      platformNotes: output.platform_notes
    });
  }

  if (url.pathname === "/api/openapi.json" && req.method === "GET") {
    return serveFile(path.join(PUBLIC_ROOT, "openapi.json"));
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    return serveFile(path.join(PUBLIC_ROOT, "index.html"));
  }

  const publicAssetPath = resolvePublicAssetPath(url.pathname);
  if (publicAssetPath) {
    return serveFile(publicAssetPath);
  }

  return json({ error: "Not found" }, { status: 404 });
}

const server = createServer(async (req, res) => {
  try {
    const protocol = req.headers["x-forwarded-proto"] ?? "http";
    const host = req.headers.host ?? `localhost:${PORT}`;
    const url = new URL(req.url ?? "/", `${protocol}://${host}`);

    const body = (req.method === "POST" || req.method === "PATCH" || req.method === "PUT" || req.method === "DELETE")
      ? await new Promise<Buffer>((resolve) => {
          const chunks: Buffer[] = [];
          req.on("data", (chunk: Buffer) => chunks.push(chunk));
          req.on("end", () => resolve(Buffer.concat(chunks)));
        })
      : undefined;

    const request = new Request(url.toString(), {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: body?.length ? new Uint8Array(body) : undefined
    });

    const response = await handleRequest(request);
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    const responseBody = await response.arrayBuffer();
    res.end(Buffer.from(responseBody));
  } catch (error) {
    console.error("Server error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  await seedBrandProfiles();
  // Register brand descriptions for product context resolution on deployed instances
  for (const brand of await storage.listBrandProfiles()) {
    if (brand.description) registerBrandDescription(brand.id, brand.description);
  }
  await loadPersistedJobs();
  server.listen(PORT, () => {
    console.log(`Social Studio running at http://localhost:${PORT}`);
  });
}
