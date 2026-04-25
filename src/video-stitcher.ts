import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const exec = promisify(execFile);

export interface StitchInput {
  /** Ordered slide image paths (png/jpg) */
  imagePaths: string[];
  /** Path to voiceover audio file (mp3) — optional */
  audioPath?: string | null;
  /** Total audio duration in seconds (used to calculate per-slide timing) */
  audioDuration?: number;
  /** Output directory for the final video */
  outputDir: string;
  /** Output filename without extension */
  filename?: string;
}

export interface StitchResult {
  videoPath: string;
  durationSeconds: number;
}

/**
 * Probe actual audio duration via ffprobe. Falls back to estimate if unavailable.
 */
async function probeAudioDuration(audioPath: string): Promise<number | null> {
  try {
    const { stdout } = await exec("ffprobe", [
      "-v", "quiet",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      audioPath,
    ]);
    const seconds = parseFloat(stdout.trim());
    return Number.isFinite(seconds) ? seconds : null;
  } catch {
    return null;
  }
}

/**
 * Stitch slide images + optional audio into an mp4 video using ffmpeg.
 *
 * Each slide is shown for an equal share of the audio duration (or 4s each
 * if no audio is provided). The output is a 1080×1920 9:16 mp4.
 */
export async function stitchVideo(input: StitchInput): Promise<StitchResult> {
  const { imagePaths, audioPath, outputDir, filename = "video" } = input;
  if (imagePaths.length === 0) {
    throw new Error("No images to stitch");
  }

  await fs.mkdir(outputDir, { recursive: true });

  // Determine total duration
  let totalDuration: number | undefined = input.audioDuration;
  if (!totalDuration && audioPath) {
    totalDuration = (await probeAudioDuration(audioPath)) ?? undefined;
  }
  const perSlide = totalDuration
    ? totalDuration / imagePaths.length
    : 4; // default 4s per slide

  // Build ffmpeg concat demuxer input file
  const concatLines = imagePaths.map((p) => `file '${p}'\nduration ${perSlide.toFixed(3)}`);
  // Repeat last image to avoid ffmpeg cutting it short
  concatLines.push(`file '${imagePaths[imagePaths.length - 1]}'`);
  const concatPath = path.join(outputDir, `${filename}-concat.txt`);
  await fs.writeFile(concatPath, concatLines.join("\n"), "utf8");

  const videoPath = path.join(outputDir, `${filename}.mp4`);

  const args = [
    "-y",
    "-f", "concat", "-safe", "0", "-i", concatPath,
    ...(audioPath ? ["-i", audioPath] : []),
    "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
    "-pix_fmt", "yuv420p",
    ...(audioPath ? ["-c:a", "aac", "-b:a", "128k", "-shortest"] : ["-an"]),
    "-movflags", "+faststart",
    videoPath,
  ];

  try {
    await exec("ffmpeg", args, { timeout: 120_000 });
  } catch (error: any) {
    const msg = error.stderr || error.message || String(error);
    throw new Error(`ffmpeg stitching failed: ${msg.slice(0, 500)}`);
  }

  // Clean up concat file
  await fs.unlink(concatPath).catch(() => {});

  const actualDuration = totalDuration ?? perSlide * imagePaths.length;
  return { videoPath, durationSeconds: actualDuration };
}
