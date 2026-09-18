import { ARENA_DAILY_RANKED, ARENA_MIN_LEVEL, WORLD_BOSS_ATTEMPTS_PER_DAY, WORLD_BOSS_TURNS } from "../../shared/data/meta.ts";
import { BOON_EVERY, DUNGEON_FLOORS, REGIONS, dungeonCheckpoint, dungeonEnemies, dungeonEnemyLevel, isDungeonBossFloor } from "../../shared/data/regions.ts";
import type { Combatant } from "../../shared/data/types.ts";
import { combatantFromHero, combatantFromMonster } from "../../shared/rules/combat.ts";
import { rollVictoryLoot } from "../../shared/rules/loot.ts";
import { monsterStats, referenceHero } from "../../shared/rules/monsters.ts";
import { createRng, freshSeed } from "../../shared/rules/rng.ts";
import { GameError, notFound, tooFast } from "../lib/errors.ts";
import { dayKey, weekKey } from "../lib/time.ts";
import { type BattleRow, assertCanStartBattle, heroCombatant, insertBattle, loadoutSkills, petCombatant, registerFinalizer } from "./battles.ts";
import type { GameCtx } from "./context.ts";
import { giveDrops } from "./inventory.ts";
import { type Player, addStack, bump, bumpMission, grantCoins, grantXp, heroStats, loadPlayer, savePlayer, sendMail, setMax, settleHp, today } from "./player.ts";
import { defeat } from "./pve.ts";

// ═════════════════════════════════════════════════════════════════════
// Dungeon: roguelite runs. Loot is carried in a pouch and banked when you leave.
// Die, and you keep half the coins and XP but lose the materials.
// ═════════════════════════════════════════════════════════════════════

export interface BoonDef { id: string; name: string; icon: string; desc: string }
export const BOONS: BoonDef[] = [
  { id: "whetstone", name: "Whetstone", icon: "🗡️", desc: "+12% attack for this run" },
  { id: "stoneskin", name: "Stoneskin", icon: "🪨", desc: "+12% defense for this run" },
  { id: "second_wind", name: "Second Wind", icon: "💨", desc: "Recover 50% HP now" },
  { id: "greed", name: "Greed", icon: "💰", desc: "+30% coins in your pouch" },
  { id: "vampiric", name: "Vampiric Rite", icon: "🩸", desc: "+6% lifesteal for this run" },
  { id: "fleet", name: "Fleet Foot", icon: "👟", desc: "+15% speed for this run" },
  { id: "scholar", name: "Scholar's Lamp", icon: "🕯️", desc: "+25% XP in your pouch" },
  { id: "keen", name: "Keen Edge", icon: "🎯", desc: "+8% critical chance for this run" },
];
const BOON_BY_ID = Object.fromEntries(BOONS.map((b) => [b.id, b]));

export interface DungeonRun {
  floor: number;
  startFloor: number;
  hp: number;
  pouch: { coins: number; xp: number; stacks: Record<string, number> };
  boons: string[];
  pendingBoons: string[] | null;
}

const runOf = (p: Player) => (p.state as { dungeon?: DungeonRun | null }).dungeon ?? null;
const setRun = (p: Player, run: DungeonRun | null) => ((p.state as { dungeon?: DungeonRun | null }).dungeon = run);

export function dungeonView(p: Player) {
  const run = runOf(p);
  const checkpoints = [1];
  for (let f = 10; f <= dungeonCheckpoint(p.dungeonBest); f += 10) if (f < DUNGEON_FLOORS) checkpoints.push(f + 1);
  return {
    best: p.dungeonBest,
    checkpoints,
    run: run && { ...run, pendingBoons: run.pendingBoons?.map((id) => BOON_BY_ID[id]) ?? null, boons: run.boons.map((id) => BOON_BY_ID[id]) },
  };
}

