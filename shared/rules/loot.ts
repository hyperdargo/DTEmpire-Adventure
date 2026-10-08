import { CONSUMABLES } from "../data/items.ts";
import type { Rarity } from "../data/types.ts";
import { pickGearTemplate, rollGear, rollRarity } from "./items.ts";
import type { Rng } from "./rng.ts";

export type LootSource = "adventure" | "tower" | "dungeon" | "expedition" | "worldboss" | "chest";

/** A drop before it is written to a player's inventory. */
export type LootDrop =
  | { kind: "gear"; templateId: string; rarity: Rarity; ilvl: number; base: Record<string, number>; affixes: { stat: string; value: number }[] }
  | { kind: "stack"; templateId: string; qty: number };

export interface LootRoll {
  coins: number;
  xp: number;
  drops: LootDrop[];
}

const materialFor = (level: number, rng: Rng, boss: boolean): string => {
  const pool: Record<string, number> = { iron_ore: 50, undead_bones: 35 };
  if (level >= 10) pool.silk_cloth = 22;
  if (level >= 25) pool.dragon_scales = boss ? 30 : 8;
  if (level >= 40) pool.mystic_gem = boss ? 10 : 2;
  return rng.weighted(pool);
};

const potionFor = (level: number, rng: Rng): string => {
  const healers = CONSUMABLES.filter((c) => c.kind === "potion" && !c.eventOnly && c.healPct && !c.xpPct && c.levelReq <= Math.max(1, level));
  const best = healers.sort((a, b) => b.levelReq - a.levelReq).slice(0, 2);
  return best.length ? rng.pick(best).id : "health_potion";
};

const eggFor = (rng: Rng, boss: boolean): string =>
  rng.weighted(boss ? { mystery_egg: 60, forest_egg: 20, dragon_egg: 15, void_egg: 5 } : { mystery_egg: 70, slime_egg: 20, forest_egg: 10 });

export function gearDrop(rng: Rng, level: number, opts: { boss?: boolean; luck?: number; min?: Rarity } = {}): LootDrop {
  const template = pickGearTemplate(rng, level);
  const rarity = rollRarity(rng, opts);
  const rolled = rollGear(rng, template, level, rarity);
  return { kind: "gear", templateId: template.id, rarity, ilvl: rolled.ilvl, base: rolled.base as Record<string, number>, affixes: rolled.affixes };
}

export function towerMaterialFor(floor: number, rng: Rng, boss: boolean, towerId?: string): string {
  const pool: Record<string, number> = {};
  if (floor <= 20) {
    pool.iron_ore = 50;
    pool.undead_bones = 35;
    pool.silk_cloth = 25;
  } else if (floor <= 40) {
    pool.silk_cloth = 40;
    pool.dragon_scales = boss ? 40 : 25;
    pool.mystic_gem = boss ? 30 : 15;
  } else if (floor <= 60) {
    pool.dragon_scales = 35;
    pool.mystic_gem = 40;
    pool.star_essence = boss ? 30 : 15;
  } else if (floor <= 80) {
    pool.star_essence = 40;
    pool.mystic_gem = 35;
    pool.abyss_shard = boss ? 25 : 15;
  } else {
    pool.star_essence = 35;
    pool.mystic_gem = 35;
    pool.abyss_shard = 30;
  }

  if (towerId === "infernal") {
    pool.dragon_scales = (pool.dragon_scales ?? 0) + 30;
    pool.iron_ore = (pool.iron_ore ?? 0) + 20;
  } else if (towerId === "celestial") {
    pool.star_essence = (pool.star_essence ?? 0) + 40;
    pool.mystic_gem = (pool.mystic_gem ?? 0) + 30;
  } else if (towerId === "void") {
    pool.abyss_shard = (pool.abyss_shard ?? 0) + 45;
  }

  return rng.weighted(pool);
}

export function towerEggFor(floor: number, rng: Rng, boss: boolean, towerId?: string): string {
  if (towerId === "void" && rng.chance(boss ? 40 : 20)) {
    return "void_egg";
  }
  if (towerId === "celestial" && rng.chance(boss ? 25 : 10)) {
    return "celestial_egg";
  }
  if (towerId === "infernal" && rng.chance(boss ? 25 : 10)) {
    return "phoenix_egg";
  }

  if (floor >= 80) {
    return rng.weighted(boss ? { celestial_egg: 15, phoenix_egg: 25, golden_egg: 40, void_egg: 20 } : { golden_egg: 50, void_egg: 30, dragon_egg: 20 });
  } else if (floor >= 60) {
    return rng.weighted(boss ? { golden_egg: 45, void_egg: 30, dragon_egg: 25 } : { dragon_egg: 50, forest_egg: 30, golden_egg: 20 });
  } else if (floor >= 40) {
    return rng.weighted(boss ? { dragon_egg: 50, forest_egg: 35, golden_egg: 15 } : { forest_egg: 50, mystery_egg: 35, dragon_egg: 15 });
  } else if (floor >= 20) {
    return rng.weighted(boss ? { forest_egg: 55, dragon_egg: 25, mystery_egg: 20 } : { mystery_egg: 60, forest_egg: 30, slime_egg: 10 });
  }
  return rng.weighted(boss ? { mystery_egg: 70, forest_egg: 30 } : { mystery_egg: 70, slime_egg: 30 });
}

