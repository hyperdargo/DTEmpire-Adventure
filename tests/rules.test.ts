import { describe, expect, it } from "vitest";
import { CLASSES } from "../shared/data/classes.ts";
import { CONSUMABLE_BY_ID, GEAR, GEAR_BY_ID, RECIPES } from "../shared/data/items.ts";
import { ACHIEVEMENTS } from "../shared/data/meta.ts";
import { PET_SPECIES } from "../shared/data/pets.ts";
import { REGIONS, STORY_CHAPTERS, allMonsters, towerEnemyNames } from "../shared/data/regions.ts";
import { SKILLS, SKILL_BY_NAME } from "../shared/data/skills.ts";
import { combatantFromMonster, createBattle, resolveRound, simulateBattle } from "../shared/rules/combat.ts";
import { itemStats, rollGear, sellPrice, upgradeCost } from "../shared/rules/items.ts";
import { monsterStats } from "../shared/rules/monsters.ts";
import { MAX_LEVEL, applyXp, xpToNext } from "../shared/rules/progression.ts";
import { createRng } from "../shared/rules/rng.ts";
import { winRate } from "../scripts/balance-sim.ts";

describe("content integrity", () => {
  it("keeps every piece of original content", () => {
    expect(CLASSES).toHaveLength(20);
    expect(SKILLS).toHaveLength(14);
    expect(REGIONS).toHaveLength(26);
    expect(STORY_CHAPTERS).toHaveLength(20);
    expect(allMonsters()).toHaveLength(166);
  });

  it("has unique ids and valid references", () => {
    expect(new Set(GEAR.map((g) => g.id)).size).toBe(GEAR.length);
    expect(new Set(REGIONS.map((r) => r.id)).size).toBe(REGIONS.length);
    for (const r of RECIPES) expect(GEAR_BY_ID[r.gearId], r.id).toBeDefined();
    for (const r of RECIPES) for (const m of Object.keys(r.materials)) expect(CONSUMABLE_BY_ID[m], m).toBeDefined();
    for (const ch of STORY_CHAPTERS) for (const s of ch.skills) expect(SKILL_BY_NAME[s], s).toBeDefined();
    for (const rarity of ["common", "uncommon", "rare", "epic", "legendary", "mythic"]) {
      expect(PET_SPECIES.some((p) => p.rarity === rarity), rarity).toBe(true);
    }
    const bestiaryGoal = ACHIEVEMENTS.find((a) => a.id === "bestiary_all")!.goal;
    expect(bestiaryGoal).toBe(allMonsters().length);
  });

  it("gives every class a level-1 weapon of its affinity", () => {
    for (const c of CLASSES) {
      expect(GEAR.some((g) => g.slot === "weapon" && g.weaponType === c.weapon && g.levelReq === 1), c.id).toBe(true);
    }
  });

  it("parses tower enemy names", () => {
    const names = towerEnemyNames(1);
    expect(names[0]).toEqual({ icon: "🐺", name: "Goblin" });
  });
});

describe("progression", () => {
  it("levels through thresholds and caps at the max level", () => {
    expect(applyXp(1, 0, xpToNext(1))).toEqual({ level: 2, xp: 0, gained: 1 });
    expect(applyXp(1, 0, 10_000_000).level).toBe(MAX_LEVEL);
    expect(applyXp(MAX_LEVEL, 0, 999).gained).toBe(0);
  });
});

describe("rng", () => {
  it("is deterministic per seed", () => {
    const a = createRng("seed");
    const b = createRng("seed");
    expect([a.next(), a.next(), a.int(1, 6)]).toEqual([b.next(), b.next(), b.int(1, 6)]);
  });
});

