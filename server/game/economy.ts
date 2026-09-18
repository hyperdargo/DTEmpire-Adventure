import { CONSUMABLES, CONSUMABLE_BY_ID, GEAR, GEAR_BY_ID, RECIPE_BY_ID } from "../../shared/data/items.ts";
import { GOLDEN_EGG_WEIGHTS, MYSTERY_EGG_WEIGHTS, PET_FUSE_COUNT, PET_SPECIES } from "../../shared/data/pets.ts";
import type { EquipSlot, Rarity } from "../../shared/data/types.ts";
import { forgeResultRarity, rollGear, upgradeCost } from "../../shared/rules/items.ts";
import { GEAR_RARITY_MULT, MAX_UPGRADE, RARITY_INDEX, RARITY_ORDER } from "../../shared/rules/progression.ts";
import { createRng, freshSeed } from "../../shared/rules/rng.ts";
import { toPetView } from "../../shared/rules/views.ts";
import { dayKey } from "../lib/time.ts";
import { GameError, notFound } from "../lib/errors.ts";
import type { GameCtx } from "./context.ts";
import { getOwnedItem } from "./inventory.ts";
import { type MailAttachments, type Player, addGear, addStack, bump, bumpMission, countStack, grantCoins, requireLevel, spendCoins, takeStack } from "./player.ts";

// ── Pets ──────────────────────────────────────────────────────────────

interface PetRow { id: number; species_id: string; rarity: string; level: number; xp: number; active: number; name: string | null }
const petRecord = (r: PetRow) => ({ id: r.id, speciesId: r.species_id, rarity: r.rarity as Rarity, level: r.level, xp: r.xp, active: !!r.active, name: r.name });

export function listPets(g: GameCtx, userId: number) {
  return g.db.all<PetRow>("SELECT * FROM pets WHERE owner_id = ? ORDER BY active DESC, level DESC, id DESC", userId).map((r) => toPetView(petRecord(r)));
}

export function hatchEgg(g: GameCtx, p: Player, templateId: string) {
  const egg = CONSUMABLE_BY_ID[templateId];
  if (!egg || egg.kind !== "egg" || !egg.eggRarity) throw new GameError("That isn't an egg.");
  takeStack(g, p.userId, templateId, 1, egg.name);
  const rng = createRng(freshSeed());
  const rarity: Rarity =
    egg.eggRarity === "mystery" ? rng.weighted(MYSTERY_EGG_WEIGHTS)
    : egg.eggRarity === "golden" ? rng.weighted(GOLDEN_EGG_WEIGHTS)
    : egg.eggRarity;
  const pool = PET_SPECIES.filter((s) => s.rarity === rarity);
  const species = pool.length ? rng.pick(pool) : PET_SPECIES[0]!;
  const hasActive = !!g.db.get("SELECT 1 FROM pets WHERE owner_id = ? AND active = 1", p.userId);
  const id = g.db.run("INSERT INTO pets (owner_id, species_id, rarity, level, xp, active, created_at) VALUES (?, ?, ?, 1, 0, ?, ?)",
    p.userId, species.id, rarity, hasActive ? 0 : 1, g.clock.now()).lastId;
  bump(g, p, "petsHatched");
  bumpMission(p, "hatch");
  if (RARITY_INDEX[rarity] >= RARITY_INDEX.legendary) {
    g.hub.toChannel("world", { type: "feed", icon: species.icon, text: `${p.name} hatched a ${rarity} ${species.name}!`, at: g.clock.now() });
  }
  const row = g.db.get<PetRow>("SELECT * FROM pets WHERE id = ?", id)!;
  return toPetView(petRecord(row));
}

export function setActivePet(g: GameCtx, p: Player, petId: number | null) {
  if (g.db.get("SELECT 1 FROM battles WHERE user_id = ? AND status = 'active'", p.userId)) throw new GameError("Finish your current battle first.");
  if (petId != null && !g.db.get("SELECT 1 FROM pets WHERE id = ? AND owner_id = ?", petId, p.userId)) throw notFound("Pet");
  g.db.run("UPDATE pets SET active = 0 WHERE owner_id = ?", p.userId);
  if (petId != null) g.db.run("UPDATE pets SET active = 1 WHERE id = ?", petId);
}

export function renamePet(g: GameCtx, userId: number, petId: number, name: string) {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 20);
  if (clean.length < 1) throw new GameError("Give your pet a name.");
  const r = g.db.run("UPDATE pets SET name = ? WHERE id = ? AND owner_id = ?", clean, petId, userId);
  if (!r.changes) throw notFound("Pet");
}

