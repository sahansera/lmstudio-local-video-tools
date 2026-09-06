# Local Video Tools for LM Studio

<p align="center">
  <strong>Let your local AI inspect, trim, convert and process video files — locally, with FFmpeg.</strong>
</p>

<p align="center">
  Native LM Studio plugin · TypeScript · FFmpeg · Privacy-first · Hardware accelerated
</p>

> **Early preview:** the project is under active development. The core video inspection, clipping, conversion and background-job workflow is already implemented, but the public API may still evolve before the first stable release.

## Why this exists

Local models are increasingly capable of reasoning about media, but they still need reliable tools to work with real video files. **Local Video Tools for LM Studio** gives an LM Studio model a small, purpose-built set of native tools for video processing without uploading the source video to a remote service.

The plugin is designed around three principles:

- **Local-first** — FFmpeg and ffprobe run on your computer.
- **Model-friendly** — a deliberately small tool surface that local models can call reliably.
- **Timeout-resistant** — expensive transcodes run as background jobs instead of holding a tool call open for minutes.

## Highlights

- 🎬 **Inspect video** with concise ffprobe metadata.
- ✂️ **Fast lossless trimming** with stream copy (`-c copy`) when re-encoding is unnecessary.
- 🎯 **Accurate clipping** with background re-encoding when precise boundaries are required.
- 🔄 **Convert and resize** to H.264 or HEVC.
- ⚡ **Hardware acceleration** with Apple VideoToolbox, NVIDIA NVENC and Intel Quick Sync when available.
- 📎 **Video attachment staging** so attached videos can be used without broad filesystem access.
- 📈 **Background jobs** with progress, speed, status and cancellation.
- 💾 **Persistent job records** so interrupted work is visible after a plugin restart.
- 🔒 **Safer defaults** — arbitrary external file access is disabled by default.
- 🧰 **FFmpeg auto-discovery** across common macOS, Linux and Windows locations.

## Available tools

| Tool | Purpose | Execution |
| --- | --- | --- |
| `inspect_video` | Read duration, codecs, resolution, frame rate, bitrate and audio metadata | Foreground |
| `clip_video` | Trim a video using fast stream copy or accurate re-encoding | Foreground or background |
| `convert_video` | Convert to H.264/HEVC and optionally resize | Background |
| `video_job_status` | Read progress, speed, output path and errors | Foreground |
| `cancel_video_job` | Cancel a running FFmpeg job | Foreground |

More focused tools such as frame extraction, audio extraction, resize, concat and overlays are planned.

## Quick start

### Requirements

- LM Studio with native TypeScript plugin support
- FFmpeg and ffprobe installed locally

On macOS with Homebrew:

```bash
brew install ffmpeg
```

### Run from source

```bash
git clone https://github.com/sahansera/lmstudio-local-video-tools.git
cd lmstudio-local-video-tools

git checkout feat/milestone-1
npm install
npm test
lms dev --install
```

Then enable **Local Video Tools** under LM Studio **Integrations**. This is a native LM Studio plugin — it does **not** need an MCP entry in `mcp.json`.

## Try it

Attach a video in LM Studio and ask:

> Inspect this video and tell me its codec, resolution, duration and frame rate.

For a fast trim:

> Cut seconds 2 through 10 from this video without changing quality. Use the fastest lossless method available.

For a hardware-accelerated transcode:

> Convert this video to 1920px-wide H.264 MP4 using hardware acceleration if available.

## How it works

```text
LM Studio
   │
   ├─ attached video
   │      ↓
   │  prompt preprocessor
   │      ↓
   │  safe local staging
   │
   └─ native tool call
          ↓
    Local Video Tools
          ↓
     ffprobe / FFmpeg
          ↓
   local CPU / GPU / media engine
          ↓
      local output file
```

The language model does not perform the encode itself. The plugin delegates the operation to your local FFmpeg installation.

## Fast path vs background jobs

A simple trim that does not require filters or codec changes can use stream copy:

```text
clip_video
   ↓
no re-encode needed
   ↓
-ss ... -i ... -t ... -c copy
   ↓
completed result
```

Expensive operations are intentionally asynchronous:

```text
convert_video
   ↓
start FFmpeg job
   ↓
return jobId immediately
   ↓
video_job_status
   ↓
progress / speed / completion
```

This design avoids the long-running tool-call timeout problems that can occur when processing high-resolution HEVC video.

## Hardware acceleration

When **Hardware Acceleration** is set to `Auto`, the plugin detects supported encoders and prefers hardware acceleration where possible:

| Platform / hardware | Preferred encoders |
| --- | --- |
| Apple Silicon / macOS | `h264_videotoolbox`, `hevc_videotoolbox` |
| NVIDIA | `h264_nvenc`, `hevc_nvenc` |
| Intel | `h264_qsv`, `hevc_qsv` |
| Fallback | `libx264`, `libx265` |

Hardware availability depends on your FFmpeg build and system configuration.

## Privacy and filesystem safety

Video processing is performed locally through FFmpeg. This plugin does not intentionally upload video files to a remote processing service.

Attached videos are staged under the plugin working directory, and generated outputs stay under the configured output directory. Arbitrary external file paths are disabled by default and must be explicitly enabled in plugin settings.

As with any local AI workflow, review the model's requested tool actions before using the plugin on sensitive or irreplaceable media.

## Configuration

| Setting | Default | Description |
| --- | --- | --- |
| FFmpeg Path | Auto | Optional explicit path to `ffmpeg` |
| FFprobe Path | Auto | Optional explicit path to `ffprobe` |
| Output Subdirectory | `local-video-tools/outputs` | Output location inside the working directory |
| Hardware Acceleration | Auto | Prefer supported hardware encoders |
| Allow External File Paths | Off | Permit reading files outside the working directory |
| Maximum Job Time | 2 hours | Maximum FFmpeg process runtime |

## Development

```bash
npm install
npm test
npm run typecheck
lms dev
```

The project is a native LM Studio TypeScript plugin and uses the LM Studio SDK rather than MCP for the primary integration.

Architecture notes are available in [`docs/architecture.md`](docs/architecture.md).

## Roadmap

Near-term priorities:

- [x] Native LM Studio tools provider
- [x] Attachment staging
- [x] ffprobe inspection
- [x] Fast stream-copy clipping
- [x] Accurate background clipping
- [x] Background conversion jobs
- [x] Job progress and cancellation
- [x] VideoToolbox / NVENC / QSV detection
- [ ] `extract_frame`
- [ ] `extract_audio`
- [ ] Dedicated `resize_video`
- [ ] Video concatenation
- [ ] Overlays and subtitles
- [ ] Keyframe-aware trim guidance
- [ ] Expanded automated integration tests
- [ ] LM Studio Hub release

See [`docs/roadmap.md`](docs/roadmap.md) for the broader direction.

## Contributing

Contributions, bug reports and design feedback are welcome. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request.

If you find a security-sensitive issue, please follow [`SECURITY.md`](SECURITY.md) rather than opening a public issue.

## Project status

This project is currently an **early preview** and is being tested against real local-video workflows, including 4K HEVC media. Expect breaking changes until the first stable release.

## License

Licensed under the [MIT License](LICENSE).
