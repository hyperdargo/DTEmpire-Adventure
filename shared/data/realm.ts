// Rotating Realm Calendar: daily celestial weather and surges that reshape the realm.
// Each day of the week (UTC) brings a distinct celestial influence, encouraging different playstyles.

export interface RealmModifier {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  id: string;
  name: string;
  icon: string;
  tagline: string;
  description: string;
  effects: {
    lifesteal?: number;
    coinPct?: number;
    xpPct?: number;
    cooldownReduction?: number;
    salvageBonus?: boolean;
    dropRatePct?: number;
    arenaRatingMult?: number;
    arenaCoinMult?: number;
    contractBonusPct?: number;
    templeFavorMult?: number;
  };
}

export const REALM_MODIFIERS: RealmModifier[] = [
  {
    dayOfWeek: 0, // Sunday
    id: "astral_alignment",
    name: "Astral Alignment",
    icon: "🌟",
    tagline: "Shooting stars shower the night sky.",
    description: "Temple blessings yield double favor, and all Hunt Contracts & Missions pay +50% coins and XP.",
    effects: {
      contractBonusPct: 50,
      templeFavorMult: 2.0,
      xpPct: 15,
    },
  },
  {
    dayOfWeek: 1, // Monday
    id: "blood_moon",
    name: "Blood Moon Surge",
    icon: "🩸",
    tagline: "The twin moons align in deep crimson.",
    description: "All heroes gain +12% Lifesteal across all battle modes. World Boss strikes yield +30% bonus XP.",
    effects: {
      lifesteal: 12,
      xpPct: 20,
    },
  },
  {
    dayOfWeek: 2, // Tuesday
    id: "golden_sol",
    name: "Golden Sol Radiance",
    icon: "🪙",
    tagline: "Sunlight glints off ancient veins of buried ore.",
    description: "Monsters drop +35% bonus coins in Adventure and Dungeons. Blacksmith upgrades cost 20% less.",
    effects: {
      coinPct: 35,
    },
  },
  {
    dayOfWeek: 3, // Wednesday
    id: "arcane_conflux",
    name: "Arcane Conflux",
    icon: "📜",
    tagline: "Aetheric currents pulse violently along the ley lines.",
    description: "Hero XP gained across all modes is boosted by +40%. Combat skill cooldowns recharge 1 turn faster.",
    effects: {
      xpPct: 40,
      cooldownReduction: 1,
    },
  },
  {
    dayOfWeek: 4, // Thursday
    id: "forge_tempest",
    name: "Forge Tempest",
    icon: "⚒️",
    tagline: "Volcanic thunder echoes from the Black Peak.",
    description: "Salvaging equipment yields +50% bonus materials. Rare and Epic item drop rates increased by +25%.",
    effects: {
      salvageBonus: true,
      dropRatePct: 25,
    },
  },
  {
    dayOfWeek: 5, // Friday
    id: "abyssal_rift",
    name: "Abyssal Rift",
    icon: "🌌",
    tagline: "The veil separating the mortal realm and the Void thins.",
    description: "Endless Abyss runs award +30% Abyssal Shards. Dungeon pouches gain +20% capacity and shard yields.",
    effects: {
      dropRatePct: 30,
      coinPct: 20,
    },
  },
  {
    dayOfWeek: 6, // Saturday
    id: "gladiators_roar",
    name: "Gladiator's Roar",
    icon: "⚔️",
    tagline: "Chants of thousands reverberate in the Grand Colosseum.",
    description: "Ranked Arena and Live Duels award double coins and +50% ELO rating delta on victory.",
    effects: {
      arenaRatingMult: 1.5,
      arenaCoinMult: 2.0,
      xpPct: 25,
    },
  },
];

export const REALM_MODIFIER_BY_ID = Object.fromEntries(REALM_MODIFIERS.map((m) => [m.id, m]));

/** Returns the active realm modifier based on current UTC day of the week. */
export function currentRealmModifier(nowMs: number = Date.now()): RealmModifier {
  const d = new Date(nowMs);
  const day = d.getUTCDay();
  return REALM_MODIFIERS.find((m) => m.dayOfWeek === day) ?? REALM_MODIFIERS[0]!;
}

/** Calculates milliseconds remaining until next UTC midnight surge shift. */
export function realmModifierEndsAt(nowMs: number = Date.now()): number {
  const d = new Date(nowMs);
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0));
  return next.getTime();
}
