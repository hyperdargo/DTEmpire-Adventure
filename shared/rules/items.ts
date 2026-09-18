import { CONSUMABLE_BY_ID, GEAR, GEAR_BY_ID } from "../data/items.ts";
import type { Affix, EquipSlot, GearTemplate, ItemKind, Rarity, StatBlock, StatKey } from "../data/types.ts";
import type { Rng } from "./rng.ts";
import { GEAR_RARITY_MULT, MAX_UPGRADE, RARITY_INDEX, RARITY_ORDER, clamp, gearBudget, upgradeMult } from "./progression.ts";

/** The persisted shape of an owned item (server row, minus ownership). */
export interface ItemRecord {
  id: number;
  templateId: string;
  rarity: Rarity;
  ilvl: number;
  upgrade: number;
  qty: number;
  /** Rolled base stats at +0. */
  base: StatBlock;
  affixes: Affix[];
  equipped: boolean;
  locked: boolean;
}

export const AFFIX_COUNT: Record<Rarity, number> = { common: 0, uncommon: 0, rare: 1, epic: 2, legendary: 3, mythic: 3, unique: 4 };

const AFFIX_POOL: Record<EquipSlot, StatKey[]> = {
  weapon: ["crit", "critDmg", "lifesteal", "atk"],
  armor: ["hp", "def", "lifesteal", "dodge"],
  helmet: ["hp", "def", "crit", "xpBonus"],
  boots: ["spd", "dodge", "luck", "def"],
  accessory: ["crit", "critDmg", "luck", "xpBonus", "atk", "hp"],
};

/** Affix value at a rarity. Percent stats for crit/critDmg/dodge/lifesteal/luck/xpBonus; atk/def/hp are % of the item's own budget. */
function affixValue(rng: Rng, stat: StatKey, rarity: Rarity, ilvl: number): number {
  const r = RARITY_INDEX[rarity];
  const roll = rng.range(0.8, 1.2);
  const v: Record<StatKey, number> = {
    crit: 1.5 + 0.8 * r,
    critDmg: 6 + 4 * r,
    lifesteal: 1 + 0.6 * r,
    dodge: 1 + 0.6 * r,
    luck: 4 + 3 * r,
    xpBonus: 2 + 1.5 * r,
    atk: 3 + 1.2 * r,
    def: 3 + 1.2 * r,
    hp: 3 + 1.4 * r,
    spd: 1 + 0.03 * ilvl + r * 0.5,
  };
  return Math.max(1, Math.round(v[stat] * roll * 10) / 10);
}

export function isGear(templateId: string): boolean {
  return templateId in GEAR_BY_ID;
}

export function templateOf(templateId: string): { name: string; icon: string; kind: ItemKind; levelReq: number; desc: string; slot?: EquipSlot } {
  const g = GEAR_BY_ID[templateId];
  if (g) return { name: g.name, icon: g.icon, kind: g.slot, levelReq: g.levelReq, desc: g.desc, slot: g.slot };
  const c = CONSUMABLE_BY_ID[templateId];
  if (c) return { name: c.name, icon: c.icon, kind: c.kind, levelReq: c.levelReq, desc: c.desc };
  return { name: "Unknown relic", icon: "❔", kind: "material", levelReq: 1, desc: "Its purpose is lost." };
}

/** Rolls a gear piece's base stats and affixes. */
export function rollGear(rng: Rng, template: GearTemplate, ilvl: number, rarity: Rarity): Pick<ItemRecord, "base" | "affixes" | "ilvl" | "rarity"> {
  const level = clamp(Math.round(ilvl), 1, 100);
  const mult = GEAR_RARITY_MULT[rarity];
  const budget = gearBudget[template.slot](level) as StatBlock;
  const base: StatBlock = {};
  for (const [k, v] of Object.entries(budget) as [StatKey, number][]) {
    let focus = 1;
    if (template.focus) {
      const f = template.focus[k] ?? 0;
      const total = Object.values(template.focus).reduce((s, x) => s + (x ?? 0), 0) || 1;
      focus = (f / total) * Object.keys(budget).length;
      if (focus === 0) continue;
    }
    const value = Math.round(v * mult * focus * rng.range(0.92, 1.08));
    if (value > 0) base[k] = value;
  }
  if (template.focus?.luck) base.luck = Math.round((5 + level * 0.15) * mult);
  const affixes: Affix[] = [];
  const pool = [...AFFIX_POOL[template.slot]];
  for (let i = 0; i < AFFIX_COUNT[rarity] && pool.length > 0; i++) {
    const idx = Math.floor(rng.next() * pool.length);
    const stat = pool.splice(idx, 1)[0]!;
    affixes.push({ stat, value: affixValue(rng, stat, rarity, level) });
  }
  return { base, affixes, ilvl: level, rarity };
}

/** Final stats of a gear piece, applying upgrades and budget-percent affixes. */
export function itemStats(rec: Pick<ItemRecord, "base" | "affixes" | "upgrade">): StatBlock {
  const um = upgradeMult(rec.upgrade);
  const out: StatBlock = {};
  for (const [k, v] of Object.entries(rec.base) as [StatKey, number][]) {
    out[k] = k === "luck" ? v : Math.round(v * um);
  }
  for (const a of rec.affixes) {
    if (a.stat === "atk" || a.stat === "def" || a.stat === "hp") {
      const baseVal = out[a.stat] ?? 0;
      out[a.stat] = Math.round(baseVal * (1 + a.value / 100)) + (baseVal === 0 ? Math.round(a.value) : 0);
    } else {
      out[a.stat] = Math.round(((out[a.stat] ?? 0) + a.value) * 10) / 10;
    }
  }
  return out;
}

