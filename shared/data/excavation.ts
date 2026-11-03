import type { Rarity } from "./types.ts";

export const EXCAVATION_LEVEL = 30;
export const EQUIPMENT = ['drill', 'hull', 'survey'] as const;
export type ExcavationEquipment = typeof EQUIPMENT[number];
export type ExcavationAction = 'survey' | 'brace' | 'extract' | 'return';
export interface ExcavationRun { sector: number; supplies: number; integrity: number; cargo: number; depth: number; surveyed: boolean; braced: boolean; log: string[] }
export interface ExcavationState { ranks: Record<ExcavationEquipment, number>; research: number; bestSector: number; completed: number; claimed: string[]; run: ExcavationRun | null; originalClass?: { id: string; rarity: Rarity } }
export const SECTORS = [
  'Buried Aqueduct', 'Iron Ossuary', 'Silent Archive', 'Obsidian Engine', 'Sunken Observatory',
  'Crown Vault', 'Pale Meridian', 'Ashen Throne', 'Epoch Reliquary', 'Imperial Origin',
].map((name, i) => ({ id: i + 1, name, level: i === 0 ? 30 : 70 + i * 35, fee: 12000 * (i + 1) ** 2, research: 8 + i * 4, hazard: 14 + i * 4 }));
export const equipmentCost = (rank: number) => ({ coins: 50000 * (rank + 1) ** 2, research: 12 * (rank + 1) });
export const EXCAVATION_REWARDS = [
  { id: 'surveyor_seal', name: 'Surveyor’s Seal', sector: 1, research: 35, coins: 75000, kind: 'gear', templateId: 'imperial_survey_seal', level: 80 },
  { id: 'bastion', name: 'Bastion Marshal · defensive sustain', sector: 4, research: 180, coins: 600000, kind: 'class', templateId: 'bastion_marshal', level: 175 },
  { id: 'runesmith', name: 'Imperial Runesmith · skill artillery', sector: 5, research: 220, coins: 750000, kind: 'class', templateId: 'imperial_runesmith', level: 210 },
  { id: 'deadeye', name: 'Horizon Warden · boss hunter', sector: 6, research: 260, coins: 900000, kind: 'class', templateId: 'horizon_warden', level: 245 },
  { id: 'veil', name: 'Veil Reaver · drain skirmisher', sector: 7, research: 300, coins: 1000000, kind: 'class', templateId: 'veil_reaver', level: 280 },
  { id: 'origin_plate', name: 'Origin Bulwark · HP-focused plate', sector: 9, research: 400, coins: 1500000, kind: 'gear', templateId: 'imperial_origin_plate', level: 350 },
  { id: 'origin_crown', name: 'Crown of the First Empire', sector: 10, research: 500, coins: 2000000, kind: 'gear', templateId: 'imperial_origin_crown', level: 400 },
] as const;
