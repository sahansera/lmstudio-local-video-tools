# Roadmap

This roadmap describes the intended direction for Local Video Tools for LM Studio. Priorities may change as the plugin is tested against real local-model workflows.

## Milestone 1 — Reliable local video operations

- [x] Native LM Studio TypeScript plugin
- [x] FFmpeg / ffprobe discovery
- [x] Video attachment staging
- [x] `inspect_video`
- [x] Fast stream-copy trimming
- [x] Accurate background clipping
- [x] Background H.264 / HEVC conversion
- [x] Progress parsing and persistent jobs
- [x] Job cancellation
- [x] VideoToolbox, NVENC and Quick Sync encoder detection
- [x] CPU encoder fallback
- [x] Safer filesystem defaults

## Milestone 2 — Core editing toolkit

- [ ] `extract_frame`
- [ ] `extract_audio`
- [ ] Dedicated `resize_video`
- [ ] Video concatenation
- [ ] Audio replacement / removal
- [ ] Subtitle burn-in and muxing
- [ ] Overlay support
- [ ] Better output naming and collision handling

## Milestone 3 — Smarter FFmpeg decisions

- [ ] Keyframe-aware trim guidance
- [ ] Automatic stream-copy vs re-encode planning
- [ ] Better container / codec compatibility checks
- [ ] Preflight estimates for expensive operations
- [ ] Hardware-decoder capability detection
- [ ] Improved bitrate / quality presets
- [ ] Platform-specific tuning for Apple, NVIDIA, Intel and Linux VAAPI

## Milestone 4 — Local model UX

- [ ] More concise structured tool results
- [ ] Improved model-facing error taxonomy
- [ ] Optional progress notifications in LM Studio
- [ ] Better handling of multiple attached videos
- [ ] Safer overwrite behavior
- [ ] Discoverability improvements and examples for smaller local models

## Milestone 5 — OSS and distribution

- [ ] Expanded automated integration tests
- [ ] Test matrix across macOS, Windows and Linux
- [ ] Example media fixtures that can be redistributed legally
- [ ] First tagged release
- [ ] LM Studio Hub submission
- [ ] Installation and troubleshooting docs
- [ ] Contributor documentation for adding new tools safely

## Possible future directions

These are intentionally not committed features yet:

- optional video-understanding helpers for vision models;
- an MCP adapter backed by the same FFmpeg core for non-LM-Studio clients;
- reusable presets for social/video-platform exports;
- batch processing;
- waveform / thumbnail generation;
- scene detection and clip suggestions.

The project will prefer a small, dependable tool surface over adding every FFmpeg capability directly.
