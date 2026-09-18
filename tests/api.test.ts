import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client, makeApp, type TestClock } from "./helpers.ts";
import type { FastifyInstance } from "fastify";
import type { Db } from "../server/db/db.ts";

let app: FastifyInstance;
let db: Db;
let clock: TestClock;

beforeEach(async () => {
  ({ app, db, clock } = await makeApp());
});
afterEach(async () => {
  await app.close();
});

const setLevel = (userId: number, level: number, coins = 1_000_000) =>
  db.run("UPDATE players SET level = ?, coins = ?, hp = 1000000000 WHERE user_id = ?", level, coins, userId);

describe("auth & security", () => {
  it("rejects mutations without the CSRF header or from another origin", async () => {
    const c = new Client(app);
    const noHeader = await c.req("POST", "/api/auth/register", { username: "hero_one", password: "longenough1" }, { csrf: false });
    expect(noHeader.statusCode).toBe(403);
    const foreign = await app.inject({ method: "POST", url: "/api/auth/guest", headers: { "x-dte-request": "1", origin: "https://evil.example" } });
    expect(foreign.statusCode).toBe(403);
  });

  it("registers, logs in, logs out, and protects routes", async () => {
    const c = new Client(app);
    expect((await c.req("GET", "/api/inventory")).statusCode).toBe(401);
    await c.post("/api/auth/register", { username: "Aria", password: "longenough1" });
    const dup = await new Client(app).postErr("/api/auth/register", { username: "aria", password: "longenough1" });
    expect(dup.status).toBe(409);
    const bad = await new Client(app).postErr("/api/auth/login", { username: "Aria", password: "wrong-password" });
    expect(bad.status).toBe(401);
    const me = await c.get("/api/me");
    expect(me.user.username).toBe("Aria");
    expect(me.hero).toBeNull();
    await c.post("/api/auth/logout");
    expect((await c.get("/api/me")).user).toBeNull();
    const again = new Client(app);
    await again.post("/api/auth/login", { username: "aria", password: "longenough1" });
    expect((await again.get("/api/me")).user.username).toBe("Aria");
  });

  it("never stores plaintext passwords or raw session tokens", async () => {
    const c = new Client(app);
    await c.post("/api/auth/register", { username: "Secret", password: "hunter2hunter2" });
    const u = db.get<{ password_hash: string }>("SELECT password_hash FROM users WHERE username = 'Secret'")!;
    expect(u.password_hash).toMatch(/^scrypt\$/);
    const token = c.cookie.split("=")[1]!;
    expect(db.get("SELECT 1 FROM sessions WHERE token_hash = ?", token)).toBeUndefined();
  });

  it("lets a guest play and then save the account", async () => {
    const c = new Client(app);
    await c.post("/api/auth/guest");
    await c.post("/api/hero");
    const chat = await c.postErr("/api/chat", { channel: "world", body: "hi" });
    expect(chat.code).toBe("guest_chat");
    await c.post("/api/auth/upgrade", { username: "SavedHero", password: "longenough1" });
    const me = await c.get("/api/me");
    expect(me.user.isGuest).toBe(false);
    expect(me.hero.name).toBe("SavedHero");
  });
});

