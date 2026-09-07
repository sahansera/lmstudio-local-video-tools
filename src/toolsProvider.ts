import { tool, Tool, ToolsProviderController } from "@lmstudio/sdk";
import { basename, extname, resolve } from "node:path";
import { z } from "zod";
import { configSchematics } from "./config";
import {
  buildClipArgs,
  buildConvertArgs,
  chooseVideoEncoder,
  detectEncoderCapabilities,
  discoverBinaries,
  probeVideo,
  runCommand,
  type BinaryPaths,
  type EncoderCapabilities,
  type VideoCodec,
} from "./ffmpeg";
import { JobManager } from "./jobs";
import {
  canonicalizeWorkingDirectory,
  ensureDirectoryInside,
  resolveExistingFilePath,
} from "./pathSafety";

async function resolveInputPath(
  input: string,
  workingDirectory: string,
  allowExternalPaths: boolean,
): Promise<string> {
  return await resolveExistingFilePath(input, workingDirectory, allowExternalPaths);
}

async function resolveOutputDirectory(
  workingDirectory: string,
  configuredSubdirectory: string,
): Promise<string> {
  const subdirectory = configuredSubdirectory.trim() || "local-video-tools/outputs";
  return await ensureDirectoryInside(
    workingDirectory,
    subdirectory,
    "Output Subdirectory must stay inside LM Studio's working directory and cannot use symlinked directories.",
  );
}

function outputNameFor(
  inputPath: string,
  suffix: string,
  extension: string,
  requestedName?: string,
): string {
  if (requestedName?.trim()) {
    const name = basename(requestedName.trim());
    if (!name || name === "." || name === "..") {
      throw new Error("output_name must be a filename, not a directory path.");
    }
    return name;
  }
  const source = basename(inputPath, extname(inputPath));
  return `${source}-${suffix}${extension}`;
}

function serializeJob(job: ReturnType<JobManager["get"]>) {
  if (!job) return null;
  return {
    jobId: job.id,
    type: job.type,
    status: job.status,
    progressPercent:
      job.progressPercent === undefined ? undefined : Math.round(job.progressPercent * 10) / 10,
    speed: job.speed,
    processedSeconds: job.processedSeconds,
    durationSeconds: job.durationSeconds,
    inputPath: job.inputPath,
    outputPath: job.outputPath,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    error: job.error,
  };
}

