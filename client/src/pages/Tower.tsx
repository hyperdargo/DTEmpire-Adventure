import { Castle, Crown, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CardBack, GameCard } from "../components/GameCard.tsx";
import { Button, Loading, PageHead, Panel } from "../components/ui.tsx";
import { useData, useHero } from "../state/game.ts";
import { useStartBattle } from "./Table.tsx";

interface Chapter { chapter: number; title: string; subtitle: string; floors: string; unlocked: boolean; complete: boolean; text: string | null; lore: string | null; boss: { name: string; emoji: string; line: string } | null; enemies: string | null; skills: string[] }
interface TowerItem {
  id: string;
  name: string;
  tagline: string;
  desc: string;
  levelReqBase: number;
  maxFloor: number;
  cleared: number;
  unlocked: boolean;
}
interface TowerView {
  tower: TowerItem;
  towers: TowerItem[];
  cleared: number;
  next: number;
  nextLevelReq: number;
  nextIsBoss: boolean;
  complete: boolean;
  chapter: number;
  chapters: Chapter[];
}

export default function TowerPage() {
  const { hero, activeBattle } = useHero();
  const [selectedTower, setSelectedTower] = useState<string>("ascension");
  const { data, isPending } = useData<TowerView>(["tower", selectedTower], `/api/tower?towerId=${selectedTower}`);
  const start = useStartBattle("/api/tower/start", [["tower", selectedTower], ["tower"]]);
  const [reading, setReading] = useState<number | null>(null);
  const current = useRef<HTMLLIElement>(null);

  // Center the next floor inside the floor column only; never scroll the page itself.
  useEffect(() => {
    const el = current.current;
    const list = el?.parentElement;
    if (!el || !list) return;
    const a = el.getBoundingClientRect();
    const b = list.getBoundingClientRect();
    if (list.scrollHeight > list.clientHeight) list.scrollTop += a.top - b.top - list.clientHeight / 2;
    else list.scrollLeft += a.left - b.left - list.clientWidth / 2;
  }, [data?.cleared]);

  if (isPending || !data) return <Loading rows={4} />;
  const chapter = data.chapters.find((c) => c.chapter === (reading ?? data.chapter)) ?? data.chapters[0]!;
  const locked = hero.level < data.nextLevelReq;
  const nextChapter = data.chapters.find((c) => c.chapter === data.chapter)!;

  const totalFloors = data.tower?.maxFloor ?? 100;

  return (
    <>
      <PageHead title={data.tower?.name ?? "Tower of Ascension"}>
        {data.tower?.desc ?? "Conquer the spires of the realm. Climb floor by floor, defeat chapter bosses, and earn celestial rewards."}
      </PageHead>

      <div style={{ display: "flex", gap: "8px", overflowX: "auto", marginBottom: "var(--s-4)", paddingBottom: "4px" }}>
        {(data.towers ?? []).map((t) => {
          const isSelected = t.id === selectedTower;
          return (
            <button
              key={t.id}
              type="button"
              disabled={!t.unlocked}
              onClick={() => setSelectedTower(t.id)}
              style={{
                backgroundColor: isSelected ? "#222" : "#111",
                border: isSelected ? "1px solid #fff" : "1px solid #333",
                borderRadius: "8px",
                padding: "10px 14px",
                color: t.unlocked ? "#fff" : "#666",
                cursor: t.unlocked ? "pointer" : "not-allowed",
                textAlign: "left",
                minWidth: "210px",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <b>{t.name}</b>
                <span className="chip chip--gold" style={{ fontSize: "0.75rem", padding: "1px 6px" }}>
                  {t.cleared}/{t.maxFloor}
                </span>
              </div>
              <div className="faint" style={{ fontSize: "0.8rem" }}>
                {t.unlocked ? t.tagline : `Requires Lv ${t.levelReqBase}`}
              </div>
            </button>
          );
        })}
      </div>

      <div className="tower">
        <ol className="tower__floors" aria-label="Floors">
          {Array.from({ length: totalFloors }, (_, i) => totalFloors - i).map((f) => {
            const state = f <= data.cleared ? "cleared" : f === data.next ? "next" : "ahead";
            return (
              <li key={f} ref={f === data.next ? current : undefined} className={`floor floor--${state}${f % 5 === 0 ? " floor--boss" : ""}`}>
                <span className="floor__n num">{f}</span>
                <span className="floor__mark" aria-hidden>{f % 5 === 0 ? <Crown size={13} /> : null}</span>
                <span className="sr-only">{state === "cleared" ? "cleared" : state === "next" ? "next floor" : "not reached"}{f % 5 === 0 ? ", boss floor" : ""}</span>
              </li>
            );
          })}
        </ol>

        <div className="stack stack--lg">
          <Panel>
            {data.complete ? (
              <div className="empty"><span className="art">🗝️</span><h3>Spire Conquered</h3><p>Every floor of {data.tower?.name} is conquered. Your name is carved into the pinnacle.</p></div>
            ) : (
              <div className="tower__next">
                {data.nextIsBoss && nextChapter.boss ? (
                  <GameCard size="lg" rarity="mythic" art={nextChapter.boss.emoji} name={nextChapter.boss.name} type={`Chapter ${nextChapter.chapter} boss`} text={nextChapter.boss.line} />
                ) : (
                  <CardBack size="lg" label={`Floor ${data.next}, face down`} />
                )}
                <div className="stack">
                  <h2>Floor {data.next}</h2>
                  <p className="muted">
                    {data.nextIsBoss ? "A chapter boss guards this floor. It telegraphs a crushing blow every few turns: guard when it winds up." : `${data.tower?.name} foes are elites: tougher than the wild, and they pay better.`}
                  </p>
                  <p className="faint">Requires level {data.nextLevelReq}. You can't flee inside the Tower.</p>
                  <Button variant="primary" size="lg" icon={locked ? <Lock size={18} /> : <Castle size={20} />} loading={start.isPending} disabled={locked || !!activeBattle || hero.inDungeon} onClick={() => start.mutate({ towerId: selectedTower })}>
                    {locked ? `Reach level ${data.nextLevelReq}` : `Climb to floor ${data.next}`}
                  </Button>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="The chronicle" action={<span className="faint">{data.chapters.filter((c) => c.complete).length} of 20 chapters complete</span>}>
            <div className="chapters" role="tablist" aria-label="Chapters">
              {data.chapters.map((c) => (
                <button key={c.chapter} type="button" role="tab" aria-selected={c.chapter === chapter.chapter} disabled={!c.unlocked}
                  className={`chapter-tab${c.complete ? " chapter-tab--done" : ""}`} onClick={() => setReading(c.chapter)}>
                  <span className="num">{c.chapter}</span>
                </button>
              ))}
            </div>
            <article className="chapter" aria-live="polite">
              <p className="faint">Chapter {chapter.chapter} · Floors {chapter.floors}</p>
              <h3>{chapter.title}</h3>
              <p className="chapter__sub">{chapter.subtitle}</p>
              {chapter.text ? chapter.text.split("\n\n").map((para, i) => <p key={i}>{para}</p>) : <p className="muted">Reach floor {chapter.floors.split("-")[0]} to read this chapter.</p>}
              {chapter.enemies && <p className="faint">Foes: {chapter.enemies}</p>}
              {chapter.lore && <blockquote className="chapter__lore">{chapter.lore}</blockquote>}
              {chapter.skills.length > 0 && <p className="gold">Completing this chapter teaches: {chapter.skills.join(", ")}.</p>}
            </article>
          </Panel>
        </div>
      </div>
    </>
  );
}
