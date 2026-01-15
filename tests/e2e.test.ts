import { describe, expect, test, beforeAll } from "bun:test";
import { GeminiClient } from "../src/llm/gemini";
import { OpenAIClient } from "../src/llm/openai";
import { generatePrompts } from "../src/generator/prompts";

/**
 * E2E tests with real API calls.
 * Requires GEMINI_API_KEY and/or OPENAI_API_KEY environment variables.
 * 
 * Run with: bun test
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

describe("E2E: generatePrompts with Gemini", () => {
  const apiKey = process.env.GEMINI_API_KEY;
  
  beforeAll(() => {
    if (!apiKey) {
      console.warn("GEMINI_API_KEY not set, skipping Gemini tests");
    }
  });

  test("generates photo prompts", async () => {
    if (!apiKey) return;
    
    const client = new GeminiClient({ apiKey });
    
    const result = await generatePrompts(client, {
      type: "photo",
      basePrompt: "cozy home office with plants",
      count: 3,
      model: GEMINI_MODEL,
    });

    expect(result.prompts).toBeArray();
    expect(result.prompts.length).toBeGreaterThanOrEqual(1);
    
    for (const prompt of result.prompts) {
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(20);
    }
    
    console.log("Generated photo prompts:", result.prompts);
  }, 60000);

  test("generates video prompts with TikTok uniqueness", async () => {
    if (!apiKey) return;
    
    const client = new GeminiClient({ apiKey });
    
    const result = await generatePrompts(client, {
      type: "video",
      basePrompt: "morning routine for productivity",
      count: 2,
      model: GEMINI_MODEL,
    });

    expect(result.prompts).toBeArray();
    expect(result.prompts.length).toBeGreaterThanOrEqual(1);
    
    for (const prompt of result.prompts) {
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(50);
    }
    
    console.log("Generated video prompts:", result.prompts);
  }, 60000);
});

describe("E2E: generatePrompts with OpenAI", () => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  beforeAll(() => {
    if (!apiKey) {
      console.warn("OPENAI_API_KEY not set, skipping OpenAI tests");
    }
  });

  test("generates photo prompts", async () => {
    if (!apiKey) return;
    
    const client = new OpenAIClient({ apiKey });
    
    const result = await generatePrompts(client, {
      type: "photo",
      basePrompt: "minimalist workspace setup",
      count: 3,
      model: OPENAI_MODEL,
    });

    expect(result.prompts).toBeArray();
    expect(result.prompts.length).toBeGreaterThanOrEqual(1);
    
    for (const prompt of result.prompts) {
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(20);
    }
    
    console.log("Generated photo prompts (OpenAI):", result.prompts);
  }, 60000);

  test("generates video prompts with TikTok uniqueness", async () => {
    if (!apiKey) return;
    
    const client = new OpenAIClient({ apiKey });
    
    const result = await generatePrompts(client, {
      type: "video",
      basePrompt: "quick healthy breakfast ideas",
      count: 2,
      model: OPENAI_MODEL,
    });

    expect(result.prompts).toBeArray();
    expect(result.prompts.length).toBeGreaterThanOrEqual(1);
    
    for (const prompt of result.prompts) {
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(50);
    }
    
    console.log("Generated video prompts (OpenAI):", result.prompts);
  }, 60000);
});

describe("E2E: CLI integration", () => {
  const geminiKey = process.env.GEMINI_API_KEY;
  
  test("CLI generates photo prompts via Gemini", async () => {
    if (!geminiKey) {
      console.warn("GEMINI_API_KEY not set, skipping CLI test");
      return;
    }
    
    const proc = Bun.spawn([
      "bun", "run", "cli.ts", 
      "--photo", 
      "--prompt", "sunset beach vibes", 
      "-n", "2",
      "--model", GEMINI_MODEL
    ], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdout: "pipe",
      stderr: "pipe",
    });
    
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    
    await proc.exited;
    
    console.log("CLI stderr:", stderr);
    console.log("CLI stdout:", stdout);
    
    expect(proc.exitCode).toBe(0);
    
    const prompts = JSON.parse(stdout);
    expect(prompts).toBeArray();
    expect(prompts.length).toBeGreaterThanOrEqual(1);
  }, 60000);

  test("CLI generates video prompts via Gemini", async () => {
    if (!geminiKey) {
      console.warn("GEMINI_API_KEY not set, skipping CLI test");
      return;
    }
    
    const proc = Bun.spawn([
      "bun", "run", "cli.ts", 
      "--video", 
      "--prompt", "coding tips for beginners", 
      "-n", "2",
      "--model", GEMINI_MODEL
    ], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdout: "pipe",
      stderr: "pipe",
    });
    
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    
    await proc.exited;
    
    console.log("CLI stderr:", stderr);
    console.log("CLI stdout:", stdout);
    
    expect(proc.exitCode).toBe(0);
    
    const prompts = JSON.parse(stdout);
    expect(prompts).toBeArray();
    expect(prompts.length).toBeGreaterThanOrEqual(1);
  }, 60000);
});
