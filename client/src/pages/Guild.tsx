import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { GUILD_CREATE_COST, GUILD_CREATE_LEVEL } from "../../../shared/data/meta.ts";
import { Bar, Button, Coins, Empty, Loading, PageHead, Panel, Sheet, Tabs } from "../components/ui.tsx";
import { GuildSheet } from "../components/GuildSheet.tsx";
import { fmt, timeAgo } from "../lib/format.ts";
import { useAction, useData, useHero } from "../state/game.ts";
import { useStartBattle } from "./Table.tsx";

interface GuildSummary { id: number; name: string; tag: string; emblem: string; description: string; level: number; members: number; maxMembers: number; open: boolean }
interface GuildDetail extends Omit<GuildSummary, "members"> {
  xp: number; xpToNext: number; perkPct: number; myRole: "leader" | "officer" | "member" | null;
  members: { userId: number; name: string; role: string; level: number; classIcon: string; power: number; contribution: number; online: boolean; lastSeenAt: number }[];
  requests: { userId: number; name: string; level: number }[];
  tasks: { id: string; name: string; icon: string; desc: string; goal: number; progress: number; guildXp: number; coins: number; claimed: boolean }[] | null;
}

export default function GuildPage() {
  const { hero } = useHero();
  return hero.guild ? <MyGuild id={hero.guild.id} /> : <FindGuild />;
}