/** Fuses PET_FUSE_COUNT inactive pets of one rarity into an egg of the next rarity. */
export function fusePets(g: GameCtx, p: Player, petIds: number[]) {
  const ids = [...new Set(petIds)];
  if (ids.length !== PET_FUSE_COUNT) throw new GameError(`Choose exactly ${PET_FUSE_COUNT} pets to fuse.`);
  const rows = ids.map((id) => g.db.get<PetRow>("SELECT * FROM pets WHERE id = ? AND owner_id = ?", id, p.userId));
  if (rows.some((r) => !r)) throw notFound("Pet");
  const rarity = rows[0]!.rarity as Rarity;
  if (rows.some((r) => r!.rarity !== rarity)) throw new GameError("All pets must share a rarity.");
  if (rows.some((r) => r!.active)) throw new GameError("Your active pet can't be fused.");
  const nextIdx = RARITY_INDEX[rarity] + 1;
  if (nextIdx > RARITY_INDEX.mythic) throw new GameError("Mythic pets can't be fused further.");
  const next = RARITY_ORDER[nextIdx]!;
  const eggId = CONSUMABLES.find((c) => c.kind === "egg" && c.eggRarity === next)?.id;
  if (!eggId) throw new GameError("Nothing can be fused from these.");
  for (const id of ids) g.db.run("DELETE FROM pets WHERE id = ?", id);
  addStack(g, p.userId, eggId, 1);
  return { egg: CONSUMABLE_BY_ID[eggId]!.name, rarity: next };
}

export function releasePet(g: GameCtx, p: Player, petId: number) {
  const row = g.db.get<PetRow>("SELECT * FROM pets WHERE id = ? AND owner_id = ?", petId, p.userId);
  if (!row) throw notFound("Pet");
  if (row.active) throw new GameError("Set another pet active before releasing this one.");
  g.db.run("DELETE FROM pets WHERE id = ?", petId);
  const coins = Math.round((60 + row.level * 25) * Math.pow(2, RARITY_INDEX[row.rarity as Rarity]));
  grantCoins(g, p, coins);
  return coins;
}

// ── Blacksmith ────────────────────────────────────────────────────────

export function craft(g: GameCtx, p: Player, recipeId: string) {
  const recipe = RECIPE_BY_ID[recipeId];
  if (!recipe) throw notFound("Recipe");
  const gear = GEAR_BY_ID[recipe.gearId]!;
  requireLevel(p, gear.levelReq, gear.name);
  for (const [mat, qty] of Object.entries(recipe.materials)) {
    if (countStack(g, p.userId, mat) < qty) throw new GameError(`You need ${qty}× ${CONSUMABLE_BY_ID[mat]?.name ?? mat}.`);
  }
  spendCoins(p, recipe.coins, gear.name);
  for (const [mat, qty] of Object.entries(recipe.materials)) takeStack(g, p.userId, mat, qty);
  const rolled = rollGear(createRng(freshSeed()), gear, Math.max(gear.levelReq, Math.min(p.level, gear.levelReq + 5)), recipe.rarity);
  const id = addGear(g, p.userId, { kind: "gear", templateId: gear.id, rarity: rolled.rarity, ilvl: rolled.ilvl, base: rolled.base as Record<string, number>, affixes: rolled.affixes });
  bump(g, p, "itemsCrafted");
  bumpMission(p, "craft");
  return getOwnedItem(g, p.userId, id);
}

export function upgradeItem(g: GameCtx, p: Player, itemId: number) {
  const item = getOwnedItem(g, p.userId, itemId);
  if (!GEAR_BY_ID[item.templateId]) throw new GameError("Only gear can be upgraded.");
  if (item.upgrade >= MAX_UPGRADE) throw new GameError("That item is fully upgraded.");
  const cost = upgradeCost(item)!;
  for (const [mat, qty] of Object.entries(cost.materials)) {
    if (countStack(g, p.userId, mat) < qty) throw new GameError(`You need ${qty}× ${CONSUMABLE_BY_ID[mat]?.name ?? mat}.`);
  }
  spendCoins(p, cost.coins, "the upgrade");
  for (const [mat, qty] of Object.entries(cost.materials)) takeStack(g, p.userId, mat, qty);
  g.db.run("UPDATE items SET upgrade = upgrade + 1 WHERE id = ?", item.id);
  bump(g, p, "itemsUpgraded");
  bumpMission(p, "craft");
  return getOwnedItem(g, p.userId, item.id);
}

