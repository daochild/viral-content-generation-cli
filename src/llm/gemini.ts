import { GoogleGenAI, type Content } from "@google/genai";
import type { LLMClient, LLMGenerateRequest, LLMGenerateResponse } from "./types";

export interface GeminiClientOptions {
  apiKey: string;
}

export class GeminiClient implements LLMClient {
  private readonly client: GoogleGenAI;

  constructor(opts: GeminiClientOptions) {
    this.client = new GoogleGenAI({ apiKey: opts.apiKey });
  }

  async generate(req: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    // Build contents array with proper role mapping
    const contents: Content[] = req.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await this.client.models.generateContent({
      model: req.model,
      contents,
      config: {
        temperature: req.temperature,
        maxOutputTokens: req.maxOutputTokens,
      },
    });

    const text = response.text ?? "";

    return { text, raw: response };
  }
}
