import { CLASS_BY_ID, rankTitle } from "../../shared/data/classes.ts";
import { ACHIEVEMENTS, PARAGON_STAT_PCT, type Counter, type MissionType } from "../../shared/data/meta.ts";
import type { Rarity } from "../../shared/data/types.ts";
import type { ItemRecord } from "../../shared/rules/items.ts";
import type { LootDrop } from "../../shared/rules/loot.ts";
import { MAX_LEVEL, applyXp, regenHp, xpToNext } from "../../shared/rules/progression.ts";
import { type Buffs, type HeroStats, type PetRecord, computeHeroStats, heroPower } from "../../shared/rules/stats.ts";
import { computeEstateStats, type PlayerEstateState } from "../../shared/data/estate.ts";
import { json } from "../db/db.ts";
import { GameError, notFound } from "../lib/errors.ts";
import { dayKey } from "../lib/time.ts";
import type { GameCtx, Notice } from "./context.ts";

export interface ActiveBuff { id: string; until: number; buff: Buffs }

export interface PlayerState {
  buffs?: ActiveBuff[];
  daily?: { lastDay: string; lastAt: number; streak: number; best: number };
  contracts?: { day: string; tasks: { key: string; need: number; base: number; coins: number; xp: number }[]; claimed: number[] };
  missions?: { day: string; list: { type: MissionType; name: string; desc: string; goal: number; progress: number; coins: number; xp: number; claimed: boolean }[]; bonusClaimed: boolean };
  job?: { id: string; shiftStartedAt: number | null };
  lucky?: { day: string; spins: number };
  offerings?: { day: string; count: number };
  expedition?: { regionId: string; durationId: string; startedAt: number; endsAt: number } | null;
  bestiary?: Record<string, number>;
  mastery?: Record<string, number>;
  regionKills?: Record<string, number>;
  achievements?: string[];
  titles?: string[];
  dual?: { classId: string; level: number; xp: number } | null;
  settings?: {
    autoSalvageCommon?: boolean;
    quickBattleDefault?: boolean;
    autoResolveAdventure?: boolean;
    autoResolvePotions?: boolean;
  };
  autoResolveAdventure?: boolean;
  autoResolvePotions?: boolean;
  worldBoss?: { day: string; attempts: number };
  arena?: { day: string; ranked: number };
  milestoneEggs?: number;
  estate?: PlayerEstateState;
  onboarded?: boolean;
  guildWar?: { day: string; attacks: number; defeated: number[] };
  paragon?: number;
}

export interface Player {
  userId: number;
  name: string;
  classId: string;
  classRarity: Rarity;
  level: number;
  xp: number;
  totalXp: number;
  coins: number;
  hp: number;
  hpAt: number;
  towerFloor: number;
  dungeonBest: number;
  abyssBest: number;
  arenaRating: number;
  power: number;
  guildId: number | null;
  title: string | null;
  avatar: string | null;
  bio: string | null;
  counters: Partial<Record<Counter, number>>;
  state: PlayerState;
  createdAt: number;
  lastSeenAt: number;
  /** Collected during a request and returned to the client. */
  notices: Notice[];
}

interface PlayerRow {
  user_id: number; name: string; class_id: string; class_rarity: string; level: number; xp: number; total_xp: number;
  coins: number; hp: number; hp_at: number; tower_floor: number; dungeon_best: number; abyss_best?: number; arena_rating: number; power: number;
  guild_id: number | null; title: string | null; avatar: string | null; bio: string | null; counters: string; state: string;
  created_at: number; last_seen_at: number;
}

