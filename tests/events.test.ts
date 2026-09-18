// Seasonal events: the Harvest Moon Festival ported from the original game.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Db } from "../server/db/db.ts";
import { EVENT_BY_ID, activeEvent } from "../shared/data/events.ts";
import { GEAR, CONSUMABLES } from "../shared/data/items.ts";
import { pickGearTemplate } from "../shared/rules/items.ts";
import { createRng } from "../shared/rules/rng.ts";
import { Client, makeApp, testClock, type TestClock } from "./helpers.ts";

let app: FastifyInstance;
let db: Db;
let clock: TestClock;

// The default test clock (2026-09-17) sits inside the Harvest Moon Festival window.
beforeEach(async () => {
  ({ app, db, clock } = await makeApp());
});
afterEach(async () => {
  await app.close();
});

const EVENT = "harvest_moon_2026";
const giveTokens = (userId: number, tokens: number) =>
  db.run("UPDATE players SET state = json_set(state, '$.events', json(?)) WHERE user_id = ?",
    JSON.stringify({ [EVENT]: { tokens, earned: tokens, kills: 3, bossKills: 0, purchased: [] } }), userId);

describe("seasonal events", () => {
  it("knows when a festival is running", () => {
    expect(activeEvent(Date.UTC(2026, 8, 20))?.id).toBe(EVENT);
    expect(activeEvent(Date.UTC(2026, 8, 15))).toBeNull();
    expect(activeEvent(Date.UTC(2026, 10, 1))).toBeNull();
    expect(EVENT_BY_ID[EVENT]!.monsters.filter((m) => m.tier === "boss")).toHaveLength(1);
  });

  it("shows the festival, its stalls and the standings", async () => {
    const c = new Client(app);
    await c.signup("Moonhunter");
    const view = await c.get("/api/event");
    expect(view.active).toBe(true);
    expect(view.event.name).toBe("Harvest Moon Festival");
    expect(view.shop).toHaveLength(6);
    expect(view.shop.every((s: any) => !s.affordable)).toBe(true);
    expect(view.mine.tokens).toBe(0);
  });

  it("gates the hunt by level and pays tokens for a win", async () => {
    const c = new Client(app);
    await c.signup("Lunara");
    const uid = (await c.get("/api/me")).user.id;
    expect((await c.postErr("/api/event/fight")).code).toBe("level_locked");

    db.run("UPDATE players SET level = 20, hp = 100000 WHERE user_id = ?", uid);
    const start = await c.post("/api/event/fight");
    expect(["Lunar Hare", "Moonlit Stalker", "Harvest Wraith", "Crescent Golem", "Selene's Shadow"]).toContain(start.result.state.enemy.name);
    const end = await c.finishBattle(start.result.id);
    if (end.outcome.result === "won") {
      expect(end.outcome.extra.tokens).toBeGreaterThan(0);
      expect(end.outcome.extra.currency).toBe("Moon Tokens");
      const view = await c.get("/api/event");
      expect(view.mine.tokens).toBe(end.outcome.extra.balance);
      expect(view.mine.kills).toBe(1);
      expect(view.leaderboard[0].name).toBe("Lunara");
    }
    // The festival cooldown gates repeat hunts; healthy heroes can go again after it.
    db.run("UPDATE players SET hp = 100000, hp_at = ? WHERE user_id = ?", clock.now(), uid);
    expect((await c.postErr("/api/event/fight")).code).toBe("rate_limited");
    clock.advance(5000);
    expect((await c.req("POST", "/api/event/fight", {})).statusCode).toBe(200);
  });

  it("sells festival goods for tokens, once each where it should be", async () => {
    const c = new Client(app);
    await c.signup("Selene");
    const uid = (await c.get("/api/me")).user.id;
    db.run("UPDATE players SET level = 40 WHERE user_id = ?", uid);
    expect((await c.postErr("/api/event/buy", { entryId: "moonlight_blade" })).code).toBe("insufficient_tokens");

    giveTokens(uid, 300);
    const blade = await c.post("/api/event/buy", { entryId: "moonlight_blade" });
    expect(blade.result.item.rarity).toBe("legendary");
    expect(blade.result.item.ilvl).toBe(40);
    expect((await c.postErr("/api/event/buy", { entryId: "moonlight_blade" })).message).toMatch(/already claimed/i);

    const title = await c.post("/api/event/buy", { entryId: "festival_title_scroll" });
    expect(title.result.name).toContain("Moon Champion");
    expect((await c.get("/api/achievements")).titles).toContain("🌙 Moon Champion");

    // Consumables can be bought repeatedly while tokens last.
    await c.post("/api/event/buy", { entryId: "moonbeam_elixir" });
    const after = await c.post("/api/event/buy", { entryId: "moonbeam_elixir" });
    expect(after.result.name).toBe("Moonbeam Elixir");
    const potions = (await c.get("/api/inventory")).items.find((i: any) => i.templateId === "moonbeam_elixir");
    expect(potions.qty).toBe(2);
    expect((await c.get("/api/event")).mine.tokens).toBe(300 - 80 - 100 - 30 - 30);
  });

  it("closes cleanly when no festival is running", async () => {
    const late = testClock(Date.UTC(2026, 10, 5, 12));
    const { app: app2 } = await makeApp(late);
    const c = new Client(app2);
    await c.signup("Afterglow");
    expect((await c.get("/api/event")).active).toBe(false);
    expect((await c.postErr("/api/event/fight")).code).toBe("no_event");
    expect((await c.postErr("/api/event/buy", { entryId: "moonlight_blade" })).code).toBe("no_event");
    await app2.close();
  });

  it("keeps festival items out of drops and the market", async () => {
    const eventGear = GEAR.filter((g) => g.eventOnly).map((g) => g.id);
    const eventStacks = CONSUMABLES.filter((c) => c.eventOnly).map((c) => c.id);
    expect(eventGear).toContain("moonlight_blade");
    const rng = createRng("drops");
    for (let i = 0; i < 400; i++) expect(eventGear).not.toContain(pickGearTemplate(rng, 60).id);

    const c = new Client(app);
    await c.signup("Marketeer");
    const uid = (await c.get("/api/me")).user.id;
    db.run("UPDATE players SET level = 50, coins = 500000 WHERE user_id = ?", uid);
    const offers = (await c.get("/api/market")).offers.map((o: any) => o.templateId);
    for (const id of [...eventGear, ...eventStacks]) expect(offers).not.toContain(id);
  });
});
