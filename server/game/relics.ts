import type { GameCtx } from "./context.ts";
import {
  bump,
  checkAchievements,
  countStack,
  refreshPower,
  spendCoins,
  takeStack,
  type Player,
} from "./player.ts";
import {
  CONSECRATION_COSTS,
  CONSECRATION_MULTS,
  MAX_CONSECRATION_RANK,
  RELICS,
  RELIC_BY_CHAPTER,
  RELIC_BY_ID,
  computeRelicResonanceBonuses,
  type RelicDef,
  type RelicStats,
} from "../../shared/data/relics.ts";
import { logEvent } from "./logbook.ts";
import { GameError } from "../lib/errors.ts";

export interface RelicViewItem extends RelicDef {
  owned: boolean;
  rank: number;
  currentStats: RelicStats;
  nextCost?: {
    coins: number;
    material: string;
    materialName: string;
    materialQty: number;
    canAfford: boolean;
  };
}

export interface RelicsOverview {
  relics: RelicViewItem[];
  totalDiscovered: number;
  totalRelics: number;
  totalConsecrations: number;
  resonanceBonuses: RelicStats;
  completionPct: number;
}

/** Automatically sync earned relics based on past progression milestones. */
export function syncPlayerRelics(g: GameCtx, p: Player): boolean {
  p.state.relics ??= {};
  let changed = false;

  // 1. Chapter relics: based on tower floor (every 5 floors = 1 chapter)
  const maxStoryFloor = Math.max(0, p.towerFloor || 0);
  for (let ch = 1; ch <= 20; ch++) {
    const minFloor = ch * 5;
    if (maxStoryFloor >= minFloor) {
      const def = RELIC_BY_CHAPTER[ch];
      if (def && !p.state.relics[def.id]) {
        p.state.relics[def.id] = 1;
        bump(g, p, "relicsFound", 1);
        changed = true;
      }
    }
  }

  // 2. Spire relics: Molten, Celestial, Abyssal (floor 50+)
  const tf = p.state.towerFloors ?? {};
  if ((tf.molten ?? 0) >= 50 && !p.state.relics["infernal_ember"]) {
    p.state.relics["infernal_ember"] = 1;
    bump(g, p, "relicsFound", 1);
    changed = true;
  }
  if ((tf.celestial ?? 0) >= 50 && !p.state.relics["celestial_shard"]) {
    p.state.relics["celestial_shard"] = 1;
    bump(g, p, "relicsFound", 1);
    changed = true;
  }
  if (((tf.abyssal ?? 0) >= 50 || (p.abyssBest ?? 0) >= 25) && !p.state.relics["abyssal_singularity"]) {
    p.state.relics["abyssal_singularity"] = 1;
    bump(g, p, "relicsFound", 1);
    changed = true;
  }

  // 3. Apex relic: Floor 100 or Abyss 50
  if ((maxStoryFloor >= 100 || (p.abyssBest ?? 0) >= 50) && !p.state.relics["genesis_core"]) {
    p.state.relics["genesis_core"] = 1;
    bump(g, p, "relicsFound", 1);
    changed = true;
  }

  if (changed) {
    checkAchievements(g, p);
    refreshPower(g, p);
  }
  return changed;
}

/** Unlock a new relic for the player. Returns true if newly discovered. */
export function unlockRelic(g: GameCtx, p: Player, relicId: string): boolean {
  const def = RELIC_BY_ID[relicId];
  if (!def) return false;

  p.state.relics ??= {};
  if (p.state.relics[relicId]) return false; // Already owned

  p.state.relics[relicId] = 1;
  bump(g, p, "relicsFound", 1);
  logEvent(g, p.userId, "relic", `Discovered Ancient Relic [${def.name}]!`, def.icon, {
    relicId,
    rarity: def.rarity,
  });
  checkAchievements(g, p);
  refreshPower(g, p);
  return true;
}

/** Compute scaled stats for a single relic at given rank. */
export function getSingleRelicStats(def: RelicDef, rank: number): RelicStats {
  if (rank <= 0) return {};
  const mult = CONSECRATION_MULTS[Math.min(MAX_CONSECRATION_RANK, rank)] ?? 1.0;
  const out: RelicStats = {};
  for (const [k, v] of Object.entries(def.baseStats) as [keyof RelicStats, number][]) {
    if (typeof v === "number") {
      out[k] = Math.round(v * mult * 10) / 10;
    }
  }
  return out;
}

