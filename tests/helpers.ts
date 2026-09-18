import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { buildApp } from "../server/app.ts";
import { loadConfig } from "../server/config.ts";
import { Db } from "../server/db/db.ts";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface TestClock { now(): number; advance(ms: number): void; set(ms: number): void }

export function testClock(start = Date.UTC(2026, 8, 17, 12, 0, 0)): TestClock {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms), set: (ms) => (t = ms) };
}

export async function makeApp(clock = testClock()) {
  const config = { ...loadConfig({ NODE_ENV: "test", PUBLIC_URL: "http://localhost:8081" }), uploadDir: join(tmpdir(), "dte-test-uploads") };
  const db = new Db(":memory:");
  const app = await buildApp({ config, db, clock, logger: false });
  return { app, db, clock };
}

export class Client {
  cookie = "";
  readonly app: FastifyInstance;
  constructor(app: FastifyInstance) {
    this.app = app;
  }

  async req(method: "GET" | "POST", url: string, body?: unknown, opts: { csrf?: boolean } = {}): Promise<LightMyRequestResponse> {
    const res = await this.app.inject({
      method, url, payload: body as never,
      headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(method === "POST" && opts.csrf !== false ? { "x-dte-request": "1" } : {}) },
    });
    const set = res.headers["set-cookie"];
    const first = Array.isArray(set) ? set[0] : set;
    if (first?.startsWith("dte_session=")) this.cookie = first.split(";")[0]!;
    return res;
  }

  async get<T = any>(url: string): Promise<T> {
    const res = await this.req("GET", url);
    if (res.statusCode >= 400) throw new Error(`GET ${url} → ${res.statusCode}: ${res.body}`);
    return res.json() as T;
  }

  async post<T = any>(url: string, body: unknown = {}): Promise<T> {
    const res = await this.req("POST", url, body);
    if (res.statusCode >= 400) throw new Error(`POST ${url} → ${res.statusCode}: ${res.body}`);
    return res.json() as T;
  }

  async postErr(url: string, body: unknown = {}): Promise<{ status: number; message: string; code: string }> {
    const res = await this.req("POST", url, body);
    const json = res.json() as { error?: { message: string; code: string } };
    return { status: res.statusCode, message: json.error?.message ?? "", code: json.error?.code ?? "" };
  }

  /** Registers and creates a hero. */
  async signup(username: string, password = "correct horse battery") {
    await this.post("/api/auth/register", { username, password });
    return this.post("/api/hero");
  }

  /** Plays the active battle to the end with basic attacks. */
  async finishBattle(battleId: string) {
    let last: any;
    for (let i = 0; i < 60; i++) {
      last = await this.post(`/api/battle/${battleId}/auto`, { usePotions: true });
      if (last.outcome) return last;
    }
    return last;
  }
}
