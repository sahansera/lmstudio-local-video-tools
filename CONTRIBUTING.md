# Contributing to Local Video Tools for LM Studio

Thanks for your interest in contributing.

This project aims to provide a small, reliable set of local video tools that LM Studio models can call safely and predictably. Contributions are most useful when they preserve that simplicity.

## Before you start

Please search existing issues and pull requests before opening a new one. For larger features or architectural changes, open an issue first so the direction can be discussed before significant implementation work begins.

## Development setup

Requirements:

- Node.js 22+
- LM Studio with plugin development support
- `lms` CLI
- FFmpeg and ffprobe

```bash
git clone https://github.com/sahansera/lmstudio-local-video-tools.git
cd lmstudio-local-video-tools
npm install
npm test
lms dev
```

## Project principles

Please keep these design goals in mind:

1. **Local-first** — video processing should remain on the user's machine unless a future feature explicitly says otherwise.
2. **Small tool surface** — prefer a few well-designed tools over many overlapping tools. Local models need clear choices.
3. **Safe subprocess execution** — use argument arrays with `shell: false`; support cancellation and bounded output.
4. **Background expensive work** — long encodes should not hold an LM Studio tool call open unnecessarily.
5. **Useful model-facing errors** — return concise actionable errors rather than large raw FFmpeg logs.
6. **Cross-platform behavior** — avoid assuming one FFmpeg install path or hardware encoder.
7. **Conservative filesystem access** — keep arbitrary external-path access opt-in.

## Tests

Run before submitting:

```bash
npm test
npm run typecheck
```

When adding command-building logic, include focused tests that validate the resulting FFmpeg argument arrays. Avoid tests that depend on a specific GPU being present.

## Pull requests

A good pull request should:

- explain the user problem being solved;
- keep the change focused;
- include tests where practical;
- update documentation when behavior changes;
- avoid unrelated formatting or refactoring;
- mention any platform-specific assumptions.

For FFmpeg changes, include at least one representative command/workflow in the PR description.

## Reporting bugs

Please include:

- LM Studio version;
- operating system and architecture;
- FFmpeg version (`ffmpeg -version`);
- relevant encoder availability (`ffmpeg -encoders` excerpt if needed);
- input codec/container/resolution from `inspect_video` where possible;
- the Local Video Tools operation attempted;
- the concise error returned by the plugin.

Do not upload private videos just to reproduce an issue. A synthetic or public sample is preferred.

## Security issues

Please do not report security vulnerabilities in a public issue. See [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the repository's MIT License.
