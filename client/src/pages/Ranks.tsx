import { useState } from "react";
import { Link } from "react-router";
import { Loading, PageHead, Panel, Tabs } from "../components/ui.tsx";
import { fmt } from "../lib/format.ts";
import { useData, useHero } from "../state/game.ts";

type Board = "level" | "power" | "tower" | "dungeon" | "arena" | "wealth";
interface BoardView { rows: { rank: number; userId: number; name: string; level: number; classIcon: string; className: string; value: number; guildTag: string | null; online: boolean }[]; me: { rank: number; value: number } | null }

const LABELS: Record<Board, { tab: string; col: string }> = {
  level: { tab: "Level", col: "Level" }, power: { tab: "Power", col: "Power" }, tower: { tab: "Tower", col: "Floor" },
  dungeon: { tab: "Dungeon", col: "Deepest" }, arena: { tab: "Arena", col: "Rating" }, wealth: { tab: "Wealth", col: "Coins" },
};

export default function RanksPage() {
  const { user } = useHero();
  const [board, setBoard] = useState<Board>("level");
  const { data, isPending } = useData<BoardView>(["ranks", board], `/api/leaderboard/${board}`);
  return (
    <>
      <PageHead title="Leaderboards">The top hundred heroes in each discipline.</PageHead>
      <Tabs label="Boards" value={board} onChange={setBoard} options={(Object.keys(LABELS) as Board[]).map((b) => ({ value: b, label: LABELS[b].tab }))} />
      <Panel className="ranks" tight>
        {data?.me && <p className="muted" style={{ marginBottom: "var(--s-3)" }}>You're <b className="gold">#{fmt(data.me.rank)}</b> with {fmt(data.me.value)}.</p>}
        {isPending || !data ? <Loading rows={5} /> : (
          <table className="table">
            <thead><tr><th>#</th><th>Hero</th><th>Class</th><th className="num">{LABELS[board].col}</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.userId} className={r.userId === user!.id ? "me" : undefined}>
                  <td className="num">{r.rank <= 3 ? <span className="art">{["🥇", "🥈", "🥉"][r.rank - 1]}</span> : r.rank}</td>
                  <td><span className={`online${r.online ? "" : " online--off"}`} /> <Link to={`/players/${encodeURIComponent(r.name)}`}>{r.name}</Link>{r.guildTag && <span className="faint"> [{r.guildTag}]</span>}</td>
                  <td><span className="art">{r.classIcon}</span> {r.className} <span className="faint">Lv {r.level}</span></td>
                  <td className="num">{fmt(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
