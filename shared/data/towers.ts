export interface TowerTheme {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  description: string;
  maxFloor: number;
  levelReqBase: number;
  enemyLevelMult: number;
  hpMult: number;
  atkMult: number;
  defMult: number;
  coinMult: number;
  bonusRewardType: string;
}

export const TOWERS: TowerTheme[] = [
  {
    id: "ascension",
    name: "Tower of Ascension",
    icon: "🏰",
    tagline: "The Classic Spire",
    description: "The hundred-floor ancient monolith stretching from the Mortal Realm to the Void Gate.",
    maxFloor: 100,
    levelReqBase: 1,
    enemyLevelMult: 1.0,
    hpMult: 1.0,
    atkMult: 1.0,
    defMult: 1.0,
    coinMult: 1.0,
    bonusRewardType: "Skill Books & Mastery",
  },
  {
    id: "infernal",
    name: "Spire of Molten Torment",
    icon: "🌋",
    tagline: "Hellfire & Ash",
    description: "Forged in the underworld's mantle. Foes strike with burning wrath and drop doubled gold bounties.",
    maxFloor: 100,
    levelReqBase: 25,
    enemyLevelMult: 1.25,
    hpMult: 1.35,
    atkMult: 1.45,
    defMult: 1.15,
    coinMult: 2.2,
    bonusRewardType: "Pure Gold & Forge Shards",
  },
  {
    id: "celestial",
    name: "Celestial Astral Pillar",
    icon: "✨",
    tagline: "High-Heaven Starlight",
    description: "Ascend past the stars. Unlocks at Level 50+. Elite celestial guardians bestow massive XP multipliers.",
    maxFloor: 100,
    levelReqBase: 50,
    enemyLevelMult: 1.5,
    hpMult: 1.6,
    atkMult: 1.5,
    defMult: 1.6,
    coinMult: 2.5,
    bonusRewardType: "Astral Relics & Huge XP",
  },
  {
    id: "void",
    name: "The Abyssal Obelisk",
    icon: "🌌",
    tagline: "Level 100–200 Endgame",
    description: "A dark spire piercing the edge of reality. Only masters of the realm can withstand its reality-shattering bosses.",
    maxFloor: 100,
    levelReqBase: 100,
    enemyLevelMult: 2.0,
    hpMult: 2.2,
    atkMult: 2.1,
    defMult: 2.0,
    coinMult: 3.5,
    bonusRewardType: "Transcendent Relics & Mythic Runes",
  },
];

export const TOWER_BY_ID = Object.fromEntries(TOWERS.map((t) => [t.id, t]));
