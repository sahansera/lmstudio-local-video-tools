import { randomUUID } from "node:crypto";
import { copyFile, mkdir } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import { ChatMessage, PromptPreprocessorController } from "@lmstudio/sdk";

const VIDEO_EXTENSIONS = new Set([
  ".3gp",
  ".avi",
  ".flv",
  ".m2ts",
  ".m4v",
  ".mkv",
  ".mov",
  ".mp4",
  ".mpeg",
  ".mpg",
  ".mxf",
  ".ogv",
  ".ts",
  ".vob",
  ".webm",
  ".wmv",
  ".y4m",
]);

function isVideoName(name: string): boolean {
  return VIDEO_EXTENSIONS.has(extname(name).toLowerCase());
}

function safeFileName(name: string): string {
  const extension = extname(name).toLowerCase();
  const stem = basename(name, extname(name))
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "video";
  return `${stem}${extension}`;
}

export async function preprocess(
  ctl: PromptPreprocessorController,
  userMessage: ChatMessage,
): Promise<ChatMessage> {
  const attachedVideos = userMessage
    .getFiles(ctl.client)
    .filter((file) => isVideoName(file.name));

  if (attachedVideos.length === 0) return userMessage;

  const workingDirectory = ctl.getWorkingDirectory();
  const inputDirectory = join(workingDirectory, "local-video-tools", "inputs");
  await mkdir(inputDirectory, { recursive: true });

  const videos = userMessage.consumeFiles(ctl.client, (file) => isVideoName(file.name));
  const staged: string[] = [];

  for (const file of videos) {
    if (ctl.abortSignal.aborted) throw new Error("Video staging was cancelled.");

    const status = ctl.createStatus({
      status: "loading",
      text: `Preparing ${file.name} for Local Video Tools…`,
    });

    try {
      const sourcePath = await file.getFilePath();
      const destination = join(
        inputDirectory,
        `${randomUUID().slice(0, 8)}-${safeFileName(file.name)}`,
      );
      await copyFile(sourcePath, destination);
      const relativePath = relative(workingDirectory, destination).replaceAll("\\", "/");
      staged.push(
        [
          `[Local Video Tools input: ${file.name}]`,
          `path: ${relativePath}`,
          "Use this exact path with inspect_video, clip_video, or convert_video. The video is processed locally on this computer.",
        ].join("\n"),
      );
      status.setState({ status: "done", text: `${file.name} is ready for Local Video Tools.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      status.setState({ status: "error", text: `Could not prepare ${file.name}: ${message}` });
      throw error;
    }
  }

  if (staged.length > 0) {
    userMessage.appendText(`\n\n${staged.join("\n\n")}`);
  }
  return userMessage;
}
