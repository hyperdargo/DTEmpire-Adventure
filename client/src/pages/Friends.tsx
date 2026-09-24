import { MessageCircle, Swords, UserPlus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button, Empty, Loading, PageHead, Panel } from "../components/ui.tsx";
import { api, errorMessage } from "../lib/api.ts";
import { timeAgo } from "../lib/format.ts";
import { useAction, useData } from "../state/game.ts";
import { useNotify } from "../state/notify.tsx";

interface Friend { userId: number; name: string; level: number; classIcon: string; status: "friend" | "incoming" | "outgoing"; online: boolean; lastSeenAt: number }
interface Found { userId: number; name: string; level: number; classIcon: string; online: boolean }

export function useDirectMessage() {
  const navigate = useNavigate();
  const notify = useNotify();
  return async (userId: number) => {
    try {
      const r = await api.post<{ channel: string }>("/api/chat/dm", { userId });
      navigate(`/chat?c=${encodeURIComponent(r.channel)}`);
    } catch (err) {
      notify.toast({ tone: "bad", title: errorMessage(err) });
    }
  };
}

export function useChallenge() {
  const notify = useNotify();
  return async (userId: number, name: string) => {
    try {
      await api.post("/api/duels/live/challenge", { userId });
      notify.toast({ tone: "info", title: `Challenge sent to ${name}. They have a minute to accept.`, art: "🤺" });
    } catch (err) {
      notify.toast({ tone: "bad", title: errorMessage(err) });
    }
  };
}

const BOT_NAMES = new Set([
  "Aria_Dawnseeker", "Seraphina_Vane", "Theron_Shieldheart", "Brant_Oakhaven", "Lyra_Starweaver",
  "Kaelen_Voidstrider", "Valen_Ironbark", "Zephyr_Shadowstep", "Morwenna_Frost", "Garrick_Flamehand"
]);

export default function FriendsPage() {
  const { data, isPending } = useData<{ friends: Friend[] }>(["friends"], "/api/friends");
  const [q, setQ] = useState("");
  const search = useData<{ players: Found[] }>(["players", q], `/api/players?q=${encodeURIComponent(q)}`, { enabled: q.trim().length >= 2 });
  const request = useAction<{ userId: number }>("/api/friends/request", { invalidate: [["friends"]], success: "Friend request sent." });
  const respond = useAction<{ userId: number; accept: boolean }>("/api/friends/respond", { invalidate: [["friends"]] });
  const remove = useAction<{ userId: number }>("/api/friends/remove", { invalidate: [["friends"]] });
  const dm = useDirectMessage();
  const challenge = useChallenge();

  if (isPending) return <Loading rows={3} />;
  const friends = data?.friends ?? [];
  const incoming = friends.filter((f) => f.status === "incoming");
  const accepted = friends.filter((f) => f.status === "friend").sort((a, b) => Number(b.online) - Number(a.online));
  const outgoing = friends.filter((f) => f.status === "outgoing");

  return (
    <>
      <PageHead title="Friends">Find heroes, add friends, and challenge anyone online to a live duel.</PageHead>
      <div className="stack stack--lg">
        <Panel title="Find a hero">
          <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name (2+ letters)" aria-label="Search players" />
          {(search.data?.players ?? []).length > 0 && (
            <ul className="people">
              {search.data!.players.map((p) => (
                <li key={p.userId} className="person">
                  <span className="art" aria-hidden>{p.classIcon}</span>
                  <Link to={`/players/${encodeURIComponent(p.name)}`}><b>{p.name}</b></Link>
                  <span className="faint">Lv {p.level}{p.online ? " · online" : ""}</span>
                  <Button size="sm" icon={<UserPlus size={16} />} onClick={() => request.mutate({ userId: p.userId })}>Add</Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {incoming.length > 0 && (
          <Panel title="Requests">
            <ul className="people">
              {incoming.map((f) => (
                <li key={f.userId} className="person">
                  <span className="art" aria-hidden>{f.classIcon}</span>
                  <Link to={`/players/${encodeURIComponent(f.name)}`}><b>{f.name}</b></Link>
                  <span className="faint">Lv {f.level}</span>
                  <Button size="sm" variant="primary" onClick={() => respond.mutate({ userId: f.userId, accept: true })}>Accept</Button>
                  <Button size="sm" variant="ghost" onClick={() => respond.mutate({ userId: f.userId, accept: false })}>Decline</Button>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel title={`Friends · ${accepted.length}`}>
          {accepted.length === 0 ? <Empty art="🤝" title="No friends yet">Search above, or add people you meet in World chat.</Empty> : (
            <ul className="people">
              {accepted.map((f) => (
                <li key={f.userId} className="person">
                  <span className={`online${f.online ? "" : " online--off"}`} aria-label={f.online ? "online" : "offline"} />
                  <span className="art" aria-hidden>{f.classIcon}</span>
                  <Link to={`/players/${encodeURIComponent(f.name)}`}><b>{f.name}</b></Link>
                  <span className="faint">Lv {f.level} · {f.online ? "online" : `seen ${timeAgo(f.lastSeenAt)}`}</span>
                  <Button size="sm" icon={<MessageCircle size={16} />} onClick={() => void dm(f.userId)}>Message</Button>
                  <Button size="sm" icon={<Swords size={16} />} disabled={!f.online && !BOT_NAMES.has(f.name)} onClick={() => void challenge(f.userId, f.name)}>Duel</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate({ userId: f.userId })}>Remove</Button>
                </li>
              ))}
            </ul>
          )}
          {outgoing.length > 0 && <p className="faint" style={{ marginTop: "var(--s-3)" }}>Waiting on: {outgoing.map((f) => f.name).join(", ")}</p>}
        </Panel>
      </div>
    </>
  );
}
