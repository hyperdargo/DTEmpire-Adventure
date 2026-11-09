import { GEM_BY_ID, GEMS, MAX_SOCKETS, PUNCH_COST, UNSOCKET_COINS } from "../../shared/data/gems.ts";
import { isGear, type ItemRecord } from "../../shared/rules/items.ts";
import { GameError } from "../lib/errors.ts";
import type { GameCtx } from "./context.ts";
import { getOwnedItem } from "./inventory.ts";
import { addStack, countStack, heroStats, spendCoins, takeStack, type Player } from "./player.ts";

function target(g: GameCtx, p: Player, itemId: number): ItemRecord {
  if (g.db.get("SELECT 1 FROM battles WHERE user_id = ? AND status = 'active'", p.userId)) throw new GameError("Finish your current battle first.", { code: "in_battle" });
  const item = getOwnedItem(g, p.userId, itemId);
  if (!isGear(item.templateId)) throw new GameError("Only gear can have sockets.");
  if (item.locked) throw new GameError("Unlock that gear first.");
  return item;
}

function writeSockets(g: GameCtx, p: Player, item: ItemRecord, sockets: (string | null)[]) {
  const before = heroStats(g, p).maxHp;
  g.db.run("UPDATE items SET sockets = ? WHERE id = ? AND owner_id = ?", JSON.stringify(sockets), item.id, p.userId);
  const after = heroStats(g, p).maxHp;
  p.hp = Math.max(1, Math.round(after * Math.min(1, p.hp / before)));
  return { itemId: item.id, sockets };
}

export function gemsView(g: GameCtx, p: Player) {
  return { gems: GEMS.map((gem) => ({ ...gem, qty: countStack(g, p.userId, gem.id) })),
    gear: g.db.all<{ id: number }>("SELECT id FROM items WHERE owner_id = ? AND escrow IS NULL", p.userId)
      .map((r) => getOwnedItem(g, p.userId, r.id)).filter((i) => isGear(i.templateId)),
    punches: countStack(g, p.userId, "jewelers_punch"), punchCost: PUNCH_COST, unsocketCoins: UNSOCKET_COINS, maxSockets: MAX_SOCKETS };
}

export function craftPunch(g: GameCtx, p: Player) {
  for (const [id, qty] of Object.entries(PUNCH_COST.materials)) {
    if (countStack(g, p.userId, id) < qty) throw new GameError("Not enough materials for a Jeweler's Punch.");
  }
  spendCoins(p, PUNCH_COST.coins, "craft a Jeweler's Punch");
  for (const [id, qty] of Object.entries(PUNCH_COST.materials)) takeStack(g, p.userId, id, qty);
  addStack(g, p.userId, "jewelers_punch", 1);
  return { crafted: "jewelers_punch" };
}

export function unlockSocket(g: GameCtx, p: Player, itemId: number) {
  const item = target(g, p, itemId);
  const sockets = [...(item.sockets ?? [])];
  if (sockets.length >= MAX_SOCKETS) throw new GameError("This gear already has two sockets.");
  takeStack(g, p.userId, "jewelers_punch", 1, "Jeweler's Punch");
  sockets.push(null);
  return writeSockets(g, p, item, sockets);
}

export function socketGem(g: GameCtx, p: Player, itemId: number, index: number, gemId: string) {
  if (!GEM_BY_ID[gemId]) throw new GameError("Unknown gem.");
  const item = target(g, p, itemId);
  const sockets = [...(item.sockets ?? [])];
  if (!Number.isInteger(index) || index < 0 || index >= sockets.length || sockets[index] !== null) throw new GameError("Choose an unlocked empty socket.");
  takeStack(g, p.userId, gemId, 1, GEM_BY_ID[gemId]!.name);
  sockets[index] = gemId;
  return writeSockets(g, p, item, sockets);
}

export function unsocketGem(g: GameCtx, p: Player, itemId: number, index: number) {
  const item = target(g, p, itemId);
  const sockets = [...(item.sockets ?? [])];
  const gemId = sockets[index];
  if (!Number.isInteger(index) || index < 0 || !gemId || !GEM_BY_ID[gemId]) throw new GameError("Choose a filled socket.");
  spendCoins(p, UNSOCKET_COINS, "remove a gem");
  addStack(g, p.userId, gemId, 1);
  sockets[index] = null;
  return writeSockets(g, p, item, sockets);
}

export function craftGem(g: GameCtx, p: Player, gemId: string) {
  const gem = GEM_BY_ID[gemId];
  if (!gem || gem.tier >= 4) throw new GameError("Choose a gem below Pristine tier.");
  if (countStack(g, p.userId, gemId) < 3) throw new GameError("You need three matching gems.");
  spendCoins(p, gem.craftCoins, "combine gems");
  takeStack(g, p.userId, gemId, 3, gem.name);
  const result = GEMS.find((v) => v.family === gem.family && v.tier === gem.tier + 1)!;
  addStack(g, p.userId, result.id, 1);
  return { crafted: result.id };
}
