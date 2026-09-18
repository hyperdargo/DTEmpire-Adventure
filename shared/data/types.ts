// Shared type vocabulary for game content and rules. No runtime code.

export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "unique"] as const;
export type Rarity = (typeof RARITIES)[number];

export type StatKey = "hp" | "atk" | "def" | "spd" | "crit" | "critDmg" | "dodge" | "lifesteal" | "luck" | "xpBonus";
export type StatBlock = Partial<Record<StatKey, number>>;

// ── Converted source content (see content.ts) ─────────────────────────
export interface MonsterSource { id: string; name: string; icon: string; hp: number; atk: number; def: number }
export interface RegionDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  monsters: MonsterSource[];
  boss: MonsterSource;
}
export interface StoryChapterDef {
  chapter: number;
  title: string;
  subtitle: string;
  text: string;
  enemies: string;
  boss: { name: string; emoji: string; line: string };
  lore: string;
  skills: string[];
  relic: { name: string; rarity: string; chance: number };
}
export interface DungeonBand { from: number; to: number; enemies: { icon: string; name: string }[] }
export interface ItemTemplateSource { id: string; name: string; icon: string; desc: string; heal?: number; xp_boost?: number }

// ── Classes, skills ──────────────────────────────────────────────────
export type WeaponType = "sword" | "staff" | "bow" | "dagger" | "hammer";
export type Archetype = "vanguard" | "arcanist" | "marksman" | "rogue";

export interface ClassDef {
  id: string;
  name: string;
  icon: string;
  rarity: Rarity;
  archetype: Archetype;
  base: { hp: number; atk: number; def: number; spd: number };
  weapon: WeaponType;
  passive: { name: string; desc: string; effect: PassiveEffect };
}

export type PassiveEffect =
  | { kind: "stat_pct"; stats: Partial<Record<"hp" | "atk" | "def" | "spd", number>> }
  | { kind: "crit"; chance: number; dmg: number }
  | { kind: "dodge"; chance: number }
  | { kind: "skill_power"; pct: number }
  | { kind: "boss_damage"; pct: number }
  | { kind: "regen"; pctPerTurn: number }
  | { kind: "lifesteal"; pct: number }
  | { kind: "first_strike"; spdPct: number }
  | { kind: "low_hp_rage"; pct: number }
  | { kind: "pet_power"; pct: number }
  | { kind: "armor_pierce"; pct: number }
  | { kind: "cooldown"; turns: number }
  | { kind: "all_stats"; pct: number };

export type SkillEffect =
  | { kind: "damage"; mult: number; hits?: number; critBonus?: number; pierce?: number }
  | { kind: "drain"; mult: number; healPct: number }
  | { kind: "heal"; pct: number }
  | { kind: "shield"; pct: number }
  | { kind: "buff"; stat: "atk" | "def" | "dodge"; pct: number; turns: number; selfDefPenalty?: number; guard?: boolean }
  | { kind: "burn"; mult: number; dotPct: number; turns: number }
  | { kind: "stun"; mult: number; chance: number };

export interface SkillDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cooldown: number;
  effect: SkillEffect;
  levelReq: number;
  price: number;
}

// ── Items ────────────────────────────────────────────────────────────
export type EquipSlot = "weapon" | "armor" | "helmet" | "boots" | "accessory";
export type ItemKind = EquipSlot | "potion" | "material" | "egg" | "book";

export interface GearTemplate {
  id: string;
  name: string;
  icon: string;
  slot: EquipSlot;
  levelReq: number;
  weaponType?: WeaponType;
  desc: string;
  /** Stat weights relative to the slot budget. */
  focus?: StatBlock;
  /** Only obtainable from a seasonal event: never dropped, never stocked by the market. */
  eventOnly?: boolean;
}

