// One-time import of the original Flask game's players.json into the new database.
// Progress is carried over where it maps cleanly onto the new game; everything is re-balanced to the new curve.

import { CLASSES, CLASS_BY_ID } from "../shared/data/classes.ts";
import { CONSUMABLES, GEAR } from "../shared/data/items.ts";
import { PET_SPECIES } from "../shared/data/pets.ts";
import { SKILL_BY_NAME, SKILL_MAX_RANK } from "../shared/data/skills.ts";
import type { EquipSlot, Rarity } from "../shared/data/types.ts";
import { pickGearTemplate, rollGear } from "../shared/rules/items.ts";
import { MAX_LEVEL, RARITY_INDEX } from "../shared/rules/progression.ts";
import { createRng } from "../shared/rules/rng.ts";
import { computeHeroStats } from "../shared/rules/stats.ts";
import type { Db } from "./db/db.ts";

type Legacy = Record<string, unknown>;

export interface ImportOptions {
  dryRun?: boolean;
  /** Multiplier applied to legacy coin balances (the old economy inflated heavily). */
  coinRate?: number;
  coinCap?: number;
  now?: number;
}

export interface ImportReport {
  players: number;
  imported: number;
  skipped: { key: string; reason: string }[];
  items: number;
  pets: number;
  renamed: { from: string; to: string }[];
}

const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "unique"];
const stripEmoji = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, "").trim();
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const rarityOf = (v: unknown): Rarity => {
  const r = str(v).toLowerCase().replace("mythical", "mythic");
  return (RARITIES as string[]).includes(r) ? (r as Rarity) : "common";
};

const gearByName = new Map(GEAR.map((g) => [g.name.toLowerCase(), g]));
const consumableByName = new Map(CONSUMABLES.map((c) => [c.name.toLowerCase(), c]));
const LEGACY_SLOT: Record<string, EquipSlot> = { weapon: "weapon", armor: "armor", helmet: "helmet", head: "helmet", boots: "boots", shield: "armor", accessory: "accessory" };

function consumableFor(name: string, type: string): string | null {
  const n = stripEmoji(name).toLowerCase();
  const direct = consumableByName.get(n);
  if (direct) return direct.id;
  if (type === "egg" || type === "pet_egg" || n.includes("egg")) return n.includes("golden") ? "golden_egg" : "mystery_egg";
  if (type === "potion" || n.includes("potion")) return "health_potion";
  if (n.includes("skill book")) return "skill_book";
  if (n.includes("xp scroll")) return "xp_scroll";
  return null;
}

function uniqueUsername(db: Db, wanted: string): string {
  let base = wanted.replace(/[^A-Za-z0-9_]/g, "").slice(0, 16);
  if (base.length < 3 || /^guest_/i.test(base)) base = `hero_${base}`.slice(0, 16);
  let name = base;
  for (let i = 2; db.get("SELECT 1 FROM users WHERE username = ?", name); i++) name = `${base.slice(0, 16)}${i}`;
  return name;
}

