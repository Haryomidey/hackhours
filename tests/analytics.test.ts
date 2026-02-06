import { describe, expect, it } from "vitest";
import { buildSummary } from "../src/analytics/queries.js";

const makeCollections = (sessions: any[], events: any[]) => ({
  sessions: {
    getAll: async () => sessions,
  },
  events: {
    getAll: async () => events,
  },
  aggregates: {
    getOne: async () => null,
  },
});

describe("buildSummary", () => {
  it("computes totals and language breakdown", async () => {
    const start = new Date("2026-02-01T10:00:00Z").getTime();
    const end = new Date("2026-02-01T12:00:00Z").getTime();
    const sessions = [
      {
        sessionId: "s1",
        startTimestamp: start,
        endTimestamp: end,
        durationMs: end - start,
      },
    ];
    const events = [
      { sessionId: "s1", timestamp: start, language: "TypeScript", project: "A", filePath: "a.ts" },
      { sessionId: "s1", timestamp: start + 30 * 60 * 1000, language: "TypeScript", project: "A", filePath: "a.ts" },
      { sessionId: "s1", timestamp: start + 60 * 60 * 1000, language: "JavaScript", project: "A", filePath: "b.js" },
    ];
    const collections = makeCollections(sessions, events);
    const summary = await buildSummary(collections as any, start, end, 90);

    expect(summary.totalTimeMs).toBe(end - start);
    expect(summary.languages.get("TypeScript")).toBeGreaterThan(0);
    expect(summary.languages.get("JavaScript")).toBeGreaterThan(0);
  });
});
