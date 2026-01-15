# viral-video-generator

CLI tool for generating unique photo and video prompts using LLM (Gemini/OpenAI).
With `--gen` flag, also generates actual media files (images via Gemini, videos via KlingAI).

Video prompts follow TikTok uniqueness rules to pass content fingerprinting.

## Install

```bash
bun install
```

## Usage

### Generate photo prompts

```bash
viral --photo --prompt "cozy coffee shop aesthetic" -n 5
```

### Generate video prompts (TikTok unique)

```bash
viral --video --prompt "productivity tips for developers" -n 3
```

### Generate prompts AND media files

```bash
# Generate photo prompts and images
viral --photo --prompt "sunset beach" -n 3 --gen

# Generate video prompts and videos
viral --video --prompt "cooking tutorial" -n 2 --gen
```

### Options

| Option | Description |
|--------|-------------|
| `--photo` | Generate photo prompts |
| `--video` | Generate video prompts with TikTok uniqueness rules |
| `--gen` | Also generate actual media (images via Gemini, videos via KlingAI) |
| `--prompt`, `-p` | Base topic/idea for generation |
| `-n` | Number of prompts to generate (default: 5) |
| `--provider` | LLM provider: `gemini` or `openai` (default: gemini) |
| `--model` | Model name for prompts (default: gemini-2.5-flash) |
| `--outDir` | Output directory for run logs (default: ./runs) |
| `--help`, `-h` | Show help |
| `--version`, `-v` | Show version |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | API key for Google Gemini (prompts and images) |
| `OPENAI_API_KEY` | API key for OpenAI (prompts only) |
| `NANO_BANANA_MODEL` | Model for image generation (default: gemini-2.5-flash-image) |
| `KLINGAI_API_KEY` | API key for KlingAI (video generation) |
| `KLINGAI_API_SECRET` | API secret for KlingAI |
| `KLINGAI_MODEL` | Model for video: kling-v1-6, kling-v2-master, etc. (default: kling-v1-6) |
| `KLINGAI_MODE` | Mode: std or pro (default: std) |

## Output

- **Prompts only**: JSON array of prompts to stdout
- **With --gen**: JSON with `prompts` and `media` arrays
- **Run logs**: Saved to `./runs/` directory with format `run-{timestamp}-{photo|video}.json`
- **Media files**: Saved to `./output/run-{timestamp}-{type}/` directory

## Run (dev)

```bash
bun run cli.ts --photo --prompt "your topic" -n 5
```

## Run tests

```bash
bun test
```

## Build releases

```bash
bun run build:all
```

## Documentation
