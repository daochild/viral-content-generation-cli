# viral-video-generator

CLI tool for generating unique photo, video, and speech prompts using LLM (Gemini/OpenAI).
With `--gen` flag, also generates actual media files (images via Gemini, videos via KlingAI).
With `--tts` flag, generates speech audio files via Gemini TTS.

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

### Use Ollama for local LLM inference

```bash
# Make sure Ollama is running locally
viral --photo --prompt "nature landscapes" -n 5 --provider ollama --model llama3.2
```

### Generate prompts AND media files

```bash
# Generate photo prompts and images
viral --photo --prompt "sunset beach" -n 3 --gen

# Generate video prompts and videos
viral --video --prompt "cooking tutorial" -n 2 --gen
```

### Generate text-to-speech audio (Gemini only)

```bash
viral --tts --prompt "Welcome to our channel! Today we explore productivity." -n 1
viral --tts --prompt "Top 5 tips to stay focused." -n 3 --voice Puck
```

### Options

| Option | Description |
|--------|-------------|
| `--photo` | Generate photo prompts |
| `--video` | Generate video prompts with TikTok uniqueness rules |
| `--tts` | Generate text-to-speech audio files (Gemini only) |
| `--gen` | Also generate actual media (images via Ollama/Gemini, videos via KlingAI or Gemini Veo) |
| `--prompt`, `-p` | Base topic/idea for generation (or exact text for `--tts`) |
| `-n` | Number of prompts / audio files to generate (default: 5) |
| `--provider` | LLM provider: `gemini`, `openai`, or `ollama` (default: gemini) |
| `--model` | Model name for prompts (default: gemini-2.5-flash) |
| `--voice` | Voice for TTS: `Aoede`, `Charon`, `Fenrir`, `Kore`, `Leda`, `Orus`, `Puck`, `Zephyr` (default: Kore) |
| `--outDir` | Output directory for run logs (default: ./runs) |
| `--help`, `-h` | Show help |
| `--version`, `-v` | Show version |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | API key for Google Gemini (prompts, images, TTS, and Veo video) |
| `GEMINI_API_SECRET` | API secret for Google Gemini (if required) |
| `GEMINI_MODEL` | Model for LLM prompt generation (default: `gemini-3.1-pro-preview`) |
| `OPENAI_API_KEY` | API key for OpenAI (prompts only) |
| `OLLAMA_BASE_URL` | Base URL for Ollama server (default: http://localhost:11434) |
| `STABILITY_API_KEY` | API key for Stability AI (required for Ollama + image generation) |
| `STABILITY_API_URL` | Stability AI endpoint or local SD server (optional) |
| `NANO_BANANA_MODEL` | Model for image generation (default: `gemini-3.1-flash-image-preview`) |
| `VEO_MODEL` | Model for Gemini Veo video generation (default: `veo-3.1-generate-preview`) |
| `GEMINI_TTS_MODEL` | Model for TTS audio generation (default: `gemini-3.1-flash-tts-preview`) |
| `KLINGAI_API_KEY` | API key for KlingAI (video generation) |
| `KLINGAI_API_SECRET` | API secret for KlingAI |
| `KLINGAI_VIDEO_MODEL` | Model for KlingAI video (default: `kling-video-o1`) |

## Output

- **Prompts only**: JSON array of prompts to stdout
- **With --gen**: JSON with `prompts` and `media` arrays
- **With --tts**: WAV files (PCM 16-bit, 24 kHz, mono) saved to `./output/<runId>/speech-N.wav`
- **Run logs**: Saved to `./runs/` directory with format `run-{timestamp}-{photo|video|tts}.json`
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

- Core docs live in `docs/gemini/`
- UX/UI dashboard page: `ui/index.html`

### Run the UI page locally

```bash
cd /home/daochild/dev/viral-content-generation-cli/ui
python3 -m http.server 8080
```

Open `http://localhost:8080/index.html`.

