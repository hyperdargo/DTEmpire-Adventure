import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { Client, makeApp, testClock, type TestClock } from "./helpers.ts";
import { logEvent, getLogbook } from "../server/game/logbook.ts";
import { ACHIEVEMENTS } from "../shared/data/meta.ts";
import { bump, loadPlayer, savePlayer } from "../server/game/player.ts";

let app: FastifyInstance;
let clock: TestClock;

beforeEach(async () => {
  clock = testClock();
  ({ app } = await makeApp(clock));
});

afterEach(async () => {
  await app.close();
});

describe("Adventurer's Logbook", () => {
  it("records and retrieves events", async () => {
    const c = new Client(app);
    await c.signup("LogbookHero");
    const g = app.game;
    const userId = 1;

    logEvent(g, userId, "level_up", "Reached level 5!", "⭐", { level: 5 });
    clock.advance(100);
    logEvent(g, userId, "boss_kill", "Defeated the Dragon King", "🐉", {});

    const entries = getLogbook(g, userId);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.kind).toBe("boss_kill"); // newest first
    expect(entries[1]!.kind).toBe("level_up");
    expect(entries[0]!.text).toBe("Defeated the Dragon King");
    expect(entries[1]!.meta).toEqual({ level: 5 });
  });

  it("limits to 200 entries per player", async () => {
    const c = new Client(app);
    await c.signup("SpamHero");
    const g = app.game;
    const userId = 1;

    for (let i = 0; i < 210; i++) {
      clock.advance(10);
      logEvent(g, userId, "milestone", `Event ${i}`, "📝");
    }

    const all = getLogbook(g, userId, 999);
    expect(all.length).toBeLessThanOrEqual(200);
  });

  it("supports pagination via before parameter", async () => {
    const c = new Client(app);
    await c.signup("PagingHero");
    const g = app.game;
    const userId = 1;

    logEvent(g, userId, "level_up", "Event 1", "⭐");
    clock.advance(1000);
    logEvent(g, userId, "boss_kill", "Event 2", "🐉");

    const page1 = getLogbook(g, userId, 1);
    expect(page1).toHaveLength(1);
    expect(page1[0]!.kind).toBe("boss_kill");

    const page2 = getLogbook(g, userId, 1, page1[0]!.createdAt);
    expect(page2).toHaveLength(1);
    expect(page2[0]!.kind).toBe("level_up");
  });

  it("GET /api/logbook returns entries for authenticated user", async () => {
    const c = new Client(app);
    await c.signup("ApiLogHero");
    const g = app.game;
    const userId = 1;

    logEvent(g, userId, "achievement", "Test Achievement", "🏆", { achievementId: "first_blood" });
    clock.advance(500);
    logEvent(g, userId, "boss_kill", "Defeated Boss", "👑", {});

    const res = await c.get<{ entries: any[] }>("/api/logbook");
    expect(res.entries).toHaveLength(2);
    expect(res.entries[0]!.kind).toBe("boss_kill");

    const paged = await c.get<{ entries: any[] }>(`/api/logbook?before=${res.entries[0]!.createdAt}`);
    expect(paged.entries).toHaveLength(1);
    expect(paged.entries[0]!.kind).toBe("achievement");
  });

  it("logs an event when an achievement is unlocked", async () => {
    const c = new Client(app);
    await c.signup("AchievementHero");
    const g = app.game;

    // Trigger first_blood achievement by bumping battlesWon
    const p = loadPlayer(g, 1);
    bump(g, p, "battlesWon", 1);

    const entries = getLogbook(g, 1);
    const achEntry = entries.find((e) => e.kind === "achievement");
    expect(achEntry).toBeDefined();
    expect(achEntry?.text).toContain("Unlocked: First Blood");
  });

  it("logs a boss kill in payVictory", async () => {
    const c = new Client(app);
    await c.signup("BossSlayer");
    const g = app.game;

    const p = loadPlayer(g, 1);
    const { payVictory } = await import("../server/game/pve.ts");
    payVictory(g, p, { level: 10, coins: 500, xp: 500, boss: true, source: "adventure" });

    const entries = getLogbook(g, 1);
    const bossEntry = entries.find((e) => e.kind === "boss_kill");
    expect(bossEntry).toBeDefined();
    expect(bossEntry?.text).toBe("Defeated a boss!");
    expect(bossEntry?.icon).toBe("👑");
  });
});

describe("Title Compendium", () => {
  it("GET /api/titles returns all earnable titles and progress", async () => {
    const c = new Client(app);
    await c.signup("TitleHero");

    const withTitles = ACHIEVEMENTS.filter((a) => a.title);
    expect(withTitles.length).toBeGreaterThan(0);

    const res = await c.get<{
      active: string | null;
      earned: number;
      total: number;
      completionPct: number;
      titles: { title: string; source: string; desc: string; icon: string; progress: number; goal: number; earned: boolean }[];
    }>("/api/titles");

    expect(res.total).toBe(withTitles.length);
    expect(res.earned).toBe(0);
    expect(res.completionPct).toBe(0);
    expect(res.titles).toHaveLength(withTitles.length);

    const first = res.titles[0]!;
    expect(first.title).toBeTruthy();
    expect(first.source).toContain("Achievement:");
    expect(first.desc).toBeTruthy();
    expect(first.icon).toBeTruthy();
    expect(first.earned).toBe(false);
  });

  it("tracks earned titles and increases completion percentage", async () => {
    const c = new Client(app);
    await c.signup("TitleEarner");
    const g = app.game;

    // Unlock an achievement that awards a title: e.g. "boss_25" gives "Boss Breaker"
    const p = loadPlayer(g, 1);
    bump(g, p, "bossKills", 25);
    savePlayer(g, p);

    const res = await c.get<{
      active: string | null;
      earned: number;
      total: number;
      completionPct: number;
      titles: { title: string; earned: boolean; progress: number; goal: number }[];
    }>("/api/titles");

    expect(res.earned).toBeGreaterThanOrEqual(1);
    expect(res.completionPct).toBeGreaterThan(0);

    const breaker = res.titles.find((t) => t.title === "Boss Breaker");
    expect(breaker).toBeDefined();
    expect(breaker?.earned).toBe(true);
    expect(breaker?.progress).toBe(25);
  });
});