const fromRow = (r: PlayerRow): Player => ({
  userId: r.user_id, name: r.name, classId: r.class_id, classRarity: r.class_rarity as Rarity, level: r.level, xp: r.xp,
  totalXp: r.total_xp, coins: r.coins, hp: r.hp, hpAt: r.hp_at, towerFloor: r.tower_floor, dungeonBest: r.dungeon_best,
  abyssBest: r.abyss_best ?? 0,
  arenaRating: r.arena_rating, power: r.power, guildId: r.guild_id, title: r.title, avatar: r.avatar, bio: r.bio,
  counters: json(r.counters, {}), state: json(r.state, {}), createdAt: r.created_at, lastSeenAt: r.last_seen_at, notices: [],
});

export function findPlayer(g: GameCtx, userId: number): Player | null {
  const row = g.db.get<PlayerRow>("SELECT * FROM players WHERE user_id = ?", userId);
  return row ? fromRow(row) : null;
}

export function loadPlayer(g: GameCtx, userId: number): Player {
  const p = findPlayer(g, userId);
  if (!p) throw new GameError("Create your hero first.", { status: 409, code: "no_hero" });
  return p;
}

export function savePlayer(g: GameCtx, p: Player) {
  g.db.run(
    `UPDATE players SET name=?, class_id=?, class_rarity=?, level=?, xp=?, total_xp=?, coins=?, hp=?, hp_at=?, tower_floor=?,
     dungeon_best=?, abyss_best=?, arena_rating=?, power=?, guild_id=?, title=?, avatar=?, bio=?, counters=?, state=?, last_seen_at=? WHERE user_id=?`,
    p.name, p.classId, p.classRarity, p.level, p.xp, p.totalXp, Math.max(0, Math.floor(p.coins)), p.hp, p.hpAt, p.towerFloor,
    p.dungeonBest, p.abyssBest, p.arenaRating, p.power, p.guildId, p.title, p.avatar, p.bio, JSON.stringify(p.counters), JSON.stringify(p.state),
    p.lastSeenAt, p.userId,
  );
}

/** Load → mutate → save inside one transaction. Notices collected on the player are returned. */
export function withPlayer<T>(g: GameCtx, userId: number, fn: (p: Player) => T): { result: T; player: Player } {
  return g.db.tx(() => {
    const p = loadPlayer(g, userId);
    const result = fn(p);
    refreshPower(g, p);
    savePlayer(g, p);
    return { result, player: p };
  });
}

// ── Stats ──────────────────────────────────────────────────────────────

export function activeBuffs(p: Player, now: number): ActiveBuff[] {
  return (p.state.buffs ?? []).filter((b) => b.until > now);
}

export function applyBuff(p: Player, id: string, durationSeconds: number, buff: Buffs, now = Date.now()) {
  const active = activeBuffs(p, now).filter((b) => b.id !== id);
  p.state.buffs = [...active, { id, until: now + durationSeconds * 1000, buff }];
}

export function combinedBuffs(p: Player, now: number): Buffs {
  const out: Buffs = {};
  for (const b of activeBuffs(p, now)) {
    out.atkPct = (out.atkPct ?? 0) + (b.buff.atkPct ?? 0);
    out.defPct = (out.defPct ?? 0) + (b.buff.defPct ?? 0);
    out.coinPct = (out.coinPct ?? 0) + (b.buff.coinPct ?? 0);
    out.xpPct = (out.xpPct ?? 0) + (b.buff.xpPct ?? 0);
  }
  const estate = computeEstateStats(p.state.estate);
  out.atkPct = (out.atkPct ?? 0) + estate.atkPct;
  out.defPct = (out.defPct ?? 0) + estate.defPct;
  out.coinPct = (out.coinPct ?? 0) + estate.coinPct;
  out.xpPct = (out.xpPct ?? 0) + estate.xpPct;
  return out;
}

interface ItemRow { id: number; template_id: string; rarity: string; ilvl: number; upgrade: number; qty: number; base: string; affixes: string; equipped: number; locked: number }

export const itemFromRow = (r: ItemRow): ItemRecord => ({
  id: r.id, templateId: r.template_id, rarity: r.rarity as Rarity, ilvl: r.ilvl, upgrade: r.upgrade, qty: r.qty,
  base: json(r.base, {}), affixes: json(r.affixes, []), equipped: !!r.equipped, locked: !!r.locked,
});

