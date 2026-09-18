# Game design and balance

Everything here lives in `shared/` and is covered by tests in `tests/rules.test.ts`. Numbers below are the
source of truth for tuning; change them there, then run `node scripts/balance-sim.ts`.

## The single power curve

The original game had no coherent curve: levels were uncapped, shop items reached +4,600 attack, and a
region's monsters had hand-written stats unrelated to the player. The rebuild derives everything from one
curve so a fight at level 3 and a fight at level 93 feel the same.

- **Levels**: 1–100. `xpToNext(L) = 40·L^1.75 + 60`.
- **Stat growth**: `1 + 0.12·(L-1)` on class base stats; speed grows flat (`+0.15/level`).
- **Gear budget** per slot at item level *i* (`shared/rules/progression.ts`): weapon `3 + 1.5i` attack,
  armor `2 + i` defense and `8 + 5i` HP, and so on, times a rarity multiplier
  (common 1 → mythic 2.5) and an upgrade multiplier (`1 + 0.06 · upgrade`, max +10).
- **Damage**: `atk² / (atk + def)`, varied ±8%, then criticals, guard and shields. Ratio-based, so there
  are never 1-damage walls and never one-shots.

### Monsters are tuned against a reference hero

`shared/rules/monsters.ts` builds a *reference hero* for any level: average class base stats, uncommon gear
in every slot, upgraded at the pace a normal player upgrades, plus the damage uplift their skills provide.
Monsters are then defined relative to that hero, not in absolute numbers:

| Tier | HP | Attack | Used by |
| --- | --- | --- | --- |
| normal | 4.6 hits to kill | 78–100% of reference (ramping to full by level 25) | Regions, low Dungeon floors |
| elite | ×1.6 | ×1.15 | Tower floors, 6% of wild encounters, every 5th Dungeon floor |
| boss | ×3.3 | ×1.3 | Region bosses, Tower chapter bosses, Dungeon every 10th floor |
| world | huge | ×1.5 | Weekly world boss (never killed in one sitting) |

Each of the 166 original creatures keeps its personality: its original HP/attack/defense ratios become a
*shape* multiplier (clamped to 0.7–1.4), so the Bone Colossus is still tanky and the Wraith still hits hard.

Measured behaviour (tests assert these):

| Level | Normal fight | Boss fight (3 potions) |
| --- | --- | --- |
| 1 | ~100% win, 4.8 turns | ~100% win, ~21 turns |
| 30 | ~100% win, 4.4 turns | ~100% win, ~17 turns |
| 100 | ~100% win, 3.7 turns | ~99% win, ~19 turns |

Normal fights cost roughly a quarter of your health, so about four fights between rests. Health refills
fully in 4 minutes out of combat, or instantly at the inn for coins.

## Combat

Turn-based, one round at a time, resolved server-side:

- **Actions**: attack, a slotted skill (3 slots, 4 from level 40), guard (−55% damage), potion, or flee.
- **Skills** are the original 14 names reworked from passive stat sticks into abilities with cooldowns,
  ranks 1–5 (+12% per rank), and effects: multi-hit, drain, burn, stun, shields, buffs.
- **Bosses telegraph**: every 4th turn a boss winds up instead of attacking; the next turn lands at 2.2×.
  Guarding it turns a disaster into a scratch. Below 30% health a boss enrages (+25% attack).
- **Speed** decides who swings first; **crit**, **dodge** and **lifesteal** come from gear affixes and class
  passives. Pets act every third turn (strike, mend or ward).
- Fights are capped at 40 turns (10 for world-boss strikes), which counts as a loss.

Every round is `resolveRound(state, actions)` — a pure function seeded by `(battle seed, turn)`. The same
inputs always produce the same round, which is what makes the balance simulation meaningful.

## Progression loops

- **Adventure**: pick a region (unlocked by level), draw an encounter. Ten kills lure the region boss.
- **Tower**: floor *N* requires level *N−5*. Every 5th floor is a chapter boss; beating it completes that
  story chapter, which pays coins, sometimes teaches the chapter's skill, and mails the rewards.
- **Dungeon** (level 5+): a run with a pouch. Coins, XP and materials accumulate unbanked; every third floor
  offers one of three boons; leaving banks everything. Dying keeps half the coins and XP and loses the
  materials. Health does not regenerate during a run. Checkpoints every 10 floors.
- **Expeditions**: send scouts for 30 min / 2 h / 8 h at ~35% of active efficiency, less if the region is far
  below your level. This is the "played on a phone, twice a day" path.
- **World boss**: one foe per ISO week with a health pool scaled to the active population. Three 10-turn
  strikes per day; damage is normalized by level so a level-20 hero's effort counts. Rewards are mailed by
  contribution rank when it dies (or in reduced form if it survives the week).
- **Arena**: an AI gauntlet (first win pays ×5), ranked matches against snapshots of real players' heroes
  (ELO, K=32, defender loses half the delta), and live duels over WebSocket with a 20-second turn timer.

## Seasonal events

`shared/data/events.ts` defines time-limited festivals; the Harvest Moon Festival (16 Sep – 16 Oct) carries
over from the original game. While one is running, the Festival page opens: its own monsters (tiered on the
same curve, so the hunt is worth it at any level from 5 up), its own currency (Moon Tokens), a stall selling
gear forged to *your* level plus consumables and an exclusive title, and a standings board ranked by tokens
earned. Festival items are flagged `eventOnly`, so they never appear in drops or the market — the only way to
own a Moonlight Blade is to have been there. Adding a new festival is a single entry in that file.

## Economy

- **Coins** come from fights, quests, jobs, selling and the auction house. Sinks: the market, the blacksmith
  (upgrades scale with item level and rarity), the temple, the inn, class rerolls, guild founding, the
  auction's 1% deposit and 5% fee, and the Lucky Roll.
- **Lucky Roll** returns ~92% of stake on average (asserted by a test) and is capped at 40 spins a day, so it
  is a coin sink with a thrill, never an income source.
- **Drops**: gear drops on 11% of normal kills, 30% from elites, always from bosses. Rarity odds
  common 55 → mythic 0.2%, shifted by luck and boss status. Bags hold 80 slots (+4 every 5 levels);
  overflow is auto-sold rather than lost, and commons can auto-salvage into materials.
- **Trading** escrows the offered items and coins until the trade resolves, expires (24 h) or is cancelled;
  refunds of escrowed coins go by mail so they can never be lost to a concurrent save.

## Daily rhythm

Daily reward with a streak (×1.25 at 3 days up to ×2 at 30, 48-hour grace, a chest every 7th day),
three hunt contracts drawn from your unlocked regions, three missions, an 8-hour job shift, temple
blessings and offerings, and guild tasks. All reset at 00:00 UTC.

## What changed from the original, and why

| Original | Now | Why |
| --- | --- | --- |
| Tower floors resolved by a win-chance dice roll | Real battles with telegraphs | The Tower was the main mode and had no gameplay |
| Skills were passive stat bonuses bought with coins | Active abilities with cooldowns and ranks | Gives combat decisions |
| Uncapped levels, shop items to +4,600 attack | Level cap 100 on one curve | Old content became meaningless within days |
| "Auto Boss Grind" that needed a tab open | Server-side expeditions | Idle progress shouldn't require a spinning laptop |
| Dungeon was a linear floor counter | Roguelite runs with boons and banking | Creates a real risk/reward decision |
| Items with three different shapes across the codebase | One item model (template + rarity + item level + upgrade + affixes) | Half the original bug reports were item-shape bugs |
| PvP was an asynchronous duel queue | Ranked snapshots + live duels | Instant matches at any hour, plus real-time when friends are on |
