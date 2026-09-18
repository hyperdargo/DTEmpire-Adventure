import { CONSUMABLE_BY_ID, GEAR_BY_ID } from "../data/items.ts";
import { PET_BY_ID, PET_MAX_LEVEL } from "../data/pets.ts";
import type { ItemView, PetView } from "../data/types.ts";
import { type ItemRecord, itemStats, sellPrice, statPower, templateOf } from "./items.ts";
import { type PetRecord, petBonus, petXpToNext } from "./stats.ts";

export function toItemView(rec: ItemRecord): ItemView {
  const t = templateOf(rec.templateId);
  const gear = GEAR_BY_ID[rec.templateId];
  const stats = gear ? itemStats(rec) : {};
  const c = CONSUMABLE_BY_ID[rec.templateId];
  return {
    id: rec.id,
    templateId: rec.templateId,
    name: t.name,
    icon: t.icon,
    kind: t.kind,
    rarity: gear ? rec.rarity : c?.kind === "egg" && c.eggRarity && c.eggRarity !== "mystery" && c.eggRarity !== "golden" ? c.eggRarity : rec.rarity,
    ilvl: rec.ilvl,
    upgrade: rec.upgrade,
    qty: rec.qty,
    stats,
    affixes: rec.affixes,
    equipped: rec.equipped,
    locked: rec.locked,
    ...(gear?.weaponType ? { weaponType: gear.weaponType } : {}),
    levelReq: gear ? Math.min(t.levelReq, rec.ilvl) : t.levelReq,
    power: gear ? statPower(stats) : 0,
    sellPrice: sellPrice(rec),
    desc: t.desc,
  };
}

export function toPetView(p: PetRecord): PetView {
  const s = PET_BY_ID[p.speciesId];
  const { bonus, power } = petBonus(p);
  const maxLevel = PET_MAX_LEVEL[p.rarity];
  return {
    id: p.id,
    speciesId: p.speciesId,
    name: p.name || s?.name || "Pet",
    icon: s?.icon ?? "🐾",
    rarity: p.rarity,
    level: p.level,
    maxLevel,
    xp: p.xp,
    xpToNext: p.level >= maxLevel ? 0 : petXpToNext(p.level),
    bonus,
    power,
    ability: s?.ability ?? "strike",
    active: p.active,
  };
}
