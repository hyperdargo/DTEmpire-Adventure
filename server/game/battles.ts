import { CONSUMABLE_BY_ID } from "../../shared/data/items.ts";
import { masteryBonus } from "../../shared/data/meta.ts";
import { SKILL_BY_ID } from "../../shared/data/skills.ts";
import { PET_ABILITY_EVERY, PET_BY_ID } from "../../shared/data/pets.ts";
import type { BattleAction, BattleState, Combatant, PetCombatant } from "../../shared/data/types.ts";
import { autoAction, combatantFromHero, createBattle, resolveRound, validateAction } from "../../shared/rules/combat.ts";
import { freshSeed } from "../../shared/rules/rng.ts";
import { petBonus } from "../../shared/rules/stats.ts";
import { json } from "../db/db.ts";
import { randomId } from "../lib/crypto.ts";
import { GameError, notFound, tooFast } from "../lib/errors.ts";
import { throttle } from "../lib/throttle.ts";
import type { GameCtx, Notice } from "./context.ts";
import { type Player, activePet, heroStats, loadPlayer, refreshPower, savePlayer, settleHp } from "./player.ts";

export type BattleKind = "adventure" | "tower" | "dungeon" | "duel_ai" | "arena" | "worldboss" | "event" | "abyss";

export interface BattleRow {
  id: string;
  userId: number;
  kind: BattleKind;
  context: Record<string, unknown>;
  state: BattleState;
  status: string;
}

export interface BattleOutcome {
  result: BattleState["status"];
  coins?: number;
  xp?: number;
  drops?: unknown[];
  lines?: string[];
  extra?: Record<string, unknown>;
}

type Finalizer = (g: GameCtx, p: Player, battle: BattleRow) => BattleOutcome;
const finalizers = new Map<BattleKind, Finalizer>();
export const registerFinalizer = (kind: BattleKind, fn: Finalizer) => finalizers.set(kind, fn);

const MIN_START_HP_PCT = 0.15;
const ACTION_GAP_MS = 250;

export function loadoutSkills(g: GameCtx, userId: number): { id: string; rank: number }[] {
  return g.db
    .all<{ skill_id: string; rank: number }>("SELECT skill_id, rank FROM skills WHERE user_id = ? AND slot IS NOT NULL ORDER BY slot", userId)
    .filter((s) => SKILL_BY_ID[s.skill_id])
    .map((s) => ({ id: s.skill_id, rank: s.rank }));
}

export function petCombatant(g: GameCtx, userId: number, petPowerPct: number): PetCombatant | undefined {
  const pet = activePet(g, userId);
  if (!pet) return undefined;
  const species = PET_BY_ID[pet.speciesId];
  const { power } = petBonus(pet);
  return {
    name: pet.name || species?.name || "Pet",
    icon: species?.icon ?? "🐾",
    power: Math.round(power * (1 + petPowerPct / 100)),
    ability: species?.ability ?? "strike",
    every: PET_ABILITY_EVERY,
  };
}

/** Builds the player's combatant from current stats, HP, loadout and an optional per-foe mastery bonus. */
export function heroCombatant(g: GameCtx, p: Player, opts: { masteryRank?: number; hpOverride?: number } = {}): { combatant: Combatant; pet?: PetCombatant } {
  const stats = heroStats(g, p);
  if (opts.masteryRank) {
    const b = masteryBonus(opts.masteryRank);
    stats.atk = Math.round(stats.atk * (1 + b.atkPct / 100));
    stats.def = Math.round(stats.def * (1 + b.defPct / 100));
  }
  const hp = opts.hpOverride ?? settleHp(g, p, stats.maxHp);
  const combatant = combatantFromHero(stats, { name: p.name, icon: "", level: p.level, classId: p.classId, skills: loadoutSkills(g, p.userId) }, hp);
  return { combatant, pet: petCombatant(g, p.userId, stats.petPowerPct) };
}

export function getActiveBattle(g: GameCtx, userId: number): BattleRow | null {
  const r = g.db.get<{ id: string; user_id: number; kind: string; context: string; state: string; status: string }>(
    "SELECT * FROM battles WHERE user_id = ? AND status = 'active'", userId);
  return r ? { id: r.id, userId: r.user_id, kind: r.kind as BattleKind, context: json(r.context, {}), state: json(r.state, {} as BattleState), status: r.status } : null;
}

