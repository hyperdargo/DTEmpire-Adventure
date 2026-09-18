import { SKILL_BY_ID, skillRankMult } from "../data/skills.ts";
import type { BattleAction, BattleActor, BattleEvent, BattleState, Combatant, EffectKind, PetCombatant, StatusEffect } from "../data/types.ts";
import { baseDamage, clamp } from "./progression.ts";
import { type Rng, createRng } from "./rng.ts";
import type { HeroStats } from "./stats.ts";

export type Side = "player" | "enemy";
const other = (s: Side): Side => (s === "player" ? "enemy" : "player");

export const GUARD_REDUCTION = 0.55;
export const HEAVY_MULT = 2.2;
export const ENRAGE_AT = 0.3;
export const DEFAULT_MAX_TURNS = 40;

export interface CreateBattleInput {
  seed: string;
  player: Combatant;
  enemy: Combatant;
  pet?: PetCombatant;
  canFlee: boolean;
  maxTurns?: number;
}

export function createBattle(input: CreateBattleInput): BattleState {
  return {
    seed: input.seed,
    turn: 1,
    status: "active",
    player: input.player,
    enemy: input.enemy,
    pet: input.pet,
    canFlee: input.canFlee,
    maxTurns: input.maxTurns ?? DEFAULT_MAX_TURNS,
    events: [],
  };
}

export function combatantFromHero(
  stats: HeroStats,
  meta: { name: string; icon: string; level: number; classId: string; skills: { id: string; rank: number }[] },
  currentHp: number,
): Combatant {
  return {
    name: meta.name, icon: meta.icon, level: meta.level, classId: meta.classId,
    maxHp: stats.maxHp, hp: clamp(Math.round(currentHp), 1, stats.maxHp),
    atk: stats.atk, def: stats.def, spd: stats.spd, crit: stats.crit, critDmg: stats.critDmg,
    dodge: stats.dodge, lifesteal: stats.lifesteal, skillPower: stats.skillPower, pierce: stats.pierce,
    regenPct: stats.regenPct, bossDamage: stats.bossDamage, rage: stats.rage, cooldownReduction: stats.cooldownReduction,
    effects: [],
    skills: meta.skills.filter((s) => SKILL_BY_ID[s.id]).map((s) => ({ id: s.id, rank: s.rank, cd: 0 })),
  };
}

export function combatantFromMonster(m: {
  name: string; icon: string; level: number; hp: number; atk: number; def: number; spd: number; isBoss?: boolean;
}): Combatant {
  return {
    name: m.name, icon: m.icon, level: m.level, maxHp: m.hp, hp: m.hp, atk: m.atk, def: m.def, spd: m.spd,
    crit: m.isBoss ? 8 : 5, critDmg: 150, dodge: 2, lifesteal: 0, skillPower: 0, pierce: 0, regenPct: 0,
    bossDamage: 0, rage: 0, cooldownReduction: 0, effects: [], skills: [],
    isBoss: m.isBoss ?? false, heavyEvery: m.isBoss ? 4 : undefined, charging: false,
  };
}

const effectValue = (c: Combatant, kind: EffectKind) => c.effects.filter((e) => e.kind === kind).reduce((s, e) => s + e.value, 0);
const hasEffect = (c: Combatant, kind: EffectKind) => c.effects.some((e) => e.kind === kind && e.turns > 0);

function addEffect(c: Combatant, effect: StatusEffect) {
  if (effect.kind === "shield") {
    const existing = c.effects.find((e) => e.kind === "shield");
    if (existing) {
      existing.value = Math.max(existing.value, effect.value);
      existing.turns = Math.max(existing.turns, effect.turns);
      return;
    }
  }
  if (effect.kind === "stun" && hasEffect(c, "stun")) return;
  c.effects.push(effect);
}

/** Whether an action is legal right now for a side. The server calls this before resolving. */
export function validateAction(state: BattleState, side: Side, action: BattleAction): string | null {
  if (state.status !== "active") return "The battle is over.";
  const me = state[side];
  if (action.type === "skill") {
    const sk = me.skills.find((s) => s.id === action.skillId);
    if (!sk) return "You haven't equipped that skill.";
    if (sk.cd > 0) return `${SKILL_BY_ID[sk.id]?.name ?? "Skill"} is on cooldown for ${sk.cd} more turn${sk.cd === 1 ? "" : "s"}.`;
  }
  if (action.type === "flee" && !state.canFlee) return "You can't flee from this fight.";
  return null;
}

