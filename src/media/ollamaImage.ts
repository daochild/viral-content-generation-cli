import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface OllamaImageClientOptions {
  apiKey?: string;
  apiUrl?: string;
}

export interface GenerateImageOptions {
  prompt: string;
  model?: string;
  /** Output path for the image file */
  outputPath?: string;
  /** Run ID to link image file to run */
  runId?: string;
  /** Output directory (used with runId) */
  outputDir?: string;
  /** Image index (for multiple images in one run) */
  index?: number;
}

export interface GenerateImageResult {
  /** Path to saved image file */
  imagePath: string;
  /** MIME type of the image */
  mimeType: string;
  /** Model used for generation */
  model: string;
  /** Original prompt */
  prompt: string;
  /** Generated image ID */
  imageId: string;
}

/**
 * Ollama-compatible image client using Stability AI for image generation.
 * Used when Ollama is selected as the LLM provider for prompts.
 */
export class OllamaImageClient {
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor(opts: OllamaImageClientOptions) {
    this.apiKey = opts.apiKey ?? process.env.STABILITY_API_KEY ?? "";
    this.apiUrl = opts.apiUrl ?? process.env.STABILITY_API_URL ?? "https://api.stability.ai/v2beta/stable-image/generate/core";
  }

  async generate(options: GenerateImageOptions): Promise<GenerateImageResult> {
    if (!this.apiKey) {
      throw new Error("STABILITY_API_KEY environment variable is required for image generation with Ollama");
    }

    const model = options.model ?? "core";
    const imageId = `img_${Date.now()}`;

    // Prepare form data for Stability AI
    const formData = new FormData();
    formData.append("prompt", options.prompt);
    formData.append("output_format", "png");

    // Make request to Stability AI
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Accept": "image/*",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Stability AI API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Get image data
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get("content-type") ?? "image/png";

    // Determine file extension
    const ext = mimeType.split("/")[1] ?? "png";

    // Generate output path
    let outputPath = options.outputPath;
    if (!outputPath) {
      const outputDir = options.outputDir ?? "output/images";
      const indexSuffix = options.index !== undefined ? `_${options.index}` : "";

      if (options.runId) {
        outputPath = join(outputDir, `${options.runId}${indexSuffix}.${ext}`);
      } else {
        outputPath = join(outputDir, `${imageId}.${ext}`);
      }
    }

    // Ensure directory exists
    await mkdir(dirname(outputPath), { recursive: true });

    // Save image
    await writeFile(outputPath, imageBuffer);

    return {
      imagePath: outputPath,
      mimeType,
      model,
      prompt: options.prompt,
      imageId,
    };
  }
}
