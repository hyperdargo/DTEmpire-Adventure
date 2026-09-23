import type { MonsterShape } from "../rules/monsters.ts";

export const ABYSS_MIN_LEVEL = 15;
export const ABYSS_CORRUPTION_EVERY = 3;
export const ABYSS_BOON_EVERY = 5;

export interface AbyssFoeDef {
  id: string;
  name: string;
  icon: string;
  shape: MonsterShape;
}

export const ABYSS_FOES: AbyssFoeDef[] = [
  { id: "void_crawler", name: "Void Crawler", icon: "🕷️", shape: { hp: 0.9, atk: 1.1, def: 0.9 } },
  { id: "nether_hound", name: "Nether Hound", icon: "🐕‍🦺", shape: { hp: 1.0, atk: 1.25, def: 0.95 } },
  { id: "abyssal_lurker", name: "Abyssal Lurker", icon: "🦑", shape: { hp: 1.1, atk: 1.15, def: 1.1 } },
  { id: "null_stalker", name: "Null Stalker", icon: "👤", shape: { hp: 1.15, atk: 1.3, def: 1.05 } },
  { id: "void_golem", name: "Void Infused Golem", icon: "🗿", shape: { hp: 1.45, atk: 1.05, def: 1.4 } },
  { id: "oblivion_drake", name: "Oblivion Drake", icon: "🐉", shape: { hp: 1.25, atk: 1.35, def: 1.15 } },
  { id: "void_monarch", name: "Xal'Atoth The Void Monarch", icon: "👑", shape: { hp: 1.2, atk: 1.25, def: 1.2 } },
];

export interface AbyssBoonDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

export const ABYSS_BOONS: AbyssBoonDef[] = [
  { id: "void_siphon", name: "Void Siphon", icon: "🩸", desc: "+12% lifesteal for this dive" },
  { id: "null_barrier", name: "Null Barrier", icon: "🛡️", desc: "+15% defense and +100 max shield" },
  { id: "oblivion_strike", name: "Oblivion Strike", icon: "🗡️", desc: "+10% critical rate and +30% critical damage" },
  { id: "aether_flow", name: "Aether Flow", icon: "✨", desc: "Restore 50% HP immediately" },
  { id: "dark_pact", name: "Dark Pact", icon: "📜", desc: "+25% attack, but take 8% more damage" },
  { id: "void_greed", name: "Abyssal Greed", icon: "🔮", desc: "+40% Abyssal Shards gained per wave" },
  { id: "fleet_void", name: "Trench Swiftness", icon: "💨", desc: "+20% speed for this dive" },
  { id: "deep_scholar", name: "Forbidden Insight", icon: "🕯️", desc: "+35% XP gained from wave foes" },
];

export const ABYSS_BOON_BY_ID = Object.fromEntries(ABYSS_BOONS.map((b) => [b.id, b]));

export interface AbyssShopEntry {
  id: string;
  ref: string;
  name: string;
  icon: string;
  kind: "gear" | "stack" | "title";
  price: number;
  minWave: number;
  desc: string;
}

export const ABYSS_SHOP: AbyssShopEntry[] = [
  { id: "void_blade", ref: "void_blade", name: "Void Edge", icon: "🌌", kind: "gear", price: 250, minWave: 15, desc: "Forged from condensed void matter. Level 15+ weapon." },
  { id: "null_aegis", ref: "null_aegis", name: "Null Aegis", icon: "🛡️", kind: "gear", price: 250, minWave: 15, desc: "Absorbs blows into nothingness. Level 15+ armor." },
  { id: "abyssal_cowl", ref: "abyssal_cowl", name: "Abyssal Cowl", icon: "👁️", kind: "gear", price: 200, minWave: 15, desc: "Gaze into oblivion unharmed. Level 15+ helmet." },
  { id: "abyss_egg", ref: "abyss_egg", name: "Voidbound Pet Egg", icon: "🌌", kind: "stack", price: 120, minWave: 10, desc: "Hatches an epic void creature." },
  { id: "void_reforger", ref: "void_reforger", name: "Void Reforger", icon: "🧿", kind: "stack", price: 80, minWave: 5, desc: "Rerolls the magical affixes on an equipped item." },
  { id: "title_abyss_walker", ref: "🌀 Abyss Walker", name: "Abyss Walker", icon: "📜", kind: "title", price: 150, minWave: 20, desc: "Wear the title of those who braved wave 20+." },
  { id: "title_void_sovereign", ref: "👑 Void Sovereign", name: "Void Sovereign", icon: "📜", kind: "title", price: 450, minWave: 50, desc: "Wear the title of the true master of the Abyss (wave 50+)." },
];

export const ABYSS_SHOP_BY_ID = Object.fromEntries(ABYSS_SHOP.map((s) => [s.id, s]));

/** Computes enemy level for a wave (waves scale smoothly up to 100). */
export function abyssWaveLevel(wave: number): number {
  return Math.min(100, Math.round(15 + wave * 0.85));
}
