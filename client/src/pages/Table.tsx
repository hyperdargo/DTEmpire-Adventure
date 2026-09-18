import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Swords } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { CardBack, GameCard } from "../components/GameCard.tsx";
import { HeroCard } from "../components/HeroCard.tsx";
import { Bar, Button, Countdown } from "../components/ui.tsx";
import type { ServerEvent } from "../lib/realtime.ts";
import { timeAgo } from "../lib/format.ts";
import { useAction, useData, useHero } from "../state/game.ts";

export interface RegionInfo {
  id: string; name: string; icon: string; description: string; minLevel: number; maxLevel: number; unlocked: boolean;
  kills: number; bossUnlockKills: number; boss: { name: string; icon: string }; monsters: { id: string; name: string; icon: string }[];
}

const REGION_KEY = "dte:region";
export function rememberedRegion(): string | null {
  try {
    return localStorage.getItem(REGION_KEY);
  } catch {
    return null;
  }
}
export function rememberRegion(id: string) {
  try {
    localStorage.setItem(REGION_KEY, id);
  } catch {
    // no storage: fine
  }
}

export function useStartBattle(path: string, invalidate: string[][] = []) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return useAction<Record<string, unknown>, { id: string }>(path, {
    invalidate,
    onSuccess: (battle) => {
      qc.setQueryData(["battle"], { battle });
      navigate("/battle");
    },
  });
}

