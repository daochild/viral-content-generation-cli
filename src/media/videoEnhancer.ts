import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { dirname, extname } from "node:path";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import type {
  VideoEnhancementMeta,
  VideoEnhancementPreset,
  VideoEnhancementSpeed,
} from "../domain/types";

export const VIDEO_ENHANCEMENT_PRESETS = ["social", "vertical", "clean", "stabilize"] as const;
export const VIDEO_ENHANCEMENT_SPEEDS = [
  "ultrafast",
  "superfast",
  "veryfast",
  "faster",
  "fast",
  "medium",
  "slow",
  "slower",
  "veryslow",
] as const;

export const DEFAULT_VIDEO_ENHANCEMENT_PRESET: VideoEnhancementPreset = "social";
export const DEFAULT_VIDEO_ENHANCEMENT_CRF = 18;
export const DEFAULT_VIDEO_ENHANCEMENT_SPEED: VideoEnhancementSpeed = "medium";

let ffmpegAvailabilityPromise: Promise<void> | undefined;

export interface EnhanceVideoOptions {
  inputPath: string;
  outputPath?: string;
  preset?: VideoEnhancementPreset;
  crf?: number;
  speed?: VideoEnhancementSpeed;
  overwrite?: boolean;
}

export interface EnhanceManyVideosOptions {
  preset?: VideoEnhancementPreset;
  crf?: number;
  speed?: VideoEnhancementSpeed;
  overwrite?: boolean;
}

export interface VideoEnhancementFailure {
  inputPath: string;
  error: string;
}

