# DTEmpire Adventure

A persistent multiplayer browser RPG played in cards. Your class, your gear, your pets and every monster
you meet is a card on a felt table. Climb the 100-floor Tower of Ascension through a 20-chapter story,
delve a roguelite Dungeon, hatch and fuse pets, forge legendary gear, and fight other players in real time.
It installs as an app (PWA) and runs from a single Node process with a SQLite file.

This is a full rebuild of the original Flask/JSON version (kept for reference in `original/`). All of the
original content — 26 regions, 166 creatures, 20 story chapters, 20 classes, 14 skills, the item and pet
tables — carries over, re-balanced onto one tested power curve.

## Quick start

```bash
npm install
npm run dev          # API on :8081, client with hot reload on :5173
```

Open http://localhost:5173 and press **Play now, no signup**.

Production:

```bash
npm run build        # builds the client into dist/
npm start            # serves the API and the built client on :8081
```

Docker:

```bash
cp .env.example .env         # set PUBLIC_URL and SESSION_SECRET
docker compose up -d --build
```

The database and uploaded portraits live in `./data`. Back that folder up; nothing else holds state.

## What's in the game

| Loop | Where | Notes |
| --- | --- | --- |
| Encounters | Adventure | 26 regions; 10 kills in a region lures its boss |
| The climb | Tower | 100 floors, boss every 5th, one story chapter per 5 floors |
| Risk runs | Dungeon | Pouch of loot, a boon every 3 floors, bank it or lose half |
| Idle | Town → Expedition | Scouts earn while you're away (30 min / 2 h / 8 h) |
| Daily | Quests | Login streak, 3 hunt contracts, 3 missions, mission chest |
| Gear | Bag, Blacksmith | Upgrade to +10, forge two pieces into a rarer one, craft, salvage |
| Pets | Pets | Hatch eggs, fuse 3 into a better egg, one companion fights beside you |
| PvP | Arena | AI gauntlet, ranked ELO vs. player snapshots, live real-time duels |
| Server-wide | World Boss | One weekly foe, everyone's damage on one health bar |
| Seasonal | Festival | Time-limited events: own monsters, own currency, exclusive gear and a standings board |
| Social | Chat, Guild, Trades, Auction, Leaderboards | World/guild/DM chat, guild tasks, escrowed trades, auction house |

Combat is played, not watched: pick attack, a skill (cooldowns, ranks), guard, or a potion each round.
Bosses telegraph a crushing blow one turn ahead — guard it or eat 2.2× damage.

## Architecture

```
shared/    Game rules and content used by BOTH server and client (pure, no I/O)
  data/      classes, skills, items, pets, regions, meta (converted from the original)
  rules/     combat engine, stats, items, loot, monster scaling, progression, seeded RNG
server/    Fastify 5 + node:sqlite. Every state change happens here.
  game/      services (player, battles, pve, modes, economy, daily, social, inventory)
  routes/    thin HTTP adapters with zod validation
  realtime/  WebSocket hub and live duels
client/    React 19 + TanStack Query + react-router, installable PWA
```

Rules of the road:

- **The server decides everything.** The client never computes a reward or an outcome; it renders what the
  server returns. The shared rules exist so the UI can *describe* mechanics, not resolve them.
- **One transaction per action.** Services are synchronous and run inside `Db.tx`, so a request can never
  interleave with another and duplicate an item or a coin.
- **Battles are seeded.** Every fight stores a seed; a round is a pure function of (seed, turn, actions),
  which makes outcomes reproducible and testable. The seed is never sent to the client.

See [docs/GAME.md](docs/GAME.md) for the balance curves and [DESIGN.md](DESIGN.md) for the visual system.

## Configuration

Everything is optional for local play; see [.env.example](.env.example). Highlights:

| Variable | Effect |
| --- | --- |
| `PUBLIC_URL` | Your real origin. `https://` turns on Secure cookies and HSTS |
| `SESSION_SECRET` | Keeps signed cookies valid across restarts |
| `DATABASE_PATH`, `UPLOAD_DIR` | Where state lives (default `data/`) |
| `DISCORD_CLIENT_ID` / `_SECRET` | Adds "Continue with Discord"; hidden when unset |
| `SMTP_*` | Enables password reset by email; hidden when unset |
| `TRUST_PROXY` | Set `true` only behind a proxy you control |

## Importing players from the original game

The old app stored everything in `data/players.json`. Bring those heroes across:

```bash
node scripts/import-legacy.ts /path/to/players.json --dry-run     # report, change nothing
node scripts/import-legacy.ts /path/to/players.json --coin-rate 1 # do it
```

Carried over: username, email, Discord link, password (old Werkzeug hashes are verified on first login and
silently upgraded to scrypt), class and tier, level (capped at 100), coins, tower/dungeon records, kill
counters, gear (matched to the new item tables), pets, and skills with their ranks. Re-runs skip anyone
already imported. Names that collide are suffixed and reported.

## Development

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm test              # vitest: rules, balance simulations, API, security, import
npm run check         # all of the above plus a production build
node scripts/balance-sim.ts     # win rates and fight lengths at every level
node scripts/qa-capture.ts      # screenshots of every screen (desktop + phone) into .impeccable/review
```

Tests cover the combat engine's determinism, the balance curve at levels 1–100, the full HTTP surface
(auth, battles, economy, trading, auctions, guilds, dungeon, world boss, arena), authorization abuse cases,
and the legacy importer.

## Security notes

- Passwords: scrypt (N=32768) with per-user salts; sessions are random 32-byte tokens stored hashed,
  in an httpOnly SameSite=Lax cookie.
- Mutating API calls require a custom header and a same-origin `Origin`, which browsers will not send
  cross-site without a CORS preflight that is never granted.
- Strict CSP with no inline or third-party scripts; uploads are served sandboxed with `nosniff`.
- Guests can play immediately but cannot use World chat, trading or the auction house until they save
  their account.

## Credits

Original game, crest artwork and world content by Ankit Gupta (HermesBot / DTEmpire). Rebuilt as a
TypeScript app with the original content preserved.
