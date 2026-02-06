import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type DaemonState = {
  pid: number;
  startedAt: number;
};

export const statePath = () =>
  path.join(os.homedir(), ".hackhours", "state.json");

export const readState = (): DaemonState | null => {
  const file = statePath();
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf-8");
  return JSON.parse(raw) as DaemonState;
};

export const writeState = (state: DaemonState) => {
  const file = statePath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(file, JSON.stringify(state, null, 2), "utf-8");
};

export const clearState = () => {
  const file = statePath();
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
};