/** Forge two same-slot, same-rarity pieces into one of a higher rarity. Keeps the better base item. */
export function forge(g: GameCtx, p: Player, aId: number, bId: number) {
  if (aId === bId) throw new GameError("Choose two different items.");
  const a = getOwnedItem(g, p.userId, aId);
  const b = getOwnedItem(g, p.userId, bId);
  const ga = GEAR_BY_ID[a.templateId];
  const gb = GEAR_BY_ID[b.templateId];
  if (!ga || !gb) throw new GameError("Only gear can be forged.");
  if (ga.slot !== gb.slot) throw new GameError("Both items must be for the same slot.");
  if (a.rarity !== b.rarity) throw new GameError("Both items must share a rarity.");
  if (a.locked || b.locked || a.equipped || b.equipped) throw new GameError("Unlock and unequip both items first.");
  const rng = createRng(freshSeed());
  const rarity = forgeResultRarity(rng, a.rarity);
  if (!rarity) throw new GameError("Mythic gear is already at the peak of the forge.");
  const keep = a.ilvl >= b.ilvl ? a : b;
  const template = GEAR_BY_ID[keep.templateId]!;
  const coins = Math.round(100 * keep.ilvl * GEAR_RARITY_MULT[rarity]);
  spendCoins(p, coins, "forging");
  g.db.run("DELETE FROM items WHERE id IN (?, ?)", a.id, b.id);
  const rolled = rollGear(rng, template, keep.ilvl, rarity);
  const id = addGear(g, p.userId, { kind: "gear", templateId: template.id, rarity, ilvl: keep.ilvl, base: rolled.base as Record<string, number>, affixes: rolled.affixes });
  g.db.run("UPDATE items SET upgrade = ? WHERE id = ?", Math.max(a.upgrade, b.upgrade), id);
  bump(g, p, "itemsForged");
  bump(g, p, "itemsCrafted");
  bumpMission(p, "craft");
  return { item: getOwnedItem(g, p.userId, id), jumped: RARITY_INDEX[rarity] - RARITY_INDEX[a.rarity] > 1, coins };
}

// ── Market ────────────────────────────────────────────────────────────

export interface ShopOffer {
  offerId: string;
  templateId: string;
  kind: "gear" | "stack";
  rarity: Rarity;
  ilvl: number;
  price: number;
  stock: number | null;
}

const SLOTS: EquipSlot[] = ["weapon", "armor", "helmet", "boots", "accessory"];

/** Staples are always sold; gear rotates daily per player band, so the market is worth checking each day. */
export function marketOffers(g: GameCtx, p: Player): ShopOffer[] {
  const day = dayKey(g.clock.now());
  const offers: ShopOffer[] = [];
  for (const c of CONSUMABLES) {
    if (c.eventOnly) continue;
    if (c.kind === "material" && c.id !== "iron_ore" && c.id !== "silk_cloth") continue;
    if (c.kind === "potion" && (c.levelReq > p.level + 5 || c.levelReq < p.level - 40)) continue;
    if (c.kind === "egg" && !["mystery_egg", "golden_egg", "slime_egg", "forest_egg", "dragon_egg"].includes(c.id)) continue;
    if (c.id === "skill_book" && p.level < 10) continue;
    offers.push({ offerId: `c:${c.id}`, templateId: c.id, kind: "stack", rarity: "common", ilvl: c.levelReq, price: c.basePrice, stock: null });
  }
  const band = Math.max(1, Math.floor(p.level / 5) * 5);
  const rng = createRng(`market:${day}:${band}`);
  for (const slot of SLOTS) {
    const candidates = GEAR.filter((t) => t.slot === slot && !t.eventOnly && t.levelReq <= p.level + 2).sort((x, y) => y.levelReq - x.levelReq).slice(0, 4);
    for (let i = 0; i < 2 && candidates.length; i++) {
      const t = rng.pick(candidates);
      const rarity = rng.weighted<Rarity>({ common: 40, uncommon: 40, rare: 17, epic: 3 });
      const ilvl = Math.max(t.levelReq, Math.min(p.level, t.levelReq + 6));
      const price = Math.round((60 + ilvl * ilvl * 3.2) * Math.pow(GEAR_RARITY_MULT[rarity], 2.4));
      offers.push({ offerId: `g:${day}:${slot}:${i}:${t.id}:${rarity}:${ilvl}`, templateId: t.id, kind: "gear", rarity, ilvl, price, stock: 1 });
    }
  }
  return offers;
}

