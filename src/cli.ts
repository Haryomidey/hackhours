#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import * as asciichart from "asciichart";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import {
  loadConfig,
  promptInitConfig,
  saveConfig,
} from "./config/config.js";
import { openChrono } from "./storage/chrono.js";
import { buildSummary } from "./analytics/queries.js";
import { runWatcher } from "./tracker/watcher.js";
import { readState, writeState, clearState } from "./utils/state.js";
import { endOfDay, formatDuration, parseDateKey, startOfDay } from "./utils/time.js";

const program = new Command();

const formatBar = (value: number, total: number, size = 16) => {
  if (total <= 0) return " ".repeat(size);
  const filled = Math.round((value / total) * size);
  return `${"█".repeat(filled)}${" ".repeat(size - filled)}`;
};

const printSummary = (title: string, summary: Awaited<ReturnType<typeof buildSummary>>) => {
  const total = summary.totalTimeMs;
  console.log(chalk.bold(`\n${title}`));
  console.log(`${chalk.cyan("Total:")} ${formatDuration(total)}`);
  console.log(`${chalk.cyan("Files edited:")} ${summary.filesEdited.size}`);

  const langEntries = [...summary.languages.entries()].sort((a, b) => b[1] - a[1]);
  if (langEntries.length > 0) {
    console.log(`\n${chalk.cyan("Languages")}`);
    const langTable = new Table({
      head: ["Language", "Time", "%"],
    });
    for (const [lang, duration] of langEntries) {
      langTable.push([lang, formatDuration(duration), `${Math.round((duration / total) * 100)}%`]);
    }
    console.log(langTable.toString());
  }

  console.log(`\n${chalk.cyan("Activity")}`);
  const series = summary.activityByHour.map((ms) => Math.round(ms / 60000));
  if (series.some((v) => v > 0)) {
    console.log(asciichart.plot(series, { height: 8 }));
  } else {
    console.log("No activity recorded.");
  }
};

const printBreakdown = (title: string, map: Map<string, number>, total: number) => {
  console.log(chalk.bold(`\n${title}`));
  const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    console.log("No activity recorded.");
    return;
  }
  const table = new Table({ head: ["Name", "Time", "%", ""] });
  for (const [name, duration] of entries) {
    const percent = total > 0 ? duration / total : 0;
    table.push([name, formatDuration(duration), `${Math.round(percent * 100)}%`, formatBar(duration, total)]);
  }
  console.log(table.toString());
};

const parseRange = (from?: string, to?: string) => {
  if (!from || !to) {
    throw new Error("Both --from and --to are required.");
  }
  const fromDate = startOfDay(parseDateKey(from));
  const toDate = endOfDay(parseDateKey(to));
  return { from: fromDate.getTime(), to: toDate.getTime() };
};

program
  .name("hackhours")
  .description("Offline local-first coding activity tracker")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize HackHours configuration")
  .action(async () => {
    const config = await promptInitConfig();
    saveConfig(config);
    console.log(chalk.green("Saved configuration to ~/.hackhours/config.json"));
  });

program
  .command("start")
  .description("Start background tracking")
  .action(async () => {
    const existing = readState();
    if (existing) {
      try {
        process.kill(existing.pid, 0);
        console.log(chalk.yellow("HackHours is already running."));
        return;
      } catch {
        clearState();
      }
    }

    const node = process.execPath;
    const cli = path.resolve(process.argv[1]);
    const child = spawn(node, [cli, "daemon"], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    writeState({ pid: child.pid ?? 0, startedAt: Date.now() });
    console.log(chalk.green("HackHours tracking started."));
  });

program
  .command("stop")
  .description("Stop background tracking")
  .action(() => {
    const state = readState();
    if (!state) {
      console.log(chalk.yellow("HackHours is not running."));
      return;
    }
    try {
      process.kill(state.pid);
      clearState();
      console.log(chalk.green("HackHours tracking stopped."));
    } catch {
      clearState();
      console.log(chalk.yellow("HackHours was not running."));
    }
  });

program
  .command("daemon")
  .description("Run watcher in foreground (internal)")
  .action(async () => {
    const config = loadConfig();
    const { collections } = await openChrono(config.dataDir);
    const watcher = await runWatcher(config, collections);
    const shutdown = async () => {
      await watcher.stop();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });

program
  .command("today")
  .description("Show today's summary")
  .action(async () => {
    const config = loadConfig();
    const { collections } = await openChrono(config.dataDir);
    const now = new Date();
    const from = startOfDay(now).getTime();
    const to = endOfDay(now).getTime();
    const summary = await buildSummary(collections, from, to, config.idleMinutes);
    printSummary("HackHours – Today", summary);
  });

program
  .command("week")
  .description("Show weekly summary")
  .action(async () => {
    const config = loadConfig();
    const { collections } = await openChrono(config.dataDir);
    const now = new Date();
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - 6);
    const from = startOfDay(fromDate).getTime();
    const to = endOfDay(now).getTime();
    const summary = await buildSummary(collections, from, to, config.idleMinutes);
    printSummary("HackHours – Last 7 Days", summary);
  });

program
  .command("month")
  .description("Show monthly summary")
  .action(async () => {
    const config = loadConfig();
    const { collections } = await openChrono(config.dataDir);
    const now = new Date();
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - 29);
    const from = startOfDay(fromDate).getTime();
    const to = endOfDay(now).getTime();
    const summary = await buildSummary(collections, from, to, config.idleMinutes);
    printSummary("HackHours – Last 30 Days", summary);
  });

