import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface JsonStore {
  writeRun(runId: string, data: unknown): Promise<string>;
  readRun<T>(runId: string): Promise<T | undefined>;
}

export class FileJsonStore implements JsonStore {
  constructor(private readonly dir: string) {}

  async readRun<T>(runId: string): Promise<T | undefined> {
    const file = join(this.dir, `${runId}.json`);

    try {
      const content = await readFile(file, "utf8");
      return JSON.parse(content) as T;
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        return undefined;
      }

      throw error;
    }
  }

  async writeRun(runId: string, data: unknown): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    const file = join(this.dir, `${runId}.json`);
    await writeFile(file, JSON.stringify(data, null, 2), "utf8");
    return file;
  }
}

/**
 * Generate a run ID with timestamp and type suffix.
 * Format: run-YYYY-MM-DDTHH-mm-ss-mmmZ-{photo|video|tts}
 */
export function makeRunId(type: "photo" | "video" | "tts"): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `run-${ts}-${type}`;
}
