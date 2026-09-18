import { EVENT_BY_ID, EVENT_FIGHT_COOLDOWN_MS, type SeasonalEvent, activeEvent, eventEndsAt } from "../../shared/data/events.ts";
import { CONSUMABLE_BY_ID, GEAR_BY_ID } from "../../shared/data/items.ts";
import { combatantFromMonster } from "../../shared/rules/combat.ts";
import { rollGear } from "../../shared/rules/items.ts";
import { monsterStats } from "../../shared/rules/monsters.ts";
import { createRng, freshSeed } from "../../shared/rules/rng.ts";
import { toItemView } from "../../shared/rules/views.ts";
import { GameError, notFound, tooFast } from "../lib/errors.ts";
import { throttle } from "../lib/throttle.ts";
import { assertCanStartBattle, heroCombatant, insertBattle, registerFinalizer } from "./battles.ts";
import type { GameCtx } from "./context.ts";
import { getOwnedItem } from "./inventory.ts";
import { type Player, addGear, addStack, bump, bumpMission } from "./player.ts";
import { payVictory } from "./pve.ts";

export interface EventState {
  tokens: number;
  earned: number;
  kills: number;
  bossKills: number;
  purchased: string[];
}

const EMPTY: EventState = { tokens: 0, earned: 0, kills: 0, bossKills: 0, purchased: [] };

type WithEvents = { events?: Record<string, EventState> };

export function eventState(p: Player, eventId: string): EventState {
  const state = p.state as WithEvents;
  const all = (state.events ??= {});
  return (all[eventId] ??= { ...EMPTY, purchased: [] });
}

export function requireActiveEvent(g: GameCtx): SeasonalEvent {
  const event = activeEvent(g.clock.now());
  if (!event) throw new GameError("No festival is running right now. Watch the notice board.", { code: "no_event" });
  return event;
}

/** Everything the festival page needs: the event, your standing, the shop and the leaderboard. */
export function eventView(g: GameCtx, p: Player) {
  const event = activeEvent(g.clock.now());
  if (!event) return { active: false as const, next: null };
  const mine = eventState(p, event.id);
  // The leaderboard reads each player's event totals straight out of their state JSON.
  const path = `$.events."${event.id}".earned`;
  const top = g.db.all<{ user_id: number; name: string; earned: number; kills: number }>(
    `SELECT user_id, name,
            COALESCE(json_extract(state, ?), 0) AS earned,
            COALESCE(json_extract(state, ?), 0) AS kills
     FROM players WHERE COALESCE(json_extract(state, ?), 0) > 0
     ORDER BY earned DESC, kills DESC LIMIT 50`,
    path, `$.events."${event.id}".kills`, path);

  return {
    active: true as const,
    event: {
      id: event.id, name: event.name, icon: event.icon, description: event.description,
      currency: event.currency, minLevel: event.minLevel, endsAt: eventEndsAt(event),
      monsters: event.monsters.map((m) => ({ id: m.id, name: m.name, icon: m.icon, tier: m.tier, tokens: m.tokens })),
    },
    mine,
    shop: event.shop.map((entry) => {
      const gear = GEAR_BY_ID[entry.ref];
      const stack = CONSUMABLE_BY_ID[entry.ref];
      return {
        id: entry.id, price: entry.price, kind: entry.kind, note: entry.note, once: entry.once,
        name: entry.kind === "title" ? entry.ref : (gear?.name ?? stack?.name ?? entry.ref),
        icon: entry.kind === "title" ? "📜" : (gear?.icon ?? stack?.icon ?? "✨"),
        desc: gear ? `Legendary ${gear.slot}, forged to your level.` : stack?.desc ?? "",
        owned: mine.purchased.includes(entry.id),
        affordable: mine.tokens >= entry.price,
      };
    }),
    leaderboard: top.map((r, i) => ({ rank: i + 1, userId: r.user_id, name: r.name, earned: r.earned, kills: r.kills })),
  };
}

