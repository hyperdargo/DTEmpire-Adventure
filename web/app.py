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
import sys
import secrets
import urllib.parse
import urllib.request
from pathlib import Path
from functools import wraps
from collections import Counter

# ── Paths ──
BASE_DIR = Path(__file__).parent.parent  # HermesBot/

# Load .env before reading any env vars
from dotenv import load_dotenv
load_dotenv(BASE_DIR / ".env", override=True)  # HermesBot/.env
load_dotenv(Path.home() / ".hermes" / ".env", override=True)  # fallback

from flask import Flask, render_template, request, redirect, url_for, session, jsonify
DATA_DIR = BASE_DIR / "data"
PLAYER_FILE = DATA_DIR / "players.json"
GUILD_SHOP_FILE = DATA_DIR / "guild_shops.json"

app = Flask(__name__, template_folder=str(BASE_DIR / "web" / "templates"), static_folder=str(BASE_DIR / "web" / "static"))
app.secret_key = os.environ.get("WEB_SECRET_KEY", "hermes-web-secret-key-change-this")

# ── Discord OAuth config ──
DISCORD_CLIENT_ID = os.environ.get("DISCORD_CLIENT_ID", "")
DISCORD_CLIENT_SECRET = os.environ.get("DISCORD_CLIENT_SECRET", "")
DISCORD_REDIRECT_URI = os.environ.get("DISCORD_REDIRECT_URI", "http://localhost:8081/callback")
HOME_GUILD_ID = os.environ.get("DISCORD_HOME_GUILD_ID", "1454372389692641444")
DISCORD_API = "https://discord.com/api/v10"

# ── Discord webhook notifications (web → Discord sync) ──
DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "")

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
    idx = (int(user_id) >> 22) % 6
    return f"https://cdn.discordapp.com/embed/avatars/{idx}.png"

# ── Login required decorator ──
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated

# ── Data helpers ──
def load_players():
    try:
        with open(PLAYER_FILE) as f:
            return json.load(f)
    except:
        return {}

def save_players(data):
    with open(PLAYER_FILE, "w") as f:
        json.dump(data, f, indent=2)

def load_shops():
    try:
        with open(GUILD_SHOP_FILE) as f:
            return json.load(f)
    except:
        return {}

def get_player(guild_id, user_id):
    players = load_players()
    key = f"{guild_id}_{user_id}"
    if key not in players:
        players[key] = {
            "user_id": user_id, "guild_id": guild_id, "name": "",
            "level": 1, "xp": 0, "coins": 100,
            "health": 100, "max_health": 100,
            "attack": 10, "defense": 5,
            "inventory": [], "equipped_weapon": None, "equipped_armor": None,
            "monsters_killed": 0, "deaths": 0, "bosses_killed": 0,
            "adventures_completed": 0, "last_daily": 0, "last_adventure": 0,
            "created": time.time(),
        }
        save_players(players)
    return players[key]

def save_player(guild_id, user_id, player):
    players = load_players()
    key = f"{guild_id}_{user_id}"
    players[key] = player
    save_players(players)

# ── Adventure data ──
# Load from JSON cache that bot.py writes on startup
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
    }

# ── Routes ──

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

