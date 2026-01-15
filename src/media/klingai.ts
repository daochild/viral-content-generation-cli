import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export interface KlingAIClientOptions {
  apiKey: string;
  apiSecret: string;
  baseUrl?: string;
}

export interface GenerateVideoOptions {
  prompt: string;
  /** Model name: kling-v1, kling-v1-5, kling-v1-6, kling-v2-master, etc. */
  model?: string;
  /** Mode: std or pro */
  mode?: "std" | "pro";
  /** Duration in seconds (5 or 10) */
  duration?: 5 | 10;
  /** Aspect ratio: 16:9, 9:16, 1:1 */
  aspectRatio?: string;
  /** CFG scale for generation quality */
  cfgScale?: number;
  /** Negative prompt */
  negativePrompt?: string;
  /** Output path for the video file */
  outputPath?: string;
  /** Run ID to link video file to run */
  runId?: string;
}

export interface GenerateVideoResult {
  /** Path to downloaded video file */
  videoPath: string;
  /** KlingAI task ID */
  taskId: string;
  /** Video URL from KlingAI (expires after 30 days) */
  videoUrl: string;
  /** Video ID from KlingAI */
  videoId: string;
  /** Video duration from result */
  videoDuration: string;
  /** Model used for generation */
  model: string;
  /** Mode used: std or pro */
  mode: "std" | "pro";
  /** Duration setting in seconds */
  duration: 5 | 10;
  /** Aspect ratio used */
  aspectRatio: string;
}

/**
 * Video task result from KlingAI.
 */
interface VideoTaskResult {
  videoUrl: string;
  videoId: string;
  videoDuration: string;
}

/**
 * KlingAI client for video generation.
 * API docs: https://docs.klingai.com/
 * 
 * Best models for text-to-video:
 * - kling-v1-6: Latest v1, supports text2video STD/PRO, 720p-1080p
 * - kling-v2-master: v2 master mode, 720p
 * - kling-v2-1-master: v2.1 master, 1080p
 */
export class KlingAIClient {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseUrl: string;

  constructor(opts: KlingAIClientOptions) {
    this.apiKey = opts.apiKey;
    this.apiSecret = opts.apiSecret;
    this.baseUrl = opts.baseUrl ?? "https://api.klingai.com";
  }

  /**
   * Generate JWT token for API authentication.
   */
  private async generateToken(): Promise<string> {
    const header = {
      alg: "HS256",
      typ: "JWT",
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.apiKey,
      exp: now + 1800, // 30 minutes
      nbf: now - 5,
    };

    // Base64URL encode
    const base64url = (obj: object) => {
      const json = JSON.stringify(obj);
      const base64 = Buffer.from(json).toString("base64");
      return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    };

    const headerB64 = base64url(header);
    const payloadB64 = base64url(payload);
    const message = `${headerB64}.${payloadB64}`;

    // Create HMAC-SHA256 signature
    const crypto = await import("node:crypto");
    const signature = crypto
      .createHmac("sha256", this.apiSecret)
      .update(message)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    return `${message}.${signature}`;
  }

  /**
   * Create a video generation task.
   */
  async createTask(options: GenerateVideoOptions): Promise<string> {
    const token = await this.generateToken();
    
    // Default to kling-v1-6 which is best for text2video
    const model = options.model ?? "kling-v1-6";
    const mode = options.mode ?? "std";
    const duration = options.duration ?? 5;

    const body: Record<string, unknown> = {
      model_name: model,
      mode,
      prompt: options.prompt,
      duration: String(duration),
      aspect_ratio: options.aspectRatio ?? "9:16",
    };

    // Optional parameters
    if (options.cfgScale !== undefined) {
      body.cfg_scale = options.cfgScale;
    }
    if (options.negativePrompt) {
      body.negative_prompt = options.negativePrompt;
    }

    const response = await fetch(`${this.baseUrl}/v1/videos/text2video`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`KlingAI API error: ${response.status} ${error}`);
    }

    const data = (await response.json()) as { 
      code?: number;
      message?: string;
      data?: { task_id?: string } 
    };
    
    if (data.code && data.code !== 0) {
      throw new Error(`KlingAI error: ${data.code} ${data.message}`);
    }

    const taskId = data.data?.task_id;
    if (!taskId) {
      throw new Error("No task_id in KlingAI response");
    }

    return taskId;
  }

  /**
   * Poll task status until complete.
   */
  async waitForTask(
    taskId: string,
    maxWaitMs = 300000,
    pollIntervalMs = 5000
  ): Promise<VideoTaskResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const token = await this.generateToken();
      
      const response = await fetch(
        `${this.baseUrl}/v1/videos/text2video/${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`KlingAI API error: ${response.status} ${error}`);
      }

      const data = (await response.json()) as {
        code?: number;
        message?: string;
        data?: {
          task_status?: string;
          task_status_msg?: string;
          task_result?: { 
            videos?: Array<{ 
              id?: string;
              url?: string;
              duration?: string;
            }> 
          };
        };
      };

      const status = data.data?.task_status;

      if (status === "succeed") {
        const video = data.data?.task_result?.videos?.[0];
        if (!video?.url) {
          throw new Error("No video URL in KlingAI response");
        }
        return {
          videoUrl: video.url,
          videoId: video.id ?? taskId,
          videoDuration: video.duration ?? "5",
        };
      }

      if (status === "failed") {
        const msg = data.data?.task_status_msg ?? "Unknown error";
        throw new Error(`KlingAI video generation failed: ${msg}`);
      }

      console.error(`[klingai] Status: ${status}, waiting...`);
      
      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error("KlingAI video generation timed out");
  }

  /**
   * Download video from URL and save to file.
   */
  async downloadVideo(url: string, outputPath: string): Promise<void> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, buffer);
  }

  /**
   * Generate video from text prompt.
   */
  async generate(options: GenerateVideoOptions): Promise<GenerateVideoResult> {
    const model = options.model ?? "kling-v1-6";
    const mode = options.mode ?? "std";
    const duration = options.duration ?? 5;
    const aspectRatio = options.aspectRatio ?? "9:16";
    
    console.error(`[klingai] Creating video task with ${model} (${mode})...`);
    const taskId = await this.createTask(options);
    console.error(`[klingai] Task created: ${taskId}`);

    console.error(`[klingai] Waiting for video generation (up to 5 min)...`);
    const result = await this.waitForTask(taskId);
    console.error(`[klingai] Video ready: ${result.videoUrl}`);

    // Generate output path with run id if provided
    let outputPath = options.outputPath;
    if (!outputPath) {
      if (options.runId) {
        outputPath = `output/videos/${options.runId}_${result.videoId}.mp4`;
      } else {
        outputPath = `output/videos/${result.videoId}.mp4`;
      }
    }

    console.error(`[klingai] Downloading video to ${outputPath}...`);
    await this.downloadVideo(result.videoUrl, outputPath);

    return {
      videoPath: outputPath,
      taskId,
      videoUrl: result.videoUrl,
      videoId: result.videoId,
      videoDuration: result.videoDuration,
      model,
      mode,
      duration,
      aspectRatio,
    };
  }
}