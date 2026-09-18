// Deterministic, seedable PRNG so every battle and roll can be replayed and tested.

function hashString(str: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  int(min: number, max: number): number;
  chance(pct: number): boolean;
  pick<T>(arr: readonly T[]): T;
  weighted<T extends string>(weights: Partial<Record<T, number>>): T;
  range(min: number, max: number): number;
}

export function createRng(seed: string | number): Rng {
  let a = typeof seed === "number" ? seed >>> 0 : hashString(seed);
  const next = () => {
    // mulberry32
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (pct) => next() * 100 < pct,
    range: (min, max) => min + next() * (max - min),
    pick: (arr) => {
      if (arr.length === 0) throw new Error("pick from empty array");
      return arr[Math.floor(next() * arr.length)] as (typeof arr)[number];
    },
    weighted: (weights) => {
      const entries = Object.entries(weights) as [string, number][];
      const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
      let roll = next() * total;
      for (const [key, w] of entries) {
        roll -= Math.max(0, w);
        if (roll < 0) return key as never;
      }
      return entries[entries.length - 1]![0] as never;
    },
  };
  return rng;
}

/** Non-deterministic seed for new battles; recorded so outcomes can be replayed. */
export function freshSeed(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
