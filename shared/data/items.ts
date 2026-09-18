import { ARMOR_SOURCE, POTION_SOURCE, RELIC_SOURCE, WEAPON_SOURCE } from "./content.ts";
import type { ConsumableTemplate, EquipSlot, GearTemplate, Rarity, StatBlock, WeaponType } from "./types.ts";

const spread = (index: number, count: number, lo = 1, hi = 100) =>
  count <= 1 ? lo : Math.round(lo + (index * (hi - lo)) / (count - 1));

function weaponTypeOf(id: string, name: string): WeaponType {
  const s = `${id} ${name}`.toLowerCase();
  if (/staff|scepter|wand|orb|tome|rod/.test(s)) return "staff";
  if (/bow|talon|crescent/.test(s)) return "bow";
  if (/dagger|fang|reaper|katana|mirage/.test(s)) return "dagger";
  if (/hammer|trident|breaker|wrath|render/.test(s)) return "hammer";
  return "sword";
}

// ── Equipment templates ───────────────────────────────────────────────
const weapons: GearTemplate[] = WEAPON_SOURCE.map((w, i) => ({
  id: w.id, name: w.name, icon: w.icon, slot: "weapon", desc: w.desc,
  levelReq: spread(i, WEAPON_SOURCE.length),
  weaponType: weaponTypeOf(w.id, w.name),
}));

// A few bows so marksman classes have affinity weapons across the curve.
const bows: GearTemplate[] = [
  { id: "hunting_bow", name: "Hunting Bow", icon: "🏹", desc: "Ash wood and gut string.", levelReq: 1 },
  { id: "elven_longbow", name: "Elven Longbow", icon: "🏹", desc: "Sings when drawn.", levelReq: 18 },
  { id: "stormstring_bow", name: "Stormstring Bow", icon: "🌩️", desc: "Arrows crackle with static.", levelReq: 38 },
  { id: "moonshadow_bow", name: "Moonshadow Bow", icon: "🌙", desc: "Fires shafts of pale light.", levelReq: 58 },
  { id: "phoenix_recurve", name: "Phoenix Recurve", icon: "🔥", desc: "Every arrow is reborn in flame.", levelReq: 78 },
  { id: "starfall_bow", name: "Starfall Bow", icon: "⭐", desc: "Looses falling stars.", levelReq: 96 },
].map((b) => ({ ...b, slot: "weapon" as const, weaponType: "bow" as const }));

// Level-1 affinity weapons so every class starts with a weapon it knows.
const starters: GearTemplate[] = [
  { id: "apprentice_staff", name: "Apprentice Staff", icon: "🪄", desc: "Warm with borrowed magic.", levelReq: 1, slot: "weapon", weaponType: "staff" },
  { id: "rusty_dagger", name: "Rusty Dagger", icon: "🔪", desc: "Sharp enough, for now.", levelReq: 1, slot: "weapon", weaponType: "dagger" },
  { id: "wooden_mallet", name: "Wooden Mallet", icon: "🔨", desc: "Heavy, honest, and splintery.", levelReq: 1, slot: "weapon", weaponType: "hammer" },
];

const armors: GearTemplate[] = ARMOR_SOURCE.map((a, i) => ({
  id: a.id, name: a.name, icon: a.icon, slot: "armor", desc: a.desc,
  levelReq: spread(i, ARMOR_SOURCE.length),
}));

