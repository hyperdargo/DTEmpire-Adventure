import type { PetSpecies, Rarity } from "./types.ts";

// Species from the original pet table, each given a combat role.
export const PET_SPECIES: PetSpecies[] = [
  { id: "slime", name: "Slime", icon: "🟢", rarity: "common", focus: "hp", ability: "mend" },
  { id: "bat", name: "Bat", icon: "🦇", rarity: "common", focus: "atk", ability: "strike" },
  { id: "goblin", name: "Goblin", icon: "👺", rarity: "common", focus: "balanced", ability: "strike" },
  { id: "wolf_cub", name: "Wolf Cub", icon: "🐺", rarity: "uncommon", focus: "atk", ability: "strike" },
  { id: "cat", name: "Cat", icon: "🐱", rarity: "uncommon", focus: "balanced", ability: "ward" },
  { id: "bunny", name: "Bunny", icon: "🐰", rarity: "uncommon", focus: "hp", ability: "mend" },
  { id: "dragon", name: "Dragon", icon: "🐉", rarity: "rare", focus: "atk", ability: "strike" },
  { id: "phoenix", name: "Phoenix", icon: "🔥", rarity: "rare", focus: "hp", ability: "mend" },
  { id: "kitsune", name: "Kitsune", icon: "🦊", rarity: "rare", focus: "balanced", ability: "ward" },
  { id: "griffin", name: "Griffin", icon: "🦅", rarity: "epic", focus: "atk", ability: "strike" },
  { id: "chimera_cub", name: "Chimera Cub", icon: "🦁", rarity: "epic", focus: "balanced", ability: "strike" },
  { id: "kraken", name: "Kraken", icon: "🐙", rarity: "epic", focus: "def", ability: "ward" },
  { id: "thunder_roc", name: "Thunder Roc", icon: "⚡", rarity: "legendary", focus: "atk", ability: "strike" },
  { id: "titan_golem", name: "Titan Golem", icon: "🗿", rarity: "legendary", focus: "def", ability: "ward" },
  { id: "elder_wyrm", name: "Elder Wyrm", icon: "🐲", rarity: "legendary", focus: "balanced", ability: "strike" },
  { id: "celestial", name: "Celestial", icon: "⭐", rarity: "mythic", focus: "hp", ability: "mend" },
  { id: "void_drake", name: "Void Drake", icon: "🌑", rarity: "mythic", focus: "atk", ability: "strike" },
  { id: "god_beast", name: "God Beast", icon: "🌟", rarity: "mythic", focus: "balanced", ability: "ward" },
];

export const PET_BY_ID: Record<string, PetSpecies> = Object.fromEntries(PET_SPECIES.map((p) => [p.id, p]));

export const PET_MAX_LEVEL: Record<Rarity, number> = {
  common: 10, uncommon: 20, rare: 30, epic: 40, legendary: 50, mythic: 60, unique: 70,
};

export const MYSTERY_EGG_WEIGHTS: Partial<Record<Rarity, number>> = { common: 50, uncommon: 30, rare: 13, epic: 5, legendary: 1.7, mythic: 0.3 };
export const GOLDEN_EGG_WEIGHTS: Partial<Record<Rarity, number>> = { rare: 70, epic: 22, legendary: 7, mythic: 1 };

/** Pets needed of one rarity to fuse an egg of the next rarity. */
export const PET_FUSE_COUNT = 3;
export const PET_ABILITY_EVERY = 3;
