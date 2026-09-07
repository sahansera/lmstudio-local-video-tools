const test = require("node:test");
const assert = require("node:assert/strict");
const {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const {
  buildClipArgs,
  buildConvertArgs,
  chooseVideoEncoder,
  parseProgressLine,
} = require("../dist/ffmpeg.js");
const { JobManager } = require("../dist/jobs.js");
const {
  ensureDirectoryInside,
  resolveExistingFilePath,
} = require("../dist/pathSafety.js");

test("fast clip seeks before input and uses stream copy", () => {
  const args = buildClipArgs({
    inputPath: "/tmp/input.mov",
    outputPath: "/tmp/output.mov",
    startSec: 2,
    durationSec: 8,
    fast: true,
  });

  assert.ok(args.indexOf("-ss") < args.indexOf("-i"));
  assert.equal(args[args.indexOf("-c") + 1], "copy");
  assert.equal(args[args.indexOf("-t") + 1], "8");
  assert.ok(args.includes("-n"));
  assert.ok(!args.includes("-y"));
});

test("accurate clip uses the selected encoder and progress output", () => {
  const args = buildClipArgs({
    inputPath: "/tmp/input.mov",
    outputPath: "/tmp/output.mp4",
    startSec: 1.5,
    durationSec: 3,
    fast: false,
    encoder: "h264_videotoolbox",
  });

  assert.equal(args[args.indexOf("-c:v") + 1], "h264_videotoolbox");
  assert.equal(args[args.indexOf("-progress") + 1], "pipe:1");
  assert.ok(args.includes("-n"));
});

test("convert preserves aspect ratio when only width is provided", () => {
  const args = buildConvertArgs({
    inputPath: "/tmp/input.mov",
    outputPath: "/tmp/output.mp4",
    codec: "h264",
    encoder: "libx264",
    width: 1920,
  });

  assert.equal(args[args.indexOf("-vf") + 1], "scale=1920:-2");
  assert.ok(args.includes("-n"));
});

test("hardware encoder selection prefers VideoToolbox on mac-like capabilities", () => {
  const encoder = chooseVideoEncoder(
    "h264",
    {
      h264VideoToolbox: true,
      hevcVideoToolbox: true,
      h264Nvenc: false,
      hevcNvenc: false,
      h264Qsv: false,
      hevcQsv: false,
    },
    "auto",
  );
  assert.equal(encoder, "h264_videotoolbox");
});

test("hardware acceleration can be disabled", () => {
  const encoder = chooseVideoEncoder(
    "hevc",
    {
      h264VideoToolbox: true,
      hevcVideoToolbox: true,
      h264Nvenc: false,
      hevcNvenc: false,
      h264Qsv: false,
      hevcQsv: false,
    },
    "off",
  );
  assert.equal(encoder, "libx265");
});

test("progress parser converts microseconds to seconds", () => {
  const state = {};
  parseProgressLine("out_time_us=7150000", state);
  parseProgressLine("speed=2.3x", state);
  parseProgressLine("progress=end", state);

  assert.equal(state.outTimeSec, 7.15);
  assert.equal(state.speed, "2.3x");
  assert.equal(state.finished, true);
});

test(
  "external symlink targets are rejected when external paths are disabled",
  { skip: process.platform === "win32" },
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), "local-video-tools-root-"));
    const outside = await mkdtemp(join(tmpdir(), "local-video-tools-outside-"));
    t.after(async () => {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(outside, { recursive: true, force: true }),
      ]);
    });

    const outsideVideo = join(outside, "private.mp4");
    await writeFile(outsideVideo, "not actually a video", "utf8");
    await symlink(outsideVideo, join(root, "linked.mp4"));

    await assert.rejects(
      resolveExistingFilePath("linked.mp4", root, false),
      /Symlinked inputs must resolve inside/,
    );
    assert.equal(
      await resolveExistingFilePath("linked.mp4", root, true),
      await realpath(outsideVideo),
    );
  },
);

test(
  "runtime directories reject symlinked path segments before writing outside",
  { skip: process.platform === "win32" },
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), "local-video-tools-root-"));
    const outside = await mkdtemp(join(tmpdir(), "local-video-tools-outside-"));
    t.after(async () => {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(outside, { recursive: true, force: true }),
      ]);
    });

    await symlink(outside, join(root, "local-video-tools"));
    await assert.rejects(
      ensureDirectoryInside(root, "local-video-tools/outputs", "unsafe output directory"),
      /unsafe output directory/,
    );
    await assert.rejects(access(join(outside, "outputs")), { code: "ENOENT" });
  },
);

test("malformed persisted jobs cannot escape the jobs directory", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "local-video-tools-jobs-"));
  const jobsDirectory = join(root, "jobs");
  const escapedPath = join(root, "escaped-job.json");
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(jobsDirectory);

  const maliciousJob = {
    id: "../escaped-job",
    type: "convert",
    status: "running",
    inputPath: "/tmp/input.mp4",
    outputPath: "/tmp/output.mp4",
    command: "ffmpeg",
    args: [],
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
  };
  await writeFile(
    join(jobsDirectory, "malicious.json"),
    `${JSON.stringify(maliciousJob)}\n`,
    "utf8",
  );

  const manager = new JobManager(jobsDirectory);
  await manager.initialize();

  assert.equal(manager.get(maliciousJob.id), undefined);
  await assert.rejects(access(escapedPath), { code: "ENOENT" });
});

test("completed jobs persist processed and total duration atomically", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "local-video-tools-job-progress-"));
  const jobsDirectory = join(root, "jobs");
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const manager = new JobManager(jobsDirectory);
  await manager.initialize();
  const started = await manager.start({
    type: "convert",
    inputPath: "/tmp/input.mp4",
    outputPath: "/tmp/output.mp4",
    command: process.execPath,
    args: [
      "-e",
      'process.stdout.write("out_time_us=1000000\\nspeed=2x\\nprogress=end\\n")',
    ],
    durationSec: 1,
    timeoutMs: 2000,
  });

  let completed = manager.get(started.id);
  for (let attempt = 0; attempt < 100 && completed?.status === "running"; attempt += 1) {
    await delay(10);
    completed = manager.get(started.id);
  }

  assert.equal(completed?.status, "completed");
  assert.equal(completed?.processedSeconds, 1);
  assert.equal(completed?.durationSeconds, 1);
  let persisted;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    persisted = JSON.parse(
      await readFile(join(jobsDirectory, `${started.id}.json`), "utf8"),
    );
    if (persisted.status === "completed") break;
    await delay(10);
  }
  assert.equal(persisted.status, "completed");
  assert.equal(persisted.processedSeconds, 1);
  assert.equal(persisted.durationSeconds, 1);
});
