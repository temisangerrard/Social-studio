import fs from "node:fs/promises";

export type GenerationProvider = "fal" | "tokenrouter" | "mock";
export type GenerationStatus = "queued" | "running" | "complete" | "failed";

export interface GenerationMetadata {
  provider: GenerationProvider;
  model: string;
  request_id?: string | null;
  status: GenerationStatus;
  error?: string | null;
  payload?: unknown;
  output_url?: string | null;
  generated_at?: string;
  retryable?: boolean;
  asset_path?: string | null;
}

export interface QueueOptions {
  maxConcurrent: number;
  minDelayMs?: number;
}

export interface FalQueueResult {
  requestId: string | null;
  result: any;
  statusLog: string[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function looksRetryable(message: string): boolean {
  return /429|rate|timeout|temporar|network|abort/i.test(message);
}

export function failedGenerationMetadata(params: {
  provider: GenerationProvider;
  model: string;
  prompt: string;
  payload: unknown;
  error: unknown;
}): GenerationMetadata {
  const message = errorMessage(params.error);
  return {
    provider: params.provider,
    model: params.model,
    status: "failed",
    error: message,
    payload: params.payload,
    output_url: null,
    generated_at: new Date().toISOString(),
    retryable: looksRetryable(message),
    asset_path: null,
  };
}

export function completeGenerationMetadata(params: {
  provider: GenerationProvider;
  model: string;
  payload: unknown;
  requestId?: string | null;
  outputUrl?: string | null;
  assetPath?: string | null;
}): GenerationMetadata {
  return {
    provider: params.provider,
    model: params.model,
    request_id: params.requestId ?? null,
    status: "complete",
    error: null,
    payload: params.payload,
    output_url: params.outputUrl ?? null,
    generated_at: new Date().toISOString(),
    retryable: false,
    asset_path: params.assetPath ?? null,
  };
}

export function createGenerationQueue(options: QueueOptions) {
  const maxConcurrent = Math.max(1, options.maxConcurrent);
  const minDelayMs = Math.max(0, options.minDelayMs ?? 0);
  let active = 0;
  let lastStartAt = 0;
  const pending: Array<() => void> = [];

  async function waitForTurn(): Promise<void> {
    if (active < maxConcurrent) {
      active += 1;
      const waitMs = Math.max(0, lastStartAt + minDelayMs - Date.now());
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
      lastStartAt = Date.now();
      return;
    }

    await new Promise<void>((resolve) => pending.push(resolve));
    return waitForTurn();
  }

  function release(): void {
    active = Math.max(0, active - 1);
    const next = pending.shift();
    if (next) next();
  }

  return {
    async run<T>(job: () => Promise<T>): Promise<T> {
      await waitForTurn();
      try {
        return await job();
      } finally {
        release();
      }
    },
  };
}

export const imageGenerationQueue = createGenerationQueue({
  maxConcurrent: Number(process.env.IMAGE_GENERATION_MAX_CONCURRENT ?? 1),
  minDelayMs: Number(process.env.IMAGE_GENERATION_MIN_DELAY_MS ?? 750),
});

export const videoGenerationQueue = createGenerationQueue({
  maxConcurrent: Number(process.env.VIDEO_GENERATION_MAX_CONCURRENT ?? 1),
  minDelayMs: Number(process.env.VIDEO_GENERATION_MIN_DELAY_MS ?? 1500),
});

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 60000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function buildFalImageInput(params: {
  model: string;
  prompt: string;
  aspectRatio: string;
  referenceImageUrls?: string[];
}): Record<string, unknown> {
  const { model, prompt, aspectRatio } = params;
  if (model.includes("nano-banana")) {
    return { prompt, aspect_ratio: aspectRatio, num_images: 1 };
  }
  if (model.includes("flux")) {
    const sizeMap: Record<string, string> = { "1:1": "square_hd", "4:5": "portrait_4_3", "9:16": "portrait_16_9" };
    return { prompt, image_size: sizeMap[aspectRatio] ?? "square_hd", num_images: 1 };
  }
  if (model.includes("gpt-image")) {
    const sizeMap: Record<string, string> = { "1:1": "1024x1024", "4:5": "1024x1280", "9:16": "1024x1792" };
    return { prompt, size: sizeMap[aspectRatio] ?? "1024x1024", n: 1, quality: "high" };
  }
  return {
    prompt,
    image_size: aspectRatio === "1:1" ? "square" : "portrait_16_9",
    num_images: 1,
    seed: Math.floor(Math.random() * 2147483647),
  };
}

export function buildFalVideoInput(params: {
  operation: "video-generate" | "reference-video-generate";
  prompt: string;
  aspectRatio: string;
  duration: number;
  resolution?: string;
  generateAudio: boolean;
  negativePrompt?: string;
  referenceImageUrls?: string[];
  imageUrl?: string;
  referenceAudioUrl?: string;
}): Record<string, unknown> {
  const input: Record<string, unknown> = {
    prompt: params.prompt,
    duration: String(params.duration),
    aspect_ratio: params.aspectRatio,
    resolution: params.resolution ?? "720p",
    generate_audio: params.generateAudio,
  };

  if (params.operation === "reference-video-generate") {
    input.image_references = (params.referenceImageUrls ?? []).map((url, index) => ({
      image_url: url,
      type: "subject",
      ref_name: `Image${index + 1}`,
    }));
    if (params.referenceAudioUrl) {
      input.audio_references = [{ audio_url: params.referenceAudioUrl }];
    }
  } else {
    input.negative_prompt = params.negativePrompt ?? "blur, distort, low quality";
    if (params.imageUrl) input.image_url = params.imageUrl;
  }

  return input;
}

export async function submitFalQueueJob(params: {
  model: string;
  payload: unknown;
  falKey: string;
  pollIntervalMs?: number;
  maxPolls?: number;
}): Promise<FalQueueResult> {
  const headers = { "Content-Type": "application/json", Authorization: `Key ${params.falKey}` };
  const submitResponse = await fetchWithTimeout(`https://queue.fal.run/${params.model}`, {
    method: "POST",
    headers,
    body: JSON.stringify(params.payload),
  });

  if (!submitResponse.ok) {
    const body = await submitResponse.text();
    throw new Error(`fal submit failed (${submitResponse.status}): ${body}`);
  }

  const submitPayload = (await submitResponse.json()) as {
    request_id?: string;
    status_url: string;
    response_url: string;
  };
  const statusLog: string[] = [];

  for (let index = 0; index < (params.maxPolls ?? 60); index += 1) {
    await new Promise((resolve) => setTimeout(resolve, params.pollIntervalMs ?? 2000));
    const statusResponse = await fetchWithTimeout(submitPayload.status_url, { headers });
    if (!statusResponse.ok) continue;

    const statusPayload = (await statusResponse.json()) as { status?: string; logs?: Array<{ message?: string }> };
    if (statusPayload.status) statusLog.push(statusPayload.status);
    for (const log of statusPayload.logs ?? []) {
      if (log.message) statusLog.push(log.message);
    }
    if (statusPayload.status === "FAILED") {
      throw new Error("fal generation failed");
    }
    if (statusPayload.status !== "COMPLETED") continue;

    const resultResponse = await fetchWithTimeout(submitPayload.response_url, { headers });
    if (!resultResponse.ok) throw new Error(`fal result fetch failed (${resultResponse.status})`);
    return {
      requestId: submitPayload.request_id ?? null,
      result: await resultResponse.json(),
      statusLog,
    };
  }

  throw new Error("fal generation timed out");
}

export async function downloadAsset(url: string, outputPath: string): Promise<void> {
  const response = await fetchWithTimeout(url, {}, 120000);
  if (!response.ok) throw new Error(`asset download failed (${response.status})`);
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
}

export async function submitTokenRouterVideoJob(params: {
  prompt: string;
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  payload?: Record<string, unknown>;
}): Promise<{ requestId: string | null; outputUrl: string | null; payload: Record<string, unknown> }> {
  const apiKey = params.apiKey ?? process.env.TOKENROUTER_API_KEY;
  const apiUrl = params.apiUrl ?? process.env.TOKENROUTER_API_URL;
  const model = params.model ?? process.env.TOKENROUTER_VIDEO_MODEL ?? "HappyHorse-1.0-t2";
  if (!apiKey || !apiUrl) {
    throw new Error("TokenRouter is not configured");
  }

  const payload = {
    model,
    prompt: params.prompt,
    ...(params.payload ?? {}),
  };
  const response = await fetchWithTimeout(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  }, 120000);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TokenRouter submit failed (${response.status}): ${body}`);
  }

  const body = await response.json() as any;
  return {
    requestId: body.request_id ?? body.id ?? null,
    outputUrl: body.video?.url ?? body.output?.url ?? body.url ?? null,
    payload,
  };
}
