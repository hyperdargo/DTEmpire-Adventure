import type {
  LUCKY_SYMBOLS} from "../../shared/data/meta.ts";
import {
  BLESSINGS, CONTRACT_TIERS, LUCKY_PAIR_MULT, EXPEDITION_DURATIONS, EXPEDITION_EFFICIENCY, JOBS, JOB_SHIFT_HOURS, LUCKY_DAILY_SPINS, LUCKY_PAYOUT, LUCKY_WEIGHTS, MISSIONS_PER_DAY, MISSION_BONUS_CHEST, MISSION_POOL, OFFERING_DAILY_CAP, STREAK_GRACE_HOURS,
  dailyBase, luckyCost, streakMultiplier,
} from "../../shared/data/meta.ts";
import { REGIONS, REGION_BY_ID } from "../../shared/data/regions.ts";
import { rollVictoryLoot } from "../../shared/rules/loot.ts";
import { monsterStats } from "../../shared/rules/monsters.ts";
import { innCost } from "../../shared/rules/progression.ts";
import { createRng, freshSeed } from "../../shared/rules/rng.ts";
import { GameError, notFound, tooFast } from "../lib/errors.ts";
import { DAY, HOUR, MINUTE, dayKey, nextUtcMidnight } from "../lib/time.ts";
import type { GameCtx } from "./context.ts";
import { giveDrops } from "./inventory.ts";
import { type Player, addStack, bump, bumpMission, grantCoins, grantXp, heroStats, requireLevel, setMax, settleHp, spendCoins, xpPctOfLevel } from "./player.ts";
import { bestiaryKey } from "./pve.ts";

// ── Daily reward & streak ─────────────────────────────────────────────

export function dailyStatus(g: GameCtx, p: Player) {
  const now = g.clock.now();
  const d = p.state.daily;
  const claimedToday = d?.lastDay === dayKey(now);
  const alive = !!d && now - d.lastAt <= STREAK_GRACE_HOURS * HOUR;
  const streak = claimedToday ? d!.streak : alive ? d!.streak : 0;
  const nextStreak = claimedToday ? streak : streak + 1;
  const base = dailyBase(p.level);
  return {
    claimedToday,
    streak,
    best: d?.best ?? 0,
    nextStreak,
    multiplier: streakMultiplier(nextStreak),
    preview: { coins: Math.round(base.coins * streakMultiplier(nextStreak)), xp: Math.round(xpPctOfLevel(p, base.xpPct) * streakMultiplier(nextStreak)) },
    chestDay: nextStreak % 7 === 0,
    resetsAt: nextUtcMidnight(now),
  };
}

export function claimDaily(g: GameCtx, p: Player) {
  const s = dailyStatus(g, p);
  if (s.claimedToday) throw new GameError("You've already claimed today's reward. It resets at midnight UTC.", { code: "already_claimed" });
  const now = g.clock.now();
  const streak = s.nextStreak;
  const coins = grantCoins(g, p, s.preview.coins);
  const xp = grantXp(g, p, s.preview.xp);
  let chest: { coins: number; egg: string } | null = null;
  if (streak % 7 === 0) {
    const weeks = streak / 7;
    const chestCoins = Math.min(20, weeks) * (500 + p.level * 60);
    grantCoins(g, p, chestCoins);
    const egg = weeks >= 4 ? "golden_egg" : "mystery_egg";
    addStack(g, p.userId, egg, 1);
    chest = { coins: chestCoins, egg };
  }
  p.state.daily = { lastDay: dayKey(now), lastAt: now, streak, best: Math.max(streak, p.state.daily?.best ?? 0) };
  setMax(g, p, "dailyStreak", streak);
  return { coins, xp, streak, multiplier: s.multiplier, chest };
}

// ── Hunt contracts ────────────────────────────────────────────────────