export function equippedItems(g: GameCtx, userId: number): ItemRecord[] {
  return g.db.all<ItemRow>("SELECT * FROM items WHERE owner_id = ? AND equipped = 1", userId).map(itemFromRow);
}

export function activePet(g: GameCtx, userId: number): PetRecord | null {
  const r = g.db.get<{ id: number; species_id: string; rarity: string; level: number; xp: number; active: number; name: string | null }>(
    "SELECT * FROM pets WHERE owner_id = ? AND active = 1", userId);
  return r ? { id: r.id, speciesId: r.species_id, rarity: r.rarity as Rarity, level: r.level, xp: r.xp, active: true, name: r.name } : null;
}

export function guildPerk(g: GameCtx, p: Player): number {
  if (!p.guildId) return 0;
  const guild = g.db.get<{ level: number }>("SELECT level FROM guilds WHERE id = ?", p.guildId);
  return guild ? Math.min(10, guild.level) : 0;
}

export function heroStats(g: GameCtx, p: Player): HeroStats {
  const now = g.clock.now();
  const stats = computeHeroStats({
    classId: p.classId,
    classRarity: p.classRarity,
    level: p.level,
    dual: p.state.dual ? { classId: p.state.dual.classId, level: p.state.dual.level } : null,
    equipped: equippedItems(g, p.userId),
    pet: activePet(g, p.userId),
    buffs: combinedBuffs(p, now),
    guildPerkPct: guildPerk(g, p),
  });
  const estate = computeEstateStats(p.state.estate);
  if (estate.hpPct) stats.maxHp = Math.round(stats.maxHp * (1 + estate.hpPct / 100));
  if (estate.flatHp) stats.maxHp += estate.flatHp;
  if (estate.flatAtk) stats.atk += estate.flatAtk;
  if (estate.flatDef) stats.def += estate.flatDef;
  if (estate.crit) stats.crit = Math.min(75, stats.crit + estate.crit);
  if (estate.luck) stats.luck += estate.luck;
  if (estate.bossDamage) stats.bossDamage += estate.bossDamage;
  if (estate.skillPower) stats.skillPower += estate.skillPower;
  if (estate.petPowerPct) stats.petPowerPct += estate.petPowerPct;
  if (estate.regenPct) stats.regenPct += estate.regenPct;
  const paragon = Number(p.state.paragon ?? 0);
  if (paragon > 0) {
    const mult = 1 + (paragon * PARAGON_STAT_PCT) / 100;
    stats.atk = Math.round(stats.atk * mult);
    stats.def = Math.round(stats.def * mult);
    stats.maxHp = Math.round(stats.maxHp * mult);
  }
  stats.power = heroPower(stats);
  return stats;
}

export function refreshPower(g: GameCtx, p: Player) {
  p.power = heroStats(g, p).power;
}

/** Current HP including out-of-combat regeneration. Writes it back so timers stay consistent. */
export function settleHp(g: GameCtx, p: Player, maxHp: number): number {
  const now = g.clock.now();
  if (g.db.get("SELECT 1 FROM battles WHERE user_id = ? AND status = 'active'", p.userId)) return Math.min(p.hp, maxHp);
  // No regeneration inside the Dungeon: HP is part of the run's risk.
  if ((p.state as { dungeon?: unknown }).dungeon) {
    p.hpAt = now;
    return Math.min(p.hp, maxHp);
  }
  p.hp = regenHp(Math.min(p.hp, maxHp), maxHp, p.hpAt, now);
  p.hpAt = now;
  return p.hp;
}

// ── Rewards ────────────────────────────────────────────────────────────

export function bump(g: GameCtx, p: Player, counter: Counter, amount = 1) {
  p.counters[counter] = (p.counters[counter] ?? 0) + amount;
  checkAchievements(g, p);
}

