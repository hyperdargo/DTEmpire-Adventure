import {
  ABYSS_BOONS,
  ABYSS_BOON_BY_ID,
  ABYSS_BOON_EVERY,
  ABYSS_CORRUPTION_EVERY,
  ABYSS_FOES,
  ABYSS_MIN_LEVEL,
  ABYSS_SHOP,
  ABYSS_SHOP_BY_ID,
  abyssWaveLevel,
} from "../../shared/data/abyss.ts";
import { GEAR_BY_ID } from "../../shared/data/items.ts";
import { combatantFromMonster } from "../../shared/rules/combat.ts";
import { rollGear } from "../../shared/rules/items.ts";
import { monsterStats } from "../../shared/rules/monsters.ts";
import { type Rng, createRng, freshSeed } from "../../shared/rules/rng.ts";
import { GameError, conflict } from "../lib/errors.ts";
import { assertCanStartBattle, heroCombatant, insertBattle, registerFinalizer } from "./battles.ts";
import type { GameCtx } from "./context.ts";
import { addGear, addStack, bump, countStack, heroStats, type Player, takeStack } from "./player.ts";

export interface AbyssRun {
  wave: number;
  hp: number;
  corruption: number;
  shards: number;
  boons: string[];
  pendingBoons: string[] | null;
}

type WithAbyss = {
  abyssRun?: AbyssRun;
};

function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function getAbyssRun(p: Player): AbyssRun | null {
  return (p.state as WithAbyss).abyssRun ?? null;
}

export function abyssView(g: GameCtx, p: Player) {
  const run = getAbyssRun(p);
  const shardsOwned = countStack(g, p.userId, "abyss_shard");

  // Top 50 deepest divers from players table
  const top = g.db.all<{ user_id: number; name: string; abyss_best: number; level: number }>(
    `SELECT user_id, name, abyss_best, level FROM players WHERE abyss_best > 0 ORDER BY abyss_best DESC, level DESC LIMIT 50`
  );

  return {
    minLevel: ABYSS_MIN_LEVEL,
    unlocked: p.level >= ABYSS_MIN_LEVEL,
    bestWave: p.abyssBest,
    shardsOwned,
    run: run
      ? {
          wave: run.wave,
          hp: run.hp,
          maxHp: heroStats(g, p).maxHp,
          corruption: run.corruption,
          shards: run.shards,
          boons: run.boons.map((id) => ABYSS_BOON_BY_ID[id] ?? { id, name: id, icon: "✨", desc: "" }),
          pendingBoons: run.pendingBoons
            ? run.pendingBoons.map((id) => ABYSS_BOON_BY_ID[id] ?? { id, name: id, icon: "✨", desc: "" })
            : null,
          nextFoe: {
            level: abyssWaveLevel(run.wave),
            tier: run.wave % 10 === 0 ? "boss" : run.wave % 5 === 0 ? "elite" : "normal",
            def: ABYSS_FOES[(run.wave - 1) % ABYSS_FOES.length]!,
          },
        }
      : null,
    shop: ABYSS_SHOP.map((entry) => ({
      ...entry,
      unlocked: p.abyssBest >= entry.minWave,
      affordable: shardsOwned >= entry.price,
      owned: entry.kind === "title" ? (p.state.titles ?? []).includes(entry.ref) : false,
    })),
    leaderboard: top.map((r, i) => ({
      rank: i + 1,
      userId: r.user_id,
      name: r.name,
      bestWave: r.abyss_best,
      level: r.level,
    })),
  };
}

export function startAbyssRun(g: GameCtx, p: Player) {
  if (p.level < ABYSS_MIN_LEVEL) {
    throw new GameError(`The Endless Abyss requires level ${ABYSS_MIN_LEVEL}+ to enter.`, { code: "level_locked" });
  }
  const existing = getAbyssRun(p);
  if (existing) throw conflict("You already have an active Abyss dive in progress.");
  assertCanStartBattle(g, p);

  const maxHp = heroStats(g, p).maxHp;
  const run: AbyssRun = {
    wave: 1,
    hp: maxHp,
    corruption: 0,
    shards: 0,
    boons: [],
    pendingBoons: null,
  };
  (p.state as WithAbyss).abyssRun = run;
  return abyssView(g, p);
}