export function ensureContracts(g: GameCtx, p: Player) {
  const day = dayKey(g.clock.now());
  if (p.state.contracts?.day === day) return p.state.contracts;
  const unlocked = REGIONS.filter((r) => r.minLevel <= p.level);
  const top = unlocked.slice(-3);
  const rng = createRng(`contracts:${day}:${top.map((r) => r.id).join(",")}`);
  const pool = top.flatMap((r) => r.monsters.map((m) => ({ key: bestiaryKey(r.id, m.id) })));
  const picks: string[] = [];
  while (picks.length < 3 && picks.length < pool.length) {
    const k = rng.pick(pool).key;
    if (!picks.includes(k)) picks.push(k);
  }
  const bestiary = p.state.bestiary ?? {};
  p.state.contracts = {
    day,
    tasks: picks.map((key, i) => {
      const tier = CONTRACT_TIERS[i]!;
      return { key, need: tier.need, base: bestiary[key] ?? 0, coins: tier.coins + tier.coinsPerLevel * p.level, xp: xpPctOfLevel(p, tier.xpPct) };
    }),
    claimed: [],
  };
  return p.state.contracts;
}

export function contractView(g: GameCtx, p: Player) {
  const c = ensureContracts(g, p);
  const bestiary = p.state.bestiary ?? {};
  return {
    day: c.day,
    resetsAt: nextUtcMidnight(g.clock.now()),
    tasks: c.tasks.map((t, i) => {
      const [regionId, monsterId] = t.key.split(":");
      const region = REGION_BY_ID[regionId!];
      const monster = region?.monsters.find((m) => m.id === monsterId);
      const done = Math.max(0, Math.min(t.need, (bestiary[t.key] ?? 0) - t.base));
      return { index: i, regionId, regionName: region?.name, monster: monster?.name ?? monsterId, icon: monster?.icon ?? "👹", need: t.need, done, coins: t.coins, xp: t.xp, claimed: c.claimed.includes(i) };
    }),
  };
}

export function claimContract(g: GameCtx, p: Player, index: number) {
  const view = contractView(g, p);
  const t = view.tasks[index];
  if (!t) throw notFound("Contract");
  if (t.claimed) throw new GameError("Already claimed.");
  if (t.done < t.need) throw new GameError(`Slay ${t.need - t.done} more ${t.monster}.`);
  p.state.contracts!.claimed.push(index);
  grantCoins(g, p, t.coins);
  grantXp(g, p, t.xp);
  bump(g, p, "contractsDone");
  return { coins: t.coins, xp: t.xp };
}

// ── Missions ──────────────────────────────────────────────────────────

export function ensureMissions(g: GameCtx, p: Player) {
  const day = dayKey(g.clock.now());
  if (p.state.missions?.day === day) return p.state.missions;
  const rng = createRng(`missions:${p.userId}:${day}`);
  const types = [...new Set(MISSION_POOL.map((m) => m.type))].filter((t) => !(t === "dungeon" && p.level < 5) && !(t === "duel" && p.level < 5));
  const chosen: typeof MISSION_POOL = [];
  while (chosen.length < MISSIONS_PER_DAY && types.length) {
    const t = types.splice(Math.floor(rng.next() * types.length), 1)[0]!;
    chosen.push(rng.pick(MISSION_POOL.filter((m) => m.type === t)));
  }
  p.state.missions = {
    day,
    bonusClaimed: false,
    list: chosen.map((m) => ({
      type: m.type, name: m.name, desc: m.desc, goal: m.type === "coins" ? Math.round(m.goal * (1 + p.level / 10)) : m.goal,
      progress: 0, coins: Math.round(m.coins * (1 + p.level / 15)), xp: xpPctOfLevel(p, m.xpPct), claimed: false,
    })),
  };
  return p.state.missions;
}

export function claimMission(g: GameCtx, p: Player, index: number) {
  const m = ensureMissions(g, p);
  const mission = m.list[index];
  if (!mission) throw notFound("Mission");
  if (mission.claimed) throw new GameError("Already claimed.");
  if (mission.progress < mission.goal) throw new GameError("That mission isn't finished yet.");
  mission.claimed = true;
  grantCoins(g, p, mission.coins);
  grantXp(g, p, mission.xp);
  bump(g, p, "missionsDone");
  return { coins: mission.coins, xp: mission.xp };
}

