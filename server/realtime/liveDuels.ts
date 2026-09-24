import { ARENA_MIN_LEVEL, ARENA_TURN_SECONDS, DUEL_MIN_LEVEL } from "../../shared/data/meta.ts";
import type { BattleAction, BattleState } from "../../shared/data/types.ts";
import { autoAction, createBattle, resolveRound, validateAction } from "../../shared/rules/combat.ts";
import { freshSeed } from "../../shared/rules/rng.ts";
import { randomId } from "../lib/crypto.ts";
import { GameError, forbidden, notFound } from "../lib/errors.ts";
import type { GameCtx } from "../game/context.ts";
import { bump, bumpMission, findPlayer, grantXp, withPlayer } from "../game/player.ts";
import { snapshotFighter } from "../game/modes.ts";
import { isBlocked } from "../game/social.ts";

interface Challenge { id: string; from: number; to: number; fromName: string; expiresAt: number }
interface Room {
  id: string;
  a: number;
  b: number;
  state: BattleState;
  pending: { a?: BattleAction; b?: BattleAction };
  deadline: number;
  timer: NodeJS.Timeout | null;
  missed: { a: number; b: number };
}

const CHALLENGE_TTL = 60_000;

function isBotUser(g: GameCtx, userId: number): boolean {
  const p = findPlayer(g, userId);
  if ((p?.state as { isCompanion?: boolean })?.isCompanion) return true;
  const u = g.db.get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", userId);
  return u?.password_hash === "bot_locked";
}

/**
 * Real-time PvP. Both players pick an action each round; the round resolves when both have chosen or the
 * timer runs out (idle fighters auto-act). State lives in memory; results are persisted when the duel ends.
 */
export class LiveDuels {
  #challenges = new Map<string, Challenge>();
  #rooms = new Map<string, Room>();
  #byUser = new Map<number, string>();
  readonly g: GameCtx;

  constructor(g: GameCtx) {
    this.g = g;
  }

