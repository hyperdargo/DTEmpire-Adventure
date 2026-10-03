import type { SkillDef } from "./types.ts";

export interface SkillFusionRecipe {
  id: string;
  name: string;
  icon: string;
  description: string;
  parents: [string, string];
  minRank: number;
  cost: number;
  skill: SkillDef;
}

export const SKILL_FUSIONS: SkillFusionRecipe[] = [
  {
    id: "infernal_cleave",
    name: "Infernal Cleave",
    icon: "🔥",
    description: "Combine Power Strike & Flame Burst into an explosive flaming cleave that incinerates enemies.",
    parents: ["power_strike", "flame_burst"],
    minRank: 3,
    cost: 50_000,
    skill: {
      id: "infernal_cleave",
      name: "Infernal Cleave",
      icon: "🔥",
      cooldown: 3,
      levelReq: 25,
      price: 65_000,
      isFused: true,
      desc: "Cleave with hellfire for 250% damage (+15% crit), igniting the foe for 25% burn each turn for 3 turns.",
      effect: {
        kind: "combo",
        effects: [
          { kind: "damage", mult: 2.5, critBonus: 15 },
          { kind: "burn", mult: 0, dotPct: 25, turns: 3 },
        ],
      },
      fusionRecipe: { parents: ["power_strike", "flame_burst"], minRank: 3, cost: 50_000 },
    },
  },
  {
    id: "bastion_aegis",
    name: "Aegis of the Bastion",
    icon: "🏰",
    description: "Combine Iron Wall & Fortress to weave an impenetrable sanctuary barrier.",
    parents: ["iron_wall", "fortress"],
    minRank: 3,
    cost: 75_000,
    skill: {
      id: "bastion_aegis",
      name: "Aegis of the Bastion",
      icon: "🏰",
      cooldown: 5,
      levelReq: 30,
      price: 85_000,
      isFused: true,
      desc: "Raise a citadel bulwark worth 60% max HP, instantly guarding and increasing DEF by +100% for 2 turns.",
      effect: {
        kind: "combo",
        effects: [
          { kind: "shield", pct: 60 },
          { kind: "buff", stat: "def", pct: 100, turns: 2, guard: true },
        ],
      },
      fusionRecipe: { parents: ["iron_wall", "fortress"], minRank: 3, cost: 75_000 },
    },
  },
  {
    id: "phantom_flurry",
    name: "Phantom Flurry",
    icon: "💨",
    description: "Combine Swift Step & Shadow Strike to phase through dimensions and shred targets from the ether.",
    parents: ["swift_step", "shadow_strike"],
    minRank: 3,
    cost: 60_000,
    skill: {
      id: "phantom_flurry",
      name: "Phantom Flurry",
      icon: "💨",
      cooldown: 3,
      levelReq: 25,
      price: 70_000,
      isFused: true,
      desc: "Three blinding shadow slashes for 110% each (+35% crit), then grants +45% dodge for 2 turns.",
      effect: {
        kind: "combo",
        effects: [
          { kind: "damage", mult: 1.1, hits: 3, critBonus: 35 },
          { kind: "buff", stat: "dodge", pct: 45, turns: 2 },
        ],
      },
      fusionRecipe: { parents: ["swift_step", "shadow_strike"], minRank: 3, cost: 60_000 },
    },
  },
  {
    id: "celestial_grace",
    name: "Celestial Grace",
    icon: "✨",
    description: "Combine Meditate & Divine Shield into high-angel healing and radiance protection.",
    parents: ["meditate", "divine_shield"],
    minRank: 3,
    cost: 90_000,
    skill: {
      id: "celestial_grace",
      name: "Celestial Grace",
      icon: "✨",
      cooldown: 5,
      levelReq: 50,
      price: 110_000,
      isFused: true,
      desc: "Bathes the hero in starlight, restoring 45% max HP and erecting a holy barrier worth 45% max HP.",
      effect: {
        kind: "combo",
        effects: [
          { kind: "heal", pct: 45 },
          { kind: "shield", pct: 45 },
        ],
      },
      fusionRecipe: { parents: ["meditate", "divine_shield"], minRank: 3, cost: 90_000 },
    },
  },
  {
    id: "bloodstorm_dance",
    name: "Bloodstorm Dance",
    icon: "💃",
    description: "Combine Berserk & Blade Dance into a lethal whirlwind of crimson fury.",
    parents: ["berserk", "blade_dance"],
    minRank: 3,
    cost: 80_000,
    skill: {
      id: "bloodstorm_dance",
      name: "Bloodstorm Dance",
      icon: "💃",
      cooldown: 4,
      levelReq: 40,
      price: 95_000,
      isFused: true,
      desc: "Spins into a bloodthirsty frenzy (+65% ATK for 3 turns), carving 4 spinning slashes for 85% damage each.",
      effect: {
        kind: "combo",
        effects: [
          { kind: "buff", stat: "atk", pct: 65, turns: 3 },
          { kind: "damage", mult: 0.85, hits: 4 },
        ],
      },
      fusionRecipe: { parents: ["berserk", "blade_dance"], minRank: 3, cost: 80_000 },
    },
  },
  {
    id: "astral_cataclysm",
    name: "Astral Cataclysm",
    icon: "🌩️",
    description: "Combine Thunderclap & Mana Surge into an apocalyptic cosmic singularity.",
    parents: ["thunderclap", "mana_surge"],
    minRank: 3,
    cost: 150_000,
    skill: {
      id: "astral_cataclysm",
      name: "Astral Cataclysm",
      icon: "🌩️",
      cooldown: 5,
      levelReq: 75,
      price: 180_000,
      isFused: true,
      desc: "Unleashes a cosmic storm dealing 320% damage that pierces 50% defense with a 60% chance to stun.",
      effect: {
        kind: "combo",
        effects: [
          { kind: "damage", mult: 3.2, pierce: 50 },
          { kind: "stun", mult: 0, chance: 60 },
        ],
      },
      fusionRecipe: { parents: ["thunderclap", "mana_surge"], minRank: 3, cost: 150_000 },
    },
  },
  {
    id: "soul_rupture",
    name: "Soul Rupture",
    icon: "🩸",
    description: "Combine Life Steal & Earthshaker to rip open the earth and drain vital essence.",
    parents: ["life_steal", "earthshaker"],
    minRank: 3,
    cost: 120_000,
    skill: {
      id: "soul_rupture",
      name: "Soul Rupture",
      icon: "🩸",
      cooldown: 5,
      levelReq: 65,
      price: 140_000,
      isFused: true,
      desc: "Crushes the earth beneath the enemy for 270% damage, converting 75% of damage dealt into pure health.",
      effect: {
        kind: "drain",
        mult: 2.7,
        healPct: 75,
      },
      fusionRecipe: { parents: ["life_steal", "earthshaker"], minRank: 3, cost: 120_000 },
    },
  },
  {
    id: "supernova_ward",
    name: "Supernova Ward",
    icon: "🌟",
    description: "Combine Mana Surge & Divine Shield to blast enemies with stellar plasma and form a crystal barrier.",
    parents: ["mana_surge", "divine_shield"],
    minRank: 3,
    cost: 180_000,
    skill: {
      id: "supernova_ward",
      name: "Supernova Ward",
      icon: "🌟",
      cooldown: 6,
      levelReq: 75,
      price: 200_000,
      isFused: true,
      desc: "Releases an explosive supernova for 280% armor-piercing damage, crystallizing the shockwave into a 50% max HP ward.",
      effect: {
        kind: "combo",
        effects: [
          { kind: "damage", mult: 2.8, pierce: 60 },
          { kind: "shield", pct: 50 },
        ],
      },
      fusionRecipe: { parents: ["mana_surge", "divine_shield"], minRank: 3, cost: 180_000 },
    },
  },
  {
    id: "vampiric_shadows",
    name: "Vampiric Shadows",
    icon: "🗡️",
    description: "Combine Shadow Strike & Life Steal into rapid stealth precision draining strikes.",
    parents: ["shadow_strike", "life_steal"],
    minRank: 3,
    cost: 85_000,
    skill: {
      id: "vampiric_shadows",
      name: "Vampiric Shadows",
      icon: "🗡️",
      cooldown: 3,
      levelReq: 35,
      price: 90_000,
      isFused: true,
      desc: "Twin phantom cuts for 125% each with +30% crit, followed by an immediate 70% siphon drain.",
      effect: {
        kind: "combo",
        effects: [
          { kind: "damage", mult: 1.25, hits: 2, critBonus: 30 },
          { kind: "drain", mult: 0.8, healPct: 70 },
        ],
      },
      fusionRecipe: { parents: ["shadow_strike", "life_steal"], minRank: 3, cost: 85_000 },
    },
  },
  {
    id: "tectonic_shockwave",
    name: "Tectonic Shockwave",
    icon: "🌋",
    description: "Combine Earthshaker & Thunderclap into an earth-splitting tremor that leaves enemies dazed.",
    parents: ["earthshaker", "thunderclap"],
    minRank: 3,
    cost: 140_000,
    skill: {
      id: "tectonic_shockwave",
      name: "Tectonic Shockwave",
      icon: "🌋",
      cooldown: 5,
      levelReq: 65,
      price: 160_000,
      isFused: true,
      desc: "Shatters continental plates for 280% seismic damage with a devastating 75% stun chance.",
      effect: {
        kind: "combo",
        effects: [
          { kind: "damage", mult: 2.8 },
          { kind: "stun", mult: 0, chance: 75 },
        ],
      },
      fusionRecipe: { parents: ["earthshaker", "thunderclap"], minRank: 3, cost: 140_000 },
    },
  },
];

export const FUSED_SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(
  SKILL_FUSIONS.map((f) => [f.id, f.skill])
);

export const FUSION_RECIPE_BY_ID: Record<string, SkillFusionRecipe> = Object.fromEntries(
  SKILL_FUSIONS.map((f) => [f.id, f])
);
