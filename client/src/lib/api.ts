import type { MeSnapshot } from "../../../server/game/me.ts";
import type { Notice } from "../../../server/game/context.ts";

export type { MeSnapshot, Notice };
/** A snapshot for a signed-in player who has created a hero. */
export type HeroSnap = Extract<MeSnapshot, { badges: unknown }>;
export type Hero = NonNullable<HeroSnap["hero"]>;
export type Badges = HeroSnap["badges"];

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Mutations respond with the result, notices to show, and fresh shell state. */
export interface Mutation<T> {
  result: T;
  notices: Notice[];
  me: MeSnapshot;
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(method === "POST" ? { "Content-Type": "application/json", "X-DTE-Request": "1" } : {}),
      },
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
    });
  } catch {
    throw new ApiError(0, "offline", "You're offline. Reconnect to keep playing.");
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON (proxy error pages etc.)
  }
  if (!res.ok) {
    const err = (data as { error?: { code: string; message: string; details?: Record<string, unknown> } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "http_error", err?.message ?? `Request failed (${res.status}).`, err?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  upload: async <T>(path: string, form: FormData): Promise<T> => {
    const res = await fetch(path, { method: "POST", body: form, credentials: "same-origin", headers: { "X-DTE-Request": "1" } });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? "http_error", data?.error?.message ?? "Upload failed.");
    return data as T;
  },
};

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong.");