export interface VideoEnhancementBatchResult {
  results: VideoEnhancementMeta[];
  failures: VideoEnhancementFailure[];
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function buildDefaultOutputPath(inputPath: string): string {
  const extension = extname(inputPath) || ".mp4";
  return `${inputPath.slice(0, inputPath.length - extension.length)}-enhanced${extension}`;
}

function buildVideoFilter(preset: VideoEnhancementPreset, transformFile?: string): string {
  switch (preset) {
    case "social":
      return "hqdn3d=1.2:1.2:4:4,eq=brightness=0.02:contrast=1.06:saturation=1.08,unsharp=5:5:0.5:5:5:0.0";
    case "vertical":
      return "hqdn3d=1.2:1.2:4:4,eq=brightness=0.02:contrast=1.06:saturation=1.08,unsharp=5:5:0.5:5:5:0.0,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920";
    case "clean":
      return "hqdn3d=1.0:1.0:3:3,unsharp=5:5:0.4:5:5:0.0";
    case "stabilize":
      if (!transformFile) {
        throw new Error("Stabilize preset requires a transform file");
      }
      return `vidstabtransform=input=${transformFile}:smoothing=30,hqdn3d=1.0:1.0:3:3,eq=brightness=0.01:contrast=1.04:saturation=1.05,unsharp=5:5:0.4:5:5:0.0`;
  }
}

async function runCommand(command: string, args: string[], context: string): Promise<void> {
  const proc = Bun.spawn([command, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (proc.exitCode !== 0) {
    const details = stderr.trim() || stdout.trim() || `${command} exited with code ${proc.exitCode}`;
    throw new Error(`${context}: ${details}`);
  }
}

async function ensureFfmpegAvailable(): Promise<void> {
  if (!ffmpegAvailabilityPromise) {
    ffmpegAvailabilityPromise = (async () => {
      try {
        await runCommand("ffmpeg", ["-version"], "ffmpeg is not available in PATH");
      } catch (error: any) {
        throw new Error(error?.message ?? "ffmpeg is not available in PATH");
      }
    })();
  }

  await ffmpegAvailabilityPromise;
}

function validatePreset(value: string): asserts value is VideoEnhancementPreset {
  if (!VIDEO_ENHANCEMENT_PRESETS.includes(value as VideoEnhancementPreset)) {
    throw new Error(`Invalid enhancement preset: ${value}`);
  }
}

function validateSpeed(value: string): asserts value is VideoEnhancementSpeed {
  if (!VIDEO_ENHANCEMENT_SPEEDS.includes(value as VideoEnhancementSpeed)) {
    throw new Error(`Invalid enhancement speed: ${value}`);
  }
}

export async function enhanceVideo(options: EnhanceVideoOptions): Promise<VideoEnhancementMeta> {
  const {
    inputPath,
    preset = DEFAULT_VIDEO_ENHANCEMENT_PRESET,
    crf = DEFAULT_VIDEO_ENHANCEMENT_CRF,
    speed = DEFAULT_VIDEO_ENHANCEMENT_SPEED,
    overwrite = false,
  } = options;

  validatePreset(preset);
  validateSpeed(speed);

  if (!Number.isInteger(crf) || crf < 0) {
    throw new Error("Enhancement CRF must be a non-negative integer");
  }

  if (!(await pathExists(inputPath))) {
    throw new Error(`Input video not found: ${inputPath}`);
  }

  const outputPath = options.outputPath ?? buildDefaultOutputPath(inputPath);
  if (!overwrite && (await pathExists(outputPath))) {
    throw new Error(`Enhanced output already exists: ${outputPath}`);
  }

  await ensureFfmpegAvailable();
  await mkdir(dirname(outputPath), { recursive: true });

  const overwriteFlag = overwrite ? "-y" : "-n";

  if (preset !== "stabilize") {
    await runCommand(
      "ffmpeg",
      [
        overwriteFlag,
        "-i",
        inputPath,
        "-vf",
        buildVideoFilter(preset),
        "-af",
        "loudnorm",
        "-c:v",
        "libx264",
        "-preset",
        speed,
        "-crf",
        String(crf),
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        outputPath,
      ],
      `Failed to enhance video ${inputPath}`,
    );
  } else {
    const tempDir = await mkdtemp(`${tmpdir()}/viral-video-enhancer-`);
    const transformFile = `${tempDir}/transforms.trf`;

    try {
      await runCommand(
        "ffmpeg",
        [
          "-i",
          inputPath,
          "-vf",
          `vidstabdetect=shakiness=5:accuracy=15:result=${transformFile}`,
          "-f",
          "null",
          "-",
        ],
        `Failed to analyze stabilization for ${inputPath}`,
      );

      await runCommand(
        "ffmpeg",
        [
          overwriteFlag,
          "-i",
          inputPath,
          "-vf",
          buildVideoFilter("stabilize", transformFile),
          "-af",
          "loudnorm",
          "-c:v",
          "libx264",
          "-preset",
          speed,
          "-crf",
          String(crf),
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          outputPath,
        ],
        `Failed to enhance video ${inputPath}`,
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  return {
    inputPath,
    outputPath,
    preset,
    crf,
    speed,
    createdAt: new Date().toISOString(),
  };
}

export async function enhanceVideos(
  inputPaths: string[],
  options: EnhanceManyVideosOptions = {},
): Promise<VideoEnhancementBatchResult> {
  const results: VideoEnhancementMeta[] = [];
  const failures: VideoEnhancementFailure[] = [];

  for (const inputPath of inputPaths) {
    try {
      const result = await enhanceVideo({
        inputPath,
        preset: options.preset,
        crf: options.crf,
        speed: options.speed,
        overwrite: options.overwrite,
      });
      results.push(result);
    } catch (error: any) {
      failures.push({
        inputPath,
        error: error?.message ?? String(error),
      });
    }
  }

  return { results, failures };
}

export async function findRunVideoInputs(runId: string, outputRoot = "./output"): Promise<string[]> {
  const runDir = `${outputRoot}/${runId}`;
  let entries: Awaited<ReturnType<typeof readdir>>;

  try {
    entries = await readdir(runDir, { withFileTypes: true });
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      throw new Error(`Run output directory not found: ${runDir}`);
    }

    throw error;
  }

  return entries
    .filter((entry) => entry.isFile() && /^video-\d+\.mp4$/i.test(entry.name))
    .map((entry) => `${runDir}/${entry.name}`)
    .sort((left, right) => left.localeCompare(right));
}

