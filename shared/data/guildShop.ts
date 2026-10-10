import type { Rarity } from "./types.ts";

export interface GuildShopItemDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  kind: "gear" | "stack";
  templateId: string;
  slot?: "weapon" | "armor" | "accessory";
  rarity?: Rarity;
  ilvl?: number;
  minGuildLevel: number;
  costCoins: number;
  costContribution: number;
  rewardContribution: number;
}

export const GUILD_SHOP_ITEMS: GuildShopItemDef[] = [
  {
    id: "guild_banner",
    name: "Guild Battle Standard",
    icon: "🚩",
    desc: "A glorious clan war banner. Rallies combat focus, restores 20% HP, and grants 20% XP.",
    kind: "stack",
    templateId: "guild_banner",
    minGuildLevel: 1,
    costCoins: 4_500,
    costContribution: 0,
    rewardContribution: 45,
  },
  {
    id: "guild_elixir",
    name: "Draught of Brotherhood",
    icon: "🧪",
    desc: "A rejuvenating elixir brewed in the clan alchemy lab. Restores 100% HP and bestows 35% XP.",
    kind: "stack",
    templateId: "guild_elixir",
    minGuildLevel: 2,
    costCoins: 8_000,
    costContribution: 50,
    rewardContribution: 80,
  },
  {
    id: "guild_griffin_egg",
    name: "Guild Griffin Egg",
    icon: "🦅",
    desc: "A noble griffin egg infused with the clan's legacy. Hatches an epic or legendary griffin companion.",
    kind: "stack",
    templateId: "guild_griffin_egg",
    minGuildLevel: 4,
    costCoins: 50_000,
    costContribution: 200,
    rewardContribution: 250,
  },
  {
    id: "guild_vanguard_blade",
    name: "Guild Vanguard Blade",
    icon: "⚔️",
    desc: "Heavy oathbound greatsword tempered in the guild War Forge. High base attack with critical strike bonus.",
    kind: "gear",
    templateId: "guild_vanguard_blade",
    slot: "weapon",
    rarity: "epic",
    ilvl: 45,
    minGuildLevel: 5,
    costCoins: 85_000,
    costContribution: 400,
    rewardContribution: 500,
  },
  {
    id: "guild_guardian_plate",
    name: "Guild Guardian Plate",
    icon: "🛡️",
    desc: "Fortified citadel armor bearing clan crests. Grants massive defense and damage mitigation.",
    kind: "gear",
    templateId: "guild_guardian_plate",
    slot: "armor",
    rarity: "legendary",
    ilvl: 65,
    minGuildLevel: 7,
    costCoins: 160_000,
    costContribution: 800,
    rewardContribution: 1_000,
  },
  {
    id: "guild_sovereign_crest",
    name: "Guild Sovereign Relic",
    icon: "⚜️",
    desc: "The ultimate emblem of clan leadership and supremacy. Bestows unmatched all-stat resonance.",
    kind: "gear",
    templateId: "guild_sovereign_crest",
    slot: "accessory",
    rarity: "mythic",
    ilvl: 90,
    minGuildLevel: 10,
    costCoins: 400_000,
    costContribution: 2_000,
    rewardContribution: 2_500,
  },
];

export const GUILD_SHOP_BY_ID: Record<string, GuildShopItemDef> = Object.fromEntries(
  GUILD_SHOP_ITEMS.map((item) => [item.id, item])
);