/** Enemy AI for PvE. Bosses telegraph a heavy blow, then unleash it. */
export function enemyIntent(state: BattleState): BattleAction {
  const e = state.enemy;
  if (e.isBoss && e.heavyEvery) return { type: "attack" };
  return { type: "attack" };
}

/** Auto-battle policy (quick battles, AFK arena fighters, simulations). */
export function autoAction(state: BattleState, side: Side, opts: { potionId?: number } = {}): BattleAction {
  const me = state[side];
  const foe = state[other(side)];
  const hpPct = me.hp / me.maxHp;
  const ready = me.skills.filter((s) => s.cd === 0).map((s) => ({ ...s, def: SKILL_BY_ID[s.id]! })).filter((s) => s.def);

  if (hpPct < 0.35 && opts.potionId != null) return { type: "item", itemId: opts.potionId };
  if (foe.charging) {
    const defensive = ready.find((s) => s.def.effect.kind === "shield" || (s.def.effect.kind === "buff" && s.def.effect.guard));
    return defensive ? { type: "skill", skillId: defensive.id } : { type: "guard" };
  }
  if (hpPct < 0.5) {
    const heal = ready.find((s) => s.def.effect.kind === "heal" || s.def.effect.kind === "drain" || s.def.effect.kind === "shield");
    if (heal) return { type: "skill", skillId: heal.id };
  }
  const offensive = ready
    .filter((s) => ["damage", "drain", "burn", "stun"].includes(s.def.effect.kind) || (s.def.effect.kind === "buff" && s.def.effect.stat === "atk"))
    .sort((a, b) => skillScore(b.def.effect) * skillRankMult(b.rank) - skillScore(a.def.effect) * skillRankMult(a.rank));
  if (offensive[0]) return { type: "skill", skillId: offensive[0].id };
  return { type: "attack" };
}

function skillScore(effect: (typeof SKILL_BY_ID)[string]["effect"]): number {
  switch (effect.kind) {
    case "damage": return effect.mult * (effect.hits ?? 1) * (1 + (effect.pierce ?? 0) / 200);
    case "drain": return effect.mult * 1.1;
    case "burn": return effect.mult + (effect.dotPct * effect.turns) / 100;
    case "stun": return effect.mult + effect.chance / 100;
    case "buff": return 1.5;
    default: return 0;
  }
}

interface RoundCtx {
  rng: Rng;
  state: BattleState;
  events: BattleEvent[];
}

function dealDamage(
  ctx: RoundCtx, by: Side, target: Side, mult: number,
  opts: { critBonus?: number; pierce?: number; isSkill?: boolean; heavy?: boolean; label?: string } = {},
): number {
  const { rng, state, events } = ctx;
  const a = state[by];
  const t = state[target];
  if (t.hp <= 0) return 0;

  const dodge = clamp(t.dodge + effectValue(t, "dodge_up"), 0, 60);
  if (!hasEffect(t, "stun") && rng.chance(dodge)) {
    events.push({ t: "miss", by, target });
    return 0;
  }

  let atk = a.atk * (1 + effectValue(a, "atk_up") / 100);
  if (a.rage > 0 && a.hp / a.maxHp < 0.5) atk *= 1 + a.rage / 100;
  const defMod = 1 + (effectValue(t, "def_up") - effectValue(t, "def_down")) / 100;
  const pierce = clamp(a.pierce + (opts.pierce ?? 0), 0, 80);
  const def = Math.max(0, t.def * defMod * (1 - pierce / 100));

  let dmg = baseDamage(atk, def) * mult * rng.range(0.92, 1.08);
  if (opts.isSkill) dmg *= 1 + a.skillPower / 100;
  if (t.isBoss && a.bossDamage) dmg *= 1 + a.bossDamage / 100;
  const crit = rng.chance(clamp(a.crit + (opts.critBonus ?? 0), 0, 90));
  if (crit) dmg *= a.critDmg / 100;
  if (hasEffect(t, "guard")) dmg *= 1 - GUARD_REDUCTION;
  dmg = Math.max(1, Math.round(dmg));

  let absorbed = 0;
  const shield = t.effects.find((e) => e.kind === "shield" && e.value > 0);
  if (shield) {
    absorbed = Math.min(shield.value, dmg);
    shield.value -= absorbed;
    if (shield.value <= 0) shield.turns = 0;
  }
  const dealt = dmg - absorbed;
  t.hp = Math.max(0, t.hp - dealt);
  events.push({ t: "hit", by, target, dmg: dealt, crit, ...(absorbed ? { absorbed } : {}) });

  if (a.lifesteal > 0 && dealt > 0 && a.hp > 0) heal(ctx, by, Math.round((dealt * a.lifesteal) / 100), "lifesteal");

  if (t.isBoss && t.hp > 0 && t.hp / t.maxHp < ENRAGE_AT && !t.effects.some((e) => e.kind === "atk_up" && e.turns >= 90)) {
    t.effects.push({ kind: "atk_up", turns: 99, value: 25 });
    events.push({ t: "telegraph", by: target, text: `${t.name} is enraged!` });
  }
  return dealt;
}

