#!/usr/bin/env python3
"""
HermesBot Web Dashboard
Play the adventure game with a nice UI!
Connects to the same player data as the Discord bot.
Discord OAuth2 login — click "Login with Discord" and you're in.
"""

import json
import time
import random
import os
import datetime
import sys
import re
import secrets
import shutil
import tempfile
import fcntl
import urllib.parse
import urllib.request
import subprocess
import threading
from pathlib import Path
from functools import wraps
from collections import Counter

# ── Paths ──
BASE_DIR = Path(__file__).parent.parent  # HermesBot/

# Load .env before reading any env vars
from dotenv import load_dotenv
load_dotenv(BASE_DIR / ".env", override=True)  # HermesBot/.env
load_dotenv(Path.home() / ".hermes" / ".env", override=True)  # fallback

import smtplib
from email.message import EmailMessage
from werkzeug.security import generate_password_hash, check_password_hash
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash, Response
DATA_DIR = BASE_DIR / "data"
PLAYER_FILE = DATA_DIR / "players.json"
PLAYER_LOCK_FILE = DATA_DIR / "players.json.lock"
PLAYER_BACKUP_DIR = DATA_DIR / "player_backups"
PLAYER_SNAPSHOT_INTERVAL = 300
PLAYER_SNAPSHOT_KEEP = 288
R2_BACKUP_SCRIPT = BASE_DIR / "r2_backup.py"
R2_BACKUP_MIN_INTERVAL = int(os.environ.get("ADVENTURE_R2_BACKUP_MIN_INTERVAL", "300"))
_r2_backup_lock = threading.Lock()
_r2_backup_last_started = 0.0
GUILD_SHOP_FILE = DATA_DIR / "guild_shops.json"
ECONOMY_INDEX_FILE = DATA_DIR / "economy_index.json"
ROLES_FILE = DATA_DIR / "roles.json"
DUELS_FILE = DATA_DIR / "duels.json"
FOUNDER_FILE = DATA_DIR / "founder_gift.json"

app = Flask(__name__, template_folder=str(BASE_DIR / "web" / "templates"), static_folder=str(BASE_DIR / "web" / "static"))
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.secret_key = os.environ.get("WEB_SECRET_KEY", "hermes-web-secret-key-change-this")

# ── Discord OAuth config ──
DISCORD_CLIENT_ID = os.environ.get("DISCORD_CLIENT_ID", "")
DISCORD_CLIENT_SECRET = os.environ.get("DISCORD_CLIENT_SECRET", "")
DISCORD_REDIRECT_URI = os.environ.get("DISCORD_REDIRECT_URI", "http://localhost:8081/callback")
HOME_GUILD_ID = os.environ.get("DISCORD_HOME_GUILD_ID", "1454372389692641444")
DISCORD_API = "https://discord.com/api/v10"

# ── Discord webhook notifications (web → Discord sync) ──
DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "")

# ── Email OTP (Gmail SMTP) ──
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_EMAIL", "")
SMTP_PASS = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USER or "DTEmpire <no-reply@localhost>")

def send_otp_email(to_email, code):
    """Send a 6-digit login code via Gmail SMTP."""
    msg = EmailMessage()
    msg["Subject"] = "DTEmpire — Your login code"
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    msg.set_content(
        f"DTEmpire Adventure login code: {code}\n\n"
        f"This code expires in 5 minutes. If you didn't request it, ignore this email."
    )
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
        smtp.starttls()
        smtp.login(SMTP_USER, SMTP_PASS)
        smtp.send_message(msg)

def find_player_by_username(username):
    """Locate a player record by login username (case-insensitive)."""
    key = username.strip().lower()
    for pid, p in load_players().items():
        if str(p.get("username_lower", "")).lower() == key or str(p.get("username", "")).lower() == key:
            gid, uid = pid.split("_", 1)
            return gid, uid, p
    return None

def _mask_email(email):
    if "@" not in email:
        return email
    local, dom = email.split("@", 1)
    if len(local) <= 2:
        return f"{local}***@{dom}"
    return f"{local[0]}***{local[-1]}@{dom}"

def notify_discord(title, description, color=0x6c3ce0):
    """Send a notification to Discord via webhook when web players take actions."""
    if not DISCORD_WEBHOOK_URL:
        return
    try:
        data = json.dumps({
            "embeds": [{
                "title": title,
                "description": description,
                "color": color,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
                "footer": {"text": "🌐 Web Dashboard"}
            }]
        }).encode()
        req = urllib.request.Request(DISCORD_WEBHOOK_URL, data=data, method="POST")
        req.add_header("Content-Type", "application/json")
        urllib.request.urlopen(req, timeout=5)
    except Exception as e:
        pass  # Don't break the web flow if webhook fails

