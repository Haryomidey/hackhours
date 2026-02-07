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
import { endOfDay, formatDuration, parseDateKey, startOfDay, toDateKey } from "./utils/time.js";

const program = new Command();

const formatBar = (value: number, total: number, size = 16) => {
  if (total <= 0) return " ".repeat(size);
  const filled = Math.round((value / total) * size);
  return `${"█".repeat(filled)}${" ".repeat(size - filled)}`;
};

const chartColors: asciichart.Color[] = [
  asciichart.blue,
  asciichart.green,
  asciichart.red,
  asciichart.cyan,
  asciichart.magenta,
  asciichart.yellow,
  asciichart.lightblue,
  asciichart.lightgreen,
  asciichart.lightred,
];

type LegendColor = (value: string) => string;
const legendColors: LegendColor[] = [
  chalk.blue,
  chalk.green,
  chalk.red,
  chalk.cyan,
  chalk.magenta,
  chalk.yellow,
  chalk.blueBright,
  chalk.greenBright,
  chalk.redBright,
];

const printLanguageActivity = (summary: Awaited<ReturnType<typeof buildSummary>>) => {
  const entries = [...summary.activityByHourByLanguage.entries()]
    .filter(([, series]) => series.some((v) => v > 0))
    .sort((a, b) => (summary.languages.get(b[0]) ?? 0) - (summary.languages.get(a[0]) ?? 0));

  if (entries.length === 0) {
    console.log("No activity recorded.");
    return;
  }

  const series = entries.map(([, hours]) => hours.map((ms) => Math.round(ms / 60000)));
  const colors = entries.map((_, idx) => chartColors[idx % chartColors.length]);
  console.log(asciichart.plot(series, { height: 8, colors }));

  const legend = entries
    .map(([lang], idx) => {
      const colorize = legendColors[idx % legendColors.length];
      const swatch = colorize ? colorize("■") : "■";
      return `${swatch} ${lang}`;
    })
    .join("  ");
  console.log(legend);
};

const buildHistoryGrid = (summary: Awaited<ReturnType<typeof buildSummary>>, weeks: number) => {
  const levels = [" ", "░", "▒", "▓", "█"];
  const now = new Date();
  const end = endOfDay(now);
  const start = startOfDay(new Date(end));
  start.setDate(start.getDate() - (weeks * 7 - 1));
  start.setDate(start.getDate() - start.getDay());

  const dayCount = weeks * 7;
  const days: Date[] = [];
  for (let i = 0; i < dayCount; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }

  const values = days.map((d) => summary.activityByDay.get(toDateKey(d)) ?? 0);
  const max = Math.max(0, ...values);

  const grid: string[][] = Array.from({ length: 7 }, () => Array.from({ length: weeks }, () => " "));
  for (let i = 0; i < dayCount; i += 1) {
    const week = Math.floor(i / 7);
    const day = i % 7;
    const value = values[i];
    let level = 0;
    if (value > 0 && max > 0) {
      level = Math.max(1, Math.round((value / max) * (levels.length - 1)));
    }
    grid[day][week] = levels[level];
  }

  return grid;
};

const printHistory = (summary: Awaited<ReturnType<typeof buildSummary>>, weeks: number) => {
  console.log(chalk.cyan("History"));
  const grid = buildHistoryGrid(summary, weeks);
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let row = 0; row < grid.length; row += 1) {
    console.log(`${labels[row]} ${grid[row].join(" ")}`);
  }
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
  printLanguageActivity(summary);
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

const topEntry = (map: Map<string, number>): [string, number] | null => {
  let best: [string, number] | null = null;
  for (const entry of map.entries()) {
    if (!best || entry[1] > best[1]) {
      best = entry;
    }
  }
  return best;
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
  .command("status")
  .description("Show tracker status and recent activity")
  .action(async () => {
    const state = readState();
    let running = false;
    if (state) {
      try {
        process.kill(state.pid, 0);
        running = true;
      } catch {
        clearState();
      }
    }

    const config = loadConfig();
    const { collections } = await openChrono(config.dataDir);
    const now = new Date();
    const todayFrom = startOfDay(now).getTime();
    const todayTo = endOfDay(now).getTime();
    const weekFromDate = new Date(now);
    weekFromDate.setDate(weekFromDate.getDate() - 6);
    const weekFrom = startOfDay(weekFromDate).getTime();
    const weekTo = endOfDay(now).getTime();

    const [todaySummary, weekSummary] = await Promise.all([
      buildSummary(collections, todayFrom, todayTo, config.idleMinutes),
      buildSummary(collections, weekFrom, weekTo, config.idleMinutes),
    ]);

    console.log(chalk.bold("\nHackHours Status"));
    console.log(`${chalk.cyan("Running:")} ${running ? chalk.green("Yes") : chalk.red("No")}`);
    if (running && state) {
      const startedAt = new Date(state.startedAt);
      const uptime = Math.max(0, Date.now() - state.startedAt);
      console.log(`${chalk.cyan("PID:")} ${state.pid}`);
      console.log(`${chalk.cyan("Started:")} ${startedAt.toLocaleString()}`);
      console.log(`${chalk.cyan("Uptime:")} ${formatDuration(uptime)}`);
    }

    console.log(`\n${chalk.cyan("Today:")} ${formatDuration(todaySummary.totalTimeMs)}`);
    const todayTopProject = topEntry(todaySummary.projects);
    if (todayTopProject) {
      console.log(`${chalk.cyan("Top project (today):")} ${todayTopProject[0]} (${formatDuration(todayTopProject[1])})`);
    }
    const todayTopLang = topEntry(todaySummary.languages);
    if (todayTopLang) {
      console.log(`${chalk.cyan("Top language (today):")} ${todayTopLang[0]} (${formatDuration(todayTopLang[1])})`);
    }

    console.log(`\n${chalk.cyan("Last 7 days:")} ${formatDuration(weekSummary.totalTimeMs)}`);
    const weekTopProject = topEntry(weekSummary.projects);
    if (weekTopProject) {
      console.log(`${chalk.cyan("Top project (7 days):")} ${weekTopProject[0]} (${formatDuration(weekTopProject[1])})`);
    }
    const weekTopLang = topEntry(weekSummary.languages);
    if (weekTopLang) {
      console.log(`${chalk.cyan("Top language (7 days):")} ${weekTopLang[0]} (${formatDuration(weekTopLang[1])})`);
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
  .command("history")
  .description("Activity heatmap history")
  .option("--weeks <count>", "Number of weeks (default 12)", "12")
  .action(async (options: { weeks: string }) => {
    const weeks = Math.max(1, Number(options.weeks) || 12);
    const config = loadConfig();
    const { collections } = await openChrono(config.dataDir);
    const now = new Date();
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - (weeks * 7 - 1));
    const from = startOfDay(fromDate).getTime();
    const to = endOfDay(now).getTime();
    const summary = await buildSummary(collections, from, to, config.idleMinutes);
    console.log(chalk.bold(`\nHackHours History (${weeks} weeks)`));
    printHistory(summary, weeks);
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
