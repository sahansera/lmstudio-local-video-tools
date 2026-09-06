# Changelog

All notable changes to Local Video Tools for LM Studio will be documented here.

The project is currently in early preview, so behavior and tool schemas may change before the first stable release.

## Unreleased

## 0.1.0 - 2026-09-07

### Added

- Native LM Studio TypeScript plugin foundation.
- Video attachment staging inside the plugin working directory.
- `inspect_video` metadata inspection through ffprobe.
- `clip_video` with lossless stream-copy and accurate re-encode modes.
- `convert_video` with optional resizing and H.264 / HEVC targets.
- Background FFmpeg jobs with progress reporting and cancellation.
- Persistent job records and interrupted-job recovery state.
- FFmpeg / ffprobe auto-discovery.
- Apple VideoToolbox, NVIDIA NVENC and Intel Quick Sync encoder detection.
- CPU encoding fallback.
- Safer default filesystem boundaries.
- Initial unit tests and GitHub Actions CI.
- OSS contribution, security, issue and pull-request templates.

### Validated

- Real-world 4K HEVC/H.265 inspection and lossless clipping on macOS.
- Accurate background clipping.
- 4K HEVC to 1080p H.264 conversion with Apple VideoToolbox.
- Background progress/status reporting and job cancellation.
