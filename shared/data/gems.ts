import type { ConsumableTemplate, StatKey } from "./types.ts";

export const GEM_FAMILIES = [
  { id: "ruby", name: "Ruby", stat: "atk", values: [8, 20, 48, 112] },
  { id: "sapphire", name: "Sapphire", stat: "def", values: [6, 15, 36, 84] },
  { id: "emerald", name: "Emerald", stat: "hp", values: [40, 100, 240, 560] },
  { id: "topaz", name: "Topaz", stat: "spd", values: [2, 5, 12, 28] },
  { id: "diamond", name: "Diamond", stat: "crit", values: [1, 2, 4, 8] },
  { id: "onyx", name: "Onyx", stat: "critDmg", values: [3, 7, 16, 36] },
] as const;
export const GEM_TIERS = ["Chipped", "Polished", "Brilliant", "Pristine"] as const;
export interface GemDef { id: string; name: string; family: string; tier: number; stat: StatKey; value: number; craftCoins: number }
export const GEMS: GemDef[] = GEM_FAMILIES.flatMap((f) => GEM_TIERS.map((tier, i) => ({
  id: `gem_${f.id}_${i + 1}`, name: `${tier} ${f.name}`, family: f.id, tier: i + 1,
  stat: f.stat, value: f.values[i]!, craftCoins: [500, 2000, 8000, 0][i]!,
})));
export const GEM_BY_ID: Record<string, GemDef> = Object.fromEntries(GEMS.map((g) => [g.id, g]));
export const GEM_CONSUMABLES: ConsumableTemplate[] = GEMS.map((g) => ({
  id: g.id, name: g.name, icon: "◇", kind: "material", levelReq: 1,
  desc: `Socket into gear for +${g.value} ${g.stat}. Combine 3 of the same tier at the Jeweler.`, basePrice: 0, sellPrice: 25 * 3 ** (g.tier - 1),
}));
export const PUNCH_COST = { coins: 1500, materials: { iron_ore: 10, mystic_gem: 1 } };
export const UNSOCKET_COINS = 1000;
export const MAX_SOCKETS = 2;