def discord_token_exchange(code):
    """Exchange an authorization code for an access token."""
    data = urllib.parse.urlencode({
        "client_id": DISCORD_CLIENT_ID,
        "client_secret": DISCORD_CLIENT_SECRET,
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": DISCORD_REDIRECT_URI,
    }).encode()
    req = urllib.request.Request(f"{DISCORD_API}/oauth2/token", data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    req.add_header("User-Agent", "HermesBot (https://adventure.ankitgupta.com.np, 1.0)")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def discord_get_user(access_token):
    """Get the authenticated user's Discord profile."""
    req = urllib.request.Request(f"{DISCORD_API}/users/@me")
    req.add_header("Authorization", f"Bearer {access_token}")
    req.add_header("User-Agent", "HermesBot (https://adventure.ankitgupta.com.np, 1.0)")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def get_avatar_url(user_id, avatar_hash, size=128):
    """Build Discord avatar URL."""
    if avatar_hash:
        ext = "gif" if avatar_hash.startswith("a_") else "png"
        return f"https://cdn.discordapp.com/avatars/{user_id}/{avatar_hash}.{ext}?size={size}"
    # Default avatar based on discriminator or user id
    idx = (int(user_id or "0") >> 22) % 6
    return f"https://cdn.discordapp.com/embed/avatars/{idx}.png"


# ── PROFILE AVATARS ──
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_player_avatar(player, size=128):
    """Custom uploaded avatar if present, else Discord avatar, else None."""
    if not player:
        return None
    f = player.get("avatar_file")
    if f:
        p = os.path.join(UPLOAD_DIR, f)
        if os.path.exists(p):
            return f"/static/uploads/{f}?v={int(player.get('avatar_ts', 0) or 0)}"
    if player.get("avatar"):
        return get_avatar_url(str(player.get("discord_id") or player.get("user_id") or ""), player.get("avatar", ""), size)
    return None


def session_avatar(session):
    """Avatar URL for the logged-in user, honoring uploaded custom avatars."""
    uid = session.get("user_id", "")
    try:
        p = get_player(session.get("guild_id", HOME_GUILD_ID), uid)
        a = get_player_avatar(p)
        if a:
            return a
    except Exception:
        pass
    return get_avatar_url(uid, session.get("avatar", ""))

# ── Login required decorator ──
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            if request.path.startswith("/api/"):
                return jsonify({"error": "Authentication required"}), 401
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated

class PlayerDataRollbackError(RuntimeError):
    """Raised when a write would erase players or roll back protected progression."""


_PROTECTED_PROGRESS_FIELDS = (
    "level", "tower_floor", "highest_floor", "highest_dungeon",
    "monsters_killed", "bosses_killed", "adventures_completed",
)


def _as_number(value, default=0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _validate_player_database(data):
    if not isinstance(data, dict):
        raise PlayerDataRollbackError("players.json must remain a JSON object")
    for key, record in data.items():
        if not isinstance(key, str) or not isinstance(record, dict):
            raise PlayerDataRollbackError(f"Invalid player record: {key!r}")


def _validate_player_transition(current, proposed):
    """Fail closed on destructive/stale writes while allowing normal game spending."""
    _validate_player_database(proposed)
    if not current:
        return

    missing = set(current) - set(proposed)
    if missing:
        raise PlayerDataRollbackError(
            "Refusing to delete existing player records: " + ", ".join(sorted(missing)[:5])
        )

    for key, old in current.items():
        new = proposed.get(key)
        if not isinstance(old, dict) or not isinstance(new, dict):
            continue
        old_created = _as_number(old.get("created"))
        new_created = _as_number(new.get("created"))
        if old_created and new_created and old_created != new_created:
            raise PlayerDataRollbackError(f"Refusing to replace player identity {key}")

        decreases = []
        for field in _PROTECTED_PROGRESS_FIELDS:
            before = _as_number(old.get(field))
            after = _as_number(new.get(field))
            if after < before:
                decreases.append(f"{field} {before:g}->{after:g}")
        if decreases:
            raise PlayerDataRollbackError(
                f"Refusing progression rollback for {key}: " + ", ".join(decreases)
            )

        for field in ("inventory", "pets", "mail"):
            before = old.get(field)
            after = new.get(field)
            if isinstance(before, list) and len(before) >= 10 and isinstance(after, list) and not after:
                raise PlayerDataRollbackError(
                    f"Refusing to erase non-empty {field} for {key}"
                )
        before_skills = old.get("skills")
        after_skills = new.get("skills")
        if isinstance(before_skills, dict) and len(before_skills) >= 3 and not after_skills:
            raise PlayerDataRollbackError(f"Refusing to erase skills for {key}")


def _snapshot_players_unlocked():
    if not PLAYER_FILE.exists():
        return
    PLAYER_BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    snapshots = sorted(PLAYER_BACKUP_DIR.glob("players-*.json"), key=lambda p: p.stat().st_mtime)
    now = time.time()
    if snapshots and now - snapshots[-1].stat().st_mtime < PLAYER_SNAPSHOT_INTERVAL:
        return
    stamp = datetime.datetime.fromtimestamp(now, datetime.timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
    snapshot = PLAYER_BACKUP_DIR / f"players-{stamp}.json"
    shutil.copy2(PLAYER_FILE, snapshot)
    snapshots.append(snapshot)
    for stale in snapshots[:-PLAYER_SNAPSHOT_KEEP]:
        stale.unlink(missing_ok=True)


# ── Data helpers ──
def _load_players_unlocked():
    try:
        with open(PLAYER_FILE) as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except (json.JSONDecodeError, OSError):
        app.logger.exception("Refusing to treat unreadable players.json as an empty database")
        raise


def load_players():
    """Read players while holding shared lock; never observe partial reset/write."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(PLAYER_LOCK_FILE, "a+") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_SH)
        try:
            return _load_players_unlocked()
        finally:
            fcntl.flock(lock.fileno(), fcntl.LOCK_UN)


def _write_players_unlocked(data, *, current=None, allow_rollback=False):
    """Validated atomic replace with rolling and time-series recovery copies."""
    PLAYER_FILE.parent.mkdir(parents=True, exist_ok=True)
    if current is None:
        current = _load_players_unlocked() if PLAYER_FILE.exists() else {}
    if not allow_rollback:
        _validate_player_transition(current, data)
    else:
        _validate_player_database(data)
    fd, tmp_name = tempfile.mkstemp(prefix="players.", suffix=".json.tmp", dir=PLAYER_FILE.parent)
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(data, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        if PLAYER_FILE.exists():
            _snapshot_players_unlocked()
            shutil.copy2(PLAYER_FILE, PLAYER_FILE.with_suffix(".json.bak"))
        os.replace(tmp_name, PLAYER_FILE)
        os.chmod(PLAYER_FILE, 0o600)
        dir_fd = os.open(PLAYER_FILE.parent, os.O_DIRECTORY)
        try:
            os.fsync(dir_fd)
        finally:
            os.close(dir_fd)
    finally:
        if os.path.exists(tmp_name):
            os.unlink(tmp_name)


def _start_r2_backup_after_save():
    """Best-effort asynchronous encrypted backup; never blocks gameplay saves."""
    global _r2_backup_last_started
    required = (
        "ADVENTURE_R2_ENDPOINT",
        "ADVENTURE_R2_BUCKET",
        "ADVENTURE_R2_ACCESS_KEY_ID",
        "ADVENTURE_R2_SECRET_ACCESS_KEY",
        "ADVENTURE_BACKUP_FERNET_KEY",
    )
    if not all(os.environ.get(name, "").strip() for name in required):
        return
    now = time.monotonic()
    with _r2_backup_lock:
        if now - _r2_backup_last_started < R2_BACKUP_MIN_INTERVAL:
            return
        _r2_backup_last_started = now
    try:
        subprocess.Popen(
            [sys.executable, str(R2_BACKUP_SCRIPT)],
            cwd=str(BASE_DIR),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    except OSError:
        app.logger.exception("Unable to start encrypted R2 backup")


def save_players(data, *, allow_rollback=False):
    """Replace the complete database only when no existing progress is lost."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(PLAYER_LOCK_FILE, "a+") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        try:
            current = _load_players_unlocked() if PLAYER_FILE.exists() else {}
            _write_players_unlocked(data, current=current, allow_rollback=allow_rollback)
        finally:
            fcntl.flock(lock.fileno(), fcntl.LOCK_UN)
    _start_r2_backup_after_save()


def load_shops():
    try:
        with open(GUILD_SHOP_FILE) as f:
            return json.load(f)
    except Exception:
        return {}

def load_roles():
    try:
        with open(ROLES_FILE) as f:
            return json.load(f)
    except:
        return {"roles": {}, "shop_filters": {}, "duel_ranks": []}

def load_duels():
    try:
        with open(DUELS_FILE) as f:
            return json.load(f)
    except:
        return {"active_duels": {}, "duel_history": [], "ai_opponents": []}

def save_duels(data):
    with open(DUELS_FILE, "w") as f:
        json.dump(data, f, indent=2)

def mark_founder():
    """The welcome gift is granted once, to the first account ever created."""
    try:
        FOUNDER_FILE.write_text(json.dumps({"claimed": True}))
    except Exception:
        pass

def founder_claimed():
    try:
        return json.loads(FOUNDER_FILE.read_text()).get("claimed", False)
    except Exception:
        pass
    # Seed: players created before this feature already received the gift.
    try:
        if any(p.get("welcome_gift") for p in load_players().values()):
            mark_founder()
            return True
    except Exception:
        pass
    return False

MILESTONE_FILE = DATA_DIR / "milestone_claims.json"

def load_milestones():
    try:
        return json.loads(MILESTONE_FILE.read_text())
    except Exception:
        return {}

def save_milestones(data):
    try:
        MILESTONE_FILE.write_text(json.dumps(data, indent=2))
    except Exception:
        pass

def _reward_set(prefix, label, rarity, power):
    """Build a complete 4-piece reward set with stable IDs."""
    weapon = {"id": f"{prefix}_weapon", "name": f"{label} Blade", "type": "weapon", "icon": "⚔️",
              "rarity": rarity, "stats": {"attack": power, "defense": power // 10}, "category": "weapon"}
    armor = {"id": f"{prefix}_armor", "name": f"{label} Armor", "type": "armor", "icon": "🛡️",
             "rarity": rarity, "stats": {"defense": power // 2, "hp": power}, "category": "armor"}
    helmet = {"id": f"{prefix}_helmet", "name": f"{label} Helm", "type": "helmet", "icon": "⛑️",
              "rarity": rarity, "stats": {"defense": power // 3, "hp": power // 2}, "category": "head"}
    boots = {"id": f"{prefix}_boots", "name": f"{label} Boots", "type": "boots", "icon": "👢",
             "rarity": rarity, "stats": {"defense": power // 4, "hp": power // 3}, "category": "boots"}
    equipped = {"equipped_weapon": weapon, "equipped_armor": armor,
                "equipped_helmet": helmet, "equipped_boots": boots}
    return [weapon, armor, helmet, boots], equipped, [], []


def founder_package():
    """FIRST account ever: one-time RARE Founder's set."""
    return _reward_set("founder_rare", "Founder's", "rare", 20)


def leaderboard_package():
    """Each player receives this EPIC set only their first time reaching #1."""
    return _reward_set("rank1_epic", "Champion's", "epic", 45)


def level100_package():
    """Only the first player ever to reach Lv.100 receives this LEGENDARY set."""
    return _reward_set("first100_legendary", "Centurion", "legendary", 90)

def grant_package(player, package, coins):
    inv = player.setdefault("inventory", [])
    have = {i.get("id") for i in inv if isinstance(i, dict)}
    for item in package[0]:
        if item["id"] not in have:
            inv.append(item)
    for k, v in package[1].items():
        if v is not None:
            player[k] = v
    pets = player.setdefault("pets", [])
    pet_ids = {pt.get("id") for pt in pets if isinstance(pt, dict)}
    for pt in package[2]:
        if pt["id"] not in pet_ids:
            pets.append(pt)
    eqp = player.setdefault("equipped_pets", [])
    for pt in package[2]:
        if pt["id"] not in eqp:
            eqp.append(pt["id"])
    player["coins"] = player.get("coins", 0) + coins

def check_titles(player):
    """First player ever to Lv.100: one-time Legendary set + title."""
    if not player or not player.get("user_id"):
        return []
    claims = load_milestones()
    uid = str(player["user_id"])
    msgs = []
    if player.get("level", 1) >= 100 and not claims.get("level100"):
        claims["level100"] = {"user_id": uid, "name": player.get("name", ""), "at": time.time()}
        grant_package(player, level100_package(), 100000)
        title = "🏆 First to Level 100"
        if title not in player.setdefault("titles_unlocked", []):
            player["titles_unlocked"].append(title)
        player["active_title"] = title
        msgs.append(f"{title}: Legendary Centurion full set + 100,000 coins!")
        save_milestones(claims)
    return msgs


def check_milestones(player):
    """Rank #1: each player gets one Epic set only the FIRST time they reach #1."""
    if not player or not player.get("user_id"):
        return []
    claims = load_milestones()
    uid = str(player["user_id"])
    msgs = []
    players = load_players()
    # Rank rewards only exist after real competition: at least two unique players.
    if len({str(p.get("user_id", "")) for p in players.values() if p.get("user_id")}) >= 2:
        # Include current in-memory progress; caller may not have saved level-up yet.
        candidates = [p for p in players.values() if str(p.get("user_id", "")) != uid] + [player]
        rank1 = max(candidates, key=lambda x: (x.get("level", 0), x.get("monsters_killed", 0)))
        if str(rank1.get("user_id")) == uid and uid not in claims.get("rank1", []):
            grant_package(player, leaderboard_package(), 20000)
            claims.setdefault("rank1", []).append(uid)
            msgs.append("👑 FIRST TIME AT LEADERBOARD #1: Epic Champion's full set + 20,000 coins!")
    msgs.extend(check_titles(player))
    if msgs:
        # check_titles may have written global Lv.100 claim; preserve it.
        latest_claims = load_milestones()
        latest_claims.setdefault("rank1", [])
        for claimed_uid in claims.get("rank1", []):
            if claimed_uid not in latest_claims["rank1"]:
                latest_claims["rank1"].append(claimed_uid)
        save_milestones(latest_claims)
        player.setdefault("mail", []).append({
            "subject": "🎁 MILESTONE REWARD", "from": "System",
            "body": "\n".join(msgs), "reward": None, "claimed": False, "floor": 0,
        })
    return msgs

def get_player(guild_id, user_id):
    players = load_players()
    key = f"{guild_id}_{user_id}"
    if key not in players:
        if not founder_claimed():
            # ── FIRST ACCOUNT EVER: founder welcome gift ──
            inventory, equipped, pets, equipped_pets = founder_package()
            coins, welcome_gift = 20000, True
            mark_founder()
        else:
            # ── EVERYONE AFTER: plain adventurer start ──
            inventory, equipped, pets, equipped_pets, coins = [], {}, [], [], 100
            welcome_gift = False
        players[key] = {
            "user_id": user_id, "guild_id": guild_id, "name": "",
            "level": 1, "xp": 0, "health": 100, "max_health": 100,
            "attack": 10, "defense": 5,
            "coins": coins,
            "inventory": inventory,
            "equipped_weapon": equipped.get("equipped_weapon"), "equipped_armor": equipped.get("equipped_armor"),
            "equipped_helmet": equipped.get("equipped_helmet"), "equipped_shield": equipped.get("equipped_shield"),
            "equipped_boots": equipped.get("equipped_boots"),
            "pets": pets, "pet_levels": {}, "equipped_pets": equipped_pets,
            "welcome_gift": welcome_gift,
            "skills": {}, "mail": [], "guild": None, "guild_name": None,
            "monsters_killed": 0, "deaths": 0, "bosses_killed": 0,
            "adventures_completed": 0, "last_daily": 0, "last_adventure": 0,
            "created": time.time(),
            "role": None, "role_level": 0,
            "duel_wins": 0, "duel_losses": 0, "duel_streak": 0, "duel_rank": "Rookie",
            "ai_duel_wins": 0, "matches_played": 0,
            "online": False, "last_seen": 0,
            "active_title": "Adventurer", "titles_unlocked": ["Adventurer"],
            "story_chapter": 0, "completed_chapters": [],
            "achievements": [], "unique_items": [], "ancient_skills": [],
            "unlocks": {},
        }
        save_players(players)
    # Ensure new fields exist on old players
    else:
        changed = False
        all_defaults = {
            "role": None, "role_level": 0, "duel_wins": 0, "duel_losses": 0,
            "duel_streak": 0, "duel_rank": "Rookie", "ai_duel_wins": 0,
            "matches_played": 0, "online": False, "last_seen": 0,
            "active_title": "Adventurer", "titles_unlocked": ["Adventurer"],
            "monsters_killed": 0, "deaths": 0, "bosses_killed": 0,
            "adventures_completed": 0, "last_daily": 0, "last_adventure": 0,
            "inventory": [], "equipped_weapon": None, "equipped_armor": None,
            "equipped_helmet": None, "equipped_shield": None, "equipped_boots": None,
            "pets": [], "pet_levels": {}, "equipped_pets": [],
            "skills": {}, "mail": [], "guild": None, "guild_name": None,
            "unlocks": {},
            "attack": 10, "defense": 5, "health": 100, "max_health": 100
        }
        for field, default_val in all_defaults.items():
            if field not in players[key] or players[key][field] is None:
                players[key][field] = default_val
                changed = True
        # Fix any null values that default might not cover
        for f in ['level', 'health', 'max_health', 'coins', 'xp', 'tower_floor', 'class_tier']:
            if f in players[key] and players[key][f] is None:
                players[key][f] = all_defaults.get(f, 0) if f in all_defaults else (1 if f in ['level', 'tower_floor', 'class_tier'] else 0)
                changed = True
        if changed:
            # Persist only this migrated record. A whole-database write can erase
            # peers if another request saved between load and migration.
            save_player(guild_id, user_id, players[key])
    return players[key]

def save_player(guild_id, user_id, player):
    """Merge one player under exclusive lock so concurrent saves cannot erase peers."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    key = f"{guild_id}_{user_id}"
    with open(PLAYER_LOCK_FILE, "a+") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        try:
            players = _load_players_unlocked()
            proposed = dict(players)
            proposed[key] = player
            _write_players_unlocked(proposed, current=players)
        finally:
            fcntl.flock(lock.fileno(), fcntl.LOCK_UN)

def update_duel_rank(player):
    """Update player's duel rank based on streak and wins."""
    roles_data = load_roles()
    duel_ranks = roles_data.get("duel_ranks", [])
    streak = player.get("duel_streak", 0)
    wins = player.get("duel_wins", 0)
    
    new_rank = "Rookie"
    for rank in duel_ranks:
        if streak >= rank["min_streak"] and wins >= rank["min_wins"]:
            new_rank = rank["name"]
    
    player["duel_rank"] = new_rank
    return new_rank

def get_rank_emoji(rank_name):
    """Get emoji for a duel rank."""
    roles_data = load_roles()
    for rank in roles_data.get("duel_ranks", []):
        if rank["name"] == rank_name:
            return rank["emoji"]
    return "🥚"

# ── Adventure data ──
ADVENTURE_LOCATIONS = []
_cache_file = DATA_DIR / "adventure_locations.json"
try:
    with open(_cache_file) as _f:
        ADVENTURE_LOCATIONS = json.load(_f)
except:
    ADVENTURE_LOCATIONS = []

# ── Context processor (available in all templates) ──
@app.context_processor
def inject_user():
    return {
        "session_user": session.get("username", ""),
        "session_avatar": get_avatar_url(session.get("user_id", "0"), session.get("avatar", "")),
        "session_user_id": session.get("user_id", ""),
        "RARITY_COLORS": {"common":"#94a3b8", "uncommon":"#22c55e", "rare":"#3b82f6", "epic":"#a855f7", "legendary":"#f59e0b"},
        "RARITY_STARS": {"common":"★", "uncommon":"★★", "rare":"★★★", "epic":"★★★★", "legendary":"★★★★★"},
        "xp_for_level": xp_for_level,
        "DISCORD_CLIENT_ID": DISCORD_CLIENT_ID,
        "HOME_GUILD_ID": HOME_GUILD_ID,
    }

@app.context_processor
def inject_mail_count():
    """Inject unread mail count for nav badge."""
    if 'user_id' not in session:
        return {"mail_count": 0}
    try:
        with open(PLAYER_FILE) as f:
            players = json.load(f)
        player = players.get(str(session['user_id']), {})
        mail = player.get('mail', [])
        unread = sum(1 for m in mail if not m.get('claimed'))
        return {"mail_count": unread}
    except:
        return {"mail_count": 0}

@app.after_request
def add_nocache(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    if response.content_type.startswith("text/html"):
        html = response.get_data(as_text=True)
        if "property=\"og:image\"" not in html and "</head>" in html:
            social_meta = """<meta property="og:title" content="DTEmpire Adventure - The Ultimate Browser RPG">
<meta property="og:description" content="Climb the tower, forge gear, and hatch mythic pets. Start your adventure now!">
<meta property="og:image" content="https://adventure.ankitgupta.com.np/static/icon-192.png">
<meta property="og:image:secure_url" content="https://adventure.ankitgupta.com.np/static/icon-192.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="192">
<meta property="og:image:height" content="192">
<meta property="og:url" content="https://adventure.ankitgupta.com.np/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="DTEmpire Adventure">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="DTEmpire Adventure">
<meta name="twitter:description" content="Climb the tower, forge gear, and hatch mythic pets. Start your adventure now!">
<meta name="twitter:image" content="https://adventure.ankitgupta.com.np/static/icon-192.png">
"""
            response.set_data(html.replace("</head>", social_meta + "</head>", 1))
    return response

# ── Routes ──

from game_logic import get_enemy_stats, roll_floor_reward, get_story_chapter, check_achievements, sell_item, grant_mail_reward, buy_skill, upgrade_skill, upgrade_class, calc_stats, potion_heal_amount, maybe_auto_drink, xp_for_level
from game_data import CLASSES, SKILLS, ACHIEVEMENTS, SELL_PRICES, RARITY_ORDER

@app.route("/api/tower/combat", methods=["POST"])
@login_required
def api_tower_combat():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    calc_stats(player)
    floor = player.get("tower_floor", 1)
    from game_data import TOWER_MAX_FLOORS
    if floor > TOWER_MAX_FLOORS:
        return jsonify({"error": "🏆 Tower complete! You conquered all 100 floors!"}), 400
    p_lvl = player.get("level", 1)
    # HARD tower: win chance depends on level vs floor REQUIREMENT (2×floor).
    # At the required level you're at 50/50 — every 5 levels over adds +10%.
    from game_data import get_required_level as _req_lv
    req_lv = _req_lv(floor)
    # Same formula as the client-side WIN % display so shown odds match the real roll
    win_chance = max(5, min(95, 50 + (p_lvl - req_lv) * 2))
    buff = player.get("temple_buff")
    if buff and buff.get("expires", 0) > time.time() and buff.get("type") in ("defense", "attack"):
        win_chance = min(95, win_chance + 10)
    won = random.randint(1, 100) <= win_chance

    if not won:
        player["health"] = max(0, player.get("health", 100) - random.randint(10, 30))
        _drank, _dmsg = maybe_auto_drink(player)
        save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
        log = [f"⚔️ You challenged Floor {floor}...", "💀 The floor was too strong! You took damage.", f"📉 Win chance was {win_chance}%"]
        if _drank:
            log.append(_dmsg)
        return jsonify({"won": False, "log": log, "coins": 0, "xp": 0, "player_hp": player["health"], "player_max_hp": player.get("max_health", 100), "new_floor": floor, "player": player})

    enemy = get_enemy_stats(floor)
    coins = enemy["coin_reward"]
    xp = enemy["xp_reward"]
    if buff and buff.get("expires", 0) > time.time() and buff.get("type") == "fortune":
        coins = int(coins * 1.3)
    player["tower_floor"] = min(floor + 1, TOWER_MAX_FLOORS)  # 100 = summit
    player["highest_floor"] = max(player.get("highest_floor", 1), player["tower_floor"])
    bump_mission(player, "tower")
    player["xp"] = player.get("xp", 0) + xp
    player["coins"] = player.get("coins", 0) + coins

    # Loot drop
    from game_logic import roll_loot as _roll_loot
    _tower_loot = _roll_loot(player, source="tower", floor=floor, is_boss=enemy.get("is_boss", False))

    from game_logic import level_up as _level_up
    _eggs_before = len([i for i in player.get("inventory", []) if isinstance(i, dict) and i.get("type") == "egg"])
    leveled_up = _level_up(player) > 0
    _eggs_after = len([i for i in player.get("inventory", []) if isinstance(i, dict) and i.get("type") == "egg"])
    check_milestones(player)
    check_titles(player)
    grant_achievements(player)

    mail_reward = roll_floor_reward(floor, enemy["is_boss"])
    player.setdefault("mail", []).append({
        "subject": f"Floor {floor} Reward", "from": "Tower",
        "body": f"🎁 You cleared Floor {floor}! {mail_reward['emoji']} {mail_reward['type']} x{mail_reward['qty']}",
        "reward": mail_reward, "claimed": False, "floor": floor,
    })

    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    log = [f"⚔️ You challenged Floor {floor}!", f"✨ Victory! ({win_chance}% chance) 🪙+{coins} ⭐+{xp}", f"⬆ Floor {min(floor + 1, TOWER_MAX_FLOORS)} unlocked!", f"📬 Mail reward: {mail_reward['emoji']} {mail_reward['type']} x{mail_reward['qty']}"]
    if _tower_loot:
        log.append(f"🎁 {_tower_loot}")
    if leveled_up:
        log.append(f"⬆ LEVEL UP! You are now Level {player['level']}!")
    if _eggs_after > _eggs_before:
        log.append(f"🥚 Level milestone: Mystery Egg x{_eggs_after - _eggs_before} added to inventory!")
    
    # Check story progression
    from game_logic import get_unlocked_chapter
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    _, new_rewards = get_unlocked_chapter(player)
    if new_rewards:
        save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
        for r in new_rewards:
            log.append(f"📖 Chapter {r['chapter']}: {r['title']} — Rewards claimed! 🪙+{r.get('rewards',{}).get('coins',0)} ⭐+{r.get('rewards',{}).get('xp',0)}")
            if r.get("bonus_item"):
                log.append(f"🎁 Bonus item: {r['bonus_item']}!")
    
    return jsonify({"won": True, "log": log, "coins": coins, "xp": xp,
                    "is_boss": enemy["is_boss"], "enemy_name": enemy["name"],
                    "mail_reward": mail_reward,
                    "player_hp": player.get("health", 100),
                    "player_max_hp": player.get("max_health", 100),
                    "new_floor": player["tower_floor"], "leveled_up": leveled_up,
                    "player": player})

# ── DUNGEON SYSTEM (100 floors) ──
@app.route("/dungeon")
@login_required
def dungeon_page():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    return render_template(
        "dungeon.html", player=player, username=session.get("username", "Player"),
        avatar_url=session_avatar(session),
    )

def grant_achievements(player):
    """Evaluate achievements and mail the player each new unlock.

    check_achievements() already appends the name to player["achievements"]
    and pays the +20 coin bonus, so this only handles notification.
    """
    new_achs = check_achievements(player)
    for a in new_achs:
        player.setdefault("mail", []).append({
            "subject": f"{a['emoji']} ACHIEVEMENT UNLOCKED",
            "from": "System",
            "body": f"{a['name']} — {a['desc']}\n+20 coins awarded.",
            "reward": None, "claimed": False, "floor": 0,
        })
    return new_achs


# ── BESTIARY ──
def _bestiary_record(player, name):
    """Track per-monster kill counts for bestiary discovery."""
    b = player.get("bestiary")
    if not isinstance(b, dict):
        b = {}
    b[name] = b.get(name, 0) + 1
    player["bestiary"] = b
    _bestiary_mastery(player, name, b[name])


# Bestiary Mastery: (kills_required, rank_name, coin_reward)
MASTERY_TIERS = [
    (10, "Novice", 250),
    (50, "Hunter", 1500),
    (200, "Slayer", 8000),
    (500, "Nemesis", 30000),
]


def _bestiary_mastery(player, name, kills):
    """Award a one-time coin bonus + mail when a monster kill milestone is hit."""
    ranks = player.get("bestiary_mastery")
    if not isinstance(ranks, dict):
        ranks = {}
    current = ranks.get(name, 0)
    for idx, (need, rank, coins) in enumerate(MASTERY_TIERS, start=1):
        if idx <= current or kills < need:
            continue
        ranks[name] = idx
        current = idx
        player["coins"] = player.get("coins", 0) + coins
        player.setdefault("mail", []).append({
            "subject": "\U0001F3C5 MASTERY: %s" % rank,
            "from": "Bestiary",
            "body": "%s rank reached against %s (%d defeated).\n+%d coins awarded."
                    % (rank, name, kills, coins),
            "reward": None, "claimed": False, "floor": 0,
        })
    player["bestiary_mastery"] = ranks

@app.route("/bestiary")
@login_required
def bestiary_page():
    """Read-only monster compendium across all locations."""
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    seen = player.get("bestiary", {})
    mastery = player.get("bestiary_mastery", {})
    if not isinstance(mastery, dict):
        mastery = {}
    rank_names = {i: t[1] for i, t in enumerate(MASTERY_TIERS, start=1)}
    ranks = {k: rank_names.get(v, "") for k, v in mastery.items()}
    locations = sorted(ADVENTURE_LOCATIONS, key=lambda l: l.get("min_level", 0))
    return render_template(
        "bestiary.html", ranks=ranks, player=player, locations=locations, seen=seen,
        username=session.get("username", "Player"),
        avatar_url=session_avatar(session),
    )

@app.route("/api/dungeon/combat", methods=["POST"])
@login_required
def api_dungeon_combat():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    calc_stats(player)
    floor = player.get("dungeon_floor", 1)
    from game_data import DUNGEON_MAX_FLOORS
    from game_logic import run_dungeon_combat

    if floor > DUNGEON_MAX_FLOORS:
        return jsonify({"error": "Dungeon complete! You've conquered all 100 floors!"}), 400

    result = run_dungeon_combat(player, floor)
    check_milestones(player)
    check_titles(player)
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify(result)

TEMPLE_BLESSINGS = {
    "defense": {"name": "Guardian's Boon", "cost": 500, "duration": 3600},
    "attack": {"name": "Warrior's Fury", "cost": 800, "duration": 1800},
    "fortune": {"name": "Fortune's Grace", "cost": 1200, "duration": 7200},
}

@app.route("/api/temple/pray", methods=["POST"])
@login_required
def api_temple_pray():
    key = (request.json or {}).get("blessing")
    blessing = TEMPLE_BLESSINGS.get(key)
    if not blessing:
        return jsonify({"error": "Unknown blessing"}), 400
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    if player.get("coins", 0) < blessing["cost"]:
        return jsonify({"error": "Not enough coins"}), 400
    player["coins"] -= blessing["cost"]
    player["temple_buff"] = {"type": key, "name": blessing["name"], "expires": time.time() + blessing["duration"]}
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "coins": player["coins"], "buff": player["temple_buff"]})

@app.route("/api/temple/offer", methods=["POST"])
@login_required
def api_temple_offer():
    amount = int((request.json or {}).get("amount", 0))
    if amount not in (100, 500, 1000):
        return jsonify({"error": "Invalid offering"}), 400
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    if player.get("coins", 0) < amount:
        return jsonify({"error": "Not enough coins"}), 400
    player["coins"] -= amount
    xp_gain = amount // 2
    player["xp"] = player.get("xp", 0) + xp_gain
    from game_logic import level_up as _level_up_temple
    levels_gained = _level_up_temple(player)
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({
        "success": True, "coins": player["coins"], "xp_gain": xp_gain,
        "leveled_up": levels_gained > 0, "level": player.get("level", 1),
    })

@app.route("/api/dungeon/preview", methods=["POST"])
@login_required
def api_dungeon_preview():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    calc_stats(player)
    floor = player.get("dungeon_floor", 1)
    from game_data import DUNGEON_MAX_FLOORS, DUNGEON_ENEMIES, DUNGEON_BOSS_FLOORS, DUNGEON_BOSS_MULT
    if floor > DUNGEON_MAX_FLOORS:
        return jsonify({"error": "Dungeon complete! You've conquered all 100 floors!"}), 400

    is_boss = floor in DUNGEON_BOSS_FLOORS
    enemy_base = DUNGEON_ENEMIES.get(floor, DUNGEON_ENEMIES[1]).copy()
    enemy_base["is_boss"] = is_boss
    if is_boss:
        for k, m in DUNGEON_BOSS_MULT.items():
            if k in enemy_base:
                enemy_base[k] = int(enemy_base[k] * m)
    return jsonify({"enemy": enemy_base, "floor": floor, "is_boss": is_boss})

    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
@login_required
def mail_page():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    return render_template("mail.html", player=player, mail=player.get("mail", []))



@app.route("/api/mail/count")
@login_required
def api_mail_count():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    mail = player.get("mail", [])
    unread = sum(1 for m in mail if not m.get("claimed"))
    return jsonify({"count": unread})

@app.route("/api/mail/claim_all", methods=["POST"])
@login_required
def api_mail_claim_all():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    mail = player.get("mail", [])
    from game_logic import grant_mail_reward
    claimed = 0
    for i, entry in enumerate(mail):
        if not entry.get("claimed"):
            success, _ = grant_mail_reward(player, i)
            if success:
                claimed += 1
    if claimed > 0:
        save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
        return jsonify({"success": True, "message": f"Claimed {claimed} rewards!"})
    return jsonify({"success": False, "error": "No mail to claim!"})


SHOP_BASE_INCREASE = 1.25
SHOP_SUBSCRIPTIONS = {
    "premium": {"name": "Premium Store", "cost": 10000, "seconds": 3600},
    "vip": {"name": "VIP Store", "cost": 50000, "seconds": 3600},
}
SHOP_TIER_RARITIES = {
    "normal": {"common", "uncommon", "rare"},
    "premium": {"rare", "epic", "unique"},
    "vip": {"legendary", "mythic", "unique"},
}


def _economy_inflation():
    """Daily, global, capped inflation based on median player wealth growth."""
    today = datetime.date.today().isoformat()
    balances = sorted(max(0, int(p.get("coins", 0) or 0)) for p in load_players().values())
    median = balances[len(balances) // 2] if balances else 0
    try:
        state = json.loads(ECONOMY_INDEX_FILE.read_text())
    except Exception:
        state = {"date": today, "median_coins": median, "multiplier": 1.0}
    if state.get("date") != today:
        previous = max(1, int(state.get("median_coins", 0) or 0))
        multiplier = float(state.get("multiplier", 1.0) or 1.0)
        if median > previous:
            # At most +2% per day, and never above 3x. New players remain
            # protected because low-tier goods stay in the Normal Store.
            growth = min(0.02, ((median - previous) / previous) * 0.10)
            multiplier = min(3.0, multiplier * (1.0 + growth))
        state = {"date": today, "median_coins": median, "multiplier": round(multiplier, 6)}
        ECONOMY_INDEX_FILE.write_text(json.dumps(state, indent=2))
    elif not ECONOMY_INDEX_FILE.exists():
        ECONOMY_INDEX_FILE.write_text(json.dumps(state, indent=2))
    return max(1.0, min(3.0, float(state.get("multiplier", 1.0) or 1.0)))


def _effective_shop_items(store="normal"):
    inflation = _economy_inflation()
    allowed = SHOP_TIER_RARITIES.get(store, SHOP_TIER_RARITIES["normal"])
    items = _shop_with_eggs(_normalize_shop_items() or DEFAULT_SHOP_ITEMS)
    result = []
    for original in items:
        if str(original.get("rarity", "common")).lower() not in allowed:
            continue
        item = dict(original)
        item["base_price"] = int(item.get("price", 0) or 0)
        item["price"] = max(1, int(round(item["base_price"] * SHOP_BASE_INCREASE * inflation)))
        item["store"] = store
        result.append(item)
    return result, inflation


@app.route("/shop")
@app.route("/shop/<store>")
@login_required
def shop_page(store="normal"):
    if store not in SHOP_TIER_RARITIES:
        return redirect(url_for("shop_page", store="normal"))
    pid = session.get("guild_id", HOME_GUILD_ID)
    player = get_player(pid, session["user_id"])
    shops = load_shops()
    gid = pid
    shop = shops.get(gid, {})
    # Get full shop list + roles for the template
    if isinstance(shop, dict) and shop.get("items"):
        full_shop = shop["items"]
    else:
        # Flat cache format: {"weapons": [...], "armor": [...], ...}
        full_shop = [it for v in shops.values() if isinstance(v, list) for it in v]
    player_role = player.get("role", "") if isinstance(player, dict) else ""
    try:
        from game_data import ROLES
        roles_data = ROLES
    except:
        roles_data = {}
    categories = list(set(i.get("category","misc") for i in full_shop)) if full_shop else ["weapons","armor","potions","misc"]
    shop_items, inflation = _effective_shop_items(store)
    subscription_until = float(player.get(f"{store}_shop_until", 0) or 0)
    has_access = store == "normal" or subscription_until > time.time()
    return render_template("shop.html", player=player, shop=shop, full_shop=full_shop,
                           allowed_categories=categories, roles_data=roles_data, player_role=player_role,
                           shop_items=shop_items, store=store, has_access=has_access,
                           subscription_until=subscription_until, inflation=inflation,
                           subscriptions=SHOP_SUBSCRIPTIONS)


@app.route("/api/shop/subscribe", methods=["POST"])
@login_required
def api_shop_subscribe():
    store = str((request.get_json(silent=True) or {}).get("store", "")).lower()
    plan = SHOP_SUBSCRIPTIONS.get(store)
    if not plan:
        return jsonify({"error": "Unknown store subscription."}), 400
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    # Non-stackable daily pass: an active pass is rejected, never extended
    # past 24h, so coins can't be re-spent to compound access.
    if float(player.get(f"{store}_shop_until", 0) or 0) > time.time():
        return jsonify({"error": f"{plan['name']} access is already active."}), 400
    if player.get("coins", 0) < plan["cost"]:
        return jsonify({"error": f"Need {plan['cost']:,} coins."}), 400
    player["coins"] -= plan["cost"]
    player[f"{store}_shop_until"] = time.time() + plan["seconds"]
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "coins": player["coins"],
                    "active_until": player[f"{store}_shop_until"]})

@app.route("/updates")
@login_required
def updates_page():
    return render_template("updates.html")

@app.route("/api/title/equip", methods=["POST"])
@login_required
def api_title_equip():
    """Equip an owned title — the badge under your name on the profile."""
    title = str((request.get_json(silent=True) or {}).get("title", "")).strip()
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    owned = player.get("titles_unlocked", [])
    if title not in owned:
        return jsonify({"error": "You don't own that title."}), 400
    player["active_title"] = title
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "title": title})


@app.route("/api/mail/claim", methods=["POST"])
@login_required
def api_mail_claim():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    idx = request.json.get("idx", request.json.get("index", -1))
    success, msg = grant_mail_reward(player, idx)
    if success: save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": success, "error": msg if not success else None})

@app.route("/api/pet/equip", methods=["POST"])
@login_required
def api_pet_equip():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    pet = request.json.get("pet", "")
    equipped = player.get("equipped_pets", [])
    if pet in equipped:
        equipped.remove(pet)
    else:
        if len(equipped) >= max(1, player.get("highest_floor", 1) // 10):
            return jsonify({"error": "Party full! Climb tower to unlock more slots."})
        equipped.append(pet)
    player["equipped_pets"] = equipped
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True})

# ── Skills API ────────────────────────────────────────────
@app.route("/api/skills", methods=["GET"])
@login_required
def api_skills():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    from game_data import SKILLS
    owned = player.get("skills", {})
    # Annotate available skills with upgrade info
    all_data = {}
    for name, info in SKILLS.items():
        entry = dict(info, name=name)
        if name in owned:
            entry["owned"] = True
            entry["level"] = owned[name].get("level", 1)
            entry["max_level"] = 5
            upgrade_cost = int(info["cost"] * 0.6 * entry["level"])
            entry["upgrade_cost"] = upgrade_cost if entry["level"] < 5 else None
        else:
            entry["owned"] = False
            entry["available"] = True
        all_data[name] = entry
    return jsonify({"skills": all_data, "owned_names": list(owned.keys()), "coins": player.get("coins", 0)})

@app.route("/api/skills/buy", methods=["POST"])
@login_required
def api_skills_buy():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    skill_name = request.json.get("skill", "").strip()
    if not skill_name:
        return jsonify({"success": False, "error": "No skill specified."})
    from game_logic import buy_skill
    success, msg = buy_skill(player, skill_name)
    if success:
        save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": success, "error": msg if not success else None, "message": msg if success else None})

@app.route("/api/skills/upgrade", methods=["POST"])
@login_required
def api_skills_upgrade():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    skill_name = request.json.get("skill", "").strip()
    if not skill_name:
        return jsonify({"success": False, "error": "No skill specified."})
    from game_logic import upgrade_skill
    success, msg = upgrade_skill(player, skill_name)
    if success:
        save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": success, "error": msg if not success else None, "message": msg if success else None})

@app.route("/skills")
@app.route("/temple")
@app.route("/guild")
@app.route("/jobs")
@app.route("/blacksmith")
@app.route("/auction")
@app.route("/lucky-roll")
@login_required
def placeholder_pages():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    path = request.path.strip("/")
    template_map = {
        "temple": "temple.html", "duels": "duels.html", "skills": "skills.html",
        "guild": "guild.html", "jobs": "jobs.html", "blacksmith": "blacksmith.html",
        "auction": "auction.html", "lucky-roll": "lucky-roll.html",
    }
    tmpl = template_map.get(path, "coming_soon.html")
    return render_template(tmpl, player=player, username=session.get("username", "Player"),
        avatar_url=get_avatar_url(session.get("user_id", ""), ""), now=time.time())

@app.route("/robots.txt")
def robots_txt():
    robots = """User-agent: *
Allow: /
Disallow: /api/
Disallow: /callback
Disallow: /dashboard
Disallow: /adventure
Disallow: /inventory
Disallow: /settings
Disallow: /pet
Disallow: /mail
Disallow: /tower
Disallow: /dungeon
Disallow: /temple
Disallow: /skills
Disallow: /guild
Disallow: /jobs
Disallow: /blacksmith
Disallow: /auction
Disallow: /lucky-roll
Disallow: /shop
Disallow: /story
Disallow: /updates
Disallow: /achievements
Disallow: /roles
Disallow: /otp
Disallow: /setup
Disallow: /logout

Sitemap: https://adventure.ankitgupta.com.np/sitemap.xml
"""
    return Response(robots, mimetype="text/plain")

@app.route("/sitemap.xml")
def sitemap_xml():
    pages = [
        ("/", "1.0", "daily"),
        ("/login", "0.8", "monthly"),
        ("/register", "0.8", "monthly"),
        ("/leaderboard", "0.6", "daily"),
    ]
    urls = "\n".join(
        f"  <url>\n    <loc>https://adventure.ankitgupta.com.np{p}</loc>\n"
        f"    <priority>{pri}</priority>\n    <changefreq>{freq}</changefreq>\n  </url>"
        for p, pri, freq in pages
    )
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{urls}
</urlset>
"""
    return Response(xml, mimetype="application/xml")

@app.route("/")
@app.route("/")
def index():
    if "user_id" not in session:
        return redirect(url_for("login"))
    return redirect(url_for("dashboard"))

@app.route("/login")
def login():
    if "user_id" in session:
        return redirect(url_for("dashboard"))
    return render_template("login.html")

@app.route("/api/login", methods=["POST"])
def api_login():
    """Username + password login, then email OTP verification."""
    username = request.form.get("username", "").strip()
    password = request.form.get("password", "")
    if not username or not password:
        return render_template("login.html", error="Username and password are required.")
    found = find_player_by_username(username)
    if not found or not found[2].get("password_hash") or not check_password_hash(found[2]["password_hash"], password):
        return render_template("login.html", error="Invalid username or password.")
    gid, uid, p = found
    email = p.get("email", "").strip()
    if not email:
        return render_template("login.html", error="No email on file for this account. Log in with Discord to add one.")
    code = f"{random.randint(0, 999999):06d}"
    session["otp"] = code
    session["otp_exp"] = time.time() + 300
    session["otp_tries"] = 0
    session["pending_gid"] = gid
    session["pending_uid"] = uid
    try:
        send_otp_email(email, code)
    except Exception as e:
        session.pop("otp", None)
        return render_template("login.html", error=f"Could not send verification email: {e}")
    return redirect(url_for("otp_page"))

@app.route("/otp", methods=["GET", "POST"])
def otp_page():
    """Verify the emailed code to finish password login."""
    if "otp" not in session:
        return redirect(url_for("login"))
    gid = session.get("pending_gid")
    uid = session.get("pending_uid")
    p = get_player(gid, uid)
    email = p.get("email", "")
    error = None
    if request.method == "POST":
        code = request.form.get("code", "").strip()
        if time.time() > session.get("otp_exp", 0):
            session.pop("otp", None)
            error = "Code expired. Log in again."
        elif code != session.get("otp"):
            session["otp_tries"] = session.get("otp_tries", 0) + 1
            if session["otp_tries"] >= 5:
                session.pop("otp", None)
                error = "Too many wrong attempts. Log in again."
            else:
                error = "Wrong code. Try again."
        else:
            session["user_id"] = uid
            session["guild_id"] = gid
            session["username"] = p.get("name") or p.get("username") or uid
            session["avatar"] = p.get("avatar", "")
            p["online"] = True
            p["last_seen"] = time.time()
            save_player(gid, uid, p)
            for k in ("otp", "otp_exp", "otp_tries", "pending_gid", "pending_uid"):
                session.pop(k, None)
            return redirect(url_for("dashboard"))
    return render_template("otp.html", error=error, email_masked=_mask_email(email))

@app.route("/api/resend_otp", methods=["POST"])
def resend_otp():
    if "otp" not in session or "pending_uid" not in session:
        return redirect(url_for("login"))
    p = get_player(session.get("pending_gid"), session.get("pending_uid"))
    email = p.get("email", "")
    if not email:
        return redirect(url_for("login"))
    code = f"{random.randint(0, 999999):06d}"
    session["otp"] = code
    session["otp_exp"] = time.time() + 300
    session["otp_tries"] = 0
    try:
        send_otp_email(email, code)
    except Exception:
        pass
    return redirect(url_for("otp_page"))

@app.route("/setup")
def setup_page():
    """First-time Discord logins pick a username, email and password here."""
    if "user_id" not in session:
        return redirect(url_for("login"))
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    if player.get("password_hash"):
        return redirect(url_for("dashboard"))
    return render_template("setup.html", player=player, error=None)

@app.route("/api/setup", methods=["POST"])
@login_required
def api_setup():
    uid = session["user_id"]
    gid = session.get("guild_id", HOME_GUILD_ID)
    username = request.form.get("username", "").strip()
    email = request.form.get("email", "").strip().lower()
    pw = request.form.get("password", "")
    pw2 = request.form.get("confirm", "")
    player = get_player(gid, uid)
    err = None
    if not re.fullmatch(r"[A-Za-z0-9_]{3,24}", username):
        err = "Username: 3-24 characters, letters/numbers/underscore only."
    elif "@" not in email or "." not in email.split("@")[-1]:
        err = "Enter a valid email address."
    elif len(pw) < 6:
        err = "Password must be at least 6 characters."
    elif pw != pw2:
        err = "Passwords do not match."
    else:
        other = find_player_by_username(username)
        if other and f"{other[0]}_{other[1]}" != f"{gid}_{uid}":
            err = "That username is already taken."
    if err:
        return render_template("setup.html", player=player, error=err)
    player["username"] = username
    player["username_lower"] = username.lower()
    player["email"] = email
    player["password_hash"] = generate_password_hash(pw)
    save_player(gid, uid, player)
    return redirect(url_for("dashboard"))

def _new_user_id():
    """Generate a unique numeric user id for accounts created without Discord."""
    existing = set(load_players().keys())
    while True:
        uid = str(secrets.randbelow(10**18) + 10**17)  # 18 digits
        if f"{HOME_GUILD_ID}_{uid}" not in existing:
            return uid

@app.route("/register")
def register_page():
    """Self-service account creation (no Discord needed)."""
    if "user_id" in session:
        return redirect(url_for("dashboard"))
    return render_template("register.html", error=None)

@app.route("/api/register", methods=["POST"])
def api_register():
    """Create a new account, then email OTP verification."""
    if "user_id" in session:
        return redirect(url_for("dashboard"))
    username = request.form.get("username", "").strip()
    email = request.form.get("email", "").strip().lower()
    pw = request.form.get("password", "")
    pw2 = request.form.get("confirm", "")
    err = None
    if not re.fullmatch(r"[A-Za-z0-9_]{3,24}", username):
        err = "Username: 3-24 characters, letters/numbers/underscore only."
    elif "@" not in email or "." not in email.split("@")[-1]:
        err = "Enter a valid email address."
    elif len(pw) < 6:
        err = "Password must be at least 6 characters."
    elif pw != pw2:
        err = "Passwords do not match."
    elif find_player_by_username(username):
        err = "That username is already taken."
    if err:
        return render_template("register.html", error=err)
    uid = _new_user_id()
    p = get_player(HOME_GUILD_ID, uid)
    p["name"] = username
    p["username"] = username
    p["username_lower"] = username.lower()
    p["email"] = email
    p["password_hash"] = generate_password_hash(pw)
    save_player(HOME_GUILD_ID, uid, p)
    code = f"{random.randint(0, 999999):06d}"
    session["otp"] = code
    session["otp_exp"] = time.time() + 300
    session["otp_tries"] = 0
    session["pending_gid"] = HOME_GUILD_ID
    session["pending_uid"] = uid
    try:
        send_otp_email(email, code)
    except Exception as e:
        session.pop("otp", None)
        session.pop("pending_uid", None)
        return render_template("register.html", error=f"Could not send verification email: {e}")
    return redirect(url_for("otp_page"))

@app.route("/login/discord")
def login_discord():
    """Redirect user to Discord OAuth authorization page."""
    state = secrets.token_urlsafe(32)
    session["oauth_state"] = state
    params = urllib.parse.urlencode({
        "client_id": DISCORD_CLIENT_ID,
        "redirect_uri": DISCORD_REDIRECT_URI,
        "response_type": "code",
        "scope": "identify",
        "state": state,
    })
    return redirect(f"https://discord.com/oauth2/authorize?{params}")

@app.route("/callback")
def callback():
    """Handle Discord OAuth callback."""
    # Validate state to prevent CSRF
    if request.args.get("state") != session.pop("oauth_state", None):
        return render_template("login.html", error="Security validation failed. Please try again.")

    code = request.args.get("code")
    if not code:
        error = request.args.get("error_description", "Authorization failed.")
        return render_template("login.html", error=error)

    try:
        # Exchange code for token
        token_data = discord_token_exchange(code)
        access_token = token_data["access_token"]

        # Get user profile from Discord
        user = discord_get_user(access_token)
        user_id = user["id"]
        username = user.get("username", f"User{user_id[-4:]}")
        avatar_hash = user.get("avatar", "")
        global_name = user.get("global_name", username)

        # Already logged in → LINK Discord to current player instead of switching
        if session.get("user_id"):
            cur_uid = str(session["user_id"])
            for pid, pl in load_players().items():
                if str(pl.get("discord_id", "")) == user_id and pid != f"{HOME_GUILD_ID}_{cur_uid}":
                    return render_template("login.html", error="That Discord account is already linked to another player.")
            cur = get_player(HOME_GUILD_ID, cur_uid)
            cur["discord_id"] = user_id
            cur["discord_username"] = username
            cur["avatar"] = avatar_hash  # keep Discord photo synced
            cur["online"] = True
            cur["last_seen"] = time.time()
            save_player(HOME_GUILD_ID, cur_uid, cur)
            flash("🔗 Discord account linked! You can now log in with it.", "success")
            return redirect(url_for("dashboard"))

        # Logged out: find player by discord_id link, then legacy discord-uid key
        linked_uid = None
        for pid, pl in load_players().items():
            if str(pl.get("discord_id", "")) == user_id:
                linked_uid = pid.split("_", 1)[1]
                break
        if linked_uid is None and f"{HOME_GUILD_ID}_{user_id}" in load_players():
            linked_uid = user_id

        if linked_uid:
            user_id = linked_uid
            player = get_player(HOME_GUILD_ID, user_id)
            session["user_id"] = user_id
            session["guild_id"] = HOME_GUILD_ID
            session["username"] = player.get("username") or player.get("name") or global_name
            session["avatar"] = player.get("avatar", avatar_hash)
            if player.get("avatar") != avatar_hash:
                player["avatar"] = avatar_hash  # refresh photo if Discord avatar changed
            player["online"] = True
            player["last_seen"] = time.time()
            save_player(HOME_GUILD_ID, user_id, player)
            return redirect(url_for("dashboard"))

        # Brand-new Discord user: create profile + first-time setup
        session["user_id"] = user_id
        session["guild_id"] = HOME_GUILD_ID
        session["username"] = global_name
        session["avatar"] = avatar_hash
        player = get_player(HOME_GUILD_ID, user_id)
        player["name"] = global_name
        player["online"] = True
        player["last_seen"] = time.time()
        if not player.get("class_name"):
            from game_logic import assign_starter
            assign_starter(player)
        save_player(HOME_GUILD_ID, user_id, player)

        # First-time Discord login: require username/email/password setup
        if not player.get("password_hash"):
            return redirect(url_for("setup_page"))

        return redirect(url_for("dashboard"))
    except Exception as e:
        return render_template("login.html", error=f"Login failed: {e}")

@app.route("/logout")
def logout():
    # Mark player as offline
    if "user_id" in session:
        player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
        player["online"] = False
        player["last_seen"] = time.time()
        save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    session.clear()
    return redirect(url_for("login"))

@app.route("/dashboard")
@login_required
def dashboard():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    player["online"] = True
    player["last_seen"] = time.time()
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    
    xp_needed = xp_for_level(player["level"])
    xp_percent = min(100, int((player["xp"] / xp_needed) * 100))
    hp_percent = min(100, int((player["health"] / player["max_health"]) * 100)) if player["max_health"] > 0 else 0
    
    roles_data = load_roles()
    player_role = player.get("role")
    role_info = roles_data["roles"].get(player_role, None) if player_role else None
    available_roles = []
    if not player_role:
        # Show roles the player can choose from based on level
        for rid, rinfo in roles_data["roles"].items():
            if player["level"] >= rinfo["min_level"]:
                available_roles.append({"id": rid, **rinfo})
    
    duel_rank_emoji = get_rank_emoji(player.get("duel_rank", "Rookie"))

    def eq_name(eq):
        if not eq: return "—"
        if isinstance(eq, dict): return eq.get("name", "—")
        # string ID — pretty-print it
        return str(eq).replace("_", " ").title()
    equipped_slots = {
        "head":   eq_name(player.get("equipped_helmet")),
        "weapon": eq_name(player.get("equipped_weapon")),
        "armor":  eq_name(player.get("equipped_armor")),
        "boots":  eq_name(player.get("equipped_boots")),
    }

    # Tower Master rank: each ten-floor section advances 1 of 10 ranks.
    highest_floor = max(1, int(player.get("highest_floor", player.get("tower_floor", 1)) or 1))
    master_rank = min(10, ((highest_floor - 1) // 10) + 1)
    master_names = ["Warlord", "Vanguard", "Conqueror", "High Marshal", "Overlord",
                    "Ascendant", "Paragon", "Sovereign", "Immortal", "Eternal"]
    master_title = master_names[master_rank - 1]

    # Global level leaderboard position (stable tie-break: kills, then name).
    all_players = list(load_players().values())
    ranked = sorted(all_players,
                    key=lambda p: (int(p.get("level", 0)), int(p.get("monsters_killed", 0)),
                                   str(p.get("name", ""))), reverse=True)
    player_key = str(player.get("user_id", session["user_id"]))
    leaderboard_position = next((i + 1 for i, p in enumerate(ranked)
                                 if str(p.get("user_id", "")) == player_key), 0)

    second_level = max(1, int(player.get("second_class_level", 1) or 1))
    second_xp = max(0, int(player.get("second_class_xp", 0) or 0))
    second_xp_needed = max(20, second_level * 20)
    circle = min(7, ((second_level - 1) // 5) + 1)
    roman = ["I", "II", "III", "IV", "V", "VI", "VII"][circle - 1]

    return render_template(
        "dashboard.html",
        player=player, xp_needed=xp_needed, xp_percent=xp_percent,
        hp_percent=hp_percent, username=session.get("username", "Player"),
        avatar_url=session_avatar(session),
        role_info=role_info, available_roles=available_roles, roles_data=roles_data,
        duel_rank_emoji=duel_rank_emoji, equipped_slots=equipped_slots,
        master_rank=master_rank, master_title=master_title,
        leaderboard_position=leaderboard_position, leaderboard_total=len(ranked),
        second_xp=second_xp, second_xp_needed=second_xp_needed,
        second_level=second_level, second_circle=roman
    )

@app.route("/adventure")
@login_required
def adventure_page():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    available = [loc for loc in ADVENTURE_LOCATIONS if loc["min_level"] <= player["level"]]
    return render_template(
        "adventure.html", player=player,
        locations=available, username=session.get("username", "Player"),
        avatar_url=session_avatar(session),
        adventure_auto_until=float(player.get("adventure_auto_until", 0) or 0),
    )

ADVENTURE_AUTO_COST = 5000
ADVENTURE_AUTO_SECONDS = 60 * 60


@app.route("/api/adventure/auto", methods=["POST"])
@login_required
def buy_adventure_auto():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    now = time.time()
    active_until = float(player.get("adventure_auto_until", 0) or 0)
    if active_until > now:
        return jsonify({
            "error": "Auto Boss Grind is already active.",
            "active_until": active_until,
            "remaining": int(active_until - now),
        }), 400
    if player.get("coins", 0) < ADVENTURE_AUTO_COST:
        return jsonify({"error": "Not enough coins! Need 5,000."}), 400

    player["coins"] -= ADVENTURE_AUTO_COST
    player["adventure_auto_until"] = now + ADVENTURE_AUTO_SECONDS
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({
        "success": True,
        "message": "Auto Boss Grind active for 1 hour. Keep this Adventure tab open.",
        "active_until": player["adventure_auto_until"],
        "remaining": ADVENTURE_AUTO_SECONDS,
        "balance": player["coins"],
    })


@app.route("/api/adventure", methods=["POST"])
@login_required
def api_adventure():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    calc_stats(player)
    now = time.time()
    payload = request.get_json(silent=True) or {}
    auto_fight = payload.get("auto") is True
    if auto_fight and float(player.get("adventure_auto_until", 0) or 0) <= now:
        return jsonify({"error": "Auto Boss Grind expired.", "auto_expired": True}), 403
    if now - player.get("last_adventure", 0) < 3:
        return jsonify({"error": f"Cooldown! Wait {int(3 - (now - player.get('last_adventure', 0)))}s"}), 429

    available = [loc for loc in ADVENTURE_LOCATIONS if loc["min_level"] <= player["level"]]
    if not available:
        return jsonify({"error": "No locations available"}), 400

    location = random.choice(available)
    is_boss = auto_fight or random.random() < location["boss_chance"]
    enemy = location["boss"].copy() if is_boss else random.choice(location["monsters"]).copy()
    enemy["is_boss"] = is_boss

    player_atk = player["attack"]
    player_def = player["defense"]
    for eq in [player.get("equipped_weapon"), player.get("equipped_armor"),
               player.get("equipped_helmet"), player.get("equipped_shield")]:
        if isinstance(eq, dict):
            player_atk += eq.get("stats", {}).get("attack", 0)
            player_def += eq.get("stats", {}).get("defense", 0)

    e_hp = enemy["hp"]
    e_atk = enemy.get("atk", 5)
    e_def = enemy.get("def", 0)
    p_hp = player["health"]

    combat_log = [f"⚔️ You encounter **{enemy['name']}**!"]
    won = False
    for _ in range(50):
        dmg = max(1, player_atk - e_def // 2 + random.randint(-3, 5))
        e_hp -= dmg
        combat_log.append(f"⚔️ You hit for **{dmg}**! ({enemy['name']} ❤️{max(0, e_hp)})")
        if e_hp <= 0:
            won = True
            break
        dmg = max(1, e_atk - player_def // 2 + random.randint(-3, 5))
        p_hp -= dmg
        combat_log.append(f"💥 {enemy['name']} hits for **{dmg}**! (You ❤️{max(0, p_hp)})")
        if p_hp <= 0:
            won = False
            break

    coin_range = enemy.get("coins", [10, 20])
    coin_reward = random.randint(coin_range[0], coin_range[1]) if isinstance(coin_range, list) else coin_range
    xp_reward = enemy.get("xp", 10)
    leveled_up = False

    if won:
        player["health"] = max(1, p_hp)
        player["coins"] = player.get("coins", 0) + coin_reward
        player["xp"] = player.get("xp", 0) + xp_reward
        player["monsters_killed"] = player.get("monsters_killed", 0) + 1
        player["total_wins"] = player.get("total_wins", 0) + 1
        _bestiary_record(player, enemy["name"])
        grant_achievements(player)
        if is_boss:
            player["bosses_killed"] = player.get("bosses_killed", 0) + 1
        player["adventures_completed"] = player.get("adventures_completed", 0) + 1
        bump_mission(player, "adventure")
        bump_mission(player, "kill")
        if is_boss:
            bump_mission(player, "boss")
        bump_mission(player, "coins", coin_reward)
        combat_log.append(f"✅ **Victory!** 🪙+{coin_reward} ⭐+{xp_reward} XP")
        # Dual class earns 50% of adventure XP
        if player.get("has_second_class"):
            _grant_second_class_xp(player, xp_reward // 2, combat_log)

        from game_logic import level_up as _level_up2
        if _level_up2(player) > 0:
            leveled_up = True
        check_milestones(player)
        check_titles(player)
        if leveled_up:
            combat_log.append(f"⬆️ **LEVEL UP!** You are now Level {player['level']}!")
        # Loot drop on win
        from game_logic import roll_loot as _roll_loot2
        _adv_loot = _roll_loot2(player, source="adventure", is_boss=is_boss)
        if _adv_loot:
            combat_log.append(f"🎁 {_adv_loot}")
            loot_msg = _adv_loot
        else:
            loot_msg = ""
    else:
        player["health"] = max(0, p_hp)
        player["deaths"] = player.get("deaths", 0) + 1
        _drank, _dmsg = maybe_auto_drink(player)
        combat_log.append("❌ **Defeated!** Retreat and heal up.")
        if _drank:
            combat_log.append(_dmsg)
        # Auto Boss Grind: revive with coins so the grind never stops
        if auto_fight and player["health"] <= 0:
            revive_cost = max(50, player["level"] * 10)
            if player.get("coins", 0) >= revive_cost:
                player["coins"] -= revive_cost
                healed = player["max_health"] - player["health"]
                player["health"] = player["max_health"]
                combat_log.append(f"🪙 **Auto-revived!** Paid {revive_cost} coins (+{healed} HP) — grinding continues.")
            else:
                combat_log.append(f"🪙 Not enough coins to auto-revive (need {revive_cost}) — heal up before the next fight!")
        loot_msg = ""

    player["last_adventure"] = now
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)

    return jsonify({
        "won": won,
        "enemy": {"name": enemy["name"], "hp": enemy["hp"], "is_boss": is_boss},
        "combat_log": combat_log,
        "loot": loot_msg,
        "coins": coin_reward if won else 0,
        "xp": xp_reward if won else 0,
        "xp_total": player.get("xp", 0),
        "xp_next": xp_for_level(player.get("level", 1)),
        "leveled_up": leveled_up,
        "player": player,
    })


# ── HEARTBEAT (online status) ─────────────────────────
@app.route("/api/ping", methods=["POST"])
@login_required
def api_ping():
    """Client heartbeat — marks player online (5-min window)."""
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    now = time.time()
    # Debounce disk writes: only persist once per minute per player.
    if now - player.get("last_seen", 0) > 55:
        player["last_seen"] = now
        save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"ok": True})

# ── LUCKY SLOT MACHINE ────────────────────────────────
LUCKY_COST = 50
LUCKY_COOLDOWN = 3
LUCKY_SYMBOLS = ["🍒", "🍋", "🍇", "💎", "⭐", "👑"]
LUCKY_PAYOUT = {"🍒": 60, "🍋": 100, "🍇": 150, "💎": 300, "⭐": 500, "👑": 1000}


@app.route("/api/lucky-roll", methods=["POST"])
@login_required
def api_lucky_roll():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    now = time.time()
    last = player.get("last_lucky_roll", 0)
    if now - last < LUCKY_COOLDOWN:
        return jsonify({"error": f"Cooldown! Wait {int(LUCKY_COOLDOWN - (now - last))}s"}), 400
    if player.get("coins", 0) < LUCKY_COST:
        return jsonify({"error": "Not enough coins! Need 50."}), 400
    player["coins"] -= LUCKY_COST
    player["last_lucky_roll"] = now
    symbols = [random.choice(LUCKY_SYMBOLS) for _ in range(3)]
    won = symbols[0] == symbols[1] == symbols[2]
    coins_won = 0
    if won:
        coins_won = LUCKY_PAYOUT[symbols[0]]
        player["coins"] += coins_won
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"symbols": symbols, "won": won, "coins": coins_won, "balance": player["coins"]})


# ── CLASS ROLL (rarity-weighted) ──────────────────────
CLASS_ROLL_COST = 200
SECOND_CLASS_COST = 500
RARITY_WEIGHTS = {"common": 40, "uncommon": 30, "rare": 18, "epic": 9, "legendary": 3, "unique": 1}

# UNIQUE rank = one-of-a-kind. First claim locks it; everyone else rolls below it.
_CLAIMS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "unique_claims.json")


def _load_claims():
    try:
        with open(_CLAIMS_PATH) as f:
            return json.load(f)
    except Exception:
        return {}


def _save_claims(claims):
    with open(_CLAIMS_PATH, "w") as f:
        json.dump(claims, f, indent=2)


def _claim_unique(slot, class_name):
    """Try to claim a global-unique slot. Returns owner name if already taken."""
    claims = _load_claims()
    key = f"{slot}_{str(class_name).strip().lower()}"
    if key in claims:
        return claims[key].get("owner", "?")
    claims[key] = {"owner": session.get("username", "Unknown"), "claimed_at": time.time()}
    _save_claims(claims)
    return None


def _roll_class(exclude=None):
    from game_data import CLASSES
    pool = [c for c in CLASSES.values() if c["name"] != exclude]
    weights = [RARITY_WEIGHTS.get(c["rarity"], 10) for c in pool]
    return random.choices(pool, weights=weights, k=1)[0]


def _grant_second_class_xp(player, xp_gain, log):
    """Give dual-class XP (50% share of adventure/duel XP). Appends milestone lines to log."""
    if not player.get("has_second_class"):
        return False
    from game_logic import level_up_second_class as _lv2
    events = _lv2(player, xp_gain)
    for ev in events:
        if ev["type"] == "level":
            log.append(f"🔀 **Dual Class reached Lv.{ev['level']}!**")
        elif ev["type"] == "rarity":
            log.append(f"🔀 **{player['second_class_name']} upgraded to {ev['rarity'].upper()}!**")
        elif ev["type"] == "unique_claim":
            owner = _claim_unique("second", ev["class_name"])
            if owner is None or owner == session.get("username"):
                player["second_class_rarity"] = "unique"
                log.append(f"👑 **UNIQUE! {ev['class_name']} is now one-of-a-kind!**")
            else:
                player["second_class_rarity"] = "legendary"
                log.append(f"⚠️ Unique {ev['class_name']} already claimed by {owner} — stays LEGENDARY.")
    log.append(f"🔀 Dual class gained ⭐+{max(1, int(xp_gain))} XP")
    return True


def _apply_class(player, c):
    player["class_name"] = c["name"]
    player["class_emoji"] = c["emoji"]
    player["class_rarity"] = c["rarity"]
    player["base_hp"] = c["base_hp"]
    player["base_atk"] = c["base_atk"]
    player["base_def"] = c["base_def"]
    player["base_spd"] = c["base_spd"]
    from game_logic import calc_stats
    calc_stats(player)
    player["hp"] = player["max_hp"]


@app.route("/api/class-roll", methods=["POST"])
@login_required
def api_class_roll():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    if player.get("coins", 0) < CLASS_ROLL_COST:
        return jsonify({"error": "Not enough coins! Need 200."}), 400
    player["coins"] -= CLASS_ROLL_COST
    # Roll until we land a class that isn't a taken UNIQUE (max 15 tries)
    c = None
    for _ in range(15):
        cand = _roll_class()
        if cand["rarity"] != "unique" or _claim_unique("class", cand["name"]) is None:
            c = cand
            break
    if c is None:
        c = _roll_class()
    _apply_class(player, c)
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({
        "success": True, "class_emoji": c["emoji"], "class_name": c["name"],
        "class_rarity": c["rarity"], "hp": player["max_hp"], "atk": player["atk"],
        "def": player["def"], "spd": player["spd"], "coins": player["coins"],
    })


@app.route("/api/second-class-roll", methods=["POST"])
@login_required
def api_second_class_roll():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    if player.get("has_second_class"):
        return jsonify({"error": "You already have a dual class!"}), 400
    if player.get("coins", 0) < SECOND_CLASS_COST:
        return jsonify({"error": "Not enough coins! Need 500."}), 400
    player["coins"] -= SECOND_CLASS_COST
    # Roll until we land a class that isn't a taken UNIQUE (max 15 tries)
    c = None
    for _ in range(15):
        cand = _roll_class(exclude=player.get("class_name"))
        if cand["rarity"] != "unique" or _claim_unique("second", cand["name"]) is None:
            c = cand
            break
    if c is None:
        c = _roll_class(exclude=player.get("class_name"))
    player["second_class_name"] = c["name"]
    player["second_class_emoji"] = c["emoji"]
    player["second_class_rarity"] = c["rarity"]
    player["second_class_level"] = 1
    player["second_class_xp"] = 0
    player["second_base_hp"] = c["base_hp"]
    player["second_base_atk"] = c["base_atk"]
    player["second_base_def"] = c["base_def"]
    player["second_base_spd"] = c["base_spd"]
    player["has_second_class"] = True
    from game_logic import calc_stats
    calc_stats(player)
    player["hp"] = player["max_hp"]
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({
        "success": True, "class_emoji": c["emoji"], "class_name": c["name"],
        "class_rarity": c["rarity"], "max_health": player["max_hp"], "atk": player["atk"],
        "def": player["def"], "spd": player["spd"], "coins": player["coins"],
    })


# ── SHOP BUY ──────────────────────────────────────────
DEFAULT_SHOP_ITEMS = [
    {"name": "Iron Sword", "rarity": "unique", "category": "weapon", "price": 300, "attack": 5, "defense": 0, "bonus_hp": 0},
    {"name": "Steel Armor", "rarity": "rare", "category": "armor", "price": 400, "attack": 0, "defense": 8, "bonus_hp": 20},
    {"name": "Wooden Shield", "rarity": "common", "category": "armor", "price": 80, "attack": 0, "defense": 3, "bonus_hp": 0},
    {"name": "Mystic Helmet", "rarity": "legendary", "category": "head", "price": 800, "attack": 3, "defense": 4, "bonus_hp": 30},
    {"name": "Leather Boots", "rarity": "common", "category": "boots", "price": 60, "attack": 0, "defense": 2, "bonus_hp": 5},
    {"name": "Shadow Dagger", "rarity": "rare", "category": "weapon", "price": 350, "attack": 8, "defense": 0, "bonus_hp": 0},
]

_SHOP_TYPE_MAP = {"weapon": "weapon", "armor": "armor", "head": "helmet", "boots": "boots"}
_SHOP_ICON = {"weapon": "⚔️", "armor": "🛡️", "head": "⛑️", "boots": "👢", "misc": "📦", "potion": "🧪", "egg": "🥚"}
_SHOP_SUBCAT = {"weapon": "WEAPON", "armor": "ARMOR", "head": "HELMET", "boots": "BOOTS", "misc": "ACCESSORY", "potion": "POTION"}

# 🥚 Pet eggs sold in the web shop — hatching yields a random pet of the egg's
# rolled rarity with a random level. Golden Egg guarantees rare-or-better.
_EGG_SHOP_ITEMS = [
    {"name": "Mystery Egg", "rarity": "common", "category": "egg", "subcat": "EGG",
     "roles": None, "price": 200, "attack": 0, "defense": 0, "bonus_hp": 0, "heal": 0},
    {"name": "Golden Egg", "rarity": "rare", "category": "egg", "subcat": "EGG",
     "roles": None, "price": 1000, "attack": 0, "defense": 0, "bonus_hp": 0, "heal": 0},
]


def _shop_with_eggs(items):
    """Guarantee pet eggs are always sold, even if guild_shops.json lacks them."""
    items = list(items or [])
    if not any(str(i.get("category", "")).lower() == "egg" for i in items):
        items = _EGG_SHOP_ITEMS + items
    return items

# ── Shop gacha ── every purchase rolls a rarity (same odds as class roll) ──
_SHOP_RARITY_W = [("common", 45), ("uncommon", 30), ("rare", 15), ("epic", 8), ("legendary", 2), ("unique", 0.5)]
_SHOP_RARITY_MULT = {"common": 0.4, "uncommon": 0.7, "rare": 1.0, "epic": 1.6, "legendary": 2.8, "mythic": 4.0, "unique": 5.0}

# ── Role-locked weapons ── a mage buying a sword deals 0 damage with it ──
_SHOP_WEAPON_ROLES = {
    "mage":    ("staff", "scepter", "wand", "orb", "tome", "rod"),
    "ranger":  ("bow", "crossbow", "longbow", "shortbow"),
    "heavy":   ("hammer", "doomhammer", "axe", "maul", "cleaver"),
    "assassin": ("dagger", "sting", "claw", "shiv", "kunai"),
}
_SHOP_ROLE_IDS = {
    "mage": ["mage", "archmage"],
    "ranger": ["ranger"],
    "heavy": ["berserker", "paladin", "warlord"],
    "assassin": ["assassin"],
    "melee": ["swordmaster", "berserker", "paladin", "assassin"],  # swords & blades
}

_SHOP_CAT_HINTS = (
    ("weapon", ("sword", "blade", "dagger", "staff", "scepter", "talon", "fang", "edge",
                "reaper", "hammer", "katana", "trident", "crescent", "slayer", "fury", "wrath",
                "excalibur", "doomhammer", "axe", "bow", "sting", "wand", "orb", "rod", "tome",
                "maul", "cleaver", "claw", "kunai", "crossbow")),
    ("armor",  ("armor", "plate", "mantle", "cloak", "robe", "aegis", "shield", "guard",
                "chainmail", "vest", "coat", "raiment", "cuirass", "bulwark", "bark",
                "barrier", "aegis", "skin")),
    ("head",   ("helmet", "crown", "monarch", "circlet", "viser", "visor", "hood", "mask")),
    ("boots",  ("boots", "greaves", "sandals", "treads")),
    ("potion", ("potion", "elixir", "flask", "brew", "mixture", "nectar", "lure", "essence",
                "tonic")),
)


def _normalize_shop_items():
    """Flatten guild_shops.json (all guilds) into web shop items.
    Auto-picks up every new item the bot adds via shop updates."""
    out = {}
    try:
        for gid, shop in load_shops().items():
            if isinstance(shop, list):
                stack = list(shop)
            elif isinstance(shop, dict):
                stack = list(shop.values())
            else:
                continue
            while stack:
                v = stack.pop()
                if isinstance(v, dict):
                    if "name" in v and "price" in v:
                        it = v
                        name = re.sub(r"^[^\w\s]+", "", str(it.get("name", ""))).strip()
                        if not name or name in out:
                            continue
                        desc = str(it.get("desc", ""))
                        m_atk = re.search(r"\+(\d+)\s*ATK", desc)
                        m_def = re.search(r"\+(\d+)\s*DEF", desc)
                        m_hp  = re.search(r"\+(\d+)\s*HP", desc)
                        attack = int(it.get("attack", 0) or 0) or (int(m_atk.group(1)) if m_atk else 0)
                        defense = int(m_def.group(1)) if m_def else 0
                        bonus_hp = int(m_hp.group(1)) if m_hp else 0
                        price = int(it.get("price", 0) or 0)
                        low = name.lower()
                        category = "misc"
                        for cat, hints in _SHOP_CAT_HINTS:
                            if any(h in low for h in hints):
                                category = cat
                                break
                        if category == "misc" and (m_def or m_hp):
                            category = "armor"
                        rarity = ("common" if price < 100 else "uncommon" if price < 300
                                  else "rare" if price < 700 else "epic" if price < 1500
                                  else "legendary" if price < 100000 else "mythical" if price < 500000
                                  else "unique")
                        # Canonical ladder uses "mythic"; the bot cache historically
                        # wrote "mythical". Normalize so VIP/forge/multiplier agree.
                        rarity = "mythic" if rarity == "mythical" else rarity
                        # Keep starter goods affordable while premium tiers retain value.
                        price = min(price, {"common": 300, "uncommon": 600, "rare": 900,
                                            "epic": 1800, "legendary": 15000,
                                            "mythic": 50000, "unique": 125000}[rarity])
                        roles = None
                        if category == "weapon":
                            roles = _SHOP_ROLE_IDS["melee"]
                            for rk, rh in _SHOP_WEAPON_ROLES.items():
                                if any(h in low for h in rh):
                                    roles = _SHOP_ROLE_IDS[rk]
                                    break
                        out[name] = {"name": name, "rarity": rarity, "category": category,
                                     "subcat": _SHOP_SUBCAT.get(category, category.upper()),
                                     "roles": roles, "price": price, "attack": attack,
                                     "defense": defense, "bonus_hp": bonus_hp,
                                     "heal": int(it.get("heal", 0) or 0),
                                     "xp_boost": int(it.get("xp_boost", 0) or 0)}
                    else:
                        stack.extend(v.values())
                elif isinstance(v, list):
                    stack.extend(v)
    except Exception:
        pass
    return list(out.values())


@app.route("/api/shop/buy", methods=["POST"])
@login_required
def api_shop_buy():
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("item_name", "")).strip()
    if not name:
        return jsonify({"error": "Item name required."}), 400
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    store = str(payload.get("store", "normal")).lower()
    if store not in SHOP_TIER_RARITIES:
        return jsonify({"error": "Unknown store."}), 400
    if store != "normal" and float(player.get(f"{store}_shop_until", 0) or 0) <= time.time():
        return jsonify({"error": f"Active {store.title()} Store access required."}), 403
    items, _ = _effective_shop_items(store)
    item = next((i for i in items if i.get("name", "").lower() == name.lower()), None)
    if not item:
        return jsonify({"error": "Item not in this store."}), 400
    price = item.get("price", 0)
    if player.get("coins", 0) < price:
        return jsonify({"error": f"Insufficient coins! Need {price}."}), 400
    player["coins"] -= price
    bump_mission(player, "shop")
    category = item.get("category", "misc")
    rolled = str(item.get("rarity", "common")).lower()
    if category == "egg":
        # 🥚 Egg purchase — hatch it on the Pets page for a random-level pet.
        if name.lower() == "golden egg" and rolled in ("common", "uncommon"):
            rolled = random.choices(["rare", "epic", "legendary", "unique"],
                                    [55, 30, 12, 3])[0]
        inv_item = {"name": f"{rolled.title()} Egg", "type": "egg", "icon": "🥚",
                    "rarity": rolled, "id": f"egg_{int(random.random() * 1e9)}",
                    "stats": {}}
        player.setdefault("inventory", []).append(inv_item)
        player["shop_purchases"] = player.get("shop_purchases", 0) + 1
        save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
        return jsonify({"success": True, "item": inv_item, "rolled_rarity": rolled,
                        "coins": player["coins"],
                        "message": f"🥚 Bought a {rolled.title()} Egg! Hatch it on the Pets page."})
    mult = _SHOP_RARITY_MULT[rolled]
    base = item.get("attack", 0), item.get("defense", 0), item.get("bonus_hp", 0)
    stats = {"attack": max(1, int(base[0] * mult)) if base[0] else 0,
             "defense": max(1, int(base[1] * mult)) if base[1] else 0,
             "hp": max(1, int(base[2] * mult)) if base[2] else 0}
    if category == "potion" and (item.get("heal") or item.get("xp_boost")):
        # 🧪 Potions heal and/or grant XP — rarity gacha scales the effect.
        # Hybrids carry BOTH keys; keep both or the second effect is lost.
        stats = {}
        if item.get("heal"):
            stats["heal"] = max(1, int(item["heal"] * mult))
        if item.get("xp_boost"):
            stats["xp"] = max(1, int(item["xp_boost"] * mult))
    inv_item = {
        "name": item.get("name"), "type": _SHOP_TYPE_MAP.get(category, category),
        "icon": _SHOP_ICON.get(category, "📦"), "rarity": rolled,
        "roles": item.get("roles"),
        "id": f"shop_{int(random.random() * 1e9)}",
        "stats": stats,
    }
    player.setdefault("inventory", []).append(inv_item)
    player["shop_purchases"] = player.get("shop_purchases", 0) + 1
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "item": inv_item, "rolled_rarity": rolled,
                    "coins": player["coins"]})


# ── PLAYER LIST (duels) ───────────────────────────────
@app.route("/api/players")
@login_required
def api_players():
    players = load_players()
    me = session.get("user_id")
    out = []
    for key, p in players.items():
        if p.get("user_id") == me:
            continue
        out.append({
            "user_id": p.get("user_id"), "username": p.get("name") or "Unknown",
            "name": p.get("name") or "Unknown", "level": p.get("level", 1),
            "coins": p.get("coins", 0), "last_seen": p.get("last_seen", 0),
            "class_emoji": p.get("class_emoji", "⚔️"), "class_name": p.get("class_name", "Adventurer"),
            "avatar": get_player_avatar(p),
        })
    return jsonify({"players": out})


@app.route("/api/sell", methods=["POST"])
@login_required
def api_sell():
    payload = request.get_json(silent=True) or {}
    item_id = str(payload.get("item_id", "")).lower()
    if not item_id:
        return jsonify({"error": "item_id is required."}), 400
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])

    eq_w = player.get("equipped_weapon")
    eq_a = player.get("equipped_armor")
    eq_h = player.get("equipped_helmet")
    eq_s = player.get("equipped_shield")
    eq_b = player.get("equipped_boots")

    def matches_id(eq_item, target_id):
        if not eq_item: return False
        if isinstance(eq_item, dict):
            return eq_item.get("id", eq_item.get("name", "").lower().replace(" ", "_")) == target_id
        return str(eq_item).lower() == target_id

    if (matches_id(eq_w, item_id) or matches_id(eq_a, item_id) or
            matches_id(eq_h, item_id) or matches_id(eq_s, item_id) or
            matches_id(eq_b, item_id)):
        return jsonify({"error": "Cannot sell an equipped item! Unequip it first."}), 400

    inventory = player.get("inventory", [])
    found_idx = -1
    sell_value = SELL_PRICES["common"]
    item_name = "Item"

    for i, item in enumerate(inventory):
        if isinstance(item, dict):
            curr_id = item.get("id", item.get("name", "").lower().replace(" ", "_"))
            if curr_id == item_id:
                found_idx = i
                item_name = item.get("name", "Item")
                rarity = item.get("rarity", "common").lower()
                sell_value = SELL_PRICES.get(rarity, SELL_PRICES["common"])
                break
        else:
            if str(item).lower() == item_id:
                found_idx = i
                item_name = str(item)
                break

    if found_idx == -1:
        return jsonify({"error": "Item not found in inventory."}), 400

    # Remove item and add coins
    inventory.pop(found_idx)
    player["inventory"] = inventory
    player["coins"] = player.get("coins", 0) + sell_value
    bump_mission(player, "sell")
    bump_mission(player, "coins", sell_value)

    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "message": f"Sold {item_name} for {sell_value} coins!"})

@app.route("/api/equip", methods=["POST"])
@login_required
def api_equip():
    item_id = request.json.get("item_id", "").lower()
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    
    eq_w = player.get("equipped_weapon")
    eq_a = player.get("equipped_armor")
    eq_h = player.get("equipped_helmet")
    eq_s = player.get("equipped_shield")
    eq_b = player.get("equipped_boots")
    
    def matches_id(eq_item, target_id):
        if not eq_item: return False
        if isinstance(eq_item, dict):
            return eq_item.get("id", eq_item.get("name", "").lower().replace(" ", "_")) == target_id
        return str(eq_item).lower() == target_id
        
    # UNEQUIP LOGIC
    if matches_id(eq_w, item_id):
        player["equipped_weapon"] = None
        save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
        return jsonify({"success": True, "message": "Unequipped weapon!"})
    if matches_id(eq_a, item_id):
        player["equipped_armor"] = None
        save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
        return jsonify({"success": True, "message": "Unequipped armor!"})
    if matches_id(eq_h, item_id):
        player["equipped_helmet"] = None
        save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
        return jsonify({"success": True, "message": "Unequipped helmet!"})
    if matches_id(eq_s, item_id):
        player["equipped_shield"] = None
        save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
        return jsonify({"success": True, "message": "Unequipped shield!"})
    if matches_id(eq_b, item_id):
        player["equipped_boots"] = None
        save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
        return jsonify({"success": True, "message": "Unequipped boots!"})

    # DRINK POTION — heal/consume instead of equip
    inventory = player.get("inventory", [])
    for item in inventory:
        if not isinstance(item, dict):
            continue
        curr_id = item.get("id", item.get("name", "").lower().replace(" ", "_"))
        if curr_id != item_id:
            continue
        item_type = str(item.get("type", "weapon")).lower()
        heal_amt = potion_heal_amount(item)
        xp_amt = int(item.get("stats", {}).get("xp", 0) or 0)
        # Potions may carry heal, xp, or BOTH. potion_heal_amount() falls back to a
        # default heal for any potion, so an xp-only potion would otherwise be caught
        # by the heal branch and silently lose its XP. Handle combined effects first.
        if "potion" in item_type and xp_amt > 0:
            has_heal = int((item.get("stats") or {}).get("heal", 0) or 0) > 0
            calc_stats(player)
            healed = 0
            if has_heal:
                healed = min(player["max_health"], player["health"] + heal_amt) - player["health"]
                player["health"] = min(player["max_health"], player["health"] + heal_amt)
            player["xp"] = player.get("xp", 0) + xp_amt
            inventory.remove(item)
            player["inventory"] = inventory
            from game_logic import level_up as _level_up_hybrid
            levels = _level_up_hybrid(player)
            save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
            msg = f"🧪 Drank {item.get('name', 'Potion')}!"
            if healed:
                msg += f" Restored {healed} HP."
            msg += f" Gained {xp_amt:,} XP."
            if levels:
                msg += f" Leveled up to {player.get('level')}!"
            return jsonify({"success": True, "message": msg})
        if "potion" in item_type and heal_amt > 0:
            calc_stats(player)
            if player["health"] >= player["max_health"]:
                return jsonify({"error": "Already at full health!"}), 400
            healed = min(player["max_health"], player["health"] + heal_amt) - player["health"]
            player["health"] = min(player["max_health"], player["health"] + heal_amt)
            inventory.remove(item)
            player["inventory"] = inventory
            bump_mission(player, "heal")
            save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
            return jsonify({"success": True,
                            "message": f"🧪 Drank {item.get('name', 'Potion')}! Restored {healed} HP."})
        if "potion" in item_type and xp_amt > 0:
            player["xp"] = player.get("xp", 0) + xp_amt
            inventory.remove(item)
            player["inventory"] = inventory
            from game_logic import level_up as _level_up_potion
            levels = _level_up_potion(player)
            save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
            suffix = f" Level up ×{levels}!" if levels else ""
            return jsonify({"success": True,
                            "message": f"⭐ Drank {item.get('name', 'XP Potion')}! Gained {xp_amt} XP.{suffix}"})
        break

    # EQUIP LOGIC
    found_item = None
    inventory = player.get("inventory", [])
    
    for item in inventory:
        if isinstance(item, dict):
            curr_id = item.get("id", item.get("name", "").lower().replace(" ", "_"))
            if curr_id == item_id:
                found_item = item
                break
        else:
            if str(item).lower() == item_id:
                found_item = str(item)
                break
                
    if not found_item:
        return jsonify({"error": "Item not in inventory"}), 400

    item_type = "weapon" 
    item_name = "Item"
    
    if isinstance(found_item, dict):
        item_type = found_item.get("type", "weapon").lower()
        item_name = found_item.get("name", "Item")
    else:
        item_name = found_item
        shops = load_shops()
        gid = str(session.get("guild_id", HOME_GUILD_ID))
        shop = shops.get(gid, {})
        for w in shop.get("weapons", []):
            if w["id"] == item_id: item_type = "weapon"; item_name = w["name"]
        for a in shop.get("armor", []):
            if a["id"] == item_id: item_type = "armor"; item_name = a["name"]

    if "weapon" in item_type:
        player["equipped_weapon"] = found_item 
    elif "helmet" in item_type or "head" in item_type:
        player["equipped_helmet"] = found_item
    elif "boots" in item_type or "greaves" in item_type or "treads" in item_type:
        player["equipped_boots"] = found_item
    elif "shield" in item_type:
        player["equipped_shield"] = found_item
    elif "armor" in item_type or "chest" in item_type:
        player["equipped_armor"] = found_item
    else:
        return jsonify({"error": "This item is not equippable (Try using it in Shop or Forge)"}), 400

    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "message": f"Equipped {item_name}!"})




@app.route("/api/heal", methods=["POST"])
@login_required
def api_heal():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    calc_stats(player)
    if player["health"] >= player["max_health"]:
        return jsonify({"error": "Already at full health"}), 400
    mode = (request.get_json(silent=True) or {}).get("mode", "coins")
    if mode in ("xp", "full"):
        cost = max(50, player["level"] * 10)
        if player.get("coins", 0) < cost:
            return jsonify({"error": f"Not enough coins (need {cost})"}), 400
        player["coins"] -= cost
        healed = player["max_health"] - player["health"]
        player["health"] = player["max_health"]
        bump_mission(player, "heal")
        save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
        return jsonify({"success": True, "message": f"Fully healed (+{healed} HP) for {cost} coins!", "player": player})
    if player["coins"] < 10:
        return jsonify({"error": "Not enough coins (need 10)"}), 400
    player["coins"] -= 10
    healed = min(player["max_health"] - player["health"], 30)
    player["health"] += healed
    bump_mission(player, "heal")
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "message": f"Healed {healed} HP!", "player": player})

# ── DAILY LOGIN STREAK ────────────────────────────────
# Claims are once per 24h; a streak survives a 48h gap so one late day is forgiven.
STREAK_GRACE = 172800  # 48h
STREAK_TIERS = ((30, 2.0), (14, 1.75), (7, 1.5), (3, 1.25))

def streak_multiplier(streak):
    """Reward multiplier for a given streak length (capped at 2.0x)."""
    for days, mult in STREAK_TIERS:
        if streak >= days:
            return mult
    return 1.0

@app.route("/api/daily", methods=["POST"])
@login_required
def api_daily():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    now = time.time()
    if now - player.get("last_daily", 0) < 86400:
        remaining = int(86400 - (now - player.get("last_daily", 0)))
        return jsonify({"error": f"Cooldown! {remaining}s remaining"}), 429
    # ── Login streak: continues if claimed within 48h of last claim, else resets ──
    last = player.get("last_daily", 0)
    streak = player.get("daily_streak", 0) + 1 if (last and now - last < STREAK_GRACE) else 1
    player["daily_streak"] = streak
    player["best_daily_streak"] = max(player.get("best_daily_streak", 0), streak)
    mult = streak_multiplier(streak)

    base_coins = int((50 + player["level"] * 10) * mult)
    bonus_xp = int((20 + player["level"] * 5) * mult)
    bonus_text = ""
    roll = random.random()
    if roll < 0.05:
        player["coins"] += 500
        bonus_text = "JACKPOT! +500 bonus coins!"
    elif roll < 0.2:
        player["coins"] += 100
        bonus_text = "Lucky! +100 bonus coins!"
    player["coins"] += base_coins
    bump_mission(player, "daily")
    bonus_coins = 500 if roll < 0.05 else (100 if roll < 0.2 else 0)

    # Milestone chest on every 7th consecutive day
    milestone = ""
    if streak % 7 == 0:
        chest = 1000 * (streak // 7)
        player["coins"] += chest
        bonus_coins += chest
        milestone = f"🏆 {streak}-day streak chest: +{chest} coins!"

    bump_mission(player, "coins", base_coins + bonus_coins)
    player["xp"] += bonus_xp
    player["last_daily"] = now
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)

    # Notify Discord
    uname = session.get("username", "Player")
    notify_discord(
        f"🎁 Daily Reward — {uname}",
        f"Claimed daily reward: 🪙 +{base_coins} coins | ⭐ +{bonus_xp} XP"
        f"\n🔥 Streak: {streak} day(s) (x{mult:g} rewards)"
        + (f"\n{bonus_text}" if bonus_text else "")
        + (f"\n{milestone}" if milestone else ""),
        color=0x57f287,
    )

    return jsonify({"success": True, "coins": base_coins, "xp": bonus_xp, "bonus": bonus_text,
                    "streak": streak, "multiplier": mult, "milestone": milestone, "player": player})

@app.route("/api/daily/status")
@login_required
def api_daily_status():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    now = time.time()
    last = player.get("last_daily", 0)
    streak = player.get("daily_streak", 0)
    # Streak already expired but not yet reset by a claim — show it as broken.
    if last and now - last >= STREAK_GRACE:
        streak = 0
    return jsonify({
        "streak": streak,
        "best_streak": player.get("best_daily_streak", 0),
        "multiplier": streak_multiplier(streak + 1),
        "ready": now - last >= 86400,
        "seconds_remaining": max(0, int(86400 - (now - last))),
        "next_milestone": 7 - (streak % 7),
    })

@app.route("/inventory")
@login_required
def inventory_page():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    shops = load_shops()
    gid = str(session.get("guild_id", HOME_GUILD_ID))
    shop = shops.get(gid, {})
    items = []
    
    # Process both old string-based inventory and new dict-based inventory
    item_counts = {}
    for item in player.get("inventory", []):
        cat = "material"
        rarity = "common"
        if isinstance(item, dict):
            name = item.get("name", "Unknown Item")
            item_id = item.get("id", name.lower().replace(" ", "_"))
            cat = item.get("type", "material").lower()
            rarity = item.get("rarity", "common").lower()
        else:
            item_id = str(item)
            name = item_id
            for c in ["weapons", "armor", "potions", "special"]:
                for s_item in shop.get(c, []):
                    if s_item["id"] == item_id:
                        name = s_item["name"]
                        cat = c[:-1] if c.endswith('s') else c # weapon, armor, potion
                        break
        
        if item_id not in item_counts:
            item_counts[item_id] = {"id": item_id, "name": name, "count": 0, "category": cat, "rarity": rarity,
                                    "stats": item.get("stats", {}) if isinstance(item, dict) else {}}
            # Fix name: strip leading emoji if accidentally stored
            parts = name.split(" ", 1)
            if len(parts) == 2 and parts[0] in ["🔥","👻","🐉","🦊","🟢","🛡️","⚔️"]:
                name = parts[1]
                item_counts[item_id]["name"] = name
        item_counts[item_id]["count"] += 1
        
    eq_w = player.get("equipped_weapon")
    eq_a = player.get("equipped_armor")
    eq_h = player.get("equipped_helmet")
    eq_s = player.get("equipped_shield")
    eq_b = player.get("equipped_boots")
    
    def matches_id(eq_item, target_id):
        if not eq_item: return False
        if isinstance(eq_item, dict):
            name = eq_item.get("name", "")
            return eq_item.get("id", name.lower().replace(" ", "_")) == target_id
        return str(eq_item).lower() == target_id
    
    for item_id, info in item_counts.items():
        info["equipped"] = (matches_id(eq_w, item_id) or matches_id(eq_a, item_id) or
                            matches_id(eq_h, item_id) or matches_id(eq_s, item_id) or
                            matches_id(eq_b, item_id))
        info["heal_amt"] = potion_heal_amount(info) if info["category"] == "potion" else 0
        items.append(info)
    
    equipped = []
    if eq_w:
        if isinstance(eq_w, dict):
            equipped.append(f"⚔️ {eq_w.get('name', 'Weapon')} (ATK: {eq_w.get('stats', {}).get('attack', 0)})")
        else:
            for w in shop.get("weapons", []):
                if w["id"] == eq_w:
                    equipped.append(f"⚔️ {w['name']}")
    
    if eq_a:
        if isinstance(eq_a, dict):
            equipped.append(f"🛡️ {eq_a.get('name', 'Armor')} (DEF: {eq_a.get('stats', {}).get('defense', 0)})")
        else:
            for a in shop.get("armor", []):
                if a["id"] == eq_a:
                    equipped.append(f"🛡️ {a['name']}")
    
    if eq_h:
        if isinstance(eq_h, dict):
            equipped.append(f"🪖 {eq_h.get('name', 'Helmet')} (DEF: {eq_h.get('stats', {}).get('defense', 0)})")
        else:
            equipped.append(f"🪖 {eq_h}")
    
    if eq_s:
        if isinstance(eq_s, dict):
            equipped.append(f"🛡️ {eq_s.get('name', 'Shield')} (DEF: {eq_s.get('stats', {}).get('defense', 0)})")
        else:
            equipped.append(f"🛡️ {eq_s}")

    if eq_b:
        if isinstance(eq_b, dict):
            equipped.append(f"👢 {eq_b.get('name', 'Boots')} (DEF: {eq_b.get('stats', {}).get('defense', 0)})")
        else:
            equipped.append(f"👢 {eq_b}")
    
    return render_template(
        "inventory.html", player=player, items=items,
        equipped=equipped, username=session.get("username", "Player"),
        avatar_url=session_avatar(session),
    )

# ══════════════════════════════════════════════
# 🏆 LEADERBOARD WITH ROLES & PROFILES
# ══════════════════════════════════════════════

# ── SETTINGS / PROFILE EDITING ──
@app.route("/settings")
@login_required
def settings_page():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    return render_template("settings.html", player=player,
                           username=session.get("username", "Player"),
                           avatar_url=get_player_avatar(player),
                           now=time.time())

@app.route("/api/profile/update", methods=["POST"])
@login_required
def api_profile_update():
    gid = session.get("guild_id", HOME_GUILD_ID)
    uid = session["user_id"]
    player = get_player(gid, uid)
    data = request.get_json(silent=True) or {}
    action = data.get("action", "")
    cur = data.get("current_password", "")
    # Username changes are safe without a password when the account has none set yet
    if action != "username" and not player.get("password_hash"):
        return jsonify({"error": "No password on file. Set one via Discord setup first."}), 400
    if action == "username" and player.get("password_hash") and not check_password_hash(player["password_hash"], cur):
        return jsonify({"error": "Current password incorrect."}), 400
    if action != "username" and player.get("password_hash") and not check_password_hash(player["password_hash"], cur):
        return jsonify({"error": "Current password incorrect."}), 400
    if action == "username":
        name = (data.get("username") or "").strip()
        if len(name) < 2 or len(name) > 24:
            return jsonify({"error": "Username must be 2–24 characters."}), 400
        found = find_player_by_username(name)
        if found and found[1] != uid:
            return jsonify({"error": "That username is taken."}), 400
        player["name"] = name
        player["username"] = name
        player["username_lower"] = name.lower()
        session["username"] = name
    elif action == "email":
        email = (data.get("email") or "").strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            return jsonify({"error": "Enter a valid email address."}), 400
        for pid, p in load_players().items():
            if str(p.get("email", "")).strip().lower() == email and pid != f"{gid}_{uid}":
                return jsonify({"error": "That email is already in use."}), 400
        player["email"] = email
    elif action == "password":
        newpw = data.get("new_password", "")
        if len(newpw) < 6:
            return jsonify({"error": "New password must be at least 6 characters."}), 400
        if check_password_hash(player["password_hash"], newpw):
            return jsonify({"error": "New password must differ from the current one."}), 400
        player["password_hash"] = generate_password_hash(newpw)
    else:
        return jsonify({"error": "Unknown action."}), 400
    save_player(gid, uid, player)
    return jsonify({"success": True})

@app.route("/api/profile/avatar", methods=["POST"])
@login_required
def api_profile_avatar():
    gid = session.get("guild_id", HOME_GUILD_ID)
    uid = session["user_id"]
    player = get_player(gid, uid)
    f = request.files.get("avatar")
    if not f or not f.filename:
        return jsonify({"error": "No image selected."}), 400
    ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""
    if ext not in ("png", "jpg", "jpeg", "gif", "webp"):
        return jsonify({"error": "Only PNG, JPG, GIF or WEBP images allowed."}), 400
    f.seek(0, os.SEEK_END)
    size = f.tell()
    f.seek(0)
    if size > 4 * 1024 * 1024:
        return jsonify({"error": "Image must be under 4 MB."}), 400
    old = player.get("avatar_file")
    fname = f"{uid}.{ext}"
    f.save(os.path.join(UPLOAD_DIR, fname))
    if old and old != fname:
        try:
            os.remove(os.path.join(UPLOAD_DIR, old))
        except OSError:
            pass
    player["avatar_file"] = fname
    player["avatar_ts"] = int(time.time())
    save_player(gid, uid, player)
    return jsonify({"success": True, "url": f"/static/uploads/{fname}?v={player['avatar_ts']}"})

@app.route("/leaderboard")
def leaderboard_page():
    players = load_players()
    # Show all players sorted by level, no login required (public page)
    sorted_p = sorted(players.values(), key=lambda x: (x.get("level", 0), x.get("monsters_killed", 0)), reverse=True)[:30]
    
    # Attach rank emoji and role info for display
    roles_data = load_roles()
    for p in sorted_p:
        p["duel_rank_emoji"] = get_rank_emoji(p.get("duel_rank", "Rookie"))
        p["avatar_url"] = get_player_avatar(p)
        if p.get("role"):
            p["role_data"] = roles_data["roles"].get(p["role"], {})
        else:
            p["role_data"] = None
    
    return render_template("leaderboard.html", players=sorted_p, username=session.get("username", ""),
                           roles_data=roles_data, now=time.time())

@app.route("/profile/<user_id>")
def profile_page(user_id):
    """View any player's full profile with stats, roles, and challenge button."""
    players = load_players()
    # Find player by user_id
    found_player = None
    for p in players.values():
        if p.get("user_id") == user_id:
            found_player = p
            break
    
    if not found_player:
        return render_template("profile.html", player=None, username=session.get("username", "")), 404
    
    roles_data = load_roles()
    found_player["duel_rank_emoji"] = get_rank_emoji(found_player.get("duel_rank", "Rookie"))
    if found_player.get("role"):
        found_player["role_data"] = roles_data["roles"].get(found_player["role"], {})
    else:
        found_player["role_data"] = None
    
    # Check if player is online (last_seen within 5 minutes)
    is_online = (time.time() - found_player.get("last_seen", 0)) < 300

    # Class rank progression (Novice → Awakening → Expert → Master)
    from game_logic import get_role_rank as _get_role_rank
    _had_base = "master_wins_base" in found_player
    found_player["role_rank"] = _get_role_rank(found_player)
    if not _had_base and "master_wins_base" in found_player:
        save_player(found_player.get("guild_id", HOME_GUILD_ID), found_player["user_id"], found_player)

    # Dual-class circle ladder (Circle I → V)
    if found_player.get("has_second_class"):
        from game_logic import second_class_rank as _second_class_rank
        found_player["second_rank"] = _second_class_rank(found_player)
    
    # Calculate win rate
    total_duels = found_player.get("duel_wins", 0) + found_player.get("duel_losses", 0)
    win_rate = 0
    if total_duels > 0:
        win_rate = round((found_player.get("duel_wins", 0) / total_duels) * 100, 1)
    
    return render_template(
        "profile.html", player=found_player, is_online=is_online,
        win_rate=win_rate, username=session.get("username", ""),
        avatar_url=get_player_avatar(found_player),
        roles_data=roles_data,
        session_user_id=session.get("user_id", "")
    )

# ══════════════════════════════════════════════
# 📖 STORY SYSTEM
# ══════════════════════════════════════════════

@app.route("/story")
@login_required
def story_page():
    """Story page showing current chapter and progression."""
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    
    # Import story functions
    from game_logic import get_story_chapter, get_unlocked_chapter
    
    # Check for newly unlocked chapters and claim rewards
    current, new_rewards = get_unlocked_chapter(player)
    if new_rewards:
        save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    
    if current is None:
        current = {"chapter": 1, "title": "The Awakening", "subtitle": "Begin your journey",
                   "floors": "1-5", "text": "The tower awaits...", "enemies": "???",
                   "boss": {"name": "???", "line": "???"}, "lore": "???"}
    
    from game_data import STORY_CHAPTERS
    tower_floor = player.get("tower_floor", 1)
    player_level = player.get("level", 1)
    completed = player.get("completed_chapters", [])
    
    return render_template("story.html",
        player=player,
        chapter=current,
        all_chapters=STORY_CHAPTERS,
        floor=tower_floor,
        player_level=player_level,
        completed=completed,
        new_rewards=new_rewards,
        username=session.get("username", "Player"),
        avatar_url=get_avatar_url(session.get("user_id", ""), ""),
        get_story_chapter=get_story_chapter,
    )

# ══════════════════════════════════════════════
# 🏆 ACHIEVEMENTS SYSTEM
# ══════════════════════════════════════════════

@app.route("/achievements")
@login_required
def achievements_page():
    """Achievements page showing all available and unlocked achievements."""
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    from game_data import ACHIEVEMENTS

    # Check for new achievements (grant_achievements records, rewards + mails)
    new_achs = grant_achievements(player)
    if new_achs:
        save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    
    unlocked = player.get("achievements", [])
    
    # Enrich achievements with unlock status
    enriched = []
    for a in ACHIEVEMENTS:
        enriched.append({
            "id": a["id"],
            "name": a["name"],
            "desc": a["desc"],
            "emoji": a["emoji"],
            "condition": a["condition"],
            "unlocked": a["name"] in unlocked,
        })
    
    return render_template("achievements.html",
        player=player,
        achievements=enriched,
        new_achs=new_achs,
        username=session.get("username", "Player"),
        avatar_url=get_avatar_url(session.get("user_id", ""), ""),
    )

# ══════════════════════════════════════════════
# DYNAMIC ROUTES (placeholder pages)
# ══════════════════════════════════════════════

@app.route("/roles")
@login_required
def roles_page():
    """Choose or view available roles."""
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    roles_data = load_roles()
    
    available_roles = []
    all_roles = []
    chosen_role = None
    
    for rid, rinfo in roles_data["roles"].items():
        all_roles.append({"id": rid, **rinfo})
        if player["level"] >= rinfo["min_level"]:
            available_roles.append({"id": rid, **rinfo})
        if player.get("role") == rid:
            chosen_role = {"id": rid, **rinfo}
    
    return render_template(
        "roles.html", player=player, available_roles=available_roles,
        all_roles=all_roles, chosen_role=chosen_role, username=session.get("username", "Player"),
        avatar_url=session_avatar(session),
        roles_data=roles_data
    )

@app.route("/api/choose_role", methods=["POST"])
@login_required
def api_choose_role():
    """Choose a role for the player."""
    role_id = request.json.get("role_id", "").lower()
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    roles_data = load_roles()
    
    if role_id not in roles_data["roles"]:
        return jsonify({"error": "Role not found"}), 404
    
    role_info = roles_data["roles"][role_id]
    if player["level"] < role_info["min_level"]:
        return jsonify({"error": f"You need level {role_info['min_level']} to become a {role_info['name']}"}), 400
    
    # Remove old role bonus if exists
    if player.get("role"):
        old_role = roles_data["roles"].get(player["role"], {})
        old_bonus = old_role.get("bonus", {})
        if "attack" in old_bonus:
            player["attack"] -= old_bonus["attack"]
        if "defense" in old_bonus:
            player["defense"] -= old_bonus["defense"]
        if "max_health" in old_bonus:
            player["max_health"] -= old_bonus["max_health"]
            player["health"] = min(player["health"], player["max_health"])
    
    # Apply new role bonus
    bonus = role_info.get("bonus", {})
    if "attack" in bonus:
        player["attack"] += bonus["attack"]
    if "defense" in bonus:
        player["defense"] += bonus["defense"]
    if "max_health" in bonus:
        player["max_health"] += bonus["max_health"]
        player["health"] += bonus["max_health"]
    
    old_role_id = player.get("role")
    player["role"] = role_id
    player["role_level"] = 1
    # Every role/class path starts its own rank ladder at Rank 1.
    if old_role_id != role_id:
        player["master_floor_base"] = player.get("highest_floor", 1)
        player.pop("master_wins_base", None)
    player["active_title"] = role_info.get("title", "Adventurer")
    
    # Unlock title
    if role_info.get("title") not in player.get("titles_unlocked", []):
        player.setdefault("titles_unlocked", []).append(role_info["title"])
    
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    
    notify_discord(
        f"🎭 Role Chosen — {player['name']}",
        f"**{player['name']}** has become a **{role_info['name']}**!\n*{role_info['desc']}*",
        color=0xa855f7,
    )
    
    return jsonify({"success": True, "message": f"You are now a {role_info['name']}!", "player": player})

@app.route("/api/change_title", methods=["POST"])
@login_required
def api_change_title():
    """Change active title."""
    title = request.json.get("title", "")
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    
    if title not in player.get("titles_unlocked", []):
        return jsonify({"error": "Title not unlocked"}), 400
    
    player["active_title"] = title
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "message": f"Title changed to {title}!"})

# ══════════════════════════════════════════════


# ══════════════════════════════════════════════
# 🐾 PET SYSTEM
# ══════════════════════════════════════════════

@app.route("/pet")
@login_required
def pet_page():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    eggs = [i for i in player.get("inventory", [])
            if isinstance(i, dict) and i.get("type") in ("egg", "pet_egg")]
    # Migrate legacy string-format pets to dict format
    raw_pets = player.get("pets", [])
    migrated = False
    for i, p in enumerate(raw_pets):
        if isinstance(p, str):
            raw_pets[i] = {"name": p.capitalize(), "icon": "🐾", "rarity": p.capitalize(),
                           "atk_bonus": 0, "def_bonus": 0, "level": 1,
                           "id": f"{p}_{int(time.time()*1000 + i)}"}
            migrated = True
    # Filter out any non-dict entries that slipped through
    pets = [p for p in raw_pets if isinstance(p, dict)]
    if migrated:
        player["pets"] = pets
        save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    # Clean equipped_pets — remove IDs that don't match any pet
    valid_ids = {p.get("id") for p in pets}
    equipped_pets = [e for e in player.get("equipped_pets", []) if e in valid_ids]
    if equipped_pets != player.get("equipped_pets", []):
        player["equipped_pets"] = equipped_pets
        save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return render_template("pet.html", player=player, eggs=eggs, pets=pets,
                           equipped_pets=equipped_pets,
                           username=session.get("username", "Player"),
                           avatar_url=get_avatar_url(session.get("user_id", ""), ""))

@app.route("/api/pet/hatch", methods=["POST"])
@login_required
def api_pet_hatch():
    egg_id = (request.json or {}).get("egg_id", "").lower()
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    inventory = player.get("inventory", [])
    egg_idx, egg_item = -1, None
    for i, item in enumerate(inventory):
        if isinstance(item, dict) and item.get("type") in ("egg", "pet_egg"):
            curr_id = item.get("id", item.get("name", "").lower().replace(" ", "_"))
            if curr_id == egg_id:
                egg_idx = i; egg_item = item; break
    if egg_idx == -1:
        return jsonify({"error": "Egg not found"}), 404
    pet = _hatch_egg(egg_item)
    inventory.pop(egg_idx)
    player["inventory"] = inventory
    player.setdefault("pets", []).append(pet)
    bump_mission(player, "hatch")
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "pet": pet,
                    "message": f"✨ Hatched {pet['icon']} {pet['name']} ({pet['rarity']} Lv.{pet['level']})! +{pet['atk_bonus']} ATK +{pet['def_bonus']} DEF"})

@app.route("/api/pet/equip_toggle", methods=["POST"])
@login_required
def api_pet_equip_toggle():
    pet_id = (request.json or {}).get("pet_id", "")
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    pet = next((p for p in player.get("pets", []) if p.get("id") == pet_id), None)
    if not pet: return jsonify({"error": "Pet not found"}), 404
    equipped = player.get("equipped_pets", [])
    max_pets = max(1, player.get("tower_floor", 0) // 10)
    if pet_id in equipped:
        equipped.remove(pet_id)
        player["equipped_pets"] = equipped
        save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
        return jsonify({"success": True, "message": f"Unequipped {pet['name']}."})
    if len(equipped) >= max_pets:
        return jsonify({"error": f"Max {max_pets} pet(s) — 1 slot per 10 tower floors"}), 400
    equipped.append(pet_id)
    player["equipped_pets"] = equipped
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "message": f"Equipped {pet['icon']} {pet['name']}! +{pet.get('atk_bonus',0)} ATK"})

@app.route("/api/pet/sell", methods=["POST"])
@login_required
def api_pet_sell():
    """Sell a hatched pet for coins. Value = rarity base × pet level."""
    pet_id = (request.json or {}).get("pet_id", "")
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    pets = player.get("pets", [])
    pet = next((p for p in pets if p.get("id") == pet_id), None)
    if not pet:
        return jsonify({"error": "Pet not found."}), 404
    if pet_id in player.get("equipped_pets", []):
        return jsonify({"error": "Unequip the pet before selling it!"}), 400
    rarity = (pet.get("rarity") or "common").lower()
    base = {"common": 25, "uncommon": 75, "rare": 250, "epic": 750,
            "mythic": 2500, "legendary": 4000, "unique": 10000}.get(rarity, 25)
    value = base * int(pet.get("level", 1))
    player["pets"] = [p for p in pets if p.get("id") != pet_id]
    player["coins"] = player.get("coins", 0) + value
    bump_mission(player, "sell")
    bump_mission(player, "coins", value)
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "coins": player["coins"],
                    "message": f"Sold {pet.get('icon','🐾')} {pet.get('name','?')} (Lv.{pet.get('level',1)} {pet.get('rarity','?')}) for {value} coins!"})

