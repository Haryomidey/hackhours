import { ChronoCollections } from "../storage/chrono.js";
import { getEventsInRange, getSessionsInRange } from "../storage/queries.js";
import { minutesToMs, toDateKey } from "../utils/time.js";

export type Summary = {
  totalTimeMs: number;
  filesEdited: Map<string, number>;
  languages: Map<string, number>;
  projects: Map<string, number>;
  activityByHour: number[];
  activityByHourByLanguage: Map<string, number[]>;
  activityByDay: Map<string, number>;
};

const addToMap = (map: Map<string, number>, key: string, value: number) => {
  map.set(key, (map.get(key) ?? 0) + value);
};

export const buildSummary = async (
  collections: ChronoCollections,
  from: number,
  to: number,
  idleMinutes: number,
): Promise<Summary> => {
  const events = await getEventsInRange(collections, from, to);
  const sessions = await getSessionsInRange(collections, from, to);
  const idleMs = minutesToMs(idleMinutes);
  const now = Date.now();

  const sessionsById = new Map(
    sessions.map((s) => [s.sessionId, s]),
  );
  const eventsBySession = new Map<string, typeof events>();

  for (const event of events) {
    if (!eventsBySession.has(event.sessionId)) {
      eventsBySession.set(event.sessionId, []);
    }
    eventsBySession.get(event.sessionId)?.push(event);
  }

  const summary: Summary = {
    totalTimeMs: 0,
    filesEdited: new Map(),
    languages: new Map(),
    projects: new Map(),
    activityByHour: Array.from({ length: 24 }, () => 0),
    activityByHourByLanguage: new Map(),
    activityByDay: new Map(),
  };

  for (const [sessionId, list] of eventsBySession.entries()) {
    const session = sessionsById.get(sessionId);
    const sessionEnd = session?.endTimestamp ?? now;
    const sorted = [...list].sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < sorted.length; i += 1) {
      const current = sorted[i];
      const next = sorted[i + 1];
      const nextTs = Math.min(next?.timestamp ?? sessionEnd, to);
      const duration = Math.max(
        0,
        Math.min(nextTs - current.timestamp, idleMs),
      );
      if (duration <= 0) continue;

      summary.totalTimeMs += duration;
      addToMap(summary.languages, current.language, duration);
      addToMap(summary.projects, current.project, duration);
      addToMap(summary.filesEdited, current.filePath, duration);

      const eventDate = new Date(current.timestamp);
      const hour = eventDate.getHours();
      summary.activityByHour[hour] += duration;
      if (!summary.activityByHourByLanguage.has(current.language)) {
        summary.activityByHourByLanguage.set(
          current.language,
          Array.from({ length: 24 }, () => 0),
        );
      }
      summary.activityByHourByLanguage.get(current.language)![hour] += duration;
      addToMap(summary.activityByDay, toDateKey(eventDate), duration);
    }
  }

  return summary;
};
