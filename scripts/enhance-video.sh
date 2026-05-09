#!/usr/bin/env bash
set -euo pipefail

print_help() {
  cat <<'EOF'
enhance-video.sh

Post-process a video with ffmpeg for short-form social publishing.

Usage:
  bash ./scripts/enhance-video.sh --input <file> [options]

Required:
  --input <file>         Input video file

Optional:
  --output <file>        Output file path (default: <input>-enhanced.mp4)
  --preset <name>        social | vertical | clean | stabilize (default: social)
  --crf <number>         libx264 CRF quality (default: 18)
  --speed <preset>       x264 preset (default: medium)
  --overwrite            Overwrite output file if it exists
  --help                 Show this help

Examples:
  bash ./scripts/enhance-video.sh --input ./output/run-123/video-1.mp4
  bash ./scripts/enhance-video.sh --input ./output/run-123/video-1.mp4 --preset vertical
  bash ./scripts/enhance-video.sh --input ./output/run-123/video-1.mp4 --preset stabilize --speed slow
EOF
}

die() {
  echo "[enhance-video] Error: $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

validate_speed() {
  case "$1" in
    ultrafast|superfast|veryfast|faster|fast|medium|slow|slower|veryslow) ;;
    *) die "Invalid --speed value: $1" ;;
  esac
}

validate_preset() {
  case "$1" in
    social|vertical|clean|stabilize) ;;
    *) die "Invalid --preset value: $1" ;;
  esac
}

default_output_path() {
  local input_path="$1"
  local dir base stem ext

  dir="$(dirname "$input_path")"
  base="$(basename "$input_path")"

  if [[ "$base" == *.* ]]; then
    stem="${base%.*}"
    ext="${base##*.}"
  else
    stem="$base"
    ext="mp4"
  fi

  printf "%s/%s-enhanced.%s\n" "$dir" "$stem" "$ext"
}

run_ffmpeg_encode() {
  local input_file="$1"
  local output_file="$2"
  local video_filter="$3"
  local crf="$4"
  local speed="$5"
  local overwrite_flag="$6"

  ffmpeg \
    "$overwrite_flag" \
    -i "$input_file" \
    -vf "$video_filter" \
    -af "loudnorm" \
    -c:v libx264 \
    -preset "$speed" \
    -crf "$crf" \
    -pix_fmt yuv420p \
    -movflags +faststart \
    -c:a aac \
    -b:a 192k \
    "$output_file"
}

main() {
  local input_file=""
  local output_file=""
  local preset="social"
  local crf="18"
  local speed="medium"
  local overwrite="false"

  for arg in "$@"; do
    if [[ "$arg" == "--help" || "$arg" == "-h" ]]; then
      print_help
      exit 0
    fi
  done

  require_cmd ffmpeg
  require_cmd ffprobe

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --input)
        [[ $# -ge 2 ]] || die "--input requires a value"
        input_file="$2"
        shift 2
        ;;
      --output)
        [[ $# -ge 2 ]] || die "--output requires a value"
        output_file="$2"
        shift 2
        ;;
      --preset)
        [[ $# -ge 2 ]] || die "--preset requires a value"
        preset="$2"
        shift 2
        ;;
      --crf)
        [[ $# -ge 2 ]] || die "--crf requires a value"
        crf="$2"
        shift 2
        ;;
      --speed)
        [[ $# -ge 2 ]] || die "--speed requires a value"
        speed="$2"
        shift 2
        ;;
      --overwrite)
        overwrite="true"
        shift
        ;;
      *)
        die "Unknown argument: $1"
        ;;
    esac
  done

  [[ -n "$input_file" ]] || die "Missing required --input"
  [[ -f "$input_file" ]] || die "Input file not found: $input_file"

  validate_preset "$preset"
  validate_speed "$speed"

  if ! [[ "$crf" =~ ^[0-9]+$ ]]; then
    die "--crf must be an integer"
  fi

  if [[ -z "$output_file" ]]; then
    output_file="$(default_output_path "$input_file")"
  fi

  local overwrite_flag="-n"
  if [[ "$overwrite" == "true" ]]; then
    overwrite_flag="-y"
  fi

  if [[ -f "$output_file" && "$overwrite" != "true" ]]; then
    die "Output already exists: $output_file (use --overwrite to replace)"
  fi

  mkdir -p "$(dirname "$output_file")"

  local video_filter=""
  local tmp_dir=""
  local transform_file=""

  case "$preset" in
    social)
      video_filter="hqdn3d=1.2:1.2:4:4,eq=brightness=0.02:contrast=1.06:saturation=1.08,unsharp=5:5:0.5:5:5:0.0"
      ;;
    vertical)
      video_filter="hqdn3d=1.2:1.2:4:4,eq=brightness=0.02:contrast=1.06:saturation=1.08,unsharp=5:5:0.5:5:5:0.0,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"
      ;;
    clean)
      video_filter="hqdn3d=1.0:1.0:3:3,unsharp=5:5:0.4:5:5:0.0"
      ;;
    stabilize)
      tmp_dir="$(mktemp -d)"
      transform_file="$tmp_dir/transforms.trf"

      cleanup() {
        rm -rf "$tmp_dir"
      }
      trap cleanup EXIT

      echo "[enhance-video] Running stabilization analysis..."
      ffmpeg \
        -i "$input_file" \
        -vf "vidstabdetect=shakiness=5:accuracy=15:result=$transform_file" \
        -f null \
        - >/dev/null 2>&1

      video_filter="vidstabtransform=input=$transform_file:smoothing=30,hqdn3d=1.0:1.0:3:3,eq=brightness=0.01:contrast=1.04:saturation=1.05,unsharp=5:5:0.4:5:5:0.0"
      ;;
  esac

  echo "[enhance-video] Input:  $input_file"
  echo "[enhance-video] Output: $output_file"
  echo "[enhance-video] Preset: $preset"
  echo "[enhance-video] CRF:    $crf"
  echo "[enhance-video] Speed:  $speed"

  run_ffmpeg_encode "$input_file" "$output_file" "$video_filter" "$crf" "$speed" "$overwrite_flag"

  echo "[enhance-video] Done."
}

main "$@"