# Pet rank ladder — combine 2 same-name pets to rank one up
_PET_RANK_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "unique"]

_PET_TYPES = {
    "common":   [("Slime","🟢",1,0),("Bat","🦇",1,0),("Goblin","👺",2,0)],
    "uncommon": [("Wolf Cub","🐺",3,1),("Cat","🐱",3,1),("Bunny","🐰",2,2)],
    "rare":     [("Dragon","🐉",5,2),("Phoenix","🔥",4,3),("Kitsune","🦊",5,2)],
    "epic":     [("Griffin","👻",8,4),("Chimera","🦁",9,3),("Kraken","🐙",7,6)],
    "mythic":   [("Celestial","⭐",15,8),("Void Drake","🌑",14,10),("God Beast","🌟",20,10)],
    "legendary":[("Thunder Roc","⚡",18,12),("Titan Golem","🗿",16,16),("Elder Wyrm","🐲",20,14)],
    "unique":   [("Star Phoenix","☄️",30,20),("World Serpent","🌍",28,24),("Cosmic Kitsune","🪐",26,26)],
}
_PET_MAX_LEVEL = {"common": 3, "uncommon": 5, "rare": 7, "epic": 10,
                  "mythic": 15, "legendary": 18, "unique": 20}

def _hatch_egg(egg_item, salt=0):
    """Shared egg → pet conversion. salt keeps ids unique in bulk hatches."""
    egg_rarity = (egg_item.get("rarity") or "common").lower()
    pool = _PET_TYPES.get(egg_rarity, _PET_TYPES["common"])
    name, icon, atk_base, def_base = random.choice(pool)
    level = random.randint(1, _PET_MAX_LEVEL.get(egg_rarity, 3))
    mult = 0.5 + 0.5 * level  # Lv.1 = 1.0x base stats, Lv.20 = 10.5x
    atk_bonus, def_bonus = max(1, int(atk_base * mult)), max(0, int(def_base * mult))
    base_id = f"{name.lower().replace(' ','_')}_{int(time.time())}"
    return {"name": name, "icon": icon, "rarity": egg_rarity.capitalize(),
            "atk_bonus": atk_bonus, "def_bonus": def_bonus, "level": level,
            "id": f"{base_id}_{salt}" if salt else base_id}

