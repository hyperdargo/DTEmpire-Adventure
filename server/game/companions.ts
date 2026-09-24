import { CLASS_BY_ID } from "../../shared/data/classes.ts";
import { GEAR_BY_ID } from "../../shared/data/items.ts";
import type { Rarity } from "../../shared/data/types.ts";
import { rollGear } from "../../shared/rules/items.ts";
import { applyXp, MAX_LEVEL } from "../../shared/rules/progression.ts";
import { towerLevelReq } from "../../shared/data/regions.ts";
import { createRng, freshSeed } from "../../shared/rules/rng.ts";
import { computeHeroStats } from "../../shared/rules/stats.ts";
import type { GameCtx } from "./context.ts";
import { equippedItems, heroStats, loadPlayer, savePlayer } from "./player.ts";
import { buyAuction } from "./social.ts";
import { getOrCreateWar } from "./guildWar.ts";
import { simulateWorldBossStrike } from "./modes.ts";

export const GUILD1_BOTS = [
  "Aria_Dawnseeker",
  "Seraphina_Vane",
  "Theron_Shieldheart",
  "Brant_Oakhaven",
  "Lyra_Starweaver",
];

export const GUILD2_BOTS = [
  "Kaelen_Voidstrider",
  "Valen_Ironbark",
  "Zephyr_Shadowstep",
  "Morwenna_Frost",
  "Garrick_Flamehand",
];

export const COMPANION_GUILDS = {
  guild1Name: "DTEmpire",
  guild1Tag: "DTEMP",
  guild1Members: GUILD1_BOTS,
  guild2Name: "Shadow Legion",
  guild2Tag: "VOID",
  guild2Emblem: "🌑",
  guild2Desc: "The vanguard of shadows. Masters of the arena and tower.",
  guild2Members: GUILD2_BOTS,
};

export interface CompanionDef {
  name: string;
  classId: string;
  classRarity: Rarity;
  bio: string;
  avatar: string;
  starterWeapon: string;
  armor: string;
  helmet: string;
  boots: string;
  petSpecies?: string;
  personality: "tower" | "gladiator" | "explorer" | "balanced";
  shiftStartHour: number; // 12h awake, 12h sleep (staggered across 24h)
}

