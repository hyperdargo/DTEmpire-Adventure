#!/usr/bin/env python3
"""
SQLite store for DTEmpire Adventure - drop-in replacement for JSON file storage.
All functions mirror the signatures in app.py so bot.py and app.py work unchanged.
"""

import sqlite3
import json
import os
import time
from pathlib import Path
from contextlib import contextmanager

DATA_DIR = Path(__file__).parent.parent / "data"
DB_PATH = DATA_DIR / "adventure.db"
DATA_DIR.mkdir(parents=True, exist_ok=True)

_conn = None


def _get_conn():
    global _conn
    if _conn is None:
        _conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        _conn.execute("PRAGMA journal_mode=WAL")
        _conn.execute("PRAGMA foreign_keys=ON")
        _conn.row_factory = sqlite3.Row
    return _conn


@contextmanager
def _tx():
    conn = _get_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def init_db():
    with _tx() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS players (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                name TEXT,
                level INTEGER DEFAULT 1,
                xp INTEGER DEFAULT 0,
                coins INTEGER DEFAULT 0,
                hp INTEGER DEFAULT 100,
                max_hp INTEGER DEFAULT 100,
                atk INTEGER DEFAULT 10,
                defense INTEGER DEFAULT 10,
                speed INTEGER DEFAULT 10,
                class TEXT DEFAULT '',
                subclass TEXT DEFAULT '',
                race TEXT DEFAULT '',
                gender TEXT DEFAULT '',
                gold INTEGER DEFAULT 0,
                bank_gold INTEGER DEFAULT 0,
                inventory TEXT DEFAULT '{}',
                equipment TEXT DEFAULT '{}',
                skills TEXT DEFAULT '{}',
                quests TEXT DEFAULT '{}',
                achievements TEXT DEFAULT '{}',
                pets TEXT DEFAULT '{}',
                mount TEXT DEFAULT '',
                title TEXT DEFAULT '',
                guild TEXT DEFAULT '',
                guild_rank TEXT DEFAULT '',
                last_active REAL DEFAULT 0,
                created_at REAL DEFAULT 0,
                updated_at REAL DEFAULT 0,
                raw_data TEXT
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_players_user_guild ON players(user_id, guild_id)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS guilds (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                tag TEXT,
                leader TEXT NOT NULL,
                members TEXT DEFAULT '[]',
                xp INTEGER DEFAULT 0,
                level INTEGER DEFAULT 1,
                description TEXT DEFAULT '',
                created_at REAL DEFAULT 0,
                updated_at REAL DEFAULT 0,
                raw_data TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS guild_shops (
                id TEXT PRIMARY KEY,
                guild_id TEXT DEFAULT '',
                category TEXT NOT NULL,
                items TEXT DEFAULT '[]',
                updated_at REAL DEFAULT 0,
                raw_data TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS json_store (
                file_name TEXT PRIMARY KEY,
                data TEXT,
                updated_at REAL DEFAULT 0
            )
        """)


def load_players() -> dict:
    with _tx() as conn:
        cur = conn.execute("""
            SELECT id, user_id, guild_id, name, level, xp, gold, hp, max_hp, atk, defense, speed,
                   class, subclass, race, gender, bank_gold, inventory, equipment, skills, quests,
                   achievements, pets, mount, title, guild, guild_rank, last_active,
                   created_at, updated_at, raw_data
            FROM players
        """)
        result = {}
        for row in cur.fetchall():
            pid = row['id']
            # Prefer parsed raw_data if present, otherwise construct from columns
            if row['raw_data']:
                try:
                    result[pid] = json.loads(row['raw_data']) if isinstance(row['raw_data'], str) else row['raw_data']
                    continue
                except Exception:
                    pass
            result[pid] = {
                "id": pid,
                "user_id": row['user_id'],
                "guild_id": row['guild_id'],
                "name": row['name'],
                "level": row['level'],
                "xp": row['xp'],
                "coins": row['gold'],
                "hp": row['hp'],
                "max_hp": row['max_hp'],
                "atk": row['atk'],
                "defense": row['defense'],
                "speed": row['speed'],
                "class": row['class'],
                "subclass": row['subclass'],
                "race": row['race'],
                "gender": row['gender'],
                "bank_gold": row['bank_gold'],
                "inventory": json.loads(row['inventory'] or "{}"),
                "equipment": json.loads(row['equipment'] or "{}"),
                "skills": json.loads(row['skills'] or "{}"),
                "quests": json.loads(row['quests'] or "{}"),
                "achievements": json.loads(row['achievements'] or "{}"),
                "pets": json.loads(row['pets'] or "{}"),
                "mount": row['mount'],
                "title": row['title'],
                "guild": row['guild'],
                "guild_rank": row['guild_rank'],
                "last_active": row['last_active'],
                "created_at": row['created_at'],
                "updated_at": row['updated_at'],
            }
        return result


def save_players(data: dict, *, allow_rollback=False):
    with _tx() as conn:
        # Replace semantics: delete any player not in the new data
        existing = {r['id'] for r in conn.execute("SELECT id FROM players")}
        gone = existing - set(data.keys())
        for pid in gone:
            conn.execute("DELETE FROM players WHERE id = ?", (pid,))
        for pid, pdata in data.items():
            if not isinstance(pdata, dict):
                continue
            parts = pid.split('_', 1)
            guild_id = parts[0] if len(parts) > 1 else 'unknown'
            user_id = parts[1] if len(parts) > 1 else pid
            now = time.time()
            if 'created_at' not in pdata or not pdata['created_at']:
                pdata['created_at'] = now
            pdata['updated_at'] = now
            conn.execute(
                """
                INSERT OR REPLACE INTO players
                (id, user_id, guild_id, name, level, xp, coins, hp, max_hp, atk, defense, speed,
                 class, subclass, race, gender, gold, bank_gold, inventory, equipment, skills,
                 quests, achievements, pets, mount, title, guild, guild_rank, last_active,
                 created_at, updated_at, raw_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    pid,
                    user_id,
                    guild_id,
                    pdata.get('name', ''),
                    pdata.get('level', 1),
                    pdata.get('xp', 0),
                    pdata.get('coins', 0),
                    pdata.get('hp', 100),
                    pdata.get('max_hp', 100),
                    pdata.get('atk', 10),
                    pdata.get('defense', pdata.get('def', 10)),
                    pdata.get('speed', 10),
                    pdata.get('class', ''),
                    pdata.get('subclass', ''),
                    pdata.get('race', ''),
                    pdata.get('gender', ''),
                    pdata.get('gold', 0),
                    pdata.get('bank_gold', 0),
                    json.dumps(pdata.get('inventory', {})),
                    json.dumps(pdata.get('equipment', {})),
                    json.dumps(pdata.get('skills', {})),
                    json.dumps(pdata.get('quests', {})),
                    json.dumps(pdata.get('achievements', {})),
                    json.dumps(pdata.get('pets', {})),
                    pdata.get('mount', ''),
                    pdata.get('title', ''),
                    pdata.get('guild', ''),
                    pdata.get('guild_rank', ''),
                    pdata.get('last_active', 0),
                    pdata.get('created_at', 0),
                    pdata.get('updated_at', 0),
                    json.dumps(pdata),
                ),
            )


def _load_players_unlocked() -> dict:
    return load_players()


def _write_players_unlocked(data: dict, *, current: dict = None, allow_rollback: bool = False):
    save_players(data, allow_rollback=allow_rollback)


def get_player(guild_id: int, user_id: int) -> dict:
    pid = f"{guild_id}_{user_id}"
    with _tx() as conn:
        cur = conn.execute("SELECT raw_data FROM players WHERE id = ?", (pid,))
        row = cur.fetchone()
        if row:
            raw = row['raw_data']
            return json.loads(raw) if isinstance(raw, str) else raw
    return {
        'id': pid,
        'user_id': str(user_id),
        'guild_id': str(guild_id),
        'name': '',
        'level': 1,
        'xp': 0,
        'coins': 0,
        'hp': 100,
        'max_hp': 100,
        'atk': 10,
        'def': 10,
        'speed': 10,
        'class': '',
        'subclass': '',
        'race': '',
        'gender': '',
        'gold': 0,
        'bank_gold': 0,
        'inventory': {},
        'equipment': {},
        'skills': {},
        'quests': {},
        'achievements': {},
        'pets': {},
        'mount': '',
        'title': '',
        'guild': '',
        'guild_rank': '',
        'last_active': 0,
        'created_at': time.time(),
        'updated_at': time.time(),
    }


def save_player(pdata: dict):
    save_players({pdata['id']: pdata})


def load_guilds() -> dict:
    with _tx() as conn:
        cur = conn.execute("SELECT raw_data FROM guilds")
        result = {}
        for row in cur.fetchall():
            raw = row['raw_data']
            gdata = json.loads(raw) if isinstance(raw, str) else raw
            gid = gdata.get('id', '')
            if gid:
                result[gid] = gdata
        return result


def save_guilds(guilds: dict):
    with _tx() as conn:
        existing = {r['id'] for r in conn.execute("SELECT id FROM guilds")}
        gone = existing - set(guilds.keys())
        for gid in gone:
            conn.execute("DELETE FROM guilds WHERE id = ?", (gid,))
        for gid, gdata in guilds.items():
            if not isinstance(gdata, dict):
                continue
            now = time.time()
            if 'created_at' not in gdata or not gdata['created_at']:
                gdata['created_at'] = now
            gdata['updated_at'] = now
            conn.execute(
                """
                INSERT OR REPLACE INTO guilds
                (id, name, tag, leader, members, xp, level, description, created_at, updated_at, raw_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    gid,
                    gdata.get('name', ''),
                    gdata.get('tag', ''),
                    gdata.get('leader', ''),
                    json.dumps(gdata.get('members', [])),
                    gdata.get('xp', 0),
                    gdata.get('level', 1),
                    gdata.get('description', ''),
                    gdata.get('created_at', 0),
                    gdata.get('updated_at', 0),
                    json.dumps(gdata),
                ),
            )


def load_shops() -> dict:
    with _tx() as conn:
        cur = conn.execute("SELECT category, raw_data FROM guild_shops")
        result = {}
        for row in cur.fetchall():
            raw = row['raw_data']
            data = json.loads(raw) if isinstance(raw, str) else raw
            result[row['category']] = data
        return result


def save_shops(shops: dict):
    with _tx() as conn:
        existing = {r['id'] for r in conn.execute("SELECT id FROM guild_shops")}
        gone = existing - set(shops.keys())
        for cid in gone:
            conn.execute("DELETE FROM guild_shops WHERE id = ?", (cid,))
        for category, data in shops.items():
            if isinstance(data, dict):
                items = data.get('items', [])
                gid = data.get('guild_id', '')
                updated = data.get('updated_at', time.time())
                raw = json.dumps(data)
            else:
                items = data
                gid = ''
                updated = time.time()
                raw = json.dumps({'items': data})
            conn.execute(
                """
                INSERT OR REPLACE INTO guild_shops (id, guild_id, category, items, updated_at, raw_data)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (category, gid, category, json.dumps(items), updated, raw),
            )


def load_json(file_name: str, default=None):
    with _tx() as conn:
        cur = conn.execute("SELECT data FROM json_store WHERE file_name = ?", (file_name,))
        row = cur.fetchone()
        if row:
            return json.loads(row['data'])
    return default if default is not None else ({} if file_name != 'chat.json' else [])


def save_json(file_name: str, data):
    with _tx() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO json_store (file_name, data, updated_at) VALUES (?, ?, ?)",
            (file_name, json.dumps(data), time.time()),
        )


def load_auction():
    return load_json('auction.json', {})


def save_auction(data):
    save_json('auction.json', data)


def load_chat():
    return load_json('chat.json', [])


def save_chat(data):
    save_json('chat.json', data)


def load_duels():
    return load_json('duels.json', {})


def save_duels(data):
    save_json('duels.json', data)


def load_milestones():
    return load_json('milestone_claims.json', {})


def save_milestones(data):
    save_json('milestone_claims.json', data)


def load_roles():
    """Roles data. Returns dict with 'roles' key (empty if none seeded yet)."""
    data = load_json('roles.json')
    if not isinstance(data, dict) or 'roles' not in data:
        return {'roles': {}}
    return data


def save_roles(data):
    save_json('roles.json', data)


init_db()