@app.route("/api/pet/combine_egg", methods=["POST"])
@login_required
def api_pet_combine_egg():
    """Combine 3 eggs of the same rank into ONE egg of the next rank."""
    egg_ids = (request.json or {}).get("egg_ids", [])
    if not isinstance(egg_ids, list) or len(egg_ids) != 3 or len(set(egg_ids)) != 3:
        return jsonify({"error": "Select exactly 3 eggs of the same rank to combine."}), 400
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    inv = player.get("inventory", [])
    eggs = [i for i in inv if isinstance(i, dict) and i.get("type") == "egg" and i.get("id") in egg_ids]
    if len(eggs) != 3:
        return jsonify({"error": "One or more eggs not found."}), 400
    rarities = {str(e.get("rarity", "common")).lower() for e in eggs}
    if len(rarities) != 1:
        return jsonify({"error": "All 3 eggs must be the same rank."}), 400
    rank = rarities.pop()
    if rank not in _PET_RANK_ORDER:
        return jsonify({"error": "Unknown egg rank."}), 400
    idx = _PET_RANK_ORDER.index(rank)
    if idx >= len(_PET_RANK_ORDER) - 1:
        return jsonify({"error": "Unique eggs are already the highest rank — cannot combine further."}), 400
    new_rank = _PET_RANK_ORDER[idx + 1]
    player["inventory"] = [i for i in inv if i.get("id") not in egg_ids]
    player["inventory"].append({"name": f"{new_rank.title()} Egg", "type": "egg", "icon": "🥚",
                                "rarity": new_rank, "id": f"egg_{int(random.random()*1e9)}", "stats": {}})
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True,
                    "message": f"🥚 Combined 3× {rank.title()} Eggs → 1 {new_rank.title()} Egg! Hatch it on the Pets page."})

