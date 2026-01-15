import OpenAI from "openai";
import type { LLMClient, LLMGenerateRequest, LLMGenerateResponse } from "./types";

export interface OpenAIClientOptions {
  apiKey: string;
  baseUrl?: string;
}

/**
 * OpenAI client using the official openai library.
 */
export class OpenAIClient implements LLMClient {
  private readonly client: OpenAI;

  constructor(opts: OpenAIClientOptions) {
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: opts.baseUrl,
    });
  }

  async generate(req: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const response = await this.client.chat.completions.create({
      model: req.model,
      messages: req.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: req.temperature,
      max_tokens: req.maxOutputTokens,
    });

    const text = response.choices[0]?.message?.content ?? "";

    return { text, raw: response };
  }

  async models(): Promise<string[]> {
    const response = await this.client.models.list();
    return response.data?.map((m) => m.id) ?? [];
  }
}