describe("hero & combat loop", () => {
  it("creates a hero with a starter kit and plays an adventure battle to rewards", async () => {
    const c = new Client(app);
    const created = await c.signup("Brann");
    expect(created.class.rarity).not.toBe("unique");
    const inv = await c.get("/api/inventory");
    expect(inv.items.filter((i: any) => i.equipped)).toHaveLength(3);
    expect(inv.items.find((i: any) => i.templateId === "health_potion").qty).toBe(5);

    const start = await c.post("/api/adventure/start", { regionId: "dark_forest" });
    expect(start.result.state.enemy.hp).toBeGreaterThan(0);
    expect(start.result.state.seed).toBeUndefined();
    const again = await c.postErr("/api/adventure/start", { regionId: "dark_forest" });
    expect(again.code).toBe("in_battle");

    const r1 = await c.post(`/api/battle/${start.result.id}/act`, { action: { type: "attack" } });
    expect(r1.rounds[0][0]).toEqual({ t: "turn", n: 1 });
    clock.advance(1000);
    const end = await c.finishBattle(start.result.id);
    expect(["won", "lost"]).toContain(end.outcome.result);
    if (end.outcome.result === "won") {
      expect(end.outcome.coins).toBeGreaterThan(0);
      expect(end.me.hero.xp + end.me.hero.level).toBeGreaterThan(1);
    }
  });

  it("validates battle actions server-side", async () => {
    const c = new Client(app);
    await c.signup("Cato");
    const start = await c.post("/api/adventure/start", { regionId: "dark_forest" });
    const bad = await c.postErr(`/api/battle/${start.result.id}/act`, { action: { type: "skill", skillId: "mana_surge" } });
    expect(bad.status).toBe(400);
    const tooFast = await c.postErr(`/api/battle/${start.result.id}/act`, { action: { type: "attack" } });
    expect(tooFast.status).toBe(429);
    clock.advance(1000);
    const potion = await c.postErr(`/api/battle/${start.result.id}/act`, { action: { type: "item", itemId: 999999 } });
    expect(potion.status).toBe(400);
    clock.advance(1000);
    const skill = await c.post(`/api/battle/${start.result.id}/act`, { action: { type: "skill", skillId: "power_strike" } });
    if (skill.battle.state.status === "active") {
      clock.advance(1000);
      const cd = await c.postErr(`/api/battle/${start.result.id}/act`, { action: { type: "skill", skillId: "power_strike" } });
      expect(cd.message).toMatch(/cooldown/);
    }
  });

  it("locks regions and the boss behind progress", async () => {
    const c = new Client(app);
    await c.signup("Dara");
    expect((await c.postErr("/api/adventure/start", { regionId: "primordial_peak" })).code).toBe("level_locked");
    expect((await c.postErr("/api/adventure/start", { regionId: "dark_forest", boss: true })).message).toMatch(/more monsters/);
  });

  it("refuses to start a fight when badly wounded, and HP regenerates over time", async () => {
    const c = new Client(app);
    await c.signup("Eron");
    const me = await c.get("/api/me");
    const uid = me.user.id;
    db.run("UPDATE players SET hp = 1, hp_at = ? WHERE user_id = ?", clock.now(), uid);
    expect((await c.postErr("/api/adventure/start", { regionId: "dark_forest" })).code).toBe("too_wounded");
    clock.advance(240_000);
    expect((await c.get("/api/me")).hero.hp).toBe(me.hero.maxHp);
  });

  it("climbs the tower and completes a story chapter on floor 5", async () => {
    const c = new Client(app);
    await c.signup("Fenn");
    const uid = (await c.get("/api/me")).user.id;
    setLevel(uid, 40);
    db.run("UPDATE players SET tower_floor = 4 WHERE user_id = ?", uid);
    const start = await c.post("/api/tower/start");
    expect(start.result.state.enemy.isBoss).toBe(true);
    // Make the fight decisive for the test.
    const b = db.get<{ state: string }>("SELECT state FROM battles WHERE id = ?", start.result.id)!;
    const state = JSON.parse(b.state);
    state.enemy.hp = 1;
    db.run("UPDATE battles SET state = ? WHERE id = ?", JSON.stringify(state), start.result.id);
    const end = await c.finishBattle(start.result.id);
    expect(end.outcome.result).toBe("won");
    expect(end.outcome.extra.chapter.chapter).toBe(1);
    expect(end.me.hero.towerFloor).toBe(5);
    const mail = await c.get("/api/mail");
    expect(mail.mail.some((m: any) => m.subject.includes("Chapter 1"))).toBe(true);
  });
});

