export interface TalentStats {
  atkPct?: number;
  defPct?: number;
  hpPct?: number;
  spd?: number;
  crit?: number;
  critDmg?: number;
  dodge?: number;
  lifesteal?: number;
  luck?: number;
  xpBonus?: number;
  bossDamage?: number;
  skillPower?: number;
  pierce?: number;
  coinPct?: number;
}

export type TalentTreeId = "combat" | "sorcery" | "cunning";

export interface TalentDef {
  id: string;
  name: string;
  treeId: TalentTreeId;
  tier: 1 | 2 | 3 | 4;
  reqPoints: number;
  maxRank: number;
  icon: string;
  desc: string;
  statSummary: string;
  perRankStats: TalentStats;
  isKeystone?: boolean;
}

export interface TalentTreeDef {
  id: TalentTreeId;
  name: string;
  title: string;
  icon: string;
  desc: string;
  talents: TalentDef[];
}

export const TALENT_TREES: TalentTreeDef[] = [
  // ── Tree 1: Juggernaut (Combat Mastery) ──────────────────────────────
  {
    id: "combat",
    name: "Juggernaut",
    title: "Way of the Colossus",
    icon: "⚔️",
    desc: "Master brutal martial discipline, maximizing raw damage output, defensive fortification, and boss execution.",
    talents: [
      {
        id: "iron_skin",
        name: "Iron Skin",
        treeId: "combat",
        tier: 1,
        reqPoints: 0,
        maxRank: 5,
        icon: "🛡️",
        desc: "Harden your resolve and flesh against physical trauma.",
        statSummary: "+3% Defense per rank",
        perRankStats: { defPct: 3 },
      },
      {
        id: "keen_edge",
        name: "Keen Edge",
        treeId: "combat",
        tier: 1,
        reqPoints: 0,
        maxRank: 5,
        icon: "🗡️",
        desc: "Hone weapon mastery to deliver devastating blows.",
        statSummary: "+3% Attack per rank",
        perRankStats: { atkPct: 3 },
      },
      {
        id: "crushing_blows",
        name: "Crushing Blows",
        treeId: "combat",
        tier: 2,
        reqPoints: 5,
        maxRank: 5,
        icon: "💥",
        desc: "Amplify the impact of critical strikes.",
        statSummary: "+5% Critical Damage per rank",
        perRankStats: { critDmg: 5 },
      },
      {
        id: "colossus_might",
        name: "Colossus Vitality",
        treeId: "combat",
        tier: 2,
        reqPoints: 5,
        maxRank: 5,
        icon: "❤️",
        desc: "Infuse your core with giant's endurance and immense health.",
        statSummary: "+4% Max HP per rank",
        perRankStats: { hpPct: 4 },
      },
      {
        id: "bloodthirst",
        name: "Vampiric Thirst",
        treeId: "combat",
        tier: 3,
        reqPoints: 10,
        maxRank: 5,
        icon: "🩸",
        desc: "Drain life essence from wounded enemies with every strike.",
        statSummary: "+1.5% Lifesteal per rank",
        perRankStats: { lifesteal: 1.5 },
      },
      {
        id: "sundering_strikes",
        name: "Sundering Strikes",
        treeId: "combat",
        tier: 3,
        reqPoints: 10,
        maxRank: 5,
        icon: "🔨",
        desc: "Shatter enemy defenses and pierce heavy armor.",
        statSummary: "+3% Armor Pierce per rank",
        perRankStats: { pierce: 3 },
      },
      {
        id: "titans_wrath",
        name: "Titan's Wrath",
        treeId: "combat",
        tier: 4,
        reqPoints: 15,
        maxRank: 1,
        icon: "👑",
        desc: "Apex Keystone. Become an unstoppable war machine against towering adversaries.",
        statSummary: "+15% Boss Damage, +5% Attack, +5% Defense",
        perRankStats: { bossDamage: 15, atkPct: 5, defPct: 5 },
        isKeystone: true,
      },
    ],
  },

  // ── Tree 2: Archmage (Arcane Mastery) ────────────────────────────────
  {
    id: "sorcery",
    name: "Archmage",
    title: "Way of the Leyline",
    icon: "🔮",
    desc: "Harness primal mana currents to supercharge skill potency, battle knowledge, and temporal agility.",
    talents: [
      {
        id: "arcane_insight",
        name: "Arcane Insight",
        treeId: "sorcery",
        tier: 1,
        reqPoints: 0,
        maxRank: 5,
        icon: "📜",
        desc: "Decode ancient battle mysteries, rapidly accelerating experience growth.",
        statSummary: "+4% Battle XP per rank",
        perRankStats: { xpBonus: 4 },
      },
      {
        id: "mana_shield",
        name: "Aegis of Mana",
        treeId: "sorcery",
        tier: 1,
        reqPoints: 0,
        maxRank: 5,
        icon: "✨",
        desc: "Weave protective magical barriers bolstering health and defense.",
        statSummary: "+2.5% Defense and +2.5% Max HP per rank",
        perRankStats: { defPct: 2.5, hpPct: 2.5 },
      },
      {
        id: "spell_surge",
        name: "Spell Surge",
        treeId: "sorcery",
        tier: 2,
        reqPoints: 5,
        maxRank: 5,
        icon: "⚡",
        desc: "Channel surging ether to drastically amplify active skill power.",
        statSummary: "+6% Skill Power per rank",
        perRankStats: { skillPower: 6 },
      },
      {
        id: "temporal_flow",
        name: "Temporal Flow",
        treeId: "sorcery",
        tier: 2,
        reqPoints: 5,
        maxRank: 5,
        icon: "⏳",
        desc: "Bend the flow of time around your actions for increased battle speed.",
        statSummary: "+3 Speed per rank",
        perRankStats: { spd: 3 },
      },
      {
        id: "mystic_focus",
        name: "Mystic Focus",
        treeId: "sorcery",
        tier: 3,
        reqPoints: 10,
        maxRank: 5,
        icon: "👁️",
        desc: "Heighten mental acuity to deliver precise, lethal magical criticals.",
        statSummary: "+2% Crit Chance and +4% Crit DMG per rank",
        perRankStats: { crit: 2, critDmg: 4 },
      },
      {
        id: "leyline_tap",
        name: "Leyline Infusion",
        treeId: "sorcery",
        tier: 3,
        reqPoints: 10,
        maxRank: 5,
        icon: "🌀",
        desc: "Tap world leyline conduits to siphon power and health.",
        statSummary: "+2% Attack and +1% Lifesteal per rank",
        perRankStats: { atkPct: 2, lifesteal: 1 },
      },
      {
        id: "apotheosis",
        name: "Arcane Apotheosis",
        treeId: "sorcery",
        tier: 4,
        reqPoints: 15,
        maxRank: 1,
        icon: "🌌",
        desc: "Apex Keystone. Transmute mortality into pure radiant astral energy.",
        statSummary: "+25% Skill Power, +10% Battle XP, +5% Crit Chance",
        perRankStats: { skillPower: 25, xpBonus: 10, crit: 5 },
        isKeystone: true,
      },
    ],
  },

  // ── Tree 3: Shadowstalker (Cunning Mastery) ──────────────────────────
  {
    id: "cunning",
    name: "Shadowstalker",
    title: "Way of the Phantom",
    icon: "🗡️",
    desc: "Walk the lethal margins between reality and shadow, mastering evasion, deadly crits, and treasure hunting.",
    talents: [
      {
        id: "phantom_steps",
        name: "Phantom Steps",
        treeId: "cunning",
        tier: 1,
        reqPoints: 0,
        maxRank: 5,
        icon: "💨",
        desc: "Slip between incoming enemy blades with ghostlike agility.",
        statSummary: "+1.5% Dodge Chance per rank",
        perRankStats: { dodge: 1.5 },
      },
      {
        id: "gold_fever",
        name: "Scavenger's Greed",
        treeId: "cunning",
        tier: 1,
        reqPoints: 0,
        maxRank: 5,
        icon: "💰",
        desc: "Spot hidden vaults and purse stashes in monster lairs.",
        statSummary: "+5% Battle Gold per rank",
        perRankStats: { coinPct: 5 },
      },
      {
        id: "opportunist",
        name: "Opportunist Strike",
        treeId: "cunning",
        tier: 2,
        reqPoints: 5,
        maxRank: 5,
        icon: "🎯",
        desc: "Exploit openings in distracted enemy stances.",
        statSummary: "+3% Attack and +1.5% Crit Chance per rank",
        perRankStats: { atkPct: 3, crit: 1.5 },
      },
      {
        id: "windrunner",
        name: "Windrunner",
        treeId: "cunning",
        tier: 2,
        reqPoints: 5,
        maxRank: 5,
        icon: "👟",
        desc: "Sprint across battlefields with unmatched swiftness.",
        statSummary: "+4 Speed per rank",
        perRankStats: { spd: 4 },
      },
      {
        id: "fatal_flaw",
        name: "Lethal Precision",
        treeId: "cunning",
        tier: 3,
        reqPoints: 10,
        maxRank: 5,
        icon: "☠️",
        desc: "Pinpoint fatal vulnerabilities for devastating critical execution.",
        statSummary: "+8% Critical Damage per rank",
        perRankStats: { critDmg: 8 },
      },
      {
        id: "fortune_favor",
        name: "Fortune's Favor",
        treeId: "cunning",
        tier: 3,
        reqPoints: 10,
        maxRank: 5,
        icon: "🍀",
        desc: "Fortune smiles upon your path, boosting drop fortune.",
        statSummary: "+5 Luck per rank",
        perRankStats: { luck: 5 },
      },
      {
        id: "shadow_dance",
        name: "Shadow Dance",
        treeId: "cunning",
        tier: 4,
        reqPoints: 15,
        maxRank: 1,
        icon: "🌑",
        desc: "Apex Keystone. Dance through shadows as an elusive harbinger of lethal strikes and bounty.",
        statSummary: "+10% Crit Chance, +20% Crit DMG, +10% Dodge, +20% Gold",
        perRankStats: { crit: 10, critDmg: 20, dodge: 10, coinPct: 20 },
        isKeystone: true,
      },
    ],
  },
];