export function setMax(g: GameCtx, p: Player, counter: Counter, value: number) {
  if ((p.counters[counter] ?? 0) < value) {
    p.counters[counter] = value;
    checkAchievements(g, p);
  }
}

export function checkAchievements(g: GameCtx, p: Player) {
  const done = new Set(p.state.achievements ?? []);
  for (const a of ACHIEVEMENTS) {
    if (done.has(a.id)) continue;
    if ((p.counters[a.counter] ?? 0) < a.goal) continue;
    done.add(a.id);
    p.coins += a.coins;
    if (a.title) p.state.titles = [...new Set([...(p.state.titles ?? []), a.title])];
    p.notices.push({ kind: "achievement", id: a.id, name: a.name, icon: a.icon, coins: a.coins, ...(a.title ? { title: a.title } : {}) });
    sendMail(g, p.userId, {
      sender: "Hall of Deeds",
      subject: `${a.icon} Achievement: ${a.name}`,
      body: `${a.desc}\n\n+${a.coins.toLocaleString("en-US")} coins have been added to your purse.${a.title ? `\nNew title unlocked: “${a.title}”.` : ""}`,
    });
  }
  p.state.achievements = [...done];
}

export function bumpMission(p: Player, type: MissionType, amount = 1) {
  const m = p.state.missions;
  if (!m) return;
  for (const mission of m.list) {
    if (mission.type === type && !mission.claimed) mission.progress = Math.min(mission.goal, mission.progress + amount);
  }
}

/** Grants XP with buffs applied, handling level-ups, full heals, and milestone eggs. */
export function grantXp(g: GameCtx, p: Player, amount: number, opts: { applyBonus?: boolean } = {}): number {
  if (p.level >= MAX_LEVEL) return 0;
  let gain = Math.max(0, Math.floor(amount));
  if (opts.applyBonus) {
    const stats = heroStats(g, p);
    gain = Math.floor(gain * (1 + stats.xpBonus / 100));
  }
  const before = p.level;
  const r = applyXp(p.level, p.xp, gain);
  p.level = r.level;
  p.xp = r.xp;
  p.totalXp += gain;
  if (r.gained > 0) {
    for (let lv = before + 1; lv <= p.level; lv++) {
      p.notices.push({ kind: "levelUp", level: lv });
      if (lv % 5 === 0) {
        addStack(g, p.userId, "mystery_egg", 1);
        p.notices.push({ kind: "egg", name: "Mystery Egg" });
      }
    }
    const stats = heroStats(g, p);
    p.hp = stats.maxHp;
    p.hpAt = g.clock.now();
    setMax(g, p, "level", p.level);
    g.hub.toChannel("world", { type: "feed", text: `${p.name} reached level ${p.level}.`, icon: "⭐", at: g.clock.now() });
  }
  return gain;
}

/** Grants a percentage of the current level's XP requirement. */
export const xpPctOfLevel = (p: Player, pct: number) => Math.round(xpToNext(Math.min(p.level, MAX_LEVEL - 1)) * pct);

export function grantCoins(g: GameCtx, p: Player, amount: number, opts: { fromBattle?: boolean } = {}): number {
  let gain = Math.max(0, Math.floor(amount));
  if (opts.fromBattle) {
    const coinPct = combinedBuffs(p, g.clock.now()).coinPct ?? 0;
    gain = Math.floor(gain * (1 + coinPct / 100));
    bumpMission(p, "coins", gain);
  }
  p.coins += gain;
  return gain;
}

export function spendCoins(p: Player, amount: number, what = "that") {
  const cost = Math.max(0, Math.floor(amount));
  if (p.coins < cost) {
    throw new GameError(`You need ${cost.toLocaleString("en-US")} coins for ${what} (you have ${p.coins.toLocaleString("en-US")}).`, { code: "insufficient_coins" });
  }
  p.coins -= cost;
}

