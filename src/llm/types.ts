export type LLMRole = "system" | "user" | "assistant";

export interface LLMMessage {
  role: LLMRole;
  content: string;
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

export interface LLMClient {
  generate(req: LLMGenerateRequest): Promise<LLMGenerateResponse>;
}
