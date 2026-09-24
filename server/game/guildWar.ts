import {
  GUILD_WAR_ATTACKS_PER_DAY,
  GUILD_WAR_WIN_COINS,
  GUILD_WAR_WIN_GUILD_XP,
  GUILD_WAR_WIN_PTS,
  GUILD_WAR_WIN_XP,
} from "../../shared/data/meta.ts";
import { CLASS_BY_ID } from "../../shared/data/classes.ts";
import { weekKey, dayKey } from "../lib/time.ts";
import { GameError, notFound } from "../lib/errors.ts";
import type { GameCtx } from "./context.ts";
import { type Player, grantCoins, grantXp, heroStats, loadPlayer, savePlayer } from "./player.ts";
import { assertCanStartBattle, heroCombatant, insertBattle, registerFinalizer } from "./battles.ts";
import { snapshotFighter } from "./modes.ts";

export interface GuildWarRow {
  week: string;
  guild_a_id: number;
  guild_b_id: number;
  score_a: number;
  score_b: number;
  state: string;
  updated_at: number;
}

export function getOrCreateWar(g: GameCtx): GuildWarRow {
  const now = g.clock.now();
  const week = weekKey(now);
  let row = g.db.get<GuildWarRow>("SELECT * FROM guild_wars WHERE week = ?", week);
  if (!row) {
    // Find guild 1 (DTEmpire) and guild 2 (Shadow Legion or any other guild)
    let g1 = g.db.get<{ id: number }>("SELECT id FROM guilds WHERE tag = 'DTEMP' OR id = 1");
    let g2 = g.db.get<{ id: number }>("SELECT id FROM guilds WHERE tag = 'VOID' OR (id != 1 AND id != ?)", g1?.id ?? 0);

    if (!g1 || !g2) {
      const all = g.db.all<{ id: number }>("SELECT id FROM guilds ORDER BY id ASC LIMIT 2");
      if (all.length >= 2) {
        g1 = all[0]!;
        g2 = all[1]!;
      }
    }

    if (g1 && g2 && g1.id !== g2.id) {
      g.db.run(
        "INSERT OR IGNORE INTO guild_wars (week, guild_a_id, guild_b_id, score_a, score_b, state, updated_at) VALUES (?, ?, ?, 0, 0, '{}', ?)",
        week,
        g1.id,
        g2.id,
        now
      );
      row = g.db.get<GuildWarRow>("SELECT * FROM guild_wars WHERE week = ?", week);
    }
  }
  return row ?? {
    week,
    guild_a_id: 1,
    guild_b_id: 2,
    score_a: 0,
    score_b: 0,
    state: "{}",
    updated_at: now,
  };
}

export function guildWarView(g: GameCtx, p: Player) {
  const war = getOrCreateWar(g);
  const now = g.clock.now();
  const today = dayKey(now);

  const ga = g.db.get<{ id: number; name: string; tag: string; emblem: string }>(
    "SELECT id, name, tag, emblem FROM guilds WHERE id = ?",
    war.guild_a_id
  ) ?? { id: war.guild_a_id, name: "DTEmpire", tag: "DTEMP", emblem: "🐉" };

  const gb = g.db.get<{ id: number; name: string; tag: string; emblem: string }>(
    "SELECT id, name, tag, emblem FROM guilds WHERE id = ?",
    war.guild_b_id
  ) ?? { id: war.guild_b_id, name: "Shadow Legion", tag: "VOID", emblem: "🌑" };

  const myGuildId = p.guildId;
  const isGuildA = myGuildId === war.guild_a_id;
  const isGuildB = myGuildId === war.guild_b_id;

  const rivalGuild = isGuildA ? gb : isGuildB ? ga : gb;
  const myScore = isGuildA ? war.score_a : isGuildB ? war.score_b : 0;
  const rivalScore = isGuildA ? war.score_b : isGuildB ? war.score_a : war.score_b;

  const gwState = p.state.guildWar?.day === today
    ? p.state.guildWar
    : { day: today, attacks: 0, defeated: [] as number[] };

  // Fetch rival guild champions (up to 5 defenders)
  const defenderRows = g.db.all<{
    user_id: number;
    name: string;
    level: number;
    power: number;
    class_id: string;
  }>(
    `SELECT pl.user_id, pl.name, pl.level, pl.power, pl.class_id
     FROM guild_members gm
     JOIN players pl ON pl.user_id = gm.user_id
     WHERE gm.guild_id = ?
     ORDER BY pl.power DESC, pl.level DESC
     LIMIT 5`,
    rivalGuild.id
  );

  const defenders = defenderRows.map((d) => ({
    userId: d.user_id,
    name: d.name,
    level: d.level,
    power: d.power,
    classId: d.class_id,
    classIcon: CLASS_BY_ID[d.class_id]?.icon ?? "⚔️",
    defeatedToday: (gwState.defeated ?? []).includes(d.user_id),
  }));

  return {
    war: {
      week: war.week,
      day: today,
      myGuildId,
      rivalGuildId: rivalGuild.id,
      myGuildName: isGuildA ? ga.name : isGuildB ? gb.name : ga.name,
      rivalGuildName: rivalGuild.name,
      myScore,
      rivalScore,
      attacksRemaining: Math.max(0, GUILD_WAR_ATTACKS_PER_DAY - (gwState.attacks ?? 0)),
      maxAttacks: GUILD_WAR_ATTACKS_PER_DAY,
      opponents: defenders,
      defenders,
      guildA: ga,
      guildB: gb,
    },
  };
}

