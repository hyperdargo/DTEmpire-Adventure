import type { MonsterShape } from "../rules/monsters.ts";

// Seasonal events: time-limited festivals with their own monsters, currency, shop and leaderboard.
// Rebuilt on the shared power curve so each event stays meaningful at any level.

export type EventTier = "normal" | "elite" | "boss";

export interface EventMonster {
  id: string;
  name: string;
  icon: string;
  tier: EventTier;
  shape: MonsterShape;
  /** Tokens awarded on a win. */
  tokens: [number, number];
}

export type EventShopKind = "gear" | "stack" | "title";

export interface EventShopEntry {
  id: string;
  /** Template id in the shared item tables, or the title text for `kind: "title"`. */
  ref: string;
  price: number;
  kind: EventShopKind;
  /** Gear and titles can only be bought once per event. */
  once: boolean;
  qty?: number;
  note: string;
}

export interface SeasonalEvent {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Inclusive UTC dates, YYYY-MM-DD. */
  start: string;
  end: string;
  currency: { name: string; icon: string };
  minLevel: number;
  bossChance: number;
  monsters: EventMonster[];
  shop: EventShopEntry[];
}

export const SEASONAL_EVENTS: SeasonalEvent[] = [
  // ── 1. Autumn: Harvest Moon Festival (Sep 16 - Oct 16) ──────────────────
  {
    id: "harvest_moon_2026",
    name: "Harvest Moon Festival",
    icon: "🌙",
    description:
      "The Harvest Moon rises over DTEmpire and ancient lunar beasts roam the fields. Slay them for Moon Tokens and trade the tokens for festival gear that vanishes when the moon sets.",
    start: "2026-09-16",
    end: "2026-10-16",
    currency: { name: "Moon Tokens", icon: "🌕" },
    minLevel: 5,
    bossChance: 0.12,
    monsters: [
      { id: "lunar_hare", name: "Lunar Hare", icon: "🐇", tier: "normal", shape: { hp: 0.8, atk: 0.9, def: 0.8 }, tokens: [2, 4] },
      { id: "moonlit_stalker", name: "Moonlit Stalker", icon: "🐈‍⬛", tier: "normal", shape: { hp: 1, atk: 1.2, def: 1 }, tokens: [3, 6] },
      { id: "harvest_wraith", name: "Harvest Wraith", icon: "👻", tier: "normal", shape: { hp: 1.2, atk: 1.3, def: 1.1 }, tokens: [5, 9] },
      { id: "crescent_golem", name: "Crescent Golem", icon: "🗿", tier: "elite", shape: { hp: 1.3, atk: 1, def: 1.4 }, tokens: [7, 12] },
      { id: "selenes_shadow", name: "Selene's Shadow", icon: "🌑", tier: "boss", shape: { hp: 1, atk: 1, def: 1 }, tokens: [15, 25] },
    ],
    shop: [
      { id: "moonlight_blade", ref: "moonlight_blade", kind: "gear", price: 80, once: true, note: "Forged from condensed moonbeams." },
      { id: "lunar_ward", ref: "lunar_ward", kind: "gear", price: 80, once: true, note: "Woven from lunar silk." },
      { id: "harvest_crown", ref: "harvest_crown", kind: "gear", price: 120, once: true, note: "Worn by the champion of the festival." },
      { id: "moonbeam_elixir", ref: "moonbeam_elixir", kind: "stack", price: 30, once: false, qty: 1, note: "Bottled moonlight." },
      { id: "lunar_pet_egg", ref: "lunar_egg", kind: "stack", price: 50, once: false, qty: 1, note: "Hatches under moonlight." },
      { id: "festival_title_scroll", ref: "🌙 Moon Champion", kind: "title", price: 100, once: true, note: "Wear the festival's name beside your own." },
    ],
  },
  // ── 2. Hollow Eve: Shadow Fall Festival (Oct 18 - Oct 31) ───────────────
  {
    id: "shadow_fall_2026",
    name: "Shadow Fall Festival",
    icon: "🎃",
    description:
      "A spectral fog sweeps through the realm as restless spirits cross the veil. Slay nightmares to claim Soul Shards and forge forbidden twilight relics.",
    start: "2026-10-18",
    end: "2026-10-31",
    currency: { name: "Soul Shards", icon: "🔮" },
    minLevel: 5,
    bossChance: 0.12,
    monsters: [
      { id: "pumpkin_fiend", name: "Pumpkin Fiend", icon: "🎃", tier: "normal", shape: { hp: 0.9, atk: 1.1, def: 0.9 }, tokens: [2, 4] },
      { id: "crypt_stalker", name: "Crypt Stalker", icon: "🕷️", tier: "normal", shape: { hp: 1.0, atk: 1.25, def: 0.95 }, tokens: [3, 6] },
      { id: "grim_banshee", name: "Grim Banshee", icon: "👻", tier: "normal", shape: { hp: 1.15, atk: 1.35, def: 1.0 }, tokens: [5, 9] },
      { id: "hollow_knight", name: "Hollow Knight", icon: "⚔️", tier: "elite", shape: { hp: 1.35, atk: 1.1, def: 1.45 }, tokens: [7, 12] },
      { id: "dread_lich", name: "Dread Lich Malakor", icon: "💀", tier: "boss", shape: { hp: 1.1, atk: 1.1, def: 1.05 }, tokens: [16, 26] },
    ],
    shop: [
      { id: "shadow_scythe", ref: "shadow_scythe", kind: "gear", price: 80, once: true, note: "Reaps the souls of the unworthy." },
      { id: "phantom_cloak", ref: "phantom_cloak", kind: "gear", price: 80, once: true, note: "Deflects blows into the spirit realm." },
      { id: "crown_of_undying", ref: "crown_of_undying", kind: "gear", price: 120, once: true, note: "Crown infused with necromantic majesty." },
      { id: "phantom_draught", ref: "phantom_draught", kind: "stack", price: 30, once: false, qty: 1, note: "Liquid soul essence." },
      { id: "soul_egg", ref: "soul_egg", kind: "stack", price: 50, once: false, qty: 1, note: "Hatches an eerie spirit companion." },
      { id: "shadow_title_scroll", ref: "🎃 The Hollow Knight", kind: "title", price: 100, once: true, note: "Walk unburdened among ghosts." },
    ],
  },
  // ── 3. Winter: Frostfall Solstice (Nov 16 - Dec 31) ──────────────────────
  {
    id: "frostfall_2026",
    name: "Frostfall Solstice",
    icon: "❄️",
    description:
      "Perpetual blizzards descend from the northern glacier. Hunt icy monstrosities for Frost Embers and claim timeless glacial armor.",
    start: "2026-11-16",
    end: "2026-12-31",
    currency: { name: "Frost Embers", icon: "🧊" },
    minLevel: 5,
    bossChance: 0.12,
    monsters: [
      { id: "frost_sprite", name: "Frost Sprite", icon: "🧚", tier: "normal", shape: { hp: 0.85, atk: 1.0, def: 0.9 }, tokens: [2, 4] },
      { id: "ice_drake", name: "Rime Drake", icon: "🐉", tier: "normal", shape: { hp: 1.05, atk: 1.2, def: 1.0 }, tokens: [3, 6] },
      { id: "glacial_yeti", name: "Glacial Yeti", icon: "🦍", tier: "normal", shape: { hp: 1.25, atk: 1.3, def: 1.15 }, tokens: [5, 9] },
      { id: "blizzard_elemental", name: "Blizzard Golem", icon: "⛄", tier: "elite", shape: { hp: 1.4, atk: 1.05, def: 1.4 }, tokens: [7, 12] },
      { id: "frostborne_titan", name: "Ymir The Frost Titan", icon: "🏔️", tier: "boss", shape: { hp: 1.1, atk: 1.1, def: 1.1 }, tokens: [16, 26] },
    ],
    shop: [
      { id: "frostmourne", ref: "frostmourne", kind: "gear", price: 80, once: true, note: "Freezes the air with every slash." },
      { id: "glacial_aegis", ref: "glacial_aegis", kind: "gear", price: 80, once: true, note: "Impenetrable glacial shield." },
      { id: "winter_crown", ref: "winter_crown", kind: "gear", price: 120, once: true, note: "Crown of the frozen northern kings." },
      { id: "glacial_elixir", ref: "glacial_elixir", kind: "stack", price: 30, once: false, qty: 1, note: "Soothes internal wounds with frost." },
      { id: "frost_egg", ref: "frost_egg", kind: "stack", price: 50, once: false, qty: 1, note: "Hatches a crystal frost companion." },
      { id: "frost_title_scroll", ref: "❄️ Frost Sovereign", kind: "title", price: 100, once: true, note: "Command the winter winds." },
    ],
  },
  // ── 4. Spring: Vernal Awakening (Feb 01 - Mar 15) ────────────────────────
  {
    id: "vernal_awakening_2027",
    name: "Vernal Awakening",
    icon: "🌸",
    description:
      "Life bursts forth across the realm as primeval flora and woodland beasts awaken. Harvest Blossom Petals to weave living regalia.",
    start: "2027-02-01",
    end: "2027-03-15",
    currency: { name: "Blossom Petals", icon: "🌺" },
    minLevel: 5,
    bossChance: 0.12,
    monsters: [
      { id: "petal_spirit", name: "Petal Sprite", icon: "🌸", tier: "normal", shape: { hp: 0.85, atk: 1.0, def: 0.85 }, tokens: [2, 4] },
      { id: "bramble_stalker", name: "Bramble Stalker", icon: "🌿", tier: "normal", shape: { hp: 1.0, atk: 1.2, def: 1.0 }, tokens: [3, 6] },
      { id: "jade_serpent", name: "Jade Serpent", icon: "🐍", tier: "normal", shape: { hp: 1.15, atk: 1.3, def: 1.05 }, tokens: [5, 9] },
      { id: "flora_ancient", name: "Ancient Treant", icon: "🌳", tier: "elite", shape: { hp: 1.45, atk: 1.0, def: 1.35 }, tokens: [7, 12] },
      { id: "blossom_dragon", name: "Sylvan Blossom Dragon", icon: "🐉", tier: "boss", shape: { hp: 1.05, atk: 1.15, def: 1.05 }, tokens: [16, 26] },
    ],
    shop: [
      { id: "jade_lotus_staff", ref: "jade_lotus_staff", kind: "gear", price: 80, once: true, note: "Pulses with continuous rejuvenation." },
      { id: "verdant_mail", ref: "verdant_mail", kind: "gear", price: 80, once: true, note: "Woven from pliable ironwood vines." },
      { id: "blossom_diadem", ref: "blossom_diadem", kind: "gear", price: 120, once: true, note: "Radiates gentle floral warmth." },
      { id: "spring_nectar", ref: "spring_nectar", kind: "stack", price: 30, once: false, qty: 1, note: "Distilled essence of spring." },
      { id: "blossom_egg", ref: "blossom_egg", kind: "stack", price: 50, once: false, qty: 1, note: "Hatches a playful woodland beast." },
      { id: "blossom_title_scroll", ref: "🌸 Bloom Weaver", kind: "title", price: 100, once: true, note: "Bring spring wherever you travel." },
    ],
  },
  // ── 5. Summer: Sunfire Solstice (May 01 - Jun 15) ────────────────────────
  {
    id: "sunfire_solstice_2027",
    name: "Sunfire Solstice",
    icon: "☀️",
    description:
      "Solar flares bathe the realm in scorching radiance as volcanic beasts surface. Gather Solar Embers to forge fire-tempered armaments.",
    start: "2027-05-01",
    end: "2027-06-15",
    currency: { name: "Solar Embers", icon: "🔥" },
    minLevel: 5,
    bossChance: 0.12,
    monsters: [
      { id: "sunfire_imp", name: "Sunfire Imp", icon: "👺", tier: "normal", shape: { hp: 0.85, atk: 1.1, def: 0.85 }, tokens: [2, 4] },
      { id: "ash_hound", name: "Ash Hound", icon: "🐕", tier: "normal", shape: { hp: 1.0, atk: 1.25, def: 0.95 }, tokens: [3, 6] },
      { id: "magma_wurm", name: "Magma Wurm", icon: "🐛", tier: "normal", shape: { hp: 1.2, atk: 1.3, def: 1.1 }, tokens: [5, 9] },
      { id: "solar_golem", name: "Solar Prominence Golem", icon: "🗿", tier: "elite", shape: { hp: 1.4, atk: 1.1, def: 1.4 }, tokens: [7, 12] },
      { id: "ignis_phoenix", name: "Ignis the Sun Phoenix", icon: "🦅", tier: "boss", shape: { hp: 1.05, atk: 1.2, def: 1.0 }, tokens: [16, 26] },
    ],
    shop: [
      { id: "solar_flare_greatsword", ref: "solar_flare_greatsword", kind: "gear", price: 80, once: true, note: "Slices with the heat of the noon sun." },
      { id: "phoenix_plume_mail", ref: "phoenix_plume_mail", kind: "gear", price: 80, once: true, note: "Feathers that rise renewed from ash." },
      { id: "sunfire_crest", ref: "sunfire_crest", kind: "gear", price: 120, once: true, note: "Crown forged in the heart of a solar flare." },
      { id: "solar_draught", ref: "solar_draught", kind: "stack", price: 30, once: false, qty: 1, note: "Drink down the fury of summer." },
      { id: "sunfire_egg", ref: "sunfire_egg", kind: "stack", price: 50, once: false, qty: 1, note: "Hatches a fiery solar bird." },
      { id: "sunfire_title_scroll", ref: "☀️ Solar Harbinger", kind: "title", price: 100, once: true, note: "Herald the endless dawn." },
    ],
  },
  // ── 6. Pelagic: Abyssal Tide Festival (Aug 01 - Aug 31) ───────────────────
  {
    id: "abyssal_tide_2027",
    name: "Abyssal Tide Festival",
    icon: "🌊",
    description:
      "Tidal waves surge from the deepest ocean trenches, washing leviathans onto coastal shores. Slay sea monsters for Tide Pearls.",
    start: "2027-08-01",
    end: "2027-08-31",
    currency: { name: "Tide Pearls", icon: "🦪" },
    minLevel: 5,
    bossChance: 0.12,
    monsters: [
      { id: "coral_stalker", name: "Coral Stalker", icon: "🦀", tier: "normal", shape: { hp: 0.9, atk: 1.05, def: 0.95 }, tokens: [2, 4] },
      { id: "deep_hunter", name: "Deep Sea Hunter", icon: "🦈", tier: "normal", shape: { hp: 1.05, atk: 1.25, def: 1.0 }, tokens: [3, 6] },
      { id: "abyssal_siren", name: "Abyssal Siren", icon: "🧜", tier: "normal", shape: { hp: 1.15, atk: 1.35, def: 1.05 }, tokens: [5, 9] },
      { id: "tidal_colossus", name: "Tidal Colossus", icon: "🐋", tier: "elite", shape: { hp: 1.4, atk: 1.1, def: 1.4 }, tokens: [7, 12] },
      { id: "leviathan_deep", name: "Leviathan of the Trench", icon: "🦑", tier: "boss", shape: { hp: 1.1, atk: 1.15, def: 1.1 }, tokens: [16, 26] },
    ],
    shop: [
      { id: "trident_of_abyss", ref: "trident_of_abyss", kind: "gear", price: 80, once: true, note: "Wield the crushing weight of the sea." },
      { id: "carapace_of_deep", ref: "carapace_of_deep", kind: "gear", price: 80, once: true, note: "Hardened shell from the Mariana trenches." },
      { id: "crown_of_coral", ref: "crown_of_coral", kind: "gear", price: 120, once: true, note: "Encrusted with luminous deep-sea pearls." },
      { id: "siren_tear", ref: "siren_tear", kind: "stack", price: 30, once: false, qty: 1, note: "Cures all worldly exhaustion." },
      { id: "trench_egg", ref: "trench_egg", kind: "stack", price: 50, once: false, qty: 1, note: "Hatches a bioluminescent pelagic beast." },
      { id: "tide_title_scroll", ref: "🌊 Deep Voyager", kind: "title", price: 100, once: true, note: "Plumb the deepest mysteries of the sea." },
    ],
  },
];

export const EVENT_BY_ID: Record<string, SeasonalEvent> = Object.fromEntries(SEASONAL_EVENTS.map((e) => [e.id, e]));

/** The event running on a given day, or null. Dates are inclusive and compared in UTC. */
export function activeEvent(nowMs: number): SeasonalEvent | null {
  const today = new Date(nowMs).toISOString().slice(0, 10);
  return SEASONAL_EVENTS.find((e) => e.start <= today && today <= e.end) ?? null;
}

export const eventEndsAt = (e: SeasonalEvent) => Date.parse(`${e.end}T23:59:59Z`);
export const EVENT_FIGHT_COOLDOWN_MS = 3_000;