export function startRun(g: GameCtx, p: Player, fromFloor: number) {
  if (p.level < 5) throw new GameError("The Dungeon opens at level 5.", { code: "level_locked" });
  if (runOf(p)) throw new GameError("You're already on a run.");
  const allowed = dungeonView(p).checkpoints;
  if (!allowed.includes(fromFloor)) throw new GameError("You haven't reached that checkpoint.");
  const max = heroStats(g, p).maxHp;
  const hp = settleHp(g, p, max);
  if (hp < max * 0.5) throw new GameError("Enter the Dungeon with at least half your HP.");
  setRun(p, { floor: fromFloor, startFloor: fromFloor, hp, pouch: { coins: 0, xp: 0, stacks: {} }, boons: [], pendingBoons: null });
}

function applyBoons(c: Combatant, boons: string[]) {
  for (const b of boons) {
    if (b === "whetstone") c.atk = Math.round(c.atk * 1.12);
    if (b === "stoneskin") c.def = Math.round(c.def * 1.12);
    if (b === "vampiric") c.lifesteal += 6;
    if (b === "fleet") c.spd = Math.round(c.spd * 1.15 * 10) / 10;
    if (b === "keen") c.crit += 8;
  }
}

export function fightFloor(g: GameCtx, p: Player) {
  const run = runOf(p);
  if (!run) throw new GameError("Start a run first.");
  if (run.pendingBoons) throw new GameError("Choose a boon before descending.");
  assertCanStartBattle(g, p, { ignoreHp: true, dungeon: true });
  const floor = run.floor;
  const level = dungeonEnemyLevel(floor);
  const boss = isDungeonBossFloor(floor);
  const elite = !boss && floor % 5 === 0;
  const rng = createRng(freshSeed());
  const e = rng.pick(dungeonEnemies(floor));
  const m = monsterStats(level, boss ? "boss" : elite ? "elite" : "normal");
  const enemy = combatantFromMonster({ name: boss ? `${e.name} Lord` : elite ? `Elite ${e.name}` : e.name, icon: e.icon, level, ...m, isBoss: boss });
  const { combatant, pet } = heroCombatant(g, p, { hpOverride: run.hp });
  applyBoons(combatant, run.boons);
  return insertBattle(g, p.userId, "dungeon", { floor, boss, elite, level, xp: m.xp, coins: m.coins }, { player: combatant, enemy, pet, canFlee: false });
}

registerFinalizer("dungeon", (g, p, b) => {
  const run = runOf(p);
  const c = b.context as { floor: number; boss: boolean; elite: boolean; level: number; xp: number; coins: number };
  if (!run) return { result: b.state.status };
  if (b.state.status !== "won") {
    const coins = grantCoins(g, p, Math.floor(run.pouch.coins / 2));
    const xp = grantXp(g, p, Math.floor(run.pouch.xp / 2));
    setRun(p, null);
    defeat(g, p, b);
    return { result: b.state.status, extra: { runOver: true, kept: { coins, xp }, lostStacks: run.pouch.stacks, reached: c.floor } };
  }
  const stats = heroStats(g, p);
  const loot = rollVictoryLoot(createRng(freshSeed()), { level: c.level, baseCoins: c.coins, baseXp: c.xp, boss: c.boss, elite: c.elite, luck: stats.luck, source: "dungeon" });
  const coinMult = 1 + (run.boons.includes("greed") ? 0.3 : 0) + (run.floor - run.startFloor) * 0.02;
  const xpMult = 1 + (run.boons.includes("scholar") ? 0.25 : 0);
  run.pouch.coins += Math.round(loot.coins * coinMult);
  run.pouch.xp += Math.round(loot.xp * xpMult);
  const gear = loot.drops.filter((d) => d.kind === "gear");
  for (const d of loot.drops) if (d.kind === "stack") run.pouch.stacks[d.templateId] = (run.pouch.stacks[d.templateId] ?? 0) + d.qty;
  const drops = giveDrops(g, p, gear);
  run.hp = Math.min(b.state.player.maxHp, b.state.player.hp + Math.round(b.state.player.maxHp * 0.08));
  p.hp = run.hp;
  bump(g, p, "battlesWon");
  bump(g, p, "kills");
  bumpMission(p, "kill");
  bumpMission(p, "dungeon");
  if (c.boss) {
    bump(g, p, "bossKills");
    bumpMission(p, "boss");
  }
  if (c.floor > p.dungeonBest) {
    p.dungeonBest = c.floor;
    setMax(g, p, "dungeonBest", c.floor);
  }
  const cleared = c.floor;
  run.floor = cleared + 1;
  if (cleared >= DUNGEON_FLOORS) {
    bankRun(g, p);
    g.hub.toChannel("world", { type: "feed", icon: "🌑", text: `${p.name} conquered all 100 Dungeon floors!`, at: g.clock.now() });
    return { result: "won", drops, extra: { floor: cleared, complete: true } };
  }
  if (cleared % BOON_EVERY === 0) {
    const rng = createRng(freshSeed());
    const pool = BOONS.map((x) => x.id).filter((id) => id === "second_wind" || !run.boons.includes(id));
    const picks: string[] = [];
    while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]!);
    run.pendingBoons = picks;
  }
  return { result: "won", drops, extra: { floor: cleared, pouch: run.pouch, boonOffer: run.pendingBoons?.map((id) => BOON_BY_ID[id]) ?? null } };
});

