# Local Video Tools for LM Studio

Inspect, trim, convert, resize and process videos locally with your LM Studio models. Powered by FFmpeg.

> **Privacy-first:** video processing runs on your computer through FFmpeg. Files are not uploaded by this plugin.

## Status

This repository is an independent TypeScript implementation designed specifically for LM Studio. It is not a port of the earlier Python/Cline FFmpeg MCP project.

Milestone 1 currently provides:

- Automatic video attachment staging — attach a supported video in LM Studio and the prompt preprocessor stages it into the plugin working directory, then gives the model the exact local path to use.
- `inspect_video` — concise ffprobe metadata and detected encoder capabilities.
- `clip_video` — fast lossless stream-copy trimming, plus accurate background re-encoding.
- `convert_video` — background H.264/HEVC conversion with optional resize.
- `video_job_status` — progress, speed, output path and errors for background jobs.
- `cancel_video_job` — graceful cancellation of running FFmpeg jobs.
- Persistent job records so a plugin restart marks unfinished jobs as interrupted instead of silently losing them.
- Automatic FFmpeg/ffprobe discovery.
- Automatic VideoToolbox, NVENC and Quick Sync encoder selection with CPU fallback.

## Why background jobs?

Long FFmpeg transcodes can exceed an LM Studio tool-call timeout. Expensive operations return a `jobId` immediately and continue locally in the background. The model can call `video_job_status` to check progress or `cancel_video_job` to stop the work.

Fast stream-copy clips remain foreground operations because they normally finish in seconds and avoid re-encoding entirely.

## Requirements

- LM Studio with TypeScript plugin support.
- FFmpeg and ffprobe installed locally.

On macOS with Homebrew:

```bash
brew install ffmpeg
```

The plugin checks PATH first and also common locations such as `/opt/homebrew/bin` and `/usr/local/bin`. You can set explicit binary paths in plugin settings.

## Development

```bash
npm install
npm test
lms dev
```

LM Studio's plugin runner uses Node.js, and the project targets the current native plugin SDK.

## Plugin settings

- **FFmpeg Path** — optional explicit path; blank enables auto-detection.
- **FFprobe Path** — optional explicit path; blank enables auto-detection.
- **Output Subdirectory** — defaults to `local-video-tools/outputs` inside LM Studio's working directory.
- **Hardware Acceleration** — `Auto` or `Off`.
- **Allow External File Paths** — disabled by default. Enable temporarily when testing videos outside the working directory.
- **Maximum Job Time** — defaults to two hours.

## Example workflows

### Attach and inspect a video

Attach `IMG_1435.MOV` to an LM Studio message and ask:

> Inspect this video and tell me its codec, resolution and duration.

The prompt preprocessor copies the attachment into `local-video-tools/inputs` under LM Studio's working directory and gives the model the staged path automatically.

### Fast clip without quality loss

> Cut seconds 2 through 10 from this video without changing quality.

The plugin uses input-side seeking and stream copy (`-c copy`) where possible.

### Convert a 4K HEVC video to 1080p H.264

> Convert this video to 1920px-wide H.264.

This starts a background job. On a supported Mac, the plugin prefers `h264_videotoolbox`; otherwise it falls back to another supported hardware encoder or `libx264`.

## Safety and filesystem access

Attached videos are staged inside `local-video-tools/inputs` under LM Studio's working directory. Outputs are always written inside the configured output directory under the same working directory. Reading arbitrary absolute paths outside the working directory is disabled by default.

This lets the normal attachment workflow work without granting the model broad filesystem access.

## Roadmap

Next planned tools and capabilities:

- `resize_video` as a focused convenience tool.
- `extract_frame` and `extract_audio`.
- Concatenation and overlays.
- Keyframe-aware trimming guidance.
- Richer hardware capability reporting and platform coverage.
- Hub packaging and release polish.

## License

MIT.
