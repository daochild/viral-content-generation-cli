import { GoogleGenAI } from "@google/genai";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface GeminiImageClientOptions {
  apiKey: string;
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
 * Gemini client for image generation using Imagen models.
 */
export class GeminiImageClient {
  private readonly client: GoogleGenAI;

  constructor(opts: GeminiImageClientOptions) {
    this.client = new GoogleGenAI({ apiKey: opts.apiKey });
  }

  async generate(options: GenerateImageOptions): Promise<GenerateImageResult> {
    const model = options.model ?? "gemini-2.5-flash-image";
    
    const response = await this.client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: options.prompt }] }],
      config: {
        responseModalities: ["image", "text"],
      },
    });

    // Extract image from response
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith("image/")) {
        const imageData = part.inlineData.data;
        const mimeType = part.inlineData.mimeType;
        
        if (!imageData) {
          throw new Error("No image data in response");
        }

        // Determine file extension
        const ext = mimeType.split("/")[1] ?? "png";
        
        // Generate image ID
        const imageId = `img_${Date.now()}`;
        
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
        
        // Decode base64 and save
        const buffer = Buffer.from(imageData, "base64");
        await writeFile(outputPath, buffer);

        return {
          imagePath: outputPath,
          mimeType,
          model,
          prompt: options.prompt,
          imageId,
        };
      }
    }

    throw new Error("No image generated in response");
  }
}