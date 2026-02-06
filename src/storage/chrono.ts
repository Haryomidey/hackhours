import fs from "node:fs";
import ChronoDB from "chronodb";
import {
  aggregateSchema,
  eventSchema,
  sessionSchema,
  AggregateDoc,
  EventDoc,
  SessionDoc,
} from "./schema";

export type ChronoCollections = {
  sessions: any;
  events: any;
  aggregates: any;
};

export const openChrono = async (dataDir: string) => {
  fs.mkdirSync(dataDir, { recursive: true });

  let db: any;
  try {
    db = await (ChronoDB as any).open({ path: dataDir, cloudSync: false });
  } catch (error) {
    const prev = process.cwd();
    process.chdir(dataDir);
    try {
      db = await (ChronoDB as any).open({ cloudSync: false });
    } catch (inner) {
      process.chdir(prev);
      throw inner;
    }
  }

  const sessions = db.col("sessions", {
    schema: sessionSchema,
    indexes: ["sessionId", "startTimestamp", "endTimestamp"],
  });

  const events = db.col("events", {
    schema: eventSchema,
    indexes: ["timestamp", "language", "project", "sessionId"],
  });

  const aggregates = db.col("aggregates", {
    schema: aggregateSchema,
    indexes: ["date"],
  });

  return {
    db,
    collections: { sessions, events, aggregates } as ChronoCollections,
  };
};

export type { AggregateDoc, EventDoc, SessionDoc };