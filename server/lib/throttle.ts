import type { GameCtx } from "../game/context.ts";

const stores = new WeakMap<object, Map<string, number>>();

/**
 * Per-server, per-key minimum gap between actions. Returns remaining wait in ms (0 = allowed, and recorded).
 * Scoped to the database handle so separate server instances never share limits.
 */
export function throttle(g: GameCtx, key: string, gapMs: number): number {
  let store = stores.get(g.db);
  if (!store) {
    store = new Map();
    stores.set(g.db, store);
  }
  const now = g.clock.now();
  const last = store.get(key) ?? -Infinity;
  if (now - last < gapMs) return gapMs - (now - last);
  store.set(key, now);
  if (store.size > 50_000) store.clear();
  return 0;
}