@app.route("/api/pet/combine", methods=["POST"])
@login_required
def api_pet_combine():
    """Combine 2 pets of the SAME name into one pet of the next rank (same name, boosted stats)."""
    pet_ids = (request.json or {}).get("pet_ids", [])
    if not isinstance(pet_ids, list) or len(pet_ids) != 2 or len(set(pet_ids)) != 2:
        return jsonify({"error": "Select exactly 2 pets to combine."}), 400
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    pets = player.get("pets", [])
    a = next((p for p in pets if p.get("id") == pet_ids[0]), None)
    b = next((p for p in pets if p.get("id") == pet_ids[1]), None)
    if not a or not b:
        return jsonify({"error": "One or both pets not found."}), 400
    equipped = player.get("equipped_pets", [])
    if a.get("id") in equipped or b.get("id") in equipped:
        return jsonify({"error": "Unequip both pets before combining them!"}), 400
    name_a, name_b = str(a.get("name", "")).strip().lower(), str(b.get("name", "")).strip().lower()
    if name_a != name_b:
        return jsonify({"error": "Both pets must be the same kind (same name)."}), 400
    rarity_a, rarity_b = str(a.get("rarity", "common")).lower(), str(b.get("rarity", "common")).lower()
    if rarity_a != rarity_b:
        return jsonify({"error": "Both pets must be the same rank."}), 400
    rank_idx = _PET_RANK_ORDER.index(rarity_a) if rarity_a in _PET_RANK_ORDER else -1
    if rank_idx < 0:
        return jsonify({"error": "Unknown pet rank."}), 400
    if rank_idx >= len(_PET_RANK_ORDER) - 1:
        return jsonify({"error": "Unique pets are already the highest rank — cannot combine further."}), 400
    new_rank = _PET_RANK_ORDER[rank_idx + 1]
    new_level = max(int(a.get("level", 1)), int(b.get("level", 1)))
    atk = max(1, int(max(a.get("atk_bonus", 0), b.get("atk_bonus", 0)) * 1.75))
    dff = max(0, int(max(a.get("def_bonus", 0), b.get("def_bonus", 0)) * 1.75))
    pet = {"name": a.get("name"), "icon": a.get("icon", "🐾"), "rarity": new_rank.capitalize(),
           "atk_bonus": atk, "def_bonus": dff, "level": new_level,
           "id": f"combined_{new_rank}_{int(time.time() * 1000)}"}
    player["pets"] = [p for p in pets if p.get("id") not in pet_ids]
    player["pets"].append(pet)
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "pet": pet,
                    "message": f"🔮 Combined 2× {a.get('icon','🐾')} {a.get('name')} → {new_rank.capitalize()} {a.get('name')} (Lv.{new_level})! +{atk} ATK +{dff} DEF"})

# ══════════════════════════════════════════════
# 🤖 AUTO PET FEATURES — one-time coin unlock
# ══════════════════════════════════════════════
AUTO_FEATURE_COST = 50000
AUTO_FEATURES = {"pets": "auto_pets", "smith": "auto_smith"}
AUTO_FEATURE_NAMES = {"auto_pets": "Auto Pets (Hatch All + Combine All)",
                      "auto_smith": "Auto Smith (Forge All Gear)"}

def _unlock_gate(player, key):
    """403 unless the one-time auto feature is unlocked."""
    if not player.get("unlocks", {}).get(key):
        return jsonify({"error": f"Locked! Unlock it in the shop for {AUTO_FEATURE_COST:,} coins (one-time)."}), 403
    return None

@app.route("/api/unlock/auto", methods=["POST"])
@login_required
def api_unlock_auto():
    feature = (request.json or {}).get("feature", "")
    key = AUTO_FEATURES.get(feature)
    if not key:
        return jsonify({"error": "Unknown feature."}), 400
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    unlocks = player.setdefault("unlocks", {})
    if unlocks.get(key):
        return jsonify({"error": "Already unlocked."}), 400
    if player.get("coins", 0) < AUTO_FEATURE_COST:
        return jsonify({"error": f"Not enough coins! Need {AUTO_FEATURE_COST:,} to unlock {AUTO_FEATURE_NAMES[key]}."}), 400
    player["coins"] -= AUTO_FEATURE_COST
    unlocks[key] = True
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True,
                    "message": f"🔓 {AUTO_FEATURE_NAMES[key]} unlocked FOREVER — one-time payment, no expiry!",
                    "balance": player["coins"]})

@app.route("/api/pet/hatch_all", methods=["POST"])
@login_required
def api_pet_hatch_all():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    gate = _unlock_gate(player, "auto_pets")
    if gate: return gate
    inventory = player.get("inventory", [])
    eggs = [i for i in inventory if isinstance(i, dict) and i.get("type") in ("egg", "pet_egg")]
    if not eggs:
        return jsonify({"error": "No eggs to hatch."}), 400
    egg_ids = {e.get("id") or e.get("name") for e in eggs}
    hatched = [_hatch_egg(egg, i + 1) for i, egg in enumerate(eggs)]
    for _ in eggs:
        bump_mission(player, "hatch")
    player["inventory"] = [i for i in inventory
                           if not (isinstance(i, dict) and (i.get("id") or i.get("name")) in egg_ids)]
    player.setdefault("pets", []).extend(hatched)
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    preview = ", ".join(f"{p['icon']} {p['name']}" for p in hatched[:5])
    suffix = "…" if len(hatched) > 5 else ""
    return jsonify({"success": True,
                    "message": f"✨ Hatched ALL {len(hatched)} eggs → {preview}{suffix}"})

@app.route("/api/pet/combine_all", methods=["POST"])
@login_required
def api_pet_combine_all():
    """Auto-combine everything possible: 2 same-kind pets → next rank, 3 same-rank eggs → next rank."""
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    gate = _unlock_gate(player, "auto_pets")
    if gate: return gate

    # ── Pets: repeatedly pair 2 same (name, rank) → 1 pet one rank higher ──
    equipped = set(player.get("equipped_pets", []))
    pets = [p for p in player.get("pets", []) if isinstance(p, dict)]
    pet_combos = 0
    changed = True
    while changed:
        changed = False
        groups = {}
        for p in pets:
            if p.get("id") in equipped:
                continue
            key = (str(p.get("name", "")).strip().lower(), str(p.get("rarity", "common")).lower())
            groups.setdefault(key, []).append(p)
        for (name_l, r_l), group in groups.items():
            if r_l not in _PET_RANK_ORDER or _PET_RANK_ORDER.index(r_l) >= len(_PET_RANK_ORDER) - 1:
                continue
            if len(group) < 2:
                continue
            a, b = group[0], group[1]
            new_rank = _PET_RANK_ORDER[_PET_RANK_ORDER.index(r_l) + 1]
            new_level = max(int(a.get("level", 1)), int(b.get("level", 1)))
            atk = max(1, int(max(a.get("atk_bonus", 0), b.get("atk_bonus", 0)) * 1.75))
            dff = max(0, int(max(a.get("def_bonus", 0), b.get("def_bonus", 0)) * 1.75))
            new_pet = {"name": a.get("name"), "icon": a.get("icon", "🐾"),
                       "rarity": new_rank.capitalize(), "atk_bonus": atk, "def_bonus": dff,
                       "level": new_level,
                       "id": f"combined_{new_rank}_{int(time.time() * 1000)}_{pet_combos}"}
            gone = {a.get("id"), b.get("id")}
            pets = [p for p in pets if p.get("id") not in gone]
            pets.append(new_pet)
            pet_combos += 1
            changed = True
            break  # re-group after each combine — results can pair again

    # ── Eggs: repeatedly merge 3 same-rank eggs → 1 egg one rank higher ──
    inventory = player.get("inventory", [])
    eggs = [i for i in inventory if isinstance(i, dict) and i.get("type") in ("egg", "pet_egg")]
    egg_combos = 0
    changed = True
    while changed:
        changed = False
        groups = {}
        for e in eggs:
            groups.setdefault(str(e.get("rarity", "common")).lower(), []).append(e)
        for r_l, group in groups.items():
            if r_l not in _PET_RANK_ORDER or _PET_RANK_ORDER.index(r_l) >= len(_PET_RANK_ORDER) - 1:
                continue
            if len(group) < 3:
                continue
            new_rank = _PET_RANK_ORDER[_PET_RANK_ORDER.index(r_l) + 1]
            gone = {e.get("id") for e in group[:3]}
            eggs = [e for e in eggs if e.get("id") not in gone]
            eggs.append({"name": f"{new_rank.title()} Egg", "type": "egg", "icon": "🥚",
                         "rarity": new_rank, "id": f"egg_{int(random.random()*1e9)}", "stats": {}})
            egg_combos += 1
            changed = True
            break

    if pet_combos == 0 and egg_combos == 0:
        return jsonify({"error": "Nothing to combine — need 2 same-kind pets or 3 same-rank eggs."}), 400
    player["pets"] = pets
    player["inventory"] = [i for i in inventory
                           if not (isinstance(i, dict) and i.get("type") in ("egg", "pet_egg"))] + eggs
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    bits = []
    if pet_combos: bits.append(f"🔮 {pet_combos} pet rank-up(s)")
    if egg_combos: bits.append(f"🥚 {egg_combos} egg rank-up(s)")
    return jsonify({"success": True, "message": "Combined ALL: " + " + ".join(bits)})

# ══════════════════════════════════════════════
# 👥 ONLINE PLAYERS API
# ══════════════════════════════════════════════

@app.route("/api/players/online")
@login_required
def api_players_online():
    """Return all online players (last_seen within 600s) for World chat view."""
    all_players = load_players()
    now_ts = time.time()
    online = []
    for key, p in all_players.items():
        if not isinstance(p, dict): continue
        ls = p.get("last_seen", 0)
        if now_ts - ls < 600:
            uid = p.get("user_id", key.split("_")[-1] if "_" in key else "")
            online.append({
                "user_id": uid,
                "username": p.get("username", p.get("name", "?")),
                "level": p.get("level", 1),
                "last_seen": ls
            })
    online.sort(key=lambda x: x.get("level", 0), reverse=True)
    return jsonify({"online": online[:20]})

@app.route("/api/guild/members")
@login_required
def api_guild_members():
    """Return guild members with online status for Guild chat view."""
    user_id = session["user_id"]
    guild_id = session.get("guild_id", HOME_GUILD_ID)
    guilds = load_guilds()
    # Find guild this user belongs to
    my_guild = None
    for g in guilds.values():
        if isinstance(g, dict) and user_id in g.get("members", []):
            my_guild = g
            break
    if not my_guild:
        return jsonify({"online": [], "guild_name": None})

    all_players = load_players()
    now_ts = time.time()
    members_online = []
    for uid in my_guild.get("members", []):
        p = all_players.get(f"{guild_id}_{uid}", {})
        if not isinstance(p, dict): p = {}
        ls = p.get("last_seen", 0)
        is_online = now_ts - ls < 600
        members_online.append({
            "user_id": uid,
            "username": p.get("username", p.get("name", uid[:8])),
            "level": p.get("level", 1),
            "online": is_online,
            "last_seen": ls
        })
    members_online.sort(key=lambda x: (-x["online"], -x.get("level", 0)))
    return jsonify({"online": [m for m in members_online if m["online"]],
                    "all_members": members_online,
                    "leader": my_guild.get("leader"),
                    "guild_name": my_guild.get("name", "Guild")})

# ══════════════════════════════════════════════
# 🛡️ GUILD SYSTEM
# ══════════════════════════════════════════════

def load_guilds():
    gf = os.path.join(os.path.dirname(__file__), "..", "data", "guilds.json")
    if os.path.exists(gf):
        try:
            with open(gf) as f:
                guilds = json.load(f)
            # 🛡️ Leader can never be removed — repair any drift (dup joins, missing leader)
            for g in guilds.values():
                if isinstance(g, dict) and g.get("leader"):
                    members = [m for m in g.setdefault("members", []) if m]
                    if g["leader"] not in members:
                        members.append(g["leader"])
                    g["members"] = list(dict.fromkeys(members))
            return guilds
        except Exception:
            print("[guilds] load failed, returning empty", flush=True)
    return {}

def save_guilds(guilds):
    gf = os.path.join(os.path.dirname(__file__), "..", "data", "guilds.json")
    tmp = gf + ".tmp"
    with open(tmp, "w") as f:
        json.dump(guilds, f, indent=2)
    os.replace(tmp, gf)

@app.route("/api/guild/create", methods=["POST"])
@login_required
def api_guild_create():
    data = request.json or {}
    name = (data.get("name") or "").strip()[:32]
    tag  = (data.get("tag")  or "").strip()[:5].upper()
    if not name or not tag:
        return jsonify({"error": "Name and tag required"}), 400
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    if player.get("guild"):
        return jsonify({"error": "Already in a guild. Leave first."}), 400
    if player.get("coins", 0) < 500:
        return jsonify({"error": "Need 500 coins to create a guild"}), 400
    guilds = load_guilds()
    if any(g.get("tag") == tag for g in guilds.values()):
        return jsonify({"error": f"Tag [{tag}] already taken"}), 400
    guild_id = f"guild_{int(time.time())}_{session['user_id']}"
    guilds[guild_id] = {"id": guild_id, "name": name, "tag": tag,
        "leader": session["user_id"], "members": [session["user_id"]],
        "xp": 0, "level": 1, "created_at": time.time(),
        "description": data.get("description", "")[:200]}
    save_guilds(guilds)
    player["coins"] -= 500
    player["guild"] = guild_id
    player["guild_name"] = name
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "message": f"Guild [{tag}] {name} created!", "guild_id": guild_id})

@app.route("/api/guild/join", methods=["POST"])
@login_required
def api_guild_join():
    guild_id = (request.json or {}).get("guild_id", "")
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    if player.get("guild"): return jsonify({"error": "Already in a guild"}), 400
    guilds = load_guilds()
    guild = guilds.get(guild_id)
    if not guild: return jsonify({"error": "Guild not found"}), 404
    members = guild.setdefault("members", [])
    # Never duplicate a member; leader rejoin restores their membership
    if session["user_id"] not in members:
        members.append(session["user_id"])
    save_guilds(guilds)
    player["guild"] = guild_id
    player["guild_name"] = guild["name"]
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "message": f"Joined {guild['name']}!"})

@app.route("/api/guild/leave", methods=["POST"])
@login_required
def api_guild_leave():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    guild_id = player.get("guild")
    if not guild_id: return jsonify({"error": "Not in a guild"}), 400
    guilds = load_guilds()
    guild = guilds.get(guild_id, {})
    if guild.get("leader") == session["user_id"]:
        return jsonify({"error": "Leader must disband, not leave"}), 400
    members = guild.get("members", [])
    if session["user_id"] in members: members.remove(session["user_id"])
    guild["members"] = members
    save_guilds(guilds)
    player["guild"] = None; player["guild_name"] = None
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "message": "Left guild."})

@app.route("/api/guild/list")
@login_required
def api_guild_list():
    guilds = load_guilds()
    uid = session["user_id"]
    result = [{"id": gid, "name": g.get("name"), "tag": g.get("tag"),
               "members": len(g.get("members", [])), "xp": g.get("xp", 0), "level": g.get("level", 1),
               "leader": g.get("leader"), "is_leader": g.get("leader") == uid,
               "is_member": uid in g.get("members", [])}
              for gid, g in guilds.items()]
    result.sort(key=lambda x: x["xp"], reverse=True)
    return jsonify({"guilds": result})

@app.route("/api/guild/disband", methods=["POST"])
@login_required
def api_guild_disband():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    guild_id = player.get("guild")
    if not guild_id: return jsonify({"error": "Not in a guild"}), 400
    guilds = load_guilds()
    guild = guilds.get(guild_id, {})
    if guild.get("leader") != session["user_id"]:
        return jsonify({"error": "Only the guild leader can disband"}), 400
    del guilds[guild_id]
    save_guilds(guilds)
    # Release every member from this guild
    all_players = load_players()
    for uid in guild.get("members", []):
        pk = f"{session.get('guild_id', HOME_GUILD_ID)}_{uid}"
        p = all_players.get(pk)
        if isinstance(p, dict) and p.get("guild") == guild_id:
            p["guild"] = None; p["guild_name"] = None
    save_players(all_players)
    player["guild"] = None; player["guild_name"] = None
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "message": f"Guild [{guild.get('tag','')}] disbanded."})

# ══════════════════════════════════════════════
# ⚒️ JOBS SYSTEM
# ══════════════════════════════════════════════

JOBS = {
    "farmer":     {"name": "Farmer",     "icon": "🌾", "daily": 80,   "xp": 10,  "level": 10},
    "miner":      {"name": "Miner",      "icon": "⛏️", "daily": 150,  "xp": 20,  "level": 12},
    "cook":       {"name": "Cook",       "icon": "🍳", "daily": 180,  "xp": 22,  "level": 14},
    "fisher":     {"name": "Fisher",     "icon": "🎣", "daily": 160,  "xp": 20,  "level": 15},
    "guard":      {"name": "Guard",      "icon": "🗡️", "daily": 220,  "xp": 28,  "level": 18},
    "blacksmith": {"name": "Blacksmith", "icon": "🔨", "daily": 320,  "xp": 38,  "level": 22},
    "merchant":   {"name": "Merchant",   "icon": "💰", "daily": 420,  "xp": 35,  "level": 28},
    "alchemist":  {"name": "Alchemist",  "icon": "⚗️", "daily": 550,  "xp": 55,  "level": 35},
    "knight":     {"name": "Knight",     "icon": "⚔️", "daily": 700,  "xp": 65,  "level": 40},
    "wizard":     {"name": "Wizard",     "icon": "🧙", "daily": 900,  "xp": 85,  "level": 50},
}

@app.route("/api/job/set", methods=["POST"])
@login_required
def api_job_set():
    job_id = (request.json or {}).get("job_id", "")
    if job_id not in JOBS: return jsonify({"error": "Invalid job"}), 400
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    job = JOBS[job_id]
    if player.get("level", 1) < job["level"]:
        return jsonify({"error": f"Need Level {job['level']} for {job['name']}"}), 400
    player["job"] = job_id
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "message": f"Now working as {job['icon']} {job['name']}! Earn {job['daily']} coins/day."})