export function chooseBoon(g: GameCtx, p: Player, boonId: string) {
  const run = runOf(p);
  if (!run?.pendingBoons) throw new GameError("There's no boon to choose.");
  if (!run.pendingBoons.includes(boonId)) throw new GameError("That boon isn't on offer.");
  run.pendingBoons = null;
  if (boonId === "second_wind") {
    const max = heroStats(g, p).maxHp;
    run.hp = Math.min(max, run.hp + Math.round(max * 0.5));
    p.hp = run.hp;
  } else {
    run.boons.push(boonId);
  }
  return BOON_BY_ID[boonId];
}

export function leaveRun(g: GameCtx, p: Player) {
  if (!runOf(p)) throw new GameError("You aren't on a run.");
  if (g.db.get("SELECT 1 FROM battles WHERE user_id = ? AND status = 'active'", p.userId)) throw new GameError("Finish the fight first.");
  return bankRun(g, p);
}

function bankRun(g: GameCtx, p: Player) {
  const run = runOf(p)!;
  const coins = grantCoins(g, p, run.pouch.coins);
  const xp = grantXp(g, p, run.pouch.xp);
  for (const [t, q] of Object.entries(run.pouch.stacks)) addStack(g, p.userId, t, q);
  p.hp = run.hp;
  p.hpAt = g.clock.now();
  setRun(p, null);
  return { coins, xp, stacks: run.pouch.stacks, floorsCleared: run.floor - run.startFloor };
}

// ═════════════════════════════════════════════════════════════════════
// World boss: a weekly shared foe. Every hero's damage counts toward one health bar.
// ═════════════════════════════════════════════════════════════════════

interface BossRow { week: string; boss: string; max_hp: number; hp: number; defeated_at: number | null; rewarded: number }

export function currentWorldBoss(g: GameCtx) {
  const now = g.clock.now();
  const week = weekKey(now);
  let row = g.db.get<BossRow>("SELECT * FROM world_boss WHERE week = ?", week);
  if (!row) {
    settlePreviousBosses(g, week);
    const weekNo = Number(week.split("-W")[1] ?? 1);
    const region = REGIONS[(weekNo * 7) % REGIONS.length]!;
    const active = g.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM players WHERE last_seen_at > ?", now - 7 * 86_400_000)?.n ?? 0;
    const maxHp = 60_000 * Math.max(10, active);
    g.db.run("INSERT OR IGNORE INTO world_boss (week, boss, max_hp, hp) VALUES (?, ?, ?, ?)", week,
      JSON.stringify({ name: region.boss.name, icon: region.boss.icon, region: region.name }), maxHp, maxHp);
    row = g.db.get<BossRow>("SELECT * FROM world_boss WHERE week = ?", week)!;
  }
  return { ...row, boss: JSON.parse(row.boss) as { name: string; icon: string; region: string } };
}

