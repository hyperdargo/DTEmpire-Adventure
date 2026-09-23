export interface EstateHouseDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  price: number;
  sellPrice: number;
  rooms: number;
  minLevel: number;
  stats: {
    hpPct?: number;
    atkPct?: number;
    defPct?: number;
    xpPct?: number;
    coinPct?: number;
    crit?: number;
    luck?: number;
  };
}

export interface EstatePetHouseDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  price: number;
  sellPrice: number;
  stats: {
    petPowerPct?: number;
    petXpPct?: number;
    eggDropBonus?: number;
  };
}

export interface EstateObjectDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  price: number;
  sellPrice: number;
  stats: {
    flatHp?: number;
    flatAtk?: number;
    flatDef?: number;
    hpPct?: number;
    atkPct?: number;
    defPct?: number;
    xpPct?: number;
    coinPct?: number;
    regenPct?: number;
    potionPct?: number;
    crit?: number;
    luck?: number;
    bossDamage?: number;
    skillPower?: number;
  };
}

export const ESTATE_HOUSES: EstateHouseDef[] = [
  {
    id: "woodland_cabin",
    name: "Woodland Cabin",
    icon: "🏡",
    desc: "A rustic timber cottage nestled near the edge of the Whispering Woods. Modest but warm.",
    price: 25_000,
    sellPrice: 18_750,
    rooms: 3,
    minLevel: 5,
    stats: { hpPct: 2, atkPct: 2 },
  },
  {
    id: "stone_homestead",
    name: "Stone Homestead",
    icon: "🏠",
    desc: "A reinforced granite residence built on the outskirts of Sunken Quarry. Sturdy against raids.",
    price: 75_000,
    sellPrice: 56_250,
    rooms: 5,
    minLevel: 15,
    stats: { hpPct: 4, atkPct: 4, defPct: 3 },
  },
  {
    id: "river_manor",
    name: "River Manor",
    icon: "🏰",
    desc: "An elegant manor overlooking the crystal riverbanks. Includes a private courtyard.",
    price: 200_000,
    sellPrice: 150_000,
    rooms: 7,
    minLevel: 25,
    stats: { hpPct: 7, atkPct: 7, defPct: 6, xpPct: 3 },
  },
  {
    id: "grand_estate",
    name: "Grand Estate",
    icon: "🏛️",
    desc: "A sprawling aristocratic estate with stone pillars, vaulted halls, and manicured grounds.",
    price: 500_000,
    sellPrice: 375_000,
    rooms: 10,
    minLevel: 40,
    stats: { hpPct: 10, atkPct: 10, defPct: 10, xpPct: 6, coinPct: 5 },
  },
  {
    id: "arcane_sanctum",
    name: "Arcane Sanctum",
    icon: "🔮",
    desc: "A towering spire charged with latent aether crystals. Shimmers with ancient wards.",
    price: 1_250_000,
    sellPrice: 937_500,
    rooms: 14,
    minLevel: 55,
    stats: { hpPct: 15, atkPct: 15, defPct: 14, xpPct: 10, coinPct: 10, crit: 5 },
  },
  {
    id: "celestial_citadel",
    name: "Celestial Citadel",
    icon: "👑",
    desc: "The pinnacle of imperial prestige. A fortress carved from starstone floating above the clouds.",
    price: 3_000_000,
    sellPrice: 2_250_000,
    rooms: 20,
    minLevel: 70,
    stats: { hpPct: 22, atkPct: 22, defPct: 20, xpPct: 15, coinPct: 15, crit: 10, luck: 10 },
  },
];

