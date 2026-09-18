import { MASTERY_TIERS, AI_DUELISTS, DUEL_MIN_LEVEL } from "../../shared/data/meta.ts";
import { REGION_BY_ID, STORY_CHAPTERS, chapterForFloor, isTowerBossFloor, towerEnemyLevel, towerEnemyNames, towerLevelReq, TOWER_FLOORS } from "../../shared/data/regions.ts";
import { SKILL_BY_NAME, SKILLS } from "../../shared/data/skills.ts";
import { combatantFromMonster } from "../../shared/rules/combat.ts";
import { rollVictoryLoot, type LootSource } from "../../shared/rules/loot.ts";
import { monsterStats } from "../../shared/rules/monsters.ts";
import { createRng, freshSeed } from "../../shared/rules/rng.ts";
import { petXpToNext } from "../../shared/rules/stats.ts";
import { PET_MAX_LEVEL } from "../../shared/data/pets.ts";
import { dualXpToNext, DUAL_CLASS_MAX_LEVEL } from "../../shared/data/classes.ts";
import type { Rarity } from "../../shared/data/types.ts";
import { GameError, notFound } from "../lib/errors.ts";
import type { GameCtx } from "./context.ts";
import { type BattleOutcome, type BattleRow, assertCanStartBattle, heroCombatant, insertBattle, registerFinalizer } from "./battles.ts";
import { giveDrops } from "./inventory.ts";
import { type Player, bump, bumpMission, grantCoins, grantXp, heroStats, sendMail, setMax, settleHp } from "./player.ts";

export const bestiaryKey = (regionId: string, monsterId: string) => `${regionId}:${monsterId}`;

// ── Shared victory payout ─────────────────────────────────────────────

export function payVictory(
  g: GameCtx, p: Player,
  opts: { level: number; coins: number; xp: number; boss?: boolean; elite?: boolean; source: LootSource; noDrops?: boolean },
) {
  const stats = heroStats(g, p);
  const loot = rollVictoryLoot(createRng(freshSeed()), {
    level: opts.level, baseCoins: opts.coins, baseXp: opts.xp, boss: opts.boss, elite: opts.elite, luck: stats.luck, source: opts.source,
  });
  const coins = grantCoins(g, p, loot.coins, { fromBattle: true });
  const xp = grantXp(g, p, loot.xp, { applyBonus: true });
  const drops = opts.noDrops ? [] : giveDrops(g, p, loot.drops);
  bump(g, p, "battlesWon");
  bump(g, p, "coinsEarned", coins);
  bump(g, p, "kills");
  bumpMission(p, "kill");
  if (opts.boss) {
    bump(g, p, "bossKills");
    bumpMission(p, "boss");
  }
  if (opts.elite) bump(g, p, "eliteKills");
  growCompanions(g, p, xp);
  return { coins, xp, drops };
}

/** The active pet and the dual class share in battle XP. */
function growCompanions(g: GameCtx, p: Player, xp: number) {
  const pet = g.db.get<{ id: number; level: number; xp: number; rarity: string; name: string | null; species_id: string }>(
    "SELECT * FROM pets WHERE owner_id = ? AND active = 1", p.userId);
  if (pet) {
    const max = PET_MAX_LEVEL[pet.rarity as Rarity];
    let level = pet.level;
    let petXp = pet.xp + Math.ceil(xp * 0.5);
    while (level < max && petXp >= petXpToNext(level)) {
      petXp -= petXpToNext(level);
      level++;
      p.notices.push({ kind: "toast", tone: "good", icon: "🐾", text: `Your pet reached level ${level}!` });
    }
    if (level >= max) petXp = 0;
    g.db.run("UPDATE pets SET level = ?, xp = ? WHERE id = ?", level, petXp, pet.id);
  }
  const dual = p.state.dual;
  if (dual && dual.level < DUAL_CLASS_MAX_LEVEL) {
    dual.xp += Math.ceil(xp * 0.5);
    while (dual.level < DUAL_CLASS_MAX_LEVEL && dual.xp >= dualXpToNext(dual.level)) {
      dual.xp -= dualXpToNext(dual.level);
      dual.level++;
      p.notices.push({ kind: "toast", tone: "good", icon: "🔀", text: `Dual class reached level ${dual.level}!` });
    }
  }
}

function recordBestiary(g: GameCtx, p: Player, key: string, name: string) {
  const b = (p.state.bestiary ??= {});
  const first = !b[key];
  b[key] = (b[key] ?? 0) + 1;
  if (first) setMax(g, p, "bestiaryDiscovered", Object.keys(b).length);
  const mastery = (p.state.mastery ??= {});
  let rank = mastery[key] ?? 0;
  for (let i = rank; i < MASTERY_TIERS.length; i++) {
    const tier = MASTERY_TIERS[i]!;
    if (b[key]! < tier.kills) break;
    rank = i + 1;
    p.coins += tier.coins;
    p.notices.push({ kind: "mastery", monster: name, rank: tier.name, coins: tier.coins });
    sendMail(g, p.userId, {
      sender: "Bestiary",
      subject: `🏅 Mastery: ${tier.name}`,
      body: `You've reached ${tier.name} rank against ${name} (${b[key]} defeated).\n+${tier.coins.toLocaleString("en-US")} coins. You now deal extra damage and take less from this foe.`,
    });
  }
  mastery[key] = rank;
}