export function assertCanStartBattle(g: GameCtx, p: Player, opts: { ignoreHp?: boolean; dungeon?: boolean } = {}) {
  if (getActiveBattle(g, p.userId)) throw new GameError("You're already in a battle.", { code: "in_battle", status: 409 });
  if (!opts.dungeon && (p.state as { dungeon?: unknown }).dungeon) {
    throw new GameError("You're in the middle of a Dungeon run. Leave the Dungeon first.", { code: "in_dungeon" });
  }
  if (opts.ignoreHp) return;
  const maxHp = heroStats(g, p).maxHp;
  const hp = settleHp(g, p, maxHp);
  if (hp < maxHp * MIN_START_HP_PCT) {
    const secondsToReady = Math.ceil(((maxHp * MIN_START_HP_PCT - hp) / maxHp) * 240);
    throw new GameError(`You're too wounded to fight. Rest, drink a potion, or wait about ${secondsToReady}s.`, {
      code: "too_wounded", details: { secondsToReady },
    });
  }
}

export function insertBattle(g: GameCtx, userId: number, kind: BattleKind, context: Record<string, unknown>, init: {
  player: Combatant; enemy: Combatant; pet?: PetCombatant; canFlee: boolean; maxTurns?: number;
}): BattleRow {
  const id = randomId();
  const state = createBattle({ seed: freshSeed(), ...init });
  const now = g.clock.now();
  g.db.run(
    "INSERT INTO battles (id, user_id, kind, context, state, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)",
    id, userId, kind, JSON.stringify(context), JSON.stringify(state), now, now,
  );
  return { id, userId, kind, context, state, status: "active" };
}

function saveBattle(g: GameCtx, b: BattleRow) {
  g.db.run("UPDATE battles SET state = ?, status = ?, context = ?, updated_at = ? WHERE id = ?",
    JSON.stringify(b.state), b.state.status, JSON.stringify(b.context), g.clock.now(), b.id);
}

export interface ActResult {
  battle: BattleRow;
  rounds: BattleState["events"][];
  outcome?: BattleOutcome;
  notices: Notice[];
}

function resolveItemAction(g: GameCtx, p: Player, action: BattleAction): number | undefined {
  if (action.type !== "item") return undefined;
  const row = g.db.get<{ id: number; template_id: string; qty: number }>(
    "SELECT id, template_id, qty FROM items WHERE id = ? AND owner_id = ? AND escrow IS NULL", action.itemId, p.userId);
  const c = row ? CONSUMABLE_BY_ID[row.template_id] : undefined;
  if (!row || !c?.healPct) throw new GameError("You don't have that potion.");
  if (p.level < c.levelReq) throw new GameError(`${c.name} requires level ${c.levelReq}.`);
  if (row.qty <= 1) g.db.run("DELETE FROM items WHERE id = ?", row.id);
  else g.db.run("UPDATE items SET qty = qty - 1 WHERE id = ?", row.id);
  p.counters.potionsDrunk = (p.counters.potionsDrunk ?? 0) + 1;
  return c.healPct;
}

/** Player-snapshot opponents fight with the same auto policy players use; monsters use their own AI. */
function enemyPolicy(battle: BattleRow): BattleAction | undefined {
  return battle.kind === "arena" ? autoAction(battle.state, "enemy") : undefined;
}

function finish(g: GameCtx, p: Player, battle: BattleRow): BattleOutcome {
  p.hp = Math.max(1, battle.state.player.hp);
  p.hpAt = g.clock.now();
  const fin = finalizers.get(battle.kind);
  return fin ? fin(g, p, battle) : { result: battle.state.status };
}

