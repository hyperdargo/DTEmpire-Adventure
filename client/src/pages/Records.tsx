import { useState } from "react";
import { GameCard } from "../components/GameCard.tsx";
import { Bar, Button, Loading, PageHead, Panel, Tabs } from "../components/ui.tsx";
import { fmt } from "../lib/format.ts";
import { useAction, useData } from "../state/game.ts";
import { regionRarity } from "./Adventure.tsx";

interface Bestiary {
  tiers: { kills: number; name: string; coins: number }[];
  regions: { id: string; name: string; icon: string; minLevel: number; creatures: { key: string; name: string | null; icon: string | null; boss: boolean; kills: number; rank: number; bonus: { atkPct: number; defPct: number } }[] }[];
}
interface Achievements { achievements: { id: string; name: string; icon: string; desc: string; goal: number; progress: number; done: boolean; coins: number; title?: string }[]; titles: string[]; active: string | null }

export default function RecordsPage() {
  const [tab, setTab] = useState<"bestiary" | "achievements">("bestiary");
  return (
    <>
      <PageHead title="Records">Every creature you've slain and every deed you've done.</PageHead>
      <Tabs label="Records" value={tab} onChange={setTab} options={[{ value: "bestiary", label: "Bestiary" }, { value: "achievements", label: "Achievements & titles" }]} />
      <div style={{ marginTop: "var(--s-5)" }}>{tab === "bestiary" ? <BestiaryView /> : <AchievementsView />}</div>
    </>
  );
}

function BestiaryView() {
  const { data, isPending } = useData<Bestiary>(["bestiary"], "/api/bestiary");
  if (isPending || !data) return <Loading rows={4} />;
  const all = data.regions.flatMap((r) => r.creatures);
  const found = all.filter((c) => c.kills > 0).length;
  return (
    <div className="stack stack--lg">
      <Panel tight>
        <Bar value={found} max={all.length} kind="xp" showNumbers label="Creatures discovered" />
        <p className="faint" style={{ marginTop: "var(--s-3)" }}>Mastery ranks: {data.tiers.map((t) => `${t.name} at ${t.kills} kills`).join(" · ")}. Each rank adds +3% attack and +2% defense against that creature.</p>
      </Panel>
      {data.regions.map((r, i) => (
        <section key={r.id}>
          <h2 className="section-title"><span className="art" aria-hidden>{r.icon}</span> {r.name} <span className="faint">Lv {r.minLevel}+</span></h2>
          <div className="grid-cards" style={{ "--card-min": "130px" } as React.CSSProperties}>
            {r.creatures.map((c) => (
              <GameCard key={c.key} size="sm" rarity={c.boss ? "mythic" : c.kills ? regionRarity(i, data.regions.length) : "common"} art={c.icon ?? "❔"} name={c.name ?? "Undiscovered"}
                type={c.kills ? `${fmt(c.kills)} slain` : c.boss ? "Boss" : "Unknown"} disabled={!c.kills}
                badge={c.rank ? data.tiers[c.rank - 1]?.name : undefined} label={c.name ?? "Undiscovered creature"} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function AchievementsView() {
  const { data, isPending } = useData<Achievements>(["achievements"], "/api/achievements");
  const setTitle = useAction<{ title: string | null }>("/api/profile", { invalidate: [["achievements"]], success: "Title updated." });
  if (isPending || !data) return <Loading rows={4} />;
  const done = data.achievements.filter((a) => a.done).length;
  return (
    <div className="stack stack--lg">
      <Panel title="Titles">
        {data.titles.length === 0 ? <p className="muted">Some achievements grant titles to wear beside your name.</p> : (
          <div className="row row--wrap">
            <Button size="sm" variant={data.active ? "default" : "primary"} onClick={() => setTitle.mutate({ title: null })}>Class rank</Button>
            {data.titles.map((t) => <Button key={t} size="sm" variant={data.active === t ? "primary" : "default"} onClick={() => setTitle.mutate({ title: t })}>{t}</Button>)}
          </div>
        )}
      </Panel>
      <Panel title={`Achievements · ${done}/${data.achievements.length}`}>
        <ul className="quest-list">
          {data.achievements.map((a) => (
            <li key={a.id} className={`quest${a.done ? " quest--done" : ""}`}>
              <span className="art quest__art" aria-hidden>{a.icon}</span>
              <div className="quest__body">
                <b>{a.name}</b>
                <span className="faint">{a.desc}{a.title ? ` Grants the title “${a.title}”.` : ""}</span>
                {!a.done && <Bar value={a.progress} max={a.goal} kind="xp" showNumbers label="Progress" />}
              </div>
              <div className="quest__reward">{a.done ? <span className="chip chip--gold">Earned</span> : <span className="faint">+{fmt(a.coins)} coins</span>}</div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