describe("economy", () => {
  it("buys from the market, equips, sells, and blocks double-buying gear", async () => {
    const c = new Client(app);
    await c.signup("Gale");
    const uid = (await c.get("/api/me")).user.id;
    setLevel(uid, 12, 100_000);
    const market = await c.get("/api/market");
    const potion = market.offers.find((o: any) => o.templateId === "health_potion");
    await c.post("/api/market/buy", { offerId: potion.offerId, qty: 3 });
    const gear = market.offers.find((o: any) => o.kind === "gear");
    await c.post("/api/market/buy", { offerId: gear.offerId });
    expect((await c.postErr("/api/market/buy", { offerId: gear.offerId })).message).toMatch(/already bought/);
    const items = (await c.get("/api/inventory")).items;
    const bought = items.find((i: any) => i.templateId === gear.templateId && !i.equipped);
    await c.post("/api/inventory/equip", { itemId: bought.id });
    const sellEquipped = await c.postErr("/api/inventory/sell", { itemId: bought.id });
    expect(sellEquipped.message).toMatch(/Unequip/);
  });

  it("claims the daily reward once per day and builds a streak", async () => {
    const c = new Client(app);
    await c.signup("Hale");
    const first = await c.post("/api/daily/claim");
    expect(first.result.streak).toBe(1);
    expect((await c.postErr("/api/daily/claim")).code).toBe("already_claimed");
    clock.advance(24 * 3600_000);
    expect((await c.post("/api/daily/claim")).result.streak).toBe(2);
    clock.advance(72 * 3600_000);
    expect((await c.post("/api/daily/claim")).result.streak).toBe(1);
  });

  it("claims mail attachments exactly once", async () => {
    const c = new Client(app);
    await c.signup("Iris");
    const before = (await c.get("/api/me")).hero.coins;
    const all = await c.post("/api/mail/claim-all");
    expect(all.result.coins).toBe(500);
    expect(all.me.hero.coins).toBe(before + 500);
    const second = await c.post("/api/mail/claim-all");
    expect(second.result.coins).toBe(0);
  });

  it("hatches eggs and fuses three pets into a better egg", async () => {
    const c = new Client(app);
    await c.signup("Jory");
    const uid = (await c.get("/api/me")).user.id;
    db.run("INSERT INTO items (owner_id, template_id, rarity, ilvl, qty, created_at) VALUES (?, 'slime_egg', 'common', 1, 4, ?)", uid, clock.now());
    const slime = (await c.get("/api/inventory")).items.find((i: any) => i.templateId === "slime_egg");
    const pets = [];
    for (let i = 0; i < 4; i++) pets.push((await c.post("/api/inventory/use", { itemId: slime.id })).result.pet);
    expect(pets[0].active).toBe(true);
    const inactive = pets.filter((p) => !p.active).map((p) => p.id);
    const fused = await c.post("/api/pets/fuse", { petIds: inactive });
    expect(fused.result.rarity).toBe("uncommon");
  });

  it("forges two same-rarity items into a higher rarity", async () => {
    const c = new Client(app);
    await c.signup("Kael");
    const uid = (await c.get("/api/me")).user.id;
    setLevel(uid, 20, 100_000);
    for (let i = 0; i < 2; i++) {
      db.run("INSERT INTO items (owner_id, template_id, rarity, ilvl, qty, base, affixes, created_at) VALUES (?, 'iron_sword', 'common', 10, 1, '{\"atk\":20}', '[]', ?)", uid, clock.now());
    }
    const swords = (await c.get("/api/inventory")).items.filter((i: any) => i.templateId === "iron_sword" && !i.equipped);
    const forged = await c.post("/api/smithy/forge", { aId: swords[0].id, bId: swords[1].id });
    expect(["uncommon", "rare"]).toContain(forged.result.item.rarity);
  });
});

describe("social", () => {
  async function twoPlayers() {
    const a = new Client(app);
    const b = new Client(app);
    await a.signup("Alpha");
    await b.signup("Beta");
    const aId = (await a.get("/api/me")).user.id;
    const bId = (await b.get("/api/me")).user.id;
    setLevel(aId, 30, 50_000);
    setLevel(bId, 30, 50_000);
    return { a, b, aId, bId };
  }

  it("trades items and coins atomically with escrow", async () => {
    const { a, b, bId } = await twoPlayers();
    const armor = (await a.get("/api/inventory")).items.find((i: any) => i.templateId === "leather_armor");
    await a.post("/api/inventory/unequip", { slot: "armor" });
    const created = await a.post("/api/trades", { toId: bId, offerItemIds: [armor.id], offerCoins: 1000, requestCoins: 300 });
    expect(created.me.hero.coins).toBe(49_000);
    expect((await a.get("/api/inventory")).items.some((i: any) => i.id === armor.id)).toBe(false);
    const accepted = await b.post(`/api/trades/${created.result}/accept`);
    expect(accepted.me.hero.coins).toBe(50_000 + 1000 - 300);
    expect((await b.get("/api/inventory")).items.some((i: any) => i.id === armor.id)).toBe(true);
    expect((await a.get("/api/me")).hero.coins).toBe(49_000 + 300);
  });

  it("refunds escrowed coins by mail when a trade expires", async () => {
    const { a, bId } = await twoPlayers();
    await a.post("/api/trades", { toId: bId, offerCoins: 5000 });
    clock.advance(25 * 3600_000);
    await a.get("/api/trades");
    const claim = await a.post("/api/mail/claim-all");
    expect(claim.result.coins).toBeGreaterThanOrEqual(5000);
  });

  it("runs the auction house: list, buy with fee, seller paid by mail", async () => {
    const { a, b } = await twoPlayers();
    const pots = (await a.get("/api/inventory")).items.find((i: any) => i.templateId === "health_potion");
    const listed = await a.post("/api/auctions", { itemId: pots.id, qty: 2, price: 1000, hours: 24 });
    expect((await a.get("/api/inventory")).items.find((i: any) => i.templateId === "health_potion").qty).toBe(3);
    const listings = (await b.get("/api/auctions")).listings;
    expect(listings).toHaveLength(1);
    expect((await a.postErr(`/api/auctions/${listed.result}/buy`)).message).toMatch(/own listing/);
    await b.post(`/api/auctions/${listed.result}/buy`);
    expect((await b.get("/api/inventory")).items.find((i: any) => i.templateId === "health_potion").qty).toBe(7);
    const paid = await a.post("/api/mail/claim-all");
    expect(paid.result.coins).toBeGreaterThanOrEqual(950);
  });

  it("creates guilds, joins, chats in guild, and enforces access", async () => {
    const { a, b, aId } = await twoPlayers();
    const guild = await a.post("/api/guilds", { name: "Iron Wolves", tag: "WOLF", emblem: "🐺", description: "Howl." });
    await b.post(`/api/guilds/${guild.result}/join`);
    const detail = await b.get(`/api/guilds/${guild.result}`);
    expect(detail.members).toHaveLength(2);
    await b.post("/api/chat", { channel: `guild:${guild.result}`, body: "hello wolves" });
    const outsider = new Client(app);
    await outsider.signup("Gamma");
    const denied = await outsider.req("GET", `/api/chat?channel=guild:${guild.result}`);
    expect(denied.statusCode).toBe(403);
    const kick = await b.postErr("/api/guild/member", { userId: aId, action: "kick" });
    expect(kick.status).toBe(403);
  });

  it("sanitizes chat and rate-limits spam", async () => {
    const { a } = await twoPlayers();
    const msg = await a.post("/api/chat", { channel: "world", body: "  <script>alert(1)</script>‮  " });
    expect(msg.message.body).toBe("<script>alert(1)</script>");
    const spam = await a.postErr("/api/chat", { channel: "world", body: "again" });
    expect(spam.status).toBe(429);
  });

  it("friends and blocks", async () => {
    const { a, b, aId, bId } = await twoPlayers();
    await a.post("/api/friends/request", { userId: bId });
    await b.post("/api/friends/respond", { userId: aId, accept: true });
    expect((await a.get("/api/friends")).friends[0].status).toBe("friend");
    await b.post("/api/block", { userId: aId, blocked: true });
    expect((await a.get("/api/friends")).friends).toHaveLength(0);
    const dm = await a.postErr("/api/chat", { channel: `dm:${Math.min(aId, bId)}:${Math.max(aId, bId)}`, body: "hey" });
    expect(dm.status).toBe(403);
  });

  it("serves leaderboards and public profiles without private fields", async () => {
    const { a } = await twoPlayers();
    const board = await a.get("/api/leaderboard/level");
    expect(board.rows.length).toBe(2);
    const profile = await a.get("/api/players/Beta");
    expect(profile.name).toBe("Beta");
    expect(JSON.stringify(profile)).not.toMatch(/password|email|token/i);
  });
});

