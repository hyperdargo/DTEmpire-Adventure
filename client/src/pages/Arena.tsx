import { Swords, Trophy } from "lucide-react";
import { Link } from "react-router";
import { ARENA_MIN_LEVEL, DUEL_MIN_LEVEL } from "../../../shared/data/meta.ts";
import { GameCard } from "../components/GameCard.tsx";
import { Button, Empty, Loading, PageHead, Panel } from "../components/ui.tsx";
import { fmt, timeAgo } from "../lib/format.ts";
import { useData, useHero } from "../state/game.ts";
import { useStartBattle } from "./Table.tsx";

interface ArenaView {
  ai: { id: string; name: string; icon: string; level: number; wins: number }[];
  rating: number;
  rankedLeft: number;
  history: { id: string; kind: string; a_id: number; b_id: number; winner_id: number | null; rating_delta: number; created_at: number; a_name: string; b_name: string }[];
  live: unknown;
}

const tierOf = (lv: number) => (lv >= 80 ? "mythic" : lv >= 60 ? "legendary" : lv >= 40 ? "epic" : lv >= 25 ? "rare" : lv >= 15 ? "uncommon" : "common");

export default function ArenaPage() {
  const { hero, user, activeBattle } = useHero();
  const { data, isPending } = useData<ArenaView>(["arena"], "/api/duels");
  const ai = useStartBattle("/api/duels/ai", [["arena"]]);
  const ranked = useStartBattle("/api/arena/ranked", [["arena"]]);

  if (hero.level < DUEL_MIN_LEVEL) return <Empty art="🏟️" title={`The arena opens at level ${DUEL_MIN_LEVEL}`}>Earn your first few levels in the Dark Forest, then come prove yourself.</Empty>;
  if (isPending || !data) return <Loading rows={3} />;
  const blocked = !!activeBattle || hero.inDungeon;

  return (
    <>
      <PageHead title="Arena" actions={data.live ? <Link className="btn btn--primary" to="/arena/live">Return to live duel</Link> : undefined}>
        Duels are exhibitions: both sides start at full health and nobody keeps their wounds.
      </PageHead>
      <div className="arena">
        <Panel title={<h2><Trophy size={22} aria-hidden /> Ranked</h2>}>
          <p className="arena__rating num">{fmt(data.rating)}</p>
          <p className="muted">Fight the champion of a real player near your rating; their hero fights on its own. Win to climb, lose and you slip. {data.rankedLeft} ranked matches left today.</p>
          {hero.level < ARENA_MIN_LEVEL ? <p className="faint">Ranked opens at level {ARENA_MIN_LEVEL}.</p> : (
            <Button variant="primary" size="lg" icon={<Swords size={20} />} disabled={blocked || data.rankedLeft <= 0} loading={ranked.isPending} onClick={() => ranked.mutate({})}>Find an opponent</Button>
          )}
          <p className="faint" style={{ marginTop: "var(--s-3)" }}>Want a live fight? Challenge an online friend from their profile or the Friends page.</p>
        </Panel>

        <Panel title="The gauntlet">
          <p className="muted" style={{ marginBottom: "var(--s-4)" }}>Six champions guard the arena. Your first win against each pays five times over.</p>
          <div className="grid-cards" style={{ "--card-min": "140px" } as React.CSSProperties}>
            {data.ai.map((d) => (
              <GameCard key={d.id} size="md" rarity={tierOf(d.level)} art={d.icon} name={d.name} cost={`Lv ${d.level}`}
                type={d.wins ? `${d.wins} win${d.wins > 1 ? "s" : ""}` : "Undefeated"} text={d.wins ? "Rematch for coins and XP." : "First victory pays ×5."}
                disabled={blocked} onClick={blocked ? undefined : () => ai.mutate({ duelistId: d.id })} />
            ))}
          </div>
        </Panel>

        <Panel title="Recent matches">
          {data.history.length === 0 ? <p className="muted">No matches yet.</p> : (
            <table className="table">
              <thead><tr><th>Match</th><th>Result</th><th>Rating</th><th>When</th></tr></thead>
              <tbody>
                {data.history.map((m) => {
                  const mine = m.a_id === user!.id;
                  const opp = mine ? m.b_name : m.a_name;
                  const won = m.winner_id === user!.id;
                  const delta = mine ? m.rating_delta : -Math.round(m.rating_delta / 2);
                  return (
                    <tr key={m.id}>
                      <td>{m.kind === "live" ? "Live duel" : mine ? "Ranked" : "Defended"} vs <Link to={`/players/${encodeURIComponent(opp)}`}>{opp}</Link></td>
                      <td className={won ? "gold" : "faint"}>{m.winner_id == null ? "Draw" : won ? "Won" : "Lost"}</td>
                      <td className="num">{m.kind === "live" ? "—" : `${delta >= 0 ? "+" : ""}${delta}`}</td>
                      <td className="faint">{timeAgo(m.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </>
  );
}
