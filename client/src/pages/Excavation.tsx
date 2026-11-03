import { Link } from 'react-router';
import type { excavationView } from '../../../server/game/excavation.ts';
import { EXCAVATION_REWARDS, equipmentCost, type ExcavationAction, type ExcavationEquipment } from '../../../shared/data/excavation.ts';
import { FRONTIER_CLASSES } from '../../../shared/data/frontier.ts';
import { Bar, Button, Coins, Loading, PageHead, Panel } from '../components/ui.tsx';
import { useAction, useData, useHero } from '../state/game.ts';

type Overview = ReturnType<typeof excavationView>;
export default function ExcavationPage() {
  const me = useHero();
  const { data, isPending, isError, refetch } = useData<Overview>(['excavation'], '/api/excavation');
  const options = { invalidate: [['excavation']], success: 'Excavation ledger updated.' };
  const start = useAction<{ sector: number }>('/api/excavation/start', options);
  const work = useAction<{ action: ExcavationAction }>('/api/excavation/work', options);
  const upgrade = useAction<{ equipment: ExcavationEquipment }>('/api/excavation/upgrade', options);
  const redeem = useAction<{ rewardId: string }>('/api/excavation/redeem', options);
  const adopt = useAction<{ classId: string }>('/api/excavation/class', options);
  const busy = start.isPending || work.isPending || upgrade.isPending || redeem.isPending || adopt.isPending;
  if (isPending) return <Loading rows={4} />;
  if (isError || !data) return <Panel title="Excavation unavailable"><Button onClick={() => void refetch()}>Try again</Button></Panel>;
  const blocked = busy || !!me.activeBattle || !data.unlocked;
  const run = data.run;
  return <>
    <PageHead title="Imperial Excavation">Fund the expedition. Read the seams. Choose how much to risk.</PageHead>
    <div className="stack stack--lg" style={{ background: '#0a0a0a', color: '#eee' }}>
      <Panel title="The Imperial Survey Office">
        <p className="muted">A tactical resource expedition, not an idle timer. Every contract costs coins. Research cannot be sold or exchanged for coins.</p>
        <div className="row row--wrap"><span className="chip">Research {data.research.toLocaleString()}</span><span className="chip">Best sector {data.bestSector}/10</span><span className="chip">Returned contracts {data.completed}</span><span className="chip">Current role: {me.hero.class.name}</span></div>
        {!data.unlocked && <p role="status">Opens at level {data.minLevel}. Keep adventuring to earn your survey license.</p>}
        {me.activeBattle && <p role="status">Finish your battle before working in the excavation. <Link to="/battle">Return to battle</Link></p>}
        <p className="faint">Return after 3 extractions to clear a sector. Each run has 8 supplies. Survey and Brace consume one each; extraction consumes one. Retreat early to save cargo. Collapse saves only 25% research and earns no clear or XP.</p>
      </Panel>
      {run ? <Panel title={`${data.sectors.find(s => s.id === run.sector)?.name} · Contract in progress`}>
        <div className="grid grid--2"><div><Bar value={Math.max(0, run.integrity)} max={100 + data.ranks.hull * 8} label="Hull integrity" showNumbers /><p>Supplies: <b>{run.supplies}/8</b> · Seams: <b>{run.depth}</b> · Cargo: <b>{run.cargo} research</b></p></div><div><p>{run.surveyed ? 'Next seam surveyed' : 'Uncharted seam'} · {run.braced ? 'Supports braced' : 'Supports unbraced'}</p><p className="faint">Drill adds +2 research/rank. Hull adds 8 integrity and reduces damage by 2/rank. Survey reduces damage by 2/rank and adds research when mapped.</p></div></div>
        <div className="row row--wrap">
          <Button disabled={blocked || !run.supplies || run.surveyed} onClick={() => work.mutate({ action: 'survey' })}>Survey · 1 supply</Button>
          <Button disabled={blocked || !run.supplies || run.braced} onClick={() => work.mutate({ action: 'brace' })}>Brace · 1 supply</Button>
          <Button variant="primary" disabled={blocked || !run.supplies} onClick={() => work.mutate({ action: 'extract' })}>Extract · 1 supply</Button>
          <Button disabled={blocked} onClick={() => work.mutate({ action: 'return' })}>Return & bank {run.cargo} research</Button>
        </div>
        <ol aria-label="Contract activity" aria-live="polite" className="faint">{run.log.map((line, i) => <li key={i}>{line}</li>)}</ol>
      </Panel> : <Panel title="Choose a contract">
        <div className="grid grid--2">{data.sectors.map(s => <article key={s.id} style={{ border: '1px solid #333', borderRadius: 8, padding: 16 }}>
          <h3>{s.id}. {s.name}</h3><p className="muted">Level {s.level} · {s.research} research per seam · Base hazard {s.hazard}</p>
          <p className="faint">{s.id <= data.bestSector ? 'Survey charter secured. Repeat freely.' : s.id === data.bestSector + 1 ? 'Next frontier. Bring back 3 seams to secure its charter.' : `Clear sector ${s.id - 1} first.`}</p>
          <Button disabled={blocked || !s.unlocked || me.hero.coins < s.fee} onClick={() => start.mutate({ sector: s.id })}>Fund contract · <Coins value={s.fee} /></Button>
        </article>)}</div>
      </Panel>}
      <Panel title="Permanent equipment · Ranks 0–10"><div className="grid grid--3">{data.equipment.map(e => {
        const cost = equipmentCost(e.rank);
        return <article key={e.id}><h3 style={{ textTransform: 'capitalize' }}>{e.id} · {e.rank}/10</h3><p className="faint">{e.id === 'drill' ? '+2 research per extraction per rank.' : e.id === 'hull' ? '+8 hull and −2 extraction damage per rank.' : 'Survey action: −2 damage and +1 research per rank.'}</p><Button disabled={blocked || !!run || e.rank >= 10 || data.research < cost.research || me.hero.coins < cost.coins} onClick={() => upgrade.mutate({ equipment: e.id })}>{e.rank >= 10 ? 'Fully upgraded' : <><Coins value={cost.coins} /> + {cost.research} research</>}</Button></article>;
      })}</div></Panel>
      <Panel title="Research commissions · Earned, never rolled"><div className="grid grid--2">{data.rewards.map(reward => <article key={reward.id} style={{ border: '1px solid #333', borderRadius: 8, padding: 16 }}>
        <h3>{reward.name}</h3><p className="faint">Sector {reward.sector} charter · Level {reward.level} · {reward.kind === 'gear' ? 'One mythic item, delivered directly to your bag.' : 'Permanent discipline license. Switch freely at this office after unlocking.'}</p>
        <Button disabled={blocked || !!run || reward.claimed || !reward.unlocked || data.research < reward.research || me.hero.coins < reward.coins} onClick={() => redeem.mutate({ rewardId: reward.id })}>{reward.claimed ? 'Commission completed' : <><Coins value={reward.coins} /> + {reward.research} research</>}</Button>
      </article>)}</div></Panel>
      <Panel title="Advanced disciplines · No progress reset">
        <p className="muted">Your original class and tier are saved on first adoption. Equipment, skills, talents, XP and unique claims stay yours. Switching preserves your HP percentage and cannot heal you.</p>
        <div className="grid grid--2">{FRONTIER_CLASSES.map(cls => {
          const reward = EXCAVATION_REWARDS.find(r => r.templateId === cls.id)!;
          return <article key={cls.id}><h3>{cls.name} · {cls.archetype}</h3><p>{cls.passive.name}: {cls.passive.desc}</p><p className="faint">Affinity: {cls.weapon}. Unlock via {reward.research} research and sector {reward.sector}.</p><Button disabled={blocked || !!run || !data.claimed.includes(reward.id) || me.hero.class.id === cls.id} onClick={() => adopt.mutate({ classId: cls.id })}>Adopt {cls.name}</Button></article>;
        })}</div>
        {data.originalClass && <Button disabled={blocked || !!run || me.hero.class.id === data.originalClass.id} onClick={() => adopt.mutate({ classId: 'original' })}>Restore original class & tier</Button>}
      </Panel>
      <Panel title="Realm update · Imperial Frontier">
        <p>Level cap 400 · Eight frontier regions · Forty-five field equipment templates · Three earned mythic commissions · Four research-unlocked disciplines · Ten tactical excavation sectors.</p>
        <p className="faint">Your accounts, original classes, owned items and existing Tower chapters remain intact. - By Hermes</p>
      </Panel>
      <p className="faint"><Link to="/guide">Open the Guide Book</Link> · All costs are in-game coins. No real-money purchases.</p>
    </div>
  </>;
}