describe("modes", () => {
  it("runs a dungeon: fight, boon choice, bank the pouch", async () => {
    const c = new Client(app);
    await c.signup("Mira");
    const uid = (await c.get("/api/me")).user.id;
    setLevel(uid, 60);
    await c.post("/api/dungeon/start", { fromFloor: 1 });
    expect((await c.postErr("/api/adventure/start", { regionId: "dark_forest" })).code).toBe("in_dungeon");
    for (let floor = 1; floor <= 3; floor++) {
      const fight = await c.post("/api/dungeon/fight");
      const end = await c.finishBattle(fight.result.id);
      expect(end.outcome.result).toBe("won");
    }
    const view = await c.get("/api/dungeon");
    expect(view.run.pendingBoons).toHaveLength(3);
    await c.post("/api/dungeon/boon", { boonId: view.run.pendingBoons[0].id });
    const left = await c.post("/api/dungeon/leave");
    expect(left.result.coins).toBeGreaterThan(0);
    expect(left.me.hero.dungeonBest).toBe(3);
  });

  it("strikes the world boss and records contribution", async () => {
    const c = new Client(app);
    await c.signup("Nox");
    const uid = (await c.get("/api/me")).user.id;
    setLevel(uid, 30);
    const strike = await c.post("/api/worldboss/strike");
    const end = await c.finishBattle(strike.result.id);
    expect(end.outcome.extra.score).toBeGreaterThan(0);
    const view = await c.get("/api/worldboss");
    expect(view.mine.hits).toBe(1);
    expect(view.hp).toBeLessThan(view.maxHp);
    expect(view.attemptsLeft).toBe(2);
  });

  it("plays a ranked arena match against a player snapshot and moves ratings", async () => {
    const a = new Client(app);
    const b = new Client(app);
    await a.signup("Orin");
    await b.signup("Pyra");
    const aId = (await a.get("/api/me")).user.id;
    const bId = (await b.get("/api/me")).user.id;
    setLevel(aId, 25);
    setLevel(bId, 25);
    const start = await a.post("/api/arena/ranked");
    const end = await a.finishBattle(start.result.id);
    expect(end.outcome.extra.delta).not.toBe(0);
    expect(end.me.hero.arenaRating).toBe(1000 + end.outcome.extra.delta);
  });
});