export function claimMissionChest(g: GameCtx, p: Player) {
  const m = ensureMissions(g, p);
  if (m.bonusClaimed) throw new GameError("Already claimed.");
  if (!m.list.every((x) => x.claimed)) throw new GameError("Claim all three missions first.");
  m.bonusClaimed = true;
  const coins = grantCoins(g, p, MISSION_BONUS_CHEST.coinsPerLevel * p.level);
  addStack(g, p.userId, MISSION_BONUS_CHEST.egg, 1);
  return { coins, egg: MISSION_BONUS_CHEST.egg };
}

// ── Jobs (8-hour shifts) ──────────────────────────────────────────────

export function jobStatus(g: GameCtx, p: Player) {
  const now = g.clock.now();
  const job = p.state.job ? JOBS.find((j) => j.id === p.state.job!.id) : undefined;
  const started = p.state.job?.shiftStartedAt ?? null;
  const endsAt = started ? started + JOB_SHIFT_HOURS * HOUR : null;
  return { jobId: job?.id ?? null, shiftStartedAt: started, endsAt, ready: !!endsAt && endsAt <= now };
}

export function takeJob(g: GameCtx, p: Player, jobId: string) {
  const job = JOBS.find((j) => j.id === jobId);
  if (!job) throw notFound("Job");
  requireLevel(p, job.level, `The ${job.name} job`);
  if (p.state.job?.shiftStartedAt) throw new GameError("Finish your current shift before changing jobs.");
  p.state.job = { id: job.id, shiftStartedAt: null };
}

export function startShift(g: GameCtx, p: Player) {
  if (!p.state.job) throw new GameError("Pick a job first.");
  if (p.state.job.shiftStartedAt) throw new GameError("You're already on shift.");
  p.state.job.shiftStartedAt = g.clock.now();
}

export function collectShift(g: GameCtx, p: Player) {
  const s = jobStatus(g, p);
  const job = JOBS.find((j) => j.id === s.jobId);
  if (!job || !s.shiftStartedAt) throw new GameError("You aren't on a shift.");
  if (!s.ready) throw new GameError(`Your shift ends in ${Math.ceil((s.endsAt! - g.clock.now()) / MINUTE)} minutes.`);
  p.state.job!.shiftStartedAt = null;
  const coins = grantCoins(g, p, job.wage);
  const xp = grantXp(g, p, xpPctOfLevel(p, job.xpPct));
  return { coins, xp };
}

// ── Temple ────────────────────────────────────────────────────────────

export function pray(g: GameCtx, p: Player, blessingId: string) {
  const b = BLESSINGS.find((x) => x.id === blessingId);
  if (!b) throw notFound("Blessing");
  const now = g.clock.now();
  const active = (p.state.buffs ?? []).filter((x) => x.until > now);
  if (active.some((x) => x.id === b.id)) throw new GameError(`${b.name} is already upon you.`);
  spendCoins(p, b.costPerLevel * p.level, b.name);
  p.state.buffs = [...active, { id: b.id, until: now + b.minutes * MINUTE, buff: b.buff }];
  return { until: now + b.minutes * MINUTE };
}

export function offer(g: GameCtx, p: Player, tier: 1 | 2 | 3) {
  const day = dayKey(g.clock.now());
  const o = p.state.offerings?.day === day ? p.state.offerings : { day, count: 0 };
  if (o.count >= OFFERING_DAILY_CAP) throw new GameError("The altar is quiet. Return tomorrow.");
  const coins = { 1: 20, 2: 60, 3: 150 }[tier] * p.level + 50;
  const xpPct = { 1: 0.05, 2: 0.14, 3: 0.33 }[tier];
  spendCoins(p, coins, "the offering");
  o.count++;
  p.state.offerings = o;
  const xp = grantXp(g, p, xpPctOfLevel(p, xpPct));
  return { coins, xp, remaining: OFFERING_DAILY_CAP - o.count };
}

// ── Inn ───────────────────────────────────────────────────────────────