  challenge(fromId: number, toId: number) {
    const g = this.g;
    if (fromId === toId) throw new GameError("You can't duel yourself.");
    const from = findPlayer(g, fromId);
    const to = findPlayer(g, toId);
    if (!from || !to) throw notFound("Player");
    const toIsBot = isBotUser(g, toId);
    if (from.level < DUEL_MIN_LEVEL || (!toIsBot && to.level < DUEL_MIN_LEVEL)) throw new GameError(`Both fighters must be level ${DUEL_MIN_LEVEL}+.`);
    if (!toIsBot && !g.hub.isOnline(toId)) throw new GameError(`${to.name} isn't online right now.`);
    if (isBlocked(g, fromId, toId)) throw forbidden("You can't challenge this player.");
    if (this.#byUser.has(fromId)) throw new GameError("You are already in a live duel.");
    if (this.#byUser.has(toId)) {
      if (toIsBot) {
        const staleRoomId = this.#byUser.get(toId);
        if (staleRoomId) {
          const r = this.#rooms.get(staleRoomId);
          if (r) {
            if (r.timer) clearTimeout(r.timer);
            this.#rooms.delete(r.id);
            this.#byUser.delete(r.a);
            this.#byUser.delete(r.b);
          }
        }
      } else {
        throw new GameError("One of you is already in a live duel.");
      }
    }
    for (const c of this.#challenges.values()) if (c.from === fromId && c.to === toId) throw new GameError("Challenge already sent.");
    const c: Challenge = { id: randomId(), from: fromId, to: toId, fromName: from.name, expiresAt: g.clock.now() + CHALLENGE_TTL };
    this.#challenges.set(c.id, c);
    g.hub.toUser(toId, { type: "duel_challenge", challengeId: c.id, from: from.name, fromId, level: from.level, expiresAt: c.expiresAt });
    setTimeout(() => this.#challenges.delete(c.id), CHALLENGE_TTL + 1000).unref();

    if (toIsBot) {
      // Companion bot immediately auto-accepts challenge!
      this.respond(toId, c.id, true);
    }
    return c.id;
  }

  respond(userId: number, challengeId: string, accept: boolean) {
    const c = this.#challenges.get(challengeId);
    if (!c || c.to !== userId || c.expiresAt < this.g.clock.now()) throw notFound("Challenge");
    this.#challenges.delete(challengeId);
    if (!accept) {
      this.g.hub.toUser(c.from, { type: "duel_declined", by: findPlayer(this.g, userId)?.name ?? "Your opponent" });
      return null;
    }
    if (this.#byUser.has(c.from) || this.#byUser.has(c.to)) throw new GameError("One of you is already in a live duel.");
    const state = createBattle({ seed: freshSeed(), player: snapshotFighter(this.g, c.from), enemy: snapshotFighter(this.g, c.to), canFlee: false, maxTurns: 30 });
    const room: Room = { id: randomId(), a: c.from, b: c.to, state, pending: {}, deadline: 0, timer: null, missed: { a: 0, b: 0 } };
    this.#rooms.set(room.id, room);
    this.#byUser.set(room.a, room.id);
    this.#byUser.set(room.b, room.id);
    this.#armTimer(room);
    this.#broadcast(room, "duel_start");
    return room.id;
  }

  roomFor(userId: number) {
    const id = this.#byUser.get(userId);
    const room = id ? this.#rooms.get(id) : undefined;
    return room ? this.#view(room, userId) : null;
  }

  act(userId: number, roomId: string, action: BattleAction) {
    const room = this.#rooms.get(roomId);
    if (!room || (room.a !== userId && room.b !== userId)) throw notFound("Duel");
    const side = room.a === userId ? "a" : "b";
    const invalid = validateAction(room.state, side === "a" ? "player" : "enemy", action);
    if (invalid) throw new GameError(invalid);
    if (action.type === "item") throw new GameError("Potions aren't allowed in duels.");
    room.pending[side] = action;
    room.missed[side] = 0;

    const otherId = side === "a" ? room.b : room.a;
    if (isBotUser(this.g, otherId)) {
      const otherSide = side === "a" ? "b" : "a";
      room.pending[otherSide] = autoAction(room.state, otherSide === "a" ? "player" : "enemy");
      room.missed[otherSide] = 0;
    }

    if (room.pending.a && room.pending.b) {
      this.#resolve(room);
    } else {
      this.g.hub.toUser(side === "a" ? room.b : room.a, { type: "duel_opponent_ready", roomId });
    }
  }

  forfeit(userId: number) {
    const id = this.#byUser.get(userId);
    const room = id ? this.#rooms.get(id) : undefined;
    if (!room) return;
    if (room.a === userId) room.state.player.hp = 0;
    else room.state.enemy.hp = 0;
    room.state.status = room.a === userId ? "lost" : "won";
    room.state.events = [{ t: "end", result: room.state.status }];
    this.#finish(room);
  }

  #armTimer(room: Room) {
    if (room.timer) clearTimeout(room.timer);
    room.deadline = this.g.clock.now() + ARENA_TURN_SECONDS * 1000;
    room.timer = setTimeout(() => this.#resolve(room), ARENA_TURN_SECONDS * 1000);
    room.timer.unref();
  }

  #resolve(room: Room) {
    if (!this.#rooms.has(room.id)) return;
    if (!room.pending.a) room.missed.a++;
    if (!room.pending.b) room.missed.b++;
    const a = room.pending.a ?? autoAction(room.state, "player");
    const b = room.pending.b ?? autoAction(room.state, "enemy");
    room.pending = {};
    room.state = resolveRound(room.state, { player: a, enemy: b });
    // Walking away for three rounds concedes.
    if (room.state.status === "active" && (room.missed.a >= 3 || room.missed.b >= 3)) {
      room.state.status = room.missed.a >= 3 ? "lost" : "won";
      room.state.events.push({ t: "end", result: room.state.status });
    }
    if (room.state.status !== "active") this.#finish(room);
    else {
      this.#armTimer(room);
      this.#broadcast(room, "duel_round");
    }
  }

  #finish(room: Room) {
    if (room.timer) clearTimeout(room.timer);
    this.#rooms.delete(room.id);
    this.#byUser.delete(room.a);
    this.#byUser.delete(room.b);
    const winner = room.state.status === "won" ? room.a : room.state.status === "lost" ? room.b : null;
    const g = this.g;
    try {
      g.db.tx(() => {
        g.db.run("INSERT INTO arena_matches (id, kind, a_id, b_id, winner_id, rating_delta, created_at) VALUES (?, 'live', ?, ?, ?, 0, ?)", room.id, room.a, room.b, winner, g.clock.now());
        if (winner) {
          withPlayer(g, winner, (p) => {
            bump(g, p, "duelsWon");
            bumpMission(p, "duel");
            grantXp(g, p, 40 + p.level * 12, { applyBonus: true });
          });
        }
      });
    } catch (err) {
      g.log.error({ err }, "failed to persist live duel");
    }
    this.#broadcast(room, "duel_end", { winnerId: winner });
  }

  #view(room: Room, userId: number) {
    const mine = room.a === userId ? "player" : "enemy";
    const { seed: _seed, ...state } = room.state;
    return { roomId: room.id, side: mine, state, deadline: room.deadline, waitingOnYou: !(room.a === userId ? room.pending.a : room.pending.b) };
  }

  #broadcast(room: Room, type: string, extra: Record<string, unknown> = {}) {
    for (const uid of [room.a, room.b]) this.g.hub.toUser(uid, { type, ...this.#view(room, uid), ...extra });
  }

  shutdown() {
    for (const room of this.#rooms.values()) if (room.timer) clearTimeout(room.timer);
  }
}

export { ARENA_MIN_LEVEL };
