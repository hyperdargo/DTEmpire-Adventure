import { Crown, Lock, Swords } from "lucide-react";
import { useState } from "react";
import { GameCard } from "../components/GameCard.tsx";
import { Bar, Button, Loading, PageHead, Panel } from "../components/ui.tsx";
import { useData, useHero } from "../state/game.ts";
import { rememberedRegion, rememberRegion, useStartBattle, type RegionInfo } from "./Table.tsx";

const TIER = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
export const regionRarity = (i: number, total: number) => TIER[Math.min(TIER.length - 1, Math.floor((i / total) * TIER.length))]!;

export default function AdventurePage() {
  const { hero, activeBattle } = useHero();
  const { data, isPending } = useData<{ regions: RegionInfo[] }>(["adventure"], "/api/adventure");
  const [selected, setSelected] = useState<string | null>(rememberedRegion());
  const start = useStartBattle("/api/adventure/start");

  if (isPending || !data) return <Loading rows={4} />;
  const regions = data.regions;
  const current = regions.find((r) => r.id === selected && r.unlocked) ?? [...regions].reverse().find((r) => r.unlocked)!;
  const bossReady = current.kills >= current.bossUnlockKills;
  const blocked = !!activeBattle || hero.inDungeon;

  return (
    <>
      <PageHead title="Adventure">
        Twenty-six regions stretch from the Dark Forest to Primordial Peak. New lands open as you level; defeat ten foes in a region to draw out its boss.
      </PageHead>

      <Panel className="region-focus">
        <div className="region-focus__body">
          <div>
            <h2><span className="art" aria-hidden>{current.icon}</span> {current.name}</h2>
            <p className="muted">{current.description}</p>
            <p className="faint">Foes are level {current.minLevel}–{current.maxLevel}.</p>
          </div>
          <div className="region-focus__monsters" aria-label="Creatures here">
            {current.monsters.map((m) => <span key={m.id} className="chip"><span className="art">{m.icon}</span>{m.name}</span>)}
            <span className="chip chip--warn"><span className="art">{current.boss.icon}</span>{current.boss.name}</span>
          </div>
          <Bar value={Math.min(current.kills, current.bossUnlockKills)} max={current.bossUnlockKills} kind="xp" label="Boss lure" showNumbers />
          <div className="row row--wrap">
            <Button variant="primary" size="lg" icon={<Swords size={20} />} loading={start.isPending} disabled={blocked} onClick={() => start.mutate({ regionId: current.id })}>Draw encounter</Button>
            <Button size="lg" icon={<Crown size={18} />} disabled={!bossReady || blocked} onClick={() => start.mutate({ regionId: current.id, boss: true })}>
              {bossReady ? `Challenge ${current.boss.name}` : `${current.bossUnlockKills - current.kills} more to lure the boss`}
            </Button>
          </div>
        </div>
      </Panel>

      <h2 className="section-title">The map</h2>
      <div className="grid-cards" style={{ "--card-min": "150px" } as React.CSSProperties}>
        {regions.map((r, i) => (
          <GameCard
            key={r.id}
            size="md"
            rarity={regionRarity(i, regions.length)}
            art={r.icon}
            name={r.name}
            cost={`${r.minLevel}+`}
            type={r.unlocked ? `${r.kills} slain` : <><Lock size={11} aria-hidden /> Level {r.minLevel}</>}
            text={r.unlocked ? `Boss: ${r.boss.name}` : "Not yet charted."}
            disabled={!r.unlocked}
            selected={r.id === current.id}
            onClick={r.unlocked ? () => { setSelected(r.id); rememberRegion(r.id); window.scrollTo({ top: 0, behavior: "smooth" }); } : undefined}
            label={`${r.name}, level ${r.minLevel}${r.unlocked ? "" : ", locked"}`}
          />
        ))}
      </div>
    </>
  );
}
