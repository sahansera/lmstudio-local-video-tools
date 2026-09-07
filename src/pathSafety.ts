import { lstat, mkdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

export function isPathInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export async function canonicalizeWorkingDirectory(workingDirectory: string): Promise<string> {
  return await realpath(resolve(workingDirectory));
}

export async function resolveExistingFilePath(
  input: string,
  workingDirectory: string,
  allowExternalPaths: boolean,
): Promise<string> {
  const canonicalWorkingDirectory = await canonicalizeWorkingDirectory(workingDirectory);
  const requestedPath = isAbsolute(input)
    ? resolve(input)
    : resolve(canonicalWorkingDirectory, input);

  if (!allowExternalPaths && !isPathInside(canonicalWorkingDirectory, requestedPath)) {
    throw new Error(
      "External file paths are disabled. Move the video into LM Studio's working directory or enable Allow External File Paths in plugin settings.",
    );
  }

  let canonicalPath: string;
  try {
    canonicalPath = await realpath(requestedPath);
  } catch {
    throw new Error(`Video file does not exist: ${requestedPath}`);
  }

  if (!allowExternalPaths && !isPathInside(canonicalWorkingDirectory, canonicalPath)) {
    throw new Error(
      "External file paths are disabled. Symlinked inputs must resolve inside LM Studio's working directory or Allow External File Paths must be enabled.",
    );
  }

  const info = await stat(canonicalPath).catch(() => null);
  if (!info?.isFile()) throw new Error(`Video file does not exist: ${canonicalPath}`);
  return canonicalPath;
}

export async function ensureDirectoryInside(
  workingDirectory: string,
  subdirectory: string,
  boundaryError: string,
): Promise<string> {
  const canonicalWorkingDirectory = await canonicalizeWorkingDirectory(workingDirectory);
  const requestedDirectory = resolve(canonicalWorkingDirectory, subdirectory);

  if (!isPathInside(canonicalWorkingDirectory, requestedDirectory)) {
    throw new Error(boundaryError);
  }

  const relativeDirectory = relative(canonicalWorkingDirectory, requestedDirectory);
  let currentDirectory = canonicalWorkingDirectory;

  for (const segment of relativeDirectory.split(/[\\/]+/).filter(Boolean)) {
    currentDirectory = resolve(currentDirectory, segment);
    await mkdir(currentDirectory).catch((error: unknown) => {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    });

    const info = await lstat(currentDirectory);
    if (info.isSymbolicLink()) throw new Error(boundaryError);
    if (!info.isDirectory()) {
      throw new Error(`Expected a directory but found another file type: ${currentDirectory}`);
    }
  }

  const canonicalDirectory = await realpath(requestedDirectory);
  if (!isPathInside(canonicalWorkingDirectory, canonicalDirectory)) {
    throw new Error(boundaryError);
  }
  return canonicalDirectory;
}