/** Build comprehensive player overview of the Reliquary. */
export function getRelicsOverview(g: GameCtx, p: Player): RelicsOverview {
  syncPlayerRelics(g, p);

  const ownedMap = p.state.relics ?? {};
  let totalDiscovered = 0;
  let totalConsecrations = 0;

  const relics: RelicViewItem[] = RELICS.map((def) => {
    const rank = ownedMap[def.id] ?? 0;
    const owned = rank > 0;
    if (owned) {
      totalDiscovered++;
      totalConsecrations += rank;
    }

    const currentStats = owned ? getSingleRelicStats(def, rank) : def.baseStats;

    let nextCost: RelicViewItem["nextCost"] = undefined;
    if (owned && rank < MAX_CONSECRATION_RANK) {
      const nextRank = rank + 1;
      const c = CONSECRATION_COSTS[nextRank];
      if (c) {
        const matCount = countStack(g, p.userId, c.material);
        const canAfford = p.coins >= c.coins && matCount >= c.materialQty;
        nextCost = {
          coins: c.coins,
          material: c.material,
          materialName: c.materialName,
          materialQty: c.materialQty,
          canAfford,
        };
      }
    }

    return {
      ...def,
      owned,
      rank,
      currentStats,
      nextCost,
    };
  });

  const resonanceBonuses = computeRelicResonanceBonuses(ownedMap);
  const completionPct = Math.round((totalDiscovered / RELICS.length) * 100);

  return {
    relics,
    totalDiscovered,
    totalRelics: RELICS.length,
    totalConsecrations,
    resonanceBonuses,
    completionPct,
  };
}

/** Consecrate an owned relic to the next tier. */
export function consecrateRelic(
  g: GameCtx,
  p: Player,
  relicId: string,
): { relic: RelicViewItem; nextRank: number; bonusDelta: string } {
  const def = RELIC_BY_ID[relicId];
  if (!def) {
    throw new GameError("Unknown ancient relic.", { code: "not_found" });
  }

  p.state.relics ??= {};
  const currentRank = p.state.relics[relicId] ?? 0;
  if (currentRank <= 0) {
    throw new GameError(`You have not discovered [${def.name}] yet.`, {
      code: "relic_not_discovered",
    });
  }

  if (currentRank >= MAX_CONSECRATION_RANK) {
    throw new GameError(`[${def.name}] has already reached maximum Transcendent Rank (${MAX_CONSECRATION_RANK}).`, {
      code: "max_consecration_rank",
    });
  }

  const nextRank = currentRank + 1;
  const cost = CONSECRATION_COSTS[nextRank];
  if (!cost) {
    throw new GameError("No consecration tier available.", { code: "bad_request" });
  }

  // Deduct coins & material
  spendCoins(p, cost.coins, `consecrating ${def.name}`);
  takeStack(g, p.userId, cost.material, cost.materialQty, cost.materialName);

  // Apply new rank
  p.state.relics[relicId] = nextRank;
  bump(g, p, "relicsConsecrated", 1);

  logEvent(
    g,
    p.userId,
    "relic",
    `Consecrated Ancient Relic [${def.name}] to Rank ${nextRank} (★${nextRank})!`,
    def.icon,
    { relicId, rank: nextRank },
  );

  checkAchievements(g, p);
  refreshPower(g, p);

  const prevStats = getSingleRelicStats(def, currentRank);
  const nextStats = getSingleRelicStats(def, nextRank);
  const deltas: string[] = [];
  for (const [k, v] of Object.entries(nextStats) as [keyof RelicStats, number][]) {
    const prev = prevStats[k] ?? 0;
    const diff = Math.round((v - prev) * 10) / 10;
    if (diff > 0) deltas.push(`+${diff} ${k}`);
  }
  const bonusDelta = deltas.join(", ");

  const overview = getRelicsOverview(g, p);
  const updatedRelic = overview.relics.find((r) => r.id === relicId)!;

  return {
    relic: updatedRelic,
    nextRank,
    bonusDelta,
  };
}