export function importLegacyPlayers(db: Db, data: Record<string, Legacy>, opts: ImportOptions = {}): ImportReport {
  const now = opts.now ?? Date.now();
  const report: ImportReport = { players: Object.keys(data).length, imported: 0, skipped: [], items: 0, pets: 0, renamed: [] };
  const coinRate = opts.coinRate ?? 1;
  const coinCap = opts.coinCap ?? 5_000_000;

  const run = () => {
    for (const [key, p] of Object.entries(data)) {
      if (!p || typeof p !== "object") {
        report.skipped.push({ key, reason: "not an object" });
        continue;
      }
      if (db.get("SELECT 1 FROM users WHERE legacy_id = ?", key)) {
        report.skipped.push({ key, reason: "already imported" });
        continue;
      }
      const wanted = str(p.username) || str(p.name) || `hero_${key.slice(-6)}`;
      const username = uniqueUsername(db, wanted);
      if (username !== wanted) report.renamed.push({ from: wanted, to: username });
      const email = str(p.email).trim().toLowerCase() || null;
      const emailFree = email && !db.get("SELECT 1 FROM users WHERE email = ?", email) ? email : null;
      const discordId = str(p.discord_id) || null;
      const discordFree = discordId && !db.get("SELECT 1 FROM users WHERE discord_id = ?", discordId) ? discordId : null;
      const created = num(p.created, now / 1000) * 1000;
      const userId = db.run(
        "INSERT INTO users (username, password_hash, email, discord_id, legacy_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        username, str(p.password_hash) || null, emailFree, discordFree, key, Math.min(now, created),
      ).lastId;

      const classId = CLASSES.find((c) => c.name.toLowerCase() === str(p.class_name).toLowerCase())?.id ?? "warrior";
      const cls = CLASS_BY_ID[classId]!;
      const classRarity = RARITY_INDEX[rarityOf(p.class_rarity)] > RARITY_INDEX[cls.rarity] ? rarityOf(p.class_rarity) : cls.rarity;
      const level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(num(p.level, 1))));
      const coins = Math.max(0, Math.min(coinCap, Math.floor(num(p.coins) * coinRate)));
      const counters = {
        kills: num(p.monsters_killed), bossKills: num(p.bosses_killed), battlesWon: num(p.total_wins, num(p.monsters_killed)),
        deaths: num(p.deaths), duelsWon: num(p.duel_wins) + num(p.ai_duel_wins), level,
      };
      const towerFloor = Math.max(0, Math.min(100, Math.floor(num(p.highest_floor, num(p.tower_floor, 1) - 1))));
      const dungeonBest = Math.max(0, Math.min(100, Math.floor(num(p.highest_dungeon))));
      db.run(
        `INSERT INTO players (user_id, name, class_id, class_rarity, level, xp, coins, hp, hp_at, tower_floor, dungeon_best, counters, state, created_at, last_seen_at, bio)
         VALUES (?, ?, ?, ?, ?, 0, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
        userId, username, classId, classRarity, level, coins, now, towerFloor, dungeonBest, JSON.stringify(counters),
        JSON.stringify({ settings: { autoSalvageCommon: false }, bestiary: {}, achievements: [] }), Math.min(now, created), now, null,
      );

      // Items
      const rng = createRng(`legacy:${key}`);
      const stacks = new Map<string, number>();
      const equippedSlots = new Set<EquipSlot>();
      const addGear = (raw: Legacy, equip: boolean) => {
        const name = stripEmoji(str(raw.name));
        const type = str(raw.type || raw.category).toLowerCase();
        const slot = LEGACY_SLOT[type] ?? (gearByName.get(name.toLowerCase())?.slot);
        if (!slot) return false;
        const rarity = rarityOf(raw.rarity);
        const template = gearByName.get(name.toLowerCase()) ?? pickGearTemplate(rng, level, slot);
        const ilvl = Math.max(template.levelReq, Math.min(level, 100));
        const rolled = rollGear(rng, template, ilvl, rarity === "unique" ? "mythic" : rarity);
        const doEquip = equip && !equippedSlots.has(template.slot) && template.levelReq <= level;
        if (doEquip) equippedSlots.add(template.slot);
        db.run("INSERT INTO items (owner_id, template_id, rarity, ilvl, qty, base, affixes, equipped, created_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)",
          userId, template.id, rolled.rarity, rolled.ilvl, JSON.stringify(rolled.base), JSON.stringify(rolled.affixes), doEquip ? 1 : 0, now);
        report.items++;
        return true;
      };
      for (const slotKey of ["equipped_weapon", "equipped_armor", "equipped_helmet", "equipped_shield", "equipped_boots"]) {
        const eq = p[slotKey];
        if (eq && typeof eq === "object") addGear(eq as Legacy, true);
      }
      for (const raw of Array.isArray(p.inventory) ? p.inventory : []) {
        if (typeof raw === "string") {
          const id = consumableFor(raw, "");
          if (id) stacks.set(id, (stacks.get(id) ?? 0) + 1);
          continue;
        }
        if (!raw || typeof raw !== "object") continue;
        const it = raw as Legacy;
        const type = str(it.type || it.category).toLowerCase();
        if (LEGACY_SLOT[type] && addGear(it, false)) continue;
        const id = consumableFor(str(it.name), type);
        if (id) stacks.set(id, (stacks.get(id) ?? 0) + Math.max(1, Math.floor(num(it.qty, 1))));
      }
      for (const [templateId, qty] of stacks) {
        db.run("INSERT INTO items (owner_id, template_id, rarity, ilvl, qty, created_at) VALUES (?, ?, 'common', 1, ?, ?)", userId, templateId, Math.min(qty, 9999), now);
        report.items++;
      }

      // Pets: legacy pets were tier names ("rare") or dicts with a name and rarity.
      let active = false;
      for (const raw of Array.isArray(p.pets) ? p.pets : []) {
        const rarity = typeof raw === "string" ? rarityOf(raw) : rarityOf((raw as Legacy)?.rarity);
        const name = typeof raw === "string" ? "" : stripEmoji(str((raw as Legacy)?.name)).toLowerCase();
        const species = PET_SPECIES.find((s) => s.name.toLowerCase() === name) ?? PET_SPECIES.find((s) => s.rarity === (rarity === "unique" ? "mythic" : rarity)) ?? PET_SPECIES[0]!;
        const petLevel = Math.max(1, Math.floor(num(typeof raw === "object" ? (raw as Legacy)?.level : 1, 1)));
        db.run("INSERT INTO pets (owner_id, species_id, rarity, level, active, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          userId, species.id, species.rarity, Math.min(petLevel, 70), active ? 0 : 1, now);
        active = true;
        report.pets++;
      }

      // Skills: names carry over; ranks from the old "level" field.
      const skills = p.skills && typeof p.skills === "object" ? Object.entries(p.skills as Record<string, Legacy>) : [];
      let slot = 0;
      for (const [skillName, s] of skills) {
        const def = SKILL_BY_NAME[skillName];
        if (!def) continue;
        const rank = Math.max(1, Math.min(SKILL_MAX_RANK, Math.floor(num(s?.level, 1))));
        db.run("INSERT OR IGNORE INTO skills (user_id, skill_id, rank, slot) VALUES (?, ?, ?, ?)", userId, def.id, rank, slot < 3 ? slot : null);
        slot++;
      }
      if (!skills.some(([n]) => SKILL_BY_NAME[n])) db.run("INSERT INTO skills (user_id, skill_id, rank, slot) VALUES (?, 'power_strike', 1, 0)", userId);

      // Start at full health with the imported gear on.
      const equipped = db.all<{ template_id: string; base: string; affixes: string; upgrade: number }>("SELECT template_id, base, affixes, upgrade FROM items WHERE owner_id = ? AND equipped = 1", userId)
        .map((r) => ({ templateId: r.template_id, base: JSON.parse(r.base), affixes: JSON.parse(r.affixes), upgrade: r.upgrade }));
      const stats = computeHeroStats({ classId, classRarity, level, equipped });
      db.run("UPDATE players SET hp = ?, power = ? WHERE user_id = ?", stats.maxHp, stats.power, userId);

      db.run("INSERT INTO mail (user_id, sender, subject, body, attachments, created_at) VALUES (?, 'The Empire', ?, ?, '{}', ?)", userId,
        "🏰 Your hero crossed into the new realm",
        `Welcome back, ${username}. Your level, class, coins, gear, pets and skills were carried over from the old realm and re-forged for the new one. Sign in with your old username${username !== wanted ? ` (now “${username}”)` : ""} and password.`,
        now);
      report.imported++;
    }
  };

  if (opts.dryRun) {
    db.raw.exec("BEGIN");
    try {
      run();
    } finally {
      db.raw.exec("ROLLBACK");
    }
  } else {
    db.tx(run);
  }
  return report;
}
