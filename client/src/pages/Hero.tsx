import { useState } from "react";
import { ASCENSION_COST, CLASS_BY_ID, DUAL_CLASS_COST, DUAL_CLASS_LEVEL, REROLL_COST } from "../../../shared/data/classes.ts";
import { SKILLS, SKILL_MAX_RANK, loadoutSlots, skillRankMult, skillUpgradeCost } from "../../../shared/data/skills.ts";
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
  const { data } = useData<{ skills: { skill_id: string; rank: number; slot: number | null }[] }>(["skills"], "/api/skills");
  const known = new Map((data?.skills ?? []).map((s) => [s.skill_id, s]));
  const slots = loadoutSlots(hero.level);
  const loadout = (data?.skills ?? []).filter((s) => s.slot != null).sort((a, b) => a.slot! - b.slot!).map((s) => s.skill_id);
  const learn = useAction<{ skillId: string }>("/api/skills/learn", { invalidate: [["skills"]], success: "Skill learned." });
  const rank = useAction<{ skillId: string }>("/api/skills/rank", { invalidate: [["skills"]], success: "Skill ranked up." });
  const setLoadout = useAction<{ skillIds: string[] }>("/api/skills/loadout", { invalidate: [["skills"]] });
  const toggle = (id: string) => {
    const next = loadout.includes(id) ? loadout.filter((x) => x !== id) : loadout.length < slots ? [...loadout, id] : null;
    if (next) setLoadout.mutate({ skillIds: next });
  };

  return (
    <Panel title="Skills" action={<span className="faint">{loadout.length} / {slots} slotted</span>}>
      <p className="muted" style={{ marginBottom: "var(--s-4)" }}>Slotted skills appear as cards in battle. Each rank adds 12% to a skill's power. More skills come from the Tower's chapters and from Skill Books.</p>
      <div className="grid-cards" style={{ "--card-min": "160px" } as React.CSSProperties}>
        {SKILLS.map((s) => {
          const k = known.get(s.id);
          const slotted = loadout.includes(s.id);
          const locked = hero.level < s.levelReq;
          return (
            <div key={s.id} className="skill">
              <GameCard size="md" rarity={k ? (k.rank >= 4 ? "legendary" : k.rank >= 2 ? "epic" : "rare") : "common"} art={s.icon} name={s.name}
                cost={`${s.cooldown}t`} type={k ? `Rank ${k.rank} · ×${skillRankMult(k.rank).toFixed(2)}` : locked ? `Level ${s.levelReq}` : "Not learned"}
                text={s.desc} disabled={!k} selected={slotted} onClick={k ? () => toggle(s.id) : undefined} label={`${s.name}${slotted ? ", slotted" : ""}`} />
              {!k ? (
                <Button size="sm" disabled={locked || hero.coins < s.price} loading={learn.isPending} onClick={() => learn.mutate({ skillId: s.id })}>
                  {locked ? `Level ${s.levelReq}` : <>Learn · <Coins value={s.price} compact /></>}
                </Button>
              ) : k.rank < SKILL_MAX_RANK ? (
                <Button size="sm" disabled={hero.coins < skillUpgradeCost(s, k.rank)} onClick={() => rank.mutate({ skillId: s.id })}>Rank up · <Coins value={skillUpgradeCost(s, k.rank)} compact /></Button>
              ) : <span className="chip chip--gold">Max rank</span>}
            </div>
          );
        })}
      </div>
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
