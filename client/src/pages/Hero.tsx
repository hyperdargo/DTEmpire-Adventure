import { useState } from "react";
import { ASCENSION_COST, CLASS_BY_ID, DUAL_CLASS_COST, DUAL_CLASS_LEVEL, REROLL_COST } from "../../../shared/data/classes.ts";
import { PARAGON_COST, PARAGON_MAX } from "../../../shared/data/meta.ts";
import { SKILLS, SKILL_MAX_RANK, loadoutSlots, skillRankMult, skillUpgradeCost } from "../../../shared/data/skills.ts";
import { SKILL_RUNES, SKILL_RUNE_BY_ID } from "../../../shared/data/skillRunes.ts";
import { SKILL_FUSIONS, type SkillFusionRecipe } from "../../../shared/data/skillFusions.ts";
import type { EquipSlot, ItemView } from "../../../shared/data/types.ts";
import { RARITY_ORDER } from "../../../shared/rules/progression.ts";
import { GameCard, ItemCard } from "../components/GameCard.tsx";
import { HeroCard } from "../components/HeroCard.tsx";
import { ItemSheet } from "../components/ItemSheet.tsx";
import { Bar, Button, Coins, PageHead, Panel, Sheet, Tabs } from "../components/ui.tsx";
import { STAT_LABEL, fmt, statValue } from "../lib/format.ts";
import { useAction, useData, useHero } from "../state/game.ts";

const SLOTS: { slot: EquipSlot; label: string; art: string }[] = [
  { slot: "weapon", label: "Weapon", art: "⚔️" },
  { slot: "armor", label: "Armor", art: "🛡️" },
  { slot: "helmet", label: "Helm", art: "⛑️" },
  { slot: "boots", label: "Boots", art: "👢" },
  { slot: "accessory", label: "Relic", art: "💍" },
];

export default function HeroPage() {
  const [tab, setTab] = useState<"gear" | "skills" | "class">("gear");
  return (
    <>
      <PageHead title="Hero">Your class, your gear and your skills. Everything here feeds the numbers on your card.</PageHead>
      <div className="hero-layout">
        <aside className="hero-layout__card"><HeroCard /><StatsPanel /></aside>
        <div className="stack stack--lg">
          <Tabs label="Hero sections" value={tab} onChange={setTab} options={[{ value: "gear", label: "Gear" }, { value: "skills", label: "Skills" }, { value: "class", label: "Class" }]} />
          {tab === "gear" && <GearPanel />}
          {tab === "skills" && <SkillsPanel />}
          {tab === "class" && <ClassPanel />}
        </div>
      </div>
    </>
  );
}

function StatsPanel() {
  const { hero } = useHero();
  const s = hero.stats;
  const rows: [string, number][] = [["hp", hero.maxHp], ["atk", s.atk], ["def", s.def], ["spd", s.spd], ["crit", s.crit], ["critDmg", s.critDmg], ["dodge", s.dodge], ["lifesteal", s.lifesteal], ["luck", s.luck], ["xpBonus", s.xpBonus]];
  return (
    <dl className="stats" aria-label="Stats">
      {rows.map(([k, v]) => <div className="stat" key={k}><dt>{STAT_LABEL[k]}</dt><dd className="num">{statValue(k, v)}</dd></div>)}
      <div className="stat"><dt>Power</dt><dd className="gold num">{fmt(s.power)}</dd></div>
    </dl>
  );
}