export const TALENTS_BY_ID: Record<string, TalentDef> = Object.fromEntries(
  TALENT_TREES.flatMap((t) => t.talents).map((t) => [t.id, t])
);

/** Level required to unlock the Talent Tree system. */
export const TALENT_UNLOCK_LEVEL = 10;

/** Total talent points earned based on character level (1 point per level starting at Lv 10). */
export function totalTalentPointsEarned(level: number): number {
  return Math.max(0, Math.floor(level) - (TALENT_UNLOCK_LEVEL - 1));
}

/** Total talent points invested by the player across all trees. */
export function totalTalentPointsInvested(talents: Record<string, number> = {}): number {
  let count = 0;
  for (const [id, rank] of Object.entries(talents)) {
    if (TALENTS_BY_ID[id] && typeof rank === "number" && rank > 0) {
      count += Math.min(rank, TALENTS_BY_ID[id].maxRank);
    }
  }
  return count;
}

/** Total points invested in a specific tree. */
export function talentTreePoints(treeId: TalentTreeId, talents: Record<string, number> = {}): number {
  let count = 0;
  for (const [id, rank] of Object.entries(talents)) {
    const def = TALENTS_BY_ID[id];
    if (def && def.treeId === treeId && typeof rank === "number" && rank > 0) {
      count += Math.min(rank, def.maxRank);
    }
  }
  return count;
}