describe("items", () => {
  it("scales with rarity and upgrades", () => {
    const t = GEAR_BY_ID.iron_sword!;
    const common = rollGear(createRng(1), t, 20, "common");
    const epic = rollGear(createRng(1), t, 20, "epic");
    expect(epic.base.atk!).toBeGreaterThan(common.base.atk!);
    expect(epic.affixes).toHaveLength(2);
    const plus5 = itemStats({ base: common.base, affixes: [], upgrade: 5 });
    expect(plus5.atk!).toBeGreaterThan(common.base.atk!);
    expect(sellPrice({ templateId: t.id, rarity: "epic", ilvl: 20, upgrade: 0 })).toBeGreaterThan(sellPrice({ templateId: t.id, rarity: "common", ilvl: 20, upgrade: 0 }));
    expect(upgradeCost({ rarity: "common", ilvl: 20, upgrade: 10 })).toBeNull();
  });
});

describe("combat engine", () => {
  const foe = (level: number, boss = false) => combatantFromMonster({ name: "Foe", icon: "👹", level, ...monsterStats(level, boss ? "boss" : "normal"), isBoss: boss });

  it("is deterministic for the same seed and actions", () => {
    const start = createBattle({ seed: "fixed", player: foe(10), enemy: foe(10), canFlee: true });
    const a = resolveRound(start, { player: { type: "attack" } });
    const b = resolveRound(start, { player: { type: "attack" } });
    expect(a).toEqual(b);
    expect(start.turn).toBe(1);
  });

  it("bosses telegraph a heavy blow that guarding blunts", () => {
    let state = createBattle({ seed: "boss", player: { ...foe(20), maxHp: 100000, hp: 100000 }, enemy: foe(20, true), canFlee: false });
    const telegraphed: number[] = [];
    for (let i = 0; i < 8 && state.status === "active"; i++) {
      const charging = state.enemy.charging;
      state = resolveRound(state, { player: charging ? { type: "guard" } : { type: "attack" } });
      if (state.events.some((e) => e.t === "telegraph")) telegraphed.push(state.turn - 1);
    }
    expect(telegraphed).toContain(3);
  });

  it("ends with a result event", () => {
    const { state, rounds } = simulateBattle(createBattle({ seed: "x", player: foe(15), enemy: foe(15), canFlee: false }));
    expect(state.status).not.toBe("active");
    expect(rounds.at(-1)!.at(-1)!.t).toBe("end");
  });
});

describe("balance", () => {
  it.each([1, 10, 30, 60, 100])("an at-level hero reliably beats normal monsters at level %i", (level) => {
    const r = winRate("warrior", level, "normal", 40);
    expect(r.win).toBeGreaterThanOrEqual(0.95);
    expect(r.turns).toBeGreaterThan(1.5);
    expect(r.turns).toBeLessThan(8);
  });

  it.each([20, 50, 90])("bosses at level %i are winnable but last many turns", (level) => {
    const r = winRate("mage", level, "boss", 30, 3);
    expect(r.win).toBeGreaterThan(0.6);
    expect(r.turns).toBeGreaterThan(10);
  });
});

describe("lucky roll economy", () => {
  it("returns less than the stake on average", async () => {
    const { LUCKY_WEIGHTS, LUCKY_PAYOUT, LUCKY_PAIR_MULT } = await import("../shared/data/meta.ts");
    const total = Object.values(LUCKY_WEIGHTS).reduce((a, b) => a + b, 0);
    const p = Object.fromEntries(Object.entries(LUCKY_WEIGHTS).map(([k, w]) => [k, w / total]));
    let ev = 0;
    for (const a of Object.keys(p)) for (const b of Object.keys(p)) for (const c of Object.keys(p)) {
      const prob = p[a]! * p[b]! * p[c]!;
      if (a === b && b === c) ev += prob * LUCKY_PAYOUT[a as keyof typeof LUCKY_PAYOUT];
      else if (a === b || b === c || a === c) ev += prob * LUCKY_PAIR_MULT;
    }
    expect(ev).toBeLessThan(0.97);
    expect(ev).toBeGreaterThan(0.85);
  });
});
