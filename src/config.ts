import { createConfigSchematics } from "@lmstudio/sdk";

export const configSchematics = createConfigSchematics()
  .field(
    "ffmpegPath",
    "string",
    {
      displayName: "FFmpeg Path",
      subtitle: "Optional absolute path to ffmpeg. Leave blank to auto-detect from PATH and common install locations.",
      placeholder: "/opt/homebrew/bin/ffmpeg",
    },
    "",
  )
  .field(
    "ffprobePath",
    "string",
    {
      displayName: "FFprobe Path",
      subtitle: "Optional absolute path to ffprobe. Leave blank to auto-detect.",
      placeholder: "/opt/homebrew/bin/ffprobe",
    },
    "",
  )
  .field(
    "outputSubdirectory",
    "string",
    {
      displayName: "Output Subdirectory",
      subtitle: "Relative directory inside LM Studio's working directory where generated videos are written.",
      placeholder: "local-video-tools/outputs",
    },
    "local-video-tools/outputs",
  )
  .field(
    "hardwareAcceleration",
    "select",
    {
      displayName: "Hardware Acceleration",
      subtitle: "Auto prefers supported hardware encoders such as Apple VideoToolbox and falls back to CPU encoding.",
      options: [
        { displayName: "Auto", value: "auto" },
        { displayName: "Off", value: "off" },
      ],
    },
    "auto",
  )
  .field(
    "allowExternalPaths",
    "boolean",
    {
      displayName: "Allow External File Paths",
      subtitle: "Allow tools to read videos outside LM Studio's working directory. Disabled by default for safety.",
    },
    false,
  )
  .field(
    "timeoutMs",
    "numeric",
    {
      displayName: "Maximum Job Time",
      subtitle: "Maximum FFmpeg process time in milliseconds for foreground calls and background jobs.",
      min: 1000,
      max: 14400000,
      int: true,
    },
    7200000,
  )
  .build();
