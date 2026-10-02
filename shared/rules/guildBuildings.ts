export interface GuildBuildingDef {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  description: string;
  maxTier: number;
  baseCost: number;
  costMultiplier: number;
  getPerkDescription: (tier: number) => string;
}

export const GUILD_BUILDINGS: GuildBuildingDef[] = [
  {
    id: "citadel",
    name: "Imperial Citadel",
    icon: "🏰",
    tagline: "Guild Headquarters & Capacity",
    description: "The grand fortress of the clan. Expands member capacity and unlocks high-tier projects.",
    maxTier: 10,
    baseCost: 500_000,
    costMultiplier: 1.5,
    getPerkDescription: (t) => `+${t * 2} Maximum Guild Member Capacity`,
  },
  {
    id: "war_forge",
    name: "Astral War Forge",
    icon: "⚒️",
    tagline: "Weapon & Armor Enchantments",
    description: "Channels elemental magma to temper weapons. Grants guild-wide ATK and DEF bonus.",
    maxTier: 10,
    baseCost: 750_000,
    costMultiplier: 1.6,
    getPerkDescription: (t) => `+${t * 2}% Attack & +${t * 2}% Defense for all members`,
  },
  {
    id: "alchemy_lab",
    name: "Alchemical Conservatory",
    icon: "🧪",
    tagline: "Elixirs & Accelerated Vitality",
    description: "Brewing vats producing clan-wide restorative vapors. Accelerates HP recovery and max HP.",
    maxTier: 10,
    baseCost: 600_000,
    costMultiplier: 1.5,
    getPerkDescription: (t) => `+${t * 2}% Max HP & +${t * 5}% faster HP regeneration`,
  },
  {
    id: "astral_vault",
    name: "Sovereign Treasury Vault",
    icon: "🪙",
    tagline: "Economic Dominion & Tax Relief",
    description: "Reinforced dimensional vaults. Reduces donation tax and increases gold rewards in dungeons.",
    maxTier: 10,
    baseCost: 1_000_000,
    costMultiplier: 1.7,
    getPerkDescription: (t) => `-${(t * 0.5).toFixed(1)}% Extra Donation Tax Relief & +${t * 3}% Battle Gold`,
  },
  {
    id: "celestial_observatory",
    name: "Celestial Observatory",
    icon: "🔭",
    tagline: "Starlight Resonance & Critical Marks",
    description: "Scrying lenses charting celestial alignments. Increases critical strike chance and loot luck.",
    maxTier: 10,
    baseCost: 1_250_000,
    costMultiplier: 1.8,
    getPerkDescription: (t) => `+${(t * 1.5).toFixed(1)}% Critical Strike Chance & +${t * 2}% Rare Drop Luck`,
  },
  {
    id: "beast_sanctuary",
    name: "Beast Training Colosseum",
    icon: "🐾",
    tagline: "Companion & Pet Mastery",
    description: "Training sands for war pets and familiars. Boosts pet XP gain and combat effectiveness.",
    maxTier: 10,
    baseCost: 800_000,
    costMultiplier: 1.5,
    getPerkDescription: (t) => `+${t * 5}% Pet Power & +${t * 10}% Pet XP Gain`,
  },
  {
    id: "grand_monument",
    name: "Monument of the Immortals",
    icon: "🗿",
    tagline: "Supreme Glory & Sovereign Stats",
    description: "Colossal obelisk carved from obsidian and gold. Bestows flat primordial stats upon all members.",
    maxTier: 10,
    baseCost: 2_000_000,
    costMultiplier: 2.0,
    getPerkDescription: (t) => `+${t * 100} Flat Max HP, +${t * 25} Flat ATK, +${t * 25} Flat DEF`,
  },
];

export const GUILD_BUILDING_BY_ID: Record<string, GuildBuildingDef> = Object.fromEntries(
  GUILD_BUILDINGS.map((b) => [b.id, b])
);

export function getGuildBuildingCost(def: GuildBuildingDef, currentTier: number): number {
  if (currentTier >= def.maxTier) return 0;
  return Math.floor(def.baseCost * Math.pow(def.costMultiplier, currentTier));
}

export function computeGuildBuildingBonuses(buildings: Record<string, number> = {}) {
  const warForgeTier = buildings.war_forge ?? 0;
  const alchemyTier = buildings.alchemy_lab ?? 0;
  const vaultTier = buildings.astral_vault ?? 0;
  const observatoryTier = buildings.celestial_observatory ?? 0;
  const beastTier = buildings.beast_sanctuary ?? 0;
  const monumentTier = buildings.grand_monument ?? 0;

  return {
    extraMembers: (buildings.citadel ?? 0) * 2,
    atkPct: warForgeTier * 2,
    defPct: warForgeTier * 2,
    hpPct: alchemyTier * 2,
    regenPct: alchemyTier * 5,
    taxDiscountPct: vaultTier * 0.5,
    goldBonusPct: vaultTier * 3,
    critBonus: observatoryTier * 1.5,
    luckBonus: observatoryTier * 2,
    petPowerPct: beastTier * 5,
    petXpPct: beastTier * 10,
    flatHp: monumentTier * 100,
    flatAtk: monumentTier * 25,
    flatDef: monumentTier * 25,
  };
}
