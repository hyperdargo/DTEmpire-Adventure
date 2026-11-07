import { CAMP_MAX_RANK, CAMP_UPGRADES, IMPERIAL_EXPEDITIONS, campCost, type CampUpgrade, type ExpeditionState } from '../../shared/data/expeditions.ts';
import { randomId } from '../lib/crypto.ts';
import { GameError } from '../lib/errors.ts';
import { createRng, freshSeed } from '../../shared/rules/rng.ts';
import { assertCanStartBattle } from './battles.ts';
import type { GameCtx } from './context.ts';
import { grantXp, requireLevel, spendCoins, type Player } from './player.ts';
import { logEvent } from './logbook.ts';

function state(p: Player): ExpeditionState {
  return p.state.imperialExpeditions ??= { version: 0, intel: 0, seals: [], ranks: { stores: 0, bulwark: 0, cartography: 0 }, completed: 0, run: null, lastReport: null };
}
function guard(g: GameCtx, p: Player, version: number) {
  requireLevel(p, IMPERIAL_EXPEDITIONS[0]!.level, 'Imperial Expeditions');
  assertCanStartBattle(g, p, { ignoreHp: true, expedition: true });
  const s = state(p);
  if (version !== s.version) throw new GameError('Orders are stale. Refresh the expedition ledger.', { code: 'stale_expedition', status: 409 });
  return s;
}
export function expeditionsView(g: GameCtx, p: Player) {
  const s = state(p);
  const def = IMPERIAL_EXPEDITIONS.find(x => x.id === s.run?.expeditionId);
  return { ...s, unlocked: p.level >= IMPERIAL_EXPEDITIONS[0]!.level, minLevel: IMPERIAL_EXPEDITIONS[0]!.level,
    routes: IMPERIAL_EXPEDITIONS.map(x => ({ id: x.id, name: x.name, level: x.level, fee: x.fee, encounters: x.encounters.length, unlocked: p.level >= x.level, sealed: s.seals.includes(x.id) })),
    encounter: s.run && def ? def.encounters[s.run.step] ? { ...def.encounters[s.run.step]!, choices: def.encounters[s.run.step]!.choices.map(c => ({ ...c, risk: Math.max(0, c.risk - s.ranks.cartography * 5), damage: Math.max(0, c.damage - s.ranks.bulwark * 2) })) } : null : null,
    upgrades: CAMP_UPGRADES.map(id => ({ id, rank: s.ranks[id], maxRank: CAMP_MAX_RANK, cost: campCost(s.ranks[id]) })),
  };
}
export function startExpedition(g: GameCtx, p: Player, routeId: string, version: number) {
  const s = guard(g, p, version);
  const def = IMPERIAL_EXPEDITIONS.find(x => x.id === routeId);
  if (!def) throw new GameError('Unknown expedition.');
  if (s.run) throw new GameError('Return or abandon your active expedition first.');
  requireLevel(p, def.level, def.name);
  if ((p.state as { abyssRun?: unknown }).abyssRun) throw new GameError('Leave the Abyss first.');
  if (p.state.excavation?.run) throw new GameError('Return from excavation first.');
  spendCoins(p, def.fee, 'expedition provisions');
  s.run = { id: randomId(), expeditionId: def.id, step: 0, supplies: 10 + s.ranks.stores * 2, integrity: 100 + s.ranks.bulwark * 10, maxIntegrity: 100 + s.ranks.bulwark * 10, cargo: 0, log: [`Departed for ${def.name}. Provisions paid; no coin rewards.`] };
  s.version++;
  return expeditionsView(g, p);
}
export function orderExpedition(g: GameCtx, p: Player, order: { version: number; runId: string; step: number; action: 'choose' | 'return' | 'abandon'; choiceId?: string }) {
  const s = guard(g, p, order.version); const r = s.run;
  if (!r || r.id !== order.runId || r.step !== order.step) throw new GameError('This expedition order is no longer current.', { code: 'stale_expedition', status: 409 });
  const def = IMPERIAL_EXPEDITIONS.find(x => x.id === r.expeditionId)!;
  if (order.action === 'abandon') {
    s.lastReport = `Abandoned ${def.name}. All unbanked intelligence lost; no seal or XP.`; s.run = null;
  } else if (order.action === 'return') {
    const complete = r.step === def.encounters.length;
    const first = complete && !s.seals.includes(def.id);
    const earned = r.cargo + (first ? 25 : 0);
    s.intel += earned;
    if (complete) { s.completed++; if (first) s.seals.push(def.id); }
    const xp = r.cargo * def.level * 5;
    grantXp(g, p, xp);
    s.lastReport = `Returned from ${def.name}: ${earned} intelligence, ${xp} XP. ${first ? 'First-clear seal secured (+25 intelligence).' : complete ? 'Repeat clear; seal already owned.' : 'Early return; no seal.'}`;
    logEvent(g, p.userId, 'milestone', s.lastReport, '🧭');
    s.run = null;
  } else {
    const encounter = def.encounters[r.step];
    const choice = encounter?.choices.find(x => x.id === order.choiceId);
    if (!choice) throw new GameError('Choose a valid option at the current encounter.');
    if (r.supplies < choice.supplies) throw new GameError('Not enough supplies. Return to bank your cargo or abandon.');
    const risk = Math.max(0, choice.risk - s.ranks.cartography * 5);
    const failed = risk > 0 && createRng(freshSeed()).next() * 100 < risk;
    const damage = failed || choice.risk === 0 ? Math.max(0, choice.damage - s.ranks.bulwark * 2) : 0;
    r.supplies -= choice.supplies; r.integrity = Math.max(0, r.integrity - damage);
    const earned = failed ? Math.floor(choice.intel / 3) : choice.intel;
    r.cargo += earned; r.step++;
    r.log.push(`${encounter!.title}: ${choice.label}. ${failed ? 'Hazard struck. ' : ''}+${earned} intelligence; −${choice.supplies} supplies; −${damage} integrity.`);
    if (r.integrity === 0) {
      s.lastReport = `Rescued from ${def.name}. Expedition lost: no intelligence, XP or seal. Your hero and camp are safe.`;
      s.run = null;
    }
  }
  s.version++;
  return expeditionsView(g, p);
}
export function upgradeCamp(g: GameCtx, p: Player, upgrade: CampUpgrade, version: number) {
  const s = guard(g, p, version);
  if (s.run) throw new GameError('Return before upgrading camp.');
  if (!CAMP_UPGRADES.includes(upgrade)) throw new GameError('Unknown camp upgrade.');
  const rank = s.ranks[upgrade];
  if (rank >= CAMP_MAX_RANK) throw new GameError('Camp upgrade is already at maximum rank.');
  const cost = campCost(rank);
  if (s.intel < cost.intel) throw new GameError('Not enough intelligence.');
  spendCoins(p, cost.coins, 'camp upgrade'); s.intel -= cost.intel; s.ranks[upgrade]++; s.version++;
  return expeditionsView(g, p);
}