@app.route("/login/manual", methods=["POST"])
def login_manual():
    """Manual login with username + user ID + server ID."""
    username = request.form.get("username", "").strip()
    user_id = request.form.get("user_id", "").strip()
    server_id = request.form.get("server_id", "").strip()

    if not username or not user_id or not server_id:
        return render_template("login.html", error="All fields are required.")

    # Basic validation: user_id and server_id should be numeric (Discord snowflake)
    if not user_id.isdigit():
        return render_template("login.html", error="User ID must be a numeric Discord ID.")
    if not server_id.isdigit():
        return render_template("login.html", error="Server ID must be a numeric Discord Guild ID.")

    # Always use HOME_GUILD_ID for data storage so web & bot share the same key
    data_guild_id = HOME_GUILD_ID

    # Create session
    session["user_id"] = user_id
    session["guild_id"] = str(data_guild_id)  # Always the home guild
    session["username"] = username
    session["avatar"] = ""
    session["manual_login"] = True

    # Create player profile if new (under home guild ID, same as bot)
    player = get_player(data_guild_id, user_id)
    player["name"] = username
    save_player(data_guild_id, user_id, player)

    return redirect(url_for("dashboard"))

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

        # Create session
        session["user_id"] = user_id
        session["guild_id"] = HOME_GUILD_ID
        session["username"] = global_name
        session["avatar"] = avatar_hash

        # Create player profile if new
        player = get_player(HOME_GUILD_ID, user_id)
        player["name"] = global_name
        save_player(HOME_GUILD_ID, user_id, player)

        return redirect(url_for("dashboard"))
    except Exception as e:
        return render_template("login.html", error=f"Login failed: {e}")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

@app.route("/dashboard")
@login_required
def dashboard():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    xp_needed = player["level"] * 50
    xp_percent = min(100, int((player["xp"] / xp_needed) * 100)) if xp_needed > 0 else 0
    hp_percent = min(100, int((player["health"] / player["max_health"]) * 100)) if player["max_health"] > 0 else 0
    return render_template(
        "dashboard.html",
        player=player, xp_needed=xp_needed, xp_percent=xp_percent,
        hp_percent=hp_percent, username=session.get("username", "Player"),
        avatar_url=get_avatar_url(session["user_id"], session.get("avatar", "")),
    )

@app.route("/adventure")
@login_required
def adventure_page():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    available = [loc for loc in ADVENTURE_LOCATIONS if loc["min_level"] <= player["level"]]
    return render_template(
        "adventure.html", player=player,
        locations=available, username=session.get("username", "Player"),
        avatar_url=get_avatar_url(session["user_id"], session.get("avatar", "")),
    )