/** A single comparable number for sorting and "better than equipped" hints. */
export function statPower(s: StatBlock): number {
  return Math.round(
    (s.atk ?? 0) * 2 + (s.def ?? 0) * 1.6 + (s.hp ?? 0) * 0.22 + (s.spd ?? 0) * 3 +
    (s.crit ?? 0) * 4 + (s.critDmg ?? 0) * 1.2 + (s.dodge ?? 0) * 4 + (s.lifesteal ?? 0) * 5 +
    (s.luck ?? 0) * 1 + (s.xpBonus ?? 0) * 1.5,
  );
}

export function sellPrice(rec: Pick<ItemRecord, "templateId" | "rarity" | "ilvl" | "upgrade">): number {
  const c = CONSUMABLE_BY_ID[rec.templateId];
  if (c) return c.sellPrice;
  return Math.round((12 + rec.ilvl * 6) * Math.pow(2.1, RARITY_INDEX[rec.rarity]) * (1 + rec.upgrade * 0.25));
}

export function upgradeCost(rec: Pick<ItemRecord, "rarity" | "ilvl" | "upgrade">): { coins: number; materials: Record<string, number> } | null {
  if (rec.upgrade >= MAX_UPGRADE) return null;
  const next = rec.upgrade + 1;
  const ri = RARITY_INDEX[rec.rarity];
  const coins = Math.round((40 + rec.ilvl * 12) * next * (1 + ri * 0.35));
  const materials: Record<string, number> = { iron_ore: 1 + Math.floor(next / 2) };
  if (next >= 4) materials.silk_cloth = Math.ceil((next - 3) / 2);
  if (next >= 7) materials.dragon_scales = next - 6;
  if (next >= 9) materials.mystic_gem = next - 8;
  return { coins, materials };
}

export function salvageYield(rng: Rng, rec: Pick<ItemRecord, "rarity" | "ilvl" | "upgrade">): Record<string, number> {
  const ri = RARITY_INDEX[rec.rarity];
  const out: Record<string, number> = { iron_ore: 1 + Math.floor(rec.ilvl / 25) + Math.floor(rec.upgrade / 3) };
  if (rec.ilvl >= 10 && rng.chance(50)) out.silk_cloth = 1;
  if (ri >= 2) out.star_essence = ri - 1;
  if (ri >= 3 && rec.ilvl >= 25) out.dragon_scales = ri - 2;
  if (ri >= 4) out.mystic_gem = ri - 3;
  return out;
}

/** Forging two same-rarity pieces of one slot yields a higher-rarity piece. */
export function forgeResultRarity(rng: Rng, rarity: Rarity): Rarity | null {
  const idx = RARITY_INDEX[rarity];
  if (idx >= RARITY_INDEX.mythic) return null;
  const roll = rng.next() * 100;
  const jump = roll < 88 ? 1 : 2;
  return RARITY_ORDER[Math.min(RARITY_INDEX.mythic, idx + jump)]!;
}

export const BASE_DROP_RARITY: Partial<Record<Rarity, number>> = { common: 55, uncommon: 27, rare: 12, epic: 4.5, legendary: 1.3, mythic: 0.2 };

export function rollRarity(rng: Rng, opts: { boss?: boolean; luck?: number; min?: Rarity } = {}): Rarity {
  const luck = 1 + (opts.luck ?? 0) / 100;
  const w: Partial<Record<Rarity, number>> = {};
  for (const [r, weight] of Object.entries(BASE_DROP_RARITY) as [Rarity, number][]) {
    const idx = RARITY_INDEX[r];
    let v = weight * (idx >= 2 ? luck : 1);
    if (opts.boss) v *= idx === 0 ? 0.3 : idx === 1 ? 0.9 : 2.2;
    if (opts.min && idx < RARITY_INDEX[opts.min]) v = 0;
    w[r] = v;
  }
  return rng.weighted(w);
}

/** Picks a gear template that fits an item level: mostly the newest tier, sometimes the one before. */
export function pickGearTemplate(rng: Rng, ilvl: number, slot?: EquipSlot): GearTemplate {
  const s = slot ?? rng.weighted<EquipSlot>({ weapon: 26, armor: 22, helmet: 18, boots: 18, accessory: 16 });
  const eligible = GEAR.filter((g) => g.slot === s && !g.eventOnly && g.levelReq <= Math.max(1, ilvl)).sort((a, b) => b.levelReq - a.levelReq);
  if (eligible.length === 0) return GEAR.filter((g) => g.slot === s).sort((a, b) => a.levelReq - b.levelReq)[0]!;
  const top = eligible.slice(0, 3);
  const TIER_WEIGHTS = [60, 28, 12];
  const id = rng.weighted<string>(Object.fromEntries(top.map((g, i) => [g.id, TIER_WEIGHTS[i] ?? 1])));
  return GEAR_BY_ID[id] ?? top[0]!;
}
