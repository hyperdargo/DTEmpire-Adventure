// Meta-progression content: achievements, daily systems, jobs, temple, arena, world boss.

export type Counter =
  | "kills" | "bossKills" | "eliteKills" | "deaths" | "battlesWon" | "towerFloor" | "dungeonBest" | "level"
  | "coinsEarned" | "itemsCrafted" | "itemsForged" | "itemsUpgraded" | "petsHatched" | "skillsLearned"
  | "duelsWon" | "arenaWins" | "tradesCompleted" | "auctionsSold" | "dailyStreak" | "expeditions"
  | "contractsDone" | "missionsDone" | "worldBossHits" | "bestiaryDiscovered" | "potionsDrunk" | "luckyJackpots";

export interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  counter: Counter;
  goal: number;
  coins: number;
  title?: string;
}

const a = (id: string, name: string, icon: string, desc: string, counter: Counter, goal: number, coins: number, title?: string): AchievementDef =>
  ({ id, name, icon, desc, counter, goal, coins, ...(title ? { title } : {}) });

export const ACHIEVEMENTS: AchievementDef[] = [
  a("first_blood", "First Blood", "🩸", "Win your first battle.", "battlesWon", 1, 50),
  a("wins_100", "War Machine", "⚔️", "Win 100 battles.", "battlesWon", 100, 2_000),
  a("wins_1000", "Unstoppable", "🔥", "Win 1,000 battles.", "battlesWon", 1_000, 25_000, "the Unstoppable"),
  a("kills_500", "Monster Slayer", "💀", "Defeat 500 monsters.", "kills", 500, 5_000),
  a("boss_1", "Giant Killer", "👑", "Defeat a boss.", "bossKills", 1, 300),
  a("boss_25", "Boss Breaker", "🐉", "Defeat 25 bosses.", "bossKills", 25, 8_000, "Boss Breaker"),
  a("boss_100", "Doom of Kings", "☠️", "Defeat 100 bosses.", "bossKills", 100, 40_000, "Doom of Kings"),
  a("level_5", "Seasoned", "⭐", "Reach level 5.", "level", 5, 200),
  a("level_10", "Veteran", "⭐", "Reach level 10.", "level", 10, 600),
  a("level_25", "Master", "🌟", "Reach level 25.", "level", 25, 3_000),
  a("level_50", "Grandmaster", "🌟", "Reach level 50.", "level", 50, 15_000, "Grandmaster"),
  a("level_75", "Elder", "🌠", "Reach level 75.", "level", 75, 50_000),
  a("level_100", "Ascendant", "👑", "Reach level 100.", "level", 100, 150_000, "the Ascendant"),
  a("tower_5", "Tower Novice", "🏰", "Clear Tower floor 5.", "towerFloor", 5, 300),
  a("tower_25", "Tower Champion", "🏰", "Clear Tower floor 25.", "towerFloor", 25, 6_000),
  a("tower_50", "Tower Legend", "🏯", "Clear Tower floor 50.", "towerFloor", 50, 25_000, "Tower Legend"),
  a("tower_100", "Tower Conqueror", "🗝️", "Stand before the Void Gate: clear floor 100.", "towerFloor", 100, 200_000, "Gatebreaker"),
  a("dungeon_10", "Delver", "🕳️", "Reach Dungeon floor 10.", "dungeonBest", 10, 1_000),
  a("dungeon_50", "Abyss Diver", "🕳️", "Reach Dungeon floor 50.", "dungeonBest", 50, 20_000),
  a("dungeon_100", "Lord of the Deep", "🌑", "Clear Dungeon floor 100.", "dungeonBest", 100, 150_000, "Lord of the Deep"),
  a("craft_1", "Apprentice Smith", "🔨", "Craft an item.", "itemsCrafted", 1, 200),
  a("forge_10", "Master Forger", "⚒️", "Forge 10 items into higher rarities.", "itemsForged", 10, 6_000),
  a("upgrade_25", "Tempered", "🔥", "Upgrade gear 25 times.", "itemsUpgraded", 25, 4_000),
  a("pet_1", "Pet Owner", "🐾", "Hatch your first pet.", "petsHatched", 1, 300),
  a("pet_25", "Beastmaster", "🦁", "Hatch 25 pets.", "petsHatched", 25, 10_000, "Beastmaster"),
  a("skills_5", "Scholar", "📚", "Learn 5 skills.", "skillsLearned", 5, 1_500),
  a("skills_14", "Sage", "📖", "Learn every skill.", "skillsLearned", 14, 60_000, "the Sage"),
  a("duel_10", "Duelist", "🤺", "Win 10 duels.", "duelsWon", 10, 2_000),
  a("arena_50", "Arena Champion", "🏟️", "Win 50 arena matches.", "arenaWins", 50, 20_000, "Arena Champion"),
  a("trade_10", "Merchant Prince", "🤝", "Complete 10 trades.", "tradesCompleted", 10, 3_000),
  a("auction_10", "Auctioneer", "🔨", "Sell 10 items at auction.", "auctionsSold", 10, 3_000),
  a("streak_7", "Devoted", "📅", "Keep a 7-day login streak.", "dailyStreak", 7, 2_000),
  a("streak_30", "Unwavering", "🗓️", "Keep a 30-day login streak.", "dailyStreak", 30, 20_000, "the Unwavering"),
  a("expedition_20", "Wayfarer", "🧭", "Complete 20 expeditions.", "expeditions", 20, 5_000),
  a("contract_30", "Bounty Hunter", "📜", "Finish 30 hunt contracts.", "contractsDone", 30, 8_000, "Bounty Hunter"),
  a("bestiary_50", "Naturalist", "🔍", "Discover 50 creatures.", "bestiaryDiscovered", 50, 10_000),
  a("bestiary_all", "Keeper of the Bestiary", "📕", "Discover every creature.", "bestiaryDiscovered", 166, 60_000, "Keeper of Beasts"),
  a("worldboss_20", "Raider", "🌋", "Strike the world boss 20 times.", "worldBossHits", 20, 6_000),
  a("jackpot_1", "Lucky Devil", "🎰", "Hit a jackpot on the Lucky Roll.", "luckyJackpots", 1, 1_000),
];