export function startEventBattle(g: GameCtx, p: Player) {
  const event = requireActiveEvent(g);
  if (p.level < event.minLevel) {
    throw new GameError(`${event.name} is open to heroes of level ${event.minLevel} and above.`, { code: "level_locked", details: { level: event.minLevel } });
  }
  if (throttle(g, `event:${p.userId}`, EVENT_FIGHT_COOLDOWN_MS)) throw tooFast("The lanterns need a moment to relight.");
  assertCanStartBattle(g, p);
  const rng = createRng(freshSeed());
  const boss = rng.chance(event.bossChance * 100);
  const pool = event.monsters.filter((m) => (boss ? m.tier === "boss" : m.tier !== "boss"));
  const monster = rng.pick(pool.length ? pool : event.monsters);
  const level = Math.max(event.minLevel, p.level);
  const m = monsterStats(level, monster.tier, monster.shape);
  const { combatant, pet } = heroCombatant(g, p);
  const enemy = combatantFromMonster({ name: monster.name, icon: monster.icon, level, ...m, isBoss: monster.tier === "boss" });
  return insertBattle(g, p.userId, "event", {
    eventId: event.id, monsterId: monster.id, name: monster.name, tier: monster.tier, level, xp: m.xp, coins: m.coins,
    tokens: rng.int(monster.tokens[0], monster.tokens[1]),
  }, { player: combatant, enemy, pet, canFlee: monster.tier !== "boss" });
}

registerFinalizer("event", (g, p, b) => {
  const c = b.context as { eventId: string; tier: string; level: number; xp: number; coins: number; tokens: number; name: string };
  const event = EVENT_BY_ID[c.eventId];
  if (b.state.status !== "won") {
    if (b.state.status === "lost" || b.state.status === "timeout") {
      bump(g, p, "deaths");
      p.hp = Math.max(1, Math.round(b.state.player.maxHp * 0.1));
      p.hpAt = g.clock.now();
    }
    return { result: b.state.status };
  }
  const boss = c.tier === "boss";
  const pay = payVictory(g, p, { level: c.level, coins: c.coins, xp: c.xp, boss, elite: c.tier === "elite", source: "adventure" });
  const s = eventState(p, c.eventId);
  s.tokens += c.tokens;
  s.earned += c.tokens;
  s.kills += 1;
  if (boss) s.bossKills += 1;
  if (boss && event) {
    g.hub.toChannel("world", { type: "feed", icon: event.icon, text: `${p.name} drove off ${c.name} at the ${event.name}.`, at: g.clock.now() });
  }
  return { result: "won", ...pay, extra: { tokens: c.tokens, balance: s.tokens, currency: event?.currency.name ?? "tokens" } };
});

export function buyEventItem(g: GameCtx, p: Player, entryId: string) {
  const event = requireActiveEvent(g);
  const entry = event.shop.find((e) => e.id === entryId);
  if (!entry) throw notFound("Festival stall item");
  const s = eventState(p, event.id);
  if (entry.once && s.purchased.includes(entry.id)) throw new GameError("You already claimed that one.");
  if (s.tokens < entry.price) {
    throw new GameError(`You need ${entry.price} ${event.currency.name} (you have ${s.tokens}).`, { code: "insufficient_tokens" });
  }
  s.tokens -= entry.price;
  if (entry.once) s.purchased.push(entry.id);

  if (entry.kind === "title") {
    p.state.titles = [...new Set([...(p.state.titles ?? []), entry.ref])];
    return { kind: "title" as const, name: entry.ref };
  }
  if (entry.kind === "stack") {
    const c = CONSUMABLE_BY_ID[entry.ref];
    if (!c) throw notFound("Festival stall item");
    addStack(g, p.userId, entry.ref, entry.qty ?? 1);
    return { kind: "stack" as const, name: c.name, qty: entry.qty ?? 1 };
  }
  const template = GEAR_BY_ID[entry.ref];
  if (!template) throw notFound("Festival stall item");
  // Festival gear is forged to the buyer's level, so it stays worth wearing whenever you earn it.
  const rolled = rollGear(createRng(freshSeed()), template, Math.max(template.levelReq, p.level), "legendary");
  const id = addGear(g, p.userId, { kind: "gear", templateId: template.id, rarity: "legendary", ilvl: rolled.ilvl, base: rolled.base as Record<string, number>, affixes: rolled.affixes });
  bumpMission(p, "shop");
  return { kind: "gear" as const, name: template.name, item: toItemView(getOwnedItem(g, p.userId, id)) };
}
