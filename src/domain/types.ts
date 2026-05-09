/**
 * Generated prompt types.
 */

export type PromptType = "photo" | "video" | "tts";

export interface GeneratedPrompt {
  type: PromptType;
  prompt: string;
  index: number;
}

export interface GenerationResult {
  type: PromptType;
  basePrompt: string;
  count: number;
  prompts: string[];
  model: string;
  provider: string;
  generatedAt: string;
}

/**
 * Video generation metadata from KlingAI task.
 */
export interface VideoGenerationMeta {
  /** KlingAI task ID */
  taskId: string;
  /** Video model used: kling-v1-6, kling-v2-master, etc. */
  model: string;
  /** Generation mode: std or pro */
  mode: "std" | "pro";
  /** Video duration in seconds */
  duration: 5 | 10;
  /** Aspect ratio: 16:9, 9:16, 1:1 */
  aspectRatio: string;
  /** Video URL from KlingAI (expires after 30 days) */
  videoUrl: string;
  /** Video ID from KlingAI */
  videoId: string;
  /** Video duration from result */
  videoDuration?: string;
}

/**
 * Image generation metadata from Gemini.
 */
export interface ImageGenerationMeta {
  /** Generated image ID */
  imageId: string;
  /** Model used for generation */
  model: string;
  /** MIME type of the image */
  mimeType: string;
  /** Original prompt used */
  prompt: string;
  /** Path to saved image file */
  imagePath: string;
}

/**
 * TTS generation metadata from Gemini TTS.
 */
export interface TtsGenerationMeta {
  /** Voice name used (e.g., "Kore", "Puck") */
  voice: string;
  /** Model used for TTS generation */
  model: string;
  /** Original text converted to speech */
  text: string;
  /** Path to saved .wav file */
  audioPath: string;
}

/**
 * FFmpeg enhancement presets for generated videos.
 */
export type VideoEnhancementPreset = "social" | "vertical" | "clean" | "stabilize";

/**
 * FFmpeg encoder speed presets used by the enhancement pipeline.
 */
export type VideoEnhancementSpeed =
  | "ultrafast"
  | "superfast"
  | "veryfast"
  | "faster"
  | "fast"
  | "medium"
  | "slow"
  | "slower"
  | "veryslow";

/**
 * Video enhancement metadata written after FFmpeg post-processing.
 */
export interface VideoEnhancementMeta {
  /** Original generated video path */
  inputPath: string;
  /** Enhanced output video path */
  outputPath: string;
  /** Enhancement preset used */
  preset: VideoEnhancementPreset;
  /** CRF value used during encoding */
  crf: number;
  /** Encoder speed preset */
  speed: VideoEnhancementSpeed;
  /** When the enhanced file was created */
  createdAt: string;
}

/**
 * Run record for storing generation results.
 */
export interface RunRecord {
  id: string;
  createdAt: string;
  type: PromptType;
  status: "success" | "error";
  input: {
    basePrompt: string;
    count: number;
    /** For TTS mode: the raw text to synthesize (overrides prompts) */
    ttsText?: string;
  };
  config: {
    provider: string;
    model: string;
    /** For TTS mode: the voice used */
    voice?: string;
  };
  output?: {
    prompts: string[];
  };
  /** Paths to generated media files (when --gen flag is used) */
  generatedMedia?: string[];
  /** Paths to enhanced media files (when --enhance is used for videos) */
  enhancedMedia?: string[];
  /** Video generation metadata (when type is video and --gen flag is used) */
  videoMeta?: VideoGenerationMeta[];
  /** Image generation metadata (when type is photo and --gen flag is used) */
  imageMeta?: ImageGenerationMeta[];
  /** TTS generation metadata (when type is tts) */
  ttsMeta?: TtsGenerationMeta[];
  /** Video enhancement metadata (when FFmpeg enhancement is used) */
  enhancementMeta?: VideoEnhancementMeta[];
  error?: string;
}
