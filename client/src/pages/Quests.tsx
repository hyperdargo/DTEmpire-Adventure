import { Gift } from "lucide-react";
import { Link } from "react-router";
import { Bar, Button, Coins, Countdown, Loading, PageHead, Panel } from "../components/ui.tsx";
import { fmt } from "../lib/format.ts";
import { useAction, useData } from "../state/game.ts";

interface DailyView {
  daily: { claimedToday: boolean; streak: number; best: number; nextStreak: number; multiplier: number; preview: { coins: number; xp: number }; chestDay: boolean; resetsAt: number };
  contracts: { resetsAt: number; tasks: { index: number; regionName?: string; monster: string; icon: string; need: number; done: number; coins: number; xp: number; claimed: boolean }[] };
  missions: { list: { name: string; desc: string; goal: number; progress: number; coins: number; xp: number; claimed: boolean }[]; bonusClaimed: boolean };
}

export default function QuestsPage() {
  const { data, isPending } = useData<DailyView>(["daily"], "/api/daily");
  const inv = [["daily"]];
  const claim = useAction("/api/daily/claim", { invalidate: inv, success: (r) => { const x = r as { coins: number; streak: number; chest: unknown }; return `Day ${x.streak}: +${fmt(x.coins)} coins${x.chest ? " and a streak chest!" : ""}`; } });
  const contract = useAction<{ index: number }>("/api/contracts/claim", { invalidate: inv, success: "Contract fulfilled." });
  const mission = useAction<{ index: number }>("/api/missions/claim", { invalidate: inv, success: "Mission complete." });
  const chest = useAction("/api/missions/chest", { invalidate: [["daily"], ["inventory"]], success: "The mission chest opens: coins and a Mystery Egg!" });

  if (isPending || !data) return <Loading rows={4} />;
  const d = data.daily;
  const weekStart = Math.floor((d.claimedToday ? d.streak - 1 : d.streak) / 7) * 7;
  const allMissions = data.missions.list.every((m) => m.claimed);

  return (
    <>
      <PageHead title="Quests">Everything here resets at midnight UTC. A short session that clears this page is always worth it.</PageHead>
      <div className="quests">
        <Panel title="Daily reward" action={<span className="faint">Best streak {d.best}</span>}>
          <div className="streak-pad" aria-label={`Streak: ${d.streak} days`}>
            {Array.from({ length: 7 }, (_, i) => {
              const day = weekStart + i + 1;
              const filled = day <= d.streak;
              const today = !d.claimedToday && day === d.nextStreak;
              return (
                <div key={i} className={`pane${filled ? " pane--filled" : ""}${today ? " pane--today" : ""}${i === 6 ? " pane--chest" : ""}`}>
                  <span className="pane__day num">Day {day}</span>
                  <span className="art" aria-hidden>{i === 6 ? "🧰" : filled ? "✦" : "·"}</span>
                </div>
              );
            })}
          </div>
          <p className="muted">
            {d.claimedToday
              ? <>Claimed. Come back in <Countdown to={d.resetsAt} done="a moment" /> to keep your {d.streak}-day streak.</>
              : <>Today: <Coins value={d.preview.coins} compact /> and {fmt(d.preview.xp)} XP{d.multiplier > 1 ? ` (streak ×${d.multiplier})` : ""}.{d.chestDay ? " Plus the 7th-day chest!" : ""} Miss more than a day and the streak resets.</>}
          </p>
          <Button variant="primary" size="lg" icon={<Gift size={20} />} disabled={d.claimedToday} loading={claim.isPending} onClick={() => claim.mutate(undefined)}>
            {d.claimedToday ? "Claimed today" : "Claim daily reward"}
          </Button>
        </Panel>

        <Panel title="Hunt contracts" action={<span className="faint">New in <Countdown to={data.contracts.resetsAt} /></span>}>
          <p className="muted" style={{ marginBottom: "var(--s-4)" }}>Slay the named creatures in their regions. Only kills made today count.</p>
          <ul className="quest-list">
            {data.contracts.tasks.map((t) => (
              <li key={t.index} className="quest">
                <span className="art quest__art" aria-hidden>{t.icon}</span>
                <div className="quest__body">
                  <b>Slay {t.need} {t.monster}</b>
                  <span className="faint">{t.regionName}</span>
                  <Bar value={t.done} max={t.need} kind="xp" showNumbers label="Progress" />
                </div>
                <div className="quest__reward">
                  <Coins value={t.coins} compact />
                  <span className="faint">+{fmt(t.xp)} XP</span>
                  <Button size="sm" variant={t.done >= t.need && !t.claimed ? "primary" : "default"} disabled={t.claimed || t.done < t.need} onClick={() => contract.mutate({ index: t.index })}>{t.claimed ? "Done" : "Claim"}</Button>
                </div>
              </li>
            ))}
          </ul>
          <Link to="/adventure" className="faint">Find them in Adventure →</Link>
        </Panel>

        <Panel title="Today's missions">
          <ul className="quest-list">
            {data.missions.list.map((m, i) => (
              <li key={i} className="quest">
                <div className="quest__body">
                  <b>{m.name}</b>
                  <span className="faint">{m.desc}</span>
                  <Bar value={m.progress} max={m.goal} kind="xp" showNumbers label="Progress" />
                </div>
                <div className="quest__reward">
                  <Coins value={m.coins} compact />
                  <span className="faint">+{fmt(m.xp)} XP</span>
                  <Button size="sm" variant={m.progress >= m.goal && !m.claimed ? "primary" : "default"} disabled={m.claimed || m.progress < m.goal} onClick={() => mission.mutate({ index: i })}>{m.claimed ? "Done" : "Claim"}</Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="row row--between row--wrap">
            <span className="muted">Finish all three to open the mission chest.</span>
            <Button variant={allMissions && !data.missions.bonusClaimed ? "primary" : "default"} disabled={!allMissions || data.missions.bonusClaimed} onClick={() => chest.mutate(undefined)}>
              {data.missions.bonusClaimed ? "Chest opened" : "Open mission chest"}
            </Button>
          </div>
        </Panel>
      </div>
    </>
  );
}
