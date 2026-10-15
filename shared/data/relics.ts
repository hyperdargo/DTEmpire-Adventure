import type { Rarity } from "./types.ts";

export type RelicCategory = "chapter" | "spire" | "abyss" | "apex";

export interface RelicStats {
  atkPct?: number;
  defPct?: number;
  hpPct?: number;
  spdPct?: number;
  crit?: number;
  critDmg?: number;
  dodge?: number;
  lifesteal?: number;
  luck?: number;
  xpBonus?: number;
  skillPower?: number;
  bossDamage?: number;
  pierce?: number;
  coinPct?: number;
}

export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  rarity: Rarity;
  category: RelicCategory;
  chapter?: number;
  source: string;
  desc: string;
  baseStats: RelicStats;
  statSummary: string;
}

export const RELICS: RelicDef[] = [
  // ── Chapter Relics (Story Campaign 1–20) ──────────────────────────────
  {
    id: "rusty_blade",
    name: "Goblin Chieftain's Blade",
    icon: "🗡️",
    rarity: "rare",
    category: "chapter",
    chapter: 1,
    source: "Chapter 1: The Dark Forest",
    desc: "The rusted yet razor-sharp cleaver carried by the first goblin warlords who guarded the ancient tower base.",
    baseStats: { atkPct: 2 },
    statSummary: "+2% Attack",
  },
  {
    id: "shadow_dagger",
    name: "Wraith's Shadow Dagger",
    icon: "🌑",
    rarity: "rare",
    category: "chapter",
    chapter: 2,
    source: "Chapter 2: Whispers in the Dark",
    desc: "Forged in twilight darkness. The blade whispers with the lingering essence of subterranean wraiths.",
    baseStats: { crit: 2 },
    statSummary: "+2% Critical Chance",
  },
  {
    id: "kings_crown",
    name: "King Grok's Bone Crown",
    icon: "👑",
    rarity: "rare",
    category: "chapter",
    chapter: 3,
    source: "Chapter 3: The Goblin Kingdom",
    desc: "A crude crown of petrified bones radiating stubborn subterranean fortitude and ancient vitality.",
    baseStats: { hpPct: 3 },
    statSummary: "+3% Max HP",
  },
  {
    id: "crystal_bow",
    name: "Crystal Queen's Shard",
    icon: "💎",
    rarity: "rare",
    category: "chapter",
    chapter: 4,
    source: "Chapter 4: The Crystal Caverns",
    desc: "A prismatic crystal shard refracting celestial light with blinding quickness and agile reflexes.",
    baseStats: { spdPct: 2 },
    statSummary: "+2% Speed",
  },
  {
    id: "molten_heart",
    name: "Magma Titan's Core",
    icon: "🔥",
    rarity: "epic",
    category: "chapter",
    chapter: 5,
    source: "Chapter 5: The Molten Core",
    desc: "A pulsing ember of geothermal fire that encases the hero in layered volcanic armor plates.",
    baseStats: { defPct: 3 },
    statSummary: "+3% Defense",
  },
  {
    id: "sun_amulet",
    name: "Solar Sigil Amulet",
    icon: "☀️",
    rarity: "epic",
    category: "chapter",
    chapter: 6,
    source: "Chapter 6: The Sunken Temple",
    desc: "Blessed by ancient high priests to attract celestial prosperity and imperial coin bounties.",
    baseStats: { coinPct: 5 },
    statSummary: "+5% Battle Gold",
  },
  {
    id: "void_fragment",
    name: "Void Rift Fragment",
    icon: "🌀",
    rarity: "epic",
    category: "chapter",
    chapter: 7,
    source: "Chapter 7: The Void Gate",
    desc: "A fragment of reality-shattering void crystal that magnifies spell incantations and skill potency.",
    baseStats: { skillPower: 4 },
    statSummary: "+4% Skill Power",
  },
  {
    id: "frozen_soul",
    name: "Frost Monarch's Soul",
    icon: "❄️",
    rarity: "epic",
    category: "chapter",
    chapter: 8,
    source: "Chapter 8: The Frozen Wastes",
    desc: "A heart of pristine permafrost that freezes enemy resolve upon fatal, devastating strikes.",
    baseStats: { critDmg: 6 },
    statSummary: "+6% Critical Damage",
  },
  {
    id: "serpent_fang",
    name: "Leviathan's Venomous Fang",
    icon: "🐍",
    rarity: "epic",
    category: "chapter",
    chapter: 9,
    source: "Chapter 9: The Sunken Ruins",
    desc: "A barbed serpent fang siphon that drains vital vigor directly from wounded quarry in combat.",
    baseStats: { lifesteal: 2 },
    statSummary: "+2% Lifesteal",
  },
  {
    id: "soul_anvil",
    name: "Ancient Smiths' Soul Anvil",
    icon: "⚒️",
    rarity: "legendary",
    category: "chapter",
    chapter: 10,
    source: "Chapter 10: The Forge of Souls",
    desc: "Hammers forged from fallen stars, hardening the hero's arms and defensive bulk alike.",
    baseStats: { defPct: 3, atkPct: 2 },
    statSummary: "+3% DEF & +2% ATK",
  },
  {
    id: "ancient_tome",
    name: "Arcanum Primordial Codex",
    icon: "📖",
    rarity: "legendary",
    category: "chapter",
    chapter: 11,
    source: "Chapter 11: The Lost Library",
    desc: "Centuries of compiled forgotten arcana accelerating battlefield mastery and enlightenment.",
    baseStats: { xpBonus: 6 },
    statSummary: "+6% Battle XP",
  },
  {
    id: "thunder_core",
    name: "Storm Titan's Thunder Core",
    icon: "⚡",
    rarity: "legendary",
    category: "chapter",
    chapter: 12,
    source: "Chapter 12: The Thunder Spires",
    desc: "Lightning contained in ancient electromantine casing, imparting tempest speed.",
    baseStats: { spdPct: 3 },
    statSummary: "+3% Speed",
  },
  {
    id: "bone_ring",
    name: "Lich King's Phylactery",
    icon: "💍",
    rarity: "legendary",
    category: "chapter",
    chapter: 13,
    source: "Chapter 13: The Crypt of Ancients",
    desc: "Binds the bearer's life thread to the immortal nether plane, massively swelling max vitality.",
    baseStats: { hpPct: 5 },
    statSummary: "+5% Max HP",
  },
  {
    id: "mirror_shard",
    name: "Chrono Mirage Mirror",
    icon: "🪞",
    rarity: "legendary",
    category: "chapter",
    chapter: 14,
    source: "Chapter 14: The Hall of Mirrors",
    desc: "Bends ambient light and temporal frames to slip past hostile attacks effortlessly.",
    baseStats: { dodge: 3 },
    statSummary: "+3% Dodge Chance",
  },
  {
    id: "primordial_tear",
    name: "Creation Gate Tear",
    icon: "💧",
    rarity: "mythic",
    category: "chapter",
    chapter: 15,
    source: "Chapter 15: The Primordial Gate",
    desc: "A weeping tear from the genesis of the continent empowering all primary hero attributes.",
    baseStats: { hpPct: 3, atkPct: 3, defPct: 3 },
    statSummary: "+3% HP, ATK & DEF",
  },
  {
    id: "cosmic_pearl",
    name: "Astral Singularity Pearl",
    icon: "🔮",
    rarity: "mythic",
    category: "chapter",
    chapter: 16,
    source: "Chapter 16: The Astral Realm",
    desc: "Distorts physical resistance, driving strikes cleanly through the thickest armor plates.",
    baseStats: { pierce: 5 },
    statSummary: "+5% Armor Piercing",
  },
  {
    id: "godslayer_shard",
    name: "Fallen Deity's Edge",
    icon: "🗡️",
    rarity: "mythic",
    category: "chapter",
    chapter: 17,
    source: "Chapter 17: The Pantheon Ruins",
    desc: "A jagged divine blade fragment engineered specifically to fell monolithic titans and realm bosses.",
    baseStats: { bossDamage: 8 },
    statSummary: "+8% Boss Damage",
  },
  {
    id: "chaos_sigil",
    name: "Netherworld Chaos Sigil",
    icon: "✨",
    rarity: "mythic",
    category: "chapter",
    chapter: 18,
    source: "Chapter 18: The Chaos Nexus",
    desc: "Unpredictable chaotic cosmic energies converting ordinary strikes into devastating criticals.",
    baseStats: { crit: 3, critDmg: 8 },
    statSummary: "+3% Crit & +8% Crit DMG",
  },
  {
    id: "dragons_eye",
    name: "Ancient Wyrm's Eye",
    icon: "👁️",
    rarity: "mythic",
    category: "chapter",
    chapter: 19,
    source: "Chapter 19: The Dragon's Lair",
    desc: "The amber eye of the progenitor wyrm revealing hidden treasure and fortunate battle windfalls.",
    baseStats: { luck: 5, coinPct: 5 },
    statSummary: "+5 Luck & +5% Gold",
  },
  {
    id: "crown_of_ancients",
    name: "Crown of the Ancients",
    icon: "👑",
    rarity: "unique",
    category: "chapter",
    chapter: 20,
    source: "Chapter 20: The Spire Apex",
    desc: "The supreme diadem worn by the ancient architects who raised the Tower of Ascension.",
    baseStats: { hpPct: 6, atkPct: 6, defPct: 6 },
    statSummary: "+6% HP, ATK & DEF",
  },

  // ── Elemental Spire Relics (Tower Ascensions) ──────────────────────────
  {
    id: "infernal_ember",
    name: "Molten Spire Ember",
    icon: "🔥",
    rarity: "mythic",
    category: "spire",
    source: "Tower: Molten Torment (Floor 50+)",
    desc: "Living elemental magma harvested from the furnace heart of the Molten Torment Spire.",
    baseStats: { atkPct: 4, coinPct: 6 },
    statSummary: "+4% ATK & +6% Battle Gold",
  },
  {
    id: "celestial_shard",
    name: "Celestial Starlight Shard",
    icon: "⭐",
    rarity: "mythic",
    category: "spire",
    source: "Tower: Celestial Pillar (Floor 50+)",
    desc: "A condensed crystalline starlight shard pulled from the heights of the Celestial Pillar.",
    baseStats: { defPct: 4, xpBonus: 8 },
    statSummary: "+4% DEF & +8% Battle XP",
  },
  {
    id: "abyssal_singularity",
    name: "Abyssal Singularity",
    icon: "🌌",
    rarity: "mythic",
    category: "abyss",
    source: "Tower: Abyssal Obelisk (Floor 50+) or Abyss (Wave 25+)",
    desc: "A gravitational anomaly captured from the deepest floor of the Abyssal Obelisk.",
    baseStats: { skillPower: 6, pierce: 6 },
    statSummary: "+6% Skill Power & +6% Pierce",
  },

  // ── Endgame Apex Relic ────────────────────────────────────────────────
  {
    id: "genesis_core",
    name: "Genesis-Terminus Core",
    icon: "⚡",
    rarity: "unique",
    category: "apex",
    source: "Tower Floor 100 Gatebreaker or Realm Boss Raid",
    desc: "The ultimate cosmic engine that anchors the material realm together against the creeping void.",
    baseStats: { hpPct: 8, atkPct: 8, defPct: 8, bossDamage: 10 },
    statSummary: "+8% All Stats & +10% Boss DMG",
  },
];

