import type { ClassDef, Rarity } from "./types.ts";

// The original's 20 classes and base stats, each given a weapon affinity and a passive.
export const CLASSES: ClassDef[] = [
  { id: "warrior", name: "Warrior", icon: "⚔️", rarity: "common", archetype: "vanguard", base: { hp: 100, atk: 12, def: 8, spd: 6 }, weapon: "sword",
    passive: { name: "Iron Hide", desc: "+10% max HP", effect: { kind: "stat_pct", stats: { hp: 10 } } } },
  { id: "mage", name: "Mage", icon: "🔮", rarity: "common", archetype: "arcanist", base: { hp: 70, atk: 15, def: 4, spd: 5 }, weapon: "staff",
    passive: { name: "Arcane Focus", desc: "Skills deal 15% more damage", effect: { kind: "skill_power", pct: 15 } } },
  { id: "archer", name: "Archer", icon: "🏹", rarity: "common", archetype: "marksman", base: { hp: 75, atk: 13, def: 5, spd: 8 }, weapon: "bow",
    passive: { name: "Keen Eye", desc: "+8% critical chance", effect: { kind: "crit", chance: 8, dmg: 0 } } },
  { id: "thief", name: "Thief", icon: "🗡️", rarity: "common", archetype: "rogue", base: { hp: 80, atk: 11, def: 5, spd: 10 }, weapon: "dagger",
    passive: { name: "Slippery", desc: "+8% dodge", effect: { kind: "dodge", chance: 8 } } },
  { id: "knight", name: "Knight", icon: "🛡️", rarity: "uncommon", archetype: "vanguard", base: { hp: 110, atk: 14, def: 10, spd: 5 }, weapon: "sword",
    passive: { name: "Bulwark", desc: "+12% defense", effect: { kind: "stat_pct", stats: { def: 12 } } } },
  { id: "sorcerer", name: "Sorcerer", icon: "✨", rarity: "uncommon", archetype: "arcanist", base: { hp: 75, atk: 18, def: 5, spd: 6 }, weapon: "staff",
    passive: { name: "Spellweave", desc: "Skills deal 20% more damage", effect: { kind: "skill_power", pct: 20 } } },
  { id: "hunter", name: "Hunter", icon: "🎯", rarity: "uncommon", archetype: "marksman", base: { hp: 85, atk: 15, def: 6, spd: 9 }, weapon: "bow",
    passive: { name: "Big Game", desc: "+15% damage to bosses", effect: { kind: "boss_damage", pct: 15 } } },
  { id: "assassin", name: "Assassin", icon: "🥷", rarity: "uncommon", archetype: "rogue", base: { hp: 80, atk: 16, def: 5, spd: 11 }, weapon: "dagger",
    passive: { name: "Killing Blow", desc: "+30% critical damage", effect: { kind: "crit", chance: 0, dmg: 30 } } },
  { id: "paladin", name: "Paladin", icon: "⚜️", rarity: "rare", archetype: "vanguard", base: { hp: 130, atk: 15, def: 12, spd: 6 }, weapon: "hammer",
    passive: { name: "Lay on Hands", desc: "Heal 3% max HP each turn", effect: { kind: "regen", pctPerTurn: 3 } } },
  { id: "warlock", name: "Warlock", icon: "🌑", rarity: "rare", archetype: "arcanist", base: { hp: 85, atk: 22, def: 6, spd: 7 }, weapon: "staff",
    passive: { name: "Soul Siphon", desc: "Heal for 6% of damage dealt", effect: { kind: "lifesteal", pct: 6 } } },
  { id: "ranger", name: "Ranger", icon: "🌲", rarity: "rare", archetype: "marksman", base: { hp: 95, atk: 18, def: 7, spd: 10 }, weapon: "bow",
    passive: { name: "First Arrow", desc: "+20% speed", effect: { kind: "first_strike", spdPct: 20 } } },
  { id: "ninja", name: "Ninja", icon: "💨", rarity: "rare", archetype: "rogue", base: { hp: 85, atk: 19, def: 6, spd: 12 }, weapon: "dagger",
    passive: { name: "Vanish", desc: "+12% dodge", effect: { kind: "dodge", chance: 12 } } },
  { id: "berserker", name: "Berserker", icon: "💢", rarity: "epic", archetype: "vanguard", base: { hp: 140, atk: 24, def: 8, spd: 7 }, weapon: "hammer",
    passive: { name: "Blood Rage", desc: "+25% damage while below half HP", effect: { kind: "low_hp_rage", pct: 25 } } },
  { id: "necromancer", name: "Necromancer", icon: "💀", rarity: "epic", archetype: "arcanist", base: { hp: 95, atk: 26, def: 7, spd: 8 }, weapon: "staff",
    passive: { name: "Grave Bond", desc: "Your pet strikes 40% harder", effect: { kind: "pet_power", pct: 40 } } },
  { id: "shadow_blade", name: "Shadow Blade", icon: "🗡️", rarity: "epic", archetype: "rogue", base: { hp: 100, atk: 25, def: 8, spd: 13 }, weapon: "dagger",
    passive: { name: "Night Edge", desc: "+10% crit chance, +20% crit damage", effect: { kind: "crit", chance: 10, dmg: 20 } } },
  { id: "dragon_knight", name: "Dragon Knight", icon: "🐉", rarity: "legendary", archetype: "vanguard", base: { hp: 160, atk: 28, def: 15, spd: 10 }, weapon: "sword",
    passive: { name: "Dragonblood", desc: "+10% HP and attack", effect: { kind: "stat_pct", stats: { hp: 10, atk: 10 } } } },
  { id: "void_mage", name: "Void Mage", icon: "🌌", rarity: "legendary", archetype: "arcanist", base: { hp: 100, atk: 32, def: 10, spd: 9 }, weapon: "staff",
    passive: { name: "Unmaking", desc: "Attacks ignore 25% of defense", effect: { kind: "armor_pierce", pct: 25 } } },
  { id: "phantom_lord", name: "Phantom Lord", icon: "👻", rarity: "legendary", archetype: "rogue", base: { hp: 110, atk: 30, def: 12, spd: 14 }, weapon: "dagger",
    passive: { name: "Wraithstep", desc: "+15% dodge", effect: { kind: "dodge", chance: 15 } } },
  { id: "chronomancer", name: "Chronomancer", icon: "⏳", rarity: "unique", archetype: "arcanist", base: { hp: 180, atk: 35, def: 16, spd: 13 }, weapon: "staff",
    passive: { name: "Rewind", desc: "All skill cooldowns are 1 turn shorter", effect: { kind: "cooldown", turns: 1 } } },
  { id: "chimera", name: "Chimera", icon: "🐲", rarity: "unique", archetype: "vanguard", base: { hp: 175, atk: 34, def: 18, spd: 12 }, weapon: "hammer",
    passive: { name: "Three Hearts", desc: "+12% to all stats", effect: { kind: "all_stats", pct: 12 } } },
];