const helmets: GearTemplate[] = [
  ["leather_cap", "Leather Cap", "🧢", "Better than nothing.", 1],
  ["iron_helmet", "Iron Helmet", "⛑️", "Dented but dependable.", 8],
  ["knight_helm", "Knight Helm", "🪖", "A visor that has seen tournaments.", 17],
  ["bone_crown", "Bone Crown", "💀", "Carved from catacomb dead.", 26],
  ["crystal_circlet", "Crystal Circlet", "💎", "Hums near magic.", 35],
  ["dragon_helm", "Dragon Helm", "🐉", "Horned and heat-proof.", 44],
  ["storm_visor", "Storm Visor", "⛈️", "Lightning bends around it.", 53],
  ["abyssal_crown", "Abyssal Crown", "🌊", "Heavy with ocean pressure.", 62],
  ["moonlit_diadem", "Moonlit Diadem", "🌙", "Glows only at night.", 71],
  ["sunforged_helm", "Sunforged Helm", "🌞", "Warm to the touch, always.", 80],
  ["astral_halo", "Astral Halo", "💫", "Floats a finger above the head.", 90],
  ["crown_of_ascension", "Crown of Ascension", "👑", "Worn by those who reached the Gate.", 100],
].map(([id, name, icon, desc, levelReq]) => ({ id, name, icon, desc, levelReq, slot: "helmet" }) as GearTemplate);

const boots: GearTemplate[] = [
  ["worn_boots", "Worn Boots", "👢", "Broken in, barely.", 1],
  ["leather_boots", "Leather Boots", "🥾", "Quiet on stone floors.", 9],
  ["iron_greaves", "Iron Greaves", "🦿", "Clank with purpose.", 18],
  ["windwalker_boots", "Windwalker Boots", "💨", "Each step lands a little early.", 27],
  ["shadowstep_treads", "Shadowstep Treads", "🌑", "Leave no footprints.", 36],
  ["ember_sabatons", "Ember Sabatons", "🔥", "Scorch the ground they touch.", 45],
  ["frostwalk_boots", "Frostwalk Boots", "🧊", "Water freezes underfoot.", 54],
  ["tidestride_boots", "Tidestride Boots", "🌊", "Walk the trench floor.", 63],
  ["gaia_roots", "Gaia's Roots", "🌿", "Grow into the earth when you plant your feet.", 72],
  ["eclipse_greaves", "Eclipse Greaves", "🌘", "Half light, half dark.", 81],
  ["chrono_striders", "Chrono Striders", "⏳", "Arrive before you left.", 91],
  ["void_walkers", "Void Walkers", "🌌", "Step between places.", 100],
].map(([id, name, icon, desc, levelReq]) => ({ id, name, icon, desc, levelReq, slot: "boots" }) as GearTemplate);

function relicFocus(desc: string): StatBlock {
  const d = desc.toLowerCase();
  if (d.includes("drop")) return { luck: 1 };
  const atk = d.includes("atk") ? 1 : 0;
  const def = d.includes("def") ? 1 : 0;
  const hp = d.includes("hp") ? 1 : 0;
  if (atk + def + hp === 0) return { atk: 1, def: 1, hp: 1 };
  return { atk, def, hp };
}

const accessories: GearTemplate[] = RELIC_SOURCE.filter((r) => r.id !== "enchanted_lure").map((r, i, arr) => ({
  id: r.id, name: r.name, icon: r.icon, slot: "accessory", levelReq: spread(i, arr.length),
  desc: r.desc.replace(/\s*[+].*permanently$/i, "").replace(/ permanent/i, "") || "A relic of the old empire.",
  focus: relicFocus(r.desc),
}));

// Festival gear, bought with event currency. Ordinary items in every other respect.
const eventGear: GearTemplate[] = [
  { id: "moonlight_blade", name: "Moonlight Blade", icon: "🌙", slot: "weapon", weaponType: "sword", levelReq: 5, desc: "Condensed moonbeams, edged.", eventOnly: true },
  { id: "lunar_ward", name: "Lunar Ward", icon: "🛡️", slot: "armor", levelReq: 5, desc: "Woven from lunar silk.", eventOnly: true },
  { id: "harvest_crown", name: "Harvest Crown", icon: "👑", slot: "helmet", levelReq: 5, desc: "Worn by the champion of the festival.", eventOnly: true },
];

export const GEAR: GearTemplate[] = [...starters, ...weapons, ...bows, ...armors, ...helmets, ...boots, ...accessories, ...eventGear];
export const GEAR_BY_ID: Record<string, GearTemplate> = Object.fromEntries(GEAR.map((g) => [g.id, g]));

