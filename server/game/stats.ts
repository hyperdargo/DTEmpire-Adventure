import { REGION_BY_ID } from "../../shared/data/regions.ts";
import type { GameCtx } from "./context.ts";
import type { Player } from "./player.ts";

export function combatStats(g: GameCtx, p: Player) {
	const bestiary = p.state.bestiary ?? {};
	const mastery = p.state.mastery ?? {};
	const regionKills = p.state.regionKills ?? {};

	// Total kills across all regions
	const totalKills = Object.values(bestiary).reduce((a, b) => a + b, 0);

	// Unique monsters discovered
	const discovered = Object.keys(bestiary).length;

	// Mastered monsters (any rank > 0)
	const mastered = Object.values(mastery).filter((r) => r > 0).length;
	const nemeses = Object.values(mastery).filter((r) => r >= 4).length;

	// Top 5 most hunted monsters
	const topHunted = Object.entries(bestiary)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 5)
		.map(([key, kills]) => {
			const [regionId, monsterId] = key.split(":");
			const region = REGION_BY_ID[regionId!];
			const monster = region
				? (region.monsters.find((m) => m.id === monsterId) ?? (region.boss.id === monsterId ? region.boss : null))
				: null;
			return { key, name: monster?.name ?? monsterId, icon: monster?.icon ?? "👹", region: region?.name ?? regionId, kills };
		});

	// Kills by region
	const regionBreakdown = Object.entries(regionKills)
		.sort(([, a], [, b]) => b - a)
		.map(([id, kills]) => {
			const region = REGION_BY_ID[id];
			return { id, name: region?.name ?? id, icon: region?.icon ?? "🌍", kills };
		});

	return {
		totalKills,
		totalBossKills: p.counters.bossKills ?? 0,
		totalBattlesWon: p.counters.battlesWon ?? 0,
		totalDeaths: p.counters.deaths ?? 0,
		winRate: (p.counters.battlesWon ?? 0) > 0
			? Math.round(((p.counters.battlesWon ?? 0) / ((p.counters.battlesWon ?? 0) + (p.counters.deaths ?? 0))) * 100)
			: 0,
		discovered,
		mastered,
		nemeses,
		topHunted,
		regionBreakdown,
		duelsWon: p.counters.duelsWon ?? 0,
		arenaWins: p.counters.arenaWins ?? 0,
		expeditions: p.counters.expeditions ?? 0,
		contractsDone: p.counters.contractsDone ?? 0,
		missionsDone: p.counters.missionsDone ?? 0,
		bountiesDone: p.counters.bountiesDone ?? 0,
		coinsEarned: p.counters.coinsEarned ?? 0,
		peakCoins: p.counters.peakCoins ?? 0,
		dailyStreak: p.state.daily?.streak ?? 0,
		bestDailyStreak: p.state.daily?.best ?? 0,
		towerProgress: Object.entries(p.state.towerFloors ?? {}).map(([id, floor]) => ({ towerId: id, floor })),
		dungeonBest: p.dungeonBest,
		abyssBest: p.abyssBest,
		arenaRating: p.arenaRating,
		paragonRank: p.state.paragon ?? 0,
	};
}