export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(
  RELICS.map((r) => [r.id, r]),
);

export const RELIC_BY_CHAPTER: Record<number, RelicDef> = Object.fromEntries(
  RELICS.filter((r) => r.chapter !== undefined).map((r) => [r.chapter!, r]),
);

export const MAX_CONSECRATION_RANK = 5;

export const CONSECRATION_MULTS: Record<number, number> = {
  1: 1.0,
  2: 1.3,
  3: 1.6,
  4: 2.0,
  5: 2.5,
};

export const CONSECRATION_COSTS: Record<number, { coins: number; material: string; materialName: string; materialQty: number }> = {
  2: { coins: 15_000, material: "iron_ore", materialName: "Iron Ore", materialQty: 5 },
  3: { coins: 40_000, material: "dragon_scales", materialName: "Dragon Scales", materialQty: 5 },
  4: { coins: 100_000, material: "mystic_gem", materialName: "Mystic Gem", materialQty: 5 },
  5: { coins: 250_000, material: "star_essence", materialName: "Star Essence", materialQty: 5 },
};

export function computeRelicResonanceBonuses(relics: Record<string, number> = {}): RelicStats {
  const totals: RelicStats = {};
  for (const [id, rank] of Object.entries(relics)) {
    if (typeof rank !== "number" || rank <= 0) continue;
    const def = RELIC_BY_ID[id];
    if (!def) continue;
    const clampedRank = Math.min(MAX_CONSECRATION_RANK, Math.max(1, rank));
    const mult = CONSECRATION_MULTS[clampedRank] ?? 1.0;

    for (const [k, v] of Object.entries(def.baseStats) as [keyof RelicStats, number][]) {
      if (typeof v !== "number") continue;
      const scaled = Math.round(v * mult * 10) / 10;
      totals[k] = Math.round(((totals[k] ?? 0) + scaled) * 10) / 10;
    }
  }
  return totals;
}
