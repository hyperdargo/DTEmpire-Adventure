// Ordered migrations. Never edit a shipped migration; append a new one.

export const MIGRATIONS: { id: number; name: string; sql: string }[] = [
  {
    id: 1,
    name: "initial",
    sql: `
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,
  email TEXT COLLATE NOCASE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  discord_id TEXT UNIQUE,
  is_guest INTEGER NOT NULL DEFAULT 0,
  banned INTEGER NOT NULL DEFAULT 0,
  legacy_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);
CREATE UNIQUE INDEX users_email ON users(email) WHERE email IS NOT NULL;

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  user_agent TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE login_codes (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);

CREATE TABLE players (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  class_id TEXT NOT NULL,
  class_rarity TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  total_xp INTEGER NOT NULL DEFAULT 0,
  coins INTEGER NOT NULL DEFAULT 0,
  hp INTEGER NOT NULL,
  hp_at INTEGER NOT NULL,
  tower_floor INTEGER NOT NULL DEFAULT 0,
  dungeon_best INTEGER NOT NULL DEFAULT 0,
  arena_rating INTEGER NOT NULL DEFAULT 1000,
  power INTEGER NOT NULL DEFAULT 0,
  guild_id INTEGER REFERENCES guilds(id) ON DELETE SET NULL,
  title TEXT,
  avatar TEXT,
  bio TEXT,
  counters TEXT NOT NULL DEFAULT '{}',
  state TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX players_level ON players(level DESC, total_xp DESC);
CREATE INDEX players_tower ON players(tower_floor DESC);
CREATE INDEX players_dungeon ON players(dungeon_best DESC);
CREATE INDEX players_arena ON players(arena_rating DESC);
CREATE INDEX players_power ON players(power DESC);
CREATE INDEX players_guild ON players(guild_id);

CREATE TABLE items (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,
  rarity TEXT NOT NULL,
  ilvl INTEGER NOT NULL DEFAULT 1,
  upgrade INTEGER NOT NULL DEFAULT 0,
  qty INTEGER NOT NULL DEFAULT 1,
  base TEXT NOT NULL DEFAULT '{}',
  affixes TEXT NOT NULL DEFAULT '[]',
  equipped INTEGER NOT NULL DEFAULT 0,
  locked INTEGER NOT NULL DEFAULT 0,
  escrow TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX items_owner ON items(owner_id);
CREATE UNIQUE INDEX items_stack ON items(owner_id, template_id) WHERE base = '{}' AND escrow IS NULL AND owner_id IS NOT NULL;

CREATE TABLE skills (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  rank INTEGER NOT NULL DEFAULT 1,
  slot INTEGER,
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE pets (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  species_id TEXT NOT NULL,
  rarity TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  name TEXT,
  active INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX pets_owner ON pets(owner_id);

CREATE TABLE mail (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  attachments TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  read_at INTEGER,
  claimed_at INTEGER,
  expires_at INTEGER
);
CREATE INDEX mail_user ON mail(user_id, created_at DESC);

CREATE TABLE battles (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '{}',
  state TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX battles_active ON battles(user_id) WHERE status = 'active';

CREATE TABLE guilds (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  tag TEXT NOT NULL UNIQUE COLLATE NOCASE,
  emblem TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  leader_id INTEGER NOT NULL REFERENCES users(id),
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  open INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE guild_members (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  contribution INTEGER NOT NULL DEFAULT 0,
  joined_at INTEGER NOT NULL
);
CREATE INDEX guild_members_guild ON guild_members(guild_id);

CREATE TABLE guild_requests (
  guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY,
  channel TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX chat_channel ON chat_messages(channel, id DESC);

CREATE TABLE friends (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, friend_id)
);

CREATE TABLE blocks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, blocked_id)
);

CREATE TABLE trades (
  id INTEGER PRIMARY KEY,
  from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_coins INTEGER NOT NULL DEFAULT 0,
  request_coins INTEGER NOT NULL DEFAULT 0,
  offer_items TEXT NOT NULL DEFAULT '[]',
  request_items TEXT NOT NULL DEFAULT '[]',
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX trades_to ON trades(to_id, status);
CREATE INDEX trades_from ON trades(from_id, status);

CREATE TABLE auctions (
  id INTEGER PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  price INTEGER NOT NULL,
  status TEXT NOT NULL,
  buyer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  sold_at INTEGER
);
CREATE INDEX auctions_status ON auctions(status, expires_at);

CREATE TABLE arena_matches (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  a_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  b_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  winner_id INTEGER,
  rating_delta INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX arena_a ON arena_matches(a_id, created_at DESC);
CREATE INDEX arena_b ON arena_matches(b_id, created_at DESC);

CREATE TABLE unique_claims (
  class_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimed_at INTEGER NOT NULL
);

CREATE TABLE world_boss (
  week TEXT PRIMARY KEY,
  boss TEXT NOT NULL,
  max_hp INTEGER NOT NULL,
  hp INTEGER NOT NULL,
  defeated_at INTEGER,
  rewarded INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE world_boss_hits (
  week TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  damage INTEGER NOT NULL DEFAULT 0,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (week, user_id)
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  kind TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE INDEX audit_user ON audit_log(user_id, created_at DESC);
`,
  },
  {
    id: 2,
    name: "abyss_mode",
    sql: `
ALTER TABLE players ADD COLUMN abyss_best INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS players_abyss ON players(abyss_best DESC);
`,
  },
];