export function TablePage() {
  const me = useHero();
  const hero = me.hero;
  const b = me.badges;
  const { data: adv } = useData<{ regions: RegionInfo[] }>(["adventure"], "/api/adventure");
  // The realm feed is filled by the realtime socket; nothing to fetch.
  const { data: feed } = useQuery<ServerEvent[]>({ queryKey: ["feed"], queryFn: () => [], staleTime: Infinity });
  const unlocked = useMemo(() => (adv?.regions ?? []).filter((r) => r.unlocked), [adv]);
  const [regionId, setRegionId] = useState<string | null>(rememberedRegion());
  const region = unlocked.find((r) => r.id === regionId) ?? unlocked[unlocked.length - 1];
  const start = useStartBattle("/api/adventure/start");
  const claimDaily = useAction("/api/daily/claim", { invalidate: [["daily"]], success: (r: unknown) => `Daily reward claimed. Streak ${(r as { streak: number }).streak}!` });
  const navigate = useNavigate();
  const bossReady = region && region.kills >= region.bossUnlockKills;

  const hand = [
    b.daily && { key: "daily", art: "🎁", name: "Daily reward", rarity: "legendary", text: `Day ${b.streak + 1} of your streak.`, cta: "Claim", onClick: () => claimDaily.mutate(undefined) },
    { key: "quests", art: "📜", name: "Quests", rarity: b.contracts + b.missions > 0 ? "epic" : "common", text: b.contracts + b.missions > 0 ? `${b.contracts + b.missions} reward${b.contracts + b.missions > 1 ? "s" : ""} to claim` : "Hunt contracts and missions", onClick: () => navigate("/quests") },
    { key: "tower", art: "🏰", name: `Tower · Floor ${Math.min(100, hero.towerFloor + 1)}`, rarity: (hero.towerFloor + 1) % 5 === 0 ? "mythic" : "rare", text: (hero.towerFloor + 1) % 5 === 0 ? "A chapter boss waits." : "Climb toward the Void Gate.", onClick: () => navigate("/tower") },
    {
      key: "expedition", art: "🧭", name: "Expedition", rarity: b.expedition === "ready" ? "legendary" : "uncommon",
      text: b.expedition === "ready" ? "Your scouts are back!" : b.expedition === "active" && b.expeditionEndsAt ? <>Back in <Countdown to={b.expeditionEndsAt} /></> : "Send scouts while you're away.",
      onClick: () => navigate("/town"),
    },
    hero.level >= 10 && { key: "raid", art: "🌋", name: "World Boss", rarity: b.worldBossAttempts > 0 ? "mythic" : "common", text: b.worldBossAttempts > 0 ? `${b.worldBossAttempts} strikes left today` : "Back tomorrow", onClick: () => navigate("/raid") },
    b.event && { key: "festival", art: b.event.icon, name: b.event.name, rarity: "mythic", text: <>Ends in <Countdown to={b.event.endsAt} /></>, onClick: () => navigate("/festival") },
    b.mail > 0 && { key: "mail", art: "✉️", name: "Mail", rarity: "uncommon", text: `${b.mail} unread`, onClick: () => navigate("/mail") },
  ].filter(Boolean) as { key: string; art: string; name: string; rarity: string; text: React.ReactNode; onClick: () => void }[];

  const wounded = hero.hp < hero.maxHp * 0.15;

  return (
    <div className="table-page">
      <h1 className="sr-only">The Table</h1>
      <section className="table-top">
        <div className="table-top__hero">
          <HeroCard />
          <div className="table-top__vitals">
            <Bar value={hero.hp} max={hero.maxHp} kind="hp" label="Health" showNumbers />
            <Bar value={hero.xp} max={hero.xpToNext || 1} kind="xp" label={`Level ${hero.level}`} showNumbers={hero.xpToNext > 0} />
            {hero.buffs.length > 0 && (
              <div className="row row--wrap">
                {hero.buffs.map((bf) => <span key={bf.id} className="chip chip--gold"><span className="art">{bf.icon}</span>{bf.name} · <Countdown to={bf.until} /></span>)}
              </div>
            )}
          </div>
        </div>

        <div className="felt">
          <div className="felt__head">
            <div>
              <h2>{region ? <><span className="art" aria-hidden>{region.icon}</span> {region.name}</> : "Choose a region"}</h2>
              {region && <p className="muted">Level {region.minLevel}–{region.maxLevel} · {region.kills}/{region.bossUnlockKills} to draw out the boss</p>}
            </div>
            <label className="felt__region">
              <span className="sr-only">Region</span>
              <select className="select" value={region?.id ?? ""} onChange={(e) => { setRegionId(e.target.value); rememberRegion(e.target.value); }}>
                {unlocked.map((r) => <option key={r.id} value={r.id}>{r.name} (Lv {r.minLevel}+)</option>)}
              </select>
            </label>
          </div>

          <div className="felt__play">
            <div className="felt__deck">
              <CardBack size="lg" label="Next encounter, face down" onClick={region && !wounded ? () => start.mutate({ regionId: region.id }) : undefined} />
              <span className="felt__deck-shadow" aria-hidden />
            </div>
            <div className="felt__actions">
              <p className="muted">
                {me.activeBattle ? "Finish your current battle before drawing again." : wounded ? "You're too wounded to fight. Rest at the inn, drink a potion, or wait for your health to return." : "Draw the top card to meet what's waiting in the dark."}
              </p>
              {me.activeBattle ? (
                <Link className="btn btn--primary btn--lg" to="/battle">Return to battle</Link>
              ) : (
                <Button variant="primary" size="lg" icon={<Swords size={20} />} loading={start.isPending} disabled={!region || wounded || hero.inDungeon} onClick={() => region && start.mutate({ regionId: region.id })}>
                  Draw encounter
                </Button>
              )}
              {region && (
                <Button icon={<Crown size={18} />} disabled={!bossReady || !!me.activeBattle || wounded || hero.inDungeon} onClick={() => start.mutate({ regionId: region.id, boss: true })}>
                  {bossReady ? `Challenge ${region.boss.name}` : `Boss unlocks in ${region.bossUnlockKills - region.kills} kills`}
                </Button>
              )}
              {hero.inDungeon && <Link to="/dungeon" className="faint">You're mid-run in the Dungeon.</Link>}
            </div>
          </div>
        </div>
      </section>

      <section className="hand-zone" aria-label="Ready to play">
        <h2 className="hand-zone__title">Your hand</h2>
        <div className="hand">
          {hand.map((c, i) => (
            <div key={c.key} className="hand__slot" style={{ "--i": i, "--n": hand.length, "--lift": Math.abs(i - (hand.length - 1) / 2) } as React.CSSProperties}>
              <GameCard size="md" rarity={c.rarity} art={c.art} name={c.name} text={c.text} onClick={c.onClick} label={c.name} className={c.rarity === "legendary" || c.rarity === "mythic" ? "card--ready" : undefined} />
            </div>
          ))}
        </div>
      </section>

      {feed && feed.length > 0 && (
        <section className="feed panel panel--tight" aria-label="Across the realm">
          <h2 className="feed__title">Across the realm</h2>
          <ul>
            {feed.slice(0, 6).map((f, i) => (
              <li key={i}><span className="art" aria-hidden>{String(f.icon ?? "✨")}</span> {String(f.text)} <span className="faint">{timeAgo(Number(f.at))}</span></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