/** Plays one round with the chosen action. */
export function act(g: GameCtx, userId: number, battleId: string, action: BattleAction): ActResult {
  if (throttle(g, `act:${userId}`, ACTION_GAP_MS)) throw tooFast("Easy there, hero.");
  return g.db.tx(() => {
    const p = loadPlayer(g, userId);
    const battle = getActiveBattle(g, userId);
    if (!battle || battle.id !== battleId) throw notFound("Active battle");
    const invalid = validateAction(battle.state, "player", action);
    if (invalid) throw new GameError(invalid);
    const heal = resolveItemAction(g, p, action);
    battle.state = resolveRound(battle.state, { player: action, enemy: enemyPolicy(battle), playerPotionHealPct: heal });
    const rounds = [battle.state.events];
    let outcome: BattleOutcome | undefined;
    if (battle.state.status !== "active") outcome = finish(g, p, battle);
    saveBattle(g, battle);
    refreshPower(g, p);
    savePlayer(g, p);
    return { battle, rounds, outcome, notices: p.notices };
  });
}

/** Resolves the rest of the battle with the auto policy. Potions are only used when allowed. */
export function autoResolve(g: GameCtx, userId: number, battleId: string, opts: { usePotions: boolean }): ActResult {
  return g.db.tx(() => {
    const p = loadPlayer(g, userId);
    const battle = getActiveBattle(g, userId);
    if (!battle || battle.id !== battleId) throw notFound("Active battle");
    // Mark this battle as auto-resolve for all remaining rounds
    battle.context.autoResolve = true;
    battle.context.usePotions = opts.usePotions;
    
    // Also persist the preference for future adventure battles
    p.state.autoResolveAdventure = true;
    p.state.settings = { ...p.state.settings, autoResolveAdventure: true, autoResolvePotions: opts.usePotions };
    p.state.autoResolvePotions = opts.usePotions;
    savePlayer(g, p);
    
    // Run all remaining rounds automatically
    const rounds: BattleState["events"][] = [];
    let guard = 0;
    while (battle.state.status === "active" && guard++ < 200) {
      let potionId: number | undefined;
      if (opts.usePotions) {
        const potion = bestPotion(g, p);
        potionId = potion?.id;
      }
      let action = autoAction(battle.state, "player", { potionId });
      let heal: number | undefined;
      if (action.type === "item") {
        try {
          heal = resolveItemAction(g, p, action);
        } catch {
          action = { type: "attack" };
        }
      }
      battle.state = resolveRound(battle.state, { player: action, enemy: enemyPolicy(battle), playerPotionHealPct: heal });
      rounds.push(battle.state.events);
    }
    const outcome = finish(g, p, battle);
    saveBattle(g, battle);
    refreshPower(g, p);
    savePlayer(g, p);
    return { battle, rounds, outcome, notices: p.notices };
  });
}

function bestPotion(g: GameCtx, p: Player): { id: number } | undefined {
  const rows = g.db.all<{ id: number; template_id: string }>("SELECT id, template_id FROM items WHERE owner_id = ? AND base = '{}' AND escrow IS NULL", p.userId);
  return rows
    .map((r) => ({ id: r.id, c: CONSUMABLE_BY_ID[r.template_id] }))
    .filter((r) => r.c?.healPct && !r.c.xpPct && r.c.levelReq <= p.level)
    .sort((a, b) => (a.c!.healPct ?? 0) - (b.c!.healPct ?? 0))[0];
}

/** Abandon counts as a flee where fleeing is allowed, otherwise as a loss. */
export function forfeit(g: GameCtx, userId: number, battleId: string): ActResult {
  return g.db.tx(() => {
    const p = loadPlayer(g, userId);
    const battle = getActiveBattle(g, userId);
    if (!battle || battle.id !== battleId) throw notFound("Active battle");
    battle.state = { ...battle.state, status: battle.state.canFlee ? "fled" : "lost", events: [{ t: "end", result: battle.state.canFlee ? "fled" : "lost" }] };
    if (!battle.state.canFlee) battle.state.player.hp = Math.max(1, Math.round(battle.state.player.hp * 0.5));
    const outcome = finish(g, p, battle);
    saveBattle(g, battle);
    savePlayer(g, p);
    return { battle, rounds: [battle.state.events], outcome, notices: p.notices };
  });
}

/** The client-facing battle payload. Hides the RNG seed so outcomes can't be predicted. */
export function battleView(b: BattleRow) {
  const { seed: _seed, ...state } = b.state;
  return { id: b.id, kind: b.kind, context: b.context, state };
}
