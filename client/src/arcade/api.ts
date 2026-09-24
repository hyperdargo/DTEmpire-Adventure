/**
 * Arcade API client.
 *
 * Same-origin fetch against the existing Fastify API, so the session cookie,
 * CSRF origin check and rate limits all apply unchanged — the arcade client is
 * just another front end over the identical save data as the web app.
 */

export interface Combatant {
  name: string; icon: string; level: number;
  maxHp: number; hp: number; atk: number; def: number; spd: number;
  crit: number; effects: { kind: string; turns: number; value: number }[];
  skills: { id: string; rank: number; cd: number }[];
  isBoss?: boolean; charging?: boolean; classId?: string;
}

export type BattleActor = "player" | "enemy" | "pet";

export type BattleEvent =
  | { t: "turn"; n: number }
  | { t: "action"; by: BattleActor; label: string; icon?: string }
  | { t: "hit"; by: BattleActor; target: BattleActor; dmg: number; crit: boolean; absorbed?: number }
  | { t: "miss"; by: BattleActor; target: BattleActor }
  | { t: "heal"; target: BattleActor; amount: number; source: string }
  | { t: "effect"; target: BattleActor; kind: string; turns: number }
  | { t: "dot"; target: BattleActor; dmg: number; kind: "burn" }
  | { t: "stunned"; target: BattleActor }
  | { t: "telegraph"; by: BattleActor; text: string }
  | { t: "flee"; ok: boolean }
  | { t: "end"; result: "won" | "lost" | "fled" | "timeout" };

export interface BattleState {
  turn: number;
  status: "active" | "won" | "lost" | "fled" | "timeout";
  player: Combatant;
  enemy: Combatant;
  pet?: { name: string; icon: string; power: number; every: number };
  canFlee: boolean;
  maxTurns: number;
  events: BattleEvent[];
}

export interface Battle {
  id: string;
  kind: string;
  context: Record<string, unknown>;
  state: BattleState;
}

export interface Hero {
  name: string; level: number; xp: number; xpNext?: number;
  coins: number; gems?: number; hp: number; maxHp: number;
  classId?: string; className?: string; energy?: number; maxEnergy?: number;
  settings?: { graphicsQuality?: "low" | "medium" | "high" };
}

export interface Me { user: { id: number; name: string } | null; hero: Hero | null }

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? { accept: "application/json" } : { accept: "application/json", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "http_error", err?.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
};

export const gameApi = {
  me: () => api.get<Me>("/api/me"),
  version: () => api.get<{ version: string; builtAt?: string }>("/api/version"),
  activeBattle: () => api.get<{ battle: Battle | null }>("/api/battle"),
  adventure: () => api.get<Record<string, unknown>>("/api/adventure"),
  startAdventure: (zoneId?: string) => api.post<{ battle?: Battle }>("/api/adventure/start", zoneId ? { zoneId } : {}),
  act: (battleId: string, action: unknown) =>
    api.post<{ battle: Battle; rounds?: unknown[]; outcome: unknown; notices?: unknown[]; me?: Me }>(`/api/battle/${battleId}/act`, { action }),
  auto: (battleId: string, usePotions = false) =>
    api.post<{ battle: Battle; outcome: unknown; notices?: unknown[]; me?: Me }>(`/api/battle/${battleId}/auto`, { usePotions }),
  forfeit: (battleId: string) => api.post<{ battle: Battle; outcome: unknown }>(`/api/battle/${battleId}/forfeit`, {}),
  saveGraphics: (graphicsQuality: "low" | "medium" | "high") => api.post("/api/settings", { graphicsQuality }),
  guest: () => api.post<{ user: unknown }>("/api/auth/guest", {}),
  login: (username: string, password: string) => api.post<{ user: unknown }>("/api/auth/login", { username, password }),
};