export function rest(g: GameCtx, p: Player) {
  if (g.db.get("SELECT 1 FROM battles WHERE user_id = ? AND status = 'active'", p.userId)) throw new GameError("You can't rest mid-battle.");
  const max = heroStats(g, p).maxHp;
  const hp = settleHp(g, p, max);
  if (hp >= max) throw new GameError("You're already fully rested.");
  const cost = innCost(p.level);
  spendCoins(p, cost, "a room at the inn");
  p.hp = max;
  p.hpAt = g.clock.now();
  return { cost };
}

// ── Lucky roll ────────────────────────────────────────────────────────

export function luckyRoll(g: GameCtx, p: Player) {
  const day = dayKey(g.clock.now());
  const l = p.state.lucky?.day === day ? p.state.lucky : { day, spins: 0 };
  if (l.spins >= LUCKY_DAILY_SPINS) throw tooFast("The wheel rests until tomorrow.");
  const cost = luckyCost(p.level);
  spendCoins(p, cost, "a spin");
  l.spins++;
  p.state.lucky = l;
  const rng = createRng(freshSeed());
  const reels = [0, 1, 2].map(() => rng.weighted(LUCKY_WEIGHTS)) as (typeof LUCKY_SYMBOLS)[number][];
  let win = 0;
  let jackpot = false;
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    win = LUCKY_PAYOUT[reels[0]!] * cost;
    jackpot = reels[0] === "👑";
  } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
    win = Math.round(cost * LUCKY_PAIR_MULT);
  }
  if (win) grantCoins(g, p, win);
  if (jackpot) {
    bump(g, p, "luckyJackpots");
    g.hub.toChannel("world", { type: "feed", icon: "👑", text: `${p.name} hit the Lucky Roll jackpot for ${win.toLocaleString("en-US")} coins!`, at: g.clock.now() });
  }
  return { reels, cost, win, jackpot, spinsLeft: LUCKY_DAILY_SPINS - l.spins };
}

// ── Expeditions (idle progress while away) ────────────────────────────

export function startExpedition(g: GameCtx, p: Player, regionId: string, durationId: string) {
  const region = REGION_BY_ID[regionId];
  if (!region) throw notFound("Region");
  if (p.level < region.minLevel) throw new GameError(`${region.name} opens at level ${region.minLevel}.`);
  const duration = EXPEDITION_DURATIONS.find((d) => d.id === durationId);
  if (!duration) throw notFound("Duration");
  if (p.state.expedition) throw new GameError("Your scouts are already out on an expedition.");
  const now = g.clock.now();
  p.state.expedition = { regionId, durationId, startedAt: now, endsAt: now + duration.minutes * MINUTE };
  return p.state.expedition;
}

export function collectExpedition(g: GameCtx, p: Player) {
  const e = p.state.expedition;
  if (!e) throw new GameError("No expedition is underway.");
  const now = g.clock.now();
  if (now < e.endsAt) throw new GameError(`Your scouts return in ${Math.ceil((e.endsAt - now) / MINUTE)} minutes.`);
  const region = REGION_BY_ID[e.regionId]!;
  const minutes = (e.endsAt - e.startedAt) / MINUTE;
  // Roughly one encounter every 90 seconds of active play, at reduced efficiency.
  const fights = Math.max(1, Math.round((minutes * 60) / 90));
  const level = Math.min(p.level, region.maxLevel);
  const m = monsterStats(level);
  const rng = createRng(freshSeed());
  const overLevel = Math.max(0, p.level - region.maxLevel);
  const eff = EXPEDITION_EFFICIENCY * Math.max(0.2, 1 - overLevel * 0.05);
  const coins = grantCoins(g, p, Math.round(fights * m.coins * eff));
  const xp = grantXp(g, p, Math.round(fights * m.xp * eff), { applyBonus: true });
  const drops = [];
  const dropRolls = Math.max(1, Math.round(fights / 12));
  for (let i = 0; i < dropRolls; i++) drops.push(...rollVictoryLoot(rng, { level, baseCoins: 0, baseXp: 0, source: "expedition", luck: heroStats(g, p).luck }).drops);
  const given = giveDrops(g, p, drops.slice(0, 12));
  p.state.expedition = null;
  bump(g, p, "expeditions");
  bumpMission(p, "expedition");
  return { coins, xp, fights, drops: given };
}