@app.route("/api/job/claim", methods=["POST"])
@login_required
def api_job_claim():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    job_id = player.get("job")
    if not job_id or job_id not in JOBS:
        return jsonify({"error": "No active job. Set one first."}), 400
    now = time.time()
    if now - player.get("last_job_claim", 0) < 86400:
        remaining = int(86400 - (now - player.get("last_job_claim", 0)))
        h, m = divmod(remaining // 60, 60)
        return jsonify({"error": f"Ready in {h}h {m}m"}), 429
    job = JOBS[job_id]
    player["coins"] = player.get("coins", 0) + job["daily"]
    player["xp"] = player.get("xp", 0) + job["xp"]
    player["last_job_claim"] = now
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "coins": job["daily"], "xp": job["xp"],
                    "message": f"💰 Collected {job['daily']} coins from {job['name']} work!"})

# ══════════════════════════════════════════════
# 💎 AUCTION HOUSE
# ══════════════════════════════════════════════

def load_auction():
    af = os.path.join(os.path.dirname(__file__), "..", "data", "auction.json")
    if os.path.exists(af):
        try:
            with open(af) as f: return json.load(f)
        except: pass
    return {"listings": []}

def save_auction(data):
    af = os.path.join(os.path.dirname(__file__), "..", "data", "auction.json")
    with open(af, "w") as f: json.dump(data, f, indent=2)

@app.route("/api/auction/list", methods=["POST"])
@app.route("/api/auction/list_item", methods=["POST"])
@login_required
def api_auction_list_item():
    data = request.json or {}
    item_id = data.get("item_id", "").lower()
    price = int(data.get("price", 0))
    if price < 1: return jsonify({"error": "Price must be >= 1 coin"}), 400
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    inventory = player.get("inventory", [])
    found_idx, listed_item = -1, None
    for i, item in enumerate(inventory):
        if isinstance(item, dict):
            curr_id = item.get("id", item.get("name", "").lower().replace(" ", "_"))
            if curr_id == item_id:
                found_idx = i; listed_item = item; break
    if found_idx == -1: return jsonify({"error": "Item not in inventory"}), 404
    auction = load_auction()
    listing = {"id": f"ah_{int(time.time())}_{session['user_id']}",
               "seller_id": session["user_id"], "seller_name": session.get("username", "Player"),
               "item": listed_item, "price": price, "listed_at": time.time()}
    auction["listings"].append(listing)
    save_auction(auction)
    inventory.pop(found_idx)
    player["inventory"] = inventory
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "message": f"Listed {listed_item.get('name')} for {price} coins!"})

@app.route("/api/auction/buy", methods=["POST"])
@login_required
def api_auction_buy():
    listing_id = (request.json or {}).get("listing_id", "")
    auction = load_auction()
    listing = next((l for l in auction["listings"] if l["id"] == listing_id), None)
    if not listing: return jsonify({"error": "Listing not found or sold"}), 404
    if listing["seller_id"] == session["user_id"]:
        return jsonify({"error": "Cannot buy your own listing"}), 400
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    if player.get("coins", 0) < listing["price"]:
        return jsonify({"error": f"Need {listing['price']} coins"}), 400
    player["coins"] -= listing["price"]
    player.setdefault("inventory", []).append(listing["item"])
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    seller = get_player(session.get("guild_id", HOME_GUILD_ID), listing["seller_id"])
    seller["coins"] = seller.get("coins", 0) + listing["price"]
    seller.setdefault("mail", []).append({
        "icon": "💰", "title": "Auction Sale!", "claimed": False,
        "message": f"{session.get('username','Someone')} bought {listing['item'].get('name','item')} for {listing['price']} coins!",
        "reward_text": f"+{listing['price']} coins"})
    save_player(session.get("guild_id", HOME_GUILD_ID), listing["seller_id"], seller)
    auction["listings"] = [l for l in auction["listings"] if l["id"] != listing_id]
    save_auction(auction)
    return jsonify({"success": True, "message": f"Bought {listing['item'].get('name')} for {listing['price']} coins!"})

@app.route("/api/auction/cancel", methods=["POST"])
@login_required
def api_auction_cancel():
    listing_id = (request.json or {}).get("listing_id", "")
    auction = load_auction()
    listing = next((l for l in auction["listings"] if l["id"] == listing_id), None)
    if not listing: return jsonify({"error": "Not found"}), 404
    if listing["seller_id"] != session["user_id"]: return jsonify({"error": "Not your listing"}), 403
    auction["listings"] = [l for l in auction["listings"] if l["id"] != listing_id]
    save_auction(auction)
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    player.setdefault("inventory", []).append(listing["item"])
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "message": "Listing cancelled. Item returned."})

@app.route("/api/auction/listings")
def api_auction_listings():
    auction = load_auction()
    now = time.time()
    valid = [l for l in auction.get("listings", []) if now - l.get("listed_at", now) < 604800]
    if len(valid) != len(auction.get("listings", [])):
        auction["listings"] = valid; save_auction(auction)
    return jsonify({"listings": valid})

# ══════════════════════════════════════════════
# 🔨 BLACKSMITH & CRAFTING
# ══════════════════════════════════════════════

CRAFT_RECIPES = {
    "iron_sword":   {"name":"Iron Sword",         "icon":"⚔️","type":"weapon","rarity":"common",
                     "stats":{"attack":20},       "cost":{"Iron Ore":3},                             "coins":100},
    "steel_sword":  {"name":"Steel Sword",        "icon":"⚔️","type":"weapon","rarity":"uncommon",
                     "stats":{"attack":50},       "cost":{"Iron Ore":5,"Undead Bones":2},            "coins":250},
    "dragon_blade": {"name":"Dragon Blade",       "icon":"🐉","type":"weapon","rarity":"rare",
                     "stats":{"attack":120},      "cost":{"Dragon Scales":4,"Iron Ore":3},           "coins":500},
    "bone_armor":   {"name":"Bone Armor",         "icon":"🛡️","type":"armor","rarity":"common",
                     "stats":{"defense":15},      "cost":{"Undead Bones":4},                         "coins":100},
    "silk_robe":    {"name":"Silk Robe",          "icon":"👘","type":"armor","rarity":"uncommon",
                     "stats":{"defense":30,"health":50},"cost":{"Silk Cloth":4},                     "coins":200},
    "dragon_armor": {"name":"Dragon Scale Armor", "icon":"🐉","type":"armor","rarity":"rare",
                     "stats":{"defense":80,"health":150},"cost":{"Dragon Scales":6,"Silk Cloth":2},  "coins":600},
    "abyssal_blade":    {"name":"Abyssal Blade",       "icon":"🌊","type":"weapon","rarity":"rare",
                     "stats":{"attack":180,"defense":20},"cost":{"Dragon Scales":6,"Undead Bones":4}, "coins":800},
    "stormbreaker":     {"name":"Stormbreaker",        "icon":"⚡","type":"weapon","rarity":"epic",
                     "stats":{"attack":260,"defense":30},"cost":{"Dragon Scales":10,"Silk Cloth":4}, "coins":1200},
    "celestial_scepter":{"name":"Celestial Scepter",   "icon":"🌟","type":"weapon","rarity":"legendary",
                     "stats":{"attack":350,"defense":45,"health":100},"cost":{"Dragon Scales":12,"Silk Cloth":6,"Iron Ore":5},"coins":2000},
    "iron_helmet":  {"name":"Iron Helmet",     "icon":"⛑️","type":"helmet","rarity":"common",
                     "stats":{"defense":12},   "cost":{"Iron Ore":3},                               "coins":90},
    "knight_helm":  {"name":"Knight Helm",     "icon":"⛑️","type":"helmet","rarity":"uncommon",
                     "stats":{"defense":35,"health":30},"cost":{"Iron Ore":5,"Silk Cloth":2},       "coins":220},
    "dragon_helm":  {"name":"Dragon Helm",     "icon":"🐉","type":"helmet","rarity":"rare",
                     "stats":{"defense":90,"health":120},"cost":{"Dragon Scales":5,"Iron Ore":3},   "coins":550},
    "abyssal_crown":{"name":"Abyssal Crown",   "icon":"🌊","type":"helmet","rarity":"epic",
                     "stats":{"defense":150,"health":200,"attack":20},"cost":{"Dragon Scales":8,"Silk Cloth":5},"coins":1100},
}

@app.route("/api/blacksmith/craft", methods=["POST"])
@login_required
def api_blacksmith_craft():
    recipe_id = (request.json or {}).get("recipe_id", "")
    recipe = CRAFT_RECIPES.get(recipe_id)
    if not recipe: return jsonify({"error": "Unknown recipe"}), 400
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    if player.get("coins", 0) < recipe["coins"]:
        return jsonify({"error": f"Need {recipe['coins']} coins"}), 400
    inventory = player.get("inventory", [])
    mat_counts = {}
    for item in inventory:
        if isinstance(item, dict):
            mat_counts[item.get("name", "")] = mat_counts.get(item.get("name",""), 0) + 1
    for mat, qty in recipe["cost"].items():
        if mat_counts.get(mat, 0) < qty:
            return jsonify({"error": f"Need {qty}x {mat} (have {mat_counts.get(mat,0)})"}), 400
    for mat, qty in recipe["cost"].items():
        removed, new_inv = 0, []
        for item in inventory:
            if isinstance(item, dict) and item.get("name") == mat and removed < qty:
                removed += 1
            else:
                new_inv.append(item)
        inventory = new_inv
    player["inventory"] = inventory
    player["coins"] -= recipe["coins"]
    new_item = {"id": recipe_id, "name": recipe["name"], "type": recipe["type"],
                "rarity": recipe["rarity"], "stats": recipe["stats"], "category": recipe["type"]}
    player["inventory"].append(new_item)
    bump_mission(player, "craft")
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "message": f"Crafted {recipe['icon']} {recipe['name']}!", "item": new_item})

def _forge_pair(a, b, salt=0):
    """Shared 2-gear → 1 gear roll. Caller guarantees both are gear of the same non-unique rarity."""
    rarity_a = str(a.get("rarity", "common")).lower()
    base_idx = RARITY_ORDER.get(rarity_a, 0)
    # Result roll: mostly one tier up, small chance to jump 2-5 tiers (up to unique).
    # Probabilities always add to 100 across every reachable outcome.
    tiers = [(1, 70), (2, 20), (3, 7), (4, 2.5), (5, 0.5)]
    weights, labels = [], []
    for jump, w in tiers:
        target = base_idx + jump
        if target <= RARITY_ORDER["unique"]:
            weights.append(w)
            labels.append(target)
    result_idx = random.choices(labels, weights)[0]
    result_rarity = [r for r, i in RARITY_ORDER.items() if i == result_idx][0]
    # Stats scale with the rarity multiplier ratio
    mult_ratio = _SHOP_RARITY_MULT[result_rarity] / _SHOP_RARITY_MULT[rarity_a]
    src = a if a.get("stats") else b
    stats = {}
    for k, v in (src.get("stats") or {}).items():
        if k == "heal":
            continue
        stats[k] = max(1, int(v * mult_ratio))
    base_name = str(a.get("name", "Gear"))
    for old in ("Common ", "Uncommon ", "Rare ", "Epic ", "Legendary ", "Unique "):
        base_name = base_name.replace(old, "")
    new_item = {"id": f"forge_{result_rarity}_{int(time.time() * 1000)}_{salt}",
                "name": f"{result_rarity.title()} {base_name}", "type": a.get("type"),
                "icon": a.get("icon", "⚔️"), "rarity": result_rarity,
                "stats": stats, "category": a.get("type")}
    return new_item, result_rarity

@app.route("/api/blacksmith/forge", methods=["POST"])
@login_required
def api_blacksmith_forge():
    """Combine 2 same-rarity gear items → one item of a higher rarity (mostly +1 tier, small chance to jump higher)."""
    item_ids = (request.json or {}).get("item_ids", [])
    if not isinstance(item_ids, list) or len(item_ids) != 2 or len(set(item_ids)) != 2:
        return jsonify({"error": "Select exactly 2 items to forge."}), 400
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    inventory = player.get("inventory", [])
    picked, missing = [], []
    for want in item_ids:
        found = None
        for it in inventory:
            if isinstance(it, dict) and it.get("id") == want:
                found = it
                break
        if found is None:
            missing.append(want)
        else:
            picked.append(found)
    if missing:
        return jsonify({"error": "One or both items not found in inventory."}), 400
    a, b = picked
    if a.get("type") in ("potion", "material", "misc") or b.get("type") in ("potion", "material", "misc"):
        return jsonify({"error": "Only gear (weapon / armor / helmet) can be forged."}), 400
    rarity_a, rarity_b = str(a.get("rarity", "common")).lower(), str(b.get("rarity", "common")).lower()
    if rarity_a != rarity_b:
        return jsonify({"error": "Both items must be the same rarity."}), 400
    if RARITY_ORDER.get(rarity_a, 0) >= RARITY_ORDER["unique"]:
        return jsonify({"error": "Unique items are already the rarest — cannot forge higher."}), 400
    new_item, result_rarity = _forge_pair(a, b)
    removed = 0
    new_inv = []
    for it in inventory:
        if removed < 2 and isinstance(it, dict) and it.get("id") in item_ids:
            removed += 1
        else:
            new_inv.append(it)
    player["inventory"] = new_inv
    player["inventory"].append(new_item)
    bump_mission(player, "craft")
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "message": f"🔨 Forged {new_item['icon']} {new_item['name']} ({result_rarity})!",
                    "item": new_item, "result_rarity": result_rarity})

@app.route("/api/blacksmith/auto_forge", methods=["POST"])
@login_required
def api_blacksmith_auto_forge():
    """Auto-forge ALL forgeable gear: repeatedly merge 2 same-rarity, same-type gear → higher rarity."""
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    gate = _unlock_gate(player, "auto_smith")
    if gate: return gate
    inventory = [i for i in player.get("inventory", [])
                 if isinstance(i, dict) and i.get("type") in ("weapon", "armor", "helmet")]
    forges = 0
    changed = True
    while changed:
        changed = False
        groups = {}
        for it in inventory:
            r = str(it.get("rarity", "common")).lower()
            if RARITY_ORDER.get(r, 0) >= RARITY_ORDER["unique"]:
                continue
            groups.setdefault((r, it.get("type")), []).append(it)
        for (r, typ), group in groups.items():
            if len(group) < 2:
                continue
            a, b = group[0], group[1]
            new_item, result_rarity = _forge_pair(a, b, forges)
            gone = {a.get("id"), b.get("id")}
            inventory = [i for i in inventory if i.get("id") not in gone]
            inventory.append(new_item)
            forges += 1
            changed = True
            break  # re-group after each forge — results can forge again
    if forges == 0:
        return jsonify({"error": "Nothing to forge — need 2+ gear items of the same rarity & type."}), 400
    player["inventory"] = [i for i in player.get("inventory", [])
                           if not (isinstance(i, dict) and i.get("type") in ("weapon", "armor", "helmet"))] + inventory
    for _ in range(forges):
        bump_mission(player, "craft")
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True,
                    "message": f"⚒️ Auto-Forged {forges} time(s) — all same-rarity gear merged into higher tiers!"})

@app.route("/api/blacksmith/recipes")
def api_blacksmith_recipes():
    return jsonify({"recipes": [{"id": k, **v} for k, v in CRAFT_RECIPES.items()]})

# 🏥 HEALTH CHECK (for service monitoring)
# ══════════════════════════════════════════════

@app.route("/health")
def health_check():
    return jsonify({"status": "ok", "timestamp": time.time()})

# ══════════════════════════════════════════════
# 💬 CHAT SYSTEM
# ══════════════════════════════════════════════

CHAT_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "chat.json")

def load_chat():
    if not os.path.exists(CHAT_DATA_PATH):
        return {"world": [], "guild": {}, "dm": {}, "friends": {}, "friend_requests": {}}
    with open(CHAT_DATA_PATH) as f:
        try:
            data = json.load(f)
        except Exception:
            data = None
    # Self-heal: an old list/empty file (bot-era format) must not 500 every chat send
    if not isinstance(data, dict):
        data = {"world": [], "guild": {}, "dm": {}, "friends": {}, "friend_requests": {}}
    data.setdefault("world", [])
    data.setdefault("guild", {})
    data.setdefault("dm", {})
    data.setdefault("friends", {})
    data.setdefault("friend_requests", {})
    return data

def save_chat(data):
    os.makedirs(os.path.dirname(CHAT_DATA_PATH), exist_ok=True)
    with open(CHAT_DATA_PATH, "w") as f:
        json.dump(data, f, indent=2)

@app.route("/chat")
@login_required
def chat_page():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    return render_template("chat.html", player=player, username=session.get("username", "Player"),
                           avatar_url=session_avatar(session))

@app.route("/api/chat/world")
@login_required
def api_chat_world():
    chat = load_chat()
    since = request.args.get("since", 0, type=float)
    msgs = [m for m in chat.get("world", []) if m["ts"] > since][-50:]
    return jsonify({"messages": msgs})

@app.route("/api/chat/world", methods=["POST"])
@login_required
def api_chat_world_send():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    data = request.get_json()
    msg = (data.get("msg") or "").strip()
    if not msg:
        return jsonify({"error": "Empty message"}), 400
    if len(msg) > 200:
        return jsonify({"error": "Max 200 chars"}), 400
    now = time.time()
    if now - player.get("last_chat", 0) < 3:
        return jsonify({"error": "Wait 3s between messages"}), 429
    player["last_chat"] = now
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    chat = load_chat()
    chat.setdefault("world", []).append({
        "user": session.get("username", "Player"),
        "avatar": get_avatar_url(session["user_id"], session.get("avatar", "")),
        "user_id": session["user_id"],
        "msg": msg, "ts": now
    })
    chat["world"] = chat["world"][-200:]
    save_chat(chat)
    return jsonify({"success": True})

@app.route("/api/chat/guild")
@login_required
def api_chat_guild():
    chat = load_chat()
    guild_id = session.get("guild_id", HOME_GUILD_ID)
    since = request.args.get("since", 0, type=float)
    msgs = [m for m in chat.setdefault("guild", {}).get(guild_id, []) if m["ts"] > since][-50:]
    return jsonify({"messages": msgs})

@app.route("/api/chat/guild", methods=["POST"])
@login_required
def api_chat_guild_send():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    data = request.get_json()
    msg = (data.get("msg") or "").strip()
    if not msg: return jsonify({"error": "Empty"}), 400
    if len(msg) > 200: return jsonify({"error": "Max 200 chars"}), 400
    now = time.time()
    if now - player.get("last_chat", 0) < 3:
        return jsonify({"error": "Wait 3s"}), 429
    player["last_chat"] = now
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    chat = load_chat()
    guild_id = session.get("guild_id", HOME_GUILD_ID)
    chat.setdefault("guild", {}).setdefault(guild_id, []).append({
        "user": session.get("username", "Player"),
        "avatar": get_avatar_url(session["user_id"], session.get("avatar", "")),
        "user_id": session["user_id"],
        "msg": msg, "ts": now
    })
    chat["guild"][guild_id] = chat["guild"][guild_id][-200:]
    save_chat(chat)
    return jsonify({"success": True})

@app.route("/api/chat/dm")
@login_required
def api_chat_dm():
    chat = load_chat()
    with_user = request.args.get("with_user_id", "")
    since = request.args.get("since", 0, type=float)
    key = "_".join(sorted([session["user_id"], with_user]))
    msgs = [m for m in chat.setdefault("dm", {}).get(key, []) if m["ts"] > since][-50:]
    return jsonify({"messages": msgs})

@app.route("/api/chat/dm", methods=["POST"])
@login_required
def api_chat_dm_send():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    data = request.get_json()
    msg = (data.get("msg") or "").strip()
    to_uid = (data.get("to_user_id") or "").strip()
    if not msg or not to_uid: return jsonify({"error": "Missing msg or to_user_id"}), 400
    if len(msg) > 200: return jsonify({"error": "Max 200 chars"}), 400
    now = time.time()
    if now - player.get("last_chat", 0) < 2:
        return jsonify({"error": "Wait 2s"}), 429
    player["last_chat"] = now
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    chat = load_chat()
    key = "_".join(sorted([session["user_id"], to_uid]))
    chat.setdefault("dm", {}).setdefault(key, []).append({
        "user": session.get("username", "Player"),
        "avatar": get_avatar_url(session["user_id"], session.get("avatar", "")),
        "user_id": session["user_id"],
        "msg": msg, "ts": now
    })
    chat["dm"][key] = chat["dm"][key][-200:]
    save_chat(chat)
    return jsonify({"success": True})

@app.route("/api/friends/list")
@login_required
def api_friends_list():
    chat = load_chat()
    uid = session["user_id"]
    friend_ids = chat.setdefault("friends", {}).get(uid, [])
    players = load_players()
    now_ts = time.time()
    friends = []
    for fid in friend_ids:
        for p in players.values():
            if p.get("user_id") == fid:
                friends.append({
                    "user_id": fid,
                    "username": p.get("username", p.get("name", "?")),
                    "online": (now_ts - p.get("last_seen", 0)) < 600
                })
                break
    requests = []
    for req in chat.setdefault("friend_requests", {}).get(uid, []):
        requests.append({"from": req.get("from", "?"), "from_id": req.get("from_id", "")})
    return jsonify({"friends": friends, "requests": requests})

@app.route("/api/friends/request", methods=["POST"])
@login_required
def api_friends_request():
    data = request.get_json()
    to_uid = (data.get("to_user_id") or "").strip()
    if not to_uid or to_uid == session["user_id"]:
        return jsonify({"error": "Invalid user"}), 400
    chat = load_chat()
    uid = session["user_id"]
    if to_uid in chat.setdefault("friends", {}).get(uid, []):
        return jsonify({"error": "Already friends"}), 400
    chat.setdefault("friend_requests", {}).setdefault(to_uid, []).append({
        "from": session.get("username", "Player"),
        "from_id": uid,
        "ts": time.time()
    })
    # Trim old requests per user to max 50
    chat["friend_requests"][to_uid] = chat["friend_requests"][to_uid][-50:]
    save_chat(chat)
    return jsonify({"message": "Friend request sent!"})

@app.route("/api/friends/accept", methods=["POST"])
@login_required
def api_friends_accept():
    data = request.get_json()
    from_uid = data.get("from_user_id", "")
    chat = load_chat()
    uid = session["user_id"]
    requests = chat.setdefault("friend_requests", {}).get(uid, [])
    chat["friend_requests"][uid] = [r for r in requests if r.get("from_id") != from_uid]
    chat.setdefault("friends", {}).setdefault(uid, []).append(from_uid)
    chat.setdefault("friends", {}).setdefault(from_uid, []).append(uid)
    save_chat(chat)
    return jsonify({"success": True})

@app.route("/api/friends/decline", methods=["POST"])
@login_required
def api_friends_decline():
    data = request.get_json()
    from_uid = data.get("from_user_id", "")
    chat = load_chat()
    uid = session["user_id"]
    requests = chat.setdefault("friend_requests", {}).get(uid, [])
    chat["friend_requests"][uid] = [r for r in requests if r.get("from_id") != from_uid]
    save_chat(chat)
    return jsonify({"success": True})

# ══════════════════════════════════════════════
@app.route("/duels")
@login_required
def duels_page():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    return render_template("duels.html", player=player,
        username=session.get("username", "Player"),
        avatar_url=session_avatar(session)
    )


# ⚔️ DUEL ARENA (AI + PVP)
# ══════════════════════════════════════════════

DUEL_MIN_LEVEL = 5  # PvP challenges unlock at Lv.5

AI_ENEMIES = {
    "goblin": {"name": "Goblin Champion", "level": 5, "hp": 60, "atk": 15, "def": 5, "coins": 15, "xp": 20},
    "golem": {"name": "Stone Golem", "level": 15, "hp": 200, "atk": 25, "def": 18, "coins": 40, "xp": 55},
    "assassin": {"name": "Shadow Assassin", "level": 25, "hp": 150, "atk": 40, "def": 10, "coins": 70, "xp": 90},
    "drake": {"name": "Fire Drake", "level": 40, "hp": 400, "atk": 60, "def": 22, "coins": 130, "xp": 160},
    "titan": {"name": "Void Titan", "level": 60, "hp": 800, "atk": 90, "def": 40, "coins": 250, "xp": 300},
    "overlord": {"name": "Chaos Overlord", "level": 80, "hp": 1500, "atk": 130, "def": 60, "coins": 500, "xp": 600},
}

