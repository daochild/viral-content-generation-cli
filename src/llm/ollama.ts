import { Ollama } from "ollama";
import type { LLMClient, LLMGenerateRequest, LLMGenerateResponse } from "./types";

export interface OllamaClientOptions {
  baseUrl?: string;
}

/**
 * Ollama client for local LLM inference.
 * Connects to Ollama server (default: http://localhost:11434)
 */
export class OllamaClient implements LLMClient {
  private readonly client: Ollama;

  constructor(opts: OllamaClientOptions = {}) {
    this.client = new Ollama({
      host: opts.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    });
  }

  async generate(req: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const response = await this.client.chat({
      model: req.model,
      messages: req.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      options: {
        temperature: req.temperature,
        num_predict: req.maxOutputTokens,
      },
    });

    const text = response.message?.content ?? "";

    return { text, raw: response };
  }

  /**
   * List available models from the Ollama server
   */
  async models(): Promise<string[]> {
    const response = await this.client.list();
    return response.models?.map((m) => m.name) ?? [];
  }
}
