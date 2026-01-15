import { mkdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Image information from generation result.
 */
export interface ImageInfo {
  /** Base64 encoded image data */
  data: string;
  /** MIME type of the image (e.g., image/png) */
  mimeType: string;
  /** Generated image ID */
  id?: string;
}

/**
 * Result of image download operation.
 */
export interface ImageDownloadResult {
  success: boolean;
  filePath?: string;
  error?: string;
  mimeType: string;
  imageId: string;
}

/**
 * Options for image download.
 */
export interface ImageDownloadOptions {
  /** Output directory for downloaded images */
  outputDir?: string;
  /** Custom filename (without extension) */
  filename?: string;
  /** Run ID to include in filename */
  runId?: string;
  /** Overwrite existing files */
  overwrite?: boolean;
  /** Image index (for multiple images in one run) */
  index?: number;
}

/**
 * Generates filename for image based on options.
 * Format: {runId}_{index}.{ext} or {filename}.{ext}
 */
export function generateImageFilename(
  mimeType: string,
  options: ImageDownloadOptions = {}
): string {
  // Extract extension from MIME type
  const ext = mimeType.split("/")[1] ?? "png";

  if (options.filename) {
    return `${options.filename}.${ext}`;
  }

  const indexSuffix = options.index !== undefined ? `_${options.index}` : "";

  if (options.runId) {
    return `${options.runId}${indexSuffix}.${ext}`;
  }

  return `image_${Date.now()}${indexSuffix}.${ext}`;
}

/**
 * Saves base64 image data to a file.
 * @param imageData - Base64 encoded image data
 * @param mimeType - MIME type of the image
 * @param options - Download options
 * @returns Path to the saved file
 */
export async function saveImage(
  imageData: string,
  mimeType: string,
  options: ImageDownloadOptions = {}
): Promise<string> {
  const {
    outputDir = "./output/images",
    overwrite = false,
  } = options;

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  // Generate filename
  const filename = generateImageFilename(mimeType, options);
  const filePath = join(outputDir, filename);

  // Check if file exists
  if (!overwrite) {
    const file = Bun.file(filePath);
    if (await file.exists()) {
      throw new Error(
        `File already exists: ${filePath}. Set overwrite: true to replace.`
      );
    }
  }

  // Decode base64 and save
  const buffer = Buffer.from(imageData, "base64");
  await Bun.write(filePath, buffer);

  return filePath;
}

/**
 * Downloads an image from URL to local file.
 * @param imageUrl - URL of the image to download
 * @param options - Download options
 * @returns Path to the downloaded file
 */
export async function downloadImage(
  imageUrl: string,
  options: ImageDownloadOptions & { mimeType?: string } = {}
): Promise<string> {
  const {
    outputDir = "./output/images",
    overwrite = false,
  } = options;

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  // Download image
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to download image: ${response.status} ${response.statusText}`
    );
  }

  // Get MIME type from response or options
  const contentType = response.headers.get("content-type") ?? options.mimeType ?? "image/png";
  const mimeType = contentType.split(";")[0]?.trim() ?? "image/png";

  // Generate filename
  const filename = generateImageFilename(mimeType, options);
  const filePath = join(outputDir, filename);

  // Check if file exists
  if (!overwrite) {
    const file = Bun.file(filePath);
    if (await file.exists()) {
      throw new Error(
        `File already exists: ${filePath}. Set overwrite: true to replace.`
      );
    }
  }

  const arrayBuffer = await response.arrayBuffer();
  await Bun.write(filePath, arrayBuffer);

  return filePath;
}

/**
 * Saves multiple images from generation results.
 * @param images - Array of image info objects
 * @param options - Download options
 * @returns Array of download results
 */
export async function saveImages(
  images: ImageInfo[],
  options: ImageDownloadOptions = {}
): Promise<ImageDownloadResult[]> {
  const results: ImageDownloadResult[] = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    if (!image) continue;
    
    try {
      const filePath = await saveImage(image.data, image.mimeType, {
        ...options,
        index: images.length > 1 ? i + 1 : options.index,
      });

      results.push({
        success: true,
        filePath,
        mimeType: image.mimeType,
        imageId: image.id ?? `image_${i + 1}`,
      });
    } catch (error) {
      results.push({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        mimeType: image.mimeType,
        imageId: image.id ?? `image_${i + 1}`,
      });
    }
  }

  return results;
}

/**
 * Saves an image for a specific run.
 * Convenience function for CLI usage.
 */
export async function saveImageForRun(
  imageData: string,
  mimeType: string,
  runId: string,
  outputDir = "./output/images",
  index?: number
): Promise<string> {
  return saveImage(imageData, mimeType, {
    outputDir,
    runId,
    index,
    overwrite: true,
  });
}