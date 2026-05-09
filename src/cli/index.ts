import { parseArgs } from "util";
import { join } from "node:path";
import { GeminiClient } from "../llm/gemini";
import { OpenAIClient } from "../llm/openai";
import { OllamaClient } from "../llm/ollama";
import type { LLMClient } from "../llm/types";
import { generatePrompts } from "../generator/prompts";
import { FileJsonStore, makeRunId } from "../database/jsonStore";
import { GeminiImageClient } from "../media/geminiImage";
import { OllamaImageClient } from "../media/ollamaImage";
import { KlingAIClient } from "../media/klingai";
import { GeminiTtsClient, GEMINI_TTS_DEFAULT_MODEL, GEMINI_TTS_VOICES } from "../media/geminiTts";
import type { RunRecord } from "../domain/types";

const RUNS_DIR = "./runs";
const OUTPUT_DIR = "./output";

function printHelp() {
  console.log(`
viral-video-generator

Usage:
  viral --photo --prompt "topic" -n <count>    Generate photo prompts
  viral --video --prompt "topic" -n <count>    Generate video prompts (TikTok unique)
  viral --photo --prompt "topic" -n <count> --gen    Generate prompts AND images
  viral --video --prompt "topic" -n <count> --gen    Generate prompts AND videos
  viral --tts --prompt "text to speak" -n <count>    Generate speech audio (Gemini only)

Options:
  --photo           Generate photo prompts
  --video           Generate video prompts with TikTok uniqueness rules
  --tts             Generate text-to-speech audio files (Gemini only)
  --gen             Also generate actual media (images via Gemini, videos via KlingAI)
  --prompt, -p      Base topic/idea for generation (or exact text for --tts)
  -n                Number of prompts / audio files to generate (default: 5)
  --provider        LLM provider: gemini, openai, or ollama (default: gemini)
  --model           Model name for prompts (default: gemini-2.5-flash)
  --voice           TTS voice name for --tts mode (default: Kore)
                    Available: ${GEMINI_TTS_VOICES.join(", ")}
  --outDir          Output directory for run logs (default: ./runs)
  --help, -h        Show this help message
  --version, -v     Show version

Environment variables:
  GEMINI_API_KEY       API key for Gemini (prompts, images, and TTS)
  OPENAI_API_KEY       API key for OpenAI (prompts only)
  OLLAMA_BASE_URL      Base URL for Ollama server (default: http://localhost:11434)
  STABILITY_API_KEY    API key for Stability AI (required for Ollama image generation)
  STABILITY_API_URL    Stability AI endpoint or local SD server (optional)
  NANO_BANANA_MODEL    Model for image generation (default: gemini-2.5-flash-image)
  KLINGAI_API_KEY      API key for KlingAI (video generation)
  KLINGAI_API_SECRET   API secret for KlingAI
  KLINGAI_MODEL        Model for video: kling-v1-6, kling-v2-master, etc. (default: kling-v1-6)
  KLINGAI_MODE         Mode: std or pro (default: std)
  GEMINI_TTS_MODEL     Model for TTS (default: ${GEMINI_TTS_DEFAULT_MODEL})

Examples:
  viral --photo --prompt "cozy coffee shop aesthetic" -n 10
  viral --video --prompt "productivity tips" -n 5 --provider openai
  viral --photo --prompt "sunset beach" -n 3 --gen
  viral --video --prompt "cooking tutorial" -n 2 --gen
  viral --photo --prompt "nature scene" -n 5 --provider ollama --model llama3.2
  viral --tts --prompt "Welcome to our channel! Today we explore productivity." -n 1
  viral --tts --prompt "Top 5 tips to stay focused." -n 3 --voice Puck
`);
}

function createLLMClient(provider: string): LLMClient {
  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }
    return new OpenAIClient({ apiKey });
  }

  if (provider === "ollama") {
    const baseUrl = process.env.OLLAMA_BASE_URL;
    return new OllamaClient({ baseUrl });
  }
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }
  return new GeminiClient({ apiKey });
}

function getDefaultModel(provider: string): string {
  if (provider === "openai") return "gpt-4o-mini";
  if (provider === "ollama") return "llama3.2";
  return "gemini-2.5-flash";
}

