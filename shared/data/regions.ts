import { DUNGEON_BANDS, REGIONS_SOURCE, STORY_CHAPTERS } from "./content.ts";
import type { MonsterShape } from "../rules/monsters.ts";

// Adventure regions from the original, placed along the 1–100 level curve in their original order.
// Each monster keeps its original personality (tanky, fragile, hard-hitting) as a stat shape.

export interface MonsterDef { id: string; name: string; icon: string; shape: MonsterShape }
export interface Region {
  id: string;
  name: string;
  icon: string;
  description: string;
  minLevel: number;
  maxLevel: number;
  monsters: MonsterDef[];
  boss: MonsterDef;
  /** Kills in this region needed before the boss can be challenged. */
  bossUnlockKills: number;
}

const clampShape = (v: number) => Math.round(Math.max(0.7, Math.min(1.4, v)) * 100) / 100;

function shapeOf(m: { hp: number; atk: number; def: number }, avg: { hp: number; atk: number; def: number }): MonsterShape {
  return { hp: clampShape(m.hp / avg.hp), atk: clampShape(m.atk / avg.atk), def: clampShape(m.def / Math.max(1, avg.def)) };
}

export const REGIONS: Region[] = REGIONS_SOURCE.map((r, i) => {
  const n = r.monsters.length;
  const avg = {
    hp: r.monsters.reduce((s, m) => s + m.hp, 0) / n,
    atk: r.monsters.reduce((s, m) => s + m.atk, 0) / n,
    def: r.monsters.reduce((s, m) => s + m.def, 0) / n,
  };
  const minLevel = i === 0 ? 1 : Math.round(1 + (i * 96) / (REGIONS_SOURCE.length - 1));
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    description: r.description,
    minLevel,
    maxLevel: Math.min(100, minLevel + 5),
    monsters: r.monsters.map((m) => ({ id: m.id, name: m.name, icon: m.icon, shape: shapeOf(m, avg) })),
    boss: { id: r.boss.id, name: r.boss.name, icon: r.boss.icon, shape: { hp: 1, atk: 1, def: 1 } },
    bossUnlockKills: 10,
  };
});

export const REGION_BY_ID: Record<string, Region> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

export function allMonsters(): (MonsterDef & { regionId: string; boss: boolean })[] {
  return REGIONS.flatMap((r) => [
    ...r.monsters.map((m) => ({ ...m, regionId: r.id, boss: false })),
    { ...r.boss, regionId: r.id, boss: true },
  ]);
}

// ── Tower of Ascension ────────────────────────────────────────────────
export const TOWER_FLOORS = 100;
export const towerLevelReq = (floor: number) => Math.max(1, floor - 5);
export const towerEnemyLevel = (floor: number) => Math.min(100, floor + 1);
export const isTowerBossFloor = (floor: number) => floor % 5 === 0;
export const chapterForFloor = (floor: number) => STORY_CHAPTERS[Math.min(STORY_CHAPTERS.length - 1, Math.ceil(floor / 5) - 1)]!;

/** Enemy names for tower floors, parsed from each chapter's enemy line ("🐺 Goblins · 🟢 Slimes"). */
export function towerEnemyNames(floor: number): { icon: string; name: string }[] {
  const ch = chapterForFloor(floor);
  return ch.enemies.split("·").map((part) => {
    const t = part.trim();
    const sp = t.indexOf(" ");
    const icon = sp > 0 ? t.slice(0, sp) : "👹";
    let name = sp > 0 ? t.slice(sp + 1) : t;
    name = name.replace(/ies$/, "y").replace(/(?<!s)s$/, "");
    return { icon, name };
  });
}

// ── Dungeon ───────────────────────────────────────────────────────────
export const DUNGEON_FLOORS = 100;
export const dungeonEnemyLevel = (floor: number) => Math.min(100, Math.max(1, Math.round(floor * 0.95) + 2));
export const isDungeonBossFloor = (floor: number) => floor % 10 === 0;
export const dungeonCheckpoint = (bestFloor: number) => Math.floor(bestFloor / 10) * 10;
export const BOON_EVERY = 3;

export function dungeonEnemies(floor: number) {
  const band = DUNGEON_BANDS.find((b) => floor >= b.from && floor <= b.to) ?? DUNGEON_BANDS[DUNGEON_BANDS.length - 1]!;
  return band.enemies;
}

export { STORY_CHAPTERS };
