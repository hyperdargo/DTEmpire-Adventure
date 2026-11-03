import { EQUIPMENT, EXCAVATION_LEVEL, EXCAVATION_REWARDS, SECTORS, equipmentCost, type ExcavationAction, type ExcavationEquipment, type ExcavationState } from '../../shared/data/excavation.ts';
import { CLASS_BY_ID } from '../../shared/data/classes.ts';
import { GEAR_BY_ID } from '../../shared/data/items.ts';
import { rollGear } from '../../shared/rules/items.ts';
import { createRng, freshSeed } from '../../shared/rules/rng.ts';
import { GameError } from '../lib/errors.ts';
import type { GameCtx } from './context.ts';
import { assertCanStartBattle } from './battles.ts';
import { bagCapacity, bagUsed } from './inventory.ts';
import { logEvent } from './logbook.ts';
import { addGear, grantXp, heroStats, requireLevel, spendCoins, type Player } from './player.ts';

function state(p: Player): ExcavationState {
  return p.state.excavation ??= { ranks: { drill: 0, hull: 0, survey: 0 }, research: 0, bestSector: 0, completed: 0, claimed: [], run: null };
}
function available(g: GameCtx, p: Player) { requireLevel(p, EXCAVATION_LEVEL, 'Imperial Excavation'); assertCanStartBattle(g, p, { ignoreHp: true }); }
export function excavationView(g: GameCtx, p: Player) {
  const s = state(p);
  return { ...s, unlocked: p.level >= EXCAVATION_LEVEL, minLevel: EXCAVATION_LEVEL,
    sectors: SECTORS.map(x => ({ ...x, unlocked: p.level >= x.level && x.id <= s.bestSector + 1 })),
    equipment: EQUIPMENT.map(id => ({ id, rank: s.ranks[id], maxRank: 10, cost: equipmentCost(s.ranks[id]) })),
    rewards: EXCAVATION_REWARDS.map(x => ({ ...x, claimed: s.claimed.includes(x.id), unlocked: s.bestSector >= x.sector && p.level >= x.level })),
  };
}
export function startExcavation(g: GameCtx, p: Player, sector: number) {
  available(g, p); const s = state(p);
  const def = SECTORS.find(x => x.id === sector);
  if (!Number.isSafeInteger(sector) || !def) throw new GameError('Unknown sector.');
  if (s.run) throw new GameError('Return from your current contract first.');
  if (p.level < def.level || sector > s.bestSector + 1) throw new GameError('Clear the previous sector and meet the level requirement.');
  spendCoins(p, def.fee, 'excavation supplies');
  s.run = { sector, supplies: 8, integrity: 100 + s.ranks.hull * 8, cargo: 0, depth: 0, surveyed: false, braced: false, log: ['Contract funded. Survey to reduce the next extraction hazard; brace to halve it.'] };
  return excavationView(g, p);
}
export function workExcavation(g: GameCtx, p: Player, action: ExcavationAction) {
  available(g, p); const s = state(p); const r = s.run;
  if (!r) throw new GameError('No active excavation contract.');
  if (!['survey', 'brace', 'extract', 'return'].includes(action)) throw new GameError('Unknown work order.');
  const def = SECTORS[r.sector - 1]!;
  if (action === 'return') {
    const earned = r.cargo;
    s.research += earned; s.completed++;
    if (r.depth >= 3) s.bestSector = Math.max(s.bestSector, r.sector);
    grantXp(g, p, earned * (100 + r.sector * 80));
    s.run = null;
    logEvent(g, p.userId, 'milestone', `Excavation: recovered ${earned} research from ${def.name}.`, '⛏️');
    return excavationView(g, p);
  }
  if (r.supplies <= 0) throw new GameError('Supplies exhausted. Return to bank your cargo.');
  if (action === 'survey' && r.surveyed) throw new GameError('The next seam is already surveyed.');
  if (action === 'brace' && r.braced) throw new GameError('The hull is already braced.');
  r.supplies--;
  if (action === 'survey') { r.surveyed = true; r.log.push('Survey mapped a safe seam. Next extraction hazard reduced.'); }
  if (action === 'brace') { r.braced = true; r.log.push('Supports reinforced. Next extraction damage halved.'); }
  if (action === 'extract') {
    let damage = Math.max(4, def.hazard + r.depth * 5 - s.ranks.hull * 2 - (r.surveyed ? 8 + s.ranks.survey * 2 : 0));
    if (r.braced) damage = Math.ceil(damage / 2);
    r.integrity -= damage;
    r.depth++;
    r.cargo += def.research + s.ranks.drill * 2 + (r.surveyed ? s.ranks.survey : 0);
    r.surveyed = false; r.braced = false;
    r.log.push(`Seam ${r.depth}: recovered research; hull took ${damage} damage.`);
    if (r.integrity <= 0) {
      s.research += Math.floor(r.cargo / 4); s.run = null;
      p.notices.push({ kind: 'toast', tone: 'warn', text: 'Hull collapsed. Rescue saved 25% of research; no sector clear or XP.' });
    }
  }
  return excavationView(g, p);
}
export function upgradeExcavation(g: GameCtx, p: Player, equipment: ExcavationEquipment) {
  available(g, p); const s = state(p);
  if (s.run) throw new GameError('Return before refitting equipment.');
  if (!EQUIPMENT.includes(equipment)) throw new GameError('Unknown equipment.');
  const rank = s.ranks[equipment]; if (rank >= 10) throw new GameError('Equipment is at maximum rank.');
  const cost = equipmentCost(rank);
  if (s.research < cost.research) throw new GameError('Not enough research.');
  spendCoins(p, cost.coins, 'permanent excavation equipment'); s.research -= cost.research; s.ranks[equipment]++;
  return excavationView(g, p);
}
export function redeemExcavation(g: GameCtx, p: Player, rewardId: string) {
  available(g, p); const s = state(p); const reward = EXCAVATION_REWARDS.find(x => x.id === rewardId);
  if (s.run) throw new GameError('Return before redeeming rewards.');
  if (!reward || s.claimed.includes(rewardId)) throw new GameError('Reward unavailable or already claimed.');
  if (s.bestSector < reward.sector || p.level < reward.level || s.research < reward.research) throw new GameError('Meet the sector, level and research requirements first.');
  if (reward.kind === 'gear' && bagUsed(g, p.userId) >= bagCapacity(p)) throw new GameError('Make room in your bag first.');
  spendCoins(p, reward.coins, reward.name); s.research -= reward.research; s.claimed.push(reward.id);
  if (reward.kind === 'gear') {
    const rolled = rollGear(createRng(freshSeed()), GEAR_BY_ID[reward.templateId]!, reward.level, 'mythic');
    addGear(g, p.userId, { kind: 'gear', templateId: reward.templateId, ...rolled, base: rolled.base as Record<string, number> });
  }
  logEvent(g, p.userId, 'milestone', `Excavation reward unlocked: ${reward.name}`, '⛏️');
  return excavationView(g, p);
}
export function adoptExcavationClass(g: GameCtx, p: Player, classId: string) {
  available(g, p); const s = state(p);
  if (s.run) throw new GameError('Return before changing role.');
  const reward = EXCAVATION_REWARDS.find(x => x.kind === 'class' && x.templateId === classId);
  const restore = classId === 'original';
  if ((!restore && (!reward || !s.claimed.includes(reward.id))) || (restore && !s.originalClass)) throw new GameError('Unlock this discipline first.');
  if (!s.originalClass) s.originalClass = { id: p.classId, rarity: p.classRarity };
  const previousMax = heroStats(g, p).maxHp; const ratio = Math.min(1, p.hp / previousMax);
  p.classId = restore ? s.originalClass.id : classId;
  p.classRarity = restore ? s.originalClass.rarity : CLASS_BY_ID[classId]!.rarity;
  p.hp = Math.max(1, Math.floor(heroStats(g, p).maxHp * ratio));
  return excavationView(g, p);
}