export async function runCli(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
      photo: { type: "boolean", default: false },
      video: { type: "boolean", default: false },
      tts: { type: "boolean", default: false },
      gen: { type: "boolean", default: false },
      prompt: { type: "string", short: "p" },
      n: { type: "string", default: "5" },
      provider: { type: "string", default: "gemini" },
      model: { type: "string" },
      voice: { type: "string" },
      outDir: { type: "string", default: RUNS_DIR },
    },
    allowPositionals: true,
  });

  if (values.version) {
    console.log("viral-video-generator v2.0.0");
    return;
  }

  if (values.help) {
    printHelp();
    return;
  }

  const isPhoto = values.photo;
  const isVideo = values.video;
  const isTts = values.tts;
  const shouldGenerate = values.gen;

  if (!isPhoto && !isVideo && !isTts) {
    console.error("Error: Specify --photo, --video, or --tts");
    printHelp();
    process.exitCode = 2;
    return;
  }

  const modeCount = [isPhoto, isVideo, isTts].filter(Boolean).length;
  if (modeCount > 1) {
    console.error("Error: Cannot combine --photo, --video, and --tts");
    process.exitCode = 2;
    return;
  }

  const prompt = values.prompt?.trim();
  if (!prompt) {
    console.error("Error: --prompt is required");
    process.exitCode = 2;
    return;
  }

  const count = parseInt(values.n ?? "5", 10);
  if (!Number.isFinite(count) || count < 1) {
    console.error("Error: -n must be a positive number");
    process.exitCode = 2;
    return;
  }

  const provider = values.provider ?? "gemini";
  if (provider !== "gemini" && provider !== "openai" && provider !== "ollama") {
    console.error("Error: --provider must be 'gemini', 'openai', or 'ollama'");
    process.exitCode = 2;
    return;
  }

  // TTS is Gemini-only
  if (isTts && provider !== "gemini") {
    console.error("Error: --tts mode only supports --provider gemini");
    process.exitCode = 2;
    return;
  }

  // Validate voice if provided
  const voiceArg = values.voice;
  if (voiceArg && !GEMINI_TTS_VOICES.includes(voiceArg as any)) {
    console.error(`Error: --voice must be one of: ${GEMINI_TTS_VOICES.join(", ")}`);
    process.exitCode = 2;
    return;
  }

  const model = values.model ?? getDefaultModel(provider);
  const type = isPhoto ? "photo" : isVideo ? "video" : "tts";
  const outDir = values.outDir ?? RUNS_DIR;

  const store = new FileJsonStore(outDir);
  const runId = makeRunId(type);

  const runRecord: RunRecord = {
    id: runId,
    createdAt: new Date().toISOString(),
    type,
    status: "success",
    input: {
      basePrompt: prompt,
      count,
      ...(isTts ? { ttsText: prompt } : {}),
    },
    config: {
      provider,
      model,
      ...(isTts ? { voice: voiceArg ?? "Kore" } : {}),
    },
  };

  console.error(`[viral] Generating ${count} ${type} prompt(s) using ${provider}/${model}...`);

  try {
    // TTS mode: directly synthesize speech without LLM prompt generation
    if (isTts) {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required for TTS generation");
      }

      const ttsModel = process.env.GEMINI_TTS_MODEL ?? GEMINI_TTS_DEFAULT_MODEL;
      const voice = (voiceArg ?? "Kore") as any;
      const ttsClient = new GeminiTtsClient({ apiKey: geminiApiKey });
      const outputBaseDir = join(OUTPUT_DIR, runId);
      const generatedMedia: string[] = [];
      const ttsMeta: import("../domain/types").TtsGenerationMeta[] = [];

      console.error(`[viral] Generating ${count} speech file(s) using ${ttsModel} (voice: ${voice})...`);

      for (let i = 0; i < count; i++) {
        const outputPath = join(outputBaseDir, `speech-${i + 1}.wav`);
        console.error(`[viral] Generating speech ${i + 1}/${count}...`);
        try {
          const result = await ttsClient.generate({
            text: prompt,
            model: ttsModel,
            voice,
            outputPath,
          });
          generatedMedia.push(result.audioPath);
          ttsMeta.push({ voice: result.voice, model: result.model, text: prompt, audioPath: result.audioPath });
          console.error(`[viral] Audio saved: ${result.audioPath}`);
        } catch (err: any) {
          console.error(`[viral] Failed to generate speech ${i + 1}: ${err?.message ?? err}`);
        }
      }

      runRecord.generatedMedia = generatedMedia;
      runRecord.ttsMeta = ttsMeta;

      const savedPath = await store.writeRun(runId, runRecord);
      console.error(`[viral] Run saved: ${savedPath}`);
      console.log(JSON.stringify({ media: generatedMedia, ttsMeta }, null, 2));
      return;
    }

    const client = createLLMClient(provider);
    
    const result = await generatePrompts(client, {
      type: type as "photo" | "video",
      basePrompt: prompt,
      count,
      model,
    });

    runRecord.output = { prompts: result.prompts };

    if (shouldGenerate) {
      const generatedMedia: string[] = [];
      const outputBaseDir = join(OUTPUT_DIR, runId);

      if (isPhoto) {
        if (provider === "ollama") {
          // Use Stability AI for image generation (Ollama handles prompts only)
          const imageClient = new OllamaImageClient({});

          console.error(`[viral] Generating ${result.prompts.length} image(s) using Stability AI...`);
          console.error(`[viral] Note: Set STABILITY_API_KEY for image generation with Ollama prompts`);

          for (let i = 0; i < result.prompts.length; i++) {
            const imagePrompt = result.prompts[i]!;
            const outputPath = join(outputBaseDir, `image-${i + 1}.png`);
            
            console.error(`[viral] Generating image ${i + 1}/${result.prompts.length}...`);
            
            try {
              const imageResult = await imageClient.generate({
                prompt: imagePrompt,
                outputPath,
              });
              generatedMedia.push(imageResult.imagePath);
              console.error(`[viral] Image saved: ${imageResult.imagePath}`);
            } catch (err: any) {
              console.error(`[viral] Failed to generate image ${i + 1}: ${err?.message ?? err}`);
            }
          }
        } else {
          // Use Gemini for image generation (default)
          const geminiApiKey = process.env.GEMINI_API_KEY;
          if (!geminiApiKey) {
            throw new Error("GEMINI_API_KEY environment variable is required for image generation");
          }

          const imageModel = process.env.NANO_BANANA_MODEL ?? "gemini-2.5-flash-image";
          const imageClient = new GeminiImageClient({ apiKey: geminiApiKey });

          console.error(`[viral] Generating ${result.prompts.length} image(s) using ${imageModel}...`);

          for (let i = 0; i < result.prompts.length; i++) {
            const imagePrompt = result.prompts[i]!;
            const outputPath = join(outputBaseDir, `image-${i + 1}.png`);
            
            console.error(`[viral] Generating image ${i + 1}/${result.prompts.length}...`);
            
            try {
              const imageResult = await imageClient.generate({
                prompt: imagePrompt,
                model: imageModel,
                outputPath,
              });
              generatedMedia.push(imageResult.imagePath);
              console.error(`[viral] Image saved: ${imageResult.imagePath}`);
            } catch (err: any) {
              console.error(`[viral] Failed to generate image ${i + 1}: ${err?.message ?? err}`);
            }
          }
        }
      } else if (isVideo) {
        const klingApiKey = process.env.KLINGAI_API_KEY;
        const klingApiSecret = process.env.KLINGAI_API_SECRET;
        
        if (!klingApiKey || !klingApiSecret) {
          throw new Error("KLINGAI_API_KEY and KLINGAI_API_SECRET environment variables are required for video generation");
        }

        const videoModel = process.env.KLINGAI_MODEL ?? "kling-v1-6";
        const videoMode = (process.env.KLINGAI_MODE ?? "std") as "std" | "pro";

        const videoClient = new KlingAIClient({
          apiKey: klingApiKey,
          apiSecret: klingApiSecret,
        });

        console.error(`[viral] Generating ${result.prompts.length} video(s) using KlingAI (${videoModel}/${videoMode})...`);

        for (let i = 0; i < result.prompts.length; i++) {
          const videoPrompt = result.prompts[i]!;
          const outputPath = join(outputBaseDir, `video-${i + 1}.mp4`);
          
          console.error(`[viral] Generating video ${i + 1}/${result.prompts.length}...`);
          
          try {
            const videoResult = await videoClient.generate({
              prompt: videoPrompt,
              model: videoModel,
              mode: videoMode,
              aspectRatio: "9:16",
              duration: 5,
              outputPath,
            });
            generatedMedia.push(videoResult.videoPath);
            console.error(`[viral] Video saved: ${videoResult.videoPath}`);
          } catch (err: any) {
            console.error(`[viral] Failed to generate video ${i + 1}: ${err?.message ?? err}`);
          }
        }
      }

      runRecord.generatedMedia = generatedMedia;
    }

    const savedPath = await store.writeRun(runId, runRecord);
    console.error(`[viral] Run saved: ${savedPath}`);

    const output = shouldGenerate 
      ? { prompts: result.prompts, media: runRecord.generatedMedia }
      : result.prompts;
    console.log(JSON.stringify(output, null, 2));
  } catch (error: any) {
    const errorMessage = error?.message ?? String(error);
    
    runRecord.status = "error";
    runRecord.error = errorMessage;

    try {
      const savedPath = await store.writeRun(runId, runRecord);
      console.error(`[viral] Run saved: ${savedPath}`);
    } catch {
      // Ignore save errors
    }

    console.error(`Error: ${errorMessage}`);
    process.exitCode = 1;
  }
}