export function worldBossView(g: GameCtx, p: Player) {
  const b = currentWorldBoss(g);
  const top = g.db.all<{ user_id: number; damage: number; hits: number; name: string }>(
    "SELECT h.user_id, h.damage, h.hits, pl.name FROM world_boss_hits h JOIN players pl ON pl.user_id = h.user_id WHERE h.week = ? ORDER BY h.damage DESC LIMIT 20", b.week);
  const mine = g.db.get<{ damage: number; hits: number }>("SELECT damage, hits FROM world_boss_hits WHERE week = ? AND user_id = ?", b.week, p.userId);
  const participants = g.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM world_boss_hits WHERE week = ?", b.week)?.n ?? 0;
  const day = today(g);
  const used = p.state.worldBoss?.day === day ? p.state.worldBoss.attempts : 0;
  return {
    week: b.week, boss: b.boss, maxHp: b.max_hp, hp: Math.max(0, b.hp), defeated: !!b.defeated_at, participants,
    top: top.map((t, i) => ({ rank: i + 1, userId: t.user_id, name: t.name, damage: t.damage, hits: t.hits })),
    mine: mine ?? { damage: 0, hits: 0 }, attemptsLeft: Math.max(0, WORLD_BOSS_ATTEMPTS_PER_DAY - used),
  };
}

export function strikeWorldBoss(g: GameCtx, p: Player) {
  if (p.level < 10) throw new GameError("The world boss can be challenged from level 10.", { code: "level_locked" });
  const b = currentWorldBoss(g);
  if (b.defeated_at) throw new GameError(`${b.boss.name} has fallen this week. A new foe rises on Monday.`);
  const day = today(g);
  const ws = p.state.worldBoss?.day === day ? p.state.worldBoss : { day, attempts: 0 };
  if (ws.attempts >= WORLD_BOSS_ATTEMPTS_PER_DAY) throw tooFast("You've used today's attempts. Come back tomorrow.");
  assertCanStartBattle(g, p, { ignoreHp: true });
  ws.attempts++;
  p.state.worldBoss = ws;
  const m = monsterStats(p.level, "world");
  const stats = heroStats(g, p);
  const { combatant, pet } = heroCombatant(g, p, { hpOverride: stats.maxHp });
  const enemy = combatantFromMonster({ name: b.boss.name, icon: b.boss.icon, level: p.level, hp: 99_999_999, atk: m.atk, def: m.def, spd: m.spd, isBoss: true });
  return insertBattle(g, p.userId, "worldboss", { week: b.week, level: p.level, hpBefore: p.hp }, { player: combatant, enemy, pet, canFlee: false, maxTurns: WORLD_BOSS_TURNS });
}

registerFinalizer("worldboss", (g, p, b) => {
  const c = b.context as { week: string; level: number; hpBefore: number };
  p.hp = c.hpBefore;
  const dealt = b.state.enemy.maxHp - b.state.enemy.hp;
  // Normalize by level so every hero's contribution is comparable.
  const score = Math.max(1, Math.round((dealt / referenceHero(c.level).atk) * 100));
  g.db.run(
    "INSERT INTO world_boss_hits (week, user_id, damage, hits) VALUES (?, ?, ?, 1) ON CONFLICT(week, user_id) DO UPDATE SET damage = damage + excluded.damage, hits = hits + 1",
    c.week, p.userId, score);
  g.db.run("UPDATE world_boss SET hp = hp - ? WHERE week = ? AND defeated_at IS NULL", score, c.week);
  const coins = grantCoins(g, p, Math.round(score * (1 + c.level / 20)));
  const xp = grantXp(g, p, Math.round(score * 0.6 * (1 + c.level / 25)), { applyBonus: true });
  bump(g, p, "worldBossHits");
  const boss = g.db.get<BossRow>("SELECT * FROM world_boss WHERE week = ?", c.week)!;
  g.hub.toChannel("world", { type: "worldboss", week: c.week, hp: Math.max(0, boss.hp), maxHp: boss.max_hp, by: p.name, score });
  if (boss.hp <= 0 && !boss.defeated_at) {
    g.db.run("UPDATE world_boss SET defeated_at = ? WHERE week = ?", g.clock.now(), c.week);
    rewardWorldBoss(g, c.week, true);
    g.hub.toChannel("world", { type: "feed", icon: "🌋", text: `The realm has slain ${JSON.parse(boss.boss).name}! ${p.name} landed the final blow.`, at: g.clock.now() });
  }
  return { result: "won", coins, xp, extra: { score, dealt } };
});

function settlePreviousBosses(g: GameCtx, currentWeek: string) {
  for (const row of g.db.all<BossRow>("SELECT * FROM world_boss WHERE rewarded = 0 AND week != ?", currentWeek)) {
    rewardWorldBoss(g, row.week, !!row.defeated_at);
  }
}

function rewardWorldBoss(g: GameCtx, week: string, defeated: boolean) {
  const row = g.db.get<BossRow>("SELECT * FROM world_boss WHERE week = ?", week);
  if (!row || row.rewarded) return;
  g.db.run("UPDATE world_boss SET rewarded = 1 WHERE week = ?", week);
  const boss = JSON.parse(row.boss) as { name: string };
  const hits = g.db.all<{ user_id: number; damage: number }>("SELECT user_id, damage FROM world_boss_hits WHERE week = ? ORDER BY damage DESC", week);
  hits.forEach((h, i) => {
    const pct = (i + 1) / hits.length;
    const tier = i < 3 ? "champion" : pct <= 0.1 ? "vanguard" : pct <= 0.5 ? "raider" : "ally";
    const lvl = g.db.get<{ level: number }>("SELECT level FROM players WHERE user_id = ?", h.user_id)?.level ?? 1;
    const mult = (defeated ? 1 : 0.4) * { champion: 4, vanguard: 2.5, raider: 1.6, ally: 1 }[tier];
    const stacks: Record<string, number> = { mystic_gem: Math.max(1, Math.round(2 * mult)), star_essence: Math.round(3 * mult) };
    if (defeated && tier !== "ally") stacks.golden_egg = tier === "champion" ? 2 : 1;
    sendMail(g, h.user_id, {
      sender: "War Council",
      subject: defeated ? `🌋 ${boss.name} has fallen (rank #${i + 1})` : `🌋 ${boss.name} escaped (rank #${i + 1})`,
      body: defeated
        ? `The realm stood together and brought down ${boss.name}. As a ${tier}, your share of the spoils is attached.`
        : `${boss.name} survived the week, but your efforts earned a share of the war chest.`,
      attachments: { coins: Math.round((2_000 + lvl * 400) * mult), stacks },
      expiresInDays: 30,
    });
  });
}

// ═════════════════════════════════════════════════════════════════════
// Ranked arena: fight an AI-controlled snapshot of a real player near your rating.
// ═════════════════════════════════════════════════════════════════════

export const ELO_K = 32;
export const eloExpected = (a: number, b: number) => 1 / (1 + Math.pow(10, (b - a) / 400));

export function snapshotFighter(g: GameCtx, userId: number): Combatant {
  const other = loadPlayer(g, userId);
  const stats = heroStats(g, other);
  return combatantFromHero(stats, { name: other.name, icon: "", level: other.level, classId: other.classId, skills: loadoutSkills(g, userId) }, stats.maxHp);
}

