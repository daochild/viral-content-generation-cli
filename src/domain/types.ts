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
  /** Video generation metadata (when type is video and --gen flag is used) */
  videoMeta?: VideoGenerationMeta[];
  /** Image generation metadata (when type is photo and --gen flag is used) */
  imageMeta?: ImageGenerationMeta[];
  /** TTS generation metadata (when type is tts) */
  ttsMeta?: TtsGenerationMeta[];
  error?: string;
}
