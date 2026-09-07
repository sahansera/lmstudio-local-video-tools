import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";

export interface BinaryPaths {
  ffmpeg: string;
  ffprobe: string;
}

export interface VideoProbe {
  path: string;
  durationSec: number | null;
  formatName: string | null;
  bitRate: number | null;
  sizeBytes: number | null;
  video: null | {
    codec: string | null;
    profile: string | null;
    width: number | null;
    height: number | null;
    pixelFormat: string | null;
    frameRate: number | null;
  };
  audio: null | {
    codec: string | null;
    channels: number | null;
    sampleRate: number | null;
  };
}

export interface EncoderCapabilities {
  h264VideoToolbox: boolean;
  hevcVideoToolbox: boolean;
  h264Nvenc: boolean;
  hevcNvenc: boolean;
  h264Qsv: boolean;
  hevcQsv: boolean;
}

export interface CommandResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

export interface RunCommandOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  maxOutputBytes?: number;
  onStdoutChunk?: (chunk: string) => void;
  onStderrChunk?: (chunk: string) => void;
  onSpawn?: (pid: number | undefined) => void;
}

export async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {},
): Promise<CommandResult> {
  const maxOutputBytes = options.maxOutputBytes ?? 1024 * 1024;

  return await new Promise<CommandResult>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    options.onSpawn?.(child.pid);

    let stdout = "";
    let stderr = "";
    let settled = false;
    let forceKillTimer: NodeJS.Timeout | undefined;

    const appendLimited = (current: string, chunk: string) => {
      if (Buffer.byteLength(current, "utf8") >= maxOutputBytes) return current;
      const next = current + chunk;
      if (Buffer.byteLength(next, "utf8") <= maxOutputBytes) return next;
      return Buffer.from(next, "utf8").subarray(0, maxOutputBytes).toString("utf8");
    };

    child.stdout?.on("data", (buffer: Buffer) => {
      const chunk = buffer.toString("utf8");
      stdout = appendLimited(stdout, chunk);
      options.onStdoutChunk?.(chunk);
    });

    child.stderr?.on("data", (buffer: Buffer) => {
      const chunk = buffer.toString("utf8");
      stderr = appendLimited(stderr, chunk);
      options.onStderrChunk?.(chunk);
    });

    const terminate = () => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGKILL");
        }
      }, 1500);
      forceKillTimer.unref();
    };

    const abortHandler = () => terminate();
    options.signal?.addEventListener("abort", abortHandler, { once: true });
    if (options.signal?.aborted) terminate();

    const timeout = options.timeoutMs
      ? setTimeout(terminate, options.timeoutMs)
      : undefined;
    timeout?.unref();

    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      options.signal?.removeEventListener("abort", abortHandler);
    };

    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectPromise(error);
    });

    child.once("close", (code, signal) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolvePromise({ code, signal, stdout, stderr });
    });
  });
}