export function startRanked(g: GameCtx, p: Player) {
  if (p.level < ARENA_MIN_LEVEL) throw new GameError(`The arena opens at level ${ARENA_MIN_LEVEL}.`, { code: "level_locked" });
  const day = dayKey(g.clock.now());
  const a = p.state.arena?.day === day ? p.state.arena : { day, ranked: 0 };
  if (a.ranked >= ARENA_DAILY_RANKED) throw tooFast("You've fought all your ranked matches today.");
  assertCanStartBattle(g, p, { ignoreHp: true });
  const candidates = g.db.all<{ user_id: number; arena_rating: number }>(
    "SELECT user_id, arena_rating FROM players WHERE user_id != ? AND level >= ? ORDER BY ABS(arena_rating - ?) ASC LIMIT 6",
    p.userId, ARENA_MIN_LEVEL, p.arenaRating);
  if (!candidates.length) throw new GameError("No opponents are available yet. Invite a friend!");
  const opp = createRng(freshSeed()).pick(candidates);
  a.ranked++;
  p.state.arena = a;
  const stats = heroStats(g, p);
  const { combatant, pet } = heroCombatant(g, p, { hpOverride: stats.maxHp });
  const enemy = snapshotFighter(g, opp.user_id);
  return insertBattle(g, p.userId, "arena", { opponentId: opp.user_id, opponentRating: opp.arena_rating, hpBefore: p.hp }, { player: combatant, enemy, pet, canFlee: false });
}

registerFinalizer("arena", (g, p, b) => {
  const c = b.context as { opponentId: number; opponentRating: number; hpBefore: number };
  p.hp = c.hpBefore;
  const won = b.state.status === "won";
  const expected = eloExpected(p.arenaRating, c.opponentRating);
  const delta = Math.round(ELO_K * ((won ? 1 : 0) - expected));
  p.arenaRating = Math.max(0, p.arenaRating + delta);
  const opp = g.db.get<{ arena_rating: number }>("SELECT arena_rating FROM players WHERE user_id = ?", c.opponentId);
  if (opp) g.db.run("UPDATE players SET arena_rating = MAX(0, arena_rating - ?) WHERE user_id = ?", Math.round(delta / 2), c.opponentId);
  g.db.run("INSERT INTO arena_matches (id, kind, a_id, b_id, winner_id, rating_delta, created_at) VALUES (?, 'ranked', ?, ?, ?, ?, ?)",
    b.id, p.userId, c.opponentId, won ? p.userId : c.opponentId, delta, g.clock.now());
  let coins = 0;
  let xp = 0;
  if (won) {
    coins = grantCoins(g, p, 200 + p.level * 30);
    xp = grantXp(g, p, Math.round((20 + p.level * 8) * 2), { applyBonus: true });
    bump(g, p, "arenaWins");
    bump(g, p, "duelsWon");
    bumpMission(p, "duel");
  }
  g.hub.toUser(c.opponentId, { type: "arena_defended", by: p.name, won: !won, delta: -Math.round(delta / 2) });
  return { result: b.state.status, coins, xp, extra: { delta, rating: p.arenaRating } };
});

export function arenaHistory(g: GameCtx, userId: number) {
  return g.db.all<{ id: string; kind: string; a_id: number; b_id: number; winner_id: number | null; rating_delta: number; created_at: number; a_name: string; b_name: string }>(
    `SELECT m.*, pa.name AS a_name, pb.name AS b_name FROM arena_matches m
     JOIN players pa ON pa.user_id = m.a_id JOIN players pb ON pb.user_id = m.b_id
     WHERE m.a_id = ? OR m.b_id = ? ORDER BY m.created_at DESC LIMIT 30`, userId, userId);
}

export function assertBattleOwner(b: BattleRow | null, userId: number): BattleRow {
  if (!b || b.userId !== userId) throw notFound("Battle");
  return b;
}

export { petCombatant, savePlayer };
