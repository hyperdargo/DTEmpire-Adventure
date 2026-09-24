import { BedDouble, Compass, Download, Hammer, Home, Monitor, Smartphone, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { innCost } from "../../../shared/rules/progression.ts";
import { Button, Coins, Countdown, Loading, PageHead, Panel, useNow } from "../components/ui.tsx";
import { fmt } from "../lib/format.ts";
import { useAction, useData, useHero } from "../state/game.ts";
import type { RegionInfo } from "./Table.tsx";

interface DailyView {
  job: { jobId: string | null; shiftStartedAt: number | null; endsAt: number | null; ready: boolean; jobs: { id: string; name: string; icon: string; level: number; wage: number }[] };
  expedition: { current: { regionId: string; durationId: string; startedAt: number; endsAt: number } | null; durations: { id: string; label: string; minutes: number }[] };
  temple: { blessings: { id: string; name: string; icon: string; desc: string; costPerLevel: number; minutes: number }[]; offeringsLeft: number };
}

export default function TownPage() {
  const { hero } = useHero();
  const { data, isPending } = useData<DailyView>(["daily"], "/api/daily");
  const now = useNow();
  const adv = useData<{ regions: RegionInfo[] }>(["adventure"], "/api/adventure");
  const [region, setRegion] = useState<string>("");
  const [dur, setDur] = useState("medium");
  const inv = [["daily"]];
  const rest = useAction("/api/inn/rest", { success: "You wake fully rested." });
  const takeJob = useAction<{ jobId: string }>("/api/jobs/take", { invalidate: inv, success: "Hired." });
  const startShift = useAction("/api/jobs/start", { invalidate: inv, success: "Shift started. Come back in 8 hours." });
  const collect = useAction("/api/jobs/collect", { invalidate: inv, success: (r) => `Wages collected: ${fmt((r as { coins: number }).coins)} coins.` });
  const pray = useAction<{ blessingId: string }>("/api/temple/pray", { invalidate: inv, success: "The blessing settles on you." });
  const offer = useAction<{ tier: 1 | 2 | 3 }>("/api/temple/offer", { invalidate: inv, success: (r) => `The altar grants ${fmt((r as { xp: number }).xp)} XP.` });
  const startExp = useAction<{ regionId: string; durationId: string }>("/api/expedition/start", { invalidate: inv, success: "Your scouts set out." });
  const collectExp = useAction("/api/expedition/collect", {
    invalidate: [["daily"], ["inventory"]],
    success: (r) => { const x = r as { coins: number; xp: number; fights: number; drops: unknown[] }; return `Scouts return from ${x.fights} skirmishes: ${fmt(x.coins)} coins, ${fmt(x.xp)} XP, ${x.drops.length} finds.`; },
  });

  if (isPending || !data) return <Loading rows={4} />;
  const job = data.job;
  const current = data.job.jobs.find((j) => j.id === job.jobId);
  const exp = data.expedition.current;
  const unlocked = (adv.data?.regions ?? []).filter((r) => r.unlocked);
  const chosenRegion = region || unlocked[unlocked.length - 1]?.id || "";
  const activeBuffs = new Set(hero.buffs.map((b) => b.id));

  return (
    <>
      <PageHead title="Town">Work shifts, send scouts on expeditions while you're away, pray for blessings, and sleep off your wounds.</PageHead>
      <div className="town">
        <Panel title={<h2><Compass size={22} aria-hidden /> Expedition</h2>}>
          {exp ? (
            <div className="stack">
              <p>Your scouts are exploring <b>{unlocked.find((r) => r.id === exp.regionId)?.name ?? exp.regionId}</b>.</p>
              {now >= exp.endsAt ? (
                <Button variant="primary" size="lg" loading={collectExp.isPending} onClick={() => collectExp.mutate(undefined)}>Collect the spoils</Button>
              ) : <p className="muted">They return in <Countdown to={exp.endsAt} />. You can keep playing meanwhile.</p>}
            </div>
          ) : (
            <div className="stack">
              <p className="muted">Scouts fight on your behalf at about a third of your active pace, bringing back coins, XP and loot. Perfect before bed.</p>
              <label className="field"><span>Region</span>
                <select className="select" value={chosenRegion} onChange={(e) => setRegion(e.target.value)}>
                  {unlocked.map((r) => <option key={r.id} value={r.id}>{r.name} (Lv {r.minLevel}–{r.maxLevel})</option>)}
                </select>
              </label>
              <div className="row row--wrap" role="radiogroup" aria-label="Duration">
                {data.expedition.durations.map((d) => (
                  <button key={d.id} type="button" role="radio" aria-checked={dur === d.id} className={`chip${dur === d.id ? " chip--gold" : ""}`} onClick={() => setDur(d.id)}>{d.label}</button>
                ))}
              </div>
              <Button variant="primary" disabled={!chosenRegion} loading={startExp.isPending} onClick={() => startExp.mutate({ regionId: chosenRegion, durationId: dur })}>Send scouts</Button>
            </div>
          )}
        </Panel>

        <Panel title={<h2><Hammer size={22} aria-hidden /> Work</h2>}>
          {current ? (
            <div className="stack">
              <p><span className="art">{current.icon}</span> You work as a <b>{current.name}</b>, earning <Coins value={current.wage} compact /> per 8-hour shift.</p>
              {job.shiftStartedAt ? (
                job.ready ? <Button variant="primary" loading={collect.isPending} onClick={() => collect.mutate(undefined)}>Collect wages</Button>
                  : <p className="muted">Shift ends in <Countdown to={job.endsAt!} />.</p>
              ) : <Button variant="primary" loading={startShift.isPending} onClick={() => startShift.mutate(undefined)}>Start an 8-hour shift</Button>}
            </div>
          ) : <p className="muted">Pick a trade below. Better jobs open as you level.</p>}
          <div className="jobs">
            {data.job.jobs.map((j) => (
              <button key={j.id} type="button" className={`job${j.id === job.jobId ? " job--current" : ""}`} disabled={hero.level < j.level || !!job.shiftStartedAt || j.id === job.jobId} onClick={() => takeJob.mutate({ jobId: j.id })}>
                <span className="art" aria-hidden>{j.icon}</span>
                <b>{j.name}</b>
                <span className="faint">{hero.level < j.level ? `Level ${j.level}` : <><Coins value={j.wage} compact /> / shift</>}</span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title={<h2><Sparkles size={22} aria-hidden /> Temple of Elders</h2>}>
          <div className="blessings">
            {data.temple.blessings.map((b) => (
              <div key={b.id} className="blessing">
                <span className="art" aria-hidden>{b.icon}</span>
                <div><b>{b.name}</b><p className="faint">{b.desc} for {b.minutes >= 60 ? `${b.minutes / 60}h` : `${b.minutes}m`}</p></div>
                <Button size="sm" disabled={activeBuffs.has(b.id)} onClick={() => pray.mutate({ blessingId: b.id })}>
                  {activeBuffs.has(b.id) ? "Active" : <Coins value={b.costPerLevel * hero.level} compact />}
                </Button>
              </div>
            ))}
          </div>
          <div className="divider" />
          <p className="muted">Offer coins at the altar for experience. {data.temple.offeringsLeft} offerings left today.</p>
          <div className="row row--wrap">
            {([1, 2, 3] as const).map((t) => (
              <Button key={t} size="sm" disabled={data.temple.offeringsLeft <= 0} onClick={() => offer.mutate({ tier: t })}>
                {["Candle", "Incense", "Golden idol"][t - 1]} · <Coins value={[20, 60, 150][t - 1]! * hero.level + 50} compact />
              </Button>
            ))}
          </div>
        </Panel>

        <Panel title={<h2><Home size={22} aria-hidden /> Royal Estate District</h2>}>
          <p className="muted">Invest your wealth in property, luxury furnishings, and pet sanctuaries for permanent hero stat bonuses and daily coin dividends.</p>
          <div style={{ marginTop: "12px" }}>
            <Link to="/estate" className="btn btn--primary">Visit Estate District</Link>
          </div>
        </Panel>

        <Panel title={<h2><Compass size={22} aria-hidden /> Adventurer's Codex & Guide</h2>}>
          <p className="muted">Encyclopedic guide on monster levels, habitats, regional loot, Blacksmith recipes, gear fusion, and pet breeding.</p>
          <div style={{ marginTop: "12px" }}>
            <Link to="/guide" className="btn btn--default">Open Guide Book</Link>
          </div>
        </Panel>

        <Panel title={<h2><Download size={22} aria-hidden /> Native Client Apps (PC & Android)</h2>}>
          <p className="muted">Experience DTEmpire Adventure with dedicated hardware acceleration, dynamic 2D lighting, and cross-platform save sync on PC and Android.</p>
          <div className="row row--wrap" style={{ marginTop: "12px", gap: "10px" }}>
            <a href="/downloads/DTEmpire-Adventure-Setup.exe" download className="btn btn--primary">
              <Monitor size={16} aria-hidden /> Windows PC (.exe)
            </a>
            <a href="/downloads/DTEmpire-Adventure.apk" download className="btn btn--primary">
              <Smartphone size={16} aria-hidden /> Android (.apk)
            </a>
            <Link to="/apps" className="btn btn--default">
              Details & Guide
            </Link>
          </div>
        </Panel>

        <Panel title={<h2><BedDouble size={22} aria-hidden /> The Inn</h2>}>
          <p className="muted">Health returns on its own over four minutes. A bed restores it instantly.</p>
          <p>{hero.hp < hero.maxHp ? <>Full health in <Countdown to={hero.hpFullAt} /> without a bed.</> : "You're at full health."}</p>
          <Button variant="primary" disabled={hero.hp >= hero.maxHp || hero.inDungeon} loading={rest.isPending} onClick={() => rest.mutate(undefined)}>Rent a room · <Coins value={innCost(hero.level)} compact /></Button>
        </Panel>
      </div>
    </>
  );
}
