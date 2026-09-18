import type { Config } from "../config.ts";
import type { Db } from "../db/db.ts";
import type { Clock } from "../lib/time.ts";

export type ServerEvent = { type: string; [key: string]: unknown };

export interface Hub {
  toUser(userId: number, event: ServerEvent): void;
  toChannel(channel: string, event: ServerEvent): void;
  isOnline(userId: number): boolean;
  onlineCount(): number;
}

export const nullHub: Hub = { toUser() {}, toChannel() {}, isOnline: () => false, onlineCount: () => 0 };

export interface GameCtx {
  db: Db;
  clock: Clock;
  hub: Hub;
  config: Config;
  log: { info(obj: unknown, msg?: string): void; warn(obj: unknown, msg?: string): void; error(obj: unknown, msg?: string): void };
}

/** Something the player should be told about (toast, level-up banner, loot reveal). */
export type Notice =
  | { kind: "levelUp"; level: number }
  | { kind: "achievement"; id: string; name: string; icon: string; coins: number; title?: string }
  | { kind: "mastery"; monster: string; rank: string; coins: number }
  | { kind: "egg"; name: string }
  | { kind: "toast"; tone: "info" | "good" | "warn"; text: string; icon?: string };