export function fightAbyssWave(g: GameCtx, p: Player) {
  const run = getAbyssRun(p);
  if (!run) throw new GameError("No active Abyss run. Start a dive first.", { code: "no_run" });
  if (run.pendingBoons && run.pendingBoons.length > 0) {
    throw new GameError("You must choose an Abyssal Infusion before facing the next wave.", { code: "pending_boon" });
  }
  assertCanStartBattle(g, p);

  const wave = run.wave;
  const level = abyssWaveLevel(wave);
  const foeDef = ABYSS_FOES[(wave - 1) % ABYSS_FOES.length]!;
  const tier = wave % 10 === 0 ? "boss" : wave % 5 === 0 ? "elite" : "normal";

  // Base stats with corruption scaling (+5% per corruption)
  const baseStats = monsterStats(level, tier, foeDef.shape);
  const corruptionMult = 1 + run.corruption * 0.05;
  const scaledHp = Math.round(baseStats.hp * corruptionMult);
  const scaledAtk = Math.round(baseStats.atk * corruptionMult);

  const { combatant, pet } = heroCombatant(g, p);

  // Apply boon effects to player combatant
  if (run.boons.includes("void_siphon")) combatant.lifesteal = (combatant.lifesteal ?? 0) + 12;
  if (run.boons.includes("null_barrier")) {
    combatant.def = Math.round(combatant.def * 1.15);
    combatant.effects.push({ kind: "shield", value: 100, turns: 999 });
  }
  if (run.boons.includes("oblivion_strike")) {
    combatant.crit = Math.min(75, (combatant.crit ?? 5) + 10);
    combatant.critDmg = (combatant.critDmg ?? 150) + 30;
  }
  if (run.boons.includes("dark_pact")) {
    combatant.atk = Math.round(combatant.atk * 1.25);
  }
  if (run.boons.includes("fleet_void")) {
    combatant.spd = Math.round(combatant.spd * 1.2);
  }

  // Health persists across waves
  combatant.hp = Math.max(1, Math.min(combatant.maxHp, run.hp));

  const enemy = combatantFromMonster({
    name: `[W${wave}] ${foeDef.name}`,
    icon: foeDef.icon,
    level,
    hp: scaledHp,
    atk: scaledAtk,
    def: baseStats.def,
    spd: baseStats.spd,
    isBoss: tier === "boss",
  });

  return insertBattle(
    g,
    p.userId,
    "abyss",
    { wave, foeId: foeDef.id, foeName: foeDef.name, level, tier, corruption: run.corruption },
    { player: combatant, enemy, pet, canFlee: false },
  );
}

export function chooseAbyssBoon(g: GameCtx, p: Player, boonId: string) {
  const run = getAbyssRun(p);
  if (!run) throw new GameError("No active Abyss run.", { code: "no_run" });
  if (!run.pendingBoons || !run.pendingBoons.includes(boonId)) {
    throw new GameError("That infusion is not available.", { code: "invalid_boon" });
  }

  run.boons.push(boonId);
  run.pendingBoons = null;

  if (boonId === "aether_flow") {
    const maxHp = heroStats(g, p).maxHp;
    run.hp = Math.min(maxHp, run.hp + Math.round(maxHp * 0.5));
  }

  p.notices.push({
    kind: "toast",
    tone: "good",
    icon: "🔮",
    text: `Absorbed ${ABYSS_BOON_BY_ID[boonId]?.name ?? boonId} infusion.`,
  });
  return abyssView(g, p);
}

export function leaveAbyss(g: GameCtx, p: Player) {
  const run = getAbyssRun(p);
  if (!run) throw new GameError("No active Abyss run.", { code: "no_run" });

  const shards = run.shards;
  if (shards > 0) {
    addStack(g, p.userId, "abyss_shard", shards);
  }

  const cleared = run.wave - 1;
  if (cleared > p.abyssBest) {
    p.abyssBest = cleared;
  }

  (p.state as WithAbyss).abyssRun = undefined;
  p.notices.push({
    kind: "toast",
    tone: "good",
    icon: "🌌",
    text: `Surfaced from the Abyss at Wave ${cleared}. Banked ${shards} Abyssal Shards!`,
  });
  return abyssView(g, p);
}

