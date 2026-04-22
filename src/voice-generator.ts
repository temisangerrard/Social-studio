import fs from "node:fs/promises";
import path from "node:path";

// ── ElevenLabs TTS ────────────────────────────────────────────────────────────

const API_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"; // Rachel — clear, neutral
const DEFAULT_MODEL = "eleven_turbo_v2_5";

export interface VoiceOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
}

export interface VoiceResult {
  audioPath: string;
  voiceId: string;
  durationEstimate: number; // rough seconds based on word count
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function generateVoiceover(
  text: string,
  outputDir: string,
  filename: string,
  options: VoiceOptions = {}
): Promise<VoiceResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return writeMockAudio(text, outputDir, filename);
  }

  const voiceId = options.voiceId || DEFAULT_VOICE;
  const url = `${API_BASE}/text-to-speech/${voiceId}`;

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: options.modelId || DEFAULT_MODEL,
      output_format: "mp3_44100_128",
      voice_settings: {
        stability: options.stability ?? 0.5,
        similarity_boost: options.similarityBoost ?? 0.75,
        style: options.style ?? 0.3,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(`[voice] ElevenLabs failed (${res.status}): ${body.slice(0, 200)}, falling back to mock`);
    return writeMockAudio(text, outputDir, filename);
  }

  await fs.mkdir(outputDir, { recursive: true });
  const audioPath = path.join(outputDir, `${filename}.mp3`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(audioPath, buffer);

  return {
    audioPath,
    voiceId,
    durationEstimate: Math.ceil(text.split(/\s+/).length / 2.5),
  };
}

async function writeMockAudio(text: string, outputDir: string, filename: string): Promise<VoiceResult> {
  await fs.mkdir(outputDir, { recursive: true });
  const audioPath = path.join(outputDir, `${filename}.txt`);
  await fs.writeFile(audioPath, `[MOCK VOICEOVER]\n${text}\n`, "utf8");
  return {
    audioPath,
    voiceId: "mock",
    durationEstimate: Math.ceil(text.split(/\s+/).length / 2.5),
  };
}

export async function listVoices(): Promise<Array<{ voiceId: string; name: string }>> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return [{ voiceId: "mock", name: "Mock Voice" }];

  const res = await fetchWithTimeout(`${API_BASE}/voices`, {
    headers: { "xi-api-key": apiKey },
  });
  if (!res.ok) return [{ voiceId: DEFAULT_VOICE, name: "Rachel (default)" }];

  const data = (await res.json()) as { voices: Array<{ voice_id: string; name: string }> };
  return data.voices.map((v) => ({ voiceId: v.voice_id, name: v.name }));
}
