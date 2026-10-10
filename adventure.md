# DTEmpire Adventure — State & Progress

## Quick Links
- **Web:** `http://localhost:8081` → `adventure.ankitgupta.com.np`
- **Docker:** `dtempire-adventure` on port 8081
- **Working Dir:** `/home/dargo/DTEmpire-Adventure`
- **Stack:** Node.js 24 + TypeScript + React 19 PWA + SQLite (WAL)

---

## Session: `20261011` — Professions & Career Mastery + Guild Armory System (v5.10.0)

### Added & Expanded
- **Professions & Career Mastery System (`/jobs`)**:
  - Unlocks at Level 10 with progressive unlock levels up to Level 50.
  - 10 Artisan Professions:
    - **Farmer** (Lv 10): 2,500 coins, 6% XP
    - **Miner** (Lv 12): 3,200 coins, 7% XP
    - **Blacksmith** (Lv 32): 8,000 coins, 10% XP
    - **Alchemist** (Lv 22): 5,800 coins, 9% XP
    - **Cook** (Lv 15): 3,800 coins, 8% XP
    - **Fisher** (Lv 18): 4,500 coins, 8% XP
    - **Guard** (Lv 26): 6,500 coins, 9% XP
    - **Merchant** (Lv 36): 9,500 coins, 11% XP
    - **Knight** (Lv 42): 11,500 coins, 12% XP
    - **Wizard** (Lv 50): 14,000 coins, 14% XP
  - 5 Career Mastery Ranks:
    - **Apprentice** (0 shifts, +0% wage)
    - **Journeyman** (5 shifts, +15% wage)
    - **Artisan** (15 shifts, +30% wage)
    - **Master** (30 shifts, +50% wage)
    - **Grandmaster** (55 shifts, +75% wage)
  - Timed 8-hour shifts with real-time countdown timer, career progression tracking, and shift collection.
  - **Trade Commissions Dispatch Board**: 4-hour cooldown profession dispatches granting instant coins, XP, crafting trade materials (iron ore, dragon scales, star essence, etc.), eggs, and health restoration.
  - Full UI integration with Town shortcut and TopNav link (`/jobs`).
- **Guild Armory & Clan Quartermaster (`/guild` -> Armory tab)**:
  - Exclusive clan supply quartermaster requiring clan membership and tier unlocks (Clan Lv 1 to 10).
  - High-tier oathbound gear and guild battle consumables:
    - `guild_banner` (Clan Lv 1): 1,500 coins + 50 contribution.
    - `guild_feast` (Clan Lv 2): 3,000 coins + 100 contribution.
    - `guild_vanguard_helm` (Clan Lv 3): 12,000 coins + 300 contribution (+65 HP, +22 DEF).
    - `guild_bulwark_of_unity` (Clan Lv 4): 25,000 coins + 600 contribution (+140 HP, +48 DEF).
    - `guild_vanguard_blade` (Clan Lv 5): 40,000 coins + 1,000 contribution (+60 ATK, +15 Crit).
    - `guild_sovereign_crest` (Clan Lv 10): 150,000 coins + 3,500 contribution (+80 ATK, +80 DEF, +200 HP).
  - Kickback Mechanism: Every armory purchase reinvests +30% of contribution cost back into personal clan contribution.
  - Requisition counter tracked on hero profile (`guildArmoryPurchases`).
- **Adventurer's Codex Expansion (`/guide`)**:
  - Comprehensive reference guide covering all 10 Professions, unlock levels, shift wages, career ranks, trade commission dispatch rewards, and Guild Armory item specifications.