function heal(ctx: RoundCtx, target: Side, amount: number, source: string) {
  const c = ctx.state[target];
  const healed = Math.min(c.maxHp - c.hp, Math.max(0, Math.round(amount)));
  if (healed <= 0) return;
  c.hp += healed;
  ctx.events.push({ t: "heal", target, amount: healed, source });
}

function performAction(ctx: RoundCtx, side: Side, action: BattleAction, potionHealPct: number | undefined) {
  const { state, events, rng } = ctx;
  const me = state[side];
  const foeSide = other(side);
  if (me.hp <= 0 || state[foeSide].hp <= 0 || state.status !== "active") return;

  const stun = me.effects.find((e) => e.kind === "stun" && e.turns > 0);
  if (stun) {
    stun.turns = 0;
    events.push({ t: "stunned", target: side });
    return;
  }

  // Boss heavy-attack cycle (PvE enemy only).
  if (side === "enemy" && me.isBoss && me.heavyEvery) {
    if (me.charging) {
      me.charging = false;
      events.push({ t: "action", by: side, label: "Crushing Blow", icon: "💥" });
      dealDamage(ctx, side, foeSide, HEAVY_MULT, { heavy: true });
      return;
    }
    if (state.turn % me.heavyEvery === me.heavyEvery - 1) {
      me.charging = true;
      events.push({ t: "telegraph", by: side, text: `${me.name} gathers its strength. Guard next turn!` });
      return;
    }
  }

  switch (action.type) {
    case "guard":
      return; // applied at round start
    case "item": {
      const pct = potionHealPct ?? 0;
      events.push({ t: "action", by: side, label: "Potion", icon: "🧪" });
      heal(ctx, side, me.maxHp * pct, "potion");
      return;
    }
    case "flee": {
      const foe = state[foeSide];
      const ok = rng.chance(clamp(50 + (me.spd - foe.spd) * 3, 20, 90));
      events.push({ t: "flee", ok });
      if (ok) state.status = "fled";
      return;
    }
    case "attack":
      events.push({ t: "action", by: side, label: "Attack", icon: "⚔️" });
      dealDamage(ctx, side, foeSide, 1);
      return;
    case "skill": {
      const slot = me.skills.find((s) => s.id === action.skillId && s.cd === 0);
      const def = slot ? SKILL_BY_ID[slot.id] : undefined;
      if (!slot || !def) {
        events.push({ t: "action", by: side, label: "Attack", icon: "⚔️" });
        dealDamage(ctx, side, foeSide, 1);
        return;
      }
      slot.cd = Math.max(1, def.cooldown - me.cooldownReduction);
      const rank = skillRankMult(slot.rank);
      events.push({ t: "action", by: side, label: def.name, icon: def.icon });
      const e = def.effect;
      switch (e.kind) {
        case "damage":
          for (let i = 0; i < (e.hits ?? 1); i++) {
            dealDamage(ctx, side, foeSide, e.mult * rank, { critBonus: e.critBonus, pierce: e.pierce, isSkill: true });
            if (state[foeSide].hp <= 0) break;
          }
          break;
        case "drain": {
          const dealt = dealDamage(ctx, side, foeSide, e.mult * rank, { isSkill: true });
          heal(ctx, side, (dealt * e.healPct) / 100, def.name);
          break;
        }
        case "heal":
          heal(ctx, side, (me.maxHp * e.pct * rank) / 100, def.name);
          break;
        case "shield": {
          const value = Math.round((me.maxHp * e.pct * rank) / 100);
          addEffect(me, { kind: "shield", turns: 4, value });
          events.push({ t: "effect", target: side, kind: "shield", turns: 4 });
          break;
        }
        case "buff": {
          const kind: EffectKind = e.stat === "atk" ? "atk_up" : e.stat === "def" ? "def_up" : "dodge_up";
          addEffect(me, { kind, turns: e.turns + 1, value: Math.round(e.pct * rank) });
          events.push({ t: "effect", target: side, kind, turns: e.turns });
          if (e.selfDefPenalty) addEffect(me, { kind: "def_down", turns: e.turns + 1, value: e.selfDefPenalty });
          break;
        }
        case "burn": {
          const dealt = dealDamage(ctx, side, foeSide, e.mult * rank, { isSkill: true });
          if (dealt > 0 && state[foeSide].hp > 0) {
            addEffect(state[foeSide], { kind: "burn", turns: e.turns, value: Math.max(1, Math.round((me.atk * e.dotPct * rank) / 100)) });
            events.push({ t: "effect", target: foeSide, kind: "burn", turns: e.turns });
          }
          break;
        }
        case "stun": {
          const dealt = dealDamage(ctx, side, foeSide, e.mult * rank, { isSkill: true });
          const resist = state[foeSide].isBoss ? 0.5 : 1;
          if (dealt > 0 && state[foeSide].hp > 0 && rng.chance(e.chance * resist)) {
            addEffect(state[foeSide], { kind: "stun", turns: 1, value: 0 });
            events.push({ t: "effect", target: foeSide, kind: "stun", turns: 1 });
          }
          break;
        }
      }
      return;
    }
  }
}