@app.route("/api/duel/ai", methods=["POST"])
@login_required
def api_duel_ai():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    calc_stats(player)
    data = request.get_json()
    eid = data.get("enemy_id", "")
    if eid not in AI_ENEMIES:
        return jsonify({"error": "Invalid enemy"}), 400
    enemy = AI_ENEMIES[eid]
    now = time.time()
    if now - player.get("last_duel", 0) < 5:
        return jsonify({"error": f"Wait {int(5-(now-player.get('last_duel',0)))}s"}), 429
    player["last_duel"] = now

    p_hp = player.get("max_health", 100)
    p_atk = player.get("attack", 10)
    p_def = player.get("defense", 5)
    e_hp = enemy["hp"]
    e_atk = enemy["atk"]
    e_def = enemy["def"]
    log = []
    turn = 0
    while p_hp > 0 and e_hp > 0 and turn < 20:
        turn += 1
        # Player attacks enemy
        dmg = max(1, p_atk - e_def // 2 + random.randint(-3, 5))
        if random.random() < 0.15:
            dmg = int(dmg * 1.5)
            e_hp -= dmg
            log.append(f"⚔️ You CRIT {enemy['name']} for {dmg} damage! (💥{e_hp}HP left)")
        else:
            e_hp -= dmg
            log.append(f"⚔️ You attack {enemy['name']} for {dmg} damage ({e_hp}HP left)")
        if e_hp <= 0:
            log.append(f"🏆 You defeated {enemy['name']}!")
            break
        # Enemy attacks player
        dmg2 = max(1, e_atk - p_def // 2 + random.randint(-3, 5))
        if random.random() < 0.1:
            dmg2 = int(dmg2 * 1.5)
            p_hp -= dmg2
            log.append(f"🔥 {enemy['name']} CRITS you for {dmg2} damage! (❤️{p_hp}HP left)")
        else:
            p_hp -= dmg2
            log.append(f"🔥 {enemy['name']} attacks you for {dmg2} damage ({p_hp}HP left)")
        if p_hp <= 0:
            log.append(f"💀 You were defeated by {enemy['name']}...")
            break

    if p_hp <= 0:
        result = "loss"
        gain_xp = 0
        gain_coins = 0
        player["health"] = max(1, p_hp)
    else:
        result = "win"
        gain_xp = enemy["xp"]
        gain_coins = enemy["coins"]
        player["health"] = min(player.get("max_health", 100), p_hp)
        player["xp"] = player.get("xp", 0) + gain_xp
        player["coins"] = player.get("coins", 0) + gain_coins
        # Loot drop
        from game_logic import roll_loot as _roll_loot3
        _duel_loot = _roll_loot3(player, source="duel_ai", is_boss=(enemy.get("level",1) >= 40))
        if _duel_loot:
            log.append(f"🎁 {_duel_loot}")
        # Check level up (capped at 100)
        from game_logic import level_up as _level_up3
        lv_gained = _level_up3(player)
        check_milestones(player)
        check_titles(player)
        for _i in range(lv_gained):
            log.append(f"🎉 LEVEL UP! You are now Lv.{player['level'] - lv_gained + _i + 1}!")
        # Dual class earns 50% of duel XP
        if player.get("has_second_class"):
            _grant_second_class_xp(player, gain_xp // 2, log)
        bump_mission(player, "duel")
        bump_mission(player, "coins", gain_coins)

    # Auto-drink at <=50% HP after duel damage (win or loss)
    _drank, _dmsg = maybe_auto_drink(player)
    if _drank:
        log.append(_dmsg)

    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"result": result, "log": log, "xp": gain_xp, "coins": gain_coins, "player_hp_left": p_hp})

@app.route("/api/duel/pending")
@login_required
def api_duel_pending():
    duels = load_duels()
    uid = session["user_id"]
    pending, later, sent = [], [], []
    for k, v in duels.items():
        if not isinstance(v, dict):
            continue
        if v.get("target_id") == uid and v.get("status") in ("pending", "later"):
            item = {"from_user_id": v.get("challenger_id"), "from_name": v.get("challenger_name", "?")}
            (later if v.get("status") == "later" else pending).append(item)
        elif v.get("challenger_id") == uid and v.get("status") == "pending":
            sent.append({"target_user_id": v.get("target_id"), "target_name": v.get("target_name", "?")})
    return jsonify({"challenges": pending, "later": later, "sent": sent})


@app.route("/api/duel/challenge", methods=["POST"])
@login_required
def api_duel_challenge():
    data = request.get_json()
    target = data.get("target_user_id", "")
    if not target or target == session["user_id"]:
        return jsonify({"error": "Invalid target"}), 400
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    if player.get("level", 1) < DUEL_MIN_LEVEL:
        return jsonify({"error": f"Reach Lv.{DUEL_MIN_LEVEL} to challenge players!"}), 403
    duels = load_duels()
    key = f"{session['user_id']}_to_{target}"
    if duels.get(key, {}).get("status") == "pending":
        return jsonify({"error": "Challenge already sent"}), 400
    duels[key] = {
        "challenger_id": session["user_id"],
        "challenger_name": session.get("username", "Player"),
        "target_id": target,
        "target_name": data.get("target_name", "?"),
        "status": "pending",
        "ts": time.time()
    }
    save_duels(duels)
    return jsonify({"message": "Challenge sent!", "key": key})


@app.route("/api/duel/later", methods=["POST"])
@login_required
def api_duel_later():
    data = request.get_json()
    from_uid = data.get("from_user_id", "")
    duels = load_duels()
    key = f"{from_uid}_to_{session['user_id']}"
    if key in duels and duels[key].get("status") == "pending":
        duels[key]["status"] = "later"
        save_duels(duels)
    return jsonify({"success": True})


@app.route("/api/duel/cancel", methods=["POST"])
@login_required
def api_duel_cancel():
    data = request.get_json()
    target = data.get("target_user_id", "")
    duels = load_duels()
    key = f"{session['user_id']}_to_{target}"
    if key in duels and duels[key].get("status") == "pending":
        del duels[key]
        save_duels(duels)
    return jsonify({"success": True})


@app.route("/api/duel/decline", methods=["POST"])
@login_required
def api_duel_decline():
    data = request.get_json()
    from_uid = data.get("from_user_id", "")
    duels = load_duels()
    key = f"{from_uid}_to_{session['user_id']}"
    if key in duels:
        duels[key]["status"] = "declined"
        save_duels(duels)
    return jsonify({"success": True})


# ⚔️ ARENA COOLDOWNS (rounds before a skill can be used again)
ARENA_COOLDOWNS = {
    "Power Strike": 0, "Iron Wall": 2, "Swift Step": 1, "Berserk": 3,
    "Meditate": 3, "Shadow Strike": 2, "Fortress": 3, "Flame Burst": 3,
    "Thunderclap": 3, "Divine Shield": 4, "Life Steal": 3, "Blade Dance": 3,
    "Earthshaker": 4, "Mana Surge": 4,
}
ARENA_FUNDS = {"win_xp": 60, "win_coins": 50}


def _arena_fighter_snapshot(player):
    """Snapshot combat stats + owned skills with cooldown state for arena."""
    calc_stats(player)
    skills = {}
    owned = player.get("skills", {}) or {}
    for name in SKILLS:
        if name in owned:
            skills[name] = {"cd": 0}
    return {
        "name": player.get("name") or player.get("username") or "Player",
        "level": player.get("level", 1),
        "rank": player.get("duel_rank", "Rookie"),
        "hp": player.get("max_health", 100),
        "max_hp": player.get("max_health", 100),
        "atk": player.get("attack", 10),
        "def": player.get("defense", 5),
        "skills": skills,
        "locked": None,
        "auto": False,
        "last_seen": time.time(),
        "avatar": get_player_avatar(player),
    }


def _arena_resolve_round(duel):
    """Both fighters locked -> resolve one round. Returns list of new log lines."""
    from game_data import SKILLS as _SK
    f = duel["fighters"]
    ids = list(f.keys())
    a, b = ids[0], ids[1]
    lines = []
    now = time.time()

    # Heal phase (hp-bonus skills act first)
    for fid in ids:
        fighter, foe = f[fid], f[ids[1] if fid == ids[0] else ids[0]]
        sk = fighter.get("locked")
        if sk and sk != "basic" and _SK.get(sk, {}).get("hp", 0) > 0 and foe["hp"] > 0:
            heal = _SK[sk]["hp"]
            before = fighter["hp"]
            fighter["hp"] = min(fighter["max_hp"], fighter["hp"] + heal)
            lines.append(f"✨ {fighter['name']} uses {_SK[sk]['emoji']} {sk} — +{fighter['hp']-before} HP")
            if fighter["hp"] >= fighter["max_hp"]:
                lines.append(f"💖 {fighter['name']} is at full health!")

    # Damage phase (simultaneous)
    for fid in ids:
        fighter, foe = f[fid], f[ids[1] if fid == ids[0] else ids[0]]
        if foe["hp"] <= 0:
            continue
        sk = fighter.get("locked") or "basic"
        if sk == "basic":
            sk_atk, sk_def, emoji = 0, 0, "⚔️"
        else:
            info = _SK.get(sk, {})
            sk_atk, sk_def, emoji = info.get("atk", 0), info.get("def", 0), info.get("emoji", "⚡")
        dmg = max(1, fighter["atk"] + sk_atk - foe["def"] // 2 - sk_def // 2 + random.randint(-3, 4))
        crit = random.random() < 0.10
        if crit:
            dmg = int(dmg * 1.5)
        foe["hp"] = max(0, foe["hp"] - dmg)
        skill_tag = f"{emoji} {sk}" if sk != "basic" else "⚔️ attacks"
        if crit:
            lines.append(f"💥 {fighter['name']} {skill_tag} — CRIT {dmg} dmg! {foe['name']} ❤️{foe['hp']} left")
        else:
            lines.append(f"🗡️ {fighter['name']} {skill_tag} — {dmg} dmg. {foe['name']} ❤️{foe['hp']} left")

    # Cooldowns tick + reset locks
    for fid in ids:
        fighter = f[fid]
        used = fighter.get("locked")
        for name, st in fighter.get("skills", {}).items():
            st["cd"] = max(0, st["cd"] - 1)
        if used and used != "basic":
            fighter["skills"].setdefault(used, {"cd": 0})["cd"] = ARENA_COOLDOWNS.get(used, 2)
        fighter["locked"] = None
        fighter["auto"] = False

    duel["round"] += 1
    duel["log"].extend(lines)
    duel["log"] = duel["log"][-60:]
    duel["turn_ts"] = now

    # Win check
    a_hp, b_hp = f[a]["hp"], f[b]["hp"]
    if a_hp <= 0 or b_hp <= 0:
        if a_hp > b_hp:
            duel["winner_id"] = a
        elif b_hp > a_hp:
            duel["winner_id"] = b
        else:
            duel["winner_id"] = None  # draw
        duel["status"] = "finished"
        duel["ended_ts"] = now
        if duel["winner_id"]:
            duel["log"].append(f"🏆 {f[duel['winner_id']]['name']} WINS THE ARENA BATTLE!")
        else:
            duel["log"].append("🤝 DOUBLE KNOCKOUT — IT'S A DRAW!")
    else:
        duel["log"].append(f"⏳ Round {duel['round']} over — pick your next move!")
    return lines


def _arena_auto_fill(duel):
    """Offline fighters get an auto-picked skill so fights never stall."""
    now = time.time()
    changed = False
    for fid, fighter in duel.get("fighters", {}).items():
        if fighter.get("locked") is None and now - fighter.get("last_seen", now) > 20:
            avail = ["basic"] + [n for n, st in fighter.get("skills", {}).items() if st.get("cd", 0) <= 0]
            pick = random.choice(avail)
            fighter["locked"] = pick
            fighter["auto"] = True
            changed = True
    return changed


def _arena_rewards(duel):
    """Apply win/loss rewards to both players."""
    f = duel["fighters"]
    ids = list(f.keys())
    winner_id = duel.get("winner_id")
    for fid in ids:
        fighter = f[fid]
        p = get_player(HOME_GUILD_ID, fid)
        if not p:
            continue
        p["health"] = max(1, fighter["hp"])
        if winner_id is None:
            pass
        elif fid == winner_id:
            p["duel_wins"] = p.get("duel_wins", 0) + 1
            p["duel_streak"] = p.get("duel_streak", 0) + 1
            p["xp"] = p.get("xp", 0) + ARENA_FUNDS["win_xp"]
            p["coins"] = p.get("coins", 0) + ARENA_FUNDS["win_coins"]
            bump_mission(p, "duel")
            bump_mission(p, "coins", ARENA_FUNDS["win_coins"])
            from game_logic import level_up as _lu_arena
            _lu_arena(p)
            check_milestones(p)
            if p.get("has_second_class"):
                _grant_second_class_xp(p, ARENA_FUNDS["win_xp"] // 2, [])
            duel["log"].append(f"🎁 {fighter['name']} earns +{ARENA_FUNDS['win_xp']} XP & 🪙{ARENA_FUNDS['win_coins']}!")
        else:
            p["duel_losses"] = p.get("duel_losses", 0) + 1
            p["duel_streak"] = 0
        save_player(HOME_GUILD_ID, fid, p)
        if winner_id and fid in (winner_id, [x for x in ids if x != winner_id][0]):
            q = get_player(HOME_GUILD_ID, fid)
            if q:
                update_duel_rank(q)
                save_player(HOME_GUILD_ID, fid, q)


@app.route("/api/duel/accept", methods=["POST"])
@login_required
def api_duel_accept():
    data = request.get_json()
    from_uid = data.get("from_user_id", "")
    if not from_uid:
        return jsonify({"error": "Missing from_user_id"}), 400
    duels = load_duels()
    key = f"{from_uid}_to_{session['user_id']}"
    challenge = duels.get(key)
    if not challenge or challenge.get("status") not in ("pending", "later"):
        return jsonify({"error": "No pending challenge"}), 400

    p1 = get_player(HOME_GUILD_ID, from_uid)
    p2 = get_player(HOME_GUILD_ID, session["user_id"])
    if not p1 or not p2:
        return jsonify({"error": "Player not found"}), 400

    duel = {
        "challenger_id": from_uid,
        "challenger_name": challenge.get("challenger_name", "?"),
        "target_id": session["user_id"],
        "status": "arena",
        "ts": time.time(),
        "round": 0,
        "fighters": {
            from_uid: _arena_fighter_snapshot(p1),
            session["user_id"]: _arena_fighter_snapshot(p2),
        },
        "log": [f"🔥 {p1.get('name','Challenger')} vs {p2.get('name','Defender')} — THE ARENA AWAITS!",
                "⚡ Pick a skill and LOCK IN when ready!"],
        "winner_id": None,
        "turn_ts": time.time(),
    }
    duels[key] = duel
    save_duels(duels)
    return jsonify({"message": "Duel started!", "key": key})


@app.route("/api/duel/arena/<key>")
@login_required
def api_duel_arena_state(key):
    duels = load_duels()
    duel = duels.get(key)
    if not duel or duel.get("status") not in ("arena", "finished"):
        return jsonify({"error": "Arena not found"}), 404
    uid = session["user_id"]
    if uid not in duel.get("fighters", {}):
        return jsonify({"error": "Not your duel"}), 403

    # Polling = active; keep my last_seen fresh so auto-fill never targets me
    duel["fighters"][uid]["last_seen"] = time.time()

    _arena_auto_fill(duel)
    if all(f.get("locked") is not None for f in duel["fighters"].values()):
        _arena_resolve_round(duel)
        if duel["status"] == "finished":
            _arena_rewards(duel)
        save_duels(duels)

    f = duel["fighters"]
    me = f.get(uid, {})
    opp_id = [x for x in f.keys() if x != uid][0]
    opp = f.get(opp_id, {})
    return jsonify({
        "key": key,
        "status": duel["status"],
        "round": duel["round"],
        "log": duel["log"][-30:],
        "winner_id": duel.get("winner_id"),
        "opp_auto_in": max(0, int(20 - (time.time() - opp.get("last_seen", time.time())))),
        "me": {"id": uid, "name": me.get("name"), "level": me.get("level"), "rank": me.get("rank"),
               "hp": me.get("hp"), "max_hp": me.get("max_hp"), "atk": me.get("atk"), "def": me.get("def"),
               "locked": me.get("locked"), "auto": me.get("auto"), "avatar": me.get("avatar"),
               "skills": me.get("skills", {})},
        "opp": {"id": opp_id, "name": opp.get("name"), "level": opp.get("level"), "rank": opp.get("rank"),
                "hp": opp.get("hp"), "max_hp": opp.get("max_hp"), "atk": opp.get("atk"), "def": opp.get("def"),
                "locked": opp.get("locked"), "auto": opp.get("auto"), "avatar": opp.get("avatar"),
                "skills": {k: {"cd": 0} for k in opp.get("skills", {})}},
    })


@app.route("/api/duel/arena/action", methods=["POST"])
@login_required
def api_duel_arena_action():
    data = request.get_json()
    key = data.get("key", "")
    skill = data.get("skill", "basic")
    duels = load_duels()
    duel = duels.get(key)
    if not duel or duel.get("status") != "arena":
        return jsonify({"error": "Arena not active"}), 400
    uid = session["user_id"]
    fighter = duel.get("fighters", {}).get(uid)
    if not fighter:
        return jsonify({"error": "Not your duel"}), 403
    if fighter.get("locked") is not None:
        return jsonify({"error": "You already locked your move!"}), 400
    if skill != "basic" and skill not in fighter.get("skills", {}):
        return jsonify({"error": "You don't own that skill"}), 400
    if skill != "basic" and fighter.get("skills", {}).get(skill, {}).get("cd", 0) > 0:
        return jsonify({"error": "Skill on cooldown!"}), 400

    fighter["locked"] = skill
    fighter["auto"] = False
    fighter["last_seen"] = time.time()

    # Resolve if both locked (or opponent is offline & auto-filled)
    _arena_auto_fill(duel)
    if all(f.get("locked") is not None for f in duel["fighters"].values()):
        _arena_resolve_round(duel)
        if duel["status"] == "finished":
            _arena_rewards(duel)
    save_duels(duels)
    return jsonify({"success": True, "status": duel["status"]})


@app.route("/api/duel/my_arenas")
@login_required
def api_duel_my_arenas():
    """Keys of arenas I'm currently fighting in (auto-open on duels page).
    Only LIVE fights auto-open — finished duels stay closed so the lobby
    doesn't replay the victory screen on every page load."""
    duels = load_duels()
    uid = session["user_id"]
    keys = []
    for k, v in duels.items():
        if isinstance(v, dict) and v.get("status") == "arena" and uid in v.get("fighters", {}):
            keys.append(k)
    return jsonify({"keys": keys})


# ══════════════════════════════════════════════
# 🏰 GUILD TASKS SYSTEM
# ══════════════════════════════════════════════

# ══════════════════════════════════════════════
# 📜 MISSIONS — 365-day per-player calendar (seeded random per player & day)
# ══════════════════════════════════════════════
MISSION_DAY_COUNT = 365
MISSION_START = datetime.date(2026, 8, 1)
MISSION_POOL = [
    {"type": "adventure",  "name": "Pathfinder",      "desc": "Complete adventures",            "goal": 3,  "coins": 40,  "xp": 30},
    {"type": "adventure",  "name": "Veteran Explorer","desc": "Complete adventures",            "goal": 8,  "coins": 90,  "xp": 60},
    {"type": "kill",       "name": "Monster Slayer",  "desc": "Defeat monsters",                "goal": 5,  "coins": 35,  "xp": 25},
    {"type": "kill",       "name": "The Butcher",     "desc": "Defeat monsters",                "goal": 15, "coins": 80,  "xp": 55},
    {"type": "boss",       "name": "Boss Bane",       "desc": "Defeat bosses",                  "goal": 1,  "coins": 60,  "xp": 40},
    {"type": "boss",       "name": "Dragon Hunter",   "desc": "Defeat bosses",                  "goal": 3,  "coins": 150, "xp": 90},
    {"type": "duel",       "name": "Duelist",         "desc": "Win duels (PvP or AI)",          "goal": 1,  "coins": 45,  "xp": 30},
    {"type": "duel",       "name": "Champion",        "desc": "Win duels (PvP or AI)",          "goal": 5,  "coins": 120, "xp": 70},
    {"type": "daily",      "name": "Daily Ritual",    "desc": "Claim the daily reward",         "goal": 1,  "coins": 30,  "xp": 20},
    {"type": "daily",      "name": "Devotion",        "desc": "Claim the daily reward",         "goal": 3,  "coins": 90,  "xp": 50},
    {"type": "coins",      "name": "Coin Hoarder",    "desc": "Earn coins from any source",     "goal": 150, "coins": 50, "xp": 30},
    {"type": "coins",      "name": "Tycoon",          "desc": "Earn coins from any source",     "goal": 500, "coins": 150, "xp": 90},
    {"type": "tower",      "name": "Tower Climber",   "desc": "Clear tower floors",             "goal": 1,  "coins": 40,  "xp": 30},
    {"type": "tower",      "name": "Summit Seeker",   "desc": "Clear tower floors",             "goal": 5,  "coins": 120, "xp": 80},
    {"type": "shop",       "name": "Shopper",         "desc": "Buy items from the shop",        "goal": 1,  "coins": 25,  "xp": 20},
    {"type": "shop",       "name": "Big Spender",     "desc": "Buy items from the shop",        "goal": 5,  "coins": 75,  "xp": 50},
    {"type": "hatch",      "name": "Egg Keeper",      "desc": "Hatch pets from eggs",           "goal": 1,  "coins": 35,  "xp": 25},
    {"type": "hatch",      "name": "Zookeeper",       "desc": "Hatch pets from eggs",           "goal": 3,  "coins": 100, "xp": 65},
    {"type": "sell",       "name": "Merchant's Eye",  "desc": "Sell items",                     "goal": 2,  "coins": 30,  "xp": 20},
    {"type": "sell",       "name": "Liquidator",      "desc": "Sell items",                     "goal": 6,  "coins": 90,  "xp": 55},
    {"type": "guildtask",  "name": "Guild Helper",    "desc": "Complete guild tasks",           "goal": 1,  "coins": 40,  "xp": 30},
    {"type": "guildtask",  "name": "Guild Pillar",    "desc": "Complete guild tasks",           "goal": 5,  "coins": 120, "xp": 80},
    {"type": "heal",       "name": "Medic",           "desc": "Drink potions or use /api/heal", "goal": 2,  "coins": 25,  "xp": 15},
    {"type": "heal",       "name": "Surgeon",         "desc": "Drink potions or use /api/heal", "goal": 6,  "coins": 70,  "xp": 45},
    {"type": "craft",      "name": "Apprentice Smith","desc": "Craft items at the blacksmith",  "goal": 1,  "coins": 45,  "xp": 30},
    {"type": "craft",      "name": "Master Smith",    "desc": "Craft items at the blacksmith",  "goal": 4,  "coins": 140, "xp": 85},
]
MISSION_TYPES = ["adventure", "kill", "boss", "duel", "daily", "coins", "tower", "shop", "hatch", "sell", "guildtask", "heal", "craft"]

def _mission_rng(player_id, day_index):
    return random.Random(f"{player_id}|{MISSION_START.toordinal() + day_index}")

def mission_day(player_id, day_index):
    """Seeded 3 missions for one calendar day (0..149). Deterministic per player+day."""
    if day_index < 0:
        day_index = 0
    rng = _mission_rng(player_id, day_index)
    types = rng.sample(MISSION_TYPES, 3)
    out = []
    for t in types:
        picks = [m for m in MISSION_POOL if m["type"] == t]
        m = dict(rng.choice(picks))
        m["day"] = day_index
        m["coins"] += day_index // 4   # late-calendar missions pay more
        m["xp"] += day_index // 6
        out.append(m)
    return out

def mission_day_index():
    return max(0, min((datetime.date.today() - MISSION_START).days, MISSION_DAY_COUNT - 1))

def mission_key(day_index, mtype):
    return f"d{day_index}_{mtype}"

def bump_mission(player, mtype, amount=1):
    """Increment progress for every unclaimed mission of this type up to today."""
    pid = str(player.get("user_id", ""))
    if not pid:
        return
    today = mission_day_index()
    prog = player.setdefault("mission_progress", {})
    claimed = player.setdefault("missions_claimed", [])
    for d in range(0, today + 1):
        key = mission_key(d, mtype)
        if key in claimed:
            continue
        types = {m["type"] for m in mission_day(pid, d)}
        if mtype in types:
            prog[key] = prog.get(key, 0) + amount

@app.route("/missions")
@login_required
def missions_page():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    today = mission_day_index()
    pid = str(session["user_id"])
    days = []
    for d in range(MISSION_DAY_COUNT):
        ms = mission_day(pid, d)
        claimed_n = sum(1 for m in ms if mission_key(d, m["type"]) in player.get("missions_claimed", []))
        days.append({"day": d, "missions": ms, "claimed": claimed_n, "today": d == today})
    return render_template("missions.html", player=player, days=days, today=today,
                           day_count=MISSION_DAY_COUNT, username=session.get("username", "Player"),
                           avatar_url=get_avatar_url(session.get("user_id", ""), ""))

@app.route("/api/mission/claim", methods=["POST"])
@login_required
def api_mission_claim():
    data = request.json or {}
    try:
        day = int(data.get("day", -1))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid day"}), 400
    today = mission_day_index()
    if day < 0 or day > today:
        return jsonify({"error": "Day not unlocked yet"}), 400
    mtype = data.get("type", "")
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    mission = next((m for m in mission_day(str(session["user_id"]), day) if m["type"] == mtype), None)
    if not mission:
        return jsonify({"error": "Mission not found"}), 400
    key = mission_key(day, mtype)
    claimed = player.setdefault("missions_claimed", [])
    if key in claimed:
        return jsonify({"error": "Already claimed!"}), 400
    if player.get("mission_progress", {}).get(key, 0) < mission["goal"]:
        return jsonify({"error": f"Need {mission['goal']} progress (have {player.get('mission_progress', {}).get(key, 0)})"}), 400
    player["coins"] = player.get("coins", 0) + mission["coins"]
    player["xp"] = player.get("xp", 0) + mission["xp"]
    claimed.append(key)
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "message": f"📜 {mission['name']} complete! +{mission['coins']} coins +{mission['xp']} XP!"})

GUILD_TASK_POOL = [
    # ── Kills / Combat ──
    {"id":"kill_10",  "title":"Monster Slayers",  "desc":"Kill 10 monsters in Adventure", "req_key":"monsters_killed",      "req_val":10,  "coins":200,  "xp":150, "icon":"⚔️"},
    {"id":"kill_25",  "title":"Blooded Blades",   "desc":"Kill 25 monsters total",        "req_key":"monsters_killed",      "req_val":25,  "coins":350,  "xp":250, "icon":"🗡️"},
    {"id":"kill_50",  "title":"Dungeon Hunters",  "desc":"Kill 50 monsters total",        "req_key":"monsters_killed",      "req_val":50,  "coins":600,  "xp":400, "icon":"💀"},
    {"id":"kill_100", "title":"Slayer Legion",    "desc":"Kill 100 monsters total",       "req_key":"monsters_killed",      "req_val":100, "coins":1000, "xp":750, "icon":"🔥"},
    {"id":"boss_1",   "title":"Boss Breakers",    "desc":"Defeat 1 boss",                 "req_key":"bosses_killed",        "req_val":1,   "coins":250,  "xp":200, "icon":"👑"},
    {"id":"boss_3",   "title":"Boss Hunters",     "desc":"Defeat 3 bosses",               "req_key":"bosses_killed",        "req_val":3,   "coins":500,  "xp":350, "icon":"👑"},
    {"id":"boss_5",   "title":"Boss Executioners","desc":"Defeat 5 bosses",               "req_key":"bosses_killed",        "req_val":5,   "coins":800,  "xp":600, "icon":"👑"},
    {"id":"no_death_10","title":"Unbroken",       "desc":"Stay alive with 10+ kills",     "req_key":"monsters_killed",      "req_val":10,  "coins":300,  "xp":200, "icon":"🛡️"},
    # ── Tower / Dungeon ──
    {"id":"tower5",   "title":"Tower Rookies",    "desc":"Reach Tower Floor 5",           "req_key":"tower_floor",          "req_val":5,   "coins":250,  "xp":180, "icon":"🗼"},
    {"id":"tower10",  "title":"Tower Climbers",   "desc":"Reach Tower Floor 10",          "req_key":"tower_floor",          "req_val":10,  "coins":400,  "xp":300, "icon":"🗼"},
    {"id":"tower15",  "title":"Skyscrapers",      "desc":"Reach Tower Floor 15",          "req_key":"tower_floor",          "req_val":15,  "coins":550,  "xp":420, "icon":"🗼"},
    {"id":"tower20",  "title":"Tower Legends",    "desc":"Reach Tower Floor 20",          "req_key":"tower_floor",          "req_val":20,  "coins":750,  "xp":580, "icon":"🏰"},
    {"id":"tower30",  "title":"Sky Reachers",     "desc":"Reach Tower Floor 30",          "req_key":"tower_floor",          "req_val":30,  "coins":1100, "xp":850, "icon":"🏰"},
    {"id":"tower50",  "title":"Cloud Piercers",   "desc":"Reach Tower Floor 50",          "req_key":"tower_floor",          "req_val":50,  "coins":1800, "xp":1400,"icon":"🚀"},
    {"id":"dungeon5", "title":"Deep Delvers",     "desc":"Reach Dungeon Floor 5",         "req_key":"dungeon_floor",        "req_val":5,   "coins":400,  "xp":300, "icon":"🏚️"},
    {"id":"dungeon10","title":"Cave Crawlers",    "desc":"Reach Dungeon Floor 10",        "req_key":"dungeon_floor",        "req_val":10,  "coins":600,  "xp":450, "icon":"🏚️"},
    {"id":"dungeon15","title":"Abyss Divers",     "desc":"Reach Dungeon Floor 15",        "req_key":"dungeon_floor",        "req_val":15,  "coins":800,  "xp":600, "icon":"🕳️"},
    {"id":"dungeon20","title":"Cave Lords",       "desc":"Reach Dungeon Floor 20",        "req_key":"dungeon_floor",        "req_val":20,  "coins":1000, "xp":800, "icon":"🕳️"},
    {"id":"floor_high","title":"Record Setters",  "desc":"Reach Tower Floor 25",          "req_key":"highest_floor",        "req_val":25,  "coins":900,  "xp":700, "icon":"🏔️"},
    # ── Adventure / Progress ──
    {"id":"adv5",    "title":"Journey Begins",   "desc":"Complete 5 adventures",          "req_key":"adventures_completed", "req_val":5,   "coins":200,  "xp":150, "icon":"🌍"},
    {"id":"adv10",   "title":"Adventurers",      "desc":"Complete 10 adventures",         "req_key":"adventures_completed", "req_val":10,  "coins":300,  "xp":200, "icon":"🌍"},
    {"id":"adv20",   "title":"Explorers",        "desc":"Complete 20 adventures",         "req_key":"adventures_completed", "req_val":20,  "coins":500,  "xp":380, "icon":"🧭"},
    {"id":"adv50",   "title":"World Wanderers",  "desc":"Complete 50 adventures",         "req_key":"adventures_completed", "req_val":50,  "coins":900,  "xp":700, "icon":"🧭"},
    {"id":"level5",  "title":"Rising Stars",     "desc":"Reach Level 5",                  "req_key":"level",                "req_val":5,   "coins":250,  "xp":180, "icon":"⭐"},
    {"id":"level10", "title":"Level Up!",        "desc":"Reach Level 10",                 "req_key":"level",                "req_val":10,  "coins":500,  "xp":400, "icon":"⭐"},
    {"id":"level15", "title":"Veterans",         "desc":"Reach Level 15",                 "req_key":"level",                "req_val":15,  "coins":700,  "xp":550, "icon":"⭐"},
    {"id":"level20", "title":"Power Surge",      "desc":"Reach Level 20",                 "req_key":"level",                "req_val":20,  "coins":1000, "xp":800, "icon":"💥"},
    {"id":"level25", "title":"Elite Guard",      "desc":"Reach Level 25",                 "req_key":"level",                "req_val":25,  "coins":1300, "xp":1000,"icon":"💥"},
    {"id":"level30", "title":"Titans",           "desc":"Reach Level 30",                 "req_key":"level",                "req_val":30,  "coins":1600, "xp":1300,"icon":"🔥"},
    {"id":"level40", "title":"Demigods",         "desc":"Reach Level 40",                 "req_key":"level",                "req_val":40,  "coins":2200, "xp":1800,"icon":"🔥"},
    {"id":"level50", "title":"Immortals",        "desc":"Reach Level 50",                 "req_key":"level",                "req_val":50,  "coins":3000, "xp":2500,"icon":"🌟"},
    {"id":"xp500",   "title":"XP Grinders",      "desc":"Earn 500 total XP",              "req_key":"xp",                   "req_val":500, "coins":300,  "xp":200, "icon":"📈"},
    {"id":"xp1500",  "title":"Scholars",         "desc":"Earn 1500 total XP",             "req_key":"xp",                   "req_val":1500,"coins":700,  "xp":500, "icon":"📈"},
    {"id":"xp3000",  "title":"Wisdom Seekers",   "desc":"Earn 3000 total XP",             "req_key":"xp",                   "req_val":3000,"coins":1200, "xp":900, "icon":"📚"},
    # ── Economy ──
    {"id":"coin250", "title":"Coin Collectors",  "desc":"Hold 250 coins",                 "req_key":"coins",                "req_val":250, "coins":80,   "xp":60,  "icon":"🪙"},
    {"id":"coin500", "title":"Gold Gatherers",   "desc":"Hold 500 coins",                 "req_key":"coins",                "req_val":500, "coins":100,  "xp":100, "icon":"🪙"},
    {"id":"coin1000","title":"Treasure Hoarders","desc":"Hold 1,000 coins",               "req_key":"coins",                "req_val":1000,"coins":150,  "xp":150, "icon":"💰"},
    {"id":"coin3000","title":"Coin Lords",       "desc":"Hold 3,000 coins",               "req_key":"coins",                "req_val":3000,"coins":200,  "xp":250, "icon":"💰"},
    {"id":"coin10000","title":"Vault Kings",     "desc":"Hold 10,000 coins",              "req_key":"coins",                "req_val":10000,"coins":400, "xp":500, "icon":"🏦"},
    {"id":"buy5",    "title":"Shopaholics",      "desc":"Buy 5 items from the Shop",      "req_key":"shop_purchases",       "req_val":5,   "coins":250,  "xp":180, "icon":"🛒"},
    {"id":"buy10",   "title":"Big Spenders",     "desc":"Buy 10 items from the Shop",     "req_key":"shop_purchases",       "req_val":10,  "coins":450,  "xp":350, "icon":"🛒"},
    {"id":"buy20",   "title":"Tycoons",          "desc":"Buy 20 items from the Shop",     "req_key":"shop_purchases",       "req_val":20,  "coins":750,  "xp":600, "icon":"🛒"},
    # ── Duels / PvP ──
    {"id":"duel_1",  "title":"First Blood",      "desc":"Win 1 duel",                     "req_key":"duel_wins",            "req_val":1,   "coins":300,  "xp":250, "icon":"🤺"},
    {"id":"duel_3",  "title":"Duelists",         "desc":"Win 3 duels",                    "req_key":"duel_wins",            "req_val":3,   "coins":600,  "xp":450, "icon":"🤺"},
    {"id":"duel_5",  "title":"Arena Veterans",   "desc":"Win 5 duels",                    "req_key":"duel_wins",            "req_val":5,   "coins":900,  "xp":700, "icon":"⚔️"},
    {"id":"duel_10", "title":"Champions",        "desc":"Win 10 duels",                   "req_key":"duel_wins",            "req_val":10,  "coins":1500, "xp":1200,"icon":"🏆"},
    {"id":"streak_3","title":"Hot Streak",       "desc":"Reach a 3-win duel streak",      "req_key":"duel_streak",          "req_val":3,   "coins":500,  "xp":400, "icon":"🔥"},
    {"id":"streak_5","title":"Unstoppable",      "desc":"Reach a 5-win duel streak",      "req_key":"duel_streak",          "req_val":5,   "coins":800,  "xp":650, "icon":"🔥"},
    # ── Collection ──
    {"id":"pet_1",   "title":"Pet Lovers",       "desc":"Own 1 pet",                     "req_key":"pets",                 "req_val":1,   "coins":300,  "xp":250, "icon":"🐾"},
    {"id":"pet_3",   "title":"Breeders",         "desc":"Own 3 pets",                    "req_key":"pets",                 "req_val":3,   "coins":600,  "xp":450, "icon":"🐾"},
    {"id":"pet_5",   "title":"Pet Masters",      "desc":"Own 5 pets",                    "req_key":"pets",                 "req_val":5,   "coins":900,  "xp":700, "icon":"🐉"},
    {"id":"skill_3", "title":"Skill Collectors", "desc":"Learn 3 skills",                "req_key":"skills",               "req_val":3,   "coins":500,  "xp":380, "icon":"📖"},
    {"id":"skill_6", "title":"Skill Scholars",   "desc":"Learn 6 skills",                "req_key":"skills",               "req_val":6,   "coins":800,  "xp":620, "icon":"📖"},
    {"id":"title_2", "title":"Title Hunters",    "desc":"Unlock 2 titles",               "req_key":"titles_unlocked",      "req_val":2,   "coins":400,  "xp":300, "icon":"🏷️"},
    {"id":"title_5", "title":"Legend Seekers",   "desc":"Unlock 5 titles",               "req_key":"titles_unlocked",      "req_val":5,   "coins":700,  "xp":550, "icon":"🏷️"},
    {"id":"chapter_2","title":"Story Readers",   "desc":"Complete 2 story chapters",     "req_key":"completed_chapters",   "req_val":2,   "coins":500,  "xp":380, "icon":"📜"},
    {"id":"chapter_5","title":"Lore Masters",    "desc":"Complete 5 story chapters",     "req_key":"completed_chapters",   "req_val":5,   "coins":900,  "xp":700, "icon":"📜"},
    {"id":"ach_3",   "title":"Achievers",        "desc":"Unlock 3 achievements",         "req_key":"achievements",         "req_val":3,   "coins":500,  "xp":400, "icon":"🎖️"},
    {"id":"ach_6",   "title":"Completionists",   "desc":"Unlock 6 achievements",         "req_key":"achievements",         "req_val":6,   "coins":900,  "xp":700, "icon":"🎖️"},
    {"id":"job_5",   "title":"Work Ethic",       "desc":"Reach Job Level 5",             "req_key":"job_level",            "req_val":5,   "coins":400,  "xp":300, "icon":"💼"},
    {"id":"job_10",  "title":"Career Climbers",  "desc":"Reach Job Level 10",            "req_key":"job_level",            "req_val":10,  "coins":800,  "xp":600, "icon":"💼"},
]

def get_daily_guild_tasks():
    import datetime
    today = datetime.date.today().toordinal()
    rng = random.Random(today)
    return rng.sample(GUILD_TASK_POOL, min(3, len(GUILD_TASK_POOL)))

@app.route("/guild-tasks")
@login_required
def guild_tasks_page():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    tasks = get_daily_guild_tasks()
    completed = player.get("guild_tasks_done", [])
    return render_template("guild_tasks.html", player=player, tasks=tasks, completed=completed,
                           username=session.get("username","Player"),
                           avatar_url=get_avatar_url(session.get("user_id",""), ""))

@app.route("/api/guild/task/claim", methods=["POST"])
@login_required
def api_guild_task_claim():
    task_id = (request.json or {}).get("task_id", "")
    player  = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    tasks   = get_daily_guild_tasks()
    task    = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        return jsonify({"error": "Invalid task"}), 400
    done = player.get("guild_tasks_done", [])
    if task_id in done:
        return jsonify({"error": "Already claimed!"}), 400
    req_key, req_val = task["req_key"], task["req_val"]
    raw = player.get(req_key, 0)
    player_val = len(raw) if isinstance(raw, (list, dict)) else (raw or 0)
    if player_val < req_val:
        return jsonify({"error": f"Need {req_val} {req_key.replace('_',' ')} (you have {player_val})"}), 400
    player["coins"] = player.get("coins", 0) + task["coins"]
    player["xp"]    = player.get("xp", 0)    + task["xp"]
    done.append(task_id)
    bump_mission(player, "guildtask")
    player["guild_tasks_done"] = done
    guilds = load_guilds()
    g_id = player.get("guild")
    if g_id and g_id in guilds:
        guilds[g_id]["xp"] = guilds[g_id].get("xp", 0) + task["xp"]
        save_guilds(guilds)
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "coins": task["coins"], "xp": task["xp"],
                    "message": f"{task['icon']} {task['title']} complete! +{task['coins']} coins +{task['xp']} XP!"})