// ── Bestiary mastery (original v4.7/4.8) ──────────────────────────────
export const MASTERY_TIERS = [
  { kills: 10, name: "Novice", coins: 250 },
  { kills: 50, name: "Hunter", coins: 1_500 },
  { kills: 200, name: "Slayer", coins: 8_000 },
  { kills: 500, name: "Nemesis", coins: 30_000 },
] as const;
export const masteryBonus = (rank: number) => ({ atkPct: rank * 3, defPct: rank * 2 });

// ── Daily login streak (original v4.4) ────────────────────────────────
export const STREAK_GRACE_HOURS = 48;
export const streakMultiplier = (streak: number) => (streak >= 30 ? 2 : streak >= 14 ? 1.75 : streak >= 7 ? 1.5 : streak >= 3 ? 1.25 : 1);
export const dailyBase = (level: number) => ({ coins: 150 + level * 40, xpPct: 0.12 });

// ── Hunt contracts (original v4.9) ────────────────────────────────────
export const CONTRACT_TIERS = [
  { need: 3, coins: 600, xpPct: 0.15, coinsPerLevel: 25 },
  { need: 5, coins: 1_400, xpPct: 0.25, coinsPerLevel: 45 },
  { need: 8, coins: 3_200, xpPct: 0.4, coinsPerLevel: 80 },
] as const;

