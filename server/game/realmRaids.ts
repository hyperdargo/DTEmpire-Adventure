import { GEAR_BY_ID } from "../../shared/data/items.ts";
import { getDailyRaidTheme } from "../../shared/data/realmRaids.ts";
import { combatantFromMonster } from "../../shared/rules/combat.ts";
import { rollGear } from "../../shared/rules/items.ts";
import { monsterStats } from "../../shared/rules/monsters.ts";
import { createRng, freshSeed } from "../../shared/rules/rng.ts";
import { GameError } from "../lib/errors.ts";
import { assertCanStartBattle, heroCombatant, insertBattle, registerFinalizer, type BattleRow } from "./battles.ts";
import type { GameCtx } from "./context.ts";
import { bump, type Player, savePlayer } from "./player.ts";
import { payVictory } from "./pve.ts";

export interface RealmRaidClaim {
  dayDate: string;
  themeId: string;
  tierId: number;
  userId: number;
  userName: string;
  claimedAt: number;
}

export function initRealmRaidTables(g: GameCtx) {
  g.db.run(`
    CREATE TABLE IF NOT EXISTS realm_raid_first_bloods (
      day_date TEXT NOT NULL,
      theme_id TEXT NOT NULL,
      tier_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      user_name TEXT NOT NULL,
      claimed_at INTEGER NOT NULL,
      PRIMARY KEY (day_date, theme_id, tier_id)
    )
  `);
}

export function getRaidOverview(g: GameCtx, p: Player) {
  initRealmRaidTables(g);
  const { theme, dateStr } = getDailyRaidTheme();

  const claims = g.db.all<{ tier_id: number; user_name: string; user_id: number; claimed_at: number }>(
    "SELECT tier_id, user_name, user_id, claimed_at FROM realm_raid_first_bloods WHERE day_date = ? AND theme_id = ?",
    dateStr,
    theme.themeId
  );

  const claimsByTier = new Map(claims.map((c) => [c.tier_id, c]));

  return {
    dateStr,
    theme,
    myCoins: p.coins,
    myLevel: p.level,
    tiers: theme.tiers.map((t) => {
      const claim = claimsByTier.get(t.tierId);
      return {
        ...t,
        claimed: Boolean(claim),
        claimedBy: claim ? { userName: claim.user_name, userId: claim.user_id, claimedAt: claim.claimed_at } : null,
        canAfford: p.coins >= t.entryFee,
        meetsLevel: p.level >= t.levelReq,
      };
    }),
  };
}

export function startRealmRaidBattle(g: GameCtx, p: Player, tierId: number): BattleRow {
  initRealmRaidTables(g);
  assertCanStartBattle(g, p);

  const { theme, dateStr } = getDailyRaidTheme();
  const tier = theme.tiers.find((t) => t.tierId === tierId);
  if (!tier) throw new GameError("Invalid raid boss tier.");

  if (p.level < tier.levelReq) {
    throw new GameError(`This boss trial demands heroes of Level ${tier.levelReq} or higher.`, { code: "level_locked" });
  }

  if (p.coins < tier.entryFee) {
    throw new GameError(`Entry fee of ${tier.entryFee.toLocaleString("en-US")} coins required to challenge this trial.`, { code: "insufficient_gold" });
  }

  // Deduct entry fee upfront
  p.coins -= tier.entryFee;
  savePlayer(g, p);

  const effectiveLevel = Math.max(tier.levelReq, p.level);

  // Scaled formidable boss stats using standard monsterStats
  const m = monsterStats(effectiveLevel, "boss", {
    hp: tier.hpMult * 2.2,
    atk: tier.atkMult * 1.35,
    def: tier.defMult * 1.25,
  });

  const { combatant: player, pet } = heroCombatant(g, p);
  const enemy = combatantFromMonster({
    name: `${tier.name} [${tier.bossTitle}]`,
    icon: tier.icon,
    level: effectiveLevel,
    ...m,
    isBoss: true,
  });

  return insertBattle(
    g,
    p.userId,
    "realm_raid",
    {
      dayDate: dateStr,
      themeId: theme.themeId,
      tierId: tier.tierId,
      levelReq: tier.levelReq,
      bossName: tier.name,
      entryFee: tier.entryFee,
      bonusGoldReward: tier.bonusGoldReward,
      firstBloodGearId: tier.firstBloodGearId,
      firstBloodGearName: tier.firstBloodGearName,
      tokensMin: tier.guaranteedTokens[0],
      tokensMax: tier.guaranteedTokens[1],
    },
    { player, enemy, pet, canFlee: false }
  );
}

