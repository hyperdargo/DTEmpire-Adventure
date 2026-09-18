import { CONSUMABLE_BY_ID, GEAR_BY_ID } from "../../shared/data/items.ts";
import type { EquipSlot, ItemView, Rarity } from "../../shared/data/types.ts";
import { type ItemRecord, salvageYield, sellPrice } from "../../shared/rules/items.ts";
import type { LootDrop } from "../../shared/rules/loot.ts";
import { INVENTORY_BASE_SLOTS, RARITY_INDEX } from "../../shared/rules/progression.ts";
import { createRng, freshSeed } from "../../shared/rules/rng.ts";
import { toItemView } from "../../shared/rules/views.ts";
import { GameError, notFound } from "../lib/errors.ts";
import type { GameCtx } from "./context.ts";
import { type Player, addGear, addStack, bump, bumpMission, grantXp, heroStats, itemFromRow, xpPctOfLevel } from "./player.ts";

export function listItems(g: GameCtx, userId: number): ItemView[] {
  return g.db
    .all("SELECT * FROM items WHERE owner_id = ? AND escrow IS NULL ORDER BY equipped DESC, id DESC", userId)
    .map((r) => toItemView(itemFromRow(r as never)));
}

export function getOwnedItem(g: GameCtx, userId: number, itemId: number): ItemRecord {
  const row = g.db.get("SELECT * FROM items WHERE id = ? AND owner_id = ? AND escrow IS NULL", itemId, userId);
  if (!row) throw notFound("Item");
  return itemFromRow(row as never);
}

export const bagUsed = (g: GameCtx, userId: number) =>
  g.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM items WHERE owner_id = ? AND escrow IS NULL", userId)?.n ?? 0;

export const bagCapacity = (p: Player) => INVENTORY_BASE_SLOTS + Math.floor(p.level / 5) * 4;

export interface DropResult { view: ItemView | null; templateId: string; qty: number; autoSold?: number; autoSalvaged?: Record<string, number> }

/** Writes drops to the bag. Commons can auto-salvage; overflow gear is auto-sold rather than lost. */
export function giveDrops(g: GameCtx, p: Player, drops: LootDrop[]): DropResult[] {
  const out: DropResult[] = [];
  const rng = createRng(freshSeed());
  for (const d of drops) {
    if (d.kind === "stack") {
      addStack(g, p.userId, d.templateId, d.qty);
      out.push({ view: null, templateId: d.templateId, qty: d.qty });
      continue;
    }
    if (p.state.settings?.autoSalvageCommon && d.rarity === "common") {
      const mats = salvageYield(rng, { rarity: d.rarity, ilvl: d.ilvl, upgrade: 0 });
      for (const [m, q] of Object.entries(mats)) addStack(g, p.userId, m, q);
      out.push({ view: null, templateId: d.templateId, qty: 1, autoSalvaged: mats });
      continue;
    }
    if (bagUsed(g, p.userId) >= bagCapacity(p)) {
      const coins = sellPrice({ templateId: d.templateId, rarity: d.rarity, ilvl: d.ilvl, upgrade: 0 });
      p.coins += coins;
      out.push({ view: null, templateId: d.templateId, qty: 1, autoSold: coins });
      continue;
    }
    const id = addGear(g, p.userId, d);
    out.push({ view: toItemView({ id, templateId: d.templateId, rarity: d.rarity, ilvl: d.ilvl, upgrade: 0, qty: 1, base: d.base, affixes: d.affixes as ItemRecord["affixes"], equipped: false, locked: false }), templateId: d.templateId, qty: 1 });
  }
  return out;
}

function assertNotInBattle(g: GameCtx, userId: number) {
  if (g.db.get("SELECT 1 FROM battles WHERE user_id = ? AND status = 'active'", userId)) {
    throw new GameError("Finish your current battle first.", { code: "in_battle" });
  }
}

export function equip(g: GameCtx, p: Player, itemId: number) {
  assertNotInBattle(g, p.userId);
  const item = getOwnedItem(g, p.userId, itemId);
  const gear = GEAR_BY_ID[item.templateId];
  if (!gear) throw new GameError("That can't be equipped.");
  const req = Math.min(gear.levelReq, item.ilvl);
  if (p.level < req) throw new GameError(`${gear.name} requires level ${req}.`, { code: "level_locked" });
  const hpBefore = heroStats(g, p).maxHp;
  const sameSlot = g.db
    .all<{ id: number; template_id: string }>("SELECT id, template_id FROM items WHERE owner_id = ? AND equipped = 1", p.userId)
    .filter((r) => GEAR_BY_ID[r.template_id]?.slot === gear.slot);
  for (const r of sameSlot) g.db.run("UPDATE items SET equipped = 0 WHERE id = ?", r.id);
  g.db.run("UPDATE items SET equipped = 1 WHERE id = ?", item.id);
  keepHpRatio(g, p, hpBefore);
}

