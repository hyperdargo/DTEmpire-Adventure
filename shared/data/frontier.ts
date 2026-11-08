import type { ClassDef, GearTemplate } from './types.ts';
import type { Region } from './regions.ts';

/** Append-only level bands: existing region IDs and gates remain unchanged. */
export const FRONTIER_REGIONS: Region[] = [
  ['imperial_marches', 'Imperial Marches', 200, 224, 'March Warden', 'Ironbound Regent'],
  ['glass_desert', 'Glass Desert', 225, 249, 'Shard Strider', 'The Glass Colossus'],
  ['sunken_dynasty', 'Sunken Dynasty', 250, 274, 'Drowned Archivist', 'Queen of the Deep Archive'],
  ['pale_meridian', 'Pale Meridian', 275, 299, 'Meridian Watcher', 'The Silent Cartographer'],
  ['ashen_throne', 'Ashen Throne', 300, 324, 'Ashbound Knight', 'Emperor of Cinders'],
  ['clockwork_heavens', 'Clockwork Heavens', 325, 349, 'Epoch Mechanist', 'The Unwound Oracle'],
  ['first_empire', 'First Empire', 350, 374, 'Origin Sentinel', 'The First Sovereign'],
  ['last_horizon', 'Last Horizon', 375, 400, 'Horizon Reaver', 'The Unwritten King'],
  ['shattered_veil', 'The Shattered Veil', 400, 424, 'Veil Sentinel', 'The Torn Architect'],
  ['celestial_forge', 'Celestial Forge', 425, 449, 'Forge Keeper', 'Ignis, The Star Hammer'],
  ['eternal_tundra', 'Eternal Tundra', 450, 474, 'Frost Revenant', 'The Permafrost Titan'],
  ['void_cradle', 'Void Cradle', 475, 499, 'Void Wraith', 'Nihilus, The Unborn'],
  ['dream_nexus', 'Dream Nexus', 500, 524, 'Oneiric Guardian', 'Morpheus, The Dreamer King'],
  ['primeval_core', 'Primeval Core', 525, 549, 'Core Warden', 'The Heartstone Colossus'],
  ['aetheric_spire', 'Aetheric Spire', 550, 574, 'Aether Knight', 'Solara, The Radiant Sovereign'],
  ['genesis_throne', 'Genesis Throne', 575, 600, 'Genesis Herald', 'Arkanos, The First and Last'],
].map(([id, name, min, max, foe, boss]) => ({
  id: String(id), name: String(name), minLevel: Number(min), maxLevel: Number(max), icon: '⚑',
  description: `Beyond the old creation gate. Defeat ten guardians to challenge ${boss}.`, bossUnlockKills: 10,
  monsters: [
    { id: `${id}_warden`, name: String(foe), icon: '♜', shape: { hp: 1.3, atk: 0.85, def: 1.2 } },
    { id: `${id}_reaver`, name: `${name} Reaver`, icon: '⚔', shape: { hp: 0.85, atk: 1.3, def: 0.8 } },
    { id: `${id}_seer`, name: `${name} Seer`, icon: '◈', shape: { hp: 1, atk: 1.1, def: 0.9 } },
  ],
  boss: { id: `${id}_sovereign`, name: String(boss), icon: '♛', shape: { hp: 1.1, atk: 1.05, def: 1 } },
}));