registerFinalizer("realm_raid", (g, p, b) => {
  const c = b.context as {
    dayDate: string;
    themeId: string;
    tierId: number;
    levelReq: number;
    bossName: string;
    entryFee: number;
    bonusGoldReward: number;
    firstBloodGearId: string;
    firstBloodGearName: string;
    tokensMin: number;
    tokensMax: number;
  };

  const now = g.clock.now();

  if (b.state.status !== "won") {
    if (b.state.status === "lost" || b.state.status === "timeout") {
      bump(g, p, "deaths");
      p.hp = Math.max(1, Math.round(b.state.player.maxHp * 0.1));
      p.hpAt = now;
      savePlayer(g, p);
    }
    return {
      result: b.state.status,
      lines: [`You were overpowered by ${c.bossName}. The ${c.entryFee.toLocaleString("en-US")} entry fee was claimed by the arena.`],
    };
  }

  // Boss defeated!
  const rng = createRng(freshSeed());
  const tokenGain = rng.int(c.tokensMin, c.tokensMax);
  const earnedXp = Math.round(c.levelReq * 1250);
  const totalGoldWon = c.bonusGoldReward;

  const victoryPay = payVictory(g, p, {
    level: c.levelReq,
    coins: totalGoldWon,
    xp: earnedXp,
    boss: true,
    elite: true,
    source: "adventure",
  });

  // Check First Blood Claim
  let wonFirstBlood = false;
  let firstBloodGearObtained = null;

  try {
    const res = g.db.run(
      "INSERT INTO realm_raid_first_bloods (day_date, theme_id, tier_id, user_id, user_name, claimed_at) VALUES (?, ?, ?, ?, ?, ?)",
      c.dayDate,
      c.themeId,
      c.tierId,
      p.userId,
      p.name,
      now
    );

    if (res.changes > 0) {
      wonFirstBlood = true;
      const gearTpl = GEAR_BY_ID[c.firstBloodGearId];
      if (gearTpl) {
        const rolled = rollGear(rng, gearTpl, Math.max(c.levelReq, p.level), "unique");
        g.db.run(
          `INSERT INTO items (owner_id, template_id, rarity, ilvl, upgrade, qty, base, affixes, equipped, created_at)
           VALUES (?, ?, 'unique', ?, 0, 1, ?, ?, 0, ?)`,
          p.userId,
          gearTpl.id,
          Math.max(c.levelReq, p.level),
          JSON.stringify(rolled.base),
          JSON.stringify(rolled.affixes),
          now
        );
        firstBloodGearObtained = c.firstBloodGearName;

        g.hub.toChannel("world", {
          type: "feed",
          icon: "👑",
          text: `🔥 FIRST BLOOD! ${p.name} conquered Tier ${c.tierId} ${c.bossName} and claimed the limited-edition relic: [${c.firstBloodGearName}]!`,
          at: now,
        });
      }
    }
  } catch {
    // Already claimed by someone else earlier today
    wonFirstBlood = false;
  }

  const lines = [
    `🏆 Boss Slain: ${c.bossName} fell in combat!`,
    `💰 Bounty: Won ${totalGoldWon.toLocaleString("en-US")} Gold and ${tokenGain} Carnival Tokens!`,
  ];

  if (wonFirstBlood && firstBloodGearObtained) {
    lines.push(`👑 REALM FIRST BLOOD ACHIEVED: You claimed the one-time limited relic [${firstBloodGearObtained}]!`);
  } else {
    lines.push(`ℹ️ Today's First Blood for this tier was already claimed, but you reaped the full gold and token prize!`);
  }

  savePlayer(g, p);

  return {
    result: "won",
    coins: victoryPay.coins,
    xp: victoryPay.xp,
    drops: firstBloodGearObtained ? [{ name: firstBloodGearObtained, rarity: "unique" }] : [],
    lines,
    extra: {
      tokens: tokenGain,
      currency: "Carnival Tokens",
      firstBlood: wonFirstBlood,
    },
  };
});