- **Theme & Strict Design Adherence**:
  - Pure monochrome black & dark palette (#0a0a0a, #141414, #262626) with crisp white text and dark borders. Zero neon gradients, purple, or pastel accents.
- Update log entries signed `- By Hermes`.

---

### Added & Expanded
- **Imperial Factions System (`/factions`)**:
  - Unlocks at Level 10. Heroes may swear fealty to 3 sovereign factions:
    - **The Iron Vanguard**: +10% Defense & +10% Max HP (escalates with rank). Favored by bastion tanks.
    - **The Shadow Syndicate**: +10% Crit Chance & +15% Battle Gold (escalates with rank). Favored by precision rogues.
    - **The Celestial Arcanum**: +10% Attack & +20% Battle XP (escalates with rank). Favored by fast-leveling mages.
  - 5-Tier Reputation Progression: Initiate (0 rep, 1.0x), Veteran (500 rep, 1.25x), Champion (2,500 rep, 1.5x), High Commander (10,000 rep, 1.75x), and Sovereign (30,000 rep, 2.0x).
  - Daily Tribute: pledge 5,000 coins for +300 Faction Rep and +500 XP once per UTC day.
  - Fealty Switching: transfer allegiance for 25,000 coins with complete lifetime reputation preserved per faction.
  - Prestige Insignia Titles: earn and equip `🛡️ Vanguard Ironclad`, `🗡️ Syndicate Shadowblade`, or `🔮 Arcanum Archmagus` at High Commander rank (10,000+ rep).
  - Navigation & Town integration: added Factions nav link with Level 10 gate and Town building shortcut.
  - Full theme adherence: strict black/white (#0a0a0a, #141414, #282828) aesthetics, dark grey borders, zero colorful slop.
- **Tower Floor-Band Scaled Loot & Spire Relics (`shared/rules/loot.ts`)**:
  - Dynamic material drops across 5 distinct spire floor bands:
    - Floors 1–20 (Novice): Iron Ore, Undead Bones, Silk Cloth, Mystery Eggs, Potions.
    - Floors 21–40 (Adept): Silk Cloth, Dragon Scales, Mystic Gems, Forest Eggs, Skill Books.
    - Floors 41–60 (Master): Dragon Scales, Mystic Gems, Star Essence, Dragon Eggs, Superior Potions.
    - Floors 61–80 (Grandmaster): Star Essence, Mystic Gems, Abyssal Shards, Golden & Void Eggs, Void Reforgers.
    - Floors 81–100+ (Ascendant Apex): Abyssal Shards, Star Essence, Celestial & Phoenix Eggs, Relic Reforgers.
  - Elemental Spire theme loot multipliers: Infernal Spire (+50% coins, Dragon Scales, Phoenix Eggs), Celestial Pillar (+40% XP, Star Essence, Celestial Eggs), Abyssal Obelisk (Abyss Shards, Void Eggs, Void Reforgers).
  - Guaranteed tier drops and bonus gold exploration caches every 5th floor.
- **Adventurer's Codex Expansion (`/guide`)**:
  - Added dedicated Factions & Spire Guide tab detailing lore, passive stat formulas, rank thresholds, and tower loot bands.
- **Achievements & Tracking**:
  - `faction_sworn` ("Allegiance Sworn", 2,500 coins) upon joining any faction.
  - `faction_champion` ("Faction Paragon", 15,000 coins) upon reaching 2,500 reputation.
- Update log entries signed `- By Hermes`.

---

## Session: `20261007` — Endless Abyss Mode, Void Relics & Reforging System

### Added & Expanded
- **Endless Abyss Mode (`/abyss`)**:
  - Roguelike dungeon dive unlocking at Level 15. Foes scale infinitely into the void with persistent vitality (+15% max HP recovered per wave clear; natural regen silenced).
  - Stacking corruption (+5% enemy ATK, DEF, and Max HP every 3 waves).
  - Run Infusions / Boons: choose 1 of 3 permanent run boons every 5 waves (Void Siphon, Null Barrier, Oblivion Strike, Aether Flow, Dark Pact, Abyssal Greed, Trench Swiftness, Forbidden Insight).
  - Shard Preservation: manual surface keeps 100% gathered Abyssal Shards; wipe in combat salvages 50% shards.
  - Void Relics Altar: spend Abyssal Shards on exclusive gear (`Void Edge`, `Null Aegis`, `Abyssal Cowl`), `Voidbound Pet Egg`, `Void Reforger`, and prestige titles (`🌀 Abyss Walker`, `👑 Void Sovereign`).
  - Deepest Divers Leaderboard and quick-action card on The Table (`/`).
- **Void Reforging Altar (`/smithy`)**:
  - Consumable `Void Reforger` rerolls all magical enchantment affixes on Rare, Epic, Legendary, Mythic, and Unique gear pieces.
  - Preserves base item stats, upgrade rank, and item level.
  - Achievement `reforge_1` ("Void Alchemist", reward: 5,000 coins + title `Void Shaper`).
- **Adventurer's Codex Integration (`/guide`)**:
  - Added dedicated Abyss tab documenting void rules, corruption mechanics, boons, and relic gear.
- **ESLint & Quality Cleanup**:
  - Cleaned up unused Lucide icon imports on `Abyss.tsx`.
  - Added `counters` and `achievements` to `meSnapshot` view model.
  - All 15 test suites and 99 tests passing green.
- Update log entries signed `- By Hermes`.

---

## Session: `20260928` — Imperial Bank System, Guild Vault, Code Quality & Linting Overhaul

### Added & Expanded
- **Imperial Bank System (`/bank`)**:
  - Secure savings account with instant deposits and withdrawals.
  - Fixed Deposits (FD) with maturity intervals and guaranteed bonus interest payouts upon maturation.
  - Emergency credit loans scaled with player level, clear interest and repayment schedules.
- **Guild Vault & Communal Treasury**:
  - Direct member donations to the communal Guild Vault.
  - Member withdrawal request pipeline with custom purpose descriptions.
  - Leader and officer review workflow with real-time audit event feed.
  - Bot companion donation routine routing surplus coin directly to Guild Vault.
- **ESLint & Quality Cleanup**:
  - Fixed 31 ESLint errors across React client components, arcade client, and game servers.
  - Fixed duplicate battle branch conditions and unused imports.
  - Synchronized render-time graphics engine settings without cascading effects.
- Update log entries signed `- By Hermes`.

---

## Session: `20260923` — Royal Estate & Housing, Adventurer's Codex, Auto-Resolve Mode, Seasonal Festivals

### Added & Expanded
- **Royal Estate & Residence System (`/estate`)**:
  - 5 property tiers from Woodland Cabin up to Imperial Palace.
  - Luxury room furnishings boosting hero stats (HP, ATK, DEF, Crit, Luck, Pet Power, Healing).
  - Dedicated Pet Sanctuaries granting up to +60% pet combat multiplier.
  - Daily coin dividend (1.5% property net worth + 500 gold) and 4-hour Rested Estate buff (+10% XP, +5% Coins).
  - 70% liquidation guarantee on all properties and furnishings.
- **Adventurer's Codex & Guide Book (`/guide`)**:
  - Interactive, searchable codex in Town navigation covering Monsters & Bosses (by region), Blacksmith Recipes, Pet species and fusion, Classes, and Estate catalog.
- **Continuous Adventure Auto-Resolve**:
  - Toggleable auto-resolve directly in Adventure combat for automated encounter grinding.
- **Year-Round Seasonal Event Cycle**:
  - Autumn (Harvest Moon), Halloween (Shadow Fall), Winter (Frostfall), Spring (Vernal Awakening), Summer (Sunfire Solstice), Pelagic (Abyssal Tide) with unique bosses and shops.
- Update log entries signed `- By Hermes`.

---

## Session: `20260801` — Player recovery, save protection, bot command cleanup

### Fixed
- Recovered DargoTamber's last verified core progression from session evidence: Lv71, XP 4777, 29,151 coins, 4,835/5,240 HP, ATK 1275, DEF 850, Tower 62, 733 kills, 64 bosses.
- Replaced shared `players.json.tmp` writes with unique atomic temp files; unreadable JSON now raises instead of becoming `{}`; every save retains `players.json.bak`.
- Disabled `cogs.adventure` in the general bot to remove a duplicate player-data writer.
- Added `/adventure` to the dedicated Adventure bot and removed misleading `>fish` / `>daily` text from general bot help.
- Added `/api/version` update log notice. All future game changes must include an update-log notice signed `- By Hermes`.

---

## Session: `20260729` — Adventure crash, equipment display, mail, updates

### Fixed
- **Adventure `SyntaxError: Unexpected token '<'`** — `/api/adventure` had leftover sell-item code fused in with no route boundary, referenced undefined `item_id` → live `NameError` → Flask 500 HTML page → frontend `r.json()` parse error. Rewrote route with real combat (equip stat bonuses, HP loop, XP/level-up, coins). Confirmed via `journalctl -u hermesbot-web.service`.
- **`/api/sell` missing route** — was dead code merged into `api_adventure` with no `@app.route`. Restored as standalone POST route.
- **Dashboard equipment widget always "—"** — read nonexistent `player['equipped']` dict. Now reads real `equipped_weapon/helmet/armor/shield` fields via `equipped_slots` dict passed from `dashboard()`. Renamed 4th slot `boots`→`shield` (boots never existed).
- **Inventory "Equipped" summary undercount** — only checked `equipped_weapon`/`equipped_armor`. Now also checks `equipped_helmet`/`equipped_shield`. This also fixed the "equip didn't update" complaint — 3rd item was equipped server-side all along, just never rendered.
- **Nav buttons too small** — dashboard quick-links were 4-across, `font-size:8px`. Changed to 2×2 grid, bigger padding/font.
- **Mail showing generic "📜 Mail — CLAIMED"** — `mail.html` read `m.title/message/icon/reward_text`, but mail entries (from `game_logic.py` `tower_combat()`) actually use `subject/from/body/reward{type,emoji,qty}`. Fixed template field names to match real data.
- **Update log attribution** — added per-entry `author` field. Existing 2 entries stay "By Hermes"; entries with no explicit author default to "By DTempire". Footer now per-card, not one global line.

- **`/api/tower/combat` guaranteed-win bug** — `result.get("success")` never existed on `tower_combat()`'s return (only `victory`/`error`), so every fight ran the low-chance "underleveled mercy" fallback regardless of actual level. Also client WIN% (JS formula) and server win-chance (old fixed 2-40% band) never matched, so UI showed 95% but log said 40%. Rewrote route standalone (dropped `tower_combat()` — its `hp/atk/xp` schema is incompatible with the rest of app.py's `health/attack/level` schema and would desync displayed level): single win-chance formula `clamp(50 + (level-floor)*3, 5, 95)` shared by client JS and server, real floor-scaled coins/xp via `get_enemy_stats()`, real mail loot via `roll_floor_reward()`. Removed dead duplicate `return jsonify(result)`.
- **Tower left visual rung staleness** — after an AJAX win, floor/level text patched via JS but rung highlight + gate message stayed stale until manual refresh. Now does `location.reload()` after a win (server-rendered state is always correct; loss stays AJAX-only, no reload).
- **Temple tab (`temple.html`) was a static stub** — all Pray/Offering buttons were `onclick="alert(...)"` with zero backend. Added `/api/temple/pray` (deduct coins, grant real timed buff: defense/attack blessings → +10% tower win chance for their duration, fortune blessing → +30% tower coins) and `/api/temple/offer` (deduct coins → real XP, can level up). Buttons wired to real `fetch()` calls; page shows live coin balance + active buff.
- Confirmed `/duels` and `/skills` already have working `@app.route` decorators (`app.py:406-407`, shared `placeholder_pages()` handler) — not 404ing, no fix needed.

### In Progress
Nothing — all reported bugs this session resolved (Tower win-chance, Tower rung staleness, Temple tab).

---

## Session: `20260729b` — Skills page + Dungeon (100 floors)

### Completed
- **`/skills` page** — Dynamic buy/upgrade system. 14 skills from `game_data.py`. APIs: `GET /api/skills`, `POST /api/skills/buy`, `POST /api/skills/upgrade`. Removed broken `get_available_skills` import (function never existed; actual function is `get_skill_shop`). Page live with green owned / gold available cards, upgrade to Lv5, live coin display.
- **Dungeon 100-Floor System** — Full dungeon crawl with scaling enemies, per-floor loot, and boss fights every 10 floors.
  - **`game_data.py`**: `DUNGEON_SCALING`, `DUNGEON_BOSS_MULT`, `DUNGEON_BOSS_FLOORS`, `DUNGEON_MAX_FLOORS=100`, `DUNGEON_ENEMIES` (5 tiers by floor range), `DUNGEON_LOOT` (6 drop types with weights)
  - **`game_logic.py`**: `get_dungeon_enemy(floor)` — generates randomised enemy stats from scaling formula; bosses get 2.5× HP, 1.8× ATK; `run_dungeon_combat(player, floor)` — full turn-based fight loop, XP/coins/loot save, level-up check
  - **`app.py`**: `GET /dungeon` (page), `POST /api/dungeon/combat` (fight current floor, save player)
  - **`dungeon.html`**: 5×20 visual floor map (green=done, gold=current, dark=locked, 👑=boss). Retro combat arena with pixel SVG sprites, HP bar animations, combat log with fade-in log lines, loot reward toast.
  - **`_nav.html`**: "🏚️ Dungeon" link added to Game Hub dropdown.
  - **Player fields**: `dungeon_floor` (1-100, advances on win), `highest_dungeon` (max floor reached)

### Loot Table (per floor)
| Drop | Weight (floors 1-50) | Weight (floors 51-100) |
|---|---|---|
| 🪙 Bonus Coins | 35 | 25 |
| 📜 XP Scroll (+100 XP) | 25 | 25 |
| 🧪 Heal Potion | 20 | 10 |
| ⚔️ Gear (scales rarity) | 10 | 20 |
| 🥚 Pet Egg | 5 | 10 |
| 📘 Skill Book | 5 | 10 |

### Boss Floors
10, 20, 30, 40, 50, 60, 70, 80, 90, 100 — 2.5× HP, 1.8× ATK, 2× XP, 2.5× coins.

### Enemy Stat Scaling (approximate)
| Floor | HP | ATK | DEF | XP | Coins |
|---|---|---|---|---|---|
| 1 | ~35 | ~8 | ~4 | 8 | 5 |
| 25 | ~395 | ~80 | ~40 | ~80 | ~53 |
| 50 | ~770 | ~155 | ~77 | ~155 | ~103 |
| 75 | ~1145 | ~230 | ~115 | ~230 | ~153 |
| 100 | ~1520 | ~305 | ~155 | ~305 | ~203 |

---

## Session: `20260729c` — Hex Map Dungeon Overhaul

### Changed (full replacement)
- **`dungeon.html`** — Completely replaced grid floor map with **Canvas-drawn hex grid fantasy map** (Hexographer/Worldographer style):
  - 14×14 hex terrain grid (forest, hills, mountains, farmland, autumn woods, water, swamp, desert, void)
  - 10 named, clickable zones: Goblin Woods, Erdőhon, Crystal Caves, Vaslanka, Viharszem Keep, Naposvég, Folyószív, Mirewood Swamp, Ss'tk'lsk, Void Gate
  - Dotted roads connecting zones (snake path + cross roads)
  - Hover tooltip with zone info, click to select + see floor dots + enemy list
  - Hero marker (🧭) on current zone with golden glow
  - 👑 boss indicators on boss floors in dots
  - Color-coded terrain with random brightness variation per hex
  - Stone border frame (hex map theme matching Erdőhon screenshot)
- **10 zone enemy pools** — each zone has 5 themed enemies matching its biome
- **5 enemy stat tiers** — scaling by floor range (same formula, just presentation split by zone instead of raw number grid)
- **Player `dungeon_floor`** — preserved from old system; reset from 101→1 so new hex map is playable

### Routes
| Route | Method | Purpose |
|---|---|---|
| `/dungeon` | GET | Hex map dungeon page |
| `/api/dungeon/combat` | POST | Fight current floor |

### Fixed
- Duplicate `drawHex()` JS function causing silent canvas rendering failure — removed broken stub with wrong path logic (`moveTo(p.x,cx, cx,cx, cy)` → only proper implementation kept)
- Player Dargo had `dungeon_floor: 101` from old system — reset to 1 for fresh hex map playthrough

---

## Session: `20260729` — Skills page completed

### Completed
- **/skills page** — was a stub with hand-coded "Power Strike" / "Iron Wall" only. Now fully dynamic:
  - `GET /api/skills` returns all 14 skills with owned/upgrade state + coin balance
  - `POST /api/skills/buy` — purchase any skill from `game_data.SKILLS` (if enough coins, not already owned)
  - `POST /api/skills/upgrade` — upgrade owned skill up to level 5 (scaled cost via `game_logic.upgrade_skill`)
  - Template loads via JS fetch → renders owned skills (green border, ⭐ level display, upgrade button) and available skills (gold border, LEARN button)
  - Coin balance updates live across entire page after buy/upgrade
- All 14 skills from `game_data.py` available (Power Strike, Iron Wall, Swift Step, Berserk, Meditate, Shadow Strike, Fortress, Flame Burst, Thunderclap, Divine Shield, Life Steal, Blade Dance, Earthshaker, Mana Surge)
- Upgrade cost formula: `cost * 0.6 * current_level`, max level 5
- Toast notifications for success/error/insufficient coins

### Fixed
- *Nothing broken this session — new feature only.*

### Data
- Dargo's existing skills preserved (10 owned: Fortress, Divine Shield, Swift Step, Iron Wall, Life Steal, Blade Dance, Meditate, Power Strike, Shadow Strike, Thunderclap, Flame Burst)

---

## Routes Inventory (45 routes in app.py)

### Auth / Core
| Route | Method | Purpose |
|---|---|---|
| `/` | GET | Login page |
| `/dashboard` | GET | Main game dashboard |
| `/login` | GET | Discord OAuth redirect |
| `/callback` | GET | Discord OAuth callback |
| `/logout` | GET | Clear session |

### Pages
| Route | Method | Purpose |
|---|---|---|
| `/tower` | GET | Tower floor combat |
| `/profile` | GET | Player profile |
| `/players` | GET | Player list |
| `/leaderboard` | GET | Leaderboard |
| `/shop` | GET | Item shop |
| `/mail` | GET | Mail inbox |
| `/skills` | GET | Skills page |
| `/temple` | GET | Temple page |
| `/updates` | GET | Changelog/updates |
| `/achievements` | GET | Achievements |
| `/roles` | GET | Roles page |
| `/story` | GET | Story page |
| `/lucky_roll` | GET | Lucky roll page |
| `/settings` | GET | Settings |
| `/auction` | GET | Auction house (stub) |
| `/jobs` | GET | Jobs (stub — "Coming soon") |
| `/dungeon` | GET | Hex map dungeon page (new 20260729c) |

### APIs
| Route | Methods | Purpose |
|---|---|---|
| `/api/tower/combat` | POST | Fight floor enemy (rewritten 20260729, see Fixed) |
| `/api/temple/pray` | POST | Buy timed blessing (new 20260729) |
| `/api/temple/offer` | POST | Donate coins for XP (new 20260729) |
| `/api/tower/claim_boss` | POST | Boss floor reward |
| `/api/tower/retreat` | POST | Leave tower |
| `/api/mail/count` | GET | Unread mail count |
| `/api/mail/claim` | POST | Claim single mail |
| `/api/mail/claim_all` | POST | Claim all mail |
| `/api/pet/equip` | POST | Equip pet |
| `/api/sell` | POST | Sell inventory item (fixed 20260729) |
| `/api/version` | GET | Version/changelog |
| `/api/players` | GET | Player data (JSON) |
| `/api/skills` | GET | All skills with owned/upgrade state |
| `/api/skills/buy` | POST | Purchase a skill |
| `/api/skills/upgrade` | POST | Upgrade an owned skill |
| `/api/dungeon/combat` | POST | Fight current dungeon floor (new 20260729) |

|---

## Features NOT Done (from skill)

1. **Guilds** — `/guild` page missing, no create/join/shop/XP routes
2. **Jobs** — `/jobs` page is "Coming soon" stub, no backend
3. **Auction House** — `/auction` template exists but needs backend
4. **Blacksmith** — `/blacksmith` page missing, no crafting
5. **Tower Loot** — better loot variety per floor range
6. ~~**Pet Party**~~ — ✅ completed 20261005 (1 pet slot per 10 floors, max 5, +50% passive stat resonance & shared battle XP)
7. ~~**Sell Items**~~ — done, `/api/sell` route restored 20260729
8. **Classes (18)** — rarity-weighted starter roll
9. ~~**Mail rewards**~~ — ✅ completed 20261005 (tower milestone floors 10, 20, 30, 40, 50+ send automated mail rewards)
10. **Nav fixes** — badge, mail count JS, Tower link first
11. ~~**Skills page**~~ — ✅ completed 20260729 (14 skills, buy/upgrade Lv5 via API)

---

## Data Files
- **Players:** `data/players.json` — keyed `"{guild_id}_{user_id}"`
- **Guild shops:** `data/guild_shops.json`
- **Duels:** `data/duels.json`
- **Roles:** `data/roles.json`
- **Version:** `data/version.json`

## Safe Areas
- Do NOT touch port assignments (8081 web, 4000 HRMS)
- Do NOT touch HRMS backend at all
- Do NOT commit/push to git
- Do NOT expose .env secrets

---

## Session: `20260729e` — Wave-2: Loot Everywhere, Guild Tasks, Jobs Overhaul, Level Gates

### Added
- **Universal Loot Roller** (`game_logic.py`) — `roll_loot()` with 6 loot types (coins/potion/XP scroll/gear/pet egg/skill book). Weighted table, boss multiplier, floor-50+ bonus
- **Loot in Tower** — every tower floor win has 40% loot drop, bosses guaranteed
- **Loot in Adventure** — every combat win has 40% drop; boss fights get better pool
- **Loot in AI Duels** — win against Lv40+ enemy = boss-tier loot roll
- **Guild Tasks** (`/guild-tasks`, `guild_tasks.html`) — 3 daily cooperative missions seeded by date (everyone same tasks); progress bars, claim rewards, awards guild XP to your guild
- **Jobs Overhaul** (`jobs.html` rewrite) — Job XP + level system, dual timers (pay 24h / task 6h), 10 jobs (Farmer→Wizard), level-gated, job descriptions + daily task bonuses
- **Job Daily Task** (`/api/job/task`) — 6h cooldown; Fisher→15% pet egg, Alchemist→8% skill book, Cook→+50 HP, Miner→ore drop
- **Level Gate Middleware** (`@app.before_request enforce_level_gate`) — dungeon Lv5, tower Lv3, duels Lv10, pets Lv8, jobs Lv10, guild-tasks Lv5, skills Lv7, auction Lv15
- **Level Gate Page** (`level_gate.html`) — retro lock screen with XP progress bar, links to fight/dungeon/tower
- **Nav updates** — Pets link in Game Hub, Guild Tasks in Social dropdown
- **JOBS dict expanded** — cook, fisher, alchemist added; minimum level corrected to 10

- By Hermes

## Session: `20260729d` — Wave-1 Mega Expansion: Dashboard, Chat, Duel Arena, Loot Foundation

### Added
- **Premium Dashboard** (`templates/dashboard.html`) — Full RPG homepage: animated hero card w/ avatar/level/class, stat grid (HP/ATK/DEF/LVL/COINS/TOWER), 6 quick-action buttons w/ hover glow, world events marquee, 4 equipment slots, recent activity log, level-gated feature badges (Jobs Lv10, Guild Lv5, etc.). CSS keyframe animations: heroFloat, statPulse, barFill, particleDrift.
- **World Chat System** (`templates/chat.html`, `app.py` routes) — World + Guild + Private DM channels with friend requests. Polling-based (no WebSockets). Messages stored in `data/chat.json`. Routes: GET/POST `/api/chat/world`, `/api/chat/guild`, `/api/chat/dm`. Friend system: `/api/friends/request`, `/api/friends/accept`, `/api/friends/decline`, `/api/friends/list`. 3s rate limit, 200-char max.
- **2D Duel Arena** (`templates/duels.html`, `app.py` routes) — AI Battle mode: 6 enemies (Goblin Lv5 → Chaos Overlord Lv80). 2D CSS pixel sprites w/ idle/attack/hurt/death/victory animations. Combat log w/ 600ms step-through. PvP Challenge mode: online player list, challenge/accept/decline with real combat + coin bets. Rate limit 5s for AI fights.
- **Loot Backend** — `roll_loot()` function drops gear/skill books/pet eggs from combat (applied in duel AI backend). Prepared for dungeon/tower/adventure integration.

### Fixed
- Removed 427 lines of old orphaned duel stubs in `app.py` (lines 1340–1766) that shadowed the new routes with duplicate function names.
- `/duels` was registered twice (old stub in `placeholder_pages` + dead code) — now has its own proper route.
- Chat routes already existed from earlier work — cleaned duplicate GET/POST pairs.

### Notes
- Subagent delegation (deleg_85bdbebe) completed but its file writes were unreliable — all files rebuilt directly.
- `_nav.html` patched with 💬 World Chat link in Social dropdown.
- Service restarted and all endpoints return 302 (auth redirect — correct for unauthenticated curl).

- By Hermes

## Session: `20261003` — Wealth Milestones, 32-Region Expansion, Themed Towers, Code Quality

### Added
- **Wealth Milestones & Titles** — 4 new cumulative wealth achievements:
  - Prosperous (100k lifetime coins)
  - Tycoon (1M lifetime coins, title "the Wealthy")
  - Midas (10M lifetime coins, title "Midas Touch")
  - Dragon's Hoard (1M coins held in purse, title "the Hoarder")
- **Unified Coin Tracking** — all coin gains through `grantCoins()` now track lifetime `coinsEarned` and record `peakCoins` in player counters.
- **32-Region Expansion** — integrated six high-tier zones spanning up to the Primordial Creation Gate with unique monster drop tables.
- **Multi-Tower Themed Ascension** — specialized towers with floor multipliers, entry requirements, and themed bonus loot.

### Fixed
- Fixed 40 ESLint errors across `ImperialArcade.tsx`, `RealmBossRaids.tsx`, `Guild.tsx`, and minigame backend routines.
- Fixed `tests/events.test.ts` rate-limiting assertion by restoring `EVENT_FIGHT_COOLDOWN_MS = 5000`.
- Updated test expectations in `tests/rules.test.ts` to match the expanded 32 regions and 196 total monsters.
- Restored 100% test pass rate (72/72 tests passing).

- By Hermes

## Session: `20261005` — Pet Party Squad, Tower Milestone Mail Rewards, Container Recreate Automation

### Added & Expanded
- **Pet Party & Companion Squad (`/pets`)**:
  - Unlocks up to 5 squad slots scaling with Tower progression (1 slot per 10 floors conquered, max 5).
  - Passive +50% stat resonance (HP, ATK, DEF) from non-active squad companions directly enhancing hero stats in all encounters.
  - Battle XP sharing: non-active squad companions gain 25% of encounter XP each battle, leveling up alongside the hero.
  - Squad management UI in `client/src/pages/Pets.tsx` with one-click Add/Remove controls and active squad roster display.
  - Safety protection: companions currently deployed in the Pet Party cannot be accidentally fused or released.
- **Tower Milestone Mail Spoils**:
  - Conquering milestone floors (every 10th floor: 10, 20, 30, 40, 50+) across all tower spires now automatically dispatches reward mail from "The Tower Overseer".
  - Generous rewards scaling with conquered floor: milestone coins (`floor * floor * 50`), XP scroll bundles, mystery pet eggs (floor 20+), golden pet eggs & skill books (floor 50+).

### Fixed & Operational
- Fixed ESLint unused imports across `Hero.tsx`, `hero.ts`, `tests/unique_crafting.test.ts`, and `tests/xp_scroll_cap.test.ts`.
- Preserved strict black/white theme (`#0a0a0a` / `#111111` / `#333333`) across Pet Party UI.
- Upgraded `nightly_adventure_expansion.sh` container restart routine to `docker compose up -d` so newly built Docker images are actively recreated and deployed on the live server.
- All 97 vitest tests passing cleanly.

- By Hermes
