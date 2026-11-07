import { MAX_LEVEL } from '../rules/progression.ts';

export const CAMP_UPGRADES = ['stores', 'bulwark', 'cartography'] as const;
export type CampUpgrade = typeof CAMP_UPGRADES[number];
export const CAMP_MAX_RANK = 5;
export function campCost(rank: number) { return { intel: 20 * (rank + 1), coins: 1000 * (rank + 1) ** 2 }; }
export interface ExpeditionChoice { id: string; label: string; supplies: number; risk: number; damage: number; intel: number }
export interface ExpeditionEncounter { title: string; text: string; choices: ExpeditionChoice[] }
export interface ImperialExpedition { id: string; name: string; level: number; fee: number; encounters: ExpeditionEncounter[] }
export interface ExpeditionRun { id: string; expeditionId: string; step: number; supplies: number; integrity: number; maxIntegrity: number; cargo: number; log: string[] }
export interface ExpeditionState { version: number; intel: number; seals: string[]; ranks: Record<CampUpgrade, number>; completed: number; run: ExpeditionRun | null; lastReport: string | null }

// Every route is authored; shared choice rules keep risk and supply costs legible.
// Gates cover the live realm cap without changing any existing region IDs.
const routes: { id: string; name: string; scenes: [string, string, string, string][] }[] = [
  { id: 'reedwatch', name: 'Reedwatch Dispatch', scenes: [
    ['Flooded Causeway', 'The dispatch road has vanished beneath the reeds.', 'Hire a punt', 'Wade beneath the markers'],
    ['Silent Bell', 'A watchtower bell swings without a sentry.', 'Rig a climbing line', 'Climb the broken stones'],
    ['Hungry Patrol', 'Stranded soldiers offer a map in exchange for rations.', 'Share the reserve', 'Search their abandoned trail'],
    ['Wax in the Water', 'The governor’s sealed orders drift toward a sluice.', 'Anchor a rescue rope', 'Dive for the orders'],
  ] },
  { id: 'saltroad', name: 'Saltroad Caravan', scenes: [
    ['Whiteout Mile', 'Salt dust erases the caravan tracks.', 'Plant guide stakes', 'Follow the distant wheels'],
    ['Broken Axle', 'The archive wagon leans over a sinkhole.', 'Build a timber cradle', 'Pull the ledger free'],
    ['Toll of Glass', 'Desert wardens demand water for passage.', 'Pay in water', 'Cross the razor dunes'],
    ['Buried Standard', 'An imperial banner marks a half-buried strongbox.', 'Excavate with supports', 'Lever the chest out'],
    ['Last Cistern', 'A dry cistern hides the caravan’s missing route book.', 'Lower a safety harness', 'Descend the cracked steps'],
  ] },
  { id: 'ashabbey', name: 'Ash Abbey Vigil', scenes: [
    ['Ember Gate', 'An ashfall rolls across the abbey entrance.', 'Soak protective cloaks', 'Run between the embers'],
    ['Choir of Dust', 'Hollow voices echo behind a collapsed screen.', 'Brace the stone arch', 'Crawl under the screen'],
    ['Cinder Garden', 'Medicinal seeds still glow beneath black soil.', 'Use insulated jars', 'Gather seeds by hand'],
    ['Unburnt Chronicle', 'The last chronicle rests in a smouldering reliquary.', 'Cool the hinges', 'Force the bronze doors'],
  ] },
  { id: 'ironpass', name: 'Ironpass Survey', scenes: [
    ['Chain Bridge', 'Only two chains remain over the gorge.', 'Weave a safety net', 'Balance across the links'],
    ['Signal Smoke', 'A beacon burns with the wrong imperial signal.', 'Prepare a covered approach', 'Rush the beacon'],
    ['Sleeping Engine', 'A siege engine pins a courier beneath its frame.', 'Jack up the chassis', 'Drag the courier clear'],
    ['Magnet Ridge', 'Iron filings spiral around an exposed survey stone.', 'Shield the instruments', 'Read the stone directly'],
    ['Summit Register', 'The pass register hangs over a wind-scoured ledge.', 'Drive climbing pitons', 'Leap to the ledge'],
  ] },
  { id: 'drownedcourt', name: 'Drowned Court', scenes: [
    ['Tidal Stair', 'The audience stair disappears with every wave.', 'Fix a tidal rope', 'Race the retreating sea'],
    ['Pearl Witness', 'A diver knows which courtroom held the treaty.', 'Trade breathing supplies', 'Search the flooded cells'],
    ['Mirror Hall', 'Silver mirrors conceal a dangerous undertow.', 'Mark each safe doorway', 'Swim through the reflections'],
    ['Royal Deposition', 'A waterlogged testimony is sealed inside a bell.', 'Pump the bell chamber', 'Break the bell underwater'],
  ] },
  { id: 'thornmarch', name: 'Thornmarch Accord', scenes: [
    ['Briar Border', 'Living thorns tighten around the border post.', 'Lay a canvas tunnel', 'Cut through the briars'],
    ['Green Tribunal', 'Forest envoys request food before sharing their testimony.', 'Offer trail rations', 'Track the missing witness'],
    ['Spore Lanterns', 'Pale spores light the old military road.', 'Fit filter masks', 'Navigate by the lanterns'],
    ['Root Prison', 'Roots hold the stolen boundary stones.', 'Dampen the root knots', 'Pry out the markers'],
    ['Accord Oak', 'The treaty tablet lies inside a hollow ancient oak.', 'Brace the hollow trunk', 'Enter the shifting roots'],
  ] },
  { id: 'frostsignal', name: 'Frostsignal Rescue', scenes: [
    ['Blue Crevasse', 'A rescue flare glows beneath transparent ice.', 'Build a rope ladder', 'Slide to the flare'],
    ['Frozen Rations', 'The lost patrol’s provisions are locked in ice.', 'Fuel a thawing fire', 'Chip through the cache'],
    ['Avalanche Wire', 'A telegraph wire hums beneath unstable snow.', 'Place snow anchors', 'Follow the buried wire'],
    ['Final Transmission', 'The signal station is tipping into a glacier.', 'Tether the transmitter', 'Seize the message cylinder'],
  ] },
  { id: 'eclipseport', name: 'Eclipseport Inquiry', scenes: [
    ['Unlit Harbour', 'Every lighthouse went dark at the same hour.', 'Light reserve lanterns', 'Sail by the black silhouettes'],
    ['Smuggler’s Ledger', 'A dock broker offers a manifest for medicine.', 'Trade medical supplies', 'Raid the hidden warehouse'],
    ['Clockwork Customs', 'An automated customs gate still demands papers.', 'Repair the document feeder', 'Slip between its gears'],
    ['Moonless Hold', 'Evidence rattles inside a ship’s sealed hold.', 'Ventilate the hold', 'Enter through a gunport'],
    ['Departure Bell', 'A fleeing ship carries the final witness.', 'Launch a supplied cutter', 'Board from the harbour chain'],
  ] },
  { id: 'starfall', name: 'Starfall Observatory', scenes: [
    ['Fallen Lens', 'A shattered telescope lens bends the path ahead.', 'Cover the mirrored shards', 'Walk the refracted path'],
    ['Gravity Well', 'Research notes orbit a collapsed laboratory.', 'Anchor retrieval lines', 'Catch the orbiting notes'],
    ['Astral Orchard', 'Silver fruit stores the astronomers’ last memories.', 'Prepare sealed containers', 'Harvest the humming fruit'],
    ['Meridian Engine', 'The observatory records the next impossible dawn.', 'Stabilise the engine', 'Read the unstable meridian'],
  ] },
  { id: 'voidbastion', name: 'Void Bastion Breach', scenes: [
    ['Absent Wall', 'A fortress wall exists only when watched.', 'Set mirrored sentries', 'Cross between blinks'],
    ['Hollow Barracks', 'Empty armour repeats the garrison’s last drill.', 'Muffle the marching floor', 'March among the armour'],
    ['Severed Supply', 'A supply bridge ends in empty sky.', 'Build a tether crossing', 'Jump the missing span'],
    ['Black Dispatch', 'The command seal floats inside a silent storm.', 'Ground the archive cage', 'Reach into the storm'],
    ['Watch at Nothing', 'The last sentry guards a door without a room.', 'Chart the door’s cycle', 'Step through the threshold'],
  ] },
  { id: 'crownless', name: 'Crownless Dominion', scenes: [
    ['Unclaimed Road', 'Three rival standards mark the same border.', 'Provision neutral guides', 'Cross under no banner'],
    ['Empty Throne', 'Petitions surround a throne nobody may touch.', 'Construct a lifting frame', 'Recover the petitions directly'],
    ['Oath Market', 'A witness sells the names of forgotten rulers.', 'Trade camp reserves', 'Recover the names from the vault'],
    ['Crown of Testimony', 'A crown holds the dominion’s erased history.', 'Shield the memory chamber', 'Wear the crown briefly'],
  ] },
  { id: 'lastmeridian', name: 'The Last Meridian', scenes: [
    ['Edge of the Map', 'The imperial map continues beyond the horizon.', 'Lay survey anchors', 'Follow the unwritten road'],
    ['Tomorrow’s Camp', 'An abandoned camp bears your own future seal.', 'Catalogue the supplies', 'Search the future tents'],
    ['River of Names', 'Every lost expedition speaks from the river.', 'Build a listening raft', 'Enter the speaking current'],
    ['Origin Compass', 'The first compass points toward its own maker.', 'Calibrate a shielded case', 'Turn the origin needle'],
    ['Last Imperial Mile', 'The final milestone waits beyond a fracture in the sky.', 'Bridge the fracture', 'Cross the open firmament'],
    ['Return Address', 'An unopened letter promises a road home.', 'Stabilise the return beacon', 'Carry the letter through the rift'],
  ] },
];

export const IMPERIAL_EXPEDITIONS: ImperialExpedition[] = routes.map((r, i) => ({
  id: r.id, name: r.name, level: Math.round(10 + (MAX_LEVEL - 10) * i / 11), fee: 250 * (i + 1) ** 2,
  encounters: r.scenes.map(([title, text, careful, bold]) => ({ title, text, choices: [
    { id: 'careful', label: careful, supplies: 2, risk: 0, damage: 0, intel: 5 + i * 2 },
    { id: 'bold', label: bold, supplies: 1, risk: 45, damage: 30 + i * 2, intel: 10 + i * 3 },
    { id: 'bypass', label: 'Mark the danger and take the outer trail', supplies: 1, risk: 0, damage: 5, intel: 2 + i },
  ] })),
}));
