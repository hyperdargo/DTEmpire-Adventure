import { CONSUMABLE_BY_ID, GEAR_BY_ID } from "../../shared/data/items.ts";
import { MERCHANT_OFFERS, MERCHANT_OFFER_BY_ID, STACK_PAWN_RATES, type MerchantOfferDef } from "../../shared/data/merchant.ts";
import type { ItemView } from "../../shared/data/types.ts";
import { rollGear, sellPrice } from "../../shared/rules/items.ts";
import { createRng, freshSeed } from "../../shared/rules/rng.ts";
import { toItemView } from "../../shared/rules/views.ts";
import { GameError, notFound } from "../lib/errors.ts";
import type { GameCtx } from "./context.ts";
import { type Player, addGear, addStack, bumpMission, itemFromRow, spendCoins, takeStack } from "./player.ts";

export interface PawnableStack {
  templateId: string;
  name: string;
  icon: string;
  qty: number;
  unitPawnPrice: number;
  totalPawnPrice: number;
}

export interface PawnableGear {
  id: number;
  templateId: string;
  name: string;
  icon: string;
  rarity: string;
  ilvl: number;
  upgrade: number;
  pawnPrice: number;
  view: ItemView;
}

export interface MerchantView {
  offers: MerchantOfferDef[];
  pawnableStacks: PawnableStack[];
  pawnableGear: PawnableGear[];
}

export function getMerchantView(g: GameCtx, p: Player): MerchantView {
  // 1. Merchant offers
  const offers = MERCHANT_OFFERS;

  // 2. Player's pawnable stacks (materials, eggs, books, rare consumables)
  const stackRows = g.db.all<{ template_id: string; qty: number }>(
    "SELECT template_id, qty FROM items WHERE owner_id = ? AND base = '{}' AND escrow IS NULL AND qty > 0",
    p.userId
  );

  const pawnableStacks: PawnableStack[] = [];
  for (const row of stackRows) {
    const c = CONSUMABLE_BY_ID[row.template_id];
    if (!c) continue;
    const unitPawnPrice = STACK_PAWN_RATES[row.template_id] ?? Math.max(10, Math.round(c.sellPrice * 2.5));
    pawnableStacks.push({
      templateId: row.template_id,
      name: c.name,
      icon: c.icon,
      qty: row.qty,
      unitPawnPrice,
      totalPawnPrice: unitPawnPrice * row.qty,
    });
  }
  // Sort stacks: highest unit pawn price first
  pawnableStacks.sort((a, b) => b.unitPawnPrice - a.unitPawnPrice);

  // 3. Player's unequipped gear (high pawn rates: 1.6x standard sell price)
  const gearRows = g.db.all(
    "SELECT * FROM items WHERE owner_id = ? AND base != '{}' AND equipped = 0 AND locked = 0 AND escrow IS NULL ORDER BY ilvl DESC, id DESC LIMIT 50",
    p.userId
  );

  const pawnableGear: PawnableGear[] = gearRows.map((r) => {
    const item = itemFromRow(r as never);
    const gDef = GEAR_BY_ID[item.templateId];
    const basePawn = sellPrice(item);
    const premiumPawn = Math.round(basePawn * 1.6);
    return {
      id: item.id,
      templateId: item.templateId,
      name: gDef?.name ?? item.templateId,
      icon: gDef?.icon ?? "⚔️",
      rarity: item.rarity,
      ilvl: item.ilvl,
      upgrade: item.upgrade,
      pawnPrice: premiumPawn,
      view: toItemView(item),
    };
  });

  return { offers, pawnableStacks, pawnableGear };
}

export function buyMerchantOffer(g: GameCtx, p: Player, offerId: string, qty = 1) {
  const offer = MERCHANT_OFFER_BY_ID[offerId];
  if (!offer) throw notFound("Merchant offer");

  if (p.level < offer.levelReq) {
    throw new GameError(`This coveted item requires Level ${offer.levelReq}.`, { code: "level_locked" });
  }

  if (offer.kind === "stack") {
    const n = Math.max(1, Math.min(999, Math.floor(qty)));
    const totalCost = offer.buyPrice * n;
    spendCoins(p, totalCost, `${n}× ${offer.name} (Merchant)`);
    addStack(g, p.userId, offer.templateId, n);
    bumpMission(p, "shop", n);
    return { name: offer.name, qty: n, spent: totalCost, templateId: offer.templateId };
  }

  // Gear purchase
  const totalCost = offer.buyPrice;
  spendCoins(p, totalCost, `${offer.name} (Merchant)`);

  const t = GEAR_BY_ID[offer.templateId];
  if (!t) throw notFound("Gear template");

  const rolled = rollGear(createRng(freshSeed()), t, offer.ilvl, offer.rarity);
  const gearId = addGear(g, p.userId, {
    kind: "gear",
    templateId: t.id,
    rarity: offer.rarity,
    ilvl: offer.ilvl,
    base: rolled.base as Record<string, number>,
    affixes: rolled.affixes,
  });

  bumpMission(p, "shop", 1);
  return { id: gearId, name: t.name, qty: 1, spent: totalCost, templateId: t.id };
}

export function sellToMerchant(
  g: GameCtx,
  p: Player,
  target: { kind: "stack"; templateId: string; qty: number } | { kind: "gear"; itemId: number }
) {
  if (target.kind === "stack") {
    const templateId = target.templateId;
    const n = Math.max(1, Math.min(999, Math.floor(target.qty)));
    const c = CONSUMABLE_BY_ID[templateId];
    if (!c) throw notFound("Item");

    // Verify player has enough quantity
    takeStack(g, p.userId, templateId, n, c.name);

    const unitPawnPrice = STACK_PAWN_RATES[templateId] ?? Math.max(10, Math.round(c.sellPrice * 2.5));
    const totalEarned = unitPawnPrice * n;
    p.coins += totalEarned;
    bumpMission(p, "sell", n);

    return { name: c.name, qty: n, earned: totalEarned };
  }

  // Selling gear
  const row = g.db.get("SELECT * FROM items WHERE id = ? AND owner_id = ? AND escrow IS NULL", target.itemId, p.userId);
  if (!row) throw notFound("Item");
  const item = itemFromRow(row as never);
  if (item.equipped) throw new GameError("Unequip it before selling to the merchant.");
  if (item.locked) throw new GameError("That item is locked. Unlock it first.");

  const gDef = GEAR_BY_ID[item.templateId];
  const basePawn = sellPrice(item);
  const earned = Math.round(basePawn * 1.6);

  g.db.run("DELETE FROM items WHERE id = ?", item.id);
  p.coins += earned;
  bumpMission(p, "sell", 1);

  return { name: gDef?.name ?? item.templateId, qty: 1, earned };
}
