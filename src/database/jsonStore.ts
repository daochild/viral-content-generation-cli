import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface JsonStore {
  writeRun(runId: string, data: unknown): Promise<string>;
}

export class FileJsonStore implements JsonStore {
  constructor(private readonly dir: string) {}

  async writeRun(runId: string, data: unknown): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    const file = join(this.dir, `${runId}.json`);
    await writeFile(file, JSON.stringify(data, null, 2), "utf8");
    return file;
  }
}

/**
 * Generate a run ID with timestamp and type suffix.
 * Format: run-YYYY-MM-DDTHH-mm-ss-mmmZ-{photo|video}
 */
export function makeRunId(type: "photo" | "video"): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `run-${ts}-${type}`;
}
