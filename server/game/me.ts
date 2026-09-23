import { CLASS_BY_ID, dualXpToNext, rankTitle } from "../../shared/data/classes.ts";
import { activeEvent, eventEndsAt } from "../../shared/data/events.ts";
import { currentRealmModifier, realmModifierEndsAt } from "../../shared/data/realm.ts";
import { BLESSINGS, WORLD_BOSS_ATTEMPTS_PER_DAY } from "../../shared/data/meta.ts";
import { eventState } from "./events.ts";
import { HP_FULL_REGEN_SECONDS, xpToNext } from "../../shared/rules/progression.ts";
import type { SessionUser } from "../auth.ts";
import { dayKey } from "../lib/time.ts";
import { getActiveBattle } from "./battles.ts";
import type { GameCtx } from "./context.ts";
import { contractView, dailyStatus, ensureMissions, jobStatus } from "./daily.ts";
import { unreadMailCount } from "./economy.ts";
import { bagCapacity, bagUsed } from "./inventory.ts";
import { type Player, activeBuffs, findPlayer, heroStats, playerTitle, settleHp } from "./player.ts";

/** Everything the client shell needs: hero card, resources, timers, and notification badges. */
export function meSnapshot(g: GameCtx, user: SessionUser, loaded?: Player) {
  const p = loaded ?? findPlayer(g, user.id);
  if (!p) return { user, hero: null, onlineCount: g.hub.onlineCount() };
  const now = g.clock.now();
  const stats = heroStats(g, p);
  const hp = settleHp(g, p, stats.maxHp);
  const cls = CLASS_BY_ID[p.classId]!;
  const guild = p.guildId ? g.db.get<{ id: number; name: string; tag: string; emblem: string }>("SELECT id, name, tag, emblem FROM guilds WHERE id = ?", p.guildId) : null;
  const battle = getActiveBattle(g, p.userId);
  const daily = dailyStatus(g, p);
  const contracts = contractView(g, p);
  const missions = ensureMissions(g, p);
  const job = jobStatus(g, p);
  const expedition = p.state.expedition ?? null;
  const day = dayKey(now);
  const wbUsed = p.state.worldBoss?.day === day ? p.state.worldBoss.attempts : 0;
  const event = activeEvent(now);
  const realmMod = currentRealmModifier(now);

  return {
    user,
    onlineCount: g.hub.onlineCount(),
    realm: {
      modifier: realmMod,
      endsAt: realmModifierEndsAt(now),
    },
    hero: {
      name: p.name,
      title: playerTitle(p),
      titles: p.state.titles ?? [],
      avatar: p.avatar,
      bio: p.bio,
      level: p.level,
      xp: p.xp,
      xpToNext: xpToNext(p.level),
      coins: p.coins,
      hp,
      maxHp: stats.maxHp,
      hpFullAt: hp >= stats.maxHp ? now : now + Math.ceil(((stats.maxHp - hp) / stats.maxHp) * HP_FULL_REGEN_SECONDS * 1000),
      stats,
      class: { id: cls.id, name: cls.name, icon: cls.icon, rarity: p.classRarity, baseRarity: cls.rarity, archetype: cls.archetype, weapon: cls.weapon, passive: cls.passive, rank: rankTitle(cls.archetype, p.level) },
      dual: p.state.dual ? { ...p.state.dual, xpToNext: dualXpToNext(p.state.dual.level), name: CLASS_BY_ID[p.state.dual.classId]?.name, icon: CLASS_BY_ID[p.state.dual.classId]?.icon } : null,
      towerFloor: p.towerFloor,
      dungeonBest: p.dungeonBest,
      abyssBest: p.abyssBest,
      arenaRating: p.arenaRating,
      guild,
      buffs: activeBuffs(p, now).map((b) => ({ ...b, name: BLESSINGS.find((x) => x.id === b.id)?.name ?? b.id, icon: BLESSINGS.find((x) => x.id === b.id)?.icon ?? "✨" })),
      settings: {
        ...(p.state.settings ?? {}),
        autoResolveAdventure: p.state.autoResolveAdventure ?? p.state.settings?.autoResolveAdventure ?? false,
        autoResolvePotions: p.state.autoResolvePotions ?? p.state.settings?.autoResolvePotions ?? true,
      },
      bag: { used: bagUsed(g, p.userId), capacity: bagCapacity(p) },
      inDungeon: !!(p.state as { dungeon?: unknown }).dungeon,
      createdAt: p.createdAt,
    },
    activeBattle: battle ? { id: battle.id, kind: battle.kind } : null,
    badges: {
      mail: unreadMailCount(g, p.userId),
      friendRequests: g.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM friends WHERE friend_id = ? AND status = 'pending'", p.userId)?.n ?? 0,
      trades: g.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM trades WHERE to_id = ? AND status = 'pending' AND expires_at > ?", p.userId, now)?.n ?? 0,
      daily: !daily.claimedToday,
      streak: daily.streak,
      contracts: contracts.tasks.filter((t) => !t.claimed && t.done >= t.need).length,
      missions: missions.list.filter((m) => !m.claimed && m.progress >= m.goal).length + (missions.list.every((m) => m.claimed) && !missions.bonusClaimed ? 1 : 0),
      expedition: expedition ? (expedition.endsAt <= now ? "ready" : "active") : "idle",
      expeditionEndsAt: expedition?.endsAt ?? null,
      job: job.ready ? "ready" : job.shiftStartedAt ? "working" : job.jobId ? "idle" : "none",
      jobEndsAt: job.endsAt,
      worldBossAttempts: p.level >= 10 ? Math.max(0, WORLD_BOSS_ATTEMPTS_PER_DAY - wbUsed) : 0,
      event: event ? { id: event.id, name: event.name, icon: event.icon, tokens: eventState(p, event.id).tokens, currency: event.currency, endsAt: eventEndsAt(event) } : null,
    },
  };
}

export type MeSnapshot = ReturnType<typeof meSnapshot>;
