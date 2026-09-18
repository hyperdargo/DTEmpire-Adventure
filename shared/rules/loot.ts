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

/** Rolls rewards for a won fight. Coins and XP come from the foe; items are bonus drops. */
export function rollVictoryLoot(
  rng: Rng,
  opts: { level: number; baseCoins: number; baseXp: number; boss?: boolean; elite?: boolean; luck?: number; source: LootSource },
): LootRoll {
  const luck = opts.luck ?? 0;
  const boss = !!opts.boss;
  const coins = Math.round(opts.baseCoins * rng.range(0.85, 1.2));
  const drops: LootDrop[] = [];
  const luckMult = 1 + luck / 100;

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
