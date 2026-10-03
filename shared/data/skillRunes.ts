export interface SkillRuneDef {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  desc: string;
  cost: number;
}

export const SKILL_RUNES: SkillRuneDef[] = [
  {
    id: "swiftcast",
    name: "Swiftcast Rune",
    icon: "⚡",
    tagline: "-1 Cooldown",
    desc: "Reduces skill cooldown by 1 turn (minimum 1 turn).",
    cost: 15_000,
  },
  {
    id: "hellfire",
    name: "Hellfire Rune",
    icon: "🔥",
    tagline: "Ignite Foe",
    desc: "Inflicts 20% burn damage over 2 turns on strike.",
    cost: 20_000,
  },
  {
    id: "true_strike",
    name: "True-Strike Rune",
    icon: "🎯",
    tagline: "+20% Crit",
    desc: "Adds +20% critical strike chance when using this skill.",
    cost: 25_000,
  },
  {
    id: "vampiric",
    name: "Vampiric Rune",
    icon: "🩸",
    tagline: "+25% Lifesteal",
    desc: "Siphons 25% of all damage dealt by this skill as healing.",
    cost: 35_000,
  },
  {
    id: "ironbark",
    name: "Ironbark Rune",
    icon: "🛡️",
    tagline: "+15% Shield",
    desc: "Grants a protective barrier worth 15% max HP on cast.",
    cost: 30_000,
  },
  {
    id: "overpower",
    name: "Overpower Rune",
    icon: "💎",
    tagline: "+25% Power",
    desc: "Amplifies the skill's rank multiplier by +25%.",
    cost: 50_000,
  },
];

export const SKILL_RUNE_BY_ID: Record<string, SkillRuneDef> = Object.fromEntries(
  SKILL_RUNES.map((r) => [r.id, r])
);