function petAct(ctx: RoundCtx, pet: PetCombatant) {
  const { state, events } = ctx;
  if (state.status !== "active" || state.player.hp <= 0 || state.enemy.hp <= 0) return;
  if (state.turn % pet.every !== 0) return;
  events.push({ t: "action", by: "pet", label: pet.ability === "strike" ? `${pet.name} strikes` : pet.ability === "mend" ? `${pet.name} mends` : `${pet.name} wards`, icon: pet.icon });
  if (pet.ability === "strike") {
    const t = state.enemy;
    const dmg = Math.max(1, Math.round(baseDamage(pet.power * 2.4, t.def * 0.5) * ctx.rng.range(0.9, 1.1)));
    t.hp = Math.max(0, t.hp - dmg);
    events.push({ t: "hit", by: "pet", target: "enemy", dmg, crit: false });
  } else if (pet.ability === "mend") {
    heal(ctx, "player", pet.power * 3, pet.name);
  } else {
    addEffect(state.player, { kind: "shield", turns: 3, value: Math.round(pet.power * 4) });
    events.push({ t: "effect", target: "player", kind: "shield", turns: 3 });
  }
}

function checkEnd(state: BattleState, events: BattleEvent[]): boolean {
  if (state.status === "fled") {
    events.push({ t: "end", result: "fled" });
    return true;
  }
  if (state.enemy.hp <= 0 || state.player.hp <= 0) {
    // Simultaneous knockouts favor the defender of the realm: the player loses.
    state.status = state.player.hp <= 0 ? "lost" : "won";
    events.push({ t: "end", result: state.status });
    return true;
  }
  return false;
}

export interface RoundInput {
  player: BattleAction;
  enemy?: BattleAction;
  playerPotionHealPct?: number;
  enemyPotionHealPct?: number;
}

