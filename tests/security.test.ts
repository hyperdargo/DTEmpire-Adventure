// Abuse cases: one player acting on another's things, double claims, and escrow loopholes.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Db } from "../server/db/db.ts";
import { Client, makeApp, type TestClock } from "./helpers.ts";

let app: FastifyInstance;
let db: Db;
let clock: TestClock;

beforeEach(async () => {
  ({ app, db, clock } = await makeApp());
});
afterEach(async () => {
  await app.close();
});

async function pair() {
  const a = new Client(app);
  const b = new Client(app);
  await a.signup("Alice");
  await b.signup("Bob");
  const aId = (await a.get("/api/me")).user.id;
  const bId = (await b.get("/api/me")).user.id;
  db.run("UPDATE players SET level = 30, coins = 100000, hp = 100000 WHERE user_id IN (?, ?)", aId, bId);
  return { a, b, aId, bId };
}

describe("authorization", () => {
  it("refuses to touch another player's items, mail, battles and trades", async () => {
    const { a, b, aId, bId } = await pair();
    const aItem = (await a.get("/api/inventory")).items.find((i: any) => i.templateId === "health_potion");
    const aMail = (await a.get("/api/mail")).mail[0];

    expect((await b.postErr("/api/inventory/equip", { itemId: aItem.id })).status).toBe(404);
    expect((await b.postErr("/api/inventory/sell", { itemId: aItem.id })).status).toBe(404);
    expect((await b.postErr("/api/inventory/lock", { itemId: aItem.id, locked: true })).status).toBe(404);
    expect((await b.postErr("/api/mail/claim", { mailId: aMail.id })).status).toBe(404);

    const battle = await a.post("/api/adventure/start", { regionId: "dark_forest" });
    expect((await b.postErr(`/api/battle/${battle.result.id}/act`, { action: { type: "attack" } })).status).toBe(404);
    expect((await b.postErr(`/api/battle/${battle.result.id}/auto`, {})).status).toBe(404);

    const trade = await a.post("/api/trades", { toId: bId, offerCoins: 100 });
    const outsider = new Client(app);
    await outsider.signup("Mallory");
    expect((await outsider.postErr(`/api/trades/${trade.result}/accept`)).status).toBe(403);
    expect((await a.postErr(`/api/trades/${trade.result}/accept`)).status).toBe(403);
    expect((await b.postErr(`/api/trades/${trade.result}/cancel`)).status).toBe(403);
    void aId;
  });

  it("keeps escrowed items out of every other flow", async () => {
    const { a, bId } = await pair();
    const potion = (await a.get("/api/inventory")).items.find((i: any) => i.templateId === "health_potion");
    await a.post("/api/trades", { toId: bId, offerItemIds: [potion.id] });
    // Escrowed: invisible to the bag, unusable, unsellable, and not offerable again.
    expect((await a.get("/api/inventory")).items.some((i: any) => i.id === potion.id)).toBe(false);
    expect((await a.postErr("/api/inventory/sell", { itemId: potion.id })).status).toBe(404);
    expect((await a.postErr("/api/inventory/use", { itemId: potion.id })).status).toBe(404);
    expect((await a.postErr("/api/trades", { toId: bId, offerItemIds: [potion.id] })).status).toBe(404);
    expect((await a.postErr("/api/auctions", { itemId: potion.id, qty: 1, price: 100, hours: 24 })).status).toBe(404);
  });

  it("cannot claim the same reward twice", async () => {
    const { a } = await pair();
    await a.post("/api/daily/claim");
    expect((await a.postErr("/api/daily/claim")).code).toBe("already_claimed");
    const before = (await a.get("/api/me")).hero.coins;
    await a.post("/api/mail/claim-all");
    await a.post("/api/mail/claim-all");
    const mailId = (await a.get("/api/mail")).mail[0].id;
    await a.post("/api/mail/claim", { mailId });
    expect((await a.get("/api/me")).hero.coins).toBe(before + 500);
  });

  it("validates ownership and funds when buying at auction", async () => {
    const { a, b } = await pair();
    const potion = (await a.get("/api/inventory")).items.find((i: any) => i.templateId === "health_potion");
    const listing = await a.post("/api/auctions", { itemId: potion.id, qty: 1, price: 1_000_000, hours: 24 });
    db.run("UPDATE players SET coins = 10 WHERE user_id = (SELECT user_id FROM players pl JOIN users u ON u.id = pl.user_id WHERE u.username = 'Bob')");
    expect((await b.postErr(`/api/auctions/${listing.result}/buy`)).code).toBe("insufficient_coins");
    const outsider = new Client(app);
    await outsider.signup("Eve");
    expect((await outsider.postErr(`/api/auctions/${listing.result}/cancel`)).status).toBe(403);
  });

  it("refuses spending more coins than you have", async () => {
    const c = new Client(app);
    await c.signup("Poorly");
    const err = await c.postErr("/api/trades", { toId: 99999, offerCoins: 10_000_000 });
    expect([400, 404]).toContain(err.status);
    const skills = await c.postErr("/api/skills/learn", { skillId: "mana_surge" });
    expect(skills.code).toBe("level_locked");
  });

  it("hides battle randomness and other players' private fields", async () => {
    const { a } = await pair();
    const battle = await a.post("/api/adventure/start", { regionId: "dark_forest" });
    expect(JSON.stringify(battle.result)).not.toContain("seed");
    const profile = await a.get("/api/players/Bob");
    const text = JSON.stringify(profile);
    for (const secret of ["password", "email", "token", "session", "legacy_id"]) expect(text.toLowerCase()).not.toContain(secret);
  });

  it("keeps guests out of trading and the auction house", async () => {
    const guest = new Client(app);
    await guest.post("/api/auth/guest");
    await guest.post("/api/hero");
    expect((await guest.postErr("/api/trades", { toId: 1, offerCoins: 1 })).code).toBe("guest_trade");
    expect((await guest.postErr("/api/auctions", { itemId: 1, qty: 1, price: 50, hours: 24 })).code).toBe("guest_trade");
  });

  it("stops battle actions once the battle is over", async () => {
    const { a } = await pair();
    const battle = await a.post("/api/adventure/start", { regionId: "dark_forest" });
    await a.post(`/api/battle/${battle.result.id}/auto`, { usePotions: false });
    clock.advance(1000);
    expect((await a.postErr(`/api/battle/${battle.result.id}/act`, { action: { type: "attack" } })).status).toBe(404);
    clock.advance(1000);
    expect((await a.postErr(`/api/battle/${battle.result.id}/forfeit`)).status).toBe(404);
  });
});
