import type { SkillDef } from "./types.ts";

// The original's 14 skill names, reworked from passive stat bonuses into active combat abilities.
export const SKILLS: SkillDef[] = [
  { id: "power_strike", name: "Power Strike", icon: "⚡", cooldown: 2, levelReq: 1, price: 150,
    desc: "A heavy blow for 160% damage.", effect: { kind: "damage", mult: 1.6 } },
  { id: "iron_wall", name: "Iron Wall", icon: "🛡️", cooldown: 4, levelReq: 3, price: 300,
    desc: "Raise a shield worth 25% of your max HP.", effect: { kind: "shield", pct: 25 } },
  { id: "swift_step", name: "Swift Step", icon: "💨", cooldown: 4, levelReq: 5, price: 450,
    desc: "+40% dodge for 2 turns.", effect: { kind: "buff", stat: "dodge", pct: 40, turns: 2 } },
  { id: "meditate", name: "Meditate", icon: "🧘", cooldown: 5, levelReq: 7, price: 700,
    desc: "Restore 30% of your max HP.", effect: { kind: "heal", pct: 30 } },
  { id: "berserk", name: "Berserk", icon: "🔥", cooldown: 5, levelReq: 10, price: 1_100,
    desc: "+50% attack for 3 turns, but -25% defense.", effect: { kind: "buff", stat: "atk", pct: 50, turns: 3, selfDefPenalty: 25 } },
  { id: "shadow_strike", name: "Shadow Strike", icon: "🗡️", cooldown: 3, levelReq: 14, price: 1_800,
    desc: "Two quick cuts for 90% each, +25% crit chance.", effect: { kind: "damage", mult: 0.9, hits: 2, critBonus: 25 } },
  { id: "flame_burst", name: "Flame Burst", icon: "🔥", cooldown: 4, levelReq: 18, price: 2_800,
    desc: "130% damage and burns for 3 turns.", effect: { kind: "burn", mult: 1.3, dotPct: 18, turns: 3 } },
  { id: "fortress", name: "Fortress", icon: "🏰", cooldown: 5, levelReq: 22, price: 4_000,
    desc: "Guard this turn and +80% defense for 2 turns.", effect: { kind: "buff", stat: "def", pct: 80, turns: 2, guard: true } },
  { id: "life_steal", name: "Life Steal", icon: "💉", cooldown: 4, levelReq: 26, price: 5_500,
    desc: "140% damage, heal for 60% of it.", effect: { kind: "drain", mult: 1.4, healPct: 60 } },
  { id: "thunderclap", name: "Thunderclap", icon: "🌩️", cooldown: 4, levelReq: 32, price: 8_000,
    desc: "120% damage with a 40% chance to stun.", effect: { kind: "stun", mult: 1.2, chance: 40 } },
  { id: "blade_dance", name: "Blade Dance", icon: "💃", cooldown: 4, levelReq: 40, price: 12_000,
    desc: "Three spinning slashes for 70% each.", effect: { kind: "damage", mult: 0.7, hits: 3 } },
  { id: "divine_shield", name: "Divine Shield", icon: "✨", cooldown: 6, levelReq: 50, price: 18_000,
    desc: "A holy shield worth 45% of your max HP.", effect: { kind: "shield", pct: 45 } },
  { id: "earthshaker", name: "Earthshaker", icon: "🌍", cooldown: 6, levelReq: 62, price: 28_000,
    desc: "A ground-splitting slam for 230% damage.", effect: { kind: "damage", mult: 2.3 } },
  { id: "mana_surge", name: "Mana Surge", icon: "🌀", cooldown: 7, levelReq: 75, price: 45_000,
    desc: "260% damage that ignores half of defense.", effect: { kind: "damage", mult: 2.6, pierce: 50 } },
];

export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
export const SKILL_BY_NAME: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.name, s]));

export const SKILL_MAX_RANK = 5;
/** Each rank beyond 1 adds 12% to the skill's power. */
export const skillRankMult = (rank: number) => 1 + (Math.max(1, rank) - 1) * 0.12;
export const skillUpgradeCost = (skill: SkillDef, rank: number) => Math.round(skill.price * 0.8 * rank);
/** Loadout slots unlock as you level. */
export const loadoutSlots = (level: number) => (level >= 40 ? 4 : 3);
