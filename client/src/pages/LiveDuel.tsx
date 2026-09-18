import { useQuery } from "@tanstack/react-query";
import { Shield, Swords, Zap } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { SKILL_BY_ID } from "../../../shared/data/skills.ts";
import type { BattleAction, BattleState } from "../../../shared/data/types.ts";
import { GameCard } from "../components/GameCard.tsx";
import { Bar, Button, Countdown, Empty } from "../components/ui.tsx";
import { api, errorMessage } from "../lib/api.ts";
import { useHero } from "../state/game.ts";
import { useNotify } from "../state/notify.tsx";

interface DuelEvent {
  type: string;
  roomId: string;
  side: "player" | "enemy";
  state: Omit<BattleState, "seed">;
  deadline: number;
  waitingOnYou: boolean;
  winnerId?: number | null;
  opponentReady?: boolean;
}

/** Real-time PvP: both fighters lock in a move each round; the server resolves them together. */
export default function LiveDuelPage() {
  const { user } = useHero();
  const notify = useNotify();
  const { data } = useQuery<DuelEvent | null>({ queryKey: ["liveDuel"], queryFn: () => null, staleTime: Infinity });
  const [locked, setLocked] = useState<string | null>(null);
  const [lastRound, setLastRound] = useState<number>(0);

  if (!data?.state) return <Empty art="🤺" title="No live duel" action={<Link className="btn btn--primary" to="/friends">Challenge a friend</Link>}>Challenge an online friend to fight in real time.</Empty>;
  const s = data.state;
  if (s.turn !== lastRound) {
    setLastRound(s.turn);
    setLocked(null);
  }
  const me = data.side === "player" ? s.player : s.enemy;
  const foe = data.side === "player" ? s.enemy : s.player;
  const over = data.type === "duel_end" || s.status !== "active";
  const iWon = data.winnerId === user!.id;

  const act = async (action: BattleAction, label: string) => {
    setLocked(label);
    try {
      await api.post("/api/duels/live/act", { roomId: data.roomId, action });
    } catch (err) {
      setLocked(null);
      notify.toast({ tone: "bad", title: errorMessage(err) });
    }
  };

  return (
    <div className="live-duel">
      <h1>Live duel</h1>
      <div className="live-duel__board">
        {[foe, me].map((c, i) => (
          <div key={i} className="fighter">
            <GameCard size="lg" rarity={i === 0 ? "epic" : "legendary"} art={c.icon || "🛡️"} name={c.name} type={`Level ${c.level}`} atk={c.atk} hp={c.maxHp} />
            <div className="fighter__status">
              <b>{i === 0 ? c.name : "You"}</b>
              <Bar value={c.hp} max={c.maxHp} kind="hp" size="lg" showNumbers label="Health" />
            </div>
          </div>
        ))}
      </div>
      <ol className="live-duel__log">
        {s.events.filter((e) => e.t === "hit" || e.t === "heal" || e.t === "telegraph").slice(-6).map((e, i) => (
          <li key={i}>{e.t === "hit" ? `${e.by === data.side ? "You" : foe.name} dealt ${e.dmg}${e.crit ? " (critical)" : ""}.` : e.t === "heal" ? `${e.target === data.side ? "You" : foe.name} healed ${e.amount}.` : e.t === "telegraph" ? e.text : null}</li>
        ))}
      </ol>
      {over ? (
        <div className="stack" style={{ justifyItems: "center" }}>
          <h2>{data.winnerId == null ? "A draw" : iWon ? "Victory!" : "Defeat"}</h2>
          <Link className="btn btn--primary" to="/arena">Back to the arena</Link>
        </div>
      ) : (
        <div className="stack">
          <p className="muted" role="status">
            Round {s.turn}. {locked ? `Locked in: ${locked}. Waiting for ${foe.name}…` : "Choose your move."} Time left <Countdown to={data.deadline} done="0s" />.
            {data.opponentReady && !locked ? ` ${foe.name} has chosen.` : ""}
          </p>
          <div className="row row--wrap">
            <Button variant="primary" disabled={!!locked} icon={<Swords size={16} />} onClick={() => void act({ type: "attack" }, "Attack")}>Attack</Button>
            {me.skills.map((sk) => {
              const def = SKILL_BY_ID[sk.id];
              return def ? <Button key={sk.id} disabled={!!locked || sk.cd > 0} icon={<Zap size={16} />} onClick={() => void act({ type: "skill", skillId: sk.id }, def.name)}>{def.name}{sk.cd > 0 ? ` (${sk.cd})` : ""}</Button> : null;
            })}
            <Button disabled={!!locked} icon={<Shield size={16} />} onClick={() => void act({ type: "guard" }, "Guard")}>Guard</Button>
            <Button variant="ghost" onClick={() => void api.post("/api/duels/live/forfeit")}>Concede</Button>
          </div>
        </div>
      )}
    </div>
  );
}
