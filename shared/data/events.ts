import type { MonsterShape } from "../rules/monsters.ts";

// Seasonal events: time-limited festivals with their own monsters, currency, shop and leaderboard.
// Carried over from the original game's Harvest Moon Festival, rebuilt on the shared power curve so the
// event stays meaningful at any level instead of being tuned to one point in the old economy.

export type EventTier = "normal" | "elite" | "boss";

export interface EventMonster {
  id: string;
  name: string;
  icon: string;
  tier: EventTier;
  shape: MonsterShape;
  /** Moon Tokens (or the event's currency) awarded on a win. */
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
];

export const EVENT_BY_ID: Record<string, SeasonalEvent> = Object.fromEntries(SEASONAL_EVENTS.map((e) => [e.id, e]));

/** The event running on a given day, or null. Dates are inclusive and compared in UTC. */
export function activeEvent(nowMs: number): SeasonalEvent | null {
  const today = new Date(nowMs).toISOString().slice(0, 10);
  return SEASONAL_EVENTS.find((e) => e.start <= today && today <= e.end) ?? null;
}

export const eventEndsAt = (e: SeasonalEvent) => Date.parse(`${e.end}T23:59:59Z`);
export const EVENT_FIGHT_COOLDOWN_MS = 3_000;