@app.route("/api/adventure", methods=["POST"])
@login_required
def api_adventure():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    now = time.time()
    if now - player.get("last_adventure", 0) < 3:
        return jsonify({"error": f"Cooldown! Wait {int(3 - (now - player.get('last_adventure', 0)))}s"}), 429

    available = [loc for loc in ADVENTURE_LOCATIONS if loc["min_level"] <= player["level"]]
    if not available:
        return jsonify({"error": "No locations available"}), 400

    location = random.choice(available)
    is_boss = random.random() < location["boss_chance"]
    enemy = location["boss"].copy() if is_boss else random.choice(location["monsters"]).copy()
    enemy["is_boss"] = is_boss

    player_atk = player["attack"]
    player_def = player["defense"]
    shops = load_shops()
    gid = str(session.get("guild_id", HOME_GUILD_ID))
    shop = shops.get(gid, {})
    if player.get("equipped_weapon"):
        for w in shop.get("weapons", []):
            if w["id"] == player["equipped_weapon"]:
                player_atk += w["attack"]
    if player.get("equipped_armor"):
        for a in shop.get("armor", []):
            if a["id"] == player["equipped_armor"]:
                player_def += a["defense"]

    player_hp = player["health"]
    enemy_hp = enemy["hp"]
    rounds = 0
    combat_log = []

    while player_hp > 0 and enemy_hp > 0 and rounds < 20:
        rounds += 1
        dmg = max(1, player_atk - enemy["def"] + random.randint(-3, 3))
        enemy_hp -= dmg
        combat_log.append(f"⚔️ You deal {dmg} damage to {enemy['name']}!")
        if enemy_hp <= 0:
            break
        dmg = max(1, enemy["atk"] - player_def + random.randint(-3, 3))
        player_hp -= dmg
        combat_log.append(f"💥 {enemy['name']} deals {dmg} damage to you!")

    won = enemy_hp <= 0 and player_hp > 0
    xp_gain = 0
    coin_gain = 0
    leveled_up = False

    if won:
        xp_gain = enemy["xp"] + random.randint(0, enemy["xp"] // 2)
        coin_gain = random.randint(enemy["coins"][0], enemy["coins"][1])
        player["xp"] += xp_gain
        player["coins"] += coin_gain
        player["health"] = max(1, player_hp)
        player["monsters_killed"] += 1
        player["adventures_completed"] += 1
        if is_boss:
            player["bosses_killed"] += 1
        xp_needed_ = player["level"] * 50
        while player["xp"] >= xp_needed_:
            player["level"] += 1
            player["xp"] -= xp_needed_
            player["max_health"] += 10
            player["health"] = player["max_health"]
            player["attack"] += 3
            player["defense"] += 2
            xp_needed_ = player["level"] * 50
            leveled_up = True
    else:
        player["deaths"] += 1
        player["health"] = player["max_health"] // 2
        player["coins"] = max(0, player["coins"] - 20)

    player["last_adventure"] = now
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)

    # Notify Discord via webhook
    uname = session.get("username", "Player")
    source = "🌐 Web" if session.get("manual_login") else "🌐 Web (OAuth)"
    if won:
        boss_tag = " 👑 BOSS" if is_boss else ""
        notify_discord(
            f"⚔️ Victory — {uname}",
            f"Defeated **{enemy['name']}** at **{location['name']}**{boss_tag}!\n"
            f"⭐ +{xp_gain} XP | 🪙 +{coin_gain} Coins | 📊 Lv.{player['level']}"
            + ("\n🎉 LEVEL UP!" if leveled_up else ""),
            color=0xffd700 if is_boss else 0x57f287,
        )
    else:
        notify_discord(
            f"💀 Defeated — {uname}",
            f"Slain by **{enemy['name']}** at **{location['name']}** after {rounds} rounds.\n"
            f"🪙 Lost 20 coins | ❤️ HP Halved",
            color=0xed4245,
        )

    return jsonify({
        "won": won, "enemy": enemy, "location": location["name"],
        "rounds": rounds, "combat_log": combat_log,
        "xp_gain": xp_gain if won else 0, "coin_gain": coin_gain if won else -20,
        "leveled_up": leveled_up, "player": player,
        "is_boss": is_boss,
    })

@app.route("/shop")
@login_required
def shop_page():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    shops = load_shops()
    gid = str(session.get("guild_id", HOME_GUILD_ID))
    shop = shops.get(gid, {"weapons": [], "armor": [], "potions": [], "special": []})
    return render_template(
        "shop.html", player=player, shop=shop,
        username=session.get("username", "Player"),
        avatar_url=get_avatar_url(session["user_id"], session.get("avatar", "")),
    )