// ── Daily missions ────────────────────────────────────────────────────
export type MissionType = "kill" | "boss" | "tower" | "dungeon" | "duel" | "craft" | "hatch" | "sell" | "shop" | "potion" | "expedition" | "coins";
export interface MissionDef { type: MissionType; name: string; desc: string; goal: number; coins: number; xpPct: number }
export const MISSION_POOL: MissionDef[] = [
  { type: "kill", name: "Monster Slayer", desc: "Defeat monsters", goal: 10, coins: 300, xpPct: 0.1 },
  { type: "kill", name: "The Butcher", desc: "Defeat monsters", goal: 30, coins: 900, xpPct: 0.25 },
  { type: "boss", name: "Boss Bane", desc: "Defeat a boss", goal: 1, coins: 600, xpPct: 0.15 },
  { type: "boss", name: "Dragon Hunter", desc: "Defeat bosses", goal: 3, coins: 1_500, xpPct: 0.35 },
  { type: "tower", name: "Tower Climber", desc: "Win Tower fights", goal: 2, coins: 500, xpPct: 0.15 },
  { type: "dungeon", name: "Deep Delver", desc: "Clear Dungeon floors", goal: 5, coins: 700, xpPct: 0.2 },
  { type: "duel", name: "Duelist", desc: "Win duels or arena matches", goal: 2, coins: 600, xpPct: 0.15 },
  { type: "craft", name: "Apprentice Smith", desc: "Craft, forge or upgrade gear", goal: 2, coins: 500, xpPct: 0.1 },
  { type: "hatch", name: "Egg Keeper", desc: "Hatch an egg", goal: 1, coins: 400, xpPct: 0.1 },
  { type: "sell", name: "Merchant's Eye", desc: "Sell or salvage items", goal: 5, coins: 300, xpPct: 0.08 },
  { type: "shop", name: "Shopper", desc: "Buy from the market", goal: 2, coins: 250, xpPct: 0.08 },
  { type: "potion", name: "Medic", desc: "Drink potions", goal: 3, coins: 300, xpPct: 0.08 },
  { type: "expedition", name: "Wayfarer", desc: "Collect an expedition", goal: 1, coins: 400, xpPct: 0.1 },
  { type: "coins", name: "Coin Hoarder", desc: "Earn coins from battles", goal: 2_000, coins: 500, xpPct: 0.1 },
];
export const MISSIONS_PER_DAY = 3;
export const MISSION_BONUS_CHEST = { coinsPerLevel: 60, egg: "mystery_egg" };

// ── Jobs (original) ───────────────────────────────────────────────────
export interface JobDef { id: string; name: string; icon: string; level: number; wage: number; xpPct: number }
export const JOBS: JobDef[] = [
  { id: "farmer", name: "Farmer", icon: "🌾", level: 5, wage: 400, xpPct: 0.05 },
  { id: "miner", name: "Miner", icon: "⛏️", level: 10, wage: 900, xpPct: 0.06 },
  { id: "cook", name: "Cook", icon: "🍳", level: 14, wage: 1_300, xpPct: 0.06 },
  { id: "fisher", name: "Fisher", icon: "🎣", level: 18, wage: 1_800, xpPct: 0.07 },
  { id: "guard", name: "Guard", icon: "💂", level: 24, wage: 2_700, xpPct: 0.07 },
  { id: "blacksmith", name: "Blacksmith", icon: "🔨", level: 32, wage: 4_200, xpPct: 0.08 },
  { id: "merchant", name: "Merchant", icon: "💰", level: 42, wage: 6_500, xpPct: 0.08 },
  { id: "alchemist", name: "Alchemist", icon: "⚗️", level: 55, wage: 10_000, xpPct: 0.09 },
  { id: "knight", name: "Knight", icon: "⚔️", level: 70, wage: 16_000, xpPct: 0.1 },
  { id: "wizard", name: "Wizard", icon: "🧙", level: 85, wage: 25_000, xpPct: 0.12 },
];
export const JOB_SHIFT_HOURS = 8;

// ── Temple (original blessings + offerings + ascension) ───────────────
export interface BlessingDef { id: string; name: string; icon: string; desc: string; costPerLevel: number; minutes: number; buff: { atkPct?: number; defPct?: number; coinPct?: number; xpPct?: number } }
export const BLESSINGS: BlessingDef[] = [
  { id: "guardian", name: "Guardian's Boon", icon: "🛡️", desc: "+15% defense", costPerLevel: 40, minutes: 60, buff: { defPct: 15 } },
  { id: "fury", name: "Warrior's Fury", icon: "⚔️", desc: "+12% attack", costPerLevel: 55, minutes: 45, buff: { atkPct: 12 } },
  { id: "fortune", name: "Fortune's Grace", icon: "🍀", desc: "+30% coins from battles", costPerLevel: 70, minutes: 120, buff: { coinPct: 30 } },
  { id: "wisdom", name: "Sage's Insight", icon: "📖", desc: "+20% battle XP", costPerLevel: 70, minutes: 120, buff: { xpPct: 20 } },
];
export const OFFERING_DAILY_CAP = 5;

// ── Lucky roll (original slot machine) ────────────────────────────────
export const LUCKY_SYMBOLS = ["🍒", "🍋", "🍇", "💎", "⭐", "👑"] as const;
export const LUCKY_WEIGHTS: Record<(typeof LUCKY_SYMBOLS)[number], number> = { "🍒": 30, "🍋": 24, "🍇": 20, "💎": 13, "⭐": 9, "👑": 4 };
export const LUCKY_PAYOUT: Record<(typeof LUCKY_SYMBOLS)[number], number> = { "🍒": 4, "🍋": 6, "🍇": 9, "💎": 18, "⭐": 35, "👑": 120 };
/** Any matching pair returns this multiple of the stake. With the weights above the machine returns ~92%. */
export const LUCKY_PAIR_MULT = 1.2;
export const luckyCost = (level: number) => 20 + level * 5;
export const LUCKY_DAILY_SPINS = 40;