export interface ConsumableTemplate {
  id: string;
  name: string;
  icon: string;
  kind: "potion" | "material" | "egg" | "book";
  desc: string;
  levelReq: number;
  /** Potions: fraction of max HP restored (1 = full). */
  healPct?: number;
  /** Potions: fraction of current level XP requirement granted. */
  xpPct?: number;
  /** Eggs: rarity hatched (or "mystery"). */
  eggRarity?: Rarity | "mystery" | "golden";
  basePrice: number;
  sellPrice: number;
  /** Only obtainable from a seasonal event: never dropped, never stocked by the market. */
  eventOnly?: boolean;
}

export interface Affix { stat: StatKey; value: number }

/** An owned item as the client sees it. */
export interface ItemView {
  id: number;
  templateId: string;
  name: string;
  icon: string;
  kind: ItemKind;
  rarity: Rarity;
  ilvl: number;
  upgrade: number;
  qty: number;
  stats: StatBlock;
  affixes: Affix[];
  equipped: boolean;
  locked: boolean;
  weaponType?: WeaponType;
  levelReq: number;
  power: number;
  sellPrice: number;
  desc: string;
}

// ── Pets ─────────────────────────────────────────────────────────────
export interface PetSpecies { id: string; name: string; icon: string; rarity: Rarity; focus: "atk" | "def" | "hp" | "balanced"; ability: "strike" | "mend" | "ward" }

export interface PetView {
  id: number;
  speciesId: string;
  name: string;
  icon: string;
  rarity: Rarity;
  level: number;
  maxLevel: number;
  xp: number;
  xpToNext: number;
  bonus: StatBlock;
  power: number;
  ability: PetSpecies["ability"];
  active: boolean;
}

// ── Combat ───────────────────────────────────────────────────────────
export type EffectKind = "atk_up" | "def_up" | "dodge_up" | "def_down" | "burn" | "stun" | "shield" | "guard";
export interface StatusEffect { kind: EffectKind; turns: number; value: number }

export interface Combatant {
  name: string;
  icon: string;
  level: number;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  crit: number;
  critDmg: number;
  dodge: number;
  lifesteal: number;
  skillPower: number;
  pierce: number;
  regenPct: number;
  bossDamage: number;
  rage: number;
  cooldownReduction: number;
  effects: StatusEffect[];
  skills: { id: string; rank: number; cd: number }[];
  isBoss?: boolean;
  /** Boss pattern: every N turns the boss telegraphs, then unleashes. */
  heavyEvery?: number;
  charging?: boolean;
  classId?: string;
}

export interface PetCombatant { name: string; icon: string; power: number; ability: PetSpecies["ability"]; every: number }

export type BattleAction =
  | { type: "attack" }
  | { type: "skill"; skillId: string }
  | { type: "guard" }
  | { type: "item"; itemId: number }
  | { type: "flee" };

export type BattleActor = "player" | "enemy" | "pet";

export type BattleEvent =
  | { t: "turn"; n: number }
  | { t: "action"; by: BattleActor; label: string; icon?: string }
  | { t: "hit"; by: BattleActor; target: BattleActor; dmg: number; crit: boolean; absorbed?: number }
  | { t: "miss"; by: BattleActor; target: BattleActor }
  | { t: "heal"; target: BattleActor; amount: number; source: string }
  | { t: "effect"; target: BattleActor; kind: EffectKind; turns: number }
  | { t: "dot"; target: BattleActor; dmg: number; kind: "burn" }
  | { t: "stunned"; target: BattleActor }
  | { t: "telegraph"; by: BattleActor; text: string }
  | { t: "flee"; ok: boolean }
  | { t: "end"; result: BattleResult };

export type BattleResult = "won" | "lost" | "fled" | "timeout";

export interface BattleState {
  seed: string;
  turn: number;
  status: "active" | BattleResult;
  player: Combatant;
  enemy: Combatant;
  pet?: PetCombatant;
  canFlee: boolean;
  maxTurns: number;
  events: BattleEvent[];
}