// ── Adventure ─────────────────────────────────────────────────────────

export function startAdventure(g: GameCtx, p: Player, regionId: string, wantBoss: boolean) {
  const region = REGION_BY_ID[regionId];
  if (!region) throw notFound("Region");
  if (p.level < region.minLevel) throw new GameError(`${region.name} opens at level ${region.minLevel}.`, { code: "level_locked" });
  const kills = p.state.regionKills?.[region.id] ?? 0;
  if (wantBoss && kills < region.bossUnlockKills) {
    throw new GameError(`Defeat ${region.bossUnlockKills - kills} more monsters in ${region.name} to draw out ${region.boss.name}.`);
  }
  assertCanStartBattle(g, p);
  const rng = createRng(freshSeed());
  const level = Math.min(region.maxLevel, Math.max(region.minLevel, Math.min(p.level, rng.int(region.minLevel, region.maxLevel))));
  const monster = wantBoss ? region.boss : rng.pick(region.monsters);
  // A lucky wanderer: 6% of normal encounters are elites with better loot.
  const elite = !wantBoss && rng.chance(6);
  const tier = wantBoss ? "boss" : elite ? "elite" : "normal";
  const m = monsterStats(level, tier, monster.shape);
  const key = bestiaryKey(region.id, monster.id);
  const { combatant, pet } = heroCombatant(g, p, { masteryRank: p.state.mastery?.[key] ?? 0 });
  const enemy = combatantFromMonster({ name: elite ? `Elite ${monster.name}` : monster.name, icon: monster.icon, level, ...m, isBoss: wantBoss });
  return insertBattle(g, p.userId, "adventure", {
    regionId: region.id, monsterId: monster.id, key, name: monster.name, boss: wantBoss, elite, level, xp: m.xp, coins: m.coins,
  }, { player: combatant, enemy, pet, canFlee: !wantBoss });
}

registerFinalizer("adventure", (g, p, b) => {
  const c = b.context as { regionId: string; key: string; name: string; boss: boolean; elite: boolean; level: number; xp: number; coins: number };
  if (b.state.status !== "won") return defeat(g, p, b);
  const pay = payVictory(g, p, { level: c.level, coins: c.coins, xp: c.xp, boss: c.boss, elite: c.elite, source: "adventure" });
  recordBestiary(g, p, c.key, c.name);
  const rk = (p.state.regionKills ??= {});
  rk[c.regionId] = (rk[c.regionId] ?? 0) + 1;
  return { result: "won", ...pay };
});

export function defeat(g: GameCtx, p: Player, b: BattleRow): BattleOutcome {
  if (b.state.status === "lost" || b.state.status === "timeout") {
    bump(g, p, "deaths");
    p.hp = Math.max(1, Math.round(b.state.player.maxHp * 0.1));
    p.hpAt = g.clock.now();
  }
  return { result: b.state.status };
}

// ── Tower of Ascension ────────────────────────────────────────────────

export function startTower(g: GameCtx, p: Player) {
  const floor = p.towerFloor + 1;
  if (floor > TOWER_FLOORS) throw new GameError("You have conquered every floor of the Tower.");
  const req = towerLevelReq(floor);
  if (p.level < req) throw new GameError(`Floor ${floor} requires level ${req}.`, { code: "level_locked", details: { level: req } });
  assertCanStartBattle(g, p);
  const rng = createRng(freshSeed());
  const boss = isTowerBossFloor(floor);
  const level = towerEnemyLevel(floor);
  const chapter = chapterForFloor(floor);
  const pick = rng.pick(towerEnemyNames(floor));
  const m = monsterStats(level, boss ? "boss" : "elite");
  const enemy = combatantFromMonster({
    name: boss ? chapter.boss.name : pick.name, icon: boss ? chapter.boss.emoji : pick.icon, level, ...m, isBoss: boss,
  });
  const { combatant, pet } = heroCombatant(g, p);
  return insertBattle(g, p.userId, "tower", { floor, boss, level, xp: m.xp, coins: m.coins, chapter: chapter.chapter, bossLine: boss ? chapter.boss.line : null },
    { player: combatant, enemy, pet, canFlee: false });
}

registerFinalizer("tower", (g, p, b) => {
  const c = b.context as { floor: number; boss: boolean; level: number; xp: number; coins: number; chapter: number };
  if (b.state.status !== "won") return defeat(g, p, b);
  const firstClear = c.floor > p.towerFloor;
  const pay = payVictory(g, p, { level: c.level, coins: c.coins, xp: c.xp, boss: c.boss, elite: !c.boss, source: "tower" });
  bumpMission(p, "tower");
  const extra: Record<string, unknown> = { floor: c.floor, firstClear };
  if (firstClear) {
    p.towerFloor = c.floor;
    setMax(g, p, "towerFloor", c.floor);
    if (c.boss) extra.chapter = completeChapter(g, p, c.chapter);
    if (c.floor % 10 === 0) {
      g.hub.toChannel("world", { type: "feed", icon: "🏰", text: `${p.name} cleared Tower floor ${c.floor}.`, at: g.clock.now() });
    }
  }
  return { result: "won", ...pay, extra };
});

