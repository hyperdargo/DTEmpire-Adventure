# DTEmpire Adventure — State & Progress

## Quick Links
- **Web:** `http://localhost:8081` → `adventure.ankitgupta.com.np`
- **Discord Bot:** DTEmpire Adventurer#5416 (Guild: `1454372389692641444`)
- **Systemd:** `hermesbot-web.service` / `hermesbot-adventure.service`
- **Working Dir:** `/home/dargo/hermesthegreathelper/HermesBot/`
- **Code:** `web/app.py` (Flask), `web/game_logic.py`, `web/game_data.py`, `discord_bot.py`

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
6. **Pet Party** — 1 pet per 10 floors, stat contribution, equipping works (route exists)
7. ~~**Sell Items**~~ — done, `/api/sell` route restored 20260729
8. **Classes (18)** — rarity-weighted starter roll
9. **Mail rewards** — tower floor clear should send mail with rewards
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
