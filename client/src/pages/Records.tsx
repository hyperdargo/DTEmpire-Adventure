import { useState } from "react";
import { GameCard } from "../components/GameCard.tsx";
import { Bar, Button, Chip, Empty, Loading, PageHead, Panel, RarityChip, Tabs } from "../components/ui.tsx";
import { fmt, timeAgo } from "../lib/format.ts";
import { filterLogbook } from "../lib/logbook.ts";
import { filterTitles } from "../lib/titles.ts";
import { filterAchievements, type AchievementFilter } from "../lib/achievements.ts";
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
  const [tab, setTab] = useState<"bestiary" | "achievements" | "titles" | "stats" | "logbook" | "relics">("bestiary");
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
          { value: "relics", label: "Reliquary" },
        ]}
      />
      <div style={{ marginTop: "var(--s-5)" }}>
        {tab === "bestiary" && <BestiaryView />}
        {tab === "achievements" && <AchievementsView />}
        {tab === "titles" && <TitlesView />}
        {tab === "stats" && <CombatStatsView />}
        {tab === "logbook" && <LogbookView />}
        {tab === "relics" && <ReliquaryView />}
      </div>
    </>
  );
}

function BestiaryView() {
  const { data, isPending } = useData<Bestiary>(["bestiary"], "/api/bestiary");
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [rankFilter, setRankFilter] = useState("all");
  const [showUndiscovered, setShowUndiscovered] = useState(true);
  if (isPending || !data) return <Loading rows={4} />;
  const all = data.regions.flatMap((r) => r.creatures);
  const found = all.filter((c) => c.kills > 0).length;
  const lc = search.toLowerCase();
  const filteredRegions = data.regions
    .filter((r) => regionFilter === "all" || r.id === regionFilter)
    .map((r) => ({
      ...r,
      creatures: r.creatures.filter((c) => {
        if (!showUndiscovered && c.kills === 0) return false;
        if (lc && !(c.name ?? "undiscovered").toLowerCase().includes(lc)) return false;
        if (rankFilter !== "all") {
          const targetRank = rankFilter === "none" ? 0 : data.tiers.findIndex(t => t.name.toLowerCase() === rankFilter) + 1;
          if (c.rank !== targetRank) return false;
        }
        return true;
      }),
    }))
    .filter((r) => r.creatures.length > 0);
  return (
    <div className="stack stack--lg">
      <Panel tight>
        <Bar value={found} max={all.length} kind="xp" showNumbers label="Creatures discovered" />
        <p className="faint" style={{ marginTop: "var(--s-3)" }}>Mastery ranks: {data.tiers.map((t) => `${t.name} at ${t.kills} kills`).join(" · ")}. Each rank adds +3% attack and +2% defense against that creature.</p>
      </Panel>
      <Panel tight>
        <div style={{ display: "flex", gap: "var(--s-3)", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search creatures…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: "1 1 180px", minWidth: "150px", padding: "var(--s-3) var(--s-4)", background: "#1a1a1a", border: "1px solid #333", borderRadius: "6px", color: "#fff", fontSize: "0.875rem" }}
            aria-label="Search creatures by name"
          />
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            style={{ padding: "var(--s-3) var(--s-4)", background: "#1a1a1a", border: "1px solid #333", borderRadius: "6px", color: "#fff", fontSize: "0.875rem" }}
            aria-label="Filter by region"
          >
            <option value="all">All Regions</option>
            {data.regions.map((r) => <option key={r.id} value={r.id}>{r.icon} {r.name}</option>)}
          </select>
          <select
            value={rankFilter}
            onChange={(e) => setRankFilter(e.target.value)}
            style={{ padding: "var(--s-3) var(--s-4)", background: "#1a1a1a", border: "1px solid #333", borderRadius: "6px", color: "#fff", fontSize: "0.875rem" }}
            aria-label="Filter by mastery rank"
          >
            <option value="all">All Ranks</option>
            <option value="none">No Rank</option>
            {data.tiers.map((t) => <option key={t.name} value={t.name.toLowerCase()}>{t.name}</option>)}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", color: "#999", fontSize: "0.8rem", cursor: "pointer" }}>
            <input type="checkbox" checked={showUndiscovered} onChange={(e) => setShowUndiscovered(e.target.checked)} />
            Undiscovered
          </label>
        </div>
      </Panel>
      {filteredRegions.length === 0 && <Empty art="🔍" title="No creatures match your filters">Try adjusting your search or filters.</Empty>}
      {filteredRegions.map((r) => {
        const origIdx = data.regions.findIndex(orig => orig.id === r.id);
        return (
          <section key={r.id}>
            <h2 className="section-title"><span className="art" aria-hidden>{r.icon}</span> {r.name} <span className="faint">Lv {r.minLevel}+</span></h2>
            <div className="grid-cards" style={{ "--card-min": "130px" } as React.CSSProperties}>
              {r.creatures.map((c) => (
                <GameCard key={c.key} size="sm" rarity={c.boss ? "mythic" : c.kills ? regionRarity(origIdx, data.regions.length) : "common"} art={c.icon ?? "❔"} name={c.name ?? "Undiscovered"}
                  type={c.kills ? `${fmt(c.kills)} slain` : c.boss ? "Boss" : "Unknown"} disabled={!c.kills}
                  badge={c.rank ? data.tiers[c.rank - 1]?.name : undefined} label={c.name ?? "Undiscovered creature"} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AchievementsView() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AchievementFilter>("all");
  const { data, isPending } = useData<Achievements>(["achievements"], "/api/achievements");
  const setTitle = useAction<{ title: string | null }>("/api/profile", { invalidate: [["achievements"], ["titles"], ["me"]], success: "Title updated." });
  if (isPending || !data) return <Loading rows={4} />;
  const done = data.achievements.filter((a) => a.done).length;
  const visible = filterAchievements(data.achievements, search, status);
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
        <div className="row row--wrap" style={{ marginBottom: "var(--s-4)" }}>
          <input className="input" aria-label="Search achievements" placeholder="Search names, rewards, titles…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input" aria-label="Filter achievement status" value={status} onChange={e => setStatus(e.target.value as AchievementFilter)}>
            <option value="all">All achievements</option>
            <option value="pending">In progress</option>
            <option value="earned">Earned</option>
          </select>
          <Button size="sm" onClick={() => { setSearch(""); setStatus("all"); }}>Reset filters</Button>
        </div>
        <p className="faint" role="status">Showing {visible.length} of {data.achievements.length} achievements</p>
        {visible.length === 0 && <Empty art="🔍" title="No achievements match">Try another search or reset the filters.</Empty>}
        <ul className="quest-list">
          {visible.map((a) => (
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
  const [search, setSearch] = useState("");

  if (isPending || !data) return <Loading rows={4} />;

  const filtered = filterTitles(data.titles ?? [], search, filter, category);

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
      <div className="row row--wrap" style={{ gap: "var(--s-2)" }}>
        <input className="input" type="search" aria-label="Search titles" placeholder="Search title, source or description…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {(search || filter !== "all" || category !== "all") && (
          <Button size="sm" onClick={() => { setSearch(""); setFilter("all"); setCategory("all"); }}>Reset filters</Button>
        )}
      </div>
      <span className="faint" role="status">Showing {filtered.length} of {data.total} titles</span>

      <ul className="quest-list">
        {filtered.length === 0 ? (
          <li className="quest">
            <span className="art quest__art" aria-hidden>🔍</span>
            <div className="quest__body">
              <b>No titles match this filter</b>
              <span className="faint">Try a different search, ownership filter or category, or reset filters.</span>
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
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");

  if (isPending || !data) return <Loading rows={4} />;

  if (data.entries.length === 0) {
    return (
      <Empty art="📖" title="Logbook is empty">
        Embark on adventures, defeat dungeon bosses, claim titles, and level up to fill your adventurer's chronicle.
      </Empty>
    );
  }

  const entries = filterLogbook(data.entries, search, kind);
  const kinds = [...new Set(data.entries.map(entry => entry.kind))].sort();
  return (
    <div className="stack stack--lg">
      <Panel title={`Adventurer's Chronicle · ${data.entries.length} recorded deeds`}>
        <div className="row row--wrap" style={{ marginBottom: "var(--s-4)" }}>
          <input aria-label="Search chronicle" placeholder="Search deeds…" value={search} onChange={e => setSearch(e.target.value)} style={{ background: "#0a0a0a", color: "#fff", border: "1px solid #333", padding: "var(--s-3)", maxWidth: "100%" }} />
          <select aria-label="Filter deed category" value={kind} onChange={e => setKind(e.target.value)} style={{ background: "#0a0a0a", color: "#fff", border: "1px solid #333", padding: "var(--s-3)" }}>
            <option value="all">All deeds</option>
            {kinds.map(value => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}
          </select>
          <Button size="sm" onClick={() => { setSearch(""); setKind("all"); }}>Reset filters</Button>
        </div>
        <p className="faint" role="status">Showing {entries.length} of {data.entries.length} loaded deeds. Filters do not delete history.</p>
        {entries.length === 0 && <Empty art="📖" title="No deeds match">Try another search or reset the filters.</Empty>}
        <ul className="quest-list">
          {entries.map((entry) => (
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

interface RelicViewItem {
  id: string;
  name: string;
  icon: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic" | "unique";
  category: "chapter" | "spire" | "abyss" | "apex";
  chapter?: number;
  source: string;
  desc: string;
  statSummary: string;
  owned: boolean;
  rank: number;
  currentStats: Record<string, number>;
  nextCost?: {
    coins: number;
    material: string;
    materialName: string;
    materialQty: number;
    canAfford: boolean;
  };
}

interface RelicsData {
  relics: RelicViewItem[];
  totalDiscovered: number;
  totalRelics: number;
  totalConsecrations: number;
  resonanceBonuses: Record<string, number>;
  completionPct: number;
}

function ReliquaryView() {
  const { data, isPending } = useData<RelicsData>(["relics"], "/api/relics");
  const consecrate = useAction<{ relicId: string }>("/api/relics/consecrate", {
    invalidate: [["relics"], ["me"]],
    success: "Relic consecrated!",
  });
  const [filter, setFilter] = useState<"all" | "discovered" | "undiscovered" | "consecrated">("all");

  if (isPending || !data) return <Loading rows={4} />;

  const filtered = data.relics.filter((r) => {
    if (filter === "discovered") return r.owned;
    if (filter === "undiscovered") return !r.owned;
    if (filter === "consecrated") return r.owned && r.rank > 1;
    return true;
  });

  const bonusEntries = Object.entries(data.resonanceBonuses).filter(([, v]) => typeof v === "number" && v > 0);

  return (
    <div className="stack stack--lg">
      <Panel tight>
        <Bar value={data.totalDiscovered} max={data.totalRelics} kind="xp" showNumbers label="Ancient Relics Discovered" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)", marginTop: "var(--s-3)", alignItems: "center" }}>
          <Chip tone="gold">🏛️ Reliquary: {data.totalDiscovered} / {data.totalRelics} ({data.completionPct}%)</Chip>
          <Chip tone="good">⭐ Total Consecration Ranks: {data.totalConsecrations}</Chip>
        </div>
        {bonusEntries.length > 0 && (
          <div style={{ marginTop: "var(--s-3)", paddingTop: "var(--s-3)", borderTop: "1px solid var(--border)" }}>
            <div className="faint" style={{ fontSize: "var(--text-xs)", marginBottom: "var(--s-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Active Relic Resonance (Permanent Account Blessings):
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)" }}>
              {bonusEntries.map(([k, v]) => (
                <Chip key={k} tone="gold">
                  +{v}{k.endsWith("Pct") ? "%" : k.startsWith("crit") || k === "dodge" || k === "lifesteal" || k === "pierce" ? "%" : ""} {k.replace("Pct", "").toUpperCase()}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap" }}>
        {(["all", "discovered", "undiscovered", "consecrated"] as const).map((mode) => (
          <Button
            key={mode}
            variant={filter === mode ? "primary" : "ghost"}
            size="sm"
            onClick={() => setFilter(mode)}
            style={{ textTransform: "capitalize" }}
          >
            {mode} ({mode === "all" ? data.relics.length : mode === "discovered" ? data.totalDiscovered : mode === "undiscovered" ? data.totalRelics - data.totalDiscovered : data.relics.filter((r) => r.owned && r.rank > 1).length})
          </Button>
        ))}
      </div>

      <div className="grid-cards" style={{ "--card-min": "260px" } as React.CSSProperties}>
        {filtered.map((relic) => {
          const stars = relic.owned ? "★".repeat(relic.rank) + "☆".repeat(5 - relic.rank) : "☆☆☆☆☆";
          return (
            <div
              key={relic.id}
              style={{
                background: relic.owned ? "var(--surface)" : "#111",
                border: `1px solid ${relic.owned ? "var(--border-bright)" : "var(--border)"}`,
                borderRadius: "var(--radius)",
                padding: "var(--s-4)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--s-2)",
                opacity: relic.owned ? 1 : 0.65,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "1.75rem" }} aria-hidden>{relic.icon}</span>
                <div style={{ display: "flex", gap: "var(--s-1)" }}>
                  <RarityChip rarity={relic.rarity} />
                  <Chip>{relic.category.toUpperCase()}</Chip>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: "var(--text-md)", fontWeight: "bold", margin: 0, color: relic.owned ? "var(--text)" : "var(--text-faint)" }}>
                  {relic.name}
                </h3>
                <div className="faint" style={{ fontSize: "var(--text-xs)", marginTop: "2px" }}>
                  {relic.source}
                </div>
              </div>

              <p className="faint" style={{ fontSize: "var(--text-xs)", margin: "4px 0", flex: 1 }}>
                {relic.desc}
              </p>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: "var(--s-2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="faint" style={{ fontSize: "var(--text-xs)" }}>Resonance:</span>
                  <span style={{ fontWeight: "bold", color: relic.owned ? "#d4af37" : "var(--text-faint)" }}>
                    {relic.statSummary} {relic.owned && relic.rank > 1 ? `(Rank ${relic.rank})` : ""}
                  </span>
                </div>
                <div style={{ fontSize: "0.85rem", letterSpacing: "2px", marginTop: "2px", color: relic.owned ? "#d4af37" : "#555" }}>
                  {stars} {relic.owned ? `Rank ${relic.rank}/5` : "Undiscovered"}
                </div>
              </div>

              {relic.owned && relic.rank < 5 && relic.nextCost && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!relic.nextCost.canAfford || consecrate.isPending}
                  onClick={() => consecrate.mutate({ relicId: relic.id })}
                  style={{ marginTop: "var(--s-1)" }}
                >
                  ⭐ Consecrate (Rank {relic.rank + 1}): {fmt(relic.nextCost.coins)}g + {relic.nextCost.materialQty}x {relic.nextCost.materialName}
                </Button>
              )}

              {relic.owned && relic.rank === 5 && (
                <div style={{ textAlign: "center", padding: "var(--s-1)", fontSize: "var(--text-xs)", color: "#d4af37", fontWeight: "bold" }}>
                  🌟 Maximum Transcendent Rank
                </div>
              )}

              {!relic.owned && (
                <div className="faint" style={{ textAlign: "center", padding: "var(--s-1)", fontSize: "var(--text-xs)", fontStyle: "italic" }}>
                  🔒 Defeat boss or clear spire to discover
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
