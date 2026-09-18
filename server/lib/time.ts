export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** UTC calendar day key, e.g. "2026-09-17". Daily systems reset at 00:00 UTC. */
export const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** ISO week key, e.g. "2026-W38". The world boss rotates weekly. */
export function weekKey(ms: number): string {
  const d = new Date(ms);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / DAY + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const nextUtcMidnight = (ms: number) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
};

/** Injectable clock so tests can travel in time. */
export interface Clock { now(): number }
export const systemClock: Clock = { now: () => Date.now() };
