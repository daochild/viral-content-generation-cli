# FFmpeg Video Enhancement Guide

This document explains how to post-process generated videos from `viral-video-generator` with `ffmpeg`.

## What this solves

The generated videos may benefit from light post-processing before publishing to TikTok, Reels, or Shorts:

- light denoise
- slight sharpening
- mild color improvement
- audio loudness normalization
- optional conversion to vertical 9:16
- optional stabilization for shaky source footage

Important: `ffmpeg` improves presentation and compatibility, but it does not recreate truly lost detail like AI upscalers do.

---

## Script location

Use the companion script:

- `scripts/enhance-video.sh`

---

## Requirements

You need these tools available in your shell:

- `ffmpeg`
- `ffprobe`

Check them with:

```bash
ffmpeg -version
ffprobe -version
```

---

## Quick start

Basic enhancement with automatic output name:

```bash
bash ./scripts/enhance-video.sh --input ./output/run-2026-05-09-video/video-1.mp4
```

This creates:

```text
./output/run-2026-05-09-video/video-1-enhanced.mp4
```

---

## Main presets

### 1. `social`

Best default for generated content intended for short-form platforms.

What it does:

- mild denoise
- mild contrast/saturation boost
- light sharpen
- audio normalization

Example:

```bash
bash ./scripts/enhance-video.sh \
  --input ./output/run-example/video-1.mp4 \
  --preset social
```

### 2. `vertical`

Same as `social`, plus converts video to vertical 1080x1920 by scaling and cropping.

Example:

```bash
bash ./scripts/enhance-video.sh \
  --input ./output/run-example/video-1.mp4 \
  --preset vertical
```

### 3. `clean`

Focuses on denoise + sharpen + audio normalization without reframing.

Example:

```bash
bash ./scripts/enhance-video.sh \
  --input ./output/run-example/video-1.mp4 \
  --preset clean
```

### 4. `stabilize`

Two-pass stabilization preset for shaky source footage.

Example:

```bash
bash ./scripts/enhance-video.sh \
  --input ./output/run-example/video-1.mp4 \
  --preset stabilize
```

Note: stabilization is more useful for camera footage than for already-generated AI videos.

---

## Common options

### Set output path

```bash
bash ./scripts/enhance-video.sh \
  --input ./output/run-example/video-1.mp4 \
  --output ./output/run-example/video-1-final.mp4
```

### Set CRF quality

Lower CRF = higher quality and larger file size.

```bash
bash ./scripts/enhance-video.sh \
  --input ./output/run-example/video-1.mp4 \
  --crf 18
```

Recommended values:

- `18` for high quality
- `20` good balance
- `22` smaller files

### Set encoder preset

Slower preset = better compression, longer encode time.

```bash
bash ./scripts/enhance-video.sh \
  --input ./output/run-example/video-1.mp4 \
  --speed slow
```

Allowed values:

- `ultrafast`
- `superfast`
- `veryfast`
- `faster`
- `fast`
- `medium`
- `slow`
- `slower`
- `veryslow`

---

## Suggested workflows

### A. Generated video for TikTok

Use vertical output:

```bash
bash ./scripts/enhance-video.sh \
  --input ./output/run-example/video-1.mp4 \
  --preset vertical \
  --crf 18 \
  --speed medium
```

### B. Keep original framing, just polish it

Use social or clean:

```bash
bash ./scripts/enhance-video.sh \
  --input ./output/run-example/video-1.mp4 \
  --preset social
```

### C. Shaky handheld input

Use stabilize:

```bash
bash ./scripts/enhance-video.sh \
  --input ./output/run-example/video-1.mp4 \
  --preset stabilize \
  --speed slow
```

---

## Output details

The script writes H.264 + AAC MP4 output:

- video: `libx264`
- audio: `aac`
- `+faststart` enabled for web/social upload friendliness

---

## Notes for this repository

Typical generated videos are stored under paths like:

```text
./output/run-<timestamp>-video/
```

So a common pattern is:

```bash
bash ./scripts/enhance-video.sh --input ./output/run-*/video-1.mp4
```

If you want batch processing, loop over files in bash:

```bash
for file in ./output/run-*/video-*.mp4; do
  [ -f "$file" ] || continue
  bash ./scripts/enhance-video.sh --input "$file" --preset social
done
```

---

## Troubleshooting

### `ffmpeg: command not found`

Install FFmpeg using your system package manager.

### Output looks oversharpened

Try `--preset clean` instead of `social`.

### Vertical crop removes important content

Use `social` instead of `vertical`, or customize the filter chain in the script.

### Stabilization is too slow

Use `social` or `clean`; `stabilize` is the heaviest preset.

---

## Summary

Recommended default:

```bash
bash ./scripts/enhance-video.sh \
  --input ./output/run-example/video-1.mp4 \
  --preset social \
  --crf 18 \
  --speed medium
```

Recommended vertical export for short-form platforms:

```bash
bash ./scripts/enhance-video.sh \
  --input ./output/run-example/video-1.mp4 \
  --preset vertical \
  --crf 18 \
  --speed medium
```