@app.route("/api/buy", methods=["POST"])
@login_required
def api_buy():
    item_id = request.json.get("item_id", "").lower()
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    shops = load_shops()
    gid = str(session.get("guild_id", HOME_GUILD_ID))
    shop = shops.get(gid, {})

    found_item = None
    for cat in ["weapons", "armor", "potions", "special"]:
        for item in shop.get(cat, []):
            if item["id"] == item_id:
                found_item = (item, cat)
                break
        if found_item:
            break

    if not found_item:
        return jsonify({"error": "Item not found"}), 404
    item, cat = found_item

    if player["coins"] < item["price"]:
        return jsonify({"error": "Not enough coins!"}), 400

    player["coins"] -= item["price"]

    if "heal" in item:
        player["health"] = min(player["max_health"], player["health"] + item["heal"])
        msg = f"Used {item['name']}! Restored {item['heal']} HP."
    elif "xp_boost" in item:
        player["xp"] += item["xp_boost"]
        msg = f"Used {item['name']}! Gained {item['xp_boost']} XP."
        if item["id"] == "soul_elixir":
            player["health"] = player["max_health"]
            msg += f" Fully healed to {player['health']}/{player['max_health']} HP!"
        if item["id"] == "elixir_of_eternity":
            player["health"] = player["max_health"]
            msg += f" Fully healed to {player['health']}/{player['max_health']} HP!"
        if item["id"] == "mirage_flask":
            player["health"] = min(player["max_health"], player["health"] + 5000)
            player["xp"] += 5000
            msg += f" Restored 5000 HP and gained 5000 XP (now {player['health']}/{player['max_health']} HP)!"
    elif cat in ["weapons", "armor"]:
        player["inventory"].append(item["id"])
        msg = f"Bought {item['name']}! Equip it from your inventory."
    else:
        if item["id"] == "lucky_charm":
            player["inventory"].append(item["id"])
        elif item["id"] == "enchanted_lure":
            player["inventory"].append(item["id"])
        elif item["id"] == "shield_ring":
            player["defense"] += 5
        elif item["id"] == "power_ring":
            player["attack"] += 5
        elif item["id"] == "life_crystal":
            player["max_health"] += 20
            player["health"] += 20
        elif item["id"] == "gravity_well":
            player["attack"] += 10
            player["defense"] += 10
        elif item["id"] == "soul_gem":
            player["attack"] += 15
            player["defense"] += 15
            player["max_health"] += 30
            player["health"] += 30
        elif item["id"] == "crystal_core":
            player["attack"] += 60
            player["defense"] += 60
            player["max_health"] += 150
            player["health"] += 150
        elif item["id"] == "essence_of_eternity":
            player["attack"] += 100
            player["defense"] += 100
            player["max_health"] += 250
            player["health"] += 250
        elif item["id"] == "dragon_heart":
            player["attack"] += 25
            player["defense"] += 25
            player["max_health"] += 50
            player["health"] += 50
        elif item["id"] == "celestial_blessing":
            player["attack"] += 40
            player["defense"] += 40
            player["max_health"] += 100
            player["health"] += 100
        elif item["id"] == "abyssal_heart":
            player["attack"] += 150
            player["defense"] += 150
            player["max_health"] += 350
            player["health"] += 350
        elif item["id"] == "soul_stone":
            player["attack"] += 200
            player["defense"] += 200
            player["max_health"] += 500
            player["health"] += 500
        elif item["id"] == "void_essence":
            player["attack"] += 300
            player["defense"] += 300
            player["max_health"] += 750
            player["health"] += 750
        elif item["id"] == "flame_of_eternity":
            player["attack"] += 400
            player["defense"] += 400
            player["max_health"] += 1000
            player["health"] += 1000
        elif item["id"] == "moonstone_aegis":
            player["attack"] += 500
            player["defense"] += 500
            player["max_health"] += 1250
            player["health"] += 1250
        elif item["id"] == "gaia_heart":
            player["attack"] += 600
            player["defense"] += 600
            player["max_health"] += 1500
            player["health"] += 1500
        elif item["id"] == "eclipse_core":
            player["attack"] += 750
            player["defense"] += 750
            player["max_health"] += 2000
            player["health"] += 2000
        elif item["id"] == "solar_prism":
            player["attack"] += 900
            player["defense"] += 900
            player["max_health"] += 3000
            player["health"] += 3000
        msg = f"Bought {item['name']}! {item['desc']}"

    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)

    # Notify Discord
    uname = session.get("username", "Player")
    notify_discord(
        f"🛒 Purchase — {uname}",
        f"Bought **{item['name']}** for 🪙 {item['price']}\n*{item['desc']}*",
        color=0xfee75c,
    )

    return jsonify({"success": True, "message": msg, "player": player})

@app.route("/api/equip", methods=["POST"])
@login_required
def api_equip():
    item_id = request.json.get("item_id", "").lower()
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    shops = load_shops()
    gid = str(session.get("guild_id", HOME_GUILD_ID))
    shop = shops.get(gid, {})

    if item_id not in player["inventory"]:
        return jsonify({"error": "Item not in inventory"}), 400

    for item in shop.get("weapons", []):
        if item["id"] == item_id:
            player["equipped_weapon"] = item_id
            save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
            return jsonify({"success": True, "message": f"Equipped {item['name']}!", "player": player})
    for item in shop.get("armor", []):
        if item["id"] == item_id:
            player["equipped_armor"] = item_id
            save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
            return jsonify({"success": True, "message": f"Equipped {item['name']}!", "player": player})

    return jsonify({"error": "Not equippable"}), 400

