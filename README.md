<div align="center">

# 🎬 Local Video Tools for LM Studio

### Edit video with your local AI.

Inspect, trim, convert, and manage long-running FFmpeg jobs directly from LM Studio — **locally**, with **hardware acceleration**, and without turning a video encode into one giant tool call.

[![Release](https://img.shields.io/github/v/tag/sahansera/lmstudio-local-video-tools?style=for-the-badge&label=Release&color=brightgreen)](https://github.com/sahansera/lmstudio-local-video-tools/releases/tag/v0.1.2)
[![CI](https://img.shields.io/github/actions/workflow/status/sahansera/lmstudio-local-video-tools/test.yml?branch=main&style=for-the-badge&label=Build)](https://github.com/sahansera/lmstudio-local-video-tools/actions/workflows/test.yml)
[![License](https://img.shields.io/github/license/sahansera/lmstudio-local-video-tools?style=for-the-badge&color=brightgreen&cacheSeconds=300)](LICENSE)
[![LM Studio Hub](https://img.shields.io/badge/LM%20Studio%20Hub-Install-6C5CE7?style=for-the-badge)](https://lmstudio.ai/sahansera/local-video-tools)
![FFmpeg](https://img.shields.io/badge/FFmpeg-Local-007808?style=for-the-badge&logo=ffmpeg&logoColor=white)

[Try the prompts](#-try-these-prompts) · [Install](#-quick-start) · [How it works](#-how-it-works) · [Latest release](https://github.com/sahansera/lmstudio-local-video-tools/releases/tag/v0.1.2) · [Roadmap](docs/roadmap.md)

</div>

> **v0.1.2 Early Preview is out.** The core workflow has been validated with real **4K HEVC/H.265 MOV video on Apple Silicon**, including lossless clipping, accurate re-encoding, VideoToolbox conversion, progress tracking, and cancellation. This release also includes filesystem and persisted-job boundary hardening ahead of the public preview.

---

## 💬 Try these prompts

Attach a video in LM Studio and talk to it naturally:

| What you want | Ask your local model |
| --- | --- |
| 🎥 **Inspect a video** | `Inspect this video and tell me its codec, resolution, duration and frame rate.` |
| ✂️ **Cut without quality loss** | `Cut seconds 2 through 10 from this video without changing quality. Use the fastest lossless method available.` |
| 🎯 **Make an exact cut** | `Create an accurate clip from exactly 2.0 seconds to 10.0 seconds.` |
| ⚡ **Convert with hardware acceleration** | `Convert this video to a 1920px-wide H.264 MP4 using hardware acceleration if available.` |
| 📈 **Check a long-running encode** | `Check the status of that video conversion.` |
| 🛑 **Cancel a job** | `Cancel that video conversion.` |

No FFmpeg command memorization. No separate MCP configuration. The model chooses the right native tool and FFmpeg does the work locally.

---

## 🚀 What it can do

- 🎬 **Inspect video** — codec, resolution, duration, frame rate, bitrate, audio metadata, and encoder capabilities.
- ✂️ **Fast lossless trimming** — stream copy with `-c copy` when re-encoding is unnecessary.
- 🎯 **Accurate clipping** — precise boundaries using background re-encoding.
- 🔄 **Convert & resize** — H.264 or HEVC with optional aspect-ratio-preserving resize.
- ⚡ **Use hardware encoders** — Apple VideoToolbox, NVIDIA NVENC, and Intel Quick Sync when available.
- 📎 **Use LM Studio attachments** — attached videos are staged safely into the plugin working directory.
- 📈 **Track long jobs** — progress, processed time, speed, output path, and completion state.
- 🛑 **Cancel processing** — stop a running FFmpeg job cleanly.
- 💾 **Recover job state** — persisted jobs are visible after a plugin restart.
- 🧯 **Avoid accidental overwrites** — generated outputs fail safely when the target filename already exists.
- 🔒 **Stay local-first** — Local Video Tools itself does not upload your video to a remote processing service.

---

## 🎯 Why this exists

A local model can understand what you want to do with a video, but the actual media work still needs a reliable execution layer.

The obvious approach is to expose FFmpeg as a tool and wait for it to finish. That works until a real 4K HEVC transcode takes longer than the AI tool call is allowed to stay open.

**Local Video Tools is built around that problem.**

```text
Short / cheap operation
        ↓
run immediately
        ↓
return the output path

Long / expensive operation
        ↓
start background FFmpeg job
        ↓
return a job ID immediately
        ↓
model checks progress later
```

The result is a video tool surface designed for **local models**, not just a thin FFmpeg wrapper.

---

## ✅ Tested on a real 4K HEVC workflow

The v0.1 release series was exercised against real **3840×2160 HEVC/H.265 MOV media on Apple Silicon**.

| Workflow | Result |
| --- | --- |
| Inspect 4K HEVC metadata with ffprobe | ✅ Validated |
| Lossless stream-copy clip | ✅ Validated |
| Accurate background clip | ✅ Validated |
| 4K HEVC → 1080p H.264 | ✅ Validated |
| Apple `h264_videotoolbox` acceleration | ✅ Validated |
| Background job progress/status | ✅ Validated |
| Job cancellation and process cleanup | ✅ Validated |

One of the key tests was simply asking:

> Convert this video to a 1920px-wide H.264 MP4 using hardware acceleration if available.

Local Video Tools detected `h264_videotoolbox`, started FFmpeg as a background job, returned control to the model immediately, and let the model check the conversion until it completed.

That workflow is the core reason this project exists.

---

## ⚡ Quick start

### Install from LM Studio Hub

1. Install FFmpeg and ffprobe locally. On macOS:

   ```bash
   brew install ffmpeg
   ```

2. Open [Local Video Tools on LM Studio Hub](https://lmstudio.ai/sahansera/local-video-tools) and select **Run in LM Studio**.
3. Enable **Local Video Tools** under LM Studio **Integrations**.

> Local Video Tools is a **native LM Studio plugin**. You do **not** need to clone the repository, install Node.js, or add it to `mcp.json` when installing from the Hub.

### Develop from source

### Requirements

- LM Studio with native TypeScript plugin support
- Node.js 22 or newer
- The LM Studio `lms` CLI available on your `PATH`
- FFmpeg and ffprobe installed locally

Clone and test:

```bash
git clone https://github.com/sahansera/lmstudio-local-video-tools.git
cd lmstudio-local-video-tools
npm ci
npm run typecheck
npm test
```

Install/run the development build in LM Studio:

```bash
lms dev --install
```

Then enable **Local Video Tools** under LM Studio **Integrations**.

---

## 🧰 Model-visible tools

The tool surface is deliberately small so local models have fewer overlapping choices.

| Tool | Purpose | Execution |
| --- | --- | --- |
| `inspect_video` | Read video/audio metadata and FFmpeg capabilities | Foreground |
| `clip_video` | Fast lossless or accurate clipping | Foreground or background |
| `convert_video` | Convert to H.264/HEVC and optionally resize | Background |
| `video_job_status` | Read progress, speed, result, and errors | Foreground |
| `cancel_video_job` | Cancel a running FFmpeg job | Foreground |

---

## 🧠 How it works

```text
LM Studio conversation
        │
        ├── attached video
        │       ↓
        │  prompt preprocessor
        │       ↓
        │  safe local staging
        │
        └── native tool call
                ↓
        Local Video Tools
                ↓
          ffprobe / FFmpeg
                ↓
      local CPU / GPU / media engine
                ↓
          local output file
```

The language model does not encode the video itself. It decides **what operation to request**; the plugin delegates the media work to the FFmpeg installation on your machine.

---

## ⚡ Hardware acceleration

When hardware acceleration is enabled, Local Video Tools probes the local FFmpeg build and prefers a supported hardware encoder.

| Platform / hardware | Preferred path |
| --- | --- |
| Apple Silicon / macOS | VideoToolbox |
| NVIDIA GPU | NVENC |
| Intel | Quick Sync Video |
| Other / unsupported | CPU fallback |

Supported encoder detection includes `h264_videotoolbox`, `hevc_videotoolbox`, `h264_nvenc`, `hevc_nvenc`, `h264_qsv`, and `hevc_qsv`.

Software encoding is selected when the FFmpeg build does not advertise a suitable hardware encoder. If an advertised encoder fails at runtime because the hardware or driver is unavailable, the job reports the FFmpeg error; automatic software retry is planned.

---

## 🔒 Local-first by design

Local Video Tools is designed for local media workflows:

- FFmpeg and ffprobe run on your machine.
- The plugin itself does not upload videos to a remote video-processing service.
- Attached videos are staged inside the LM Studio working directory.
- Arbitrary external filesystem paths are disabled by default.
- Input paths are canonicalized, and symlinks cannot escape the working-directory boundary.
- Runtime input, output, and job directories reject symlinked path segments.
- FFmpeg will not overwrite an existing output file or follow an existing output symlink.
- External path access must be explicitly enabled.
- FFmpeg is spawned with argument arrays instead of shell command strings.
- Subprocess output is bounded.
- Long-running processes support timeout cleanup and cancellation.

Your chosen language model, LM Studio configuration, and other integrations can have their own privacy characteristics. These guarantees apply specifically to **Local Video Tools' video-processing behavior**.

---

## ⚙️ Configuration

| Setting | Default | Purpose |
| --- | --- | --- |
| FFmpeg path | Auto-detect | Override the `ffmpeg` executable |
| ffprobe path | Auto-detect | Override the `ffprobe` executable |
| Output directory | `local-video-tools/outputs` | Working-directory-relative output location |
| Hardware acceleration | `auto` | Prefer supported hardware encoders |
| External paths | Disabled | Allow files outside the LM Studio working directory |
| Maximum job duration | 2 hours | Upper bound for long-running FFmpeg work |

---

## 🖥️ Platform status

**macOS / Apple Silicon** is the best-tested environment for the v0.1 release series.

Windows/Linux discovery and NVIDIA/Intel hardware encoder support are implemented, but they need broader real-world testing across different FFmpeg builds and hardware configurations.

If you test Local Video Tools on another platform, bug reports and validation feedback are very welcome.

---

## 🗺️ What's next

Potential next steps include:

- batch video inspection
- frame extraction
- audio extraction
- dedicated resize workflows
- video concatenation
- overlays and subtitles
- better keyframe-aware clipping guidance
- broader acceleration testing
- expanded integration coverage

See the full [roadmap](docs/roadmap.md).

---

## 🤝 Contributing

Contributions, focused feature proposals, and reproducible bug reports are welcome.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Security-sensitive issues should follow [SECURITY.md](SECURITY.md) rather than being reported publicly.

---

<div align="center">

### 🎬 Edit video with your local AI.

[Download the latest release](https://github.com/sahansera/lmstudio-local-video-tools/releases/tag/v0.1.2) · [Report a bug](https://github.com/sahansera/lmstudio-local-video-tools/issues/new?template=bug_report.yml) · [Request a feature](https://github.com/sahansera/lmstudio-local-video-tools/issues/new?template=feature_request.yml)

MIT licensed.

</div>
