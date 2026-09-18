import { Flame } from "lucide-react";
import { Link } from "react-router";
import { GameCard } from "../components/GameCard.tsx";
import { Bar, Button, Empty, Loading, PageHead, Panel } from "../components/ui.tsx";
import { fmt } from "../lib/format.ts";
import { useData, useHero } from "../state/game.ts";
import { useStartBattle } from "./Table.tsx";

interface RaidView {
  week: string; boss: { name: string; icon: string; region: string }; maxHp: number; hp: number; defeated: boolean; participants: number;
  top: { rank: number; userId: number; name: string; damage: number; hits: number }[]; mine: { damage: number; hits: number }; attemptsLeft: number;
}

export default function RaidPage() {
  const { hero, user, activeBattle } = useHero();
  const { data, isPending } = useData<RaidView>(["raid"], "/api/worldboss", { enabled: hero.level >= 10, refetchInterval: 30_000 });
  const strike = useStartBattle("/api/worldboss/strike", [["raid"]]);

  if (hero.level < 10) return <Empty art="🌋" title="The world boss awaits heroes of level 10">Everyone on the server fights the same foe each week. Reach level 10 to join the war.</Empty>;
  if (isPending || !data) return <Loading rows={3} />;
  const myRank = data.top.find((t) => t.userId === user!.id)?.rank;

  return (
    <>
      <PageHead title="World Boss">
        One foe for the whole realm each week. Every hero gets three strikes a day of ten turns each; your damage is scaled to your level so every contribution counts. When it falls, everyone who fought shares the spoils by rank.
      </PageHead>
      <div className="raid">
        <Panel className="raid__boss">
          <GameCard size="xl" rarity="mythic" art={data.boss.icon} name={data.boss.name} type={`From ${data.boss.region}`} text={data.defeated ? "Slain. A new foe rises on Monday." : "Week " + data.week.split("-W")[1]} />
          <div className="stack">
            <Bar value={data.hp} max={data.maxHp} kind="hp" size="lg" showNumbers label={`${data.participants} heroes have fought`} />
            <p className="muted">Your contribution this week: <b className="gold">{fmt(data.mine.damage)}</b> over {data.mine.hits} strikes{myRank ? `, rank #${myRank}` : ""}.</p>
            <Button variant="primary" size="lg" icon={<Flame size={20} />} disabled={data.defeated || data.attemptsLeft <= 0 || !!activeBattle || hero.inDungeon} loading={strike.isPending} onClick={() => strike.mutate({})}>
              {data.defeated ? "Slain this week" : data.attemptsLeft > 0 ? `Strike (${data.attemptsLeft} left today)` : "No strikes left today"}
            </Button>
            <p className="faint">Rewards arrive by mail: champions, vanguard, raiders and allies each get a share, with Golden Eggs for the top ranks.</p>
          </div>
        </Panel>
        <Panel title="War council">
          {data.top.length === 0 ? <p className="muted">No one has struck yet. Be the first.</p> : (
            <table className="table">
              <thead><tr><th>#</th><th>Hero</th><th>Damage</th><th>Strikes</th></tr></thead>
              <tbody>
                {data.top.map((t) => (
                  <tr key={t.userId} className={t.userId === user!.id ? "me" : undefined}>
                    <td className="num">{t.rank}</td>
                    <td><Link to={`/players/${encodeURIComponent(t.name)}`}>{t.name}</Link></td>
                    <td className="num">{fmt(t.damage)}</td>
                    <td className="num">{t.hits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </>
  );
}