# ══════════════════════════════════════════════
# ⚒️ JOB DAILY TASK
# ══════════════════════════════════════════════

@app.route("/api/job/task", methods=["POST"])
@login_required
def api_job_task():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    job_id = player.get("job")
    if not job_id or job_id not in JOBS:
        return jsonify({"error": "No active job. Set one first."}), 400
    now = time.time()
    if now - player.get("last_job_task", 0) < 21600:
        remaining = int(21600 - (now - player.get("last_job_task", 0)))
        h, m = divmod(remaining // 60, 60)
        return jsonify({"error": f"Task ready in {h}h {m}m"}), 429
    job = JOBS[job_id]
    job_xp_gain = job.get("xp", 10)
    player["job_xp"] = player.get("job_xp", 0) + job_xp_gain
    job_lvl = player.get("job_level", 1)
    if player["job_xp"] >= job_lvl * 50:
        player["job_xp"] -= job_lvl * 50
        player["job_level"] = job_lvl + 1
        leveled = True
    else:
        leveled = False
    player["last_job_task"] = now
    msg = f"📋 {job.get('icon','⚒️')} Task done! +{job_xp_gain} Job XP"
    if leveled:
        msg += f" — Job Level Up! Now Lv.{player['job_level']}!"
    bonus = ""
    if job_id == "fisher" and random.random() < 0.15:
        player.setdefault("inventory",[]).append({"name":"Fishing Egg","type":"egg","icon":"🥚","rarity":"Uncommon","id":f"egg_{int(time.time())}"})
        bonus = " 🥚 Rare catch — Pet Egg!"
    elif job_id == "alchemist" and random.random() < 0.08:
        try:
            from game_data import SKILLS
            avail = [s for s in SKILLS if s not in player.get("skills",{})]
            if avail:
                ns = random.choice(avail)
                player.setdefault("skills",{})[ns] = SKILLS[ns]
                bonus = f" 📘 Learned skill [{ns}]!"
        except Exception: pass
    elif job_id == "cook":
        player["health"] = min(player.get("max_health",100), player.get("health",50) + 50)
        bonus = " 🍲 Cooked a meal — +50 HP!"
    elif job_id == "miner" and random.random() < 0.10:
        player.setdefault("inventory",[]).append({"name":"Raw Ore","type":"material","icon":"🪨","rarity":"Common","id":f"ore_{int(time.time())}"})
        bonus = " 🪨 Found Raw Ore!"
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "message": msg + bonus, "job_level": player.get("job_level",1), "leveled": leveled})

# ══════════════════════════════════════════════
# 🔒 LEVEL GATE MIDDLEWARE
# ══════════════════════════════════════════════

LEVEL_GATES = {
    "/dungeon":     5,
    "/tower":       3,
    "/duels":       10,
    "/pet":         8,
    "/jobs":        10,
    "/guild-tasks": 5,
    "/skills":      7,
    "/auction":     15,
}

@app.before_request
def enforce_level_gate():
    path = request.path
    if path not in LEVEL_GATES:
        return
    if "user_id" not in session:
        return
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    required = LEVEL_GATES[path]
    if player.get("level", 1) < required:
        return render_template("level_gate.html", player=player, required=required,
                               page=path.lstrip("/"),
                               username=session.get("username","Player"),
                               avatar_url=get_avatar_url(session.get("user_id",""), ""))

# ══════════════════════════════════════════════
# 🤝 TRADING SYSTEM
# ══════════════════════════════════════════════

@app.route("/trade")
@login_required
def trade_page():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    player.setdefault("trade_offers", [])
    player.setdefault("trade_requests", [])
    player.setdefault("trade_history", [])
    player.setdefault("inventory", [])

    # Get outgoing trades
    outgoing = player.get("trade_offers", [])

    # Get incoming trades
    incoming = player.get("trade_requests", [])

    # Get trade history
    history = player.get("trade_history", [])

    # Enrich with partner names
    all_players = load_players()
    for trade in outgoing + incoming + history:
        if "to_user" in trade and trade["to_user"]:
            partner = all_players.get(f"{trade.get('guild_id', HOME_GUILD_ID)}_{trade['to_user']}")
            trade["to_name"] = partner.get("name", "Unknown") if partner else "Unknown"
        if "from_user" in trade and trade["from_user"]:
            partner = all_players.get(f"{trade.get('guild_id', HOME_GUILD_ID)}_{trade['from_user']}")
            trade["from_name"] = partner.get("name", "Unknown") if partner else "Unknown"
        if "partner_id" in trade and trade["partner_id"]:
            partner = all_players.get(f"{trade.get('guild_id', HOME_GUILD_ID)}_{trade['partner_id']}")
            trade["partner_name"] = partner.get("name", "Unknown") if partner else "Unknown"

    # Group inventory by item id for display
    inv_counts = {}
    for item in player.get("inventory", []):
        iid = item.get("id", "")
        if iid not in inv_counts:
            inv_counts[iid] = {"item": item, "qty": 0}
        inv_counts[iid]["qty"] += 1
    player_inventory = [{"id": k, **v["item"], "qty": v["qty"]} for k, v in inv_counts.items()]

    # Get all known items for the "requested" dropdown
    from game_data import SHOP_ITEMS
    all_items = []
    for cat, items in SHOP_ITEMS.items():
        for item in items:
            all_items.append({
                "id": item.get("id", ""),
                "name": item.get("name", ""),
                "icon": item.get("icon", ""),
                "rarity": item.get("rarity", "Common")
            })

    return render_template("trade.html",
                           player=player,
                           outgoing_trades=outgoing,
                           incoming_trades=incoming,
                           trade_history=history,
                           player_inventory=player_inventory,
                           all_items=all_items,
                           username=session.get("username", "Player"),
                           avatar_url=get_avatar_url(session.get("user_id", ""), ""))

@app.route("/api/trade/create", methods=["POST"])
@login_required
def api_trade_create():
    data = request.json or {}
    target_user_raw = data.get("target_user", "").strip()
    from_items = data.get("from_items", [])
    from_coins = int(data.get("from_coins", 0))
    to_items = data.get("to_items", [])
    to_coins = int(data.get("to_coins", 0))

    if not target_user_raw:
        return jsonify({"error": "Target user required"}), 400
    if not from_items and from_coins <= 0 and not to_items and to_coins <= 0:
        return jsonify({"error": "Trade must have at least one item or coins"}), 400

    # Parse target user ID (support @mention format)
    target_user = target_user_raw
    if target_user.startswith("<@") and target_user.endswith(">"):
        target_user = target_user[2:-1]
        if target_user.startswith("!"):
            target_user = target_user[1:]

    guild_id = session.get("guild_id", HOME_GUILD_ID)
    from_user = session["user_id"]

    if from_user == target_user:
        return jsonify({"error": "Cannot trade with yourself"}), 400

    # Load both players
    from_player = get_player(guild_id, from_user)
    to_player = get_player(guild_id, target_user)

    if not to_player:
        return jsonify({"error": "Target player not found"}), 404

    from_player.setdefault("inventory", [])
    from_player.setdefault("trade_offers", [])
    from_player.setdefault("trade_requests", [])
    from_player.setdefault("trade_history", [])
    to_player.setdefault("inventory", [])
    to_player.setdefault("trade_offers", [])
    to_player.setdefault("trade_requests", [])
    to_player.setdefault("trade_history", [])

    # Verify from_player has the offered items
    inv_counts = {}
    for item in from_player.get("inventory", []):
        iid = item.get("id", "")
        inv_counts[iid] = inv_counts.get(iid, 0) + 1

    for offer_item in from_items:
        iid = offer_item.get("id")
        qty = int(offer_item.get("qty", 1))
        if inv_counts.get(iid, 0) < qty:
            return jsonify({"error": f"You don't have enough of item {iid}"}), 400

    # Verify from_player has enough coins
    if from_coins > from_player.get("coins", 0):
        return jsonify({"error": "Not enough coins"}), 400

    # Create trade offer
    trade_id = f"trade_{int(time.time())}_{random.randint(1000,9999)}"
    trade = {
        "id": trade_id,
        "guild_id": guild_id,
        "from_user": from_user,
        "to_user": target_user,
        "from_items": from_items,
        "from_coins": from_coins,
        "to_items": to_items,
        "to_coins": to_coins,
        "status": "pending",
        "created": time.time()
    }

    # Add to both players
    from_player["trade_offers"].append(trade)
    to_player["trade_requests"].append(trade)

    save_player(guild_id, from_user, from_player)
    save_player(guild_id, target_user, to_player)

    return jsonify({"success": True, "trade_id": trade_id, "message": "Trade offer sent!"})

@app.route("/api/trade/accept", methods=["POST"])
@login_required
def api_trade_accept():
    trade_id = (request.json or {}).get("trade_id", "")
    if not trade_id:
        return jsonify({"error": "Trade ID required"}), 400

    guild_id = session.get("guild_id", HOME_GUILD_ID)
    user_id = session["user_id"]

    player = get_player(guild_id, user_id)
    player.setdefault("trade_requests", [])
    player.setdefault("trade_offers", [])
    player.setdefault("trade_history", [])
    player.setdefault("inventory", [])

    # Find trade in requests
    trade = None
    for i, t in enumerate(player["trade_requests"]):
        if t["id"] == trade_id:
            trade = t
            break
    if not trade:
        return jsonify({"error": "Trade not found or not for you"}), 404

    if trade["status"] != "pending":
        return jsonify({"error": "Trade no longer pending"}), 400

    # Load from_player
    from_player = get_player(guild_id, trade["from_user"])
    if not from_player:
        return jsonify({"error": "Other player not found"}), 404
    from_player.setdefault("inventory", [])
    from_player.setdefault("trade_offers", [])
    from_player.setdefault("trade_requests", [])
    from_player.setdefault("trade_history", [])

    # Verify from_player still has items
    inv_counts = {}
    for item in from_player.get("inventory", []):
        iid = item.get("id", "")
        inv_counts[iid] = inv_counts.get(iid, 0) + 1
    for offer_item in trade["from_items"]:
        iid = offer_item.get("id")
        qty = int(offer_item.get("qty", 1))
        if inv_counts.get(iid, 0) < qty:
            return jsonify({"error": "Other player no longer has the items"}), 400

    # Verify from_player has coins
    if trade["from_coins"] > from_player.get("coins", 0):
        return jsonify({"error": "Other player no longer has enough coins"}), 400

    # Verify to_player (current user) has requested items
    inv_counts_to = {}
    for item in player.get("inventory", []):
        iid = item.get("id", "")
        inv_counts_to[iid] = inv_counts_to.get(iid, 0) + 1
    for req_item in trade["to_items"]:
        iid = req_item.get("id")
        qty = int(req_item.get("qty", 1))
        if inv_counts_to.get(iid, 0) < qty:
            return jsonify({"error": "You don't have the requested items"}), 400

    # Verify to_player has coins
    if trade["to_coins"] > player.get("coins", 0):
        return jsonify({"error": "You don't have enough coins"}), 400

    # Execute trade - remove from from_player
    for offer_item in trade["from_items"]:
        iid = offer_item.get("id")
        qty = int(offer_item.get("qty", 1))
        removed = 0
        new_inv = []
        for item in from_player["inventory"]:
            if item.get("id") == iid and removed < qty:
                removed += 1
            else:
                new_inv.append(item)
        from_player["inventory"] = new_inv
    from_player["coins"] = from_player.get("coins", 0) - trade["from_coins"]

    # Execute trade - remove from to_player
    for req_item in trade["to_items"]:
        iid = req_item.get("id")
        qty = int(req_item.get("qty", 1))
        removed = 0
        new_inv = []
        for item in player["inventory"]:
            if item.get("id") == iid and removed < qty:
                removed += 1
            else:
                new_inv.append(item)
        player["inventory"] = new_inv
    player["coins"] = player.get("coins", 0) - trade["to_coins"]

    # Add received items to from_player
    for req_item in trade["to_items"]:
        iid = req_item.get("id")
        qty = int(req_item.get("qty", 1))
        # Find item template
        from game_data import SHOP_ITEMS
        item_template = None
        for cat, items in SHOP_ITEMS.items():
            for it in items:
                if it.get("id") == iid:
                    item_template = it
                    break
            if item_template:
                break
        if item_template:
            for _ in range(qty):
                from_player["inventory"].append({
                    "id": item_template["id"],
                    "name": item_template["name"],
                    "icon": item_template.get("icon", ""),
                    "type": item_template.get("type", "item"),
                    "rarity": item_template.get("rarity", "Common")
                })
    from_player["coins"] = from_player.get("coins", 0) + trade["to_coins"]

    # Add received items to to_player
    for offer_item in trade["from_items"]:
        iid = offer_item.get("id")
        qty = int(offer_item.get("qty", 1))
        from game_data import SHOP_ITEMS
        item_template = None
        for cat, items in SHOP_ITEMS.items():
            for it in items:
                if it.get("id") == iid:
                    item_template = it
                    break
            if item_template:
                break
        if item_template:
            for _ in range(qty):
                player["inventory"].append({
                    "id": item_template["id"],
                    "name": item_template["name"],
                    "icon": item_template.get("icon", ""),
                    "type": item_template.get("type", "item"),
                    "rarity": item_template.get("rarity", "Common")
                })
    player["coins"] = player.get("coins", 0) + trade["from_coins"]

    # Update trade status
    trade["status"] = "accepted"
    trade["completed"] = time.time()

    # Move from pending to history for both players
    # Remove from from_player's trade_offers
    from_player["trade_offers"] = [t for t in from_player["trade_offers"] if t["id"] != trade_id]
    from_player["trade_history"].append(trade)

    # Remove from to_player's trade_requests
    player["trade_requests"] = [t for t in player["trade_requests"] if t["id"] != trade_id]
    player["trade_history"].append(trade)

    # Add summary
    trade["partner_id"] = user_id
    trade["partner_name"] = player.get("name", "Unknown")
    summary_parts = []
    if trade["from_items"]:
        from_items_str = ", ".join(f'{i["qty"]}×{i["id"]}' for i in trade["from_items"])
        summary_parts.append(f"You gave: {from_items_str}")
    if trade["from_coins"]:
        summary_parts.append(f"{trade['from_coins']} coins")
    if trade["to_items"]:
        to_items_str = ", ".join(f'{i["qty"]}×{i["id"]}' for i in trade["to_items"])
        summary_parts.append(f"Received: {to_items_str}")
    if trade["to_coins"]:
        summary_parts.append(f"{trade['to_coins']} coins")
    trade["summary"] = " | ".join(summary_parts)

    # For from_player's history entry
    trade_copy = trade.copy()
    trade_copy["partner_id"] = user_id
    trade_copy["partner_name"] = player.get("name", "Unknown")
    # Swap summary perspective
    summary_parts_from = []
    if trade["to_items"]:
        to_items_str = ", ".join(f'{i["qty"]}×{i["id"]}' for i in trade["to_items"])
        summary_parts_from.append(f"They gave: {to_items_str}")
    if trade["to_coins"]:
        summary_parts_from.append(f"{trade['to_coins']} coins")
    if trade["from_items"]:
        from_items_str = ", ".join(f'{i["qty"]}×{i["id"]}' for i in trade["from_items"])
        summary_parts_from.append(f"You received: {from_items_str}")
    if trade["from_coins"]:
        summary_parts_from.append(f"{trade['from_coins']} coins")
    trade_copy["summary"] = " | ".join(summary_parts_from)

    # Update from_player's history with correct perspective
    from_player["trade_history"][-1] = trade_copy

    save_player(guild_id, user_id, player)
    save_player(guild_id, trade["from_user"], from_player)

    return jsonify({"success": True, "message": "Trade completed!"})

@app.route("/api/trade/decline", methods=["POST"])
@login_required
def api_trade_decline():
    trade_id = (request.json or {}).get("trade_id", "")
    if not trade_id:
        return jsonify({"error": "Trade ID required"}), 400

    guild_id = session.get("guild_id", HOME_GUILD_ID)
    user_id = session["user_id"]

    player = get_player(guild_id, user_id)
    player.setdefault("trade_requests", [])
    player.setdefault("trade_history", [])

    # Find trade in requests
    trade = None
    for i, t in enumerate(player["trade_requests"]):
        if t["id"] == trade_id:
            trade = t
            break
    if not trade:
        return jsonify({"error": "Trade not found or not for you"}), 404

    if trade["status"] != "pending":
        return jsonify({"error": "Trade no longer pending"}), 400

    # Load from_player
    from_player = get_player(guild_id, trade["from_user"])
    if from_player:
        from_player.setdefault("trade_offers", [])
        from_player.setdefault("trade_history", [])
        # Remove from from_player's offers
        from_player["trade_offers"] = [t for t in from_player["trade_offers"] if t["id"] != trade_id]
        # Add to history
        trade["status"] = "declined"
        trade["completed"] = time.time()
        trade["partner_id"] = user_id
        from_player["trade_history"].append(trade)
        save_player(guild_id, trade["from_user"], from_player)

    # Remove from player's requests and add to history
    player["trade_requests"] = [t for t in player["trade_requests"] if t["id"] != trade_id]
    trade["status"] = "declined"
    trade["completed"] = time.time()
    trade["partner_id"] = trade["from_user"]
    player["trade_history"].append(trade)
    save_player(guild_id, user_id, player)

    return jsonify({"success": True, "message": "Trade declined"})

@app.route("/api/trade/cancel", methods=["POST"])
@login_required
def api_trade_cancel():
    trade_id = (request.json or {}).get("trade_id", "")
    if not trade_id:
        return jsonify({"error": "Trade ID required"}), 400

    guild_id = session.get("guild_id", HOME_GUILD_ID)
    user_id = session["user_id"]

    player = get_player(guild_id, user_id)
    player.setdefault("trade_offers", [])
    player.setdefault("trade_history", [])

    # Find trade in offers
    trade = None
    for i, t in enumerate(player["trade_offers"]):
        if t["id"] == trade_id:
            trade = t
            break
    if not trade:
        return jsonify({"error": "Trade not found or not yours"}), 404

    if trade["status"] != "pending":
        return jsonify({"error": "Trade no longer pending"}), 400

    # Load to_player
    to_player = get_player(guild_id, trade["to_user"])
    if to_player:
        to_player.setdefault("trade_requests", [])
        to_player.setdefault("trade_history", [])
        # Remove from to_player's requests
        to_player["trade_requests"] = [t for t in to_player["trade_requests"] if t["id"] != trade_id]
        # Add to history
        trade["status"] = "cancelled"
        trade["completed"] = time.time()
        trade["partner_id"] = trade["to_user"]
        to_player["trade_history"].append(trade)
        save_player(guild_id, trade["to_user"], to_player)

    # Remove from player's offers and add to history
    player["trade_offers"] = [t for t in player["trade_offers"] if t["id"] != trade_id]
    trade["status"] = "cancelled"
    trade["completed"] = time.time()
    trade["partner_id"] = trade["to_user"]
    player["trade_history"].append(trade)
    save_player(guild_id, user_id, player)

    return jsonify({"success": True, "message": "Trade cancelled"})

@app.route("/api/trade/list")
@login_required
def api_trade_list():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    player.setdefault("trade_offers", [])
    player.setdefault("trade_requests", [])
    player.setdefault("trade_history", [])
    return jsonify({
        "outgoing": player["trade_offers"],
        "incoming": player["trade_requests"],
        "history": player["trade_history"][-20:]  # Last 20
    })


if __name__ == "__main__":
    port = int(os.environ.get("WEB_PORT", 8081))
    # Never fork a reloader under systemd/Docker: duplicate workers race on players.json.
    use_reloader = os.environ.get("WEB_RELOADER", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=use_reloader)