export function buyOffer(g: GameCtx, p: Player, offerId: string, qty = 1) {
  const offer = marketOffers(g, p).find((o) => o.offerId === offerId);
  if (!offer) throw new GameError("That offer is no longer available.", { code: "offer_gone" });
  if (offer.kind === "stack") {
    const n = Math.max(1, Math.min(99, Math.floor(qty)));
    const c = CONSUMABLE_BY_ID[offer.templateId]!;
    spendCoins(p, offer.price * n, `${n}× ${c.name}`);
    addStack(g, p.userId, offer.templateId, n);
    bumpMission(p, "shop", n);
    return { name: c.name, qty: n, spent: offer.price * n };
  }
  const bought = (p.state as Record<string, unknown>).marketBought as { day: string; ids: string[] } | undefined;
  const day = dayKey(g.clock.now());
  const ids = bought?.day === day ? bought.ids : [];
  if (ids.includes(offerId)) throw new GameError("You already bought that today.");
  const t = GEAR_BY_ID[offer.templateId]!;
  spendCoins(p, offer.price, t.name);
  const rolled = rollGear(createRng(freshSeed()), t, offer.ilvl, offer.rarity);
  addGear(g, p.userId, { kind: "gear", templateId: t.id, rarity: offer.rarity, ilvl: offer.ilvl, base: rolled.base as Record<string, number>, affixes: rolled.affixes });
  (p.state as Record<string, unknown>).marketBought = { day, ids: [...ids, offerId] };
  bumpMission(p, "shop");
  return { name: t.name, qty: 1, spent: offer.price };
}

// ── Mail ──────────────────────────────────────────────────────────────

export function listMail(g: GameCtx, userId: number) {
  const now = g.clock.now();
  return g.db
    .all<{ id: number; sender: string; subject: string; body: string; attachments: string; created_at: number; read_at: number | null; claimed_at: number | null; expires_at: number | null }>(
      "SELECT * FROM mail WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC LIMIT 200", userId, now)
    .map((m) => ({
      id: m.id, sender: m.sender, subject: m.subject, body: m.body, attachments: JSON.parse(m.attachments) as MailAttachments,
      createdAt: m.created_at, read: !!m.read_at, claimed: !!m.claimed_at, expiresAt: m.expires_at,
    }));
}

export function unreadMailCount(g: GameCtx, userId: number) {
  return g.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM mail WHERE user_id = ? AND read_at IS NULL AND (expires_at IS NULL OR expires_at > ?)", userId, g.clock.now())?.n ?? 0;
}

export function claimMail(g: GameCtx, p: Player, mailId: number) {
  const m = g.db.get<{ id: number; attachments: string; claimed_at: number | null }>("SELECT id, attachments, claimed_at FROM mail WHERE id = ? AND user_id = ?", mailId, p.userId);
  if (!m) throw notFound("Mail");
  g.db.run("UPDATE mail SET read_at = COALESCE(read_at, ?) WHERE id = ?", g.clock.now(), m.id);
  if (m.claimed_at) return { coins: 0, stacks: {}, items: 0 };
  const a = JSON.parse(m.attachments) as MailAttachments;
  if (a.coins) grantCoins(g, p, a.coins);
  for (const [t, q] of Object.entries(a.stacks ?? {})) addStack(g, p.userId, t, q);
  for (const id of a.itemIds ?? []) g.db.run("UPDATE items SET owner_id = ?, escrow = NULL WHERE id = ? AND escrow = ?", p.userId, id, `mail:${m.id}`);
  g.db.run("UPDATE mail SET claimed_at = ? WHERE id = ?", g.clock.now(), m.id);
  return { coins: a.coins ?? 0, stacks: a.stacks ?? {}, items: a.itemIds?.length ?? 0 };
}

export function claimAllMail(g: GameCtx, p: Player) {
  const ids = g.db.all<{ id: number }>("SELECT id FROM mail WHERE user_id = ? AND claimed_at IS NULL AND (expires_at IS NULL OR expires_at > ?)", p.userId, g.clock.now());
  const total = { coins: 0, stacks: {} as Record<string, number>, items: 0, count: ids.length };
  for (const { id } of ids) {
    const r = claimMail(g, p, id);
    total.coins += r.coins;
    total.items += r.items;
    for (const [t, q] of Object.entries(r.stacks)) total.stacks[t] = (total.stacks[t] ?? 0) + q;
  }
  return total;
}

export function deleteReadMail(g: GameCtx, userId: number) {
  return g.db.run("DELETE FROM mail WHERE user_id = ? AND claimed_at IS NOT NULL", userId).changes;
}