function GearPanel() {
  const { data } = useData<{ items: ItemView[] }>(["inventory"], "/api/inventory");
  const [open, setOpen] = useState<number | null>(null);
  const [picking, setPicking] = useState<EquipSlot | null>(null);
  const items = data?.items ?? [];
  const { hero } = useHero();
  const equip = useAction<{ itemId: number }>("/api/inventory/equip", { invalidate: [["inventory"]], success: "Equipped.", onSuccess: () => setPicking(null) });
  const candidates = picking ? items.filter((i) => i.kind === picking && !i.equipped).sort((a, b) => b.power - a.power) : [];
  return (
    <Panel title="Equipment" action={<span className="faint">Tap a slot to swap gear</span>}>
      <div className="slots">
        {SLOTS.map(({ slot, label, art }) => {
          const worn = items.find((i) => i.equipped && i.kind === slot);
          return (
            <div key={slot} className="slot">
              <span className="slot__label">{label}</span>
              {worn ? <ItemCard item={worn} size="md" onClick={() => setOpen(worn.id)} /> : (
                <GameCard size="md" rarity="common" art={art} name={`Empty ${label.toLowerCase()}`} type="Nothing equipped" text="Tap to choose." disabled onClick={() => setPicking(slot)} />
              )}
              {worn && <Button size="sm" variant="ghost" onClick={() => setPicking(slot)}>Swap</Button>}
            </div>
          );
        })}
      </div>
      <p className="faint" style={{ marginTop: "var(--s-4)" }}>Your {hero.class.name} fights best with a {hero.class.weapon}: matching weapons deal 15% more attack.</p>
      <ItemSheet item={items.find((i) => i.id === open) ?? null} items={items} onClose={() => setOpen(null)} />
      <Sheet open={!!picking} onClose={() => setPicking(null)} title={`Choose ${picking ?? ""}`} wide>
        {candidates.length === 0 ? <p className="muted">No spare {picking} in your bag. Monsters, the Market and the Blacksmith all provide gear.</p> : (
          <div className="grid-cards" style={{ "--card-min": "140px" } as React.CSSProperties}>
            {candidates.map((c) => <ItemCard key={c.id} item={c} size="md" disabled={c.levelReq > hero.level} onClick={c.levelReq > hero.level ? undefined : () => equip.mutate({ itemId: c.id })} />)}
          </div>
        )}
      </Sheet>
    </Panel>
  );
}

