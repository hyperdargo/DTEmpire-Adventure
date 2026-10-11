import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Db } from "../server/db/db.ts";
import { Client, makeApp, testClock, type TestClock } from "./helpers.ts";
import { weekKey, DAY } from "../server/lib/time.ts";
import { ensureBounties } from "../server/game/daily.ts";
import { loadPlayer } from "../server/game/player.ts";

let app: FastifyInstance;
let db: Db;
let clock: TestClock;

beforeEach(async () => {
	// Thursday Sep 17, 2026 12:00 UTC
	clock = testClock(Date.UTC(2026, 8, 17, 12, 0, 0));
	({ app, db } = await makeApp(clock));
});

afterEach(async () => {
	await app.close();
});

describe("Weekly Bounty Board and Combat Stats", () => {
	it("weekKey returns consistent weekly keys", () => {
		// Thursday Sep 17, 2026
		const t1 = Date.UTC(2026, 8, 17, 12, 0, 0);
		// Friday Sep 18, 2026 (same week)
		const t2 = Date.UTC(2026, 8, 18, 9, 30, 0);
		// Sunday Sep 20, 2026 (same week)
		const t3 = Date.UTC(2026, 8, 20, 23, 59, 59);
		// Monday Sep 21, 2026 (next week)
		const t4 = Date.UTC(2026, 8, 21, 0, 0, 1);

		const key1 = weekKey(t1);
		const key2 = weekKey(t2);
		const key3 = weekKey(t3);
		const key4 = weekKey(t4);

		expect(key1).toMatch(/^\d{4}-W\d{2}$/);
		expect(key1).toBe(key2);
		expect(key1).toBe(key3);
		expect(key4).not.toBe(key1);
		expect(key1).toBe("2026-W38");
		expect(key4).toBe("2026-W39");
	});

	it("ensureBounties generates 3 bounties", async () => {
		const c = new Client(app);
		await c.signup("BountyHunter1");

		const p = loadPlayer(app.game, 1);
		const board = ensureBounties(app.game, p);

		expect(board.week).toBe("2026-W38");
		expect(board.tasks).toHaveLength(3);
		expect(board.claimed).toEqual([]);

		for (const task of board.tasks) {
			expect(task.key).toContain(":");
			expect(task.need).toBeGreaterThan(0);
			expect(task.coins).toBeGreaterThan(0);
			expect(task.xp).toBeGreaterThan(0);
			expect(typeof task.tier).toBe("string");
			expect(typeof task.base).toBe("number");
		}

		// Also check through the API endpoint
		const view = await c.get<any>("/api/bounties");
		expect(view.week).toBe("2026-W38");
		expect(view.tasks).toHaveLength(3);
		expect(view.tasks[0].claimed).toBe(false);
	});

	it("bounties persist within the same week and reset on new week", async () => {
		const c = new Client(app);
		await c.signup("BountyHunter2");

		const res1 = await c.get<any>("/api/bounties");
		const tasks1 = res1.tasks;

		// Advance 2 days (still week 38)
		clock.advance(2 * DAY);
		const res2 = await c.get<any>("/api/bounties");
		expect(res2.week).toBe("2026-W38");
		expect(res2.tasks.map((t: any) => t.monster)).toEqual(tasks1.map((t: any) => t.monster));

		// Advance past week boundary into week 39
		clock.advance(7 * DAY);
		const res3 = await c.get<any>("/api/bounties");
		expect(res3.week).toBe("2026-W39");
	});

	it("claimBounty rejects incomplete bounties", async () => {
		const c = new Client(app);
		await c.signup("BountyHunter3");

		const err = await c.postErr("/api/bounties/claim", { index: 0 });
		expect(err.status).toBe(400);
		expect(err.message).toMatch(/Slay \d+ more/);
	});

	it("claimBounty grants rewards and rejects double claims", async () => {
		const c = new Client(app);
		await c.signup("BountyHunter4");

		// Fetch initial bounties
		const view = await c.get<any>("/api/bounties");
		const targetTask = view.tasks[0];
		expect(targetTask.claimed).toBe(false);

		// Manually update player's bestiary to fulfill the bounty kills
		const p = loadPlayer(app.game, 1);
		const taskKey = p.state.bountyBoard!.tasks[0]!.key;
		const need = p.state.bountyBoard!.tasks[0]!.need;
		const base = p.state.bountyBoard!.tasks[0]!.base;

		p.state.bestiary = {
			...(p.state.bestiary ?? {}),
			[taskKey]: base + need,
		};
		db.run("UPDATE players SET state = ? WHERE user_id = ?", JSON.stringify(p.state), 1);

		// Check view reflects completion
		const updatedView = await c.get<any>("/api/bounties");
		expect(updatedView.tasks[0].done).toBe(need);

		// Claim bounty
		const initialCoins = (await c.get<any>("/api/me")).hero.coins;
		const claimRes = await c.post<any>("/api/bounties/claim", { index: 0 });

		expect(claimRes.result.coins).toBe(targetTask.coins);
		expect(claimRes.result.xp).toBe(targetTask.xp);
		expect(claimRes.me.hero.coins).toBe(initialCoins + targetTask.coins);
		expect(claimRes.me.hero.counters.bountiesDone).toBe(1);

		// Double claim attempt must fail
		const err = await c.postErr("/api/bounties/claim", { index: 0 });
		expect(err.status).toBe(400);
		expect(err.message).toBe("Already claimed.");
	});

	it("stats endpoint returns complete combat statistics shape and values", async () => {
		const c = new Client(app);
		await c.signup("StatsHero");

		// Seed player data for stats calculation
		const p = loadPlayer(app.game, 1);
		p.counters = {
			battlesWon: 12,
			deaths: 3,
			bossKills: 2,
			duelsWon: 5,
			arenaWins: 4,
			expeditions: 3,
			contractsDone: 2,
			missionsDone: 6,
			bountiesDone: 1,
			coinsEarned: 25000,
			peakCoins: 15000,
		};
		p.state.bestiary = {
			"dark_forest:dire_wolf": 15,
			"dark_forest:forest_spider": 8,
			"crag_valley:cave_bat": 5,
		};
		p.state.mastery = {
			"dark_forest:dire_wolf": 1,
			"dark_forest:forest_spider": 4,
		};
		p.state.regionKills = {
			dark_forest: 23,
			crag_valley: 5,
		};
		p.state.towerFloors = {
			ascension: 10,
		};
		p.state.daily = {
			lastDay: "2026-09-17",
			lastAt: clock.now(),
			streak: 5,
			best: 7,
		};
		p.state.paragon = 2;
		db.run(
			"UPDATE players SET counters = ?, state = ?, dungeon_best = 15, abyss_best = 20, arena_rating = 1100 WHERE user_id = ?",
			JSON.stringify(p.counters),
			JSON.stringify(p.state),
			1,
		);

		const stats = await c.get<any>("/api/stats");

		expect(stats).toMatchObject({
			totalKills: 28,
			totalBossKills: 2,
			totalBattlesWon: 12,
			totalDeaths: 3,
			winRate: 80, // 12 / (12 + 3) = 80%
			discovered: 3,
			mastered: 2,
			nemeses: 1, // mastery >= 4
			duelsWon: 5,
			arenaWins: 4,
			expeditions: 3,
			contractsDone: 2,
			missionsDone: 6,
			bountiesDone: 1,
			coinsEarned: 25000,
			peakCoins: 15000,
			dailyStreak: 5,
			bestDailyStreak: 7,
			dungeonBest: 15,
			abyssBest: 20,
			arenaRating: 1100,
			paragonRank: 2,
		});

		expect(stats.topHunted).toHaveLength(3);
		expect(stats.topHunted[0].key).toBe("dark_forest:dire_wolf");
		expect(stats.topHunted[0].kills).toBe(15);
		expect(stats.topHunted[0].name).toBeDefined();
		expect(stats.topHunted[0].icon).toBeDefined();
		expect(stats.topHunted[0].region).toBeDefined();

		expect(stats.regionBreakdown).toHaveLength(2);
		expect(stats.regionBreakdown[0].id).toBe("dark_forest");
		expect(stats.regionBreakdown[0].kills).toBe(23);

		expect(stats.towerProgress).toEqual([{ towerId: "ascension", floor: 10 }]);
	});

	it("includes bounties in GET /api/daily response", async () => {
		const c = new Client(app);
		await c.signup("DailyHero");

		const dailyRes = await c.get<any>("/api/daily");
		expect(dailyRes.bounties).toBeDefined();
		expect(dailyRes.bounties.week).toBe("2026-W38");
		expect(dailyRes.bounties.tasks).toHaveLength(3);
	});
});
