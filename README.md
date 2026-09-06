# Local Video Tools for LM Studio

<p align="center">
  <strong>Edit video with your local AI.</strong>
</p>

<p align="center">
  Inspect, trim and convert videos directly from LM Studio using FFmpeg — private, hardware accelerated, and built for long-running video jobs.
</p>

<p align="center">
  Native LM Studio plugin · TypeScript · FFmpeg · Privacy-first · Hardware accelerated
</p>

> **Early Preview — v0.1.0:** the core inspection, clipping, conversion and background-job workflows have been validated with real 4K HEVC media on macOS. Tool schemas and behavior may still evolve as the project gets broader platform testing.

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

For an accurate clip:

> Create an accurate clip from exactly 2.0 seconds to 10.0 seconds.

For a running background job:

> Check the status of that video conversion.

## Validated v0.1.0 workflow

The first release candidate has been exercised against a real 3840×2160 HEVC/H.265 MOV workflow on Apple Silicon:

- metadata inspection through ffprobe;
- fast lossless stream-copy clipping;
- accurate clipping through background re-encoding;
- 4K HEVC → 1080p H.264 conversion using `h264_videotoolbox`;
- background job progress/status reporting;
- cancellation and FFmpeg process cleanup.

This is intentionally an **Early Preview**: macOS is the best-tested platform for v0.1.0, while Windows/Linux and additional FFmpeg builds need broader community validation.

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
FFmpeg -c copy
   ↓
return output path
```

This is fast and avoids generation loss, but the start position can be limited by source keyframes.

Operations that require re-encoding are handled differently:

```text
convert_video / accurate clip
   ↓
create background job
   ↓
return job ID immediately
   ↓
FFmpeg continues locally
   ↓
video_job_status → progress / speed / result
```

This avoids treating a long video encode like a single long-running model tool call.

## Hardware acceleration

When hardware acceleration is enabled, the plugin probes the local FFmpeg build and prefers an available hardware encoder.

| Platform / hardware | Preferred path |
| --- | --- |
| Apple Silicon / macOS | VideoToolbox |
| NVIDIA GPU | NVENC |
| Intel | Quick Sync Video |
| Other / unsupported | CPU encoder fallback |

Hardware support depends on the FFmpeg build and machine. The plugin falls back to software encoding when a supported hardware encoder is not available.

## Configuration

The plugin exposes configuration for:

| Setting | Default | Purpose |
| --- | --- | --- |
| FFmpeg path | Auto-detect | Override the `ffmpeg` executable |
| ffprobe path | Auto-detect | Override the `ffprobe` executable |
| Output directory | `local-video-tools/outputs` | Working-directory-relative output location |
| Hardware acceleration | `auto` | Prefer supported hardware encoders |
| External paths | Disabled | Allow files outside the LM Studio working directory |
| Maximum job duration | 2 hours | Upper bound for long-running FFmpeg work |

## Privacy and safety

Local Video Tools is designed for local media workflows:

- video processing is performed by your local FFmpeg installation;
- the plugin does not upload videos to a video-processing service;
- attached videos are staged into the LM Studio plugin working directory;
- arbitrary external filesystem paths are disabled by default;
- FFmpeg is spawned with argument arrays rather than shell command strings;
- subprocess output is bounded;
- running jobs support cancellation and timeout cleanup.

Remember that the language model and LM Studio environment you choose have their own privacy characteristics. This plugin only controls its own video-processing behavior.

## Project status

**v0.1.0 Early Preview** focuses on a reliable native LM Studio foundation: inspect, clip, convert, background progress, cancellation, safe file handling and hardware-encoder selection.

See [docs/roadmap.md](docs/roadmap.md) for planned work.

## Development

```bash
npm install
npm run typecheck
npm test
lms dev
```

The plugin targets the Node.js runtime bundled by LM Studio.

## Contributing

Contributions and focused bug reports are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request and use the issue templates for reproducible bugs or feature proposals.

Security-sensitive reports should follow [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).