function completeChapter(g: GameCtx, p: Player, chapterNo: number) {
  const ch = STORY_CHAPTERS[chapterNo - 1];
  if (!ch) return null;
  const rng = createRng(freshSeed());
  const coins = 400 * chapterNo * chapterNo;
  const lines: string[] = [`+${coins.toLocaleString("en-US")} coins`];
  const stacks: Record<string, number> = { skill_book: chapterNo % 4 === 0 ? 1 : 0, mystery_egg: chapterNo % 2 === 0 ? 1 : 0 };
  const learned: string[] = [];
  for (const name of ch.skills) {
    const s = SKILL_BY_NAME[name];
    if (!s) continue;
    const have = g.db.get("SELECT 1 FROM skills WHERE user_id = ? AND skill_id = ?", p.userId, s.id);
    if (!have) {
      g.db.run("INSERT INTO skills (user_id, skill_id, rank) VALUES (?, ?, 1)", p.userId, s.id);
      bump(g, p, "skillsLearned");
      learned.push(s.name);
    } else {
      stacks.skill_book = (stacks.skill_book ?? 0) + 1;
    }
  }
  if (learned.length) lines.push(`Learned ${learned.join(", ")}`);
  let relic: string | null = null;
  if (rng.chance(ch.relic.chance * 2)) {
    relic = ch.relic.name;
    stacks.golden_egg = 1;
    lines.push(`Found ${ch.relic.name}, which cracked open into a Golden Egg`);
  }
  const cleanStacks = Object.fromEntries(Object.entries(stacks).filter(([, q]) => q > 0));
  sendMail(g, p.userId, {
    sender: "The Tower",
    subject: `📖 Chapter ${ch.chapter} complete: ${ch.title}`,
    body: `${ch.lore}\n\nRewards: ${lines.join(" · ")}.`,
    attachments: { coins, stacks: cleanStacks },
  });
  void SKILLS;
  return { chapter: ch.chapter, title: ch.title, relic, learned };
}

// ── AI duels ──────────────────────────────────────────────────────────

export function startAiDuel(g: GameCtx, p: Player, duelistId: string) {
  if (p.level < DUEL_MIN_LEVEL) throw new GameError(`Duels unlock at level ${DUEL_MIN_LEVEL}.`, { code: "level_locked" });
  const d = AI_DUELISTS.find((x) => x.id === duelistId);
  if (!d) throw notFound("Duelist");
  assertCanStartBattle(g, p, { ignoreHp: true });
  const m = monsterStats(d.level, "elite");
  const enemy = combatantFromMonster({ name: d.name, icon: d.icon, level: d.level, ...m, isBoss: false });
  enemy.skills = SKILLS.filter((s) => s.levelReq <= d.level).slice(-3).map((s) => ({ id: s.id, rank: 1 + Math.floor(d.level / 30), cd: 0 }));
  const stats = heroStats(g, p);
  settleHp(g, p, stats.maxHp);
  // Duels are exhibitions: both sides start at full health and nobody keeps wounds.
  const { combatant, pet } = heroCombatant(g, p, { hpOverride: stats.maxHp });
  const wins = (p.counters as Record<string, number>)[`duel_${d.id}`] ?? 0;
  return insertBattle(g, p.userId, "duel_ai", {
    duelistId: d.id, level: d.level, xp: Math.round(m.xp * 1.5), coins: Math.round(m.coins * 1.5), firstWin: wins === 0, hpBefore: p.hp,
  }, { player: combatant, enemy, pet, canFlee: true });
}

registerFinalizer("duel_ai", (g, p, b) => {
  const c = b.context as { duelistId: string; level: number; xp: number; coins: number; firstWin: boolean; hpBefore: number };
  p.hp = c.hpBefore;
  if (b.state.status !== "won") return { result: b.state.status };
  const levelGap = Math.max(0, p.level - c.level);
  const scale = Math.max(0.1, 1 - levelGap * 0.08);
  const coins = grantCoins(g, p, Math.round(c.coins * scale * (c.firstWin ? 5 : 1)));
  const xp = grantXp(g, p, Math.round(c.xp * scale * (c.firstWin ? 3 : 1)), { applyBonus: true });
  bump(g, p, "duelsWon");
  bumpMission(p, "duel");
  (p.counters as Record<string, number>)[`duel_${c.duelistId}`] = ((p.counters as Record<string, number>)[`duel_${c.duelistId}`] ?? 0) + 1;
  return { result: "won", coins, xp, extra: { firstWin: c.firstWin } };
});