export async function toolsProvider(ctl: ToolsProviderController): Promise<Tool[]> {
  const workingDirectory = await canonicalizeWorkingDirectory(ctl.getWorkingDirectory());
  const jobsDirectory = await ensureDirectoryInside(
    workingDirectory,
    ".local-video-tools/jobs",
    "The Local Video Tools job directory must stay inside LM Studio's working directory and cannot use symlinked directories.",
  );
  const jobManager = new JobManager(jobsDirectory);
  await jobManager.initialize();

  const getConfig = () => ctl.getPluginConfig(configSchematics);

  let binaryCache: Promise<BinaryPaths> | undefined;
  const getBinaries = async () => {
    if (!binaryCache) {
      const config = getConfig();
      binaryCache = discoverBinaries(
        String(config.get("ffmpegPath") ?? ""),
        String(config.get("ffprobePath") ?? ""),
      );
    }
    return await binaryCache;
  };

  let capabilityCache: Promise<EncoderCapabilities> | undefined;
  const getCapabilities = async (ffmpeg: string, signal?: AbortSignal) => {
    if (!capabilityCache) capabilityCache = detectEncoderCapabilities(ffmpeg, signal);
    return await capabilityCache;
  };

  const resolveInput = async (input: string) => {
    const config = getConfig();
    return await resolveInputPath(
      input,
      workingDirectory,
      Boolean(config.get("allowExternalPaths")),
    );
  };

  const resolveOutput = async (inputPath: string, suffix: string, extension: string, requested?: string) => {
    const directory = await resolveOutputDirectory(
      workingDirectory,
      String(getConfig().get("outputSubdirectory") ?? ""),
    );
    const outputPath = resolve(directory, outputNameFor(inputPath, suffix, extension, requested));
    if (resolve(outputPath, "..") !== directory) {
      throw new Error("Output files must stay directly inside the configured output directory.");
    }
    return outputPath;
  };

  const inspectVideo = tool({
    name: "inspect_video",
    description:
      "Inspect a local video with ffprobe. Returns concise metadata including duration, codecs, resolution, frame rate, bitrate and audio information. Use this before expensive editing or conversion when the source properties are unknown.",
    parameters: {
      input: z.string().describe("Absolute path or path relative to LM Studio's working directory."),
    },
    implementation: async ({ input }, { signal, status }) => {
      try {
        status?.("Inspecting video with ffprobe…");
        const inputPath = await resolveInput(input);
        const binaries = await getBinaries();
        const metadata = await probeVideo(binaries.ffprobe, inputPath, signal);
        const capabilities = await getCapabilities(binaries.ffmpeg, signal);
        return {
          ...metadata,
          ffmpegPath: binaries.ffmpeg,
          ffprobePath: binaries.ffprobe,
          hardwareEncoders: capabilities,
          note: "Video processing happens locally on this computer through FFmpeg, not inside the language model sandbox.",
        };
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const clipVideo = tool({
    name: "clip_video",
    description:
      "Trim a local video. mode=fast uses stream copy (-c copy) and is usually very quick with no quality loss, but cuts may align to nearby keyframes. mode=accurate re-encodes for more precise boundaries and runs as a background job. mode=auto currently prefers fast mode.",
    parameters: {
      input: z.string(),
      start_seconds: z.number().min(0),
      end_seconds: z.number().positive().optional(),
      duration_seconds: z.number().positive().optional(),
      mode: z.enum(["auto", "fast", "accurate"]).optional(),
      output_name: z.string().optional(),
    },
    implementation: async (
      { input, start_seconds, end_seconds, duration_seconds, mode, output_name },
      { signal, status },
    ) => {
      try {
        if (end_seconds === undefined && duration_seconds === undefined) {
          return "Error: Provide end_seconds or duration_seconds.";
        }
        if (end_seconds !== undefined && duration_seconds !== undefined) {
          return "Error: Provide only one of end_seconds or duration_seconds.";
        }

        const inputPath = await resolveInput(input);
        const binaries = await getBinaries();
        const metadata = await probeVideo(binaries.ffprobe, inputPath, signal);
        const duration = duration_seconds ?? (end_seconds! - start_seconds);
        if (!(duration > 0)) return "Error: Clip duration must be greater than zero.";
        if (metadata.durationSec !== null && start_seconds >= metadata.durationSec) {
          return `Error: start_seconds (${start_seconds}) is beyond the video duration (${metadata.durationSec.toFixed(3)} seconds).`;
        }

        const selectedMode = mode ?? "auto";
        const fast = selectedMode !== "accurate";

        if (fast) {
          const extension = extname(inputPath) || ".mov";
          const outputPath = await resolveOutput(inputPath, "clip", extension, output_name);
          const args = buildClipArgs({
            inputPath,
            outputPath,
            startSec: start_seconds,
            durationSec: duration,
            fast: true,
          });
          status?.("Creating lossless stream-copy clip…");
          const result = await runCommand(binaries.ffmpeg, args, {
            signal,
            timeoutMs: Number(getConfig().get("timeoutMs") ?? 7200000),
            maxOutputBytes: 1024 * 1024,
          });
          if (result.code !== 0) {
            return `Error: FFmpeg clip failed: ${result.stderr.trim() || `exit code ${String(result.code)}`}`;
          }
          return {
            status: "completed",
            mode: "fast",
            outputPath,
            qualityLoss: false,
            note: "Fast mode uses stream copy, so the exact starting frame can be limited by source keyframes.",
          };
        }

        const capabilities = await getCapabilities(binaries.ffmpeg, signal);
        const hardwareAcceleration = String(getConfig().get("hardwareAcceleration") ?? "auto") as
          | "auto"
          | "off";
        const encoder = chooseVideoEncoder("h264", capabilities, hardwareAcceleration);
        const outputPath = await resolveOutput(inputPath, "accurate-clip", ".mp4", output_name);
        const args = buildClipArgs({
          inputPath,
          outputPath,
          startSec: start_seconds,
          durationSec: duration,
          fast: false,
          encoder,
        });
        status?.(`Starting accurate clip in background with ${encoder}…`);
        const job = await jobManager.start({
          type: "clip",
          inputPath,
          outputPath,
          command: binaries.ffmpeg,
          args,
          durationSec: duration,
          timeoutMs: Number(getConfig().get("timeoutMs") ?? 7200000),
        });
        return {
          ...serializeJob(job),
          encoder,
          message: "Accurate clipping started in the background. Use video_job_status with the jobId to check progress.",
        };
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const convertVideo = tool({
    name: "convert_video",
    description:
      "Convert or transcode a local video to H.264 or HEVC, optionally resizing it. This is an expensive operation and always starts a background job to avoid LM Studio tool-call timeouts. Hardware encoding is used automatically when supported unless disabled in settings.",
    parameters: {
      input: z.string(),
      codec: z.enum(["h264", "hevc"]).optional(),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      output_name: z.string().optional(),
    },
    implementation: async ({ input, codec, width, height, output_name }, { signal, status }) => {
      try {
        const inputPath = await resolveInput(input);
        const binaries = await getBinaries();
        const metadata = await probeVideo(binaries.ffprobe, inputPath, signal);
        const capabilities = await getCapabilities(binaries.ffmpeg, signal);
        const selectedCodec = (codec ?? "h264") as VideoCodec;
        const hardwareAcceleration = String(getConfig().get("hardwareAcceleration") ?? "auto") as
          | "auto"
          | "off";
        const encoder = chooseVideoEncoder(selectedCodec, capabilities, hardwareAcceleration);
        const outputPath = await resolveOutput(inputPath, `${selectedCodec}-converted`, ".mp4", output_name);
        const args = buildConvertArgs({
          inputPath,
          outputPath,
          codec: selectedCodec,
          encoder,
          width,
          height,
        });
        status?.(`Starting background conversion with ${encoder}…`);
        const job = await jobManager.start({
          type: "convert",
          inputPath,
          outputPath,
          command: binaries.ffmpeg,
          args,
          durationSec: metadata.durationSec,
          timeoutMs: Number(getConfig().get("timeoutMs") ?? 7200000),
        });
        return {
          ...serializeJob(job),
          encoder,
          targetCodec: selectedCodec,
          targetWidth: width,
          targetHeight: height,
          message: "Conversion started in the background. Use video_job_status with the jobId to check progress.",
        };
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const jobStatus = tool({
    name: "video_job_status",
    description:
      "Check a Local Video Tools background job. Returns progress, speed, output path and any error. Use after clip_video accurate mode or convert_video returns a jobId.",
    parameters: { job_id: z.string() },
    implementation: async ({ job_id }) => {
      const job = jobManager.get(job_id);
      return job ? serializeJob(job) : `Error: Video job not found: ${job_id}`;
    },
  });

  const cancelJob = tool({
    name: "cancel_video_job",
    description: "Cancel a currently running Local Video Tools background FFmpeg job by jobId.",
    parameters: { job_id: z.string() },
    implementation: async ({ job_id }) => {
      const job = await jobManager.cancel(job_id);
      return job ? serializeJob(job) : `Error: Video job not found: ${job_id}`;
    },
  });

  return [inspectVideo, clipVideo, convertVideo, jobStatus, cancelJob];
}