function SkillsPanel() {
  const { hero } = useHero();
  const [skillTab, setSkillTab] = useState<"grimoire" | "fusion" | "infusion">("grimoire");
  const [grimoireFilter, setGrimoireFilter] = useState<"all" | "slotted" | "base" | "fused">("all");
  const [infuseSkillId, setInfuseSkillId] = useState<string>("");

  const { data } = useData<{
    skills: { skill_id: string; rank: number; slot: number | null; rune: string | null }[];
    fusions?: SkillFusionRecipe[];
  }>(["skills"], "/api/skills");

  const known = new Map((data?.skills ?? []).map((s) => [s.skill_id, s]));
  const slots = loadoutSlots(hero.level);
  const loadout = (data?.skills ?? []).filter((s) => s.slot != null).sort((a, b) => a.slot! - b.slot!).map((s) => s.skill_id);

  const learn = useAction<{ skillId: string }>("/api/skills/learn", { invalidate: [["skills"]], success: "Skill learned." });
  const rank = useAction<{ skillId: string }>("/api/skills/rank", { invalidate: [["skills"]], success: "Skill ranked up." });
  const fuse = useAction<{ fusionId: string }>("/api/skills/fuse", { invalidate: [["skills"]], success: "Legendary skill synthesized!" });
  const infuse = useAction<{ skillId: string; runeId: string }>("/api/skills/infuse", { invalidate: [["skills"]], success: "Rune infused into skill." });
  const clearRune = useAction<{ skillId: string }>("/api/skills/clear-rune", { invalidate: [["skills"]], success: "Rune removed." });
  const setLoadout = useAction<{ skillIds: string[] }>("/api/skills/loadout", { invalidate: [["skills"]] });

  const toggle = (id: string) => {
    const next = loadout.includes(id) ? loadout.filter((x) => x !== id) : loadout.length < slots ? [...loadout, id] : null;
    if (next) setLoadout.mutate({ skillIds: next });
  };

  const allKnownList = (data?.skills ?? []).map((s) => ({
    ...s,
    def: SKILLS.find((sk) => sk.id === s.skill_id),
  })).filter((s) => s.def);

  const activeInfuseSkill = allKnownList.find((s) => s.skill_id === (infuseSkillId || allKnownList[0]?.skill_id));

  const filteredSkills = SKILLS.filter((s) => {
    if (grimoireFilter === "slotted") return loadout.includes(s.id);
    if (grimoireFilter === "base") return !s.isFused;
    if (grimoireFilter === "fused") return s.isFused;
    return true;
  });

  return (
    <Panel
      title="Skills & Synthesis"
      action={<span className="faint">{loadout.length} / {slots} slotted (Lv 40: 4, Lv 75: 5, Lv 120: 6)</span>}
    >
      <div style={{ marginBottom: "var(--s-4)" }}>
        <Tabs
          label="Skill section"
          value={skillTab}
          onChange={(v) => setSkillTab(v as "grimoire" | "fusion" | "infusion")}
          options={[
            { value: "grimoire", label: "📜 Grimoire & Loadout" },
            { value: "fusion", label: "⚡ Skill Fusion Altar" },
            { value: "infusion", label: "🔮 Rune Infusion" },
          ]}
        />
      </div>

      {skillTab === "grimoire" && (
        <div className="stack">
          <div className="row row--wrap row--between" style={{ alignItems: "center", gap: "var(--s-2)" }}>
            <p className="muted" style={{ margin: 0 }}>
              Equip up to {slots} skills for combat. Each rank beyond 1 adds +12% power up to Rank {SKILL_MAX_RANK}.
            </p>
            <div className="row" style={{ gap: "4px" }}>
              <Button size="sm" variant={grimoireFilter === "all" ? "primary" : "ghost"} onClick={() => setGrimoireFilter("all")}>All</Button>
              <Button size="sm" variant={grimoireFilter === "slotted" ? "primary" : "ghost"} onClick={() => setGrimoireFilter("slotted")}>Slotted ({loadout.length})</Button>
              <Button size="sm" variant={grimoireFilter === "base" ? "primary" : "ghost"} onClick={() => setGrimoireFilter("base")}>Base</Button>
              <Button size="sm" variant={grimoireFilter === "fused" ? "primary" : "ghost"} onClick={() => setGrimoireFilter("fused")}>Fused</Button>
            </div>
          </div>

          <div className="grid-cards" style={{ "--card-min": "165px" } as React.CSSProperties}>
            {filteredSkills.map((s) => {
              const k = known.get(s.id);
              const slotted = loadout.includes(s.id);
              const locked = hero.level < s.levelReq;
              const runeDef = k?.rune ? SKILL_RUNE_BY_ID[k.rune] : null;

              return (
                <div key={s.id} className="skill" style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
                  <GameCard
                    size="md"
                    rarity={k ? (s.isFused ? "legendary" : k.rank >= 6 ? "legendary" : k.rank >= 3 ? "epic" : "rare") : "common"}
                    art={s.icon}
                    name={s.name}
                    cost={`${s.cooldown}t`}
                    type={
                      k
                        ? `Rank ${k.rank}/${SKILL_MAX_RANK} · ×${skillRankMult(k.rank).toFixed(2)}`
                        : locked
                        ? `Level ${s.levelReq}`
                        : s.isFused
                        ? "Synthesize at Altar"
                        : "Not learned"
                    }
                    text={s.desc}
                    disabled={!k}
                    selected={slotted}
                    onClick={k ? () => toggle(s.id) : undefined}
                    label={`${s.name}${slotted ? ", slotted" : ""}`}
                  />

                  {runeDef && (
                    <div style={{ textAlign: "center" }}>
                      <span className="chip chip--gold" style={{ fontSize: "0.75rem", padding: "2px 8px" }}>
                        <span className="art">{runeDef.icon}</span> {runeDef.name}
                      </span>
                    </div>
                  )}

                  {!k ? (
                    s.isFused ? (
                      <Button size="sm" variant="ghost" onClick={() => setSkillTab("fusion")}>
                        ⚡ Fusion Altar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={locked || hero.coins < s.price}
                        loading={learn.isPending}
                        onClick={() => learn.mutate({ skillId: s.id })}
                      >
                        {locked ? `Level ${s.levelReq}` : <>Learn · <Coins value={s.price} compact /></>}
                      </Button>
                    )
                  ) : k.rank < SKILL_MAX_RANK ? (
                    <Button
                      size="sm"
                      disabled={hero.coins < skillUpgradeCost(s, k.rank)}
                      loading={rank.isPending}
                      onClick={() => rank.mutate({ skillId: s.id })}
                    >
                      Rank up ({k.rank + 1}) · <Coins value={skillUpgradeCost(s, k.rank)} compact />
                    </Button>
                  ) : (
                    <span className="chip chip--gold" style={{ textAlign: "center", display: "block" }}>
                      👑 Max Rank ({SKILL_MAX_RANK})
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {skillTab === "fusion" && (
        <div className="stack">
          <div style={{ borderLeft: "3px solid #666", paddingLeft: "var(--s-3)", marginBottom: "var(--s-2)" }}>
            <p style={{ margin: 0 }}>
              <b>⚡ The Imperial Skill Altar</b>
            </p>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Synthesize two mastered skills (Rank 3+) into an ascended hybrid art. Fused skills inherit composite scaling and can be slotted alongside base skills.
            </p>
          </div>

          <div className="grid-cards" style={{ "--card-min": "320px" } as React.CSSProperties}>
            {SKILL_FUSIONS.map((f) => {
              const [p1Id, p2Id] = f.parents;
              const p1 = SKILLS.find((s) => s.id === p1Id);
              const p2 = SKILLS.find((s) => s.id === p2Id);
              const k1 = known.get(p1Id);
              const k2 = known.get(p2Id);
              const p1Ok = (k1?.rank ?? 0) >= f.minRank;
              const p2Ok = (k2?.rank ?? 0) >= f.minRank;
              const levelOk = hero.level >= f.skill.levelReq;
              const hasGold = hero.coins >= f.cost;
              const alreadyFused = known.has(f.id);
              const canFuse = !alreadyFused && p1Ok && p2Ok && levelOk && hasGold;

              return (
                <div
                  key={f.id}
                  style={{
                    backgroundColor: "#111",
                    border: alreadyFused ? "1px solid #555" : "1px solid #333",
                    borderRadius: "8px",
                    padding: "var(--s-3)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "var(--s-3)",
                  }}
                >
                  <div className="stack" style={{ gap: "var(--s-2)" }}>
                    <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                      <div className="row" style={{ alignItems: "center", gap: "var(--s-2)" }}>
                        <span style={{ fontSize: "1.75rem" }}>{f.icon}</span>
                        <div>
                          <b style={{ color: "#fff", fontSize: "1.05rem" }}>{f.name}</b>
                          <div className="faint" style={{ fontSize: "0.8rem" }}>
                            Req Lv {f.skill.levelReq} · {f.skill.cooldown} turns CD
                          </div>
                        </div>
                      </div>
                      {alreadyFused && <span className="chip chip--gold">👑 Mastered</span>}
                    </div>

                    <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
                      {f.skill.desc}
                    </p>

                    <div style={{ backgroundColor: "#181818", padding: "8px 12px", borderRadius: "6px", fontSize: "0.85rem" }}>
                      <div className="faint" style={{ marginBottom: "4px" }}>Fusion Requirements:</div>
                      <div className="row row--wrap" style={{ gap: "8px" }}>
                        <span style={{ color: p1Ok ? "#a3e635" : "#ef4444" }}>
                          {p1Ok ? "✓" : "✗"} {p1?.icon} {p1?.name} (Rank {k1?.rank ?? 0}/{f.minRank})
                        </span>
                        <span>+</span>
                        <span style={{ color: p2Ok ? "#a3e635" : "#ef4444" }}>
                          {p2Ok ? "✓" : "✗"} {p2?.icon} {p2?.name} (Rank {k2?.rank ?? 0}/{f.minRank})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {alreadyFused ? (
                      <Button size="sm" variant="ghost" style={{ width: "100%" }} onClick={() => setSkillTab("grimoire")}>
                        View in Grimoire
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        style={{ width: "100%" }}
                        disabled={!canFuse}
                        loading={fuse.isPending}
                        onClick={() => fuse.mutate({ fusionId: f.id })}
                      >
                        {!levelOk
                          ? `Requires Hero Level ${f.skill.levelReq}`
                          : !p1Ok || !p2Ok
                          ? `Master Both Skills to Rank ${f.minRank}`
                          : <>⚡ Synthesize Fusion · <Coins value={f.cost} compact /></>}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {skillTab === "infusion" && (
        <div className="stack">
          <div style={{ borderLeft: "3px solid #666", paddingLeft: "var(--s-3)", marginBottom: "var(--s-2)" }}>
            <p style={{ margin: 0 }}>
              <b>🔮 The Rune Infusion Chamber</b>
            </p>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Socket elemental and mystical runes directly into any learned skill to add cooldown reduction, burning flame, life drain, or warding shields.
            </p>
          </div>

          {allKnownList.length === 0 ? (
            <p className="muted">Learn at least one skill in your Grimoire to begin infusing runes.</p>
          ) : (
            <div className="stack" style={{ gap: "var(--s-4)" }}>
              <div>
                <label className="faint" style={{ display: "block", marginBottom: "var(--s-2)" }}>
                  Select Skill to Infuse:
                </label>
                <div className="row row--wrap" style={{ gap: "8px" }}>
                  {allKnownList.map((item) => {
                    const isSelected = item.skill_id === activeInfuseSkill?.skill_id;
                    const r = item.rune ? SKILL_RUNE_BY_ID[item.rune] : null;
                    return (
                      <Button
                        key={item.skill_id}
                        size="sm"
                        variant={isSelected ? "primary" : "ghost"}
                        onClick={() => setInfuseSkillId(item.skill_id)}
                      >
                        <span className="art">{item.def?.icon}</span> {item.def?.name}
                        {r && <span style={{ marginLeft: "4px" }}>({r.icon})</span>}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {activeInfuseSkill && (
                <div style={{ backgroundColor: "#141414", border: "1px solid #333", borderRadius: "8px", padding: "var(--s-3)" }}>
                  <div className="row row--between" style={{ alignItems: "center", marginBottom: "var(--s-3)" }}>
                    <div className="row" style={{ alignItems: "center", gap: "var(--s-2)" }}>
                      <span style={{ fontSize: "1.75rem" }}>{activeInfuseSkill.def?.icon}</span>
                      <div>
                        <b>{activeInfuseSkill.def?.name}</b>
                        <div className="faint" style={{ fontSize: "0.85rem" }}>
                          Rank {activeInfuseSkill.rank} · {activeInfuseSkill.def?.cooldown} turn cooldown
                        </div>
                      </div>
                    </div>

                    {activeInfuseSkill.rune ? (
                      <div className="row" style={{ alignItems: "center", gap: "var(--s-2)" }}>
                        <span className="chip chip--gold">
                          Active: {SKILL_RUNE_BY_ID[activeInfuseSkill.rune]?.icon} {SKILL_RUNE_BY_ID[activeInfuseSkill.rune]?.name}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={clearRune.isPending}
                          onClick={() => clearRune.mutate({ skillId: activeInfuseSkill.skill_id })}
                        >
                          Remove Rune
                        </Button>
                      </div>
                    ) : (
                      <span className="faint">No Rune Infused</span>
                    )}
                  </div>

                  <div className="grid-cards" style={{ "--card-min": "200px" } as React.CSSProperties}>
                    {SKILL_RUNES.map((rune) => {
                      const isCurrent = activeInfuseSkill.rune === rune.id;
                      return (
                        <div
                          key={rune.id}
                          style={{
                            backgroundColor: isCurrent ? "#1c1c1c" : "#0d0d0d",
                            border: isCurrent ? "1px solid #888" : "1px solid #282828",
                            borderRadius: "6px",
                            padding: "var(--s-3)",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            gap: "var(--s-2)",
                          }}
                        >
                          <div>
                            <div className="row" style={{ alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                              <span style={{ fontSize: "1.25rem" }}>{rune.icon}</span>
                              <b style={{ fontSize: "0.95rem" }}>{rune.name}</b>
                            </div>
                            <div style={{ color: "#eab308", fontSize: "0.8rem", fontWeight: "bold" }}>
                              {rune.tagline}
                            </div>
                            <p className="muted" style={{ fontSize: "0.8rem", margin: "6px 0 0" }}>
                              {rune.desc}
                            </p>
                          </div>

                          <Button
                            size="sm"
                            variant={isCurrent ? "ghost" : "primary"}
                            disabled={isCurrent || hero.coins < rune.cost}
                            loading={infuse.isPending}
                            onClick={() => infuse.mutate({ skillId: activeInfuseSkill.skill_id, runeId: rune.id })}
                          >
                            {isCurrent ? "Infused" : <>Infuse · <Coins value={rune.cost} compact /></>}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function ClassPanel() {
  const { hero } = useHero();
  const reroll = useAction<void, { cls: { name: string; rarity: string } }>("/api/class/reroll", { success: (r) => `You are now a ${r.cls.rarity} ${r.cls.name}.` });
  const ascend = useAction("/api/class/ascend", { success: "Your class ascends." });
  const dual = useAction<void, { cls: { name: string } }>("/api/class/dual", { success: (r) => `Dual class awakened: ${r.cls.name}.` });
  const next = RARITY_ORDER[RARITY_ORDER.indexOf(hero.class.rarity) + 1];
  const ascendCost = next ? ASCENSION_COST[next] : undefined;
  const ascendLevel = next ? { uncommon: 10, rare: 25, epic: 45, legendary: 70 }[next as "uncommon"] : undefined;
  const [confirm, setConfirm] = useState(false);
  const cls = CLASS_BY_ID[hero.class.id]!;
  return (
    <div className="stack stack--lg">
      <Panel title={`${hero.class.name}`}>
        <p className="muted">{cls.passive.name}: {cls.passive.desc}. Rank: <b className="gold">{hero.class.rank.title}</b>.</p>
        <div className="class-actions">
          <div className="stack">
            <h3>Ascend</h3>
            <p className="muted">Raise your class's tier at the Temple for stronger base stats.</p>
            {ascendCost && ascendLevel ? (
              <Button variant="primary" disabled={hero.level < ascendLevel || hero.coins < ascendCost} loading={ascend.isPending} onClick={() => ascend.mutate(undefined)}>
                {hero.level < ascendLevel ? `Level ${ascendLevel} to ascend` : <>Ascend to {next} · <Coins value={ascendCost} compact /></>}
              </Button>
            ) : <span className="chip chip--gold">Highest tier reached</span>}
          </div>
          <div className="stack">
            <h3>Reroll</h3>
            <p className="muted">Draw a different class. There's a tiny chance of a one-of-a-kind unique class if it's unclaimed.</p>
            <Button disabled={cls.rarity === "unique" || hero.coins < REROLL_COST(hero.level)} onClick={() => setConfirm(true)}>Reroll · <Coins value={REROLL_COST(hero.level)} compact /></Button>
          </div>
        </div>
      </Panel>
      <Panel title="Dual class">
        {hero.dual ? (
          <div className="stack">
            <p><span className="art">{hero.dual.icon}</span> <b>{hero.dual.name}</b> · level {hero.dual.level} of 25. It shares half of your battle XP and lends you part of its base stats.</p>
            {hero.dual.level < 25 && <Bar value={hero.dual.xp} max={hero.dual.xpToNext} kind="xp" showNumbers label="Dual class XP" />}
          </div>
        ) : (
          <div className="stack">
            <p className="muted">From level {DUAL_CLASS_LEVEL}, awaken a second class that grows alongside you.</p>
            <Button variant="primary" disabled={hero.level < DUAL_CLASS_LEVEL || hero.coins < DUAL_CLASS_COST} loading={dual.isPending} onClick={() => dual.mutate(undefined)}>
              {hero.level < DUAL_CLASS_LEVEL ? `Level ${DUAL_CLASS_LEVEL} required` : <>Awaken · <Coins value={DUAL_CLASS_COST} compact /></>}
            </Button>
          </div>
        )}
      </Panel>
      <ParagonPanel />
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Reroll your class?">
        <div className="stack">
          <p>You'll lose the {hero.class.rarity} {hero.class.name} and its tier. Your level, gear, skills and pets stay.</p>
          <div className="row">
            <Button variant="danger" loading={reroll.isPending} onClick={() => { reroll.mutate(undefined); setConfirm(false); }}>Reroll</Button>
            <Button onClick={() => setConfirm(false)}>Keep my class</Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function ParagonPanel() {
  const { hero } = useHero();
  const ascendParagon = useAction<void, { paragon: number; titleAwarded?: string }>("/api/hero/paragon", {
    success: (r) => `Ascended to Paragon Rank ${r.paragon}!${r.titleAwarded ? ` Unlocked title: ${r.titleAwarded}` : ""}`,
  });

  const rank = (hero as unknown as { paragon?: number }).paragon ?? 0;
  const cost = PARAGON_COST(rank);
  const maxRank = PARAGON_MAX;
  const isMax = rank >= maxRank;
  const bonusPct = rank * 5;

  return (
    <Panel title="Paragon Transcendence ⚡">
      <div className="stack">
        <p className="muted">
          Available only to heroes of Level 100. Channel immense wealth into transcendent power. Each Paragon Rank permanently amplifies your Attack, Defense, and Max HP by <b>+5%</b>.
        </p>

        <div className="row" style={{ alignItems: "center", gap: "var(--s-4)" }}>
          <div style={{ fontSize: "2rem" }}>⚡</div>
          <div>
            <h4 style={{ margin: 0 }}>
              Current Rank: <span className="gold">Paragon {rank}</span>
            </h4>
            <p className="faint" style={{ margin: "var(--s-1) 0 0 0" }}>
              Permanent Stat Bonus: <b>+{bonusPct}% all base attributes</b>
            </p>
          </div>
        </div>

        {hero.level < 100 ? (
          <p className="faint">Reach Level 100 to awaken the Paragon Altar.</p>
        ) : isMax ? (
          <span className="chip chip--gold" style={{ alignSelf: "flex-start" }}>
            🌌 Maximum Paragon Rank Achieved
          </span>
        ) : (
          <Button
            variant="primary"
            disabled={hero.coins < cost}
            loading={ascendParagon.isPending}
            onClick={() => ascendParagon.mutate(undefined)}
          >
            {hero.coins < cost ? (
              <>Need <Coins value={cost} compact /> to Ascend</>
            ) : (
              <>Ascend to Paragon Rank {rank + 1} · <Coins value={cost} compact /></>
            )}
          </Button>
        )}
      </div>
    </Panel>
  );
}
