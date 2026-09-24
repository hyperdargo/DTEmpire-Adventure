import { Link } from "react-router";
import { Bar, Loading, Panel, Sheet } from "./ui.tsx";
import { fmt } from "../lib/format.ts";
import { useData } from "../state/game.ts";

interface GuildDetail {
  id: number;
  name: string;
  tag: string;
  emblem: string;
  description: string;
  level: number;
  xp: number;
  xpToNext: number;
  perkPct: number;
  maxMembers: number;
  members: {
    userId: number;
    name: string;
    role: "leader" | "officer" | "member";
    level: number;
    classIcon: string;
    power: number;
    contribution: number;
    online: boolean;
    lastSeenAt: number;
  }[];
}

export function GuildSheet({ guildId, onClose }: { guildId: number | null; onClose: () => void }) {
  const { data, isPending } = useData<GuildDetail>(
    ["guild", guildId],
    guildId ? `/api/guilds/${guildId}` : "",
    { enabled: !!guildId }
  );

  return (
    <Sheet open={!!guildId} onClose={onClose} title={data ? `${data.emblem} ${data.name} [${data.tag}]` : "Guild Details"}>
      {isPending || !data ? (
        <Loading rows={4} />
      ) : (
        <div className="stack" style={{ gap: "var(--s-4)" }}>
          <Panel tight>
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between", marginBottom: "var(--s-2)" }}>
              <div className="row" style={{ alignItems: "center", gap: "var(--s-3)" }}>
                <span className="art" style={{ fontSize: "2rem" }}>{data.emblem}</span>
                <div>
                  <h3 style={{ margin: 0 }}>{data.name} <span className="faint">[{data.tag}]</span></h3>
                  <p className="faint" style={{ margin: 0 }}>{data.description || "No description provided."}</p>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="chip" style={{ marginRight: "var(--s-2)" }}>Level {data.level}</span>
                <span className="chip">{data.members.length}/{data.maxMembers} Members</span>
              </div>
            </div>
            <Bar value={data.xp} max={data.xpToNext} kind="xp" label={`Guild XP (+${data.perkPct}% XP Perk)`} showNumbers />
          </Panel>

          <Panel title={`Clan Roster (${data.members.length})`} tight>
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Class / Lv</th>
                  <th className="num">Power</th>
                  <th className="num">Contribution</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m.userId}>
                    <td>
                      <span className={`online${m.online ? "" : " online--off"}`} />{" "}
                      <Link to={`/players/${encodeURIComponent(m.name)}`} onClick={onClose}>
                        <b>{m.name}</b>
                      </Link>
                    </td>
                    <td>
                      <span className={`chip${m.role === "leader" ? " chip--gold" : m.role === "officer" ? " chip--good" : ""}`}>
                        {m.role === "leader" ? "👑 Leader" : m.role === "officer" ? "⭐ Officer" : "Member"}
                      </span>
                    </td>
                    <td>
                      <span className="art">{m.classIcon}</span> Lv {m.level}
                    </td>
                    <td className="num gold">{fmt(m.power)}</td>
                    <td className="num">{fmt(m.contribution)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      )}
    </Sheet>
  );
}