export const COMPANIONS: CompanionDef[] = [
  {
    name: "Aria_Dawnseeker",
    classId: "paladin",
    classRarity: "rare",
    bio: "A knight of the Suncrest Order. Purging shadows across every realm.",
    avatar: "🛡️",
    starterWeapon: "wooden_mallet",
    armor: "leather_armor",
    helmet: "leather_cap",
    boots: "worn_boots",
    petSpecies: "wolf_cub",
    personality: "tower",
    shiftStartHour: 0, // Active 00:00 - 12:00 UTC
  },
  {
    name: "Valen_Ironbark",
    classId: "berserker",
    classRarity: "epic",
    bio: "Heavy plate, heavier warhammer. Never backs down from an arena duel.",
    avatar: "🪓",
    starterWeapon: "wooden_mallet",
    armor: "leather_armor",
    helmet: "leather_cap",
    boots: "worn_boots",
    petSpecies: "dragon",
    personality: "gladiator",
    shiftStartHour: 2, // Active 02:00 - 14:00 UTC
  },
  {
    name: "Lyra_Starweaver",
    classId: "sorcerer",
    classRarity: "uncommon",
    bio: "Scholar of astral resonances. Wandering the realm for rare grimoires.",
    avatar: "✨",
    starterWeapon: "apprentice_staff",
    armor: "leather_armor",
    helmet: "leather_cap",
    boots: "worn_boots",
    petSpecies: "kitsune",
    personality: "balanced",
    shiftStartHour: 4, // Active 04:00 - 16:00 UTC
  },
  {
    name: "Garrick_Flamehand",
    classId: "mage",
    classRarity: "common",
    bio: "Wandering pyromancer and alchemist. Always brewing potions.",
    avatar: "🔥",
    starterWeapon: "apprentice_staff",
    armor: "leather_armor",
    helmet: "leather_cap",
    boots: "worn_boots",
    personality: "explorer",
    shiftStartHour: 6, // Active 06:00 - 18:00 UTC
  },
  {
    name: "Zephyr_Shadowstep",
    classId: "shadow_blade",
    classRarity: "epic",
    bio: "Swift as midnight wind. The arena ladder is the only true proving ground.",
    avatar: "🗡️",
    starterWeapon: "rusty_dagger",
    armor: "leather_armor",
    helmet: "leather_cap",
    boots: "worn_boots",
    petSpecies: "bat",
    personality: "gladiator",
    shiftStartHour: 8, // Active 08:00 - 20:00 UTC
  },
  {
    name: "Morwenna_Frost",
    classId: "warlock",
    classRarity: "rare",
    bio: "Frost sorceress of the northern glades. Quietly grinding day and night.",
    avatar: "❄️",
    starterWeapon: "apprentice_staff",
    armor: "leather_armor",
    helmet: "leather_cap",
    boots: "worn_boots",
    personality: "balanced",
    shiftStartHour: 10, // Active 10:00 - 22:00 UTC
  },
  {
    name: "Brant_Oakhaven",
    classId: "ranger",
    classRarity: "rare",
    bio: "Tracker from the green vales with a loyal familiar.",
    avatar: "🏹",
    starterWeapon: "hunting_bow",
    armor: "leather_armor",
    helmet: "leather_cap",
    boots: "worn_boots",
    personality: "explorer",
    shiftStartHour: 12, // Active 12:00 - 24:00 UTC
  },
  {
    name: "Seraphina_Vane",
    classId: "knight",
    classRarity: "uncommon",
    bio: "Imperial sentinel and templar. Always ready for a dungeon crawl.",
    avatar: "🕊️",
    starterWeapon: "iron_sword",
    armor: "leather_armor",
    helmet: "leather_cap",
    boots: "worn_boots",
    personality: "balanced",
    shiftStartHour: 14, // Active 14:00 - 02:00 UTC
  },
  {
    name: "Kaelen_Voidstrider",
    classId: "dragon_knight",
    classRarity: "legendary",
    bio: "Channeler of dragon flame. Scaling the Tower of Ascension floor by floor.",
    avatar: "🌑",
    starterWeapon: "iron_sword",
    armor: "leather_armor",
    helmet: "leather_cap",
    boots: "worn_boots",
    petSpecies: "dragon",
    personality: "tower",
    shiftStartHour: 16, // Active 16:00 - 04:00 UTC
  },
  {
    name: "Theron_Shieldheart",
    classId: "warrior",
    classRarity: "common",
    bio: "Steadfast recruit striving to earn glory in the Empire.",
    avatar: "🏰",
    starterWeapon: "iron_sword",
    armor: "leather_armor",
    helmet: "leather_cap",
    boots: "worn_boots",
    personality: "balanced",
    shiftStartHour: 18, // Active 18:00 - 06:00 UTC
  },
];

/**
 * Calculates whether a companion is in their 12-hour active working window
 * or their 12-hour resting/sleep window.
 */
export function isCompanionAwake(shiftStartHour: number, nowMs: number): boolean {
  const d = new Date(nowMs);
  const currentHour = d.getUTCHours() + d.getUTCMinutes() / 60;
  const endHour = (shiftStartHour + 12) % 24;

  if (shiftStartHour + 12 <= 24) {
    return currentHour >= shiftStartHour && currentHour < shiftStartHour + 12;
  }
  return currentHour >= shiftStartHour || currentHour < endHour;
}

let lastChatMessageTime = 0;
const CHAT_INTERVAL_MS = 10 * 60 * 1000; // max once every 10 mins

const AWAKE_CHATS = [
  "Back from resting! Time to grind some dungeons.",
  "Checked my gear, heading back to the Tower.",
  "Good morning realm! Starting another grind session.",
  "Just started my shift, looking for good loot today.",
  "Tower of Ascension, here I come!",
  "Upgrading my weapons at the Blacksmith today.",
  "The creatures in the Dark Forest won't stand a chance!",
  "Arena rating won't raise itself — let's duel!",
];

