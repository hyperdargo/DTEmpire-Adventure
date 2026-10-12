import type { GameCtx } from "./context.ts";

export type LogKind =
  | "level_up"
  | "achievement"
  | "boss_kill"
  | "rare_drop"
  | "title_earned"
  | "pet_hatched"
  | "tower_clear"
  | "abyss_record"
  | "paragon"
  | "class_ascend"
  | "skill_fused"
  | "milestone";

export function logEvent(
  g: GameCtx,
  userId: number,
  kind: LogKind,
  text: string,
  icon: string,
  meta: Record<string, unknown> = {},
) {
  g.db.run(
    "INSERT INTO logbook (user_id, kind, text, icon, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    userId,
    kind,
    text,
    icon,
    JSON.stringify(meta),
    g.clock.now(),
  );
  // Keep only the last 200 entries per player
  g.db.run(
    "DELETE FROM logbook WHERE user_id = ? AND id NOT IN (SELECT id FROM logbook WHERE user_id = ? ORDER BY created_at DESC LIMIT 200)",
    userId,
    userId,
  );
}

export interface LogEntry {
  id: number;
  kind: LogKind;
  text: string;
  icon: string;
  meta: Record<string, unknown>;
  createdAt: number;
}

export function getLogbook(g: GameCtx, userId: number, limit = 50, before?: number): LogEntry[] {
  const rows = before
    ? g.db.all<{ id: number; kind: string; text: string; icon: string; meta: string; created_at: number }>(
        "SELECT id, kind, text, icon, meta, created_at FROM logbook WHERE user_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?",
        userId,
        before,
        limit,
      )
    : g.db.all<{ id: number; kind: string; text: string; icon: string; meta: string; created_at: number }>(
        "SELECT id, kind, text, icon, meta, created_at FROM logbook WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
        userId,
        limit,
      );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as LogKind,
    text: r.text,
    icon: r.icon,
    meta: JSON.parse(r.meta),
    createdAt: r.created_at,
  }));
}
