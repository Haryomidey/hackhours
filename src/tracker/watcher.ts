import chokidar from "chokidar";
import { HackHoursConfig } from "../config/config";
import { ChronoCollections } from "../storage/chrono";
import { SessionManager } from "./session";

export type WatcherHandle = {
  stop: () => Promise<void>;
};

export const runWatcher = async (
  config: HackHoursConfig,
  collections: ChronoCollections,
): Promise<WatcherHandle> => {
  const sessionManager = new SessionManager(config, collections);
  const watcher = chokidar.watch(config.directories, {
    ignored: config.exclude,
    ignoreInitial: true,
    persistent: true,
  });

  const onActivity = (filePath: string) => {
    sessionManager.handleActivity(filePath).catch(() => undefined);
  };

  watcher.on("add", onActivity);
  watcher.on("change", onActivity);

  const interval = setInterval(() => {
    sessionManager.checkIdle().catch(() => undefined);
  }, 10000);

  return {
    stop: async () => {
      clearInterval(interval);
      await watcher.close();
      await sessionManager.stop();
    },
  };
};
