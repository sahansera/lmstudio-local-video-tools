import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { parseProgressLine, ProgressState, runCommand } from "./ffmpeg";

export type VideoJobStatus = "running" | "completed" | "failed" | "cancelled" | "interrupted";

export interface VideoJob {
  id: string;
  type: "clip" | "convert";
  status: VideoJobStatus;
  inputPath: string;
  outputPath: string;
  command: string;
  args: string[];
  createdAt: string;
  startedAt: string;
  completedAt?: string;
  pid?: number;
  progressPercent?: number;
  speed?: string;
  error?: string;
}

export interface StartJobInput {
  type: VideoJob["type"];
  inputPath: string;
  outputPath: string;
  command: string;
  args: string[];
  durationSec: number | null;
  timeoutMs: number;
}

export class JobManager {
  private readonly jobs = new Map<string, VideoJob>();
  private readonly controllers = new Map<string, AbortController>();

  public constructor(private readonly jobsDirectory: string) {}

  public async initialize(): Promise<void> {
    await mkdir(this.jobsDirectory, { recursive: true });
    const files = await readdir(this.jobsDirectory).catch(() => [] as string[]);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const job = JSON.parse(await readFile(join(this.jobsDirectory, file), "utf8")) as VideoJob;
        if (job.status === "running") {
          job.status = "interrupted";
          job.completedAt = new Date().toISOString();
          job.error = "LM Studio or the plugin restarted before this job completed.";
          await this.persist(job);
        }
        this.jobs.set(job.id, job);
      } catch {
        // Ignore malformed stale job records instead of preventing the plugin from starting.
      }
    }
  }

  public get(id: string): VideoJob | undefined {
    return this.jobs.get(id);
  }

  public async start(input: StartJobInput): Promise<VideoJob> {
    const now = new Date().toISOString();
    const job: VideoJob = {
      id: randomUUID(),
      type: input.type,
      status: "running",
      inputPath: input.inputPath,
      outputPath: input.outputPath,
      command: input.command,
      args: input.args,
      createdAt: now,
      startedAt: now,
      progressPercent: 0,
    };

    const controller = new AbortController();
    this.controllers.set(job.id, controller);
    this.jobs.set(job.id, job);
    await this.persist(job);

    let stdoutBuffer = "";
    const progressState: ProgressState = {};

    void runCommand(input.command, input.args, {
      signal: controller.signal,
      timeoutMs: input.timeoutMs,
      maxOutputBytes: 512 * 1024,
      onSpawn: (pid) => {
        job.pid = pid;
        void this.persist(job);
      },
      onStdoutChunk: (chunk) => {
        stdoutBuffer += chunk;
        const lines = stdoutBuffer.split(/\r?\n/);
        stdoutBuffer = lines.pop() ?? "";
        for (const line of lines) {
          parseProgressLine(line, progressState);
        }
        if (progressState.outTimeSec !== undefined && input.durationSec && input.durationSec > 0) {
          job.progressPercent = Math.max(
            0,
            Math.min(100, (progressState.outTimeSec / input.durationSec) * 100),
          );
        }
        if (progressState.speed) job.speed = progressState.speed;
        void this.persist(job);
      },
    })
      .then(async (result) => {
        if (job.status === "cancelled") return;
        if (result.code === 0) {
          job.status = "completed";
          job.progressPercent = 100;
        } else {
          job.status = "failed";
          job.error = result.stderr.trim() || `FFmpeg exited with code ${String(result.code)}.`;
        }
        job.completedAt = new Date().toISOString();
        await this.persist(job);
      })
      .catch(async (error: unknown) => {
        if (job.status === "cancelled") return;
        job.status = "failed";
        job.completedAt = new Date().toISOString();
        job.error = error instanceof Error ? error.message : String(error);
        await this.persist(job);
      })
      .finally(() => {
        this.controllers.delete(job.id);
      });

    return job;
  }

  public async cancel(id: string): Promise<VideoJob | undefined> {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    if (job.status !== "running") return job;

    job.status = "cancelled";
    job.completedAt = new Date().toISOString();
    job.error = "Cancelled by user.";
    this.controllers.get(id)?.abort();
    this.controllers.delete(id);
    await this.persist(job);
    return job;
  }

  private async persist(job: VideoJob): Promise<void> {
    await mkdir(this.jobsDirectory, { recursive: true });
    const path = join(this.jobsDirectory, `${job.id}.json`);
    await writeFile(path, `${JSON.stringify(job, null, 2)}\n`, "utf8");
  }
}