export const ESTATE_PET_HOUSES: EstatePetHouseDef[] = [
  {
    id: "cozy_kennel",
    name: "Cozy Kennel",
    icon: "🐾",
    desc: "A warm straw and cedar shelter where your companion pets rest peacefully.",
    price: 15_000,
    sellPrice: 11_250,
    stats: { petPowerPct: 5, petXpPct: 15 },
  },
  {
    id: "floral_garden",
    name: "Floral Pet Garden",
    icon: "🌺",
    desc: "A blooming courtyard planted with moonlilies and sunberries. Pets frolic happily.",
    price: 60_000,
    sellPrice: 45_000,
    stats: { petPowerPct: 12, petXpPct: 30 },
  },
  {
    id: "beast_sanctuary",
    name: "Beast Sanctuary",
    icon: "🦁",
    desc: "A sanctuary with enchanted streams and elemental perches for fearsome familiars.",
    price: 180_000,
    sellPrice: 135_000,
    stats: { petPowerPct: 22, petXpPct: 55, eggDropBonus: 5 },
  },
  {
    id: "mythic_menagerie",
    name: "Mythic Menagerie",
    icon: "🐉",
    desc: "A palatial habitat imbued with dragon fire and celestial auras. Befits legendary beasts.",
    price: 500_000,
    sellPrice: 375_000,
    stats: { petPowerPct: 35, petXpPct: 80, eggDropBonus: 10 },
  },
];

export const ESTATE_OBJECTS: EstateObjectDef[] = [
  {
    id: "training_dummy",
    name: "Ironwood Training Dummy",
    icon: "🎯",
    desc: "Carved from enchanted ironwood to hone combat reflexes daily.",
    price: 10_000,
    sellPrice: 7_500,
    stats: { flatAtk: 20, atkPct: 2 },
  },
  {
    id: "guardian_aegis",
    name: "Guardian Shield Rack",
    icon: "🛡️",
    desc: "Houses ceremonial shields that resonate with defensive ward energy.",
    price: 12_000,
    sellPrice: 9_000,
    stats: { flatDef: 20, defPct: 2 },
  },
  {
    id: "feather_hearth",
    name: "Feather Bed & Hearth",
    icon: "🛏️",
    desc: "A blazing fireplace and goose-down bed ensuring deep, restorative sleep.",
    price: 15_000,
    sellPrice: 11_250,
    stats: { flatHp: 150, regenPct: 5 },
  },
  {
    id: "alchemist_alembic",
    name: "Alchemist's Alembic",
    icon: "🧪",
    desc: "Distills and purifies potions, boosting their healing potency by 25%.",
    price: 25_000,
    sellPrice: 18_750,
    stats: { potionPct: 25 },
  },
  {
    id: "enchanted_bookshelf",
    name: "Enchanted Bookshelf",
    icon: "📚",
    desc: "Bound grimoires that impart tactical lore and battle wisdom.",
    price: 35_000,
    sellPrice: 26_250,
    stats: { xpPct: 4 },
  },
  {
    id: "gilded_vault",
    name: "Gilded Coin Vault",
    icon: "💰",
    desc: "An ornate chest with magical seals that magnetizes wealth.",
    price: 50_000,
    sellPrice: 37_500,
    stats: { coinPct: 5 },
  },
  {
    id: "astral_telescope",
    name: "Astral Stargazer",
    icon: "🔭",
    desc: "Aligns your strikes with celestial constellations for deadly precision.",
    price: 80_000,
    sellPrice: 60_000,
    stats: { crit: 3, luck: 3 },
  },
  {
    id: "war_table",
    name: "Command War Table",
    icon: "🗺️",
    desc: "Miniature battle maps and scouting reports for striking down fearsome bosses.",
    price: 120_000,
    sellPrice: 90_000,
    stats: { flatAtk: 40, flatDef: 40, bossDamage: 5 },
  },
  {
    id: "aether_fountain",
    name: "Aether Mana Fountain",
    icon: "⛲",
    desc: "A cascading fountain of raw magical essence invigorating physical and mental power.",
    price: 200_000,
    sellPrice: 150_000,
    stats: { flatHp: 250, skillPower: 5 },
  },
  {
    id: "throne_of_dominion",
    name: "Throne of Dominion",
    icon: "🪑",
    desc: "The sovereign seat of conquerors. Radiates sheer authority and all-around might.",
    price: 500_000,
    sellPrice: 375_000,
    stats: { flatAtk: 100, flatDef: 100, flatHp: 500, atkPct: 4, defPct: 4, hpPct: 4 },
  },
];