export function unequip(g: GameCtx, p: Player, slot: EquipSlot) {
  assertNotInBattle(g, p.userId);
  const hpBefore = heroStats(g, p).maxHp;
  const rows = g.db.all<{ id: number; template_id: string }>("SELECT id, template_id FROM items WHERE owner_id = ? AND equipped = 1", p.userId);
  for (const r of rows) if (GEAR_BY_ID[r.template_id]?.slot === slot) g.db.run("UPDATE items SET equipped = 0 WHERE id = ?", r.id);
  keepHpRatio(g, p, hpBefore);
}

/** Changing gear keeps your HP percentage instead of healing or wounding you. */
function keepHpRatio(g: GameCtx, p: Player, maxBefore: number) {
  const maxAfter = heroStats(g, p).maxHp;
  const ratio = maxBefore > 0 ? Math.min(1, p.hp / maxBefore) : 1;
  p.hp = Math.max(1, Math.round(maxAfter * ratio));
}

export function setLocked(g: GameCtx, userId: number, itemId: number, locked: boolean) {
  getOwnedItem(g, userId, itemId);
  g.db.run("UPDATE items SET locked = ? WHERE id = ?", locked ? 1 : 0, itemId);
}

function assertDisposable(item: ItemRecord) {
  if (item.equipped) throw new GameError("Unequip it first.");
  if (item.locked) throw new GameError("That item is locked. Unlock it first.");
}

function removeQty(g: GameCtx, item: ItemRecord, qty: number) {
  if (qty >= item.qty) g.db.run("DELETE FROM items WHERE id = ?", item.id);
  else g.db.run("UPDATE items SET qty = qty - ? WHERE id = ?", qty, item.id);
}

export function sell(g: GameCtx, p: Player, itemId: number, qty = 1): number {
  const item = getOwnedItem(g, p.userId, itemId);
  assertDisposable(item);
  const n = Math.max(1, Math.min(item.qty, Math.floor(qty)));
  const coins = sellPrice(item) * n;
  removeQty(g, item, n);
  p.coins += coins;
  bumpMission(p, "sell", n);
  return coins;
}

export function salvage(g: GameCtx, p: Player, itemId: number): Record<string, number> {
  const item = getOwnedItem(g, p.userId, itemId);
  assertDisposable(item);
  if (!GEAR_BY_ID[item.templateId]) throw new GameError("Only gear can be salvaged.");
  const mats = salvageYield(createRng(freshSeed()), item);
  removeQty(g, item, 1);
  for (const [m, q] of Object.entries(mats)) addStack(g, p.userId, m, q);
  bumpMission(p, "sell");
  return mats;
}

/** Sells or salvages every unlocked, unequipped gear piece at or below a rarity. */
export function bulkDispose(g: GameCtx, p: Player, mode: "sell" | "salvage", maxRarity: Rarity) {
  const rows = g.db.all("SELECT * FROM items WHERE owner_id = ? AND equipped = 0 AND locked = 0 AND escrow IS NULL AND base != '{}'", p.userId)
    .map((r) => itemFromRow(r as never))
    .filter((i) => RARITY_INDEX[i.rarity] <= RARITY_INDEX[maxRarity]);
  let coins = 0;
  const mats: Record<string, number> = {};
  for (const item of rows) {
    if (mode === "sell") coins += sell(g, p, item.id);
    else for (const [m, q] of Object.entries(salvage(g, p, item.id))) mats[m] = (mats[m] ?? 0) + q;
  }
  return { count: rows.length, coins, materials: mats };
}

/** Out-of-combat use: potions, scrolls. Eggs and books route to their own services. */
export function useConsumable(g: GameCtx, p: Player, itemId: number): { healed: number; xp: number } {
  const item = getOwnedItem(g, p.userId, itemId);
  const c = CONSUMABLE_BY_ID[item.templateId];
  if (!c || (c.kind !== "potion" && item.templateId !== "xp_scroll")) throw new GameError("That can't be used like this.");
  if (p.level < c.levelReq) throw new GameError(`${c.name} requires level ${c.levelReq}.`);
  const maxHp = heroStats(g, p).maxHp;
  let healed = 0;
  if (c.healPct) {
    if (p.hp >= maxHp && !c.xpPct) throw new GameError("You're already at full health.");
    const before = p.hp;
    p.hp = Math.min(maxHp, p.hp + Math.round(maxHp * c.healPct));
    p.hpAt = g.clock.now();
    healed = p.hp - before;
  }
  let xp = 0;
  if (c.xpPct) xp = grantXp(g, p, xpPctOfLevel(p, c.xpPct));
  removeQty(g, item, 1);
  bump(g, p, "potionsDrunk");
  bumpMission(p, "potion");
  return { healed, xp };
}
