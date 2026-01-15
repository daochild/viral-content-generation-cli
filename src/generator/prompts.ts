import type { LLMClient } from "../llm/types";

/**
 * System prompt for generating unique photo prompts.
 */
const PHOTO_SYSTEM_PROMPT = `You are an expert at generating creative, detailed prompts for AI image generation.
Your task is to create unique, visually diverse prompts for photorealistic images.

Rules:
1. Each prompt must be unique and different from others
2. Include specific details: lighting, composition, colors, mood, style
3. Prompts should be suitable for social media content
4. No text, captions, logos, or watermarks in the image
5. Output ONLY the prompts as a JSON array of strings
6. Each prompt should be 1-3 sentences

Example output format:
["A cinematic close-up of hands preparing coffee in a cozy cafe, warm golden light streaming through window, shallow depth of field, moody atmosphere", "Wide angle shot of urban street at golden hour..."]`;

/**
 * System prompt for generating unique video prompts with TikTok uniqueness rules.
 * Based on TikTok content fingerprinting avoidance techniques.
 */
const VIDEO_SYSTEM_PROMPT = `You are an expert at generating creative, unique video concepts for TikTok.
Your task is to create unique video prompts that will pass TikTok's content fingerprinting system.

TikTok uniqueness rules (each video must differ in 3-5 key parameters):

VISUAL UNIQUENESS:
- Different aspect ratios and crops
- Unique scene ordering
- B-roll inserts, screenshots, memes
- Speed variations (±5-10%)
- Filters, color grading, zoom, motion

AUDIO UNIQUENESS:
- Different sounds/remixes
- Background music + voiceover
- Tone/tempo changes
- Original audio removal

CONTENT UNIQUENESS:
- New idea or presentation style
- Different hook (first 1-3 seconds)
- Unique text/subtitles approach
- Original commentary or reaction

What is NOT unique (avoid these alone):
- Simple mirroring
- Border overlay
- Brightness/contrast changes
- Watermark
- Trimming 1-2 seconds
- Changing description/hashtags

Rules for prompts:
1. Each prompt must describe a UNIQUE video concept
2. Include: hook idea, visual style, audio concept, pacing, CTA approach
3. Prompts must be suitable for TikTok format (9:16, 15-60 sec)
4. NO on-screen text, captions, subtitles, overlays in the video itself
5. Voiceover is allowed and recommended
6. Output ONLY the prompts as a JSON array of strings
7. Each prompt should be detailed (3-5 sentences)

Example output format:
["Hook: Quick zoom into hands with dramatic sound effect. Visual: Documentary style, handheld camera, natural lighting in home office. Audio: Trending sound remix with voiceover explaining the concept. Pacing: Fast cuts every 1-2 seconds. CTA: Spoken call to action asking viewers to comment their experience.", "Hook: POV walking into room with suspense music..."]`;

export interface GeneratePromptsOptions {
  type: "photo" | "video";
  basePrompt: string;
  count: number;
  model?: string;
}

export interface GeneratePromptsResult {
  prompts: string[];
  raw?: unknown;
}

/**
 * Extract strings from broken JSON array by finding quoted strings.
 */
function extractStringsFromBrokenJson(text: string): string[] {
  const results: string[] = [];
  const regex = /"((?:[^"\\]|\\.)*)"/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const str = (match[1] ?? "")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
    if (str.length > 20) {
      results.push(str);
    }
  }
  return results;
}

/**
 * Generate unique prompts using LLM.
 */
export async function generatePrompts(
  client: LLMClient,
  options: GeneratePromptsOptions,
): Promise<GeneratePromptsResult> {
  const systemPrompt = options.type === "photo" ? PHOTO_SYSTEM_PROMPT : VIDEO_SYSTEM_PROMPT;
  
  const userPrompt = `Generate ${options.count} unique ${options.type} prompts based on this topic/idea:

"${options.basePrompt}"

Remember: Output ONLY a valid JSON array of ${options.count} strings. No markdown, no explanation.`;

  const response = await client.generate({
    model: options.model ?? "gemini-2.5-flash",
    messages: [
      { role: "user", content: `${systemPrompt}\n\n${userPrompt}` },
    ],
    temperature: 0.9,
    maxOutputTokens: 4096,
  });

  // Parse JSON array from response
  let text = response.text.trim();
  
  // Remove markdown code fences if present
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  
  // Try to extract JSON array from the response
  let prompts: string[];
  try {
    prompts = JSON.parse(text);
  } catch {
    // Try to find JSON array in the text
    const match = text.match(/\[[\s\S]*]/);
    if (match) {
      try {
        prompts = JSON.parse(match[0]);
      } catch {
        // Try to fix common JSON issues: unescaped newlines in strings
        const fixed = match[0]
          .replace(/(?<!\\)\n/g, "\\n")
          .replace(/(?<!\\)\r/g, "\\r")
          .replace(/(?<!\\)\t/g, "\\t");
        try {
          prompts = JSON.parse(fixed);
        } catch {
          // Last resort: extract strings manually
          prompts = extractStringsFromBrokenJson(text);
          if (prompts.length === 0) {
            throw new Error(`Failed to parse LLM response as JSON array: ${text.slice(0, 300)}...`);
          }
        }
      }
    } else {
      throw new Error(`Failed to find JSON array in LLM response: ${text.slice(0, 300)}...`);
    }
  }

  if (!Array.isArray(prompts) || prompts.length === 0) {
    throw new Error("LLM returned empty or invalid prompts array");
  }

  // If LLM returned more strings than requested, it might have split one prompt into parts
  // Try to merge them back together
  if (prompts.length > options.count) {
    const merged: string[] = [];
    let current = "";
    for (const p of prompts) {
      const trimmed = String(p).trim();
      // Check if this looks like a continuation (doesn't start with "Hook:" or similar pattern)
      if (current && !trimmed.match(/^(Hook|Visual|Audio|Pacing|CTA):/i)) {
        current += " " + trimmed;
      } else {
        if (current) merged.push(current);
        current = trimmed;
      }
    }
    if (current) merged.push(current);
    
    // Use merged if it gives us closer to requested count
    if (merged.length <= options.count || merged.length < prompts.length) {
      prompts = merged;
    }
  }

  return { prompts, raw: response.raw };
}
