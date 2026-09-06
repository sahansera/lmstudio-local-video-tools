# Architecture

Local Video Tools is a native LM Studio TypeScript plugin. It invokes local `ffmpeg` and `ffprobe` processes with `shell: false` and keeps the language model out of the media-processing data path.

## Execution model

- Metadata inspection uses `ffprobe` in the foreground.
- Fast clipping uses input-side seeking and `-c copy` in the foreground.
- Accurate clipping and transcoding run as background jobs and return a job ID immediately.
- Background progress is parsed from `ffmpeg -progress pipe:1 -nostats` output.
- Jobs are persisted as JSON records. A plugin restart marks unfinished jobs as interrupted.
- Cancellation sends a graceful termination first and escalates to a forced kill if FFmpeg does not exit.

## Encoding

When hardware acceleration is set to Auto, encoder capability detection prefers VideoToolbox, NVENC, or Quick Sync when available. CPU encoding with libx264/libx265 is the fallback.

## Filesystem boundary

Outputs always remain under the configured output directory inside LM Studio's working directory. Inputs outside the working directory are rejected unless the user explicitly enables external paths.
