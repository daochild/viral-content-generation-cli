import { GoogleGenAI } from "@google/genai";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Default TTS model for Gemini.
 */
export const GEMINI_TTS_DEFAULT_MODEL = "gemini-2.5-flash-preview-tts";

/**
 * Available prebuilt Gemini TTS voices.
 * Reference: https://ai.google.dev/gemini-api/docs/speech-generation
 */
export type GeminiTtsVoice =
  | "Aoede"
  | "Charon"
  | "Fenrir"
  | "Kore"
  | "Leda"
  | "Orus"
  | "Puck"
  | "Zephyr";

export const GEMINI_TTS_VOICES: GeminiTtsVoice[] = [
  "Aoede",
  "Charon",
  "Fenrir",
  "Kore",
  "Leda",
  "Orus",
  "Puck",
  "Zephyr",
];

export interface GeminiTtsClientOptions {
  apiKey: string;
}

export interface GeminiTtsGenerateRequest {
  /** Text to convert to speech */
  text: string;
  /** Model to use (default: gemini-2.5-flash-preview-tts) */
  model?: string;
  /** Prebuilt voice name (default: Kore) */
  voice?: GeminiTtsVoice;
  /** Absolute path where the .wav file should be saved */
  outputPath: string;
}

export interface GeminiTtsGenerateResult {
  /** Absolute path to the saved .wav file */
  audioPath: string;
  /** Voice used */
  voice: GeminiTtsVoice;
  /** Model used */
  model: string;
}

/**
 * Build a WAV file buffer from raw PCM s16le 24 kHz mono data.
 * Gemini TTS returns audio/pcm;rate=24000, which is 16-bit LE mono.
 */
function buildWavBuffer(pcmData: Buffer): Buffer {
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmData.length;
  const headerSize = 44;

  const buffer = Buffer.alloc(headerSize + dataSize);
  let offset = 0;

  // RIFF chunk descriptor
  buffer.write("RIFF", offset); offset += 4;
  buffer.writeUInt32LE(36 + dataSize, offset); offset += 4;
  buffer.write("WAVE", offset); offset += 4;

  // fmt sub-chunk
  buffer.write("fmt ", offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;          // sub-chunk1 size (PCM)
  buffer.writeUInt16LE(1, offset); offset += 2;            // audio format: PCM
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

  // data sub-chunk
  buffer.write("data", offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;
  pcmData.copy(buffer, offset);

  return buffer;
}

/**
 * Gemini TTS client — converts text to speech using Gemini's native TTS API.
 * Saves output as a WAV file (PCM 16-bit, 24 kHz, mono).
 */
export class GeminiTtsClient {
  private readonly client: GoogleGenAI;

  constructor(opts: GeminiTtsClientOptions) {
    this.client = new GoogleGenAI({ apiKey: opts.apiKey });
  }

  async generate(req: GeminiTtsGenerateRequest): Promise<GeminiTtsGenerateResult> {
    const model = req.model ?? GEMINI_TTS_DEFAULT_MODEL;
    const voice: GeminiTtsVoice = req.voice ?? "Kore";

    // Call the Gemini TTS endpoint
    const response = await this.client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: req.text }] }],
      config: {
        responseModalities: ["AUDIO"] as any,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        } as any,
      },
    });

    // Extract audio inline data from response
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const audioPart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("audio/"));

    if (!audioPart || !audioPart.inlineData?.data) {
      throw new Error("Gemini TTS returned no audio data");
    }

    // Decode base64 PCM data and wrap in WAV container
    const pcmBuffer = Buffer.from(audioPart.inlineData.data, "base64");
    const wavBuffer = buildWavBuffer(pcmBuffer);

    // Ensure output directory exists and write WAV file
    await mkdir(dirname(req.outputPath), { recursive: true });
    await writeFile(req.outputPath, wavBuffer);

    return {
      audioPath: req.outputPath,
      voice,
      model,
    };
  }
}