/** Rolls rewards for a won fight. Coins and XP come from the foe; items are bonus drops. */
export function rollVictoryLoot(
  rng: Rng,
  opts: {
    level: number;
    baseCoins: number;
    baseXp: number;
    boss?: boolean;
    elite?: boolean;
    luck?: number;
    source: LootSource;
    towerFloor?: number;
    towerId?: string;
  },
): LootRoll {
  const luck = opts.luck ?? 0;
  const boss = !!opts.boss;
  const drops: LootDrop[] = [];
  const luckMult = 1 + luck / 100;

  if (opts.source === "tower") {
    const floor = opts.towerFloor ?? opts.level;
    const towerId = opts.towerId ?? "ascension";
    let coins = Math.round(opts.baseCoins * rng.range(0.9, 1.25));
    let xp = opts.baseXp;
    if (towerId === "infernal") coins = Math.round(coins * 1.5);
    if (towerId === "celestial") xp = Math.round(xp * 1.4);

    if (boss) {
      drops.push(gearDrop(rng, opts.level, { boss: true, luck, min: floor >= 50 ? "rare" : "uncommon" }));
      if (rng.chance((35 + Math.min(25, floor * 0.25)) * luckMult)) {
        drops.push(gearDrop(rng, opts.level, { boss: true, luck }));
      }
      drops.push({ kind: "stack", templateId: towerMaterialFor(floor, rng, true, towerId), qty: rng.int(2, 5) });
      if (rng.chance((15 + Math.min(15, floor * 0.15)) * luckMult)) {
        drops.push({ kind: "stack", templateId: towerEggFor(floor, rng, true, towerId), qty: 1 });
      }
      if (rng.chance(18 * luckMult)) {
        drops.push({ kind: "stack", templateId: "skill_book", qty: 1 });
      }
      if (rng.chance(25 * luckMult)) {
        drops.push({ kind: "stack", templateId: "xp_scroll", qty: rng.int(1, Math.min(5, Math.max(1, Math.floor(floor / 20)))) });
      }
      if (floor >= 50 && rng.chance(8 * luckMult)) {
        drops.push({ kind: "stack", templateId: "void_reforger", qty: 1 });
      }
    } else {
      const gearChance = (opts.elite ? 35 : 15) * luckMult;
      if (rng.chance(gearChance)) drops.push(gearDrop(rng, opts.level, { luck }));
      if (rng.chance(opts.elite ? 60 : 35)) {
        drops.push({ kind: "stack", templateId: towerMaterialFor(floor, rng, false, towerId), qty: rng.int(1, opts.elite ? 3 : 2) });
      }
      if (rng.chance(opts.elite ? 18 : 10)) {
        drops.push({ kind: "stack", templateId: potionFor(opts.level, rng), qty: 1 });
      }
      if (rng.chance((opts.elite ? 6 : 2.5) * luckMult)) {
        drops.push({ kind: "stack", templateId: towerEggFor(floor, rng, false, towerId), qty: 1 });
      }
      if (rng.chance((opts.elite ? 4 : 1.5) * luckMult)) {
        drops.push({ kind: "stack", templateId: "skill_book", qty: 1 });
      }
      if (rng.chance((opts.elite ? 8 : 4) * luckMult)) {
        drops.push({ kind: "stack", templateId: "xp_scroll", qty: 1 });
      }
      if (floor >= 60 && rng.chance((opts.elite ? 3 : 1) * luckMult)) {
        drops.push({ kind: "stack", templateId: "void_reforger", qty: 1 });
      }
    }
    return { coins, xp, drops };
  }

  const coins = Math.round(opts.baseCoins * rng.range(0.85, 1.2));
  if (boss) {
    drops.push(gearDrop(rng, opts.level, { boss: true, luck, min: "uncommon" }));
    if (rng.chance(35 * luckMult)) drops.push(gearDrop(rng, opts.level, { boss: true, luck }));
    drops.push({ kind: "stack", templateId: materialFor(opts.level, rng, true), qty: rng.int(2, 4) });
    if (rng.chance(12 * luckMult)) drops.push({ kind: "stack", templateId: eggFor(rng, true), qty: 1 });
    if (rng.chance(10 * luckMult)) drops.push({ kind: "stack", templateId: "skill_book", qty: 1 });
  } else {
    const gearChance = (opts.elite ? 30 : 11) * luckMult;
    if (rng.chance(gearChance)) drops.push(gearDrop(rng, opts.level, { luck }));
    if (rng.chance(opts.elite ? 55 : 30)) drops.push({ kind: "stack", templateId: materialFor(opts.level, rng, false), qty: rng.int(1, opts.elite ? 3 : 2) });
    if (rng.chance(opts.elite ? 14 : 7)) drops.push({ kind: "stack", templateId: potionFor(opts.level, rng), qty: 1 });
    if (rng.chance((opts.elite ? 3 : 1.2) * luckMult)) drops.push({ kind: "stack", templateId: eggFor(rng, false), qty: 1 });
    if (rng.chance((opts.elite ? 2.5 : 0.8) * luckMult)) drops.push({ kind: "stack", templateId: "skill_book", qty: 1 });
  }
  return { coins, xp: opts.baseXp, drops };
}
