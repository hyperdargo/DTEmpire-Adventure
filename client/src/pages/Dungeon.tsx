import { DoorOpen, Flame } from "lucide-react";
import { useState } from "react";
import { CONSUMABLE_BY_ID } from "../../../shared/data/items.ts";
import { GameCard } from "../components/GameCard.tsx";
import { Bar, Button, Coins, Empty, Loading, PageHead, Panel } from "../components/ui.tsx";
import { fmt } from "../lib/format.ts";
import { useAction, useData, useHero } from "../state/game.ts";
import { useStartBattle } from "./Table.tsx";

interface Boon { id: string; name: string; icon: string; desc: string }
interface Run { floor: number; startFloor: number; hp: number; pouch: { coins: number; xp: number; stacks: Record<string, number> }; boons: Boon[]; pendingBoons: Boon[] | null }
interface DungeonView { best: number; checkpoints: number[]; run: Run | null; boons: Boon[] }

export default function DungeonPage() {
  const { hero, activeBattle } = useHero();
  const { data, isPending } = useData<DungeonView>(["dungeon"], "/api/dungeon");
  const [from, setFrom] = useState(1);
  const startRun = useAction<{ fromFloor: number }>("/api/dungeon/start", { invalidate: [["dungeon"]] });
  const fight = useStartBattle("/api/dungeon/fight", [["dungeon"]]);
  const boon = useAction<{ boonId: string }>("/api/dungeon/boon", { invalidate: [["dungeon"]], success: "The boon settles over you." });
  const leave = useAction("/api/dungeon/leave", {
    invalidate: [["dungeon"], ["inventory"]],
    success: (r) => { const x = r as { coins: number; xp: number }; return `Banked ${fmt(x.coins)} coins and ${fmt(x.xp)} XP.`; },
  });

  if (hero.level < 5) return <Empty art="🕳️" title="The Dungeon opens at level 5">Win a few fights in the Dark Forest first. The deep is patient.</Empty>;
  if (isPending || !data) return <Loading rows={3} />;
  const run = data.run;

  return (
    <>
      <PageHead title="The Dungeon">
        A roguelike descent. Your pouch fills as you clear floors, and every third floor offers a boon. Leave whenever you like to bank the pouch. Fall, and you keep only half the coins and XP; the materials are lost. Health does not return between floors.
      </PageHead>

      {!run ? (
        <Panel title="Begin a descent">
          <p className="muted">Deepest floor reached: <b className="gold">{data.best}</b>. Checkpoints unlock every ten floors.</p>
          <div className="row row--wrap" role="radiogroup" aria-label="Starting floor" style={{ margin: "var(--s-4) 0" }}>
            {data.checkpoints.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={from === c} className={`chip${from === c ? " chip--gold" : ""}`} onClick={() => setFrom(c)}>Floor {c}</button>
            ))}
          </div>
          <Button variant="primary" size="lg" icon={<Flame size={20} />} loading={startRun.isPending} disabled={!!activeBattle} onClick={() => startRun.mutate({ fromFloor: from })}>Enter the Dungeon</Button>
          <p className="faint" style={{ marginTop: "var(--s-3)" }}>You need at least half your health to enter.</p>
        </Panel>
      ) : (
        <div className="dungeon">
          <Panel className="dungeon__status">
            <div className="row row--between row--wrap">
              <h2>Floor {run.floor}</h2>
              <span className="faint">Started at {run.startFloor} · {run.floor - run.startFloor} cleared</span>
            </div>
            <Bar value={run.hp} max={hero.maxHp} kind="hp" label="Health (no regeneration down here)" showNumbers size="lg" />
            <div className="dungeon__pouch" aria-label="Pouch">
              <Coins value={run.pouch.coins} compact />
              <span className="chip chip--gold">{fmt(run.pouch.xp)} XP</span>
              {Object.entries(run.pouch.stacks).map(([t, q]) => (
                <span key={t} className="chip"><span className="art">{CONSUMABLE_BY_ID[t]?.icon ?? "📦"}</span>{CONSUMABLE_BY_ID[t]?.name ?? t} ×{q}</span>
              ))}
            </div>
            {!run.pendingBoons && (
              <div className="row row--wrap">
                <Button variant="primary" size="lg" icon={<Flame size={20} />} loading={fight.isPending} disabled={!!activeBattle} onClick={() => fight.mutate({})}>
                  {run.floor % 10 === 0 ? `Face the floor ${run.floor} lord` : `Descend to floor ${run.floor}`}
                </Button>
                <Button size="lg" icon={<DoorOpen size={18} />} loading={leave.isPending} onClick={() => leave.mutate(undefined)}>Leave and bank the pouch</Button>
              </div>
            )}
          </Panel>

          {run.pendingBoons && (
            <Panel title="Choose a boon">
              <p className="muted">The dark offers three gifts. Take one before descending.</p>
              <div className="boon-draft">
                {run.pendingBoons.map((b) => (
                  <GameCard key={b.id} size="lg" rarity="epic" art={b.icon} name={b.name} type="Boon" text={b.desc} onClick={() => boon.mutate({ boonId: b.id })} />
                ))}
              </div>
            </Panel>
          )}

          {run.boons.length > 0 && (
            <Panel title="Boons in play">
              <div className="row row--wrap">
                {run.boons.map((b, i) => <GameCard key={i} size="sm" rarity="rare" art={b.icon} name={b.name} type="Boon" text={b.desc} />)}
              </div>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
