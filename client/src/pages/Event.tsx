import { Moon, Sparkles } from "lucide-react";
import { Link } from "react-router";
import type { ItemView } from "../../../shared/data/types.ts";
import { GameCard, ItemCard } from "../components/GameCard.tsx";
import { Button, Countdown, Empty, Loading, PageHead, Panel } from "../components/ui.tsx";
import { fmt } from "../lib/format.ts";
import { useAction, useData, useHero } from "../state/game.ts";
import { useStartBattle } from "./Table.tsx";

interface EventView {
  active: boolean;
  event?: {
    id: string; name: string; icon: string; description: string; currency: { name: string; icon: string };
    minLevel: number; endsAt: number;
    monsters: { id: string; name: string; icon: string; tier: "normal" | "elite" | "boss"; tokens: [number, number] }[];
  };
  mine?: { tokens: number; earned: number; kills: number; bossKills: number; purchased: string[] };
  shop?: { id: string; name: string; icon: string; desc: string; note: string; price: number; kind: string; once: boolean; owned: boolean; affordable: boolean }[];
  leaderboard?: { rank: number; userId: number; name: string; earned: number; kills: number }[];
}

const TIER_RARITY = { normal: "uncommon", elite: "epic", boss: "mythic" } as const;

export default function EventPage() {
  const { hero, user, activeBattle } = useHero();
  const { data, isPending } = useData<EventView>(["event"], "/api/event", { refetchInterval: 60_000 });
  const fight = useStartBattle("/api/event/fight", [["event"]]);
  const buy = useAction<{ entryId: string }, { kind: string; name: string; qty?: number }>("/api/event/buy", {
    invalidate: [["event"], ["inventory"]],
    success: (r) => (r.kind === "title" ? `Title unlocked: ${r.name}` : r.kind === "gear" ? `${r.name} forged to your level and placed in your bag.` : `${r.name}${r.qty && r.qty > 1 ? ` ×${r.qty}` : ""} added to your bag.`),
  });

  if (isPending || !data) return <Loading rows={3} />;
  if (!data.active || !data.event || !data.mine) {
    return (
      <Empty art="🎏" title="No festival is running" action={<Link className="btn btn--primary" to="/">Back to the table</Link>}>
        Seasonal festivals bring their own monsters, their own currency and gear you can't get anywhere else. The next one will appear here.
      </Empty>
    );
  }
  const { event, mine, shop = [], leaderboard = [] } = data;
  const locked = hero.level < event.minLevel;
  const myRank = leaderboard.find((l) => l.userId === user!.id)?.rank;

  return (
    <>
      <PageHead title={<><span className="art">{event.icon}</span> {event.name}</>} actions={
        <span className="chip chip--gold"><span className="art">{event.currency.icon}</span> {fmt(mine.tokens)} {event.currency.name}</span>
      }>
        {event.description} Ends in <Countdown to={event.endsAt} done="moments" />.
      </PageHead>

      <div className="event">
        <Panel title="The festival grounds">
          <div className="row row--wrap" style={{ marginBottom: "var(--s-4)" }}>
            {event.monsters.map((m) => (
              <GameCard key={m.id} size="sm" rarity={TIER_RARITY[m.tier]} art={m.icon} name={m.name}
                type={m.tier === "boss" ? "Festival boss" : m.tier === "elite" ? "Elite" : "Festival foe"}
                text={`${m.tokens[0]}–${m.tokens[1]} ${event.currency.name}`} />
            ))}
          </div>
          <Button variant="primary" size="lg" icon={<Moon size={20} />} loading={fight.isPending}
            disabled={locked || !!activeBattle || hero.inDungeon} onClick={() => fight.mutate({})}>
            {locked ? `Level ${event.minLevel} to join the festival` : "Hunt under the moon"}
          </Button>
          <dl className="stats" style={{ marginTop: "var(--s-4)" }}>
            <div className="stat"><dt>{event.currency.name} held</dt><dd className="gold">{fmt(mine.tokens)}</dd></div>
            <div className="stat"><dt>Earned all festival</dt><dd>{fmt(mine.earned)}</dd></div>
            <div className="stat"><dt>Beasts slain</dt><dd>{fmt(mine.kills)}</dd></div>
            <div className="stat"><dt>Bosses driven off</dt><dd>{fmt(mine.bossKills)}</dd></div>
          </dl>
        </Panel>

        <Panel title="Festival stalls" action={<span className="faint">Gear is forged to your level</span>}>
          <div className="grid-cards" style={{ "--card-min": "165px" } as React.CSSProperties}>
            {shop.map((s) => (
              <div key={s.id} className="offer">
                <GameCard size="md" rarity={s.kind === "gear" ? "legendary" : s.kind === "title" ? "mythic" : "epic"} art={s.icon} name={s.name}
                  type={s.kind === "title" ? "Title" : s.kind === "gear" ? "Festival gear" : "Festival goods"} text={s.desc || s.note}
                  badge={s.owned && s.once ? "Owned" : undefined} disabled={s.owned && s.once} />
                <Button size="sm" variant={s.affordable && !(s.owned && s.once) ? "primary" : "default"}
                  disabled={(s.owned && s.once) || !s.affordable} loading={buy.isPending && buy.variables?.entryId === s.id}
                  onClick={() => buy.mutate({ entryId: s.id })}>
                  {s.owned && s.once ? "Claimed" : <><span className="art">{event.currency.icon}</span> {s.price}</>}
                </Button>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Festival standings" action={myRank ? <span className="chip chip--gold">You're #{myRank}</span> : undefined}>
          {leaderboard.length === 0 ? <p className="muted">Nobody has earned a token yet. Be the first.</p> : (
            <table className="table">
              <thead><tr><th>#</th><th>Hero</th><th className="num">{event.currency.name}</th><th className="num">Slain</th></tr></thead>
              <tbody>
                {leaderboard.map((l) => (
                  <tr key={l.userId} className={l.userId === user!.id ? "me" : undefined}>
                    <td className="num">{l.rank <= 3 ? <span className="art">{["🥇", "🥈", "🥉"][l.rank - 1]}</span> : l.rank}</td>
                    <td><Link to={`/players/${encodeURIComponent(l.name)}`}>{l.name}</Link></td>
                    <td className="num">{fmt(l.earned)}</td>
                    <td className="num">{fmt(l.kills)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="faint" style={{ marginTop: "var(--s-3)" }}>
            <Sparkles size={14} aria-hidden /> Festival gear and titles stay yours after the moon sets.
          </p>
        </Panel>
      </div>
      <FestivalHint />
    </>
  );
}

function FestivalHint() {
  const { data } = useData<{ items: ItemView[] }>(["inventory"], "/api/inventory");
  const festival = (data?.items ?? []).filter((i) => ["moonlight_blade", "lunar_ward", "harvest_crown", "moonbeam_elixir", "lunar_egg"].includes(i.templateId));
  if (festival.length === 0) return null;
  return (
    <Panel title="Your festival haul">
      <div className="row row--wrap">{festival.map((i) => <ItemCard key={i.id} item={i} size="sm" />)}</div>
    </Panel>
  );
}