// ── High-Roller Salon (Unlimited High Stakes Gamble) ───────────────────

export function highRollerGamble(
  g: GameCtx,
  p: Player,
  input: { game: "coin" | "dice" | "slots"; stake: number; choice?: string }
) {
  const allowedStakes = [10_000, 50_000, 100_000, 250_000, 500_000];
  const stake = Math.floor(input.stake);
  if (!allowedStakes.includes(stake)) {
    throw new GameError("Invalid stake amount. Allowed stakes: 10k, 50k, 100k, 250k, 500k.");
  }
  if (p.coins < stake) {
    throw new GameError(`You need ${stake.toLocaleString("en-US")} coins for this wager.`);
  }

  spendCoins(p, stake, `a ${input.game} high-roller wager`);
  const rng = createRng(freshSeed());
  let win = 0;
  let multiplier = 0;
  let outcomeDesc = "";
  let details: Record<string, unknown> = {};

  if (input.game === "coin") {
    const call = input.choice === "tails" ? "tails" : "heads";
    const flip = rng.chance(50) ? "heads" : "tails";
    const won = call === flip;
    multiplier = won ? 2.0 : 0;
    win = Math.round(stake * multiplier);
    outcomeDesc = won
      ? `Coin showed ${flip.toUpperCase()}! You doubled your wager!`
      : `Coin showed ${flip.toUpperCase()}. House took the pot.`;
    details = { flip, call, won };
  } else if (input.game === "dice") {
    const d1 = rng.int(1, 6);
    const d2 = rng.int(1, 6);
    const total = d1 + d2;
    if (total === 12) {
      multiplier = 10.0;
      outcomeDesc = `DOUBLE SIXES! 🐉 Imperial Dragon Jackpot! 10× Payout!`;
    } else if (total === 2) {
      multiplier = 5.0;
      outcomeDesc = `SNAKE EYES! 🐍 5× Payout!`;
    } else if (total === 10 || total === 11) {
      multiplier = 3.0;
      outcomeDesc = `HIGH ROLL! (${total}) 3× Payout!`;
    } else if (total >= 7 && total <= 9) {
      multiplier = 1.5;
      outcomeDesc = `SOLID ROLL! (${total}) 1.5× Payout!`;
    } else {
      multiplier = 0;
      outcomeDesc = `Roll was ${total} (low). The house wins.`;
    }
    win = Math.round(stake * multiplier);
    details = { d1, d2, total, multiplier };
  } else {
    const reels = [0, 1, 2].map(() => rng.weighted(LUCKY_WEIGHTS)) as (typeof LUCKY_SYMBOLS)[number][];
    let jackpot = false;
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      multiplier = LUCKY_PAYOUT[reels[0]!];
      jackpot = reels[0] === "👑";
      outcomeDesc = jackpot ? "HIGH-ROLLER JACKPOT! 👑👑👑" : `TRIPLE MATCH! ${reels[0]} 3-of-a-kind!`;
    } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
      multiplier = LUCKY_PAIR_MULT;
      outcomeDesc = "Matching pair! 1.2× return.";
    } else {
      multiplier = 0;
      outcomeDesc = "No match. The house keeps the stake.";
    }
    win = Math.round(stake * multiplier);
    details = { reels, jackpot, multiplier };
  }

  if (win > 0) {
    grantCoins(g, p, win);
    p.counters.highRollerWon = (p.counters.highRollerWon ?? 0) + win;
  } else {
    p.counters.highRollerLost = (p.counters.highRollerLost ?? 0) + stake;
  }

  if (win >= 250_000) {
    g.hub.toChannel("world", {
      type: "feed",
      icon: "💎",
      text: `${p.name} won ${win.toLocaleString("en-US")} coins in the High-Roller Salon!`,
      at: g.clock.now(),
    });
  }

  return {
    game: input.game,
    stake,
    win,
    multiplier,
    outcomeDesc,
    coins: p.coins,
    details,
  };
}

export const DAILY_RESET_MS = DAY;
