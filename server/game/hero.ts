import { ASCENSION_COST, CLASS_BY_ID, CLASSES, DUAL_CLASS_COST, DUAL_CLASS_LEVEL, REROLL_COST, REROLL_WEIGHTS, STARTER_WEIGHTS, dualXpToNext } from "../../shared/data/classes.ts";
import { GEAR_BY_ID } from "../../shared/data/items.ts";
import { SKILL_BY_ID, SKILL_MAX_RANK, loadoutSlots, skillUpgradeCost } from "../../shared/data/skills.ts";
import type { ClassDef, Rarity } from "../../shared/data/types.ts";
import { rollGear } from "../../shared/rules/items.ts";
import { RARITY_ORDER } from "../../shared/rules/progression.ts";
import { type Rng, createRng, freshSeed } from "../../shared/rules/rng.ts";
import { computeHeroStats } from "../../shared/rules/stats.ts";
import { GameError, conflict, notFound } from "../lib/errors.ts";
import type { GameCtx } from "./context.ts";
import { type Player, addGear, addStack, bump, heroStats, itemFromRow, requireLevel, sendMail, spendCoins } from "./player.ts";

function rollClass(g: GameCtx, rng: Rng, weights: Partial<Record<Rarity, number>>, exclude: string[] = []): ClassDef {
  const claimed = new Set(g.db.all<{ class_id: string }>("SELECT class_id FROM unique_claims").map((r) => r.class_id));
  for (let attempt = 0; attempt < 20; attempt++) {
    const rarity = rng.weighted(weights);
    const pool = CLASSES.filter((c) => c.rarity === rarity && !exclude.includes(c.id) && !(c.rarity === "unique" && claimed.has(c.id)));
    if (pool.length) return rng.pick(pool);
  }
  return CLASS_BY_ID.warrior!;
}

/** Creates the hero for a new account: a rolled class and a starter kit. */
export function createHero(g: GameCtx, userId: number, name: string) {
  return g.db.tx(() => {
    if (g.db.get("SELECT 1 FROM players WHERE user_id = ?", userId)) throw conflict("You already have a hero.");
    const rng = createRng(freshSeed());
    const cls = rollClass(g, rng, STARTER_WEIGHTS);
    const now = g.clock.now();
    const stats = computeHeroStats({ classId: cls.id, classRarity: cls.rarity, level: 1, equipped: [] });
    g.db.run(
      `INSERT INTO players (user_id, name, class_id, class_rarity, coins, hp, hp_at, created_at, last_seen_at, state)
       VALUES (?, ?, ?, ?, 250, ?, ?, ?, ?, ?)`,
      userId, name, cls.id, cls.rarity === "unique" ? "legendary" : cls.rarity, stats.maxHp, now, now, now,
      JSON.stringify({ settings: { autoSalvageCommon: false } }),
    );
    const starterWeapon = CLASSES.find((c) => c.id === cls.id)!.weapon;
    const weaponId = { sword: "wooden_sword", staff: "apprentice_staff", bow: "hunting_bow", dagger: "rusty_dagger", hammer: "wooden_mallet" }[starterWeapon];
    for (const templateId of [weaponId, "leather_armor", "worn_boots"]) {
      const t = GEAR_BY_ID[templateId]!;
      const rolled = rollGear(rng, t, 1, "common");
      const id = addGear(g, userId, { kind: "gear", templateId, rarity: rolled.rarity, ilvl: rolled.ilvl, base: rolled.base as Record<string, number>, affixes: rolled.affixes });
      g.db.run("UPDATE items SET equipped = 1 WHERE id = ?", id);
    }
    addStack(g, userId, "health_potion", 5);
    g.db.run("INSERT INTO skills (user_id, skill_id, rank, slot) VALUES (?, 'power_strike', 1, 0)", userId);
    // Start at full HP with the starter gear on.
    const equipped = g.db.all("SELECT * FROM items WHERE owner_id = ? AND equipped = 1", userId).map((r) => itemFromRow(r as never));
    const full = computeHeroStats({ classId: cls.id, classRarity: cls.rarity, level: 1, equipped }).maxHp;
    g.db.run("UPDATE players SET hp = ?, power = ? WHERE user_id = ?", full, computeHeroStats({ classId: cls.id, classRarity: cls.rarity, level: 1, equipped }).power, userId);
    sendMail(g, userId, {
      sender: "The Empire",
      subject: "⚔️ Welcome to DTEmpire, adventurer",
      body: `The crest has chosen you: a ${cls.rarity} ${cls.name}.\n\nStart in the Dark Forest, climb the Tower of Ascension, and return every day for your daily reward. A small gift is attached.`,
      attachments: { coins: 500, stacks: { mystery_egg: 1 } },
    });
    return cls;
  });
}