program
  .command("stats")
  .description("Custom stats for a given range")
  .requiredOption("--from <date>", "Start date (YYYY-MM-DD)")
  .requiredOption("--to <date>", "End date (YYYY-MM-DD)")
  .action(async (options: { from: string; to: string }) => {
    const config = loadConfig();
    const { collections } = await openChrono(config.dataDir);
    const range = parseRange(options.from, options.to);
    const summary = await buildSummary(collections, range.from, range.to, config.idleMinutes);
    printSummary(`HackHours – ${options.from} to ${options.to}`, summary);
  });

program
  .command("languages")
  .description("Language breakdown")
  .option("--from <date>", "Start date (YYYY-MM-DD)")
  .option("--to <date>", "End date (YYYY-MM-DD)")
  .action(async (options: { from?: string; to?: string }) => {
    const config = loadConfig();
    const { collections } = await openChrono(config.dataDir);
    let from: number;
    let to: number;
    if (options.from && options.to) {
      const range = parseRange(options.from, options.to);
      from = range.from;
      to = range.to;
    } else {
      const now = new Date();
      const fromDate = new Date(now);
      fromDate.setDate(fromDate.getDate() - 6);
      from = startOfDay(fromDate).getTime();
      to = endOfDay(now).getTime();
    }
    const summary = await buildSummary(collections, from, to, config.idleMinutes);
    printBreakdown("Languages", summary.languages, summary.totalTimeMs);
  });

program
  .command("projects")
  .description("Project breakdown")
  .option("--from <date>", "Start date (YYYY-MM-DD)")
  .option("--to <date>", "End date (YYYY-MM-DD)")
  .action(async (options: { from?: string; to?: string }) => {
    const config = loadConfig();
    const { collections } = await openChrono(config.dataDir);
    let from: number;
    let to: number;
    if (options.from && options.to) {
      const range = parseRange(options.from, options.to);
      from = range.from;
      to = range.to;
    } else {
      const now = new Date();
      const fromDate = new Date(now);
      fromDate.setDate(fromDate.getDate() - 6);
      from = startOfDay(fromDate).getTime();
      to = endOfDay(now).getTime();
    }
    const summary = await buildSummary(collections, from, to, config.idleMinutes);
    printBreakdown("Projects", summary.projects, summary.totalTimeMs);
  });

program
  .command("files")
  .description("File breakdown (top 10)")
  .option("--from <date>", "Start date (YYYY-MM-DD)")
  .option("--to <date>", "End date (YYYY-MM-DD)")
  .action(async (options: { from?: string; to?: string }) => {
    const config = loadConfig();
    const { collections } = await openChrono(config.dataDir);
    let from: number;
    let to: number;
    if (options.from && options.to) {
      const range = parseRange(options.from, options.to);
      from = range.from;
      to = range.to;
    } else {
      const now = new Date();
      const fromDate = new Date(now);
      fromDate.setDate(fromDate.getDate() - 6);
      from = startOfDay(fromDate).getTime();
      to = endOfDay(now).getTime();
    }
    const summary = await buildSummary(collections, from, to, config.idleMinutes);
    const top = [...summary.filesEdited.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const total = summary.totalTimeMs;
    const table = new Table({ head: ["File", "Time", "%"] });
    for (const [file, duration] of top) {
      table.push([file, formatDuration(duration), `${Math.round((duration / total) * 100)}%`]);
    }
    console.log(table.toString());
  });

program.parseAsync(process.argv);