/** Cost in coins to reset all talent trees. */
export function talentResetCost(level: number): number {
  return Math.max(5_000, Math.min(50_000, Math.floor(level) * 500));
}

/** Aggregate all bonuses granted by invested talent ranks. */
export function computeTalentBonuses(talents: Record<string, number> = {}): TalentStats {
  const result: TalentStats = {
    atkPct: 0,
    defPct: 0,
    hpPct: 0,
    spd: 0,
    crit: 0,
    critDmg: 0,
    dodge: 0,
    lifesteal: 0,
    luck: 0,
    xpBonus: 0,
    bossDamage: 0,
    skillPower: 0,
    pierce: 0,
    coinPct: 0,
  };

  for (const [id, rawRank] of Object.entries(talents)) {
    const def = TALENTS_BY_ID[id];
    if (!def) continue;
    const rank = Math.min(Math.max(0, Math.floor(rawRank)), def.maxRank);
    if (rank <= 0) continue;

    const stats = def.perRankStats;
    if (stats.atkPct) result.atkPct = (result.atkPct ?? 0) + stats.atkPct * rank;
    if (stats.defPct) result.defPct = (result.defPct ?? 0) + stats.defPct * rank;
    if (stats.hpPct) result.hpPct = (result.hpPct ?? 0) + stats.hpPct * rank;
    if (stats.spd) result.spd = (result.spd ?? 0) + stats.spd * rank;
    if (stats.crit) result.crit = (result.crit ?? 0) + stats.crit * rank;
    if (stats.critDmg) result.critDmg = (result.critDmg ?? 0) + stats.critDmg * rank;
    if (stats.dodge) result.dodge = (result.dodge ?? 0) + stats.dodge * rank;
    if (stats.lifesteal) result.lifesteal = (result.lifesteal ?? 0) + stats.lifesteal * rank;
    if (stats.luck) result.luck = (result.luck ?? 0) + stats.luck * rank;
    if (stats.xpBonus) result.xpBonus = (result.xpBonus ?? 0) + stats.xpBonus * rank;
    if (stats.bossDamage) result.bossDamage = (result.bossDamage ?? 0) + stats.bossDamage * rank;
    if (stats.skillPower) result.skillPower = (result.skillPower ?? 0) + stats.skillPower * rank;
    if (stats.pierce) result.pierce = (result.pierce ?? 0) + stats.pierce * rank;
    if (stats.coinPct) result.coinPct = (result.coinPct ?? 0) + stats.coinPct * rank;
  }

  return result;
}
