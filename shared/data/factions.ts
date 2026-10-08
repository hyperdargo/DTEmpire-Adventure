export type FactionId = "iron_vanguard" | "shadow_syndicate" | "celestial_arcanum";

export interface FactionDef {
  id: FactionId;
  name: string;
  banner: string;
  motto: string;
  desc: string;
  perks: string[];
  title: string;
  bonuses: {
    atkPct?: number;
    defPct?: number;
    hpPct?: number;
    crit?: number;
    coinPct?: number;
    xpPct?: number;
  };
}

export interface FactionRank {
  rank: number;
  title: string;
  repRequired: number;
  multiplier: number;
}

export const FACTIONS: FactionDef[] = [
  {
    id: "iron_vanguard",
    name: "The Iron Vanguard",
    banner: "🛡️",
    motto: "Unyielding Bastion of the Realm",
    desc: "An ancient order of disciplined knights and bastion sentinels who defend civilization. Their martial discipline bestows reinforced defense and ironclad vitality.",
    perks: [
      "+10% Defense and +10% Max HP (scales with rank)",
      "Bulwark of Steel: high resilience in combat",
      "Bonus reputation from Dungeon conquests and World Boss strikes",
    ],
    title: "🛡️ Vanguard Ironclad",
    bonuses: { defPct: 10, hpPct: 10 },
  },
  {
    id: "shadow_syndicate",
    name: "The Shadow Syndicate",
    banner: "🗡️",
    motto: "Whispers in the Dark, Riches in the Light",
    desc: "A clandestine network of rogues, bounty hunters, and underworld merchants. They exploit vital weaknesses and amass immense wealth from every skirmish.",
    perks: [
      "+10% Critical Strike Chance and +15% Battle Gold (scales with rank)",
      "Lethal Ambush: increased precision on enemy weak points",
      "Extra bounty spoils on elite and rare quarry",
    ],
    title: "🗡️ Syndicate Shadowblade",
    bonuses: { crit: 10, coinPct: 15 },
  },
  {
    id: "celestial_arcanum",
    name: "The Celestial Arcanum",
    banner: "🔮",
    motto: "Ascended Wisdom, Boundless Dominion",
    desc: "An elite conclave of astral scholars and archmages harnessing the celestial currents. Their esoteric insights empower devastating strikes and swift learning.",
    perks: [
      "+10% Attack and +20% Battle Experience (scales with rank)",
      "Astral Attunement: rapid progression and heightened spellpower",
      "Superior mystic mastery in Spire ascents",
    ],
    title: "🔮 Arcanum Archmagus",
    bonuses: { atkPct: 10, xpPct: 20 },
  },
];

export const FACTION_BY_ID: Record<string, FactionDef> = Object.fromEntries(
  FACTIONS.map((f) => [f.id, f]),
);

export const FACTION_RANKS: FactionRank[] = [
  { rank: 1, title: "Initiate", repRequired: 0, multiplier: 1.0 },
  { rank: 2, title: "Veteran", repRequired: 500, multiplier: 1.25 },
  { rank: 3, title: "Champion", repRequired: 2_500, multiplier: 1.5 },
  { rank: 4, title: "High Commander", repRequired: 10_000, multiplier: 1.75 },
  { rank: 5, title: "Sovereign", repRequired: 30_000, multiplier: 2.0 },
];

export const FACTION_MIN_LEVEL = 10;
export const FACTION_TRIBUTE_COST = 5_000;
export const FACTION_TRIBUTE_REP = 300;
export const FACTION_TRIBUTE_XP = 500;
export const FACTION_SWITCH_COST = 25_000;

export function getFactionRank(rep: number): FactionRank {
  for (let i = FACTION_RANKS.length - 1; i >= 0; i--) {
    const r = FACTION_RANKS[i]!;
    if (rep >= r.repRequired) return r;
  }
  return FACTION_RANKS[0]!;
}

export function getNextFactionRank(rep: number): FactionRank | null {
  for (const r of FACTION_RANKS) {
    if (rep < r.repRequired) return r;
  }
  return null;
}

export function computeFactionBonuses(
  factionId?: string | null,
  rep = 0,
): { atkPct: number; defPct: number; hpPct: number; crit: number; coinPct: number; xpPct: number } {
  const result = { atkPct: 0, defPct: 0, hpPct: 0, crit: 0, coinPct: 0, xpPct: 0 };
  if (!factionId) return result;
  const def = FACTION_BY_ID[factionId];
  if (!def) return result;

  const rank = getFactionRank(rep);
  const m = rank.multiplier;

  if (def.bonuses.atkPct) result.atkPct = Math.round(def.bonuses.atkPct * m);
  if (def.bonuses.defPct) result.defPct = Math.round(def.bonuses.defPct * m);
  if (def.bonuses.hpPct) result.hpPct = Math.round(def.bonuses.hpPct * m);
  if (def.bonuses.crit) result.crit = Math.round(def.bonuses.crit * m);
  if (def.bonuses.coinPct) result.coinPct = Math.round(def.bonuses.coinPct * m);
  if (def.bonuses.xpPct) result.xpPct = Math.round(def.bonuses.xpPct * m);

  return result;
}