/** Resolves one round. Pure: returns a new state whose `events` describe only this round. */
export function resolveRound(prev: BattleState, input: RoundInput): BattleState {
  if (prev.status !== "active") return prev;
  const state: BattleState = structuredClone(prev);
  const events: BattleEvent[] = [{ t: "turn", n: state.turn }];
  const ctx: RoundCtx = { rng: createRng(`${state.seed}:${state.turn}`), state, events };
  const actions: Record<Side, BattleAction> = { player: input.player, enemy: input.enemy ?? enemyIntent(state) };
  const potions: Record<Side, number | undefined> = { player: input.playerPotionHealPct, enemy: input.enemyPotionHealPct };

  for (const side of ["player", "enemy"] as Side[]) {
    if (validateAction(state, side, actions[side])) actions[side] = { type: "attack" };
  }

  // Guards and potions resolve before anything else.
  for (const side of ["player", "enemy"] as Side[]) {
    if (actions[side].type === "guard") {
      addEffect(state[side], { kind: "guard", turns: 1, value: 0 });
      events.push({ t: "action", by: side, label: "Guard", icon: "🛡️" });
    }
    const act = actions[side];
    if (act.type === "skill") {
      const e = SKILL_BY_ID[act.skillId]?.effect;
      if (e?.kind === "buff" && e.guard) addEffect(state[side], { kind: "guard", turns: 1, value: 0 });
    }
  }
  for (const side of ["player", "enemy"] as Side[]) {
    if (actions[side].type === "item") performAction(ctx, side, actions[side], potions[side]);
  }

  const pSpd = state.player.spd;
  const eSpd = state.enemy.spd;
  const order: Side[] = pSpd > eSpd || (pSpd === eSpd && ctx.rng.chance(50)) ? ["player", "enemy"] : ["enemy", "player"];
  for (const side of order) {
    if (actions[side].type === "item") continue;
    performAction(ctx, side, actions[side], potions[side]);
    if (state.status === "fled" || state.player.hp <= 0 || state.enemy.hp <= 0) break;
  }

  if (!checkEnd(state, events)) {
    if (state.pet) petAct(ctx, state.pet);
    // End of round: damage over time, regeneration, timers.
    for (const side of ["player", "enemy"] as Side[]) {
      const c = state[side];
      for (const eff of c.effects) {
        if (eff.kind === "burn" && eff.turns > 0 && c.hp > 0) {
          c.hp = Math.max(0, c.hp - eff.value);
          events.push({ t: "dot", target: side, dmg: eff.value, kind: "burn" });
        }
      }
      if (c.regenPct > 0 && c.hp > 0) heal(ctx, side, (c.maxHp * c.regenPct) / 100, "regen");
    }
    if (!checkEnd(state, events)) {
      for (const side of ["player", "enemy"] as Side[]) {
        const c = state[side];
        c.effects = c.effects
          .map((e) => ({ ...e, turns: e.kind === "guard" ? 0 : e.turns - 1 }))
          .filter((e) => e.turns > 0 && !(e.kind === "shield" && e.value <= 0));
        for (const s of c.skills) s.cd = Math.max(0, s.cd - 1);
      }
      state.turn += 1;
      if (state.turn > state.maxTurns) {
        state.status = "timeout";
        events.push({ t: "end", result: "timeout" });
      }
    }
  }

  state.events = events;
  return state;
}

/** Runs a battle to completion with the auto policy. Used by quick battles and balance tests. */
export function simulateBattle(
  start: BattleState,
  opts: { potions?: number; potionHealPct?: number; enemyAuto?: boolean } = {},
): { state: BattleState; potionsUsed: number; rounds: BattleEvent[][] } {
  let state = start;
  let potions = opts.potions ?? 0;
  let used = 0;
  const rounds: BattleEvent[][] = [];
  while (state.status === "active") {
    const action = autoAction(state, "player", { potionId: potions > 0 ? 1 : undefined });
    if (action.type === "item") {
      potions--;
      used++;
    }
    state = resolveRound(state, {
      player: action,
      enemy: opts.enemyAuto ? autoAction(state, "enemy") : undefined,
      playerPotionHealPct: opts.potionHealPct ?? 0.4,
    });
    rounds.push(state.events);
  }
  return { state, potionsUsed: used, rounds };
}

export const actorName = (state: BattleState, actor: BattleActor) =>
  actor === "pet" ? state.pet?.name ?? "Pet" : state[actor].name;