export const CLASS_BY_ID: Record<string, ClassDef> = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

/** Rarity-first starter roll weights. Unique classes never come from a roll at signup. */
export const STARTER_WEIGHTS: Partial<Record<Rarity, number>> = { common: 40, uncommon: 30, rare: 18, epic: 9, legendary: 3 };
/** Paid rerolls can land a unique class, if nobody owns it yet. */
export const REROLL_WEIGHTS: Partial<Record<Rarity, number>> = { common: 40, uncommon: 30, rare: 18, epic: 9, legendary: 3, unique: 0.6 };

/** Class tier ascension at the Temple raises base stats. */
export const CLASS_TIER_MULT: Record<Rarity, number> = {
  common: 1, uncommon: 1.08, rare: 1.16, epic: 1.25, legendary: 1.35, mythic: 1.4, unique: 1.45,
};
export const ASCENSION_COST: Partial<Record<Rarity, number>> = {
  uncommon: 1_500, rare: 8_000, epic: 40_000, legendary: 180_000,
};

export const REROLL_COST = (level: number) => 500 + level * 100;
export const DUAL_CLASS_LEVEL = 20;
export const DUAL_CLASS_COST = 25_000;
export const DUAL_CLASS_MAX_LEVEL = 25;
/** Share of the second class's base stats granted at dual level L. */
export const dualShare = (dualLevel: number) => 0.15 + dualLevel * 0.006;
export const dualXpToNext = (dualLevel: number) => 250 + dualLevel * dualLevel * 60;

export const RANK_STAGES: Record<ClassDef["archetype"], [string, string, string, string]> = {
  vanguard: ["Novice Squire", "Awakened Blade", "Aura Knight", "Warlord"],
  arcanist: ["Novice Adept", "Mana Awakened", "Aura Magus", "Archmage"],
  marksman: ["Novice Scout", "Wind Awakened", "Aura Ranger", "Master Hunter"],
  rogue: ["Novice Cutpurse", "Shadow Awakened", "Aura Stalker", "Nightlord"],
};

export function rankTitle(archetype: ClassDef["archetype"], level: number): { stage: number; title: string } {
  const stage = level <= 10 ? 0 : level <= 30 ? 1 : level <= 60 ? 2 : 3;
  return { stage, title: RANK_STAGES[archetype][stage] };
}
