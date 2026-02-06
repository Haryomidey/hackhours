export type SessionDoc = {
  sessionId: string;
  startTimestamp: number;
  endTimestamp: number | null;
  durationMs: number;
};

export type EventDoc = {
  timestamp: number;
  filePath: string;
  language: string;
  project: string;
  sessionId: string;
};

export type AggregateDoc = {
  date: string;
  totalTimeMs: number;
  filesEdited: string;
  languagesUsed: string;
};

export const sessionSchema = {
  sessionId: { type: "string", distinct: true },
  startTimestamp: { type: "number", important: true },
  endTimestamp: { type: "number", nullable: true },
  durationMs: { type: "number", default: 0 },
};

export const eventSchema = {
  timestamp: { type: "number", important: true },
  filePath: { type: "string", important: true },
  language: { type: "string", important: true },
  project: { type: "string", important: true },
  sessionId: { type: "string", important: true },
};

export const aggregateSchema = {
  date: { type: "string", distinct: true },
  totalTimeMs: { type: "number", default: 0 },
  filesEdited: { type: "string", default: "[]" },
  languagesUsed: { type: "string", default: "[]" },
};