// ── Inventory primitives (used by rewards; full inventory logic lives in inventory.ts) ──

export function addStack(g: GameCtx, userId: number, templateId: string, qty: number) {
  if (qty <= 0) return;
  const existing = g.db.get<{ id: number }>("SELECT id FROM items WHERE owner_id = ? AND template_id = ? AND base = '{}' AND escrow IS NULL", userId, templateId);
  if (existing) g.db.run("UPDATE items SET qty = qty + ? WHERE id = ?", qty, existing.id);
  else g.db.run("INSERT INTO items (owner_id, template_id, rarity, ilvl, qty, created_at) VALUES (?, ?, 'common', 1, ?, ?)", userId, templateId, qty, g.clock.now());
}

export function addGear(g: GameCtx, userId: number, drop: Extract<LootDrop, { kind: "gear" }>): number {
  return g.db.run(
    "INSERT INTO items (owner_id, template_id, rarity, ilvl, upgrade, qty, base, affixes, created_at) VALUES (?, ?, ?, ?, 0, 1, ?, ?, ?)",
    userId, drop.templateId, drop.rarity, drop.ilvl, JSON.stringify(drop.base), JSON.stringify(drop.affixes), g.clock.now(),
  ).lastId;
}

export function countStack(g: GameCtx, userId: number, templateId: string): number {
  return g.db.get<{ qty: number }>("SELECT qty FROM items WHERE owner_id = ? AND template_id = ? AND base = '{}' AND escrow IS NULL", userId, templateId)?.qty ?? 0;
}

export function takeStack(g: GameCtx, userId: number, templateId: string, qty: number, label?: string) {
  const row = g.db.get<{ id: number; qty: number }>("SELECT id, qty FROM items WHERE owner_id = ? AND template_id = ? AND base = '{}' AND escrow IS NULL", userId, templateId);
  if (!row || row.qty < qty) throw new GameError(`You need ${qty}× ${label ?? templateId} (you have ${row?.qty ?? 0}).`, { code: "insufficient_items" });
  if (row.qty === qty) g.db.run("DELETE FROM items WHERE id = ?", row.id);
  else g.db.run("UPDATE items SET qty = qty - ? WHERE id = ?", qty, row.id);
}

// ── Mail ───────────────────────────────────────────────────────────────

export interface MailAttachments { coins?: number; stacks?: Record<string, number>; itemIds?: number[] }

export function sendMail(g: GameCtx, userId: number, mail: { sender: string; subject: string; body: string; attachments?: MailAttachments; expiresInDays?: number }) {
  const now = g.clock.now();
  const id = g.db.run(
    "INSERT INTO mail (user_id, sender, subject, body, attachments, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    userId, mail.sender, mail.subject, mail.body, JSON.stringify(mail.attachments ?? {}), now,
    mail.expiresInDays ? now + mail.expiresInDays * 86_400_000 : null,
  ).lastId;
  g.hub.toUser(userId, { type: "mail", id, subject: mail.subject });
  return id;
}

// ── Views ──────────────────────────────────────────────────────────────

export function playerTitle(p: Player): string {
  const cls = CLASS_BY_ID[p.classId];
  return p.title ?? (cls ? rankTitle(cls.archetype, p.level).title : "Adventurer");
}

export function requireLevel(p: Player, level: number, what: string) {
  if (p.level < level) throw new GameError(`${what} unlocks at level ${level}.`, { code: "level_locked", details: { level } });
}

export function today(g: GameCtx) {
  return dayKey(g.clock.now());
}

export function mustFindUserByName(g: GameCtx, name: string): { id: number; name: string } {
  const row = g.db.get<{ user_id: number; name: string }>("SELECT user_id, name FROM players WHERE name = ? COLLATE NOCASE", name.trim());
  if (!row) throw notFound(`Player “${name}”`);
  return { id: row.user_id, name: row.name };
}