export function buyAbyssShop(g: GameCtx, p: Player, entryId: string) {
  const entry = ABYSS_SHOP_BY_ID[entryId];
  if (!entry) throw new GameError("Unknown Abyss shop item.", { code: "not_found" });

  if (p.abyssBest < entry.minWave) {
    throw new GameError(`Requires clearing Wave ${entry.minWave} in the Abyss to unlock (your best is Wave ${p.abyssBest}).`, {
      code: "wave_locked",
    });
  }

  takeStack(g, p.userId, "abyss_shard", entry.price, "Abyssal Shards");

  const rng = createRng(freshSeed());
  if (entry.kind === "gear") {
    const template = GEAR_BY_ID[entry.ref];
    if (!template) throw new GameError("Item template missing.", { code: "missing_template" });
    const rolled = rollGear(rng, template, Math.max(15, p.level), "epic");
    addGear(g, p.userId, {
      kind: "gear",
      templateId: entry.ref,
      rarity: rolled.rarity,
      ilvl: rolled.ilvl,
      base: rolled.base as Record<string, number>,
      affixes: rolled.affixes,
    });
    p.notices.push({ kind: "toast", tone: "good", icon: "⚔️", text: `Forged ${entry.name}!` });
  } else if (entry.kind === "stack") {
    addStack(g, p.userId, entry.ref, 1);
    p.notices.push({ kind: "toast", tone: "good", icon: "✨", text: `Acquired ${entry.name}.` });
  } else if (entry.kind === "title") {
    p.state.titles ??= [];
    if (!p.state.titles.includes(entry.ref)) {
      p.state.titles.push(entry.ref);
    }
    p.notices.push({ kind: "toast", tone: "good", icon: "📜", text: `Claimed title: ${entry.ref}` });
  }

  return abyssView(g, p);
}

registerFinalizer("abyss", (g, p, b) => {
  const run = getAbyssRun(p);
  if (!run) return { result: b.state.status };

  const c = b.context as { wave: number; foeName: string; level: number; tier: string; corruption: number };

  if (b.state.status !== "won") {
    bump(g, p, "deaths");
    const cleared = Math.max(0, run.wave - 1);
    if (cleared > p.abyssBest) p.abyssBest = cleared;

    // Bank 50% on wipe
    const kept = Math.floor(run.shards * 0.5);
    if (kept > 0) addStack(g, p.userId, "abyss_shard", kept);

    const maxHp = heroStats(g, p).maxHp;
    p.hp = Math.max(1, Math.round(maxHp * 0.1));
    p.hpAt = g.clock.now();

    (p.state as WithAbyss).abyssRun = undefined;
    p.notices.push({
      kind: "toast",
      tone: "warn",
      icon: "💀",
      text: `Defeated in the Abyss at Wave ${run.wave}. Preserved ${kept} Abyssal Shards.`,
    });
    return { result: b.state.status };
  }

  // Hero won
  const baseShards = Math.max(3, Math.round(run.wave * 1.5 + run.corruption * 2));
  const greedMult = run.boons.includes("void_greed") ? 1.4 : 1;
  const shardsWon = Math.round(baseShards * greedMult);
  run.shards += shardsWon;

  // Partial recovery after clearing a wave (+15% max HP surge)
  const maxHp = heroStats(g, p).maxHp;
  run.hp = Math.min(maxHp, Math.round(b.state.player.hp + maxHp * 0.15));

  if (run.wave > p.abyssBest) {
    p.abyssBest = run.wave;
  }

  // Stacking corruption every ABYSS_CORRUPTION_EVERY waves
  if (run.wave % ABYSS_CORRUPTION_EVERY === 0) {
    run.corruption += 1;
  }

  // Offer boons every ABYSS_BOON_EVERY waves
  if (run.wave % ABYSS_BOON_EVERY === 0) {
    const unchosen = ABYSS_BOONS.filter((boon) => !run.boons.includes(boon.id)).map((boon) => boon.id);
    const rng = createRng(freshSeed());
    run.pendingBoons = shuffle(unchosen, rng).slice(0, 3);
  }

  if (run.wave % 10 === 0) {
    g.hub.toChannel("world", {
      type: "feed",
      icon: "🌀",
      text: `${p.name} conquered Wave ${run.wave} of the Endless Abyss!`,
      at: g.clock.now(),
    });
  }

  run.wave += 1;
  p.notices.push({
    kind: "toast",
    tone: "good",
    icon: "🌌",
    text: `Cleared Wave ${c.wave}! +${shardsWon} Abyssal Shards.`,
  });

  return { result: "won" };
});