export function rerollClass(g: GameCtx, p: Player) {
  const cost = REROLL_COST(p.level);
  spendCoins(p, cost, "a class reroll");
  const rng = createRng(freshSeed());
  const previous = p.classId;
  if (CLASS_BY_ID[previous]?.rarity === "unique") {
    throw new GameError("Unique classes are one of a kind. You can't reroll away from one.");
  }
  const cls = rollClass(g, rng, REROLL_WEIGHTS, [previous]);
  if (cls.rarity === "unique") {
    const r = g.db.run("INSERT OR IGNORE INTO unique_claims (class_id, user_id, claimed_at) VALUES (?, ?, ?)", cls.id, p.userId, g.clock.now());
    if (r.changes === 0) return rerollClass(g, p);
    g.hub.toChannel("world", { type: "feed", icon: "👑", text: `${p.name} awakened the one-of-a-kind ${cls.name} class!`, at: g.clock.now() });
  }
  p.classId = cls.id;
  p.classRarity = cls.rarity;
  p.hp = heroStats(g, p).maxHp;
  return { cls, cost };
}

export function ascendClass(g: GameCtx, p: Player) {
  const idx = RARITY_ORDER.indexOf(p.classRarity);
  const next = RARITY_ORDER[idx + 1];
  if (!next || idx >= RARITY_ORDER.indexOf("legendary")) throw new GameError("Your class is already at its highest tier.");
  const cost = ASCENSION_COST[next];
  if (!cost) throw new GameError("Your class is already at its highest tier.");
  const levelReq = { uncommon: 10, rare: 25, epic: 45, legendary: 70 }[next as "uncommon" | "rare" | "epic" | "legendary"];
  requireLevel(p, levelReq, `Ascending to ${next}`);
  spendCoins(p, cost, `ascension to ${next}`);
  p.classRarity = next;
  return { rarity: next, cost };
}

export function unlockDualClass(g: GameCtx, p: Player) {
  requireLevel(p, DUAL_CLASS_LEVEL, "A dual class");
  if (p.state.dual) throw new GameError("You already have a dual class.");
  spendCoins(p, DUAL_CLASS_COST, "a dual class");
  const cls = rollClass(g, createRng(freshSeed()), { common: 40, uncommon: 30, rare: 18, epic: 9, legendary: 3 }, [p.classId]);
  p.state.dual = { classId: cls.id, level: 1, xp: 0 };
  return { cls, xpToNext: dualXpToNext(1) };
}

// ── Skills ────────────────────────────────────────────────────────────

export function listSkills(g: GameCtx, userId: number) {
  return g.db.all<{ skill_id: string; rank: number; slot: number | null }>("SELECT skill_id, rank, slot FROM skills WHERE user_id = ?", userId);
}

export function learnSkill(g: GameCtx, p: Player, skillId: string) {
  const s = SKILL_BY_ID[skillId];
  if (!s) throw notFound("Skill");
  requireLevel(p, s.levelReq, s.name);
  if (g.db.get("SELECT 1 FROM skills WHERE user_id = ? AND skill_id = ?", p.userId, skillId)) throw new GameError("You already know that skill.");
  spendCoins(p, s.price, s.name);
  g.db.run("INSERT INTO skills (user_id, skill_id, rank) VALUES (?, ?, 1)", p.userId, skillId);
  autoSlot(g, p, skillId);
  bump(g, p, "skillsLearned");
}

