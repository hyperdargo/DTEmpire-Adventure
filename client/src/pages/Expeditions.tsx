import { Link } from 'react-router';
import type { expeditionsView } from '../../../server/game/expeditions.ts';
import type { CampUpgrade } from '../../../shared/data/expeditions.ts';
import { Bar, Button, Coins, Loading, PageHead, Panel } from '../components/ui.tsx';
import { useAction, useData, useHero } from '../state/game.ts';

type Overview = ReturnType<typeof expeditionsView>;
const descriptions: Record<CampUpgrade, string> = {
  stores: '+2 departure supplies per rank. Start with 10; careful choices use 2 each.',
  bulwark: '+10 expedition integrity and −2 damage per rank. Does not change hero HP.',
  cartography: 'Reduces risky-choice failure chance by 5 percentage points per rank.',
};
export default function ExpeditionsPage() {
  const me = useHero();
  const { data, isPending, isError, refetch } = useData<Overview>(['expeditions'], '/api/expeditions');
  const options = { invalidate: [['expeditions']], success: 'Expedition ledger updated.' };
  const start = useAction<{ routeId: string; version: number }>('/api/expeditions/start', options);
  const order = useAction<{ version: number; runId: string; step: number; action: 'choose' | 'return' | 'abandon'; choiceId?: string }>('/api/expeditions/order', options);
  const upgrade = useAction<{ upgrade: CampUpgrade; version: number }>('/api/expeditions/upgrade', options);
  const busy = start.isPending || order.isPending || upgrade.isPending;
  if (isPending) return <Loading rows={4} />;
  if (isError || !data) return <Panel title="Expedition ledger unavailable"><Button onClick={() => void refetch()}>Try again</Button></Panel>;
  const blocked = busy || !!me.activeBattle || !data.unlocked;
  const run = data.run;
  const route = data.routes.find(x => x.id === run?.expeditionId);
  const issue = (action: 'choose' | 'return' | 'abandon', choiceId?: string) => {
    if (run) order.mutate({ action, choiceId, runId: run.id, step: run.step, version: data.version });
  };
  return <>
    <PageHead title="Imperial Expeditions">Twelve roads beyond the familiar. Lead the party; decide what comes home.</PageHead>
    <div className="stack stack--lg" style={{ background: '#0a0a0a', color: '#eee' }}>
      <Panel title="Imperial Field Office">
        <Button disabled={busy} onClick={() => void refetch()}>Refresh ledger</Button>
        <div className="row row--wrap"><span className="chip">Intelligence {data.intel.toLocaleString()}</span><span className="chip">Seals {data.seals.length}/12</span><span className="chip">Completed returns {data.completed}</span></div>
        <p className="muted">Active tactical journeys, separate from Town’s idle scouts. Each departure costs in-game coins. Intelligence is bound to your camp and cannot be sold.</p>
        {!data.unlocked && <p role="status">Unlocks at level {data.minLevel}. Preview the routes below.</p>}
        {me.activeBattle && <p role="status">Finish your battle first. <Link to="/battle">Return to battle</Link></p>}
        <p className="faint">Careful choices cost 2 supplies with no damage. Bold choices cost 1 but can injure the party and reduce finds. Bypass costs 1 with minor guaranteed damage. Bank at any time; only a complete return earns a seal. Abandon or collapse loses all cargo. No passive timer and no hero HP loss.</p>
        {data.lastReport && <p role="status" aria-live="polite">{data.lastReport}</p>}
      </Panel>
      {run && route ? <Panel title={`${route.name} · ${run.step}/${route.encounters} encounters`}>
        <div className="stack">
          <Bar value={run.integrity} max={run.maxIntegrity} label="Party integrity" showNumbers />
          <div className="row row--wrap"><span className="chip">Supplies {run.supplies}</span><span className="chip">Unbanked intelligence {run.cargo}</span></div>
          {data.encounter ? <section aria-label="Current encounter">
            <h3>{data.encounter.title}</h3><p>{data.encounter.text}</p>
            <div className="grid grid--3">{data.encounter.choices.map(c => <article key={c.id} style={{ border: '1px solid #333', borderRadius: 8, padding: 16, minWidth: 0 }}>
              <h4>{c.label}</h4><p className="faint">{c.supplies} supplies · {c.risk}% hazard · {c.damage} {c.risk ? 'damage on failure' : 'damage'} · {c.intel} intelligence {c.risk ? `(failure: ${Math.floor(c.intel / 3)})` : ''}</p>
              <Button disabled={blocked || run.supplies < c.supplies} onClick={() => issue('choose', c.id)}>Choose {c.id}</Button>
            </article>)}</div>
            {run.supplies === 0 && <p role="status">Supplies exhausted. Return to keep your cargo; no more encounters can be resolved.</p>}
          </section> : <p role="status">Route complete. Return to bank your intelligence and {data.seals.includes(route.id) ? 'record a repeat clear' : 'secure your first-clear seal (+25 intelligence)'}.</p>}
          <div className="row row--wrap">
            <Button variant="primary" disabled={blocked} onClick={() => issue('return')}>Return & bank {run.cargo} intelligence</Button>
            <Button disabled={blocked} onClick={() => { if (window.confirm('Abandon this expedition? All unbanked intelligence will be lost.')) issue('abandon'); }}>Abandon · lose cargo</Button>
          </div>
          <details><summary>Expedition journal · {run.log.length} entries</summary><ol className="faint">{run.log.map((line, i) => <li key={i}>{line}</li>)}</ol></details>
        </div>
      </Panel> : <Panel title="Choose your next route"><div className="grid grid--2">{data.routes.map(r => <article key={r.id} style={{ border: '1px solid #333', borderRadius: 8, padding: 16, minWidth: 0 }}>
        <h3>{r.name}</h3><p className="muted">Level {r.level} · {r.encounters} authored encounters</p><p className="faint">{r.sealed ? 'First-clear seal secured. Repeat for intelligence and XP.' : 'Complete every encounter and return for a permanent seal and +25 intelligence.'}</p>
        <Button disabled={blocked || !r.unlocked || me.hero.coins < r.fee} onClick={() => start.mutate({ routeId: r.id, version: data.version })}>{r.unlocked ? 'Depart' : `Requires level ${r.level}`} · <Coins value={r.fee} /></Button>
      </article>)}</div></Panel>}
      <Panel title="Permanent camp · Five ranks each"><div className="grid grid--3">{data.upgrades.map(u => <article key={u.id} style={{ minWidth: 0 }}>
        <h3 style={{ textTransform: 'capitalize' }}>{u.id} · {u.rank}/{u.maxRank}</h3><p className="faint">{descriptions[u.id]}</p>
        <Button disabled={blocked || !!run || u.rank >= u.maxRank || data.intel < u.cost.intel || me.hero.coins < u.cost.coins} onClick={() => upgrade.mutate({ upgrade: u.id, version: data.version })}>{u.rank >= u.maxRank ? 'Maximum rank' : <><Coins value={u.cost.coins} /> + {u.cost.intel} intelligence</>}</Button>
      </article>)}</div><p className="faint">Refits require a return to camp. Costs increase each rank; no resets, trading or real-money purchases.</p></Panel>
      <Panel title="Release notes · Imperial Expeditions"><p>Twelve level-gated journeys from level {data.minLevel} to {data.routes.at(-1)?.level}; 55 authored encounters; first-clear seals; three permanent camp upgrades; safe returns and risky field choices. Existing accounts, items, classes, excavation and idle scouts are unchanged.</p><p className="faint">- By Hermes</p></Panel>
      <p><Link to="/guide">Guide Book</Link> · <Link to="/town">Return to Town</Link></p>
    </div>
  </>;
}
