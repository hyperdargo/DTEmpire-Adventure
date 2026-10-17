export interface TransmutationRecipe {
  id: string;
  name: string;
  desc: string;
  icon: string;
  category: "ascend" | "descend";
  fromMaterial: string;
  fromQty: number;
  toMaterial: string;
  toQty: number;
  coins: number;
  minLevel: number;
}

export const TRANSMUTATION_RECIPES: TransmutationRecipe[] = [
  // ── Ascending Transmutations (Refining lower into higher) ──────────────────
  {
    id: "smelt_dragon_scales",
    name: "Smelt Dragon Scales",
    desc: "Refine iron ore with draconian heat into hardened dragon scales.",
    icon: "🐉",
    category: "ascend",
    fromMaterial: "iron_ore",
    fromQty: 10,
    toMaterial: "dragon_scales",
    toQty: 1,
    coins: 2_500,
    minLevel: 10,
  },
  {
    id: "weave_spectral_silk",
    name: "Weave Ethereal Silk",
    desc: "Spin ossified undead remains into durable enchanted silk threads.",
    icon: "🧵",
    category: "ascend",
    fromMaterial: "undead_bones",
    fromQty: 8,
    toMaterial: "silk_cloth",
    toQty: 2,
    coins: 3_000,
    minLevel: 15,
  },
  {
    id: "crystallize_mystic_gem",
    name: "Crystallize Mystic Gem",
    desc: "Infuse dragon scales under extreme elemental pressure into a radiant mystic gem.",
    icon: "💎",
    category: "ascend",
    fromMaterial: "dragon_scales",
    fromQty: 5,
    toMaterial: "mystic_gem",
    toQty: 1,
    coins: 10_000,
    minLevel: 25,
  },
  {
    id: "distill_star_essence",
    name: "Distill Star Essence",
    desc: "Distill celestial mana from mystic gems into concentrated star essence.",
    icon: "🌟",
    category: "ascend",
    fromMaterial: "mystic_gem",
    fromQty: 3,
    toMaterial: "star_essence",
    toQty: 1,
    coins: 35_000,
    minLevel: 45,
  },
  {
    id: "synthesize_abyss_shard",
    name: "Synthesize Abyssal Shard",
    desc: "Compress pure star essence with deep void gravity into an abyssal shard.",
    icon: "🔮",
    category: "ascend",
    fromMaterial: "star_essence",
    fromQty: 2,
    toMaterial: "abyss_shard",
    toQty: 1,
    coins: 60_000,
    minLevel: 60,
  },

  // ── Descending Deconstructions (Breaking down rare into bulk) ─────────────
  {
    id: "deconstruct_star_essence",
    name: "Dissolve Star Essence",
    desc: "Break down star essence to recover pure mystic gems.",
    icon: "💎",
    category: "descend",
    fromMaterial: "star_essence",
    fromQty: 1,
    toMaterial: "mystic_gem",
    toQty: 2,
    coins: 15_000,
    minLevel: 45,
  },
  {
    id: "deconstruct_mystic_gem",
    name: "Fracture Mystic Gem",
    desc: "Fracture a mystic gem to reclaim tempered dragon scales.",
    icon: "🐉",
    category: "descend",
    fromMaterial: "mystic_gem",
    fromQty: 1,
    toMaterial: "dragon_scales",
    toQty: 3,
    coins: 5_000,
    minLevel: 25,
  },
  {
    id: "deconstruct_dragon_scales",
    name: "Pulverize Dragon Scales",
    desc: "Pulverize dragon scales into raw iron ore for foundation smithing.",
    icon: "🪨",
    category: "descend",
    fromMaterial: "dragon_scales",
    fromQty: 1,
    toMaterial: "iron_ore",
    toQty: 5,
    coins: 1_500,
    minLevel: 10,
  },
];

export const TRANSMUTATION_BY_ID = Object.fromEntries(TRANSMUTATION_RECIPES.map((r) => [r.id, r]));
