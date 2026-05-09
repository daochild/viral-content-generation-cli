import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { enhanceVideo, findRunVideoInputs } from "../src/media/videoEnhancer";
import type { RunRecord } from "../src/domain/types";

async function commandExists(command: string): Promise<boolean> {
  const proc = Bun.spawn(["bash", "-lc", `command -v ${command} >/dev/null 2>&1`], {
	stdout: "ignore",
	stderr: "ignore",
  });

  await proc.exited;
  return proc.exitCode === 0;
}

async function createSampleVideo(outputPath: string): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });

  const proc = Bun.spawn(
	[
	  "ffmpeg",
	  "-y",
	  "-f",
	  "lavfi",
	  "-i",
	  "testsrc=size=640x360:rate=30",
	  "-f",
	  "lavfi",
	  "-i",
	  "sine=frequency=1000:sample_rate=44100",
	  "-t",
	  "1",
	  "-c:v",
	  "libx264",
	  "-pix_fmt",
	  "yuv420p",
	  "-c:a",
	  "aac",
	  "-shortest",
	  outputPath,
	],
	{
	  stdout: "pipe",
	  stderr: "pipe",
	},
  );

  const [stdout, stderr] = await Promise.all([
	new Response(proc.stdout).text(),
	new Response(proc.stderr).text(),
	proc.exited,
  ]);

  if (proc.exitCode !== 0) {
	throw new Error(`Failed to create sample video: ${stderr.trim() || stdout.trim()}`);
  }
}

describe("video enhancement", () => {
  const outputRoot = `${process.cwd()}/output`;
  const runsRoot = `${process.cwd()}/tmp-runs-video-enhancer-tests`;
  const helperRunId = `run-test-helper-${Date.now()}-video`;
  const cliRunId = `run-test-cli-${Date.now()}-video`;
  let ffmpegAvailable = false;

  beforeAll(async () => {
	ffmpegAvailable = await commandExists("ffmpeg");
  });

  afterAll(async () => {
	await rm(`${outputRoot}/${helperRunId}`, { recursive: true, force: true });
	await rm(`${outputRoot}/${cliRunId}`, { recursive: true, force: true });
	await rm(runsRoot, { recursive: true, force: true });
  });

  test("enhanceVideo creates a default -enhanced output file", async () => {
	if (!ffmpegAvailable) {
	  console.warn("ffmpeg not available, skipping enhanceVideo test");
	  return;
	}

	const inputPath = `${outputRoot}/${helperRunId}/video-1.mp4`;
	await createSampleVideo(inputPath);

	const result = await enhanceVideo({
	  inputPath,
	  preset: "clean",
	  overwrite: true,
	});

	expect(result.outputPath).toEndWith("video-1-enhanced.mp4");
	expect(await Bun.file(result.outputPath).exists()).toBe(true);
  }, 30000);

  test("findRunVideoInputs ignores already enhanced files and CLI --enhanceRun updates the run log", async () => {
	if (!ffmpegAvailable) {
	  console.warn("ffmpeg not available, skipping CLI enhancement test");
	  return;
	}

	const runDir = `${outputRoot}/${cliRunId}`;
	const runLogPath = `${runsRoot}/${cliRunId}.json`;
	const inputOne = `${runDir}/video-1.mp4`;
	const inputTwo = `${runDir}/video-2.mp4`;
	const ignoredEnhanced = `${runDir}/video-2-enhanced.mp4`;

	await createSampleVideo(inputOne);
	await createSampleVideo(inputTwo);
	await writeFile(ignoredEnhanced, "placeholder", "utf8");

	const foundInputs = await findRunVideoInputs(cliRunId, outputRoot);
	expect(foundInputs).toEqual([inputOne, inputTwo]);

	await mkdir(runsRoot, { recursive: true });
	const runRecord: RunRecord = {
	  id: cliRunId,
	  createdAt: new Date().toISOString(),
	  type: "video",
	  status: "success",
	  input: {
		basePrompt: "test video enhancement",
		count: 2,
	  },
	  config: {
		provider: "gemini",
		model: "gemini-2.5-flash",
	  },
	  generatedMedia: [inputOne, inputTwo],
	};
	await writeFile(runLogPath, JSON.stringify(runRecord, null, 2), "utf8");

	const proc = Bun.spawn(
	  [
		"bun",
		"run",
		"cli.ts",
		"--enhanceRun",
		cliRunId,
		"--enhancePreset",
		"clean",
		"--enhanceOverwrite",
		"--outDir",
		runsRoot,
	  ],
	  {
		cwd: process.cwd(),
		env: { ...process.env },
		stdout: "pipe",
		stderr: "pipe",
	  },
	);

	const [stdout, stderr] = await Promise.all([
	  new Response(proc.stdout).text(),
	  new Response(proc.stderr).text(),
	  proc.exited,
	]);

	expect(proc.exitCode).toBe(0);
	expect(stderr).toContain("Enhancing 2 video(s) from run");

	const parsed = JSON.parse(stdout);
	expect(parsed.runId).toBe(cliRunId);
	expect(parsed.enhancedMedia).toHaveLength(2);
	expect(parsed.failures).toEqual([]);
	expect(await Bun.file(parsed.enhancedMedia[0]).exists()).toBe(true);
	expect(await Bun.file(parsed.enhancedMedia[1]).exists()).toBe(true);

	const updatedRunLog = JSON.parse(await readFile(runLogPath, "utf8")) as RunRecord;
	expect(updatedRunLog.enhancedMedia).toHaveLength(2);
	expect(updatedRunLog.enhancementMeta).toHaveLength(2);
  }, 60000);
});