export const HOUSE_BY_ID = Object.fromEntries(ESTATE_HOUSES.map((h) => [h.id, h]));
export const PET_HOUSE_BY_ID = Object.fromEntries(ESTATE_PET_HOUSES.map((p) => [p.id, p]));
export const ESTATE_OBJECT_BY_ID = Object.fromEntries(ESTATE_OBJECTS.map((o) => [o.id, o]));

export interface PlayerEstateState {
  houseId?: string | null;
  petHouseId?: string | null;
  objects?: string[];
  lastCollectedDay?: string;
}

export interface EstateTotalStats {
  flatHp: number;
  flatAtk: number;
  flatDef: number;
  hpPct: number;
  atkPct: number;
  defPct: number;
  xpPct: number;
  coinPct: number;
  regenPct: number;
  potionPct: number;
  crit: number;
  luck: number;
  bossDamage: number;
  skillPower: number;
  petPowerPct: number;
  petXpPct: number;
  eggDropBonus: number;
  roomCapacity: number;
  roomsUsed: number;
}

export type EstateStats = EstateTotalStats;

export function computeEstateStats(estate?: PlayerEstateState | null): EstateTotalStats {
  const total: EstateTotalStats = {
    flatHp: 0,
    flatAtk: 0,
    flatDef: 0,
    hpPct: 0,
    atkPct: 0,
    defPct: 0,
    xpPct: 0,
    coinPct: 0,
    regenPct: 0,
    potionPct: 0,
    crit: 0,
    luck: 0,
    bossDamage: 0,
    skillPower: 0,
    petPowerPct: 0,
    petXpPct: 0,
    eggDropBonus: 0,
    roomCapacity: 0,
    roomsUsed: estate?.objects?.length ?? 0,
  };

  if (!estate) return total;

  if (estate.houseId) {
    const h = HOUSE_BY_ID[estate.houseId];
    if (h) {
      total.roomCapacity = h.rooms;
      if (h.stats.hpPct) total.hpPct += h.stats.hpPct;
      if (h.stats.atkPct) total.atkPct += h.stats.atkPct;
      if (h.stats.defPct) total.defPct += h.stats.defPct;
      if (h.stats.xpPct) total.xpPct += h.stats.xpPct;
      if (h.stats.coinPct) total.coinPct += h.stats.coinPct;
      if (h.stats.crit) total.crit += h.stats.crit;
      if (h.stats.luck) total.luck += h.stats.luck;
    }
  }

  if (estate.petHouseId) {
    const p = PET_HOUSE_BY_ID[estate.petHouseId];
    if (p) {
      if (p.stats.petPowerPct) total.petPowerPct += p.stats.petPowerPct;
      if (p.stats.petXpPct) total.petXpPct += p.stats.petXpPct;
      if (p.stats.eggDropBonus) total.eggDropBonus += p.stats.eggDropBonus;
    }
  }

  for (const objId of estate.objects ?? []) {
    const obj = ESTATE_OBJECT_BY_ID[objId];
    if (!obj) continue;
    const s = obj.stats;
    if (s.flatHp) total.flatHp += s.flatHp;
    if (s.flatAtk) total.flatAtk += s.flatAtk;
    if (s.flatDef) total.flatDef += s.flatDef;
    if (s.hpPct) total.hpPct += s.hpPct;
    if (s.atkPct) total.atkPct += s.atkPct;
    if (s.defPct) total.defPct += s.defPct;
    if (s.xpPct) total.xpPct += s.xpPct;
    if (s.coinPct) total.coinPct += s.coinPct;
    if (s.regenPct) total.regenPct += s.regenPct;
    if (s.potionPct) total.potionPct += s.potionPct;
    if (s.crit) total.crit += s.crit;
    if (s.luck) total.luck += s.luck;
    if (s.bossDamage) total.bossDamage += s.bossDamage;
    if (s.skillPower) total.skillPower += s.skillPower;
  }

  return total;
}
