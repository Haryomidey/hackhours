import { ChronoCollections, EventDoc, SessionDoc } from "./chrono";

export const getSessionsInRange = async (
  collections: ChronoCollections,
  from: number,
  to: number,
): Promise<SessionDoc[]> => {
  const all = (await collections.sessions.getAll()) as SessionDoc[];
  return all.filter((s) => {
    const end = s.endTimestamp ?? s.startTimestamp;
    return s.startTimestamp <= to && end >= from;
  });
};

export const getEventsInRange = async (
  collections: ChronoCollections,
  from: number,
  to: number,
): Promise<EventDoc[]> => {
  const all = (await collections.events.getAll()) as EventDoc[];
  return all.filter((e) => e.timestamp >= from && e.timestamp <= to);
};

export const getAggregateByDate = async (
  collections: ChronoCollections,
  date: string,
) => {
  return collections.aggregates.getOne({ date });
};
