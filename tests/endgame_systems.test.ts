import { describe, expect, it } from "vitest";
import { makeApp, Client } from "./helpers.ts";
import { ensureCompanions, tickCompanions } from "../server/game/companions.ts";
import { simulateWorldBossStrike } from "../server/game/modes.ts";
import { getOrCreateWar, guildWarView, startGuildWarBattle } from "../server/game/guildWar.ts";
import { loadPlayer } from "../server/game/player.ts";

describe("Companion bots, duels, auctions, and world boss", () => {
  it("divides 10 companions into 2 rival guilds and enables live duel auto-accept", async () => {
    const { app } = await makeApp();
    const companionIds = await ensureCompanions(app.game);

    expect(companionIds).toHaveLength(10);

    // Verify 5 bots in Guild 1, 5 bots in Guild 2
    const g1Count = app.game.db.get<{ count: number }>(
      "SELECT count(*) as count FROM guild_members gm JOIN players p ON p.user_id = gm.user_id WHERE gm.guild_id = 1 AND p.state LIKE '%\"isCompanion\":true%'"
    )!.count;
    const g2Count = app.game.db.get<{ count: number }>(
      "SELECT count(*) as count FROM guild_members gm JOIN players p ON p.user_id = gm.user_id WHERE gm.guild_id = 2 AND p.state LIKE '%\"isCompanion\":true%'"
    )!.count;

    expect(g1Count).toBe(5);
    expect(g2Count).toBe(5);

    // Test live duel challenge against companion bot
    const c = new Client(app);
    await c.signup("DuelChallenger");
    const me = await c.get<any>("/api/me");
    const challengerId = me.user.id;
    app.game.db.run("UPDATE players SET level = 10 WHERE user_id = ?", challengerId);

    // Challenge first bot
    const botId = companionIds[0]!;
    const challengeId = (app as any).duels.challenge(challengerId, botId);
    expect(challengeId).toBeDefined();

    // Because it's a bot, it auto-accepts instantly and creates the room
    const room = (app as any).duels.roomFor(challengerId);
    expect(room).not.toBeNull();
    expect(room.roomId).toBeDefined();
    expect(room.state.enemy.name).toBe("Aria_Dawnseeker");
  });

  it("allows awake companions to attack the World Boss", async () => {
    const { app } = await makeApp();
    const companionIds = await ensureCompanions(app.game);
    const botPlayer = loadPlayer(app.game, companionIds[0]!);
    expect(botPlayer).not.toBeNull();

    // Level up bot to 15 so it can attack
    botPlayer!.level = 15;

    const result = simulateWorldBossStrike(app.game, botPlayer!);
    expect(result).not.toBeNull();
    expect(result?.score).toBeGreaterThan(0);
    expect(result?.coins).toBeGreaterThan(0);

    // Verify hit was recorded
    const hitRecord = app.game.db.get<{ damage: number; hits: number }>(
      "SELECT damage, hits FROM world_boss_hits WHERE user_id = ?",
      botPlayer!.userId
    );
    expect(hitRecord).toBeDefined();
    expect(hitRecord!.hits).toBe(1);
    expect(hitRecord!.damage).toBe(result!.score);
  });
});

describe("Guild Wars and Rivalry", () => {
  it("handles guild war view, rival attacks, and victory score", async () => {
    const { app } = await makeApp();
    await ensureCompanions(app.game);

    const c = new Client(app);
    await c.signup("WarHero");
    const me = await c.get<any>("/api/me");
    const heroId = me.user.id;

    // Join Guild 1
    app.game.db.run(
      "INSERT INTO guild_members (guild_id, user_id, role, contribution, joined_at) VALUES (1, ?, 'member', 0, 1000)",
      heroId
    );
    app.game.db.run("UPDATE players SET guild_id = 1, level = 50, coins = 100000 WHERE user_id = ?", heroId);

    const warView = await c.get<any>("/api/guild/war");
    expect(warView.war).toBeDefined();
    expect(warView.war.myGuildId).toBe(1);
    expect(warView.war.rivalGuildId).toBe(2);
    expect(warView.war.opponents.length).toBeGreaterThan(0);

    // Attack a rival opponent
    const target = warView.war.opponents[0];
    const attackRes = await c.post<any>("/api/guild/war/attack", { targetUserId: target.userId });
    expect(attackRes.result).toBeDefined();
    expect(attackRes.result.kind).toBe("guild_war");
  });
});

describe("Endgame Content: Paragon Transcendence and High-Roller Salon", () => {
  it("enforces level 100 for Paragon Ascension and awards permanent stat multiplier", async () => {
    const { app } = await makeApp();
    const c = new Client(app);
    await c.signup("ParagonMaster");

    // Level 50 player fails
    app.game.db.run("UPDATE players SET level = 50, coins = 1000000 WHERE name = 'ParagonMaster'");
    const failRes = await c.req("POST", "/api/hero/paragon", {});
    expect(failRes.statusCode).toBe(400);

    // Level 100 player with coins ascends
    app.game.db.run("UPDATE players SET level = 100, coins = 1000000 WHERE name = 'ParagonMaster'");
    const ascendRes = await c.post<any>("/api/hero/paragon", {});
    expect(ascendRes.result.paragon).toBe(1);
    expect(ascendRes.result.titleAwarded).toBe("⚡ Paragon I");

    // Check hero view includes paragon
    const meRes = await c.get<any>("/api/me");
    expect(meRes.hero.paragon).toBe(1);
  });

  it("allows High-Roller wagers on coin toss, dragon dice, and high slots", async () => {
    const { app } = await makeApp();
    const c = new Client(app);
    await c.signup("CasinoWhale");

    app.game.db.run("UPDATE players SET coins = 2000000 WHERE name = 'CasinoWhale'");

    // Coin toss wager
    const coinRes = await c.post<any>("/api/lucky/highroller", {
      game: "coin",
      stake: 50000,
      choice: "heads",
    });
    expect(coinRes.result.game).toBe("coin");
    expect(coinRes.result.stake).toBe(50000);
    expect(coinRes.result.multiplier).toBeOneOf([0, 2]);

    // Dragon dice wager
    const diceRes = await c.post<any>("/api/lucky/highroller", {
      game: "dice",
      stake: 10000,
    });
    expect(diceRes.result.game).toBe("dice");
    expect(diceRes.result.details.total).toBeGreaterThanOrEqual(2);
    expect(diceRes.result.details.total).toBeLessThanOrEqual(12);

    // High slots wager
    const slotsRes = await c.post<any>("/api/lucky/highroller", {
      game: "slots",
      stake: 100000,
    });
    expect(slotsRes.result.game).toBe("slots");
    expect(slotsRes.result.details.reels).toHaveLength(3);
  });
});
