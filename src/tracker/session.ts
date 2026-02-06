import crypto from "node:crypto";
import path from "node:path";
import { HackHoursConfig } from "../config/config.js";
import { ChronoCollections } from "../storage/chrono.js";
import { detectLanguage } from "../utils/language.js";
import { resolveProjectRoot } from "../utils/project.js";
import { minutesToMs, toDateKey } from "../utils/time.js";

type ActiveSession = {
  sessionId: string;
  startTimestamp: number;
  lastActivity: number;
};

export class SessionManager {
  private active: ActiveSession | null = null;
  private idleMs: number;
  private config: HackHoursConfig;
  private collections: ChronoCollections;

  constructor(config: HackHoursConfig, collections: ChronoCollections) {
    this.config = config;
    this.collections = collections;
    this.idleMs = minutesToMs(config.idleMinutes);
  }

  async handleActivity(filePath: string) {
    const now = Date.now();
    if (!this.active) {
      this.active = await this.startSession(now);
    }
    this.active.lastActivity = now;

    const language = detectLanguage(filePath);
    const projectRoot = resolveProjectRoot(filePath, this.config.directories);

    await this.collections.events.add({
      timestamp: now,
      filePath: path.resolve(filePath),
      language,
      project: projectRoot,
      sessionId: this.active.sessionId,
    });
  }

  async checkIdle() {
    if (!this.active) return;
    const now = Date.now();
    if (now - this.active.lastActivity > this.idleMs) {
      await this.endSession(this.active, this.active.lastActivity);
      this.active = null;
    }
  }

  async stop() {
    if (!this.active) return;
    await this.endSession(this.active, this.active.lastActivity);
    this.active = null;
  }

  private async startSession(startTimestamp: number): Promise<ActiveSession> {
    const sessionId = crypto.randomUUID();
    await this.collections.sessions.add({
      sessionId,
      startTimestamp,
      endTimestamp: null,
      durationMs: 0,
    });
    return {
      sessionId,
      startTimestamp,
      lastActivity: startTimestamp,
    };
  }

  private async endSession(session: ActiveSession, endTimestamp: number) {
    const durationMs = Math.max(0, endTimestamp - session.startTimestamp);
    await this.collections.sessions.updateMany(
      { sessionId: session.sessionId },
      {
        endTimestamp,
        durationMs,
      },
    );

    const dateKey = toDateKey(new Date(endTimestamp));
    const existing = await this.collections.aggregates.getOne({ date: dateKey });
    if (!existing) {
      await this.collections.aggregates.add({
        date: dateKey,
        totalTimeMs: durationMs,
        filesEdited: "[]",
        languagesUsed: "[]",
      });
    } else {
      await this.collections.aggregates.updateMany(
        { date: dateKey },
        { totalTimeMs: (existing.totalTimeMs ?? 0) + durationMs },
      );
    }
  }
}