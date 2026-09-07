# Changelog

All notable changes to Local Video Tools for LM Studio will be documented here.

The project is currently in early preview, so behavior and tool schemas may change before the first stable release.

## Unreleased

## 0.1.2 - 2026-09-07

### Fixed

- Stabilize the atomic job-persistence regression test by waiting for the queued terminal-state write before asserting its on-disk contents.

## 0.1.1 - 2026-09-07

### Fixed

- Canonicalize input paths so symlinks cannot bypass the default working-directory boundary.
- Reject symlinked segments in attachment, output and background-job directories.
- Validate persisted job records and UUIDs before using them to restore state or build filenames.
- Serialize atomic job-record writes to prevent stale progress updates from replacing final state.
- Refuse to overwrite existing video outputs, including output symlinks.

### Changed

- Report processed and total duration in background-job status results.
- Ignore LM Studio development output, staged media, generated video and job-record directories.
- Use reproducible CI installs, lockfile-based caching and read-only workflow permissions.
- Declare Node.js 22 as the minimum development runtime and prevent accidental npm publication.

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