// ── AI duel gauntlet (original AI_ENEMIES) ────────────────────────────
export const AI_DUELISTS = [
  { id: "goblin", name: "Goblin Champion", icon: "👺", level: 5 },
  { id: "golem", name: "Stone Golem", icon: "🗿", level: 15 },
  { id: "assassin", name: "Shadow Assassin", icon: "🥷", level: 25 },
  { id: "drake", name: "Fire Drake", icon: "🐉", level: 40 },
  { id: "titan", name: "Void Titan", icon: "🌌", level: 60 },
  { id: "overlord", name: "Chaos Overlord", icon: "👹", level: 80 },
] as const;
export const DUEL_MIN_LEVEL = 5;
export const ARENA_MIN_LEVEL = 10;
export const ARENA_TURN_SECONDS = 20;
export const ARENA_START_RATING = 1000;
export const ARENA_DAILY_RANKED = 15;

// ── Expeditions ───────────────────────────────────────────────────────
export const EXPEDITION_DURATIONS = [
  { id: "short", label: "30 minutes", minutes: 30 },
  { id: "medium", label: "2 hours", minutes: 120 },
  { id: "long", label: "8 hours", minutes: 480 },
] as const;
/** Expeditions earn a fraction of what active play would. */
export const EXPEDITION_EFFICIENCY = 0.35;

// ── Guilds ────────────────────────────────────────────────────────────
export const GUILD_CREATE_COST = 10_000;
export const GUILD_CREATE_LEVEL = 10;
export const GUILD_MAX_MEMBERS = (level: number) => 20 + level * 2;
export const guildXpToNext = (level: number) => 5_000 * level * level;
export const guildPerkPct = (level: number) => Math.min(10, level);

export interface GuildTaskDef { id: string; name: string; icon: string; desc: string; counter: Counter; goal: number; guildXp: number; coins: number }
export const GUILD_TASK_POOL: GuildTaskDef[] = [
  { id: "g_kills", name: "Monster Slayers", icon: "⚔️", desc: "Members defeat monsters", counter: "kills", goal: 150, guildXp: 1_500, coins: 800 },
  { id: "g_bosses", name: "Boss Breakers", icon: "👑", desc: "Members defeat bosses", counter: "bossKills", goal: 8, guildXp: 2_000, coins: 1_000 },
  { id: "g_tower", name: "Tower Climbers", icon: "🏰", desc: "Members win Tower fights", counter: "towerFloor", goal: 10, guildXp: 1_800, coins: 900 },
  { id: "g_dungeon", name: "Deep Delvers", icon: "🕳️", desc: "Members clear Dungeon floors", counter: "dungeonBest", goal: 25, guildXp: 1_800, coins: 900 },
  { id: "g_craft", name: "Forge Masters", icon: "🔨", desc: "Members craft or forge gear", counter: "itemsCrafted", goal: 10, guildXp: 1_200, coins: 700 },
  { id: "g_hatch", name: "Beast Keepers", icon: "🥚", desc: "Members hatch pets", counter: "petsHatched", goal: 5, guildXp: 1_200, coins: 700 },
  { id: "g_duels", name: "Arena Pride", icon: "🤺", desc: "Members win duels", counter: "duelsWon", goal: 15, guildXp: 1_600, coins: 800 },
  { id: "g_boss_hits", name: "Raid Party", icon: "🌋", desc: "Members strike the world boss", counter: "worldBossHits", goal: 20, guildXp: 2_200, coins: 1_000 },
];

// ── World boss ────────────────────────────────────────────────────────
export const WORLD_BOSS_ATTEMPTS_PER_DAY = 3;
export const WORLD_BOSS_TURNS = 10;

// ── Market ────────────────────────────────────────────────────────────
export const AUCTION_FEE_PCT = 5;
export const AUCTION_HOURS = [12, 24, 48] as const;
export const TRADE_EXPIRY_HOURS = 24;
export const CHAT_MAX_LENGTH = 400;