export async function ensureCompanions(g: GameCtx): Promise<number[]> {
  const ids: number[] = [];
  const now = g.clock.now();
  const rng = createRng(freshSeed());

  for (const def of COMPANIONS) {
    const row = g.db.get<{ id: number; level: number }>("SELECT u.id, p.level FROM users u JOIN players p ON p.user_id = u.id WHERE u.username = ?", def.name);
    let userId: number;

    if (!row) {
      userId = g.db.tx(() => {
        const uId = g.db.run(
          "INSERT INTO users (username, password_hash, is_guest, created_at) VALUES (?, 'bot_locked', 0, ?)",
          def.name,
          now
        ).lastId;

        const cls = CLASS_BY_ID[def.classId] ?? CLASS_BY_ID.warrior!;

        // Level 1 starter gear
        const gearTemplates = [def.starterWeapon, def.armor, def.helmet, def.boots];
        for (const tId of gearTemplates) {
          const t = GEAR_BY_ID[tId];
          if (!t) continue;
          const rolled = rollGear(rng, t, 1, "common");
          g.db.run(
            `INSERT INTO items (owner_id, template_id, rarity, ilvl, upgrade, qty, base, affixes, equipped, created_at)
             VALUES (?, ?, ?, ?, 0, 1, ?, ?, 1, ?)`,
            uId,
            tId,
            rolled.rarity,
            1,
            JSON.stringify(rolled.base),
            JSON.stringify(rolled.affixes),
            now
          );
        }

        // Starter skill
        g.db.run("INSERT INTO skills (user_id, skill_id, rank, slot) VALUES (?, 'power_strike', 1, 0)", uId);

        // Starter pet (Level 1)
        if (def.petSpecies) {
          g.db.run(
            `INSERT INTO pets (owner_id, species_id, rarity, level, xp, active, name, created_at)
             VALUES (?, ?, ?, 1, 0, 1, ?, ?)`,
            uId,
            def.petSpecies,
            "common",
            `${def.name.split("_")[0]}'s Familiar`,
            now
          );
        }

        const eq = equippedItems(g, uId);
        const stats = computeHeroStats({
          classId: cls.id,
          classRarity: def.classRarity,
          level: 1,
          equipped: eq,
        });

        g.db.run(
          `INSERT INTO players (user_id, name, class_id, class_rarity, level, xp, total_xp, coins, hp, hp_at, tower_floor, dungeon_best, arena_rating, power, bio, avatar, created_at, last_seen_at, state)
           VALUES (?, ?, ?, ?, 1, 0, 0, 150, ?, ?, 1, 0, 1000, ?, ?, ?, ?, ?, ?)`,
          uId,
          def.name,
          cls.id,
          def.classRarity,
          stats.maxHp,
          now,
          stats.power,
          def.bio,
          def.avatar,
          now,
          now,
          JSON.stringify({ isCompanion: true, shiftStartHour: def.shiftStartHour })
        );

        return uId;
      });
    } else {
      userId = row.id;

      // If companion was previously created at a high level, reset to Level 1
      if (row.level > 1 && row.level > 10) {
        g.db.tx(() => {
          const cls = CLASS_BY_ID[def.classId] ?? CLASS_BY_ID.warrior!;
          // Reset items to Level 1
          g.db.run("DELETE FROM items WHERE owner_id = ?", userId);
          const gearTemplates = [def.starterWeapon, def.armor, def.helmet, def.boots];
          for (const tId of gearTemplates) {
            const t = GEAR_BY_ID[tId];
            if (!t) continue;
            const rolled = rollGear(rng, t, 1, "common");
            g.db.run(
              `INSERT INTO items (owner_id, template_id, rarity, ilvl, upgrade, qty, base, affixes, equipped, created_at)
               VALUES (?, ?, ?, ?, 0, 1, ?, ?, 1, ?)`,
              userId,
              tId,
              rolled.rarity,
              1,
              JSON.stringify(rolled.base),
              JSON.stringify(rolled.affixes),
              now
            );
          }

          // Reset skills
          g.db.run("DELETE FROM skills WHERE user_id = ?", userId);
          g.db.run("INSERT INTO skills (user_id, skill_id, rank, slot) VALUES (?, 'power_strike', 1, 0)", userId);

          // Reset pets
          g.db.run("UPDATE pets SET level = 1, xp = 0 WHERE owner_id = ?", userId);

          const eq = equippedItems(g, userId);
          const stats = computeHeroStats({
            classId: cls.id,
            classRarity: def.classRarity,
            level: 1,
            equipped: eq,
          });

          g.db.run(
            `UPDATE players
             SET level = 1, xp = 0, total_xp = 0, coins = 150, hp = ?, tower_floor = 1, dungeon_best = 0, arena_rating = 1000, power = ?, state = ?
             WHERE user_id = ?`,
            stats.maxHp,
            stats.power,
            JSON.stringify({ isCompanion: true, shiftStartHour: def.shiftStartHour }),
            userId
          );
        });
      }
    }

    ids.push(userId);

    // Apply initial online state based on 12h schedule
    if (isCompanionAwake(def.shiftStartHour, now)) {
      g.hub.addVirtualOnline?.(userId);
    } else {
      g.hub.removeVirtualOnline?.(userId);
    }
  }

  // Ensure Guild 1 and Guild 2 exist and partition the 10 companion bots
  let g1 = g.db.get<{ id: number }>("SELECT id FROM guilds WHERE tag = 'DTEMP' OR id = 1");
  if (!g1) {
    const leaderUser = g.db.get<{ id: number }>("SELECT id FROM users WHERE username = 'DargoTamber'");
    const leaderId = leaderUser?.id ?? ids[0] ?? 1;
    const g1Id = g.db.run(
      `INSERT INTO guilds (name, tag, emblem, description, leader_id, level, xp, open, state, created_at)
       VALUES ('DTEmpire', 'DTEMP', '👑', 'The premier founding order of the realm.', ?, 5, 5000, 1, '{}', ?)`,
      leaderId,
      now
    ).lastId;
    g1 = { id: g1Id };
  }

  let g2 = g.db.get<{ id: number }>("SELECT id FROM guilds WHERE tag = 'VOID' OR name = 'Shadow Legion'");
  if (!g2) {
    const kaelenUser = g.db.get<{ id: number }>("SELECT id FROM users WHERE username = 'Kaelen_Voidstrider'");
    const kaelenId = kaelenUser?.id ?? ids[8] ?? 10;
    const g2Id = g.db.run(
      `INSERT INTO guilds (name, tag, emblem, description, leader_id, level, xp, open, state, created_at)
       VALUES ('Shadow Legion', 'VOID', '🌑', 'The vanguard of shadows. Masters of the arena and tower.', ?, 5, 2500, 1, '{}', ?)`,
      kaelenId,
      now
    ).lastId;
    g2 = { id: g2Id };
  }

  if (g1) {
    for (const bname of GUILD1_BOTS) {
      const u = g.db.get<{ id: number }>("SELECT id FROM users WHERE username = ?", bname);
      if (u) {
        g.db.run("UPDATE players SET guild_id = ? WHERE user_id = ?", g1.id, u.id);
        const role = bname === "Aria_Dawnseeker" ? "officer" : "member";
        g.db.run(
          "INSERT INTO guild_members (user_id, guild_id, role, joined_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET guild_id = excluded.guild_id, role = excluded.role",
          u.id,
          g1.id,
          role,
          now
        );
      }
    }
  }

  if (g2) {
    for (const bname of GUILD2_BOTS) {
      const u = g.db.get<{ id: number }>("SELECT id FROM users WHERE username = ?", bname);
      if (u) {
        g.db.run("UPDATE players SET guild_id = ? WHERE user_id = ?", g2.id, u.id);
        const role = bname === "Kaelen_Voidstrider" ? "leader" : bname === "Valen_Ironbark" ? "officer" : "member";
        g.db.run(
          "INSERT INTO guild_members (user_id, guild_id, role, joined_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET guild_id = excluded.guild_id, role = excluded.role",
          u.id,
          g2.id,
          role,
          now
        );
      }
    }
  }

  return ids;
}

