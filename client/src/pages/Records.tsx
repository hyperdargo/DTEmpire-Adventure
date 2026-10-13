import { useState } from "react";
import { GameCard } from "../components/GameCard.tsx";
import { Bar, Button, Chip, Empty, Loading, PageHead, Panel, Tabs } from "../components/ui.tsx";
import { fmt, timeAgo } from "../lib/format.ts";
import { useAction, useData } from "../state/game.ts";
import { regionRarity } from "./Adventure.tsx";

interface Bestiary {
  tiers: { kills: number; name: string; coins: number }[];
  regions: { id: string; name: string; icon: string; minLevel: number; creatures: { key: string; name: string | null; icon: string | null; boss: boolean; kills: number; rank: number; bonus: { atkPct: number; defPct: number } }[] }[];
}

interface Achievements {
  achievements: { id: string; name: string; icon: string; desc: string; goal: number; progress: number; done: boolean; coins: number; title?: string }[];
  titles: string[];
  active: string | null;
}

interface TitleItem {
  title: string;
  source: string;
  category?: "achievement" | "paragon" | "faction" | "abyss" | "seasonal" | "special";
  desc: string;
  icon: string;
  progress?: number;
  goal?: number;
  earned: boolean;
}

interface TitlesData {
  active: string | null;
  earned: number;
  total: number;
  completionPct: number;
  titles: TitleItem[];
}

interface TopHuntedCreature {
  key: string;
  name: string;
  icon: string;
  region: string;
  kills: number;
}

interface RegionBreakdownItem {
  id: string;
  name: string;
  icon: string;
  kills: number;
}

interface CombatStatsData {
  totalKills: number;
  totalBossKills: number;
  totalBattlesWon: number;
  totalDeaths: number;
  winRate: number;
  discovered: number;
  mastered: number;
  nemeses: number;
  topHunted: TopHuntedCreature[];
  regionBreakdown: RegionBreakdownItem[];
  duelsWon: number;
  arenaWins: number;
  expeditions: number;
  contractsDone: number;
  missionsDone: number;
  bountiesDone: number;
  coinsEarned: number;
  peakCoins: number;
  dailyStreak: number;
  bestDailyStreak: number;
  towerProgress: { towerId: string; floor: number }[];
  dungeonBest?: number;
  abyssBest?: number;
  arenaRating?: number;
  paragonRank: number;
}

interface LogEntry {
  id: number;
  kind: string;
  text: string;
  icon: string;
  meta: Record<string, unknown>;
  createdAt: number;
}

export default function RecordsPage() {
  const [tab, setTab] = useState<"bestiary" | "achievements" | "titles" | "stats" | "logbook">("bestiary");
  return (
    <>
      <PageHead title="Records">Every creature you've slain, every title you've earned, and every deed in your chronicle.</PageHead>
      <Tabs
        label="Records"
        value={tab}
        onChange={setTab}
        options={[
          { value: "bestiary", label: "Bestiary" },
          { value: "achievements", label: "Achievements" },
          { value: "titles", label: "Titles" },
          { value: "stats", label: "Combat Stats" },
          { value: "logbook", label: "Logbook" },
        ]}
      />
      <div style={{ marginTop: "var(--s-5)" }}>
        {tab === "bestiary" && <BestiaryView />}
        {tab === "achievements" && <AchievementsView />}
        {tab === "titles" && <TitlesView />}
        {tab === "stats" && <CombatStatsView />}
        {tab === "logbook" && <LogbookView />}
      </div>
    </>
  );
}

