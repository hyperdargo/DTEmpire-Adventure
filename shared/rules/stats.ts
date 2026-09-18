import { CLASS_BY_ID, CLASS_TIER_MULT, dualShare } from "../data/classes.ts";
import { GEAR_BY_ID } from "../data/items.ts";
import { PET_BY_ID, PET_MAX_LEVEL } from "../data/pets.ts";
import type { Rarity, StatBlock } from "../data/types.ts";
import { type ItemRecord, itemStats } from "./items.ts";
import { RARITY_INDEX, spdAt, statGrowth } from "./progression.ts";

export interface PetRecord {
  id: number;
  speciesId: string;
  rarity: Rarity;
  level: number;
  xp: number;
  active: boolean;
  name?: string | null;
}

export interface Buffs {
  atkPct?: number;
  defPct?: number;
  coinPct?: number;
  xpPct?: number;
}

export interface HeroInput {
  classId: string;
  classRarity: Rarity;
  level: number;
  dual?: { classId: string; level: number } | null;
  equipped: Pick<ItemRecord, "templateId" | "base" | "affixes" | "upgrade">[];
  pet?: PetRecord | null;
  buffs?: Buffs;
  guildPerkPct?: number;
}

export interface HeroStats {
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  crit: number;
  critDmg: number;
  dodge: number;
  lifesteal: number;
  luck: number;
  xpBonus: number;
  skillPower: number;
  pierce: number;
  regenPct: number;
  bossDamage: number;
  rage: number;
  petPowerPct: number;
  cooldownReduction: number;
  power: number;
}

export const petXpToNext = (level: number) => 60 + level * level * 12;

export function petBonus(pet: Pick<PetRecord, "speciesId" | "rarity" | "level">): { bonus: StatBlock; power: number } {
  const species = PET_BY_ID[pet.speciesId];
  const ri = RARITY_INDEX[pet.rarity];
  const power = Math.round((6 + pet.level * 2.2) * (1 + ri * 0.45));
  const focus = species?.focus ?? "balanced";
  const bonus: StatBlock =
    focus === "atk" ? { atk: Math.round(power * 0.5) }
    : focus === "def" ? { def: Math.round(power * 0.45), hp: Math.round(power * 1.5) }
    : focus === "hp" ? { hp: Math.round(power * 4) }
    : { atk: Math.round(power * 0.25), def: Math.round(power * 0.2), hp: Math.round(power * 1.5) };
  return { bonus, power };
}

export const petMaxLevel = (rarity: Rarity) => PET_MAX_LEVEL[rarity];

export function computeHeroStats(input: HeroInput): HeroStats {
  const cls = CLASS_BY_ID[input.classId] ?? CLASS_BY_ID.warrior!;
  const g = statGrowth(input.level);
  const tier = CLASS_TIER_MULT[input.classRarity] ?? 1;

  let hp = cls.base.hp * g * tier;
  let atk = cls.base.atk * g * tier;
  let def = cls.base.def * g * tier;
  let spd = spdAt(cls.base.spd, input.level) * tier;
  let crit = 5;
  let critDmg = 150;
  let dodge = 2;
  let lifesteal = 0;
  let luck = 0;
  let xpBonus = 0;
  let skillPower = 0;
  let pierce = 0;
  let regenPct = 0;
  let bossDamage = 0;
  let rage = 0;
  let petPowerPct = 0;
  let cooldownReduction = 0;

  if (input.dual) {
    const dc = CLASS_BY_ID[input.dual.classId];
    if (dc) {
      const share = dualShare(input.dual.level);
      hp += dc.base.hp * g * share;
      atk += dc.base.atk * g * share;
      def += dc.base.def * g * share;
      spd += dc.base.spd * share;
    }
  }

  const affinity = cls.weapon;
  for (const item of input.equipped) {
    const s = itemStats(item);
    const template = GEAR_BY_ID[item.templateId];
    const weaponBoost = template?.slot === "weapon" && template.weaponType === affinity ? 1.15 : 1;
    atk += (s.atk ?? 0) * weaponBoost;
    def += s.def ?? 0;
    hp += s.hp ?? 0;
    spd += s.spd ?? 0;
    crit += s.crit ?? 0;
    critDmg += s.critDmg ?? 0;
    dodge += s.dodge ?? 0;
    lifesteal += s.lifesteal ?? 0;
    luck += s.luck ?? 0;
    xpBonus += s.xpBonus ?? 0;
  }

  if (input.pet) {
    const { bonus } = petBonus(input.pet);
    atk += bonus.atk ?? 0;
    def += bonus.def ?? 0;
    hp += bonus.hp ?? 0;
  }

  const p = cls.passive.effect;
  switch (p.kind) {
    case "stat_pct":
      hp *= 1 + (p.stats.hp ?? 0) / 100;
      atk *= 1 + (p.stats.atk ?? 0) / 100;
      def *= 1 + (p.stats.def ?? 0) / 100;
      spd *= 1 + (p.stats.spd ?? 0) / 100;
      break;
    case "all_stats":
      hp *= 1 + p.pct / 100; atk *= 1 + p.pct / 100; def *= 1 + p.pct / 100; spd *= 1 + p.pct / 100;
      break;
    case "crit": crit += p.chance; critDmg += p.dmg; break;
    case "dodge": dodge += p.chance; break;
    case "skill_power": skillPower += p.pct; break;
    case "boss_damage": bossDamage += p.pct; break;
    case "regen": regenPct += p.pctPerTurn; break;
    case "lifesteal": lifesteal += p.pct; break;
    case "first_strike": spd *= 1 + p.spdPct / 100; break;
    case "low_hp_rage": rage += p.pct; break;
    case "pet_power": petPowerPct += p.pct; break;
    case "armor_pierce": pierce += p.pct; break;
    case "cooldown": cooldownReduction += p.turns; break;
  }

  const b = input.buffs ?? {};
  atk *= 1 + (b.atkPct ?? 0) / 100;
  def *= 1 + (b.defPct ?? 0) / 100;
  xpBonus += (b.xpPct ?? 0) + (input.guildPerkPct ?? 0);

  const stats: HeroStats = {
    maxHp: Math.max(1, Math.round(hp)),
    atk: Math.max(1, Math.round(atk)),
    def: Math.max(0, Math.round(def)),
    spd: Math.round(spd * 10) / 10,
    crit: Math.min(75, Math.round(crit * 10) / 10),
    critDmg: Math.round(critDmg),
    dodge: Math.min(40, Math.round(dodge * 10) / 10),
    lifesteal: Math.min(30, Math.round(lifesteal * 10) / 10),
    luck: Math.round(luck),
    xpBonus: Math.round(xpBonus),
    skillPower, pierce: Math.min(60, pierce), regenPct, bossDamage, rage, petPowerPct, cooldownReduction,
    power: 0,
  };
  stats.power = heroPower(stats);
  return stats;
}

/** The "power" shown on the hero card and used for matchmaking. */
export function heroPower(s: Pick<HeroStats, "maxHp" | "atk" | "def" | "spd" | "crit" | "critDmg" | "dodge" | "lifesteal">): number {
  const offense = s.atk * (1 + (s.crit / 100) * ((s.critDmg - 100) / 100)) * (1 + s.lifesteal / 200);
  const defense = s.maxHp * (1 + s.def / 250) * (1 + s.dodge / 100);
  return Math.round(Math.sqrt(offense * defense) * 2 + s.spd * 3);
}