export function tickCompanions(g: GameCtx) {
  const companionNames = COMPANIONS.map((c) => c.name);
  const placeholders = companionNames.map(() => "?").join(",");
  const rows = g.db.all<{ user_id: number; name: string }>(
    `SELECT user_id, name FROM players WHERE name IN (${placeholders})`,
    ...companionNames
  );

  if (rows.length === 0) return;

  const now = g.clock.now();
  const awakeRows: { user_id: number; name: string }[] = [];

  // 1. Update online presence based on 12-hour work / 12-hour sleep schedule
  for (const r of rows) {
    const def = COMPANIONS.find((c) => c.name === r.name);
    if (!def) continue;

    const awake = isCompanionAwake(def.shiftStartHour, now);
    if (awake) {
      g.hub.addVirtualOnline?.(r.user_id);
      awakeRows.push(r);
    } else {
      g.hub.removeVirtualOnline?.(r.user_id);
    }
  }

  // 2. Auto-accept pending friend requests from real players
  const allIds = rows.map((r) => r.user_id);
  const pending = g.db.all<{ user_id: number; friend_id: number }>(
    `SELECT user_id, friend_id FROM friends WHERE status = 'pending' AND friend_id IN (${allIds.join(",")})`
  );
  for (const req of pending) {
    g.db.run(
      "UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ?",
      req.user_id,
      req.friend_id
    );
  }

  // If no companions are awake (impossible with 2h stagger, but safe guard), stop here
  if (awakeRows.length === 0) return;

  // 3. Pick 1 or 2 awake companions to perform an action (1/4 real pace)
  const rng = createRng(freshSeed());
  const count = rng.chance(60) ? 2 : 1;
  const shuffled = [...awakeRows].sort(() => rng.next() - 0.5);
  const actors = shuffled.slice(0, Math.min(count, awakeRows.length));

  for (const actor of actors) {
    try {
      const p = loadPlayer(g, actor.user_id);
      const def = COMPANIONS.find((c) => c.name === actor.name);
      if (!def) continue;

      const roll = rng.int(1, 100);

      if (roll <= 50) {
        // ── Adventure Skirmish: natural level-up grind at 1/4 speed ──
        const xpGain = Math.max(12, Math.round(15 + p.level * 3.5 + rng.int(0, 10)));
        const coinGain = Math.max(80, Math.round(100 + p.level * 15 + rng.int(20, 80)));

        p.coins += coinGain;
        p.counters.kills = (p.counters.kills ?? 0) + 1;
        p.counters.battlesWon = (p.counters.battlesWon ?? 0) + 1;

        const next = applyXp(p.level, p.xp, xpGain);
        p.xp = next.xp;
        p.totalXp += xpGain;

        if (next.level > p.level && p.level < MAX_LEVEL) {
          p.level = next.level;
          const stats = heroStats(g, p);
          p.hp = stats.maxHp;
          p.power = stats.power;
          p.hpAt = now;

          // Milestone broadcasts
          if (p.level % 5 === 0) {
            g.hub.toChannel("world", {
              type: "feed",
              text: `${p.name} reached level ${p.level}!`,
              icon: "⭐",
              at: now,
            });
          }

          // Automatically upgrade gear to match power progression
          if (p.level % 4 === 0 && p.coins >= 300) {
            g.db.run(
              "UPDATE items SET ilvl = ?, upgrade = MIN(5, upgrade + 1) WHERE owner_id = ? AND equipped = 1",
              p.level,
              p.userId
            );
            p.coins -= 200;
          }
        }

        p.lastSeenAt = now;
        savePlayer(g, p);
      } else if (roll <= 80) {
        // ── Tower Climb: progress floor by floor ──
        const nextFloor = p.towerFloor + 1;
        if (nextFloor <= 100 && towerLevelReq(nextFloor) <= p.level) {
          // Success chance based on level comparison
          const winChance = p.level >= nextFloor ? 75 : 45;
          if (rng.chance(winChance)) {
            p.towerFloor = nextFloor;
            p.coins += nextFloor * 75;
            p.totalXp += nextFloor * 20;

            if (nextFloor % 5 === 0) {
              g.hub.toChannel("world", {
                type: "feed",
                icon: "🏰",
                text: `${p.name} cleared Tower of Ascension floor ${nextFloor}!`,
                at: now,
              });
            }
            p.lastSeenAt = now;
            savePlayer(g, p);
          }
        }
      } else {
        // ── Arena: duel activity ──
        const delta = rng.int(-8, 14);
        p.arenaRating = Math.max(900, Math.min(2400, p.arenaRating + delta));
        p.lastSeenAt = now;
        savePlayer(g, p);
      }

      // ── Auction House shopping: companion bots buy listings from human players ──
      if (p.coins >= 300 && rng.chance(40)) {
        try {
          const activeListings = g.db.all<{ id: number; price: number; seller_id: number }>(
            "SELECT id, price, seller_id FROM auctions WHERE status = 'active' AND seller_id != ? AND price <= ? AND expires_at > ? ORDER BY RANDOM() LIMIT 1",
            p.userId,
            p.coins,
            now
          );
          if (activeListings.length > 0) {
            const target = activeListings[0]!;
            buyAuction(g, p, target.id);
            savePlayer(g, p);
            g.hub.toChannel("world", {
              type: "feed",
              icon: "🏷️",
              text: `${p.name} bought an item from the Auction House for ${target.price.toLocaleString("en-US")} coins!`,
              at: now,
            });
          }
        } catch {
          // Ignore concurrent buy or expiry
        }
      }

      // ── Guild War: awake companions fight for their guild ──
      if (p.guildId && rng.chance(25)) {
        try {
          const war = getOrCreateWar(g);
          const rivalGuildId = p.guildId === war.guild_a_id ? war.guild_b_id : war.guild_a_id;
          const rivalDefenders = g.db.all<{ user_id: number; name: string }>(
            "SELECT user_id, name FROM players WHERE guild_id = ? AND user_id != ?",
            rivalGuildId,
            p.userId
          );
          if (rivalDefenders.length > 0) {
            const opp = rng.pick(rivalDefenders);
            const warPoints = 35 + rng.int(5, 25);
            if (p.guildId === war.guild_a_id) {
              g.db.run("UPDATE guild_wars SET score_a = score_a + ?, updated_at = ? WHERE week = ?", warPoints, now, war.week);
            } else {
              g.db.run("UPDATE guild_wars SET score_b = score_b + ?, updated_at = ? WHERE week = ?", warPoints, now, war.week);
            }
            const myGuild = g.db.get<{ tag: string }>("SELECT tag FROM guilds WHERE id = ?", p.guildId);
            const defGuild = g.db.get<{ tag: string }>("SELECT tag FROM guilds WHERE id = ?", rivalGuildId);
            g.hub.toChannel("world", {
              type: "feed",
              icon: "⚔️",
              text: `[${myGuild?.tag ?? "GUILD"}] ${p.name} won a Guild War skirmish against [${defGuild?.tag ?? "RIVAL"}] ${opp.name} (+${warPoints} pts)!`,
              at: now,
            });
          }
        } catch {
          // Ignore war error
        }
      }

      // ── World Boss: awake companions level 10+ attack the World Boss ──
      if (p.level >= 10 && rng.chance(25)) {
        try {
          simulateWorldBossStrike(g, p);
        } catch {
          // Ignore boss strike errors
        }
      }

      // 4. Occasional friendly world chat message (only while awake)
      if (now - lastChatMessageTime >= CHAT_INTERVAL_MS && rng.chance(20)) {
        const text = rng.pick(AWAKE_CHATS);
        lastChatMessageTime = now;
        const msgId = g.db.run(
          "INSERT INTO chat_messages (channel, user_id, body, created_at) VALUES ('world', ?, ?, ?)",
          p.userId,
          text,
          now
        ).lastId;
        g.hub.toChannel("world", {
          type: "chat",
          message: {
            id: msgId,
            channel: "world",
            userId: p.userId,
            body: text,
            createdAt: now,
            author: {
              name: p.name,
              level: p.level,
              classIcon: CLASS_BY_ID[p.classId]?.icon ?? "⚔️",
              title: p.title,
            },
          },
        });
      }
    } catch {
      // Ignore individual companion simulation errors so server sweep never fails
    }
  }
}