export function startGuildWarBattle(g: GameCtx, p: Player, defenderId: number) {
  if (!p.guildId) throw new GameError("You must belong to a guild to fight in the Guild War.");
  const war = getOrCreateWar(g);
  const isGuildA = p.guildId === war.guild_a_id;
  const isGuildB = p.guildId === war.guild_b_id;
  if (!isGuildA && !isGuildB) {
    throw new GameError("Your guild is not currently active in this Guild War.");
  }

  const rivalGuildId = isGuildA ? war.guild_b_id : war.guild_a_id;
  const isDefenderRival = g.db.get(
    "SELECT 1 FROM guild_members WHERE user_id = ? AND guild_id = ?",
    defenderId,
    rivalGuildId
  );
  if (!isDefenderRival) {
    throw new GameError("That player is not a champion of the rival guild.");
  }

  const today = dayKey(g.clock.now());
  const gwState = p.state.guildWar?.day === today
    ? p.state.guildWar
    : { day: today, attacks: 0, defeated: [] as number[] };

  if (gwState.attacks >= GUILD_WAR_ATTACKS_PER_DAY) {
    throw new GameError("You have used all your Guild War attacks today. Return tomorrow!");
  }
  if ((gwState.defeated ?? []).includes(defenderId)) {
    throw new GameError("You have already defeated this champion today.");
  }

  assertCanStartBattle(g, p, { ignoreHp: true });

  gwState.attacks = (gwState.attacks ?? 0) + 1;
  p.state.guildWar = gwState;
  savePlayer(g, p);

  const stats = heroStats(g, p);
  const { combatant, pet } = heroCombatant(g, p, { hpOverride: stats.maxHp });
  const enemy = snapshotFighter(g, defenderId);

  return insertBattle(
    g,
    p.userId,
    "guild_war",
    { defenderId, hpBefore: p.hp, week: war.week },
    { player: combatant, enemy, pet, canFlee: false }
  );
}

registerFinalizer("guild_war", (g, p, b) => {
  const c = b.context as { defenderId: number; hpBefore: number; week: string };
  p.hp = c.hpBefore;
  const won = b.state.status === "won";
  let coins = 0;
  let xp = 0;
  const warPoints = won ? GUILD_WAR_WIN_PTS : 0;

  if (won) {
    coins = grantCoins(g, p, GUILD_WAR_WIN_COINS(p.level));
    xp = grantXp(g, p, GUILD_WAR_WIN_XP, { applyBonus: true });

    if (p.guildId) {
      g.db.run("UPDATE guilds SET xp = xp + ? WHERE id = ?", GUILD_WAR_WIN_GUILD_XP, p.guildId);
      const war = getOrCreateWar(g);
      if (p.guildId === war.guild_a_id) {
        g.db.run(
          "UPDATE guild_wars SET score_a = score_a + ?, updated_at = ? WHERE week = ?",
          warPoints,
          g.clock.now(),
          war.week
        );
      } else if (p.guildId === war.guild_b_id) {
        g.db.run(
          "UPDATE guild_wars SET score_b = score_b + ?, updated_at = ? WHERE week = ?",
          warPoints,
          g.clock.now(),
          war.week
        );
      }
    }

    const today = dayKey(g.clock.now());
    const gwState = p.state.guildWar?.day === today
      ? p.state.guildWar
      : { day: today, attacks: 0, defeated: [] as number[] };
    gwState.defeated = [...new Set([...(gwState.defeated ?? []), c.defenderId])];
    p.state.guildWar = gwState;
    savePlayer(g, p);

    const defender = loadPlayer(g, c.defenderId);
    const myGuild = p.guildId
      ? g.db.get<{ tag: string }>("SELECT tag FROM guilds WHERE id = ?", p.guildId)
      : null;
    const defGuild = defender.guildId
      ? g.db.get<{ tag: string }>("SELECT tag FROM guilds WHERE id = ?", defender.guildId)
      : null;

    g.hub.toChannel("world", {
      type: "feed",
      icon: "⚔️",
      text: `[${myGuild?.tag ?? "GUILD"}] ${p.name} crushed [${defGuild?.tag ?? "RIVAL"}] ${defender.name} in the Guild War (+${warPoints} pts)!`,
      at: g.clock.now(),
    });
  }

  return { result: b.state.status, coins, xp, extra: { warPoints } };
});
