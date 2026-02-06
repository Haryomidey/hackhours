import path from "node:path";

export const resolveProjectRoot = (
  filePath: string,
  directories: string[],
) => {
  const normalized = path.resolve(filePath);
  const match = directories
    .map((dir) => path.resolve(dir))
    .filter((dir) => normalized.startsWith(dir))
    .sort((a, b) => b.length - a.length)[0];

  return match ?? path.dirname(normalized);
};

export const formatProjectName = (projectRoot: string) =>
  path.basename(projectRoot);
