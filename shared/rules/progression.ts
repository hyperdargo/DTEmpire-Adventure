import type { Rarity } from "../data/types.ts";

// One power curve for the whole game. Players, gear and monsters all derive from it,
// so difficulty stays consistent from level 1 to level 100.

export const MAX_LEVEL = 100;

export const RARITY_INDEX: Record<Rarity, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, unique: 6,
};
export const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "unique"];
export const GEAR_RARITY_MULT: Record<Rarity, number> = {
  common: 1, uncommon: 1.2, rare: 1.45, epic: 1.75, legendary: 2.1, mythic: 2.5, unique: 2.8,
};

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function xpToNext(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  return Math.floor(40 * Math.pow(level, 1.75) + 60);
}

export function totalXpForLevel(level: number): number {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpToNext(l);
  return sum;
}

/** Applies XP to a level, returning the new level, leftover XP and levels gained. */
export function applyXp(level: number, xp: number, gain: number): { level: number; xp: number; gained: number } {
  let lv = level;
  let cur = xp + Math.max(0, Math.floor(gain));
  let gained = 0;
  while (lv < MAX_LEVEL && cur >= xpToNext(lv)) {
    cur -= xpToNext(lv);
    lv++;
    gained++;
  }
  if (lv >= MAX_LEVEL) cur = 0;
  return { level: lv, xp: cur, gained };
}

export const statGrowth = (level: number) => 1 + 0.12 * (level - 1);
export const spdAt = (base: number, level: number) => base + 0.15 * (level - 1);

// ── Gear budget ───────────────────────────────────────────────────────
export const gearBudget = {
  weapon: (i: number) => ({ atk: 3 + 1.5 * i }),
  armor: (i: number) => ({ def: 2 + 1.0 * i, hp: 8 + 5 * i }),
  helmet: (i: number) => ({ def: 1 + 0.5 * i, hp: 6 + 4 * i }),
  boots: (i: number) => ({ def: 1 + 0.4 * i, spd: 1 + 0.06 * i }),
  accessory: (i: number) => ({ atk: 1 + 0.5 * i, def: 1 + 0.35 * i, hp: 5 + 3 * i }),
} as const;

export const upgradeMult = (upgrade: number) => 1 + 0.06 * upgrade;
export const MAX_UPGRADE = 10;

/** Core damage formula: attack scaled by attack/(attack+defense). Never a 1-damage wall. */
export function baseDamage(atk: number, def: number): number {
  const a = Math.max(1, atk);
  const d = Math.max(0, def);
  return (a * a) / (a + d);
}

export const xpReward = (level: number) => Math.floor(10 + 4 * Math.pow(level, 1.2));
export const coinReward = (level: number) => Math.floor(8 + 3 * Math.pow(level, 1.15));

/** HP regenerates to full over this many seconds when out of combat. */
export const HP_FULL_REGEN_SECONDS = 240;

export function regenHp(hp: number, maxHp: number, lastUpdateMs: number, nowMs: number): number {
  if (hp >= maxHp) return maxHp;
  const elapsed = Math.max(0, nowMs - lastUpdateMs) / 1000;
  return Math.min(maxHp, Math.floor(hp + (maxHp * elapsed) / HP_FULL_REGEN_SECONDS));
}

export const innCost = (level: number) => 10 + level * 6;
export const INVENTORY_BASE_SLOTS = 80;