export function gearForSlot(slot: EquipSlot): GearTemplate[] {
  return GEAR.filter((g) => g.slot === slot);
}

// ── Consumables ──────────────────────────────────────────────────────
const potions: ConsumableTemplate[] = POTION_SOURCE.filter((p) => p.id !== "elixir_of_fortune").map((p, i, arr) => {
  const t = i / (arr.length - 1);
  const levelReq = spread(i, arr.length, 1, 90);
  const healPct = p.heal ? Math.min(1, Math.round((0.3 + 0.7 * t) * 20) / 20) : undefined;
  const xpPct = p.xp_boost ? Math.round((0.08 + 0.32 * t) * 100) / 100 : undefined;
  const basePrice = Math.round((20 + levelReq * levelReq * 1.2) * (p.heal && p.xp_boost ? 3 : p.xp_boost ? 2.2 : 1));
  const parts = [healPct ? `Restores ${Math.round(healPct * 100)}% HP` : "", xpPct ? `grants ${Math.round(xpPct * 100)}% of a level's XP` : ""].filter(Boolean);
  return {
    id: p.id, name: p.name, icon: p.icon, kind: "potion" as const, levelReq,
    desc: parts.join(" and ").replace(/^./, (c) => c.toUpperCase()) + ".",
    healPct, xpPct, basePrice, sellPrice: Math.round(basePrice * 0.25),
  };
});

const materials: ConsumableTemplate[] = [
  ["iron_ore", "Iron Ore", "🪨", "Common smithing ore from the surface regions.", 1, 20],
  ["undead_bones", "Undead Bones", "🦴", "Dropped by the restless dead.", 1, 30],
  ["silk_cloth", "Silk Cloth", "🧵", "Fine cloth for enchanted garments.", 10, 60],
  ["dragon_scales", "Dragon Scales", "🐉", "Nearly unbreakable. Found on bosses.", 25, 150],
  ["mystic_gem", "Mystic Gem", "💎", "A gem that stores magic. Needed for high upgrades.", 40, 400],
  ["star_essence", "Star Essence", "🌟", "Distilled from salvaged rare gear.", 1, 250],
].map(([id, name, icon, desc, levelReq, price]) => ({
  id: id as string, name: name as string, icon: icon as string, desc: desc as string, kind: "material" as const,
  levelReq: levelReq as number, basePrice: price as number, sellPrice: Math.round((price as number) * 0.3),
}));

const eggs: ConsumableTemplate[] = ([
  ["mystery_egg", "Mystery Egg", "🥚", "Could hatch into anything.", "mystery", 600],
  ["golden_egg", "Golden Egg", "🪺", "Guaranteed rare or better.", "golden", 6_000],
  ["slime_egg", "Slime Egg", "🟢", "Wobbles. Hatches a common pet.", "common", 300],
  ["forest_egg", "Forest Egg", "🌿", "Smells of moss. Hatches an uncommon pet.", "uncommon", 1_200],
  ["dragon_egg", "Dragon Egg", "🐉", "Warm. Hatches a rare pet.", "rare", 5_000],
  ["void_egg", "Void Egg", "🌑", "Absorbs light. Hatches an epic pet.", "epic", 20_000],
  ["phoenix_egg", "Phoenix Egg", "🔥", "Burns without burning. Hatches a legendary pet.", "legendary", 80_000],
  ["celestial_egg", "Celestial Egg", "⭐", "Shows a sky inside. Hatches a mythic pet.", "mythic", 300_000],
] as const).map(([id, name, icon, desc, eggRarity, price]) => ({
  id, name, icon, desc, kind: "egg" as const, eggRarity, levelReq: 1, basePrice: price, sellPrice: Math.round(price * 0.2),
}));

const books: ConsumableTemplate[] = [
  { id: "skill_book", name: "Skill Book", icon: "📘", kind: "book", levelReq: 1, basePrice: 2_500, sellPrice: 400,
    desc: "Teaches a random skill you can use, or ranks up one you know." },
  { id: "xp_scroll", name: "XP Scroll", icon: "📜", kind: "book", levelReq: 1, basePrice: 900, sellPrice: 120, xpPct: 0.15,
    desc: "Grants 15% of a level's XP." },
];