export const FRONTIER_GEAR: GearTemplate[] = [200, 250, 300, 350, 400, 450, 500, 550, 600].flatMap(level => [
  ...(['sword', 'staff', 'bow', 'dagger', 'hammer'] as const).map(weaponType => ({
    id: `frontier_${weaponType}_${level}`, name: `${level >= 550 ? 'Genesis' : level >= 400 ? 'Elysian' : level >= 300 ? 'Sovereign' : 'Marchwarden'} ${weaponType}`,
    icon: '⚔', slot: 'weapon' as const, weaponType, levelReq: level,
    desc: `${weaponType === 'hammer' ? 'Siege breaker' : weaponType === 'staff' ? 'Arcane conductor' : weaponType === 'bow' ? 'Long-range hunter' : weaponType === 'dagger' ? 'Close-range skirmisher' : 'Vanguard blade'} forged for the imperial frontier. Match your class affinity for its combat bonus.`,
  })),
  { id: `frontier_plate_${level}`, name: `Bastion Plate ${level}`, icon: '♜', slot: 'armor' as const, levelReq: level, desc: 'Defense-weighted plate: trades vitality for mitigation.', focus: { def: 3, hp: 1 } },
  { id: `frontier_helm_${level}`, name: `Pathfinder Helm ${level}`, icon: '♟', slot: 'helmet' as const, levelReq: level, desc: 'Vitality-weighted helm: survives burst damage.', focus: { hp: 3, def: 1 } },
  { id: `frontier_boots_${level}`, name: `Pursuit Greaves ${level}`, icon: '↟', slot: 'boots' as const, levelReq: level, desc: 'Speed-weighted greaves: sacrifices armor for initiative.', focus: { spd: 3, def: 1 } },
  { id: `frontier_seal_${level}`, name: `Duelist Seal ${level}`, icon: '◈', slot: 'accessory' as const, levelReq: level, desc: 'Attack-weighted seal: offense at the cost of defense and HP.', focus: { atk: 3, def: 1, hp: 1 } },
]);
FRONTIER_GEAR.push(
  { id: 'imperial_survey_seal', name: 'Surveyor’s Seal', icon: '◈', slot: 'accessory', levelReq: 80, desc: 'A research-earned luck talisman.', focus: { luck: 1 }, eventOnly: true },
  { id: 'imperial_origin_plate', name: 'Origin Bulwark', icon: '♜', slot: 'armor', levelReq: 350, desc: 'Excavated vitality plate: three parts HP, one part defense.', focus: { hp: 3, def: 1 }, eventOnly: true },
  { id: 'imperial_origin_crown', name: 'Crown of the First Empire', icon: '♛', slot: 'helmet', levelReq: 400, desc: 'Research-earned mythic crown, balanced for the final frontier.', eventOnly: true },
);

/** Research-unlocked disciplines are deliberately absent from random class rolls. */
export const FRONTIER_CLASSES: ClassDef[] = [
  { id: 'bastion_marshal', name: 'Bastion Marshal', icon: '♜', rarity: 'mythic', archetype: 'vanguard', weapon: 'hammer', base: { hp: 155, atk: 24, def: 20, spd: 7 }, passive: { name: 'Hold the Line', desc: 'Recover 3% max HP per turn; slow defensive sustain.', effect: { kind: 'regen', pctPerTurn: 3 } } },
  { id: 'imperial_runesmith', name: 'Imperial Runesmith', icon: '◈', rarity: 'mythic', archetype: 'arcanist', weapon: 'staff', base: { hp: 105, atk: 31, def: 12, spd: 9 }, passive: { name: 'Inscribed Salvo', desc: 'Skills deal 25% more damage; requires a strong skill loadout.', effect: { kind: 'skill_power', pct: 25 } } },
  { id: 'horizon_warden', name: 'Horizon Warden', icon: '⌖', rarity: 'mythic', archetype: 'marksman', weapon: 'bow', base: { hp: 115, atk: 28, def: 11, spd: 13 }, passive: { name: 'Colossus Hunter', desc: 'Deal 25% more damage to bosses; fragile outside your specialty.', effect: { kind: 'boss_damage', pct: 25 } } },
  { id: 'veil_reaver', name: 'Veil Reaver', icon: '⚔', rarity: 'mythic', archetype: 'rogue', weapon: 'dagger', base: { hp: 100, atk: 29, def: 10, spd: 15 }, passive: { name: 'Essence Harvest', desc: 'Heal for 8% of damage dealt; fast but vulnerable to burst.', effect: { kind: 'lifesteal', pct: 8 } } },
];
