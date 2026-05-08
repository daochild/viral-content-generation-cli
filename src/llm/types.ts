export type LLMRole = "system" | "user" | "assistant";

export interface LLMMediaPart {
  type: "file_uri" | "inline";
  mimeType?: string; // e.g., "video/mp4", "image/jpeg"
  data: string; // File URI or base64 encoded data
  videoMetadata?: {
    startOffset?: string;
    endOffset?: string;
    fps?: number;
  };
}

export interface LLMMessage {
  role: LLMRole;
  content: string;
  media?: LLMMediaPart[];
}

export interface LLMGenerateRequest {
  /** Provider model name, e.g. gpt-4o-mini, gemini-1.5-flash */
  model: string;
  messages: LLMMessage[];
  /** If provided, the client should try to keep output within this size */
  maxOutputTokens?: number;
  temperature?: number;
}

export interface LLMGenerateResponse {
  text: string;
  raw?: unknown;
}

export interface LLMVideoGenerateRequest {
  model: string;
  prompt: string;
  image?: { mimeType: string; data: string };
  config?: {
    aspectRatio?: "16:9" | "9:16";
    durationSeconds?: "4" | "6" | "8";
    personGeneration?: "allow_all" | "allow_adult" | "dont_allow";
    resolution?: "720p" | "1080p" | "4k";
    lastFrame?: { mimeType: string; data: string };
    referenceImages?: Array<{
      image: { inlineData: { mimeType: string; data: string } };
      referenceType: "asset";
    }>;
    numberOfVideos?: number;
  };
  video?: { mimeType: string; data: string }; // For extension
}

export interface LLMVideoGenerateResponse {
  videoUri: string;
  raw?: unknown;
}

export interface LLMClient {
  generate(req: LLMGenerateRequest): Promise<LLMGenerateResponse>;
  generateVideo?(req: LLMVideoGenerateRequest): Promise<LLMVideoGenerateResponse>;
}