@app.route("/api/heal", methods=["POST"])
@login_required
def api_heal():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    if player["health"] >= player["max_health"]:
        return jsonify({"error": "Already at full health"}), 400
    if player["coins"] < 10:
        return jsonify({"error": "Not enough coins (need 10)"}), 400
    player["coins"] -= 10
    healed = min(player["max_health"] - player["health"], 30)
    player["health"] += healed
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)
    return jsonify({"success": True, "message": f"Healed {healed} HP!", "player": player})

@app.route("/api/daily", methods=["POST"])
@login_required
def api_daily():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    now = time.time()
    if now - player.get("last_daily", 0) < 86400:
        remaining = int(86400 - (now - player.get("last_daily", 0)))
        return jsonify({"error": f"Cooldown! {remaining}s remaining"}), 429
    base_coins = 50 + player["level"] * 10
    bonus_xp = 20 + player["level"] * 5
    bonus_text = ""
    roll = random.random()
    if roll < 0.05:
        player["coins"] += 500
        bonus_text = "JACKPOT! +500 bonus coins!"
    elif roll < 0.2:
        player["coins"] += 100
        bonus_text = "Lucky! +100 bonus coins!"
    player["coins"] += base_coins
    player["xp"] += bonus_xp
    player["last_daily"] = now
    save_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"], player)

    # Notify Discord
    uname = session.get("username", "Player")
    notify_discord(
        f"🎁 Daily Reward — {uname}",
        f"Claimed daily reward: 🪙 +{base_coins} coins | ⭐ +{bonus_xp} XP"
        + (f"\n{bonus_text}" if bonus_text else ""),
        color=0x57f287,
    )

    return jsonify({"success": True, "coins": base_coins, "xp": bonus_xp, "bonus": bonus_text, "player": player})

@app.route("/inventory")
@login_required
def inventory_page():
    player = get_player(session.get("guild_id", HOME_GUILD_ID), session["user_id"])
    shops = load_shops()
    gid = str(session.get("guild_id", HOME_GUILD_ID))
    shop = shops.get(gid, {})
    items = []
    counts = Counter(player["inventory"])
    for item_id, count in counts.items():
        name = item_id
        for cat in ["weapons", "armor", "potions", "special"]:
            for item in shop.get(cat, []):
                if item["id"] == item_id:
                    name = item["name"]
        items.append({"id": item_id, "name": name, "count": count})
    equipped = []
    if player.get("equipped_weapon"):
        for w in shop.get("weapons", []):
            if w["id"] == player["equipped_weapon"]:
                equipped.append(f"⚔️ {w['name']}")
    if player.get("equipped_armor"):
        for a in shop.get("armor", []):
            if a["id"] == player["equipped_armor"]:
                equipped.append(f"🛡️ {a['name']}")
    return render_template(
        "inventory.html", player=player, items=items,
        equipped=equipped, username=session.get("username", "Player"),
        avatar_url=get_avatar_url(session["user_id"], session.get("avatar", "")),
    )

@app.route("/leaderboard")
def leaderboard_page():
    players = load_players()
    # Show all players sorted by level, no login required (public page)
    sorted_p = sorted(players.values(), key=lambda x: (x.get("level", 0), x.get("monsters_killed", 0)), reverse=True)[:20]
    return render_template("leaderboard.html", players=sorted_p, username=session.get("username", ""))

if __name__ == "__main__":
    port = int(os.environ.get("WEB_PORT", 8081))
    app.run(host="0.0.0.0", port=port, debug=False)
