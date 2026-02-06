import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import inquirer from "inquirer";
import {
  DEFAULT_CONFIG_PATH,
  DEFAULT_DATA_DIR,
  DEFAULT_EXCLUDE,
  DEFAULT_IDLE_MINUTES,
} from "./defaults.js";

export type HackHoursConfig = {
  directories: string[];
  idleMinutes: number;
  exclude: string[];
  dataDir: string;
};

export const getDefaultConfig = (): HackHoursConfig => ({
  directories: [process.cwd()],
  idleMinutes: DEFAULT_IDLE_MINUTES,
  exclude: DEFAULT_EXCLUDE,
  dataDir: DEFAULT_DATA_DIR,
});

export const ensureConfigDir = (configPath = DEFAULT_CONFIG_PATH) => {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

export const loadConfig = (configPath = DEFAULT_CONFIG_PATH): HackHoursConfig => {
  if (!fs.existsSync(configPath)) {
    return getDefaultConfig();
  }
  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw) as HackHoursConfig;
  return {
    ...getDefaultConfig(),
    ...parsed,
  };
};

export const saveConfig = (
  config: HackHoursConfig,
  configPath = DEFAULT_CONFIG_PATH,
) => {
  ensureConfigDir(configPath);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
};

export const promptInitConfig = async (): Promise<HackHoursConfig> => {
  const defaultConfig = getDefaultConfig();
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "directories",
      message: "Which directories should HackHours track? (comma-separated)",
      default: defaultConfig.directories.join(", "),
      filter: (input: string) =>
        input
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
    },
    {
      type: "number",
      name: "idleMinutes",
      message: "Idle timeout in minutes",
      default: defaultConfig.idleMinutes,
    },
    {
      type: "input",
      name: "exclude",
      message: "Exclude globs (comma-separated)",
      default: defaultConfig.exclude.join(", "),
      filter: (input: string) =>
        input
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
    },
    {
      type: "input",
      name: "dataDir",
      message: "Data directory",
      default: defaultConfig.dataDir,
      filter: (input: string) => input.trim(),
    },
  ]);

  const expanded = answers.dataDir.replace(/^~\//, `${os.homedir()}/`);
  return {
    directories: answers.directories,
    idleMinutes: answers.idleMinutes,
    exclude: answers.exclude,
    dataDir: expanded,
  };
};