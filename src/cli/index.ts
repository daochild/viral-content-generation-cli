import { parseArgs } from "util";
import { join } from "node:path";
import { GeminiClient } from "../llm/gemini";
import { OpenAIClient } from "../llm/openai";
import type { LLMClient } from "../llm/types";
import { generatePrompts } from "../generator/prompts";
import { FileJsonStore, makeRunId } from "../database/jsonStore";
import { GeminiImageClient } from "../media/geminiImage";
import { KlingAIClient } from "../media/klingai";
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

Options:
  --photo           Generate photo prompts
  --video           Generate video prompts with TikTok uniqueness rules
  --gen             Also generate actual media (images via Gemini, videos via KlingAI)
  --prompt, -p      Base topic/idea for generation
  -n                Number of prompts to generate (default: 5)
  --provider        LLM provider: gemini or openai (default: gemini)
  --model           Model name for prompts (default: gemini-2.5-flash)
  --outDir          Output directory for run logs (default: ./runs)
  --help, -h        Show this help message
  --version, -v     Show version

Environment variables:
  GEMINI_API_KEY       API key for Gemini (prompts and images)
  OPENAI_API_KEY       API key for OpenAI (prompts only)
  NANO_BANANA_MODEL    Model for image generation (default: gemini-2.5-flash-image)
  KLINGAI_API_KEY      API key for KlingAI (video generation)
  KLINGAI_API_SECRET   API secret for KlingAI
  KLINGAI_MODEL        Model for video: kling-v1-6, kling-v2-master, etc. (default: kling-v1-6)
  KLINGAI_MODE         Mode: std or pro (default: std)

Examples:
  viral --photo --prompt "cozy coffee shop aesthetic" -n 10
  viral --video --prompt "productivity tips" -n 5 --provider openai
  viral --photo --prompt "sunset beach" -n 3 --gen
  viral --video --prompt "cooking tutorial" -n 2 --gen
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
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }
  return new GeminiClient({ apiKey });
}

function getDefaultModel(provider: string): string {
  return provider === "openai" ? "gpt-4o-mini" : "gemini-2.5-flash";
}

export async function runCli(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
      photo: { type: "boolean", default: false },
      video: { type: "boolean", default: false },
      gen: { type: "boolean", default: false },
      prompt: { type: "string", short: "p" },
      n: { type: "string", default: "5" },
      provider: { type: "string", default: "gemini" },
      model: { type: "string" },
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
  const shouldGenerate = values.gen;

  if (!isPhoto && !isVideo) {
    console.error("Error: Specify --photo or --video");
    printHelp();
    process.exitCode = 2;
    return;
  }

  if (isPhoto && isVideo) {
    console.error("Error: Cannot use both --photo and --video");
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
  if (provider !== "gemini" && provider !== "openai") {
    console.error("Error: --provider must be 'gemini' or 'openai'");
    process.exitCode = 2;
    return;
  }

  const model = values.model ?? getDefaultModel(provider);
  const type = isPhoto ? "photo" : "video";
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
    },
    config: {
      provider,
      model,
    },
  };

  console.error(`[viral] Generating ${count} ${type} prompt(s) using ${provider}/${model}...`);

  try {
    const client = createLLMClient(provider);
    
    const result = await generatePrompts(client, {
      type,
      basePrompt: prompt,
      count,
      model,
    });

    runRecord.output = { prompts: result.prompts };

    if (shouldGenerate) {
      const generatedMedia: string[] = [];
      const outputBaseDir = join(OUTPUT_DIR, runId);

      if (isPhoto) {
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