async function isExecutableFile(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function commandWorks(command: string): Promise<boolean> {
  try {
    const result = await runCommand(command, ["-version"], {
      timeoutMs: 3000,
      maxOutputBytes: 4096,
    });
    return result.code === 0;
  } catch {
    return false;
  }
}

function candidatePaths(binaryName: "ffmpeg" | "ffprobe"): string[] {
  const candidates: string[] = [binaryName];

  if (process.platform === "darwin") {
    candidates.push(
      `/opt/homebrew/bin/${binaryName}`,
      `/usr/local/bin/${binaryName}`,
      `/opt/local/bin/${binaryName}`,
    );
  } else if (process.platform === "linux") {
    candidates.push(`/usr/bin/${binaryName}`, `/usr/local/bin/${binaryName}`);
  } else if (process.platform === "win32") {
    candidates.push(
      `C:\\ffmpeg\\bin\\${binaryName}.exe`,
      `C:\\Program Files\\ffmpeg\\bin\\${binaryName}.exe`,
    );
  }

  return candidates;
}

async function discoverOne(
  binaryName: "ffmpeg" | "ffprobe",
  configuredPath: string,
  siblingCandidate?: string,
): Promise<string> {
  const configured = configuredPath.trim();
  const candidates = [
    ...(configured ? [configured] : []),
    ...(siblingCandidate ? [siblingCandidate] : []),
    ...candidatePaths(binaryName),
  ];

  const unique = [...new Set(candidates)];
  for (const candidate of unique) {
    if (candidate.includes("/") || candidate.includes("\\")) {
      if (!(await isExecutableFile(candidate))) continue;
    }
    if (await commandWorks(candidate)) return candidate;
  }

  throw new Error(
    `${binaryName} was not found. Install FFmpeg or configure the ${binaryName} path in Local Video Tools settings.`,
  );
}

export async function discoverBinaries(
  configuredFfmpeg = "",
  configuredFfprobe = "",
): Promise<BinaryPaths> {
  const ffmpeg = await discoverOne("ffmpeg", configuredFfmpeg);
  const sibling = join(dirname(ffmpeg), process.platform === "win32" ? "ffprobe.exe" : "ffprobe");
  const ffprobe = await discoverOne("ffprobe", configuredFfprobe, sibling);
  return { ffmpeg, ffprobe };
}

function numberOrNull(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFrameRate(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const [numeratorText, denominatorText] = value.split("/");
  const numerator = Number(numeratorText);
  const denominator = Number(denominatorText ?? "1");
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

export async function probeVideo(
  ffprobePath: string,
  inputPath: string,
  signal?: AbortSignal,
): Promise<VideoProbe> {
  const result = await runCommand(
    ffprobePath,
    ["-v", "error", "-show_format", "-show_streams", "-of", "json", inputPath],
    { signal, timeoutMs: 60000, maxOutputBytes: 4 * 1024 * 1024 },
  );

  if (result.code !== 0) {
    throw new Error(`ffprobe failed: ${result.stderr.trim() || result.stdout.trim() || "unknown error"}`);
  }

  const parsed = JSON.parse(result.stdout) as {
    format?: Record<string, unknown>;
    streams?: Array<Record<string, unknown>>;
  };
  const streams = parsed.streams ?? [];
  const videoStream = streams.find((stream) => stream.codec_type === "video");
  const audioStream = streams.find((stream) => stream.codec_type === "audio");

  return {
    path: inputPath,
    durationSec: numberOrNull(parsed.format?.duration ?? videoStream?.duration ?? audioStream?.duration),
    formatName: typeof parsed.format?.format_name === "string" ? parsed.format.format_name : null,
    bitRate: numberOrNull(parsed.format?.bit_rate),
    sizeBytes: numberOrNull(parsed.format?.size),
    video: videoStream
      ? {
          codec: typeof videoStream.codec_name === "string" ? videoStream.codec_name : null,
          profile: typeof videoStream.profile === "string" ? videoStream.profile : null,
          width: numberOrNull(videoStream.width),
          height: numberOrNull(videoStream.height),
          pixelFormat: typeof videoStream.pix_fmt === "string" ? videoStream.pix_fmt : null,
          frameRate: parseFrameRate(videoStream.avg_frame_rate ?? videoStream.r_frame_rate),
        }
      : null,
    audio: audioStream
      ? {
          codec: typeof audioStream.codec_name === "string" ? audioStream.codec_name : null,
          channels: numberOrNull(audioStream.channels),
          sampleRate: numberOrNull(audioStream.sample_rate),
        }
      : null,
  };
}

export async function detectEncoderCapabilities(
  ffmpegPath: string,
  signal?: AbortSignal,
): Promise<EncoderCapabilities> {
  const result = await runCommand(ffmpegPath, ["-hide_banner", "-encoders"], {
    signal,
    timeoutMs: 30000,
    maxOutputBytes: 4 * 1024 * 1024,
  });
  const output = `${result.stdout}\n${result.stderr}`;
  return {
    h264VideoToolbox: output.includes("h264_videotoolbox"),
    hevcVideoToolbox: output.includes("hevc_videotoolbox"),
    h264Nvenc: output.includes("h264_nvenc"),
    hevcNvenc: output.includes("hevc_nvenc"),
    h264Qsv: output.includes("h264_qsv"),
    hevcQsv: output.includes("hevc_qsv"),
  };
}

export type VideoCodec = "h264" | "hevc";

export function chooseVideoEncoder(
  codec: VideoCodec,
  capabilities: EncoderCapabilities,
  hardwareAcceleration: "auto" | "off",
): string {
  if (hardwareAcceleration === "auto") {
    if (codec === "h264") {
      if (capabilities.h264VideoToolbox) return "h264_videotoolbox";
      if (capabilities.h264Nvenc) return "h264_nvenc";
      if (capabilities.h264Qsv) return "h264_qsv";
    } else {
      if (capabilities.hevcVideoToolbox) return "hevc_videotoolbox";
      if (capabilities.hevcNvenc) return "hevc_nvenc";
      if (capabilities.hevcQsv) return "hevc_qsv";
    }
  }
  return codec === "h264" ? "libx264" : "libx265";
}

export interface ClipCommandOptions {
  inputPath: string;
  outputPath: string;
  startSec: number;
  durationSec: number;
  fast: boolean;
  encoder?: string;
}

export function buildClipArgs(options: ClipCommandOptions): string[] {
  if (options.fast) {
    return [
      "-hide_banner",
      "-ss",
      String(options.startSec),
      "-i",
      options.inputPath,
      "-t",
      String(options.durationSec),
      "-map",
      "0",
      "-c",
      "copy",
      "-avoid_negative_ts",
      "make_zero",
      "-n",
      options.outputPath,
    ];
  }

  if (!options.encoder) throw new Error("An encoder is required for accurate clipping.");
  return [
    "-hide_banner",
    "-ss",
    String(options.startSec),
    "-i",
    options.inputPath,
    "-t",
    String(options.durationSec),
    "-map",
    "0:v:0?",
    "-map",
    "0:a?",
    "-c:v",
    options.encoder,
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    "-progress",
    "pipe:1",
    "-nostats",
    "-n",
    options.outputPath,
  ];
}

export interface ConvertCommandOptions {
  inputPath: string;
  outputPath: string;
  codec: VideoCodec;
  encoder: string;
  width?: number;
  height?: number;
}

export function buildConvertArgs(options: ConvertCommandOptions): string[] {
  const args = ["-hide_banner", "-i", options.inputPath];
  if (options.width !== undefined || options.height !== undefined) {
    const width = options.width ?? -2;
    const height = options.height ?? -2;
    args.push("-vf", `scale=${width}:${height}`);
  }
  args.push(
    "-map",
    "0:v:0?",
    "-map",
    "0:a?",
    "-c:v",
    options.encoder,
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    "-progress",
    "pipe:1",
    "-nostats",
    "-n",
    options.outputPath,
  );
  return args;
}

export interface ProgressState {
  outTimeSec?: number;
  speed?: string;
  finished?: boolean;
}

export function parseProgressLine(line: string, state: ProgressState): ProgressState {
  const index = line.indexOf("=");
  if (index < 0) return state;
  const key = line.slice(0, index).trim();
  const value = line.slice(index + 1).trim();

  if (key === "out_time_us") {
    const microseconds = Number(value);
    if (Number.isFinite(microseconds)) state.outTimeSec = microseconds / 1_000_000;
  } else if (key === "out_time_ms" && state.outTimeSec === undefined) {
    const microseconds = Number(value);
    if (Number.isFinite(microseconds)) state.outTimeSec = microseconds / 1_000_000;
  } else if (key === "speed") {
    state.speed = value;
  } else if (key === "progress" && value === "end") {
    state.finished = true;
  }
  return state;
}