function BestiaryView() {
  const { data, isPending } = useData<Bestiary>(["bestiary"], "/api/bestiary");
  if (isPending || !data) return <Loading rows={4} />;
  const all = data.regions.flatMap((r) => r.creatures);
  const found = all.filter((c) => c.kills > 0).length;
  return (
    <div className="stack stack--lg">
      <Panel tight>
        <Bar value={found} max={all.length} kind="xp" showNumbers label="Creatures discovered" />
        <p className="faint" style={{ marginTop: "var(--s-3)" }}>Mastery ranks: {data.tiers.map((t) => `${t.name} at ${t.kills} kills`).join(" · ")}. Each rank adds +3% attack and +2% defense against that creature.</p>
      </Panel>
      {data.regions.map((r, i) => (
        <section key={r.id}>
          <h2 className="section-title"><span className="art" aria-hidden>{r.icon}</span> {r.name} <span className="faint">Lv {r.minLevel}+</span></h2>
          <div className="grid-cards" style={{ "--card-min": "130px" } as React.CSSProperties}>
            {r.creatures.map((c) => (
              <GameCard key={c.key} size="sm" rarity={c.boss ? "mythic" : c.kills ? regionRarity(i, data.regions.length) : "common"} art={c.icon ?? "❔"} name={c.name ?? "Undiscovered"}
                type={c.kills ? `${fmt(c.kills)} slain` : c.boss ? "Boss" : "Unknown"} disabled={!c.kills}
                badge={c.rank ? data.tiers[c.rank - 1]?.name : undefined} label={c.name ?? "Undiscovered creature"} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function AchievementsView() {
  const { data, isPending } = useData<Achievements>(["achievements"], "/api/achievements");
  const setTitle = useAction<{ title: string | null }>("/api/profile", { invalidate: [["achievements"], ["titles"], ["me"]], success: "Title updated." });
  if (isPending || !data) return <Loading rows={4} />;
  const done = data.achievements.filter((a) => a.done).length;
  return (
    <div className="stack stack--lg">
      <Panel title="Titles">
        {data.titles.length === 0 ? <p className="muted">Some achievements grant titles to wear beside your name.</p> : (
          <div className="row row--wrap">
            <Button size="sm" variant={data.active ? "default" : "primary"} onClick={() => setTitle.mutate({ title: null })}>Class rank</Button>
            {data.titles.map((t) => <Button key={t} size="sm" variant={data.active === t ? "primary" : "default"} onClick={() => setTitle.mutate({ title: t })}>{t}</Button>)}
          </div>
        )}
      </Panel>
      <Panel title={`Achievements · ${done}/${data.achievements.length}`}>
        <ul className="quest-list">
          {data.achievements.map((a) => (
            <li key={a.id} className={`quest${a.done ? " quest--done" : ""}`}>
              <span className="art quest__art" aria-hidden>{a.icon}</span>
              <div className="quest__body">
                <b>{a.name}</b>
                <span className="faint">{a.desc}{a.title ? ` Grants the title “${a.title}”.` : ""}</span>
                {!a.done && <Bar value={a.progress} max={a.goal} kind="xp" showNumbers label="Progress" />}
              </div>
              <div className="quest__reward">{a.done ? <span className="chip chip--gold">Earned</span> : <span className="faint">+{fmt(a.coins)} coins</span>}</div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function TitlesView() {
  const { data, isPending } = useData<TitlesData>(["titles"], "/api/titles");
  const equip = useAction<{ title: string | null }>("/api/title/equip", {
    invalidate: [["titles"], ["hero"], ["me"], ["achievements"]],
    success: "Title updated.",
  });
  const [filter, setFilter] = useState<"all" | "earned" | "locked">("all");
  const [category, setCategory] = useState<string>("all");

  if (isPending || !data) return <Loading rows={4} />;

  const filtered = (data.titles ?? []).filter((t) => {
    if (filter === "earned" && !t.earned) return false;
    if (filter === "locked" && t.earned) return false;
    if (category !== "all" && t.category !== category) return false;
    return true;
  });

  return (
    <div className="stack stack--lg">
      <Panel title="Title Compendium">
        <div className="stack stack--md">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--s-3)" }}>
            <div>
              <span className="faint">Currently Bearing: </span>
              <b>{data.active ? `"${data.active}"` : "None (Class Rank)"}</b>
            </div>
            {data.active && (
              <Button size="sm" variant="default" onClick={() => equip.mutate({ title: null })}>
                Unequip Title
              </Button>
            )}
          </div>
          <Bar value={data.earned} max={data.total} kind="xp" showNumbers label={`Compendium Unlocked · ${data.earned}/${data.total} (${data.completionPct}%)`} />
        </div>
      </Panel>

      <div className="row row--wrap" style={{ gap: "var(--s-2)", alignItems: "center" }}>
        <div className="row" style={{ gap: "var(--s-2)" }}>
          <Button size="sm" variant={filter === "all" ? "primary" : "default"} onClick={() => setFilter("all")}>
            All ({data.total})
          </Button>
          <Button size="sm" variant={filter === "earned" ? "primary" : "default"} onClick={() => setFilter("earned")}>
            Earned ({data.earned})
          </Button>
          <Button size="sm" variant={filter === "locked" ? "primary" : "default"} onClick={() => setFilter("locked")}>
            Locked ({data.total - data.earned})
          </Button>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ padding: "6px 12px", background: "#0a0a0a", color: "var(--ink)", border: "1px solid var(--line-strong)", borderRadius: "8px" }}
          >
            <option value="all">All Categories</option>
            <option value="achievement">Achievements</option>
            <option value="paragon">Paragon Prestige</option>
            <option value="faction">Imperial Factions</option>
            <option value="abyss">Endless Abyss</option>
            <option value="seasonal">Seasonal Festivals</option>
            <option value="special">Special Honors</option>
          </select>
        </div>
      </div>

      <ul className="quest-list">
        {filtered.length === 0 ? (
          <li className="quest">
            <span className="art quest__art" aria-hidden>🔍</span>
            <div className="quest__body">
              <b>No titles match this filter</b>
              <span className="faint">Try selecting a different filter or category to see other titles.</span>
            </div>
          </li>
        ) : (
          filtered.map((t) => {
            const isActive = data.active === t.title;
            return (
              <li key={t.title} className={`quest${t.earned ? "" : " quest--done"}`} style={{ opacity: t.earned ? 1 : 0.7 }}>
                <span className="art quest__art" aria-hidden>{t.icon}</span>
                <div className="quest__body">
                  <div className="row" style={{ alignItems: "center", gap: "var(--s-2)", flexWrap: "wrap" }}>
                    <b>{t.title}</b>
                    {isActive && <Chip tone="gold">Active</Chip>}
                    <span className="chip" style={{ fontSize: "var(--text-xs)", opacity: 0.85 }}>{t.source}</span>
                  </div>
                  <span className="faint">{t.desc}</span>
                  {!t.earned && t.goal !== undefined && t.goal > 0 && (
                    <Bar value={t.progress ?? 0} max={t.goal} kind="xp" showNumbers label="Progress" />
                  )}
                </div>
                <div className="quest__reward">
                  {isActive ? (
                    <Button size="sm" variant="default" onClick={() => equip.mutate({ title: null })}>
                      Unequip
                    </Button>
                  ) : t.earned ? (
                    <Button size="sm" variant="primary" onClick={() => equip.mutate({ title: t.title })}>
                      Equip
                    </Button>
                  ) : (
                    <span className="chip faint">Locked</span>
                  )}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function CombatStatsView() {
  const { data, isPending } = useData<CombatStatsData>(["stats"], "/api/stats");
  if (isPending || !data) return <Loading rows={4} />;

  const maxRegionKills = Math.max(...data.regionBreakdown.map((r) => r.kills), 1);

  return (
    <div className="stack stack--lg">
      <Panel title="Combat & Telemetry Overview">
        <dl className="stats">
          <div className="stat">
            <dt>Battles Won</dt>
            <dd className="up">{fmt(data.totalBattlesWon)}</dd>
          </div>
          <div className="stat">
            <dt>Deaths / Losses</dt>
            <dd className="down">{fmt(data.totalDeaths)}</dd>
          </div>
          <div className="stat">
            <dt>Win Rate</dt>
            <dd>{data.winRate}%</dd>
          </div>
          <div className="stat">
            <dt>Creatures Slain</dt>
            <dd>{fmt(data.totalKills)}</dd>
          </div>
          <div className="stat">
            <dt>Bosses Conquered</dt>
            <dd className="up">{fmt(data.totalBossKills)}</dd>
          </div>
          <div className="stat">
            <dt>Nemeses Smashed</dt>
            <dd>{fmt(data.nemeses)}</dd>
          </div>
          <div className="stat">
            <dt>Bestiary Discovered</dt>
            <dd>{data.discovered}</dd>
          </div>
          <div className="stat">
            <dt>Creatures Mastered</dt>
            <dd className="up">{data.mastered}</dd>
          </div>
          <div className="stat">
            <dt>Arena Rating</dt>
            <dd>{data.arenaRating ?? 1000}</dd>
          </div>
          <div className="stat">
            <dt>Arena Wins</dt>
            <dd>{fmt(data.arenaWins)}</dd>
          </div>
          <div className="stat">
            <dt>Duels Won</dt>
            <dd>{fmt(data.duelsWon)}</dd>
          </div>
          <div className="stat">
            <dt>Bounties Done</dt>
            <dd>{fmt(data.bountiesDone)}</dd>
          </div>
          <div className="stat">
            <dt>Daily Streak</dt>
            <dd>{data.dailyStreak}d <span className="faint">(Peak {data.bestDailyStreak}d)</span></dd>
          </div>
          <div className="stat">
            <dt>Paragon Rank</dt>
            <dd className="up">{data.paragonRank > 0 ? `Rank ${data.paragonRank}` : "None"}</dd>
          </div>
          <div className="stat">
            <dt>Lifetime Gold</dt>
            <dd>{fmt(data.coinsEarned)}</dd>
          </div>
          <div className="stat">
            <dt>Peak Purse</dt>
            <dd>{fmt(data.peakCoins)}</dd>
          </div>
        </dl>
      </Panel>

      {data.topHunted.length > 0 && (
        <section>
          <h2 className="section-title">Top 5 Most Hunted Beasts</h2>
          <div className="grid-cards" style={{ "--card-min": "140px" } as React.CSSProperties}>
            {data.topHunted.map((h, idx) => (
              <div key={h.key} className="panel tight" style={{ textAlign: "center", display: "grid", gap: "6px" }}>
                <span className="chip faint" style={{ justifySelf: "center", fontSize: "var(--text-xs)" }}>#{idx + 1} Quarry</span>
                <span style={{ fontSize: "2.2rem" }} aria-hidden>{h.icon}</span>
                <b>{h.name}</b>
                <span className="faint" style={{ fontSize: "var(--text-xs)" }}>{h.region}</span>
                <span style={{ fontWeight: 700, color: "var(--gold-bright)" }}>{fmt(h.kills)} slain</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.regionBreakdown.length > 0 && (
        <Panel title="Regional Hunting Telemetry">
          <ul className="quest-list">
            {data.regionBreakdown.map((r) => (
              <li key={r.id} className="quest">
                <span className="art quest__art" aria-hidden>{r.icon}</span>
                <div className="quest__body">
                  <b>{r.name}</b>
                  <Bar value={r.kills} max={maxRegionKills} kind="xp" showNumbers label={`${fmt(r.kills)} creatures slain`} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function LogbookView() {
  const { data, isPending } = useData<{ entries: LogEntry[] }>(["logbook"], "/api/logbook");

  if (isPending || !data) return <Loading rows={4} />;

  if (data.entries.length === 0) {
    return (
      <Empty art="📖" title="Logbook is empty">
        Embark on adventures, defeat dungeon bosses, claim titles, and level up to fill your adventurer's chronicle.
      </Empty>
    );
  }

  return (
    <div className="stack stack--lg">
      <Panel title={`Adventurer's Chronicle · ${data.entries.length} recorded deeds`}>
        <ul className="quest-list">
          {data.entries.map((entry) => (
            <li key={entry.id} className="quest">
              <span className="art quest__art" aria-hidden>{entry.icon}</span>
              <div className="quest__body">
                <b>{entry.text}</b>
                <span className="faint" style={{ textTransform: "capitalize" }}>
                  {entry.kind.replace(/_/g, " ")}
                </span>
              </div>
              <div className="quest__reward">
                <span className="faint" style={{ fontSize: "var(--text-xs)" }}>{timeAgo(entry.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
