import os from "node:os";
import path from "node:path";

export const DEFAULT_IDLE_MINUTES = 2;

export const DEFAULT_CONFIG_PATH = path.join(
  os.homedir(),
  ".hackhours",
  "config.json",
);

export const DEFAULT_DATA_DIR = path.join(os.homedir(), ".hackhours", "data");

export const DEFAULT_EXCLUDE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/.turbo/**",
  "**/.cache/**",
  "**/.idea/**",
  "**/.vscode/**",
  "**/*.log",
];
