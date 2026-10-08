import {
  FACTIONS,
  FACTION_BY_ID,
  FACTION_MIN_LEVEL,
  FACTION_TRIBUTE_COST,
  FACTION_TRIBUTE_REP,
  FACTION_TRIBUTE_XP,
  FACTION_SWITCH_COST,
  getFactionRank,
  getNextFactionRank,
  computeFactionBonuses,
} from "../../shared/data/factions.ts";
import { GameError } from "../lib/errors.ts";
import { dayKey } from "../lib/time.ts";
import type { GameCtx } from "./context.ts";
import { giveDrops } from "./inventory.ts";
import { bump, checkAchievements, grantXp, refreshPower, type Player } from "./player.ts";

export function addFactionRep(g: GameCtx, p: Player, amount: number) {
  if (!p.state.faction?.factionId) return;
  p.state.faction.reputation = (p.state.faction.reputation ?? 0) + amount;
  bump(g, p, "factionReputation", amount);
  checkAchievements(g, p);
}

export function getFactionOverview(g: GameCtx, p: Player) {
  const currentId = p.state.faction?.factionId ?? null;
  const rep = p.state.faction?.reputation ?? 0;
  const currentRank = getFactionRank(rep);
  const nextRank = getNextFactionRank(rep);
  const currentBonuses = computeFactionBonuses(currentId, rep);

  const today = dayKey(g.clock.now());
  const canTribute = Boolean(currentId && p.state.faction?.lastTributeDay !== today);

  const currentDef = currentId ? FACTION_BY_ID[currentId] : null;
  const hasPrestigeTitle = Boolean(currentDef && (p.state.titles ?? []).includes(currentDef.title));

  return {
    currentFactionId: currentId,
    reputation: rep,
    rank: currentRank,
    nextRank,
    bonuses: currentBonuses,
    canTribute,
    tributeCost: FACTION_TRIBUTE_COST,
    switchCost: FACTION_SWITCH_COST,
    minLevel: FACTION_MIN_LEVEL,
    hasPrestigeTitle,
    factions: FACTIONS.map((f) => ({
      ...f,
      isPledged: f.id === currentId,
    })),
  };
}

export function pledgeFaction(g: GameCtx, p: Player, targetFactionId: string) {
  if (p.level < FACTION_MIN_LEVEL) {
    throw new GameError(`You must be at least level ${FACTION_MIN_LEVEL} to join an Imperial Faction.`);
  }

  const target = FACTION_BY_ID[targetFactionId];
  if (!target) {
    throw new GameError("Unknown faction.");
  }

  const current = p.state.faction;
  const isSwitching = Boolean(current?.factionId && current.factionId !== targetFactionId);

  if (current?.factionId === targetFactionId) {
    throw new GameError(`You are already pledged to ${target.name}.`);
  }

  if (isSwitching) {
    if (p.coins < FACTION_SWITCH_COST) {
      throw new GameError(`Switching allegiance costs ${FACTION_SWITCH_COST.toLocaleString()} gold.`);
    }
    p.coins -= FACTION_SWITCH_COST;
  }

  // Preserve reputation history across factions
  const histories = { ...(current?.reputations ?? {}) };
  if (current?.factionId) {
    histories[current.factionId] = current.reputation ?? 0;
  }

  const restoredRep = histories[targetFactionId] ?? 0;

  p.state.faction = {
    factionId: targetFactionId,
    reputation: restoredRep,
    pledgedAt: g.clock.now(),
    lastTributeDay: current?.lastTributeDay,
    reputations: histories,
  };

  bump(g, p, "factionsPledged", 1);
  refreshPower(g, p);

  p.notices = p.notices ?? [];
  p.notices.push({
    kind: "toast",
    tone: "good",
    icon: target.banner,
    text: isSwitching
      ? `Switched allegiance to ${target.name}!`
      : `Sworn allegiance to ${target.name}!`,
  });

  return getFactionOverview(g, p);
}

export function submitDailyTribute(g: GameCtx, p: Player) {
  const factionState = p.state.faction;
  if (!factionState?.factionId) {
    throw new GameError("You have not pledged allegiance to any faction.");
  }

  const today = dayKey(g.clock.now());
  if (factionState.lastTributeDay === today) {
    throw new GameError("You have already made your daily tribute today. Return tomorrow.");
  }

  if (p.coins < FACTION_TRIBUTE_COST) {
    throw new GameError(`Daily tribute requires ${FACTION_TRIBUTE_COST.toLocaleString()} gold.`);
  }

  p.coins -= FACTION_TRIBUTE_COST;
  factionState.lastTributeDay = today;

  addFactionRep(g, p, FACTION_TRIBUTE_REP);
  grantXp(g, p, FACTION_TRIBUTE_XP, { applyBonus: false });

  // Supply cache drops
  const supplyDrops = giveDrops(g, p, [
    { kind: "stack", templateId: "health_potion_2", qty: 2 },
    { kind: "stack", templateId: "mystic_gem", qty: 1 },
  ]);

  p.notices = p.notices ?? [];
  p.notices.push({
    kind: "toast",
    tone: "good",
    icon: "📜",
    text: `Daily tribute complete! +${FACTION_TRIBUTE_REP} Rep, +${FACTION_TRIBUTE_XP} XP, and supply rations received.`,
  });

  return {
    overview: getFactionOverview(g, p),
    supplies: supplyDrops,
  };
}

export function claimFactionTitle(g: GameCtx, p: Player) {
  const factionState = p.state.faction;
  if (!factionState?.factionId) {
    throw new GameError("You have not pledged allegiance to any faction.");
  }

  const target = FACTION_BY_ID[factionState.factionId];
  if (!target) throw new GameError("Unknown faction.");

  const rank = getFactionRank(factionState.reputation ?? 0);
  if (rank.rank < 4) {
    throw new GameError("You must reach Rank 4 (High Commander) to claim this prestige title.");
  }

  p.state.titles = p.state.titles ?? [];
  if (!p.state.titles.includes(target.title)) {
    p.state.titles.push(target.title);
  }
  p.title = target.title;

  p.notices = p.notices ?? [];
  p.notices.push({
    kind: "toast",
    tone: "good",
    icon: "👑",
    text: `Prestige title unlocked and equipped: "${target.title}"!`,
  });

  return getFactionOverview(g, p);
}