const eventConsumables: ConsumableTemplate[] = [
  { id: "moonbeam_elixir", name: "Moonbeam Elixir", icon: "🌗", kind: "potion", levelReq: 5, healPct: 1, xpPct: 0.35, basePrice: 0, sellPrice: 400, eventOnly: true,
    desc: "Restores all HP and grants 35% of a level's XP." },
  { id: "lunar_egg", name: "Lunar Pet Egg", icon: "🌕", kind: "egg", eggRarity: "epic", levelReq: 5, basePrice: 0, sellPrice: 2_000, eventOnly: true,
    desc: "A shimmering egg that hatches an epic companion." },
];

export const CONSUMABLES: ConsumableTemplate[] = [...potions, ...materials, ...eggs, ...books, ...eventConsumables];
export const CONSUMABLE_BY_ID: Record<string, ConsumableTemplate> = Object.fromEntries(CONSUMABLES.map((c) => [c.id, c]));

export const MATERIAL_IDS = materials.map((m) => m.id);

// ── Blacksmith recipes (from the original forge, extended to every slot) ─
export interface Recipe {
  id: string;
  gearId: string;
  rarity: Rarity;
  materials: Record<string, number>;
  coins: number;
}

export const RECIPES: Recipe[] = [
  { id: "r_iron_sword", gearId: "iron_sword", rarity: "uncommon", materials: { iron_ore: 4 }, coins: 150 },
  { id: "r_leather_boots", gearId: "leather_boots", rarity: "uncommon", materials: { iron_ore: 2, undead_bones: 2 }, coins: 200 },
  { id: "r_iron_helmet", gearId: "iron_helmet", rarity: "uncommon", materials: { iron_ore: 4 }, coins: 180 },
  { id: "r_chainmail", gearId: "chainmail", rarity: "uncommon", materials: { iron_ore: 5, undead_bones: 2 }, coins: 220 },
  { id: "r_knight_helm", gearId: "knight_helm", rarity: "rare", materials: { iron_ore: 6, silk_cloth: 2 }, coins: 900 },
  { id: "r_elven_longbow", gearId: "elven_longbow", rarity: "rare", materials: { silk_cloth: 4, iron_ore: 4 }, coins: 1_000 },
  { id: "r_mystic_robes", gearId: "mystic_robes", rarity: "rare", materials: { silk_cloth: 6 }, coins: 1_400 },
  { id: "r_dragon_slayer", gearId: "dragon_slayer", rarity: "rare", materials: { iron_ore: 8, undead_bones: 4 }, coins: 1_200 },
  { id: "r_dragon_helm", gearId: "dragon_helm", rarity: "epic", materials: { dragon_scales: 5, iron_ore: 6 }, coins: 6_000 },
  { id: "r_dragon_scale", gearId: "dragon_scale", rarity: "epic", materials: { dragon_scales: 6, silk_cloth: 3 }, coins: 5_000 },
  { id: "r_abyssal_blade", gearId: "abyssal_blade", rarity: "epic", materials: { dragon_scales: 6, undead_bones: 8 }, coins: 12_000 },
  { id: "r_stormbreaker", gearId: "stormbreaker", rarity: "epic", materials: { dragon_scales: 4, silk_cloth: 4 }, coins: 3_000 },
  { id: "r_abyssal_crown", gearId: "abyssal_crown", rarity: "legendary", materials: { dragon_scales: 10, silk_cloth: 6, mystic_gem: 2 }, coins: 40_000 },
  { id: "r_celestial_scepter", gearId: "celestial_scepter", rarity: "legendary", materials: { dragon_scales: 14, silk_cloth: 8, mystic_gem: 4 }, coins: 150_000 },
  { id: "r_void_walkers", gearId: "void_walkers", rarity: "legendary", materials: { dragon_scales: 16, mystic_gem: 6, star_essence: 4 }, coins: 220_000 },
];

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
