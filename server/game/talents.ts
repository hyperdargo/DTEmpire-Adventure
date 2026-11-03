import type { GameCtx } from "./context.ts";
import {
  bump,
  checkAchievements,
  refreshPower,
  spendCoins,
  type Player,
} from "./player.ts";
import {
  TALENT_TREES,
  TALENTS_BY_ID,
  TALENT_UNLOCK_LEVEL,
  totalTalentPointsEarned,
  totalTalentPointsInvested,
  talentTreePoints,
  talentResetCost,
  computeTalentBonuses,
  type TalentTreeDef,
  type TalentStats,
  type TalentDef,
} from "../../shared/data/talents.ts";
import { logEvent } from "./logbook.ts";
import { GameError } from "../lib/errors.ts";

export interface TalentNodeView extends TalentDef {
  currentRank: number;
  unlocked: boolean;
  canInvest: boolean;
}

export interface TalentTreeView extends Omit<TalentTreeDef, "talents"> {
  pointsInTree: number;
  talents: TalentNodeView[];
}

export interface TalentsOverview {
  level: number;
  unlocked: boolean;
  unlockLevel: number;
  totalPoints: number;
  investedPoints: number;
  unspentPoints: number;
  resetCost: number;
  canReset: boolean;
  bonuses: TalentStats;
  trees: TalentTreeView[];
  playerTalents: Record<string, number>;
}

export function getTalentsOverview(_g: GameCtx, p: Player): TalentsOverview {
  const isUnlocked = p.level >= TALENT_UNLOCK_LEVEL;
  const totalPoints = totalTalentPointsEarned(p.level);
  const investedPoints = totalTalentPointsInvested(p.state.talents ?? {});
  const unspentPoints = Math.max(0, totalPoints - investedPoints);
  const resetCost = talentResetCost(p.level);
  const canReset = investedPoints > 0 && p.coins >= resetCost;
  const bonuses = computeTalentBonuses(p.state.talents ?? {});
  const currentTalents = p.state.talents ?? {};

  const trees: TalentTreeView[] = TALENT_TREES.map((tree) => {
    const pts = talentTreePoints(tree.id, currentTalents);
    const nodes: TalentNodeView[] = tree.talents.map((t) => {
      const rank = currentTalents[t.id] ?? 0;
      const unlocked = isUnlocked && pts >= t.reqPoints;
      const canInvest = unlocked && unspentPoints > 0 && rank < t.maxRank;
      return {
        ...t,
        currentRank: rank,
        unlocked,
        canInvest,
      };
    });

    return {
      id: tree.id,
      name: tree.name,
      title: tree.title,
      icon: tree.icon,
      desc: tree.desc,
      pointsInTree: pts,
      talents: nodes,
    };
  });

  return {
    level: p.level,
    unlocked: isUnlocked,
    unlockLevel: TALENT_UNLOCK_LEVEL,
    totalPoints,
    investedPoints,
    unspentPoints,
    resetCost,
    canReset,
    bonuses,
    trees,
    playerTalents: currentTalents,
  };
}

export function investTalentPoint(g: GameCtx, p: Player, talentId: string): TalentsOverview {
  if (p.level < TALENT_UNLOCK_LEVEL) {
    throw new GameError(`Hero Talents unlock at Level ${TALENT_UNLOCK_LEVEL}. (Current: Lv ${p.level})`, {
      code: "talents_locked",
    });
  }

  const def = TALENTS_BY_ID[talentId];
  if (!def) {
    throw new GameError(`Unknown talent "${talentId}".`, { code: "talent_not_found" });
  }

  const totalPoints = totalTalentPointsEarned(p.level);
  const invested = totalTalentPointsInvested(p.state.talents ?? {});
  const unspent = totalPoints - invested;
  if (unspent <= 0) {
    throw new GameError("You have no unspent talent points. Level up to earn more!", {
      code: "no_talent_points",
    });
  }

  p.state.talents ??= {};
  const currentRank = p.state.talents[talentId] ?? 0;
  if (currentRank >= def.maxRank) {
    throw new GameError(`“${def.name}” is already at maximum rank (${def.maxRank}/${def.maxRank}).`, {
      code: "max_talent_rank",
    });
  }

  const ptsInTree = talentTreePoints(def.treeId, p.state.talents);
  if (ptsInTree < def.reqPoints) {
    throw new GameError(
      `“${def.name}” requires ${def.reqPoints} points invested in the ${def.treeId} tree (currently ${ptsInTree}).`,
      { code: "talent_req_not_met" }
    );
  }

  p.state.talents[talentId] = currentRank + 1;
  bump(g, p, "talentsInvested", 1);

  if (def.isKeystone && p.state.talents[talentId] === 1) {
    bump(g, p, "talentKeystones", 1);
    logEvent(g, p.userId, "achievement", `Unlocked Apex Keystone: ${def.name}!`, def.icon, {
      talentId,
      treeId: def.treeId,
    });
    g.hub.toChannel("world", {
      type: "feed",
      text: `${p.name} unlocked the ${def.name} Apex Keystone!`,
      icon: def.icon,
      at: g.clock.now(),
    });
  }

  refreshPower(g, p);
  checkAchievements(g, p);

  return getTalentsOverview(g, p);
}

export function resetTalents(g: GameCtx, p: Player): TalentsOverview {
  const invested = totalTalentPointsInvested(p.state.talents ?? {});
  if (invested <= 0) {
    throw new GameError("You have no talent points invested to reset.", { code: "no_talents_to_reset" });
  }

  const cost = talentResetCost(p.level);
  spendCoins(p, cost, "resetting talents");

  p.state.talents = {};
  refreshPower(g, p);
  logEvent(g, p.userId, "talent", `Reset all talent trees (${invested} points refunded).`, "🔄", {
    refundedPoints: invested,
    cost,
  });

  return getTalentsOverview(g, p);
}
