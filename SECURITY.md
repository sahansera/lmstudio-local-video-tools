# Security Policy

Local Video Tools executes FFmpeg and ffprobe on the user's machine and can read/write local media files, so security and filesystem boundaries are important parts of the project.

## Supported versions

Until the first stable release, only the latest code on the active development branch is supported for security fixes.

## Reporting a vulnerability

Please do **not** open a public GitHub issue for vulnerabilities involving command execution, path traversal, arbitrary file access, unsafe attachment handling, malicious media handling, or other issues that could expose a user's machine or data.

Instead, use [GitHub's private vulnerability reporting form](https://github.com/sahansera/lmstudio-local-video-tools/security/advisories/new). If the form is temporarily unavailable, open a minimal issue asking the maintainer to establish private contact, but do not include vulnerability details in that issue.

Please include:

- a concise description of the issue;
- affected platform(s);
- the relevant plugin/tool path;
- reproduction steps using non-sensitive files where possible;
- expected vs actual behavior;
- impact assessment;
- any suggested mitigation.

## Security model

The project currently follows these defaults:

- subprocesses are launched without a shell;
- arbitrary external filesystem paths are disabled by default;
- filesystem boundaries are checked using canonical paths;
- runtime directories reject symlinked path segments;
- generated videos do not overwrite existing output files;
- attached media is staged in the plugin working directory;
- generated outputs stay inside the configured output area;
- subprocess output is bounded;
- long-running work supports cancellation and timeout handling;
- FFmpeg binaries are discovered locally rather than downloaded at runtime.

These controls reduce risk but do not make arbitrary media inherently safe. FFmpeg is a complex native dependency, and users should keep their FFmpeg installation up to date.

## Responsible disclosure

Please allow reasonable time for a fix and coordinated disclosure before publishing vulnerability details.
