import { GoogleGenAI, type Content } from "@google/genai";
import type { LLMClient, LLMGenerateRequest, LLMGenerateResponse, LLMVideoGenerateRequest, LLMVideoGenerateResponse } from "./types";

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
    const contents: Content[] = req.messages.map((m) => {
      const parts: any[] = [];

      if (m.media) {
        for (const media of m.media) {
          if (media.type === "inline") {
            parts.push({
              inlineData: {
                mimeType: media.mimeType ?? "video/mp4",
                data: media.data,
              },
              ...(media.videoMetadata ? { videoMetadata: media.videoMetadata } : {}),
            });
          } else if (media.type === "file_uri") {
            parts.push({
              fileData: {
                fileUri: media.data,
                mimeType: media.mimeType ?? "video/mp4",
              },
              ...(media.videoMetadata ? { videoMetadata: media.videoMetadata } : {}),
            });
          }
        }
      }

      // Add text part (usually best placed after media parts)
      parts.push({ text: m.content });

      return {
        role: m.role === "assistant" ? "model" : "user",
        parts,
      };
    });

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

  async generateVideo(req: LLMVideoGenerateRequest): Promise<LLMVideoGenerateResponse> {
    const aiParams: any = {
      model: req.model,
      prompt: req.prompt,
    };

    if (req.image) {
      aiParams.image = {
        imageBytes: req.image.data, // base64
        mimeType: req.image.mimeType,
      };
    }

    if (req.video) {
      aiParams.video = {
        videoBytes: req.video.data, // base64 representation if inline
        mimeType: req.video.mimeType,
      };
    }

    if (req.config) {
      const config: any = {};
      if (req.config.aspectRatio) config.aspectRatio = req.config.aspectRatio;
      if (req.config.durationSeconds) config.durationSeconds = req.config.durationSeconds;
      if (req.config.personGeneration) config.personGeneration = req.config.personGeneration;
      if (req.config.resolution) config.resolution = req.config.resolution;
      if (req.config.numberOfVideos) config.numberOfVideos = req.config.numberOfVideos;

      if (req.config.lastFrame) {
        config.lastFrame = {
          imageBytes: req.config.lastFrame.data,
          mimeType: req.config.lastFrame.mimeType,
        };
      }

      if (req.config.referenceImages) {
        config.referenceImages = req.config.referenceImages.map((ref) => ({
          image: {
            imageBytes: ref.image.inlineData.data,
            mimeType: ref.image.inlineData.mimeType,
          },
          referenceType: ref.referenceType,
        }));
      }

      aiParams.config = config;
    }

    let operation = await this.client.models.generateVideos(aiParams);

    // Poll the operation status until the video is ready.
    while (!operation.done) {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      operation = await this.client.operations.getVideosOperation({
        operation,
      });
    }

    const generatedVideos = operation.response?.generatedVideos;
    if (!generatedVideos || generatedVideos.length === 0) {
      throw new Error("No video was generated.");
    }

    return {
      // @ts-ignore - Assuming the response structure contains video.uri, adjust if necessary based on actual API response
      videoUri: generatedVideos[0].video.uri,
      raw: operation,
    };
  }
}