function FindGuild({ inMyGuild }: { inMyGuild?: boolean } = {}) {
  const { hero } = useHero();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [inspectGuildId, setInspectGuildId] = useState<number | null>(null);
  const { data, isPending } = useData<{ guilds: GuildSummary[] }>(["guilds", q], `/api/guilds?q=${encodeURIComponent(q)}`);
  const join = useAction<{ id: number }, string>((b) => `/api/guilds/${b.id}/join`, { invalidate: [["guilds"]], success: (r) => (r === "requested" ? "Request sent to the guild's officers." : "Welcome to the guild!") });
  const create = useAction<{ name: string; tag: string; emblem: string; description: string }>("/api/guilds", { success: "Your guild is founded.", onSuccess: () => setCreating(false) });

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    create.mutate({ name: String(f.get("name")), tag: String(f.get("tag")), emblem: String(f.get("emblem") || "🛡️"), description: String(f.get("description") ?? "") });
  };

  return (
    <>
      {!inMyGuild && (
        <PageHead title="Guilds" actions={<Button variant="primary" disabled={hero.level < GUILD_CREATE_LEVEL} onClick={() => setCreating(true)}>{hero.level < GUILD_CREATE_LEVEL ? `Found a guild at level ${GUILD_CREATE_LEVEL}` : "Found a guild"}</Button>}>
          Guilds share a chat channel, daily tasks, and a level that gives every member bonus XP.
        </PageHead>
      )}
      <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guilds by name or tag" aria-label="Search guilds" style={{ marginBottom: "var(--s-5)" }} />
      {isPending ? <Loading rows={3} /> : (data?.guilds ?? []).length === 0 ? <Empty art="🛡️" title="No guilds found">Be the first to raise a banner.</Empty> : (
        <ul className="guild-list">
          {data!.guilds.map((g) => (
            <li
              key={g.id}
              className="guild-row panel panel--tight"
              style={{ cursor: "pointer" }}
              title="Click to view clan & members"
              onClick={() => setInspectGuildId(g.id)}
            >
              <span className="art guild-row__emblem" aria-hidden>{g.emblem}</span>
              <div className="guild-row__info">
                <b>{g.name} <span className="faint">[{g.tag}]</span></b>
                <p className="faint">{g.description || "No description."}</p>
              </div>
              <span className="chip">Lv {g.level}</span>
              <span className="chip">{g.members}/{g.maxMembers}</span>
              {!inMyGuild && (
                <Button size="sm" variant={g.open ? "primary" : "default"} disabled={g.members >= g.maxMembers} onClick={(e) => { e.stopPropagation(); join.mutate({ id: g.id }); }}>{g.open ? "Join" : "Request"}</Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <GuildSheet guildId={inspectGuildId} onClose={() => setInspectGuildId(null)} />
      <Sheet open={creating} onClose={() => setCreating(false)} title="Found a guild">
        <form className="stack" onSubmit={submit}>
          <label className="field"><span>Name</span><input className="input" name="name" required minLength={3} maxLength={24} /></label>
          <div className="row">
            <label className="field" style={{ flex: 1 }}><span>Tag (2–5)</span><input className="input" name="tag" required minLength={2} maxLength={5} pattern="[A-Za-z0-9]{2,5}" /></label>
            <label className="field" style={{ width: 110 }}><span>Emblem</span><input className="input art" name="emblem" defaultValue="🛡️" maxLength={8} /></label>
          </div>
          <label className="field"><span>Description</span><textarea className="textarea" name="description" maxLength={280} /></label>
          <Button type="submit" variant="primary" loading={create.isPending}>Found for <Coins value={GUILD_CREATE_COST} compact /></Button>
        </form>
      </Sheet>
    </>
  );
}

function MyGuild({ id }: { id: number }) {
  const { user } = useHero();
  const { data, isPending } = useData<GuildDetail>(["guild", id], `/api/guilds/${id}`);
  const [tab, setTab] = useState<"overview" | "war" | "clans">("overview");
  const [donation, setDonation] = useState(1000);
  const inv = [["guild", id]];
  const leave = useAction("/api/guild/leave", { success: "You left the guild." });
  const member = useAction<{ userId: number; action: string }>("/api/guild/member", { invalidate: inv });
  const review = useAction<{ userId: number; approve: boolean }>("/api/guild/request", { invalidate: inv });
  const donate = useAction<{ coins: number }>("/api/guild/donate", { invalidate: inv, success: "Donation received. The guild grows." });
  const task = useAction<{ taskId: string }>("/api/guild/task", { invalidate: inv, success: "Task complete. Rewards mailed to every member." });
  const update = useAction<{ open: boolean }>("/api/guild/update", { invalidate: inv });
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (isPending || !data) return <Loading rows={4} />;
  const officer = data.myRole === "leader" || data.myRole === "officer";

  return (
    <>
      <PageHead title={<><span className="art">{data.emblem}</span> {data.name} <span className="faint">[{data.tag}]</span></>}
        actions={<><Link className="btn" to={`/chat?c=guild:${data.id}`}>Guild chat</Link><Button variant="ghost" onClick={() => setConfirmLeave(true)}>Leave</Button></>}>
        {data.description || "A guild with no motto yet."}
      </PageHead>
      <div style={{ marginBottom: "var(--s-4)" }}>
        <Tabs
          label="Guild views"
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: "Overview" },
            { value: "war", label: "⚔️ Guild War" },
            { value: "clans", label: "🛡️ All Clans" },
          ]}
        />
      </div>
      {tab === "war" ? (
        <GuildWarPanel />
      ) : tab === "clans" ? (
        <FindGuild inMyGuild />
      ) : (
        <div className="guild">
        <Panel title={`Level ${data.level}`} action={<span className="gold">+{data.perkPct}% XP for members</span>}>
          <Bar value={data.xp} max={data.xpToNext} kind="xp" showNumbers label="Guild XP" />
          <div className="row row--wrap" style={{ marginTop: "var(--s-4)" }}>
            <input className="input" type="number" min={100} step={100} value={donation} onChange={(e) => setDonation(Number(e.target.value))} aria-label="Donation" style={{ width: 140 }} />
            <Button onClick={() => donate.mutate({ coins: donation })}>Donate coins</Button>
            <span className="faint">10 coins = 1 guild XP</span>
          </div>
          {data.myRole === "leader" && (
            <label className="row" style={{ marginTop: "var(--s-3)" }}>
              <input type="checkbox" checked={data.open} onChange={(e) => update.mutate({ open: e.target.checked })} /> Anyone can join without approval
            </label>
          )}
        </Panel>

        {data.tasks && (
          <Panel title="Today's guild tasks">
            <ul className="quest-list">
              {data.tasks.map((t) => (
                <li key={t.id} className="quest">
                  <span className="art quest__art" aria-hidden>{t.icon}</span>
                  <div className="quest__body"><b>{t.name}</b><span className="faint">{t.desc}</span><Bar value={t.progress} max={t.goal} kind="xp" showNumbers label="Progress" /></div>
                  <div className="quest__reward">
                    <span className="faint">+{fmt(t.guildXp)} guild XP</span>
                    <Coins value={t.coins} compact />
                    {officer ? <Button size="sm" disabled={t.claimed || t.progress < t.goal} onClick={() => task.mutate({ taskId: t.id })}>{t.claimed ? "Done" : "Claim"}</Button> : <span className="faint">{t.claimed ? "Done" : "Officers claim"}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {officer && data.requests.length > 0 && (
          <Panel title="Join requests">
            <ul className="people">
              {data.requests.map((r) => (
                <li key={r.userId} className="person">
                  <Link to={`/players/${encodeURIComponent(r.name)}`}><b>{r.name}</b></Link><span className="faint">Lv {r.level}</span>
                  <Button size="sm" variant="primary" onClick={() => review.mutate({ userId: r.userId, approve: true })}>Approve</Button>
                  <Button size="sm" variant="ghost" onClick={() => review.mutate({ userId: r.userId, approve: false })}>Deny</Button>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel title={`Members · ${data.members.length}/${data.maxMembers}`}>
          <table className="table">
            <thead><tr><th>Hero</th><th>Rank</th><th>Level</th><th>Given</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.userId} className={m.userId === user!.id ? "me" : undefined}>
                  <td><span className={`online${m.online ? "" : " online--off"}`} /> <span className="art">{m.classIcon}</span> <Link to={`/players/${encodeURIComponent(m.name)}`}>{m.name}</Link> {!m.online && <span className="faint">· {timeAgo(m.lastSeenAt)}</span>}</td>
                  <td style={{ textTransform: "capitalize" }}>{m.role}</td>
                  <td className="num">{m.level}</td>
                  <td className="num">{fmt(m.contribution)}</td>
                  <td>
                    {m.userId !== user!.id && data.myRole === "leader" && (
                      <div className="row">
                        {m.role === "member" ? <Button size="sm" variant="ghost" onClick={() => member.mutate({ userId: m.userId, action: "promote" })}>Promote</Button>
                          : <Button size="sm" variant="ghost" onClick={() => member.mutate({ userId: m.userId, action: "demote" })}>Demote</Button>}
                        <Button size="sm" variant="ghost" onClick={() => member.mutate({ userId: m.userId, action: "transfer" })}>Make leader</Button>
                      </div>
                    )}
                    {m.userId !== user!.id && officer && m.role === "member" && <Button size="sm" variant="ghost" onClick={() => member.mutate({ userId: m.userId, action: "kick" })}>Remove</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
      )}
      <Sheet open={confirmLeave} onClose={() => setConfirmLeave(false)} title="Leave the guild?">
        <div className="stack">
          <p>{data.myRole === "leader" ? "Leadership passes to your most senior officer. If you're the last member, the guild disbands." : "You can rejoin later if the guild allows."}</p>
          <div className="row"><Button variant="danger" onClick={() => { leave.mutate(undefined); setConfirmLeave(false); }}>Leave</Button><Button onClick={() => setConfirmLeave(false)}>Stay</Button></div>
        </div>
      </Sheet>
    </>
  );
}

function GuildWarPanel() {
  const navigate = useNavigate();
  const { data, isPending } = useData<{
    war: {
      week: string;
      day: string;
      myGuildId: number;
      rivalGuildId: number;
      myGuildName: string;
      rivalGuildName: string;
      myScore: number;
      rivalScore: number;
      attacksRemaining: number;
      maxAttacks: number;
      opponents: {
        userId: number;
        name: string;
        level: number;
        classId: string;
        className: string;
        classIcon: string;
        power: number;
        role: string;
      }[];
    } | null;
  }>(["guildWar"], "/api/guild/war");

  const attack = useStartBattle("/api/guild/war/attack", [["guildWar"]]);

  if (isPending) return <Loading rows={3} />;
  const war = data?.war;
  if (!war) return <Empty art="🛡️" title="No active war">Your guild does not have an active rival guild war today.</Empty>;

  return (
    <div className="stack stack--lg">
      <Panel title="Guild War Clash ⚔️">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", padding: "var(--s-3)", background: "rgba(255,255,255,0.03)", borderRadius: "6px" }}>
          <div style={{ textAlign: "center", flex: 1 }}>
            <h3 style={{ margin: 0 }}>{war.myGuildName}</h3>
            <span className="gold" style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{war.myScore} pts</span>
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", padding: "0 var(--s-3)" }}>VS</div>
          <div style={{ textAlign: "center", flex: 1 }}>
            <h3 style={{ margin: 0 }}>{war.rivalGuildName}</h3>
            <span style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--danger)" }}>{war.rivalScore} pts</span>
          </div>
        </div>

        <p className="muted" style={{ marginTop: "var(--s-3)" }}>
          Defeat champions from the rival guild to earn <b>+100 War Points</b>, large coin bounties, and massive guild XP.
          {" "}<b>{war.attacksRemaining} / {war.maxAttacks}</b> daily attacks remaining.
        </p>
      </Panel>

      <Panel title={`Rival Champions (${war.opponents.length})`}>
        <table className="table">
          <thead>
            <tr>
              <th>Champion</th>
              <th>Class</th>
              <th>Level</th>
              <th>Power</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {war.opponents.map((opp) => (
              <tr key={opp.userId}>
                <td>
                  <span className="art">{opp.classIcon}</span>{" "}
                  <Link to={`/players/${encodeURIComponent(opp.name)}`}><b>{opp.name}</b></Link>
                  <span className="faint" style={{ textTransform: "capitalize", marginLeft: "var(--s-1)" }}>({opp.role})</span>
                </td>
                <td>{opp.className}</td>
                <td className="num">{opp.level}</td>
                <td className="num gold">{opp.power}</td>
                <td>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={war.attacksRemaining <= 0 || attack.isPending}
                    loading={attack.isPending}
                    onClick={() => attack.mutate({ targetUserId: opp.userId })}
                  >
                    ⚔️ Attack
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
