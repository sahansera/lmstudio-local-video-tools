const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildClipArgs,
  buildConvertArgs,
  chooseVideoEncoder,
  parseProgressLine,
} = require("../dist/ffmpeg.js");

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
