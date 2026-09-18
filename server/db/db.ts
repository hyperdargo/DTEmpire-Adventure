import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { MIGRATIONS } from "./schema.ts";

export type Row = Record<string, SQLInputValue>;

/**
 * Thin wrapper over node:sqlite. All game mutations run synchronously inside `tx`, and Node runs
 * one request handler at a time between awaits, so a transaction can never interleave with another.
 */
export class Db {
  readonly raw: DatabaseSync;
  #depth = 0;
  #stmts = new Map<string, ReturnType<DatabaseSync["prepare"]>>();

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.raw = new DatabaseSync(path);
    this.raw.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;");
    this.migrate();
  }

  private stmt(sql: string) {
    let s = this.#stmts.get(sql);
    if (!s) {
      s = this.raw.prepare(sql);
      this.#stmts.set(sql, s);
    }
    return s;
  }

  get<T = Row>(sql: string, ...params: SQLInputValue[]): T | undefined {
    return this.stmt(sql).get(...params) as T | undefined;
  }

  all<T = Row>(sql: string, ...params: SQLInputValue[]): T[] {
    return this.stmt(sql).all(...params) as T[];
  }

  run(sql: string, ...params: SQLInputValue[]): { changes: number; lastId: number } {
    const r = this.stmt(sql).run(...params);
    return { changes: Number(r.changes), lastId: Number(r.lastInsertRowid) };
  }

  /** Runs fn atomically. Nested calls join the outer transaction. */
  tx<T>(fn: () => T): T {
    if (this.#depth > 0) {
      this.#depth++;
      try {
        return fn();
      } finally {
        this.#depth--;
      }
    }
    this.raw.exec("BEGIN IMMEDIATE");
    this.#depth = 1;
    try {
      const result = fn();
      if (result instanceof Promise) throw new Error("Db.tx callbacks must be synchronous");
      this.raw.exec("COMMIT");
      return result;
    } catch (err) {
      this.raw.exec("ROLLBACK");
      throw err;
    } finally {
      this.#depth = 0;
    }
  }

  private migrate() {
    this.raw.exec("CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)");
    const applied = new Set(this.all<{ id: number }>("SELECT id FROM _migrations").map((r) => r.id));
    for (const m of MIGRATIONS) {
      if (applied.has(m.id)) continue;
      this.tx(() => {
        this.raw.exec(m.sql);
        this.run("INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)", m.id, m.name, Date.now());
      });
    }
  }

  close() {
    this.raw.close();
  }
}

export const json = <T>(text: unknown, fallback: T): T => {
  if (typeof text !== "string" || text === "") return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
};