export function rankUpSkill(g: GameCtx, p: Player, skillId: string) {
  const s = SKILL_BY_ID[skillId];
  const row = g.db.get<{ rank: number }>("SELECT rank FROM skills WHERE user_id = ? AND skill_id = ?", p.userId, skillId);
  if (!s || !row) throw notFound("Skill");
  if (row.rank >= SKILL_MAX_RANK) throw new GameError(`${s.name} is already at max rank.`);
  spendCoins(p, skillUpgradeCost(s, row.rank), `${s.name} rank ${row.rank + 1}`);
  g.db.run("UPDATE skills SET rank = rank + 1 WHERE user_id = ? AND skill_id = ?", p.userId, skillId);
}

function autoSlot(g: GameCtx, p: Player, skillId: string) {
  const used = new Set(g.db.all<{ slot: number }>("SELECT slot FROM skills WHERE user_id = ? AND slot IS NOT NULL", p.userId).map((r) => r.slot));
  for (let i = 0; i < loadoutSlots(p.level); i++) {
    if (!used.has(i)) {
      g.db.run("UPDATE skills SET slot = ? WHERE user_id = ? AND skill_id = ?", i, p.userId, skillId);
      return;
    }
  }
}

export function setLoadout(g: GameCtx, p: Player, skillIds: string[]) {
  const slots = loadoutSlots(p.level);
  const unique = [...new Set(skillIds)];
  if (unique.length > slots) throw new GameError(`You can equip ${slots} skills.`);
  const owned = new Set(listSkills(g, p.userId).map((s) => s.skill_id));
  for (const id of unique) if (!owned.has(id)) throw new GameError("You don't know that skill.");
  if (g.db.get("SELECT 1 FROM battles WHERE user_id = ? AND status = 'active'", p.userId)) throw new GameError("Finish your current battle first.");
  g.db.run("UPDATE skills SET slot = NULL WHERE user_id = ?", p.userId);
  unique.forEach((id, i) => g.db.run("UPDATE skills SET slot = ? WHERE user_id = ? AND skill_id = ?", i, p.userId, id));
}

/** A skill book teaches an unknown skill you meet the level for, or ranks up a known one. */
export function readSkillBook(g: GameCtx, p: Player): { skill: string; rank: number; learned: boolean } {
  const known = new Map(listSkills(g, p.userId).map((s) => [s.skill_id, s.rank]));
  const rng = createRng(freshSeed());
  const learnable = Object.values(SKILL_BY_ID).filter((s) => !known.has(s.id) && s.levelReq <= p.level);
  if (learnable.length) {
    const s = rng.pick(learnable);
    g.db.run("INSERT INTO skills (user_id, skill_id, rank) VALUES (?, ?, 1)", p.userId, s.id);
    autoSlot(g, p, s.id);
    bump(g, p, "skillsLearned");
    return { skill: s.name, rank: 1, learned: true };
  }
  const upgradable = [...known.entries()].filter(([, r]) => r < SKILL_MAX_RANK);
  if (!upgradable.length) {
    p.coins += 2_500;
    return { skill: "", rank: 0, learned: false };
  }
  const [id] = rng.pick(upgradable);
  g.db.run("UPDATE skills SET rank = rank + 1 WHERE user_id = ? AND skill_id = ?", p.userId, id);
  return { skill: SKILL_BY_ID[id]!.name, rank: (known.get(id) ?? 1) + 1, learned: false };
}

export function welcomeBack(g: GameCtx, userId: number, days: number) {
  if (days < 7) return;
  sendMail(g, userId, { sender: "The Empire", subject: "🎁 Welcome back", body: "The realm missed you. Take these to get back on your feet.", attachments: { stacks: { health_potion: 5, xp_scroll: 2 } } });
}
