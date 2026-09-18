// Balance report: an at-level hero in uncommon gear vs normal monsters, elites and bosses.
import { CLASSES } from "../shared/data/classes.ts";
import { SKILLS } from "../shared/data/skills.ts";
import { combatantFromHero, combatantFromMonster, createBattle, simulateBattle } from "../shared/rules/combat.ts";
import { pickGearTemplate, rollGear } from "../shared/rules/items.ts";
import { monsterStats, type MonsterTier } from "../shared/rules/monsters.ts";
import { createRng } from "../shared/rules/rng.ts";
import { computeHeroStats } from "../shared/rules/stats.ts";

export function heroAt(classId: string, level: number, seed: string) {
  const rng = createRng(seed);
  const equipped = (["weapon", "armor", "helmet", "boots", "accessory"] as const).map((slot) => {
    const t = pickGearTemplate(rng, level, slot);
    return { templateId: t.id, upgrade: Math.min(10, Math.floor(level / 12)), ...rollGear(rng, t, level, "uncommon") };
  });
  const stats = computeHeroStats({ classId, classRarity: "common", level, equipped });
  const skills = SKILLS.filter((s) => s.levelReq <= level).sort((a, b) => b.levelReq - a.levelReq).slice(0, 3).map((s) => ({ id: s.id, rank: 1 }));
  return { stats, skills };
}

export function winRate(classId: string, level: number, tier: MonsterTier, trials: number, potions = 0) {
  let wins = 0, hpLeft = 0, turns = 0;
  for (let i = 0; i < trials; i++) {
    const { stats, skills } = heroAt(classId, level, `hero-${classId}-${level}-${i}`);
    const m = monsterStats(level, tier);
    const player = combatantFromHero(stats, { name: "Hero", icon: "🧙", level, classId, skills }, stats.maxHp);
    const enemy = combatantFromMonster({ name: "Foe", icon: "👹", level, ...m, isBoss: tier === "boss" });
    const { state } = simulateBattle(createBattle({ seed: `b-${i}`, player, enemy, canFlee: false }), { potions, potionHealPct: 0.4 });
    if (state.status === "won") { wins++; hpLeft += state.player.hp / state.player.maxHp; }
    turns += state.turn;
  }
  return { win: wins / trials, hpLeft: wins ? hpLeft / wins : 0, turns: turns / trials };
}

if (process.argv[1]?.endsWith("balance-sim.ts")) {
  const classes = process.argv[2] ? [process.argv[2]] : ["warrior", "mage", "archer", "thief"];
  for (const tier of ["normal", "elite", "boss"] as MonsterTier[]) {
    console.log(`\n== ${tier} ==`);
    for (const level of [1, 5, 10, 20, 35, 50, 75, 100]) {
      const row = classes.map((c) => { const r = winRate(c, level, tier, 120, tier === "boss" ? 3 : 0); return `${c}:${(r.win * 100).toFixed(0)}% hp${(r.hpLeft * 100).toFixed(0)} t${r.turns.toFixed(1)}`; });
      console.log(`L${level}`.padEnd(5), row.join("  "));
    }
  }
  void CLASSES;
}
