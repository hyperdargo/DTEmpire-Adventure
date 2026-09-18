import { SKILLS } from "../data/skills.ts";
import { GEAR_RARITY_MULT, baseDamage, coinReward, gearBudget, spdAt, statGrowth, upgradeMult, xpReward } from "./progression.ts";

// Monsters are tuned against a truthful "reference hero": an average class at its level wearing
// uncommon gear in every slot, upgraded at a steady pace, using the skills it can have learned.

export type MonsterTier = "normal" | "elite" | "boss" | "world";
export interface MonsterShape { hp: number; atk: number; def: number }

export const expectedUpgrade = (level: number) => Math.min(10, Math.floor(level / 12));

export function referenceHero(level: number) {
  const g = statGrowth(level);
  const gm = GEAR_RARITY_MULT.uncommon * upgradeMult(expectedUpgrade(level));
  const acc = gearBudget.accessory(level);
  const atk = 12.75 * g + (gearBudget.weapon(level).atk + acc.atk / 3) * gm;
  const def = 5.5 * g + (gearBudget.armor(level).def + gearBudget.helmet(level).def + gearBudget.boots(level).def + acc.def / 3) * gm;
  const hp = 81 * g + (gearBudget.armor(level).hp + gearBudget.helmet(level).hp + acc.hp / 3) * gm;
  const spd = spdAt(7.25, level) + gearBudget.boots(level).spd * gm;
  return { atk, def, hp, spd };
}

/** Average damage multiplier a hero gets from skills available at a level (rank 1, used on cooldown). */
export function expectedSkillFactor(level: number): number {
  const dmgSkills = SKILLS.filter((s) => s.levelReq <= level && (s.effect.kind === "damage" || s.effect.kind === "drain" || s.effect.kind === "burn" || s.effect.kind === "stun"))
    .sort((a, b) => b.levelReq - a.levelReq)
    .slice(0, 3);
  if (dmgSkills.length === 0) return 1;
  // Per-turn uplift: each skill replaces a basic attack once per (cooldown + 1) turns.
  let uplift = 0;
  for (const s of dmgSkills) {
    const e = s.effect;
    const mult = e.kind === "damage" ? e.mult * (e.hits ?? 1) * (1 + (e.pierce ?? 0) / 150) : "mult" in e ? e.mult : 1;
    uplift += (mult - 1) / (s.cooldown + 1);
  }
  return 1 + uplift;
}

const TIER: Record<MonsterTier, { hp: number; atk: number; def: number; spd: number; xp: number; coins: number }> = {
  normal: { hp: 1, atk: 1, def: 1, spd: 1, xp: 1, coins: 1 },
  elite: { hp: 1.6, atk: 1.15, def: 1.1, spd: 1.05, xp: 2.2, coins: 2 },
  boss: { hp: 3.3, atk: 1.3, def: 1.15, spd: 1.08, xp: 8, coins: 7 },
  world: { hp: 1, atk: 1.5, def: 1.3, spd: 1.1, xp: 0, coins: 0 },
};

export const TUNING = { atkRatio: 1.0, defRatio: 0.8, hitsToKill: 4.6 };

export function monsterStats(level: number, tier: MonsterTier = "normal", shape: MonsterShape = { hp: 1, atk: 1, def: 1 }) {
  const ref = referenceHero(level);
  const t = TIER[tier];
  // New heroes have no skills or upgrades yet, so monsters ramp up to full strength by level 25.
  const ramp = 0.78 + 0.22 * Math.min(1, (level - 1) / 24);
  const atk = ref.atk * TUNING.atkRatio * ramp * t.atk * shape.atk;
  const def = ref.def * TUNING.defRatio * t.def * shape.def;
  const hp = baseDamage(ref.atk, def) * expectedSkillFactor(level) * TUNING.hitsToKill * t.hp * shape.hp;
  return {
    hp: Math.round(hp),
    atk: Math.round(atk),
    def: Math.round(def),
    spd: Math.round(ref.spd * 0.95 * t.spd),
    xp: Math.round(xpReward(level) * t.xp),
    coins: Math.round(coinReward(level) * t.coins),
  };
}
