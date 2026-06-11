#!/usr/bin/env python3
"""
HermesBot Web Dashboard
Play the adventure game with a nice UI!
Connects to the same player data as the Discord bot.
"""

import json
import time
import random
import os
import sys
from pathlib import Path
from flask import Flask, render_template, request, redirect, url_for, session, jsonify

# ── Paths ──
BASE_DIR = Path(__file__).parent.parent  # HermesBot/
DATA_DIR = BASE_DIR / "data"
PLAYER_FILE = DATA_DIR / "players.json"
GUILD_SHOP_FILE = DATA_DIR / "guild_shops.json"

app = Flask(__name__, template_folder=str(BASE_DIR / "web" / "templates"), static_folder=str(BASE_DIR / "web" / "static"))
app.secret_key = os.environ.get("WEB_SECRET_KEY", "hermes-web-secret-key-change-this")

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

# ── Adventure data (same as bot) ──
ADVENTURE_LOCATIONS = [
    {"name": "🌲 Dark Forest", "description": "A dense, mysterious forest where shadows lurk between the trees.", "min_level": 1, "monsters": [{"name": "🐺 Wolf", "hp": 30, "atk": 8, "def": 2, "xp": 15, "coins": (10, 25)}, {"name": "🕷️ Giant Spider", "hp": 25, "atk": 10, "def": 1, "xp": 12, "coins": (8, 20)}, {"name": "👻 Ghost", "hp": 40, "atk": 12, "def": 3, "xp": 20, "coins": (15, 35)}, {"name": "🧟 Zombie", "hp": 50, "atk": 7, "def": 5, "xp": 18, "coins": (12, 30)}], "boss": {"name": "🌳 Treant Guardian", "hp": 150, "atk": 20, "def": 10, "xp": 80, "coins": (80, 150)}, "boss_chance": 0.15},
    {"name": "🏔️ Frozen Mountains", "description": "Icy peaks where only the brave dare to tread.", "min_level": 5, "monsters": [{"name": "❄️ Ice Elemental", "hp": 60, "atk": 18, "def": 8, "xp": 35, "coins": (25, 50)}, {"name": "🐻 Polar Bear", "hp": 80, "atk": 22, "def": 6, "xp": 40, "coins": (30, 55)}, {"name": "🦅 Frost Hawk", "hp": 45, "atk": 25, "def": 4, "xp": 30, "coins": (20, 45)}, {"name": "🧊 Ice Golem", "hp": 100, "atk": 15, "def": 15, "xp": 45, "coins": (35, 60)}], "boss": {"name": "🐉 Frost Dragon", "hp": 300, "atk": 35, "def": 20, "xp": 150, "coins": (150, 300)}, "boss_chance": 0.12},
    {"name": "🌋 Volcanic Caverns", "description": "Rivers of lava and chambers of fire.", "min_level": 10, "monsters": [{"name": "🔥 Fire Imp", "hp": 70, "atk": 30, "def": 10, "xp": 50, "coins": (40, 70)}, {"name": "🌋 Magma Beast", "hp": 120, "atk": 28, "def": 18, "xp": 60, "coins": (50, 85)}, {"name": "💀 Lava Skeleton", "hp": 90, "atk": 35, "def": 12, "xp": 55, "coins": (45, 75)}, {"name": "🦂 Fire Scorpion", "hp": 85, "atk": 32, "def": 15, "xp": 52, "coins": (42, 72)}], "boss": {"name": "👹 Inferno Lord", "hp": 500, "atk": 50, "def": 30, "xp": 250, "coins": (250, 500)}, "boss_chance": 0.10},
    {"name": "🏰 Abandoned Castle", "description": "A once-great castle now ruled by dark forces.", "min_level": 15, "monsters": [{"name": "⚔️ Dark Knight", "hp": 150, "atk": 40, "def": 25, "xp": 80, "coins": (60, 100)}, {"name": "🧙 Dark Mage", "hp": 100, "atk": 50, "def": 15, "xp": 90, "coins": (70, 110)}, {"name": "🦇 Vampire", "hp": 130, "atk": 45, "def": 20, "xp": 85, "coins": (65, 105)}, {"name": "💀 Death Knight", "hp": 180, "atk": 38, "def": 30, "xp": 95, "coins": (75, 120)}], "boss": {"name": "👑 Shadow King", "hp": 800, "atk": 65, "def": 40, "xp": 400, "coins": (400, 800)}, "boss_chance": 0.08},
    {"name": "🌌 The Void", "description": "The final frontier. Reality bends here.", "min_level": 20, "monsters": [{"name": "👁️ Void Watcher", "hp": 200, "atk": 55, "def": 35, "xp": 120, "coins": (100, 160)}, {"name": "🌀 Chaos Entity", "hp": 250, "atk": 60, "def": 30, "xp": 140, "coins": (120, 180)}, {"name": "💀 Reaper", "hp": 180, "atk": 70, "def": 25, "xp": 130, "coins": (110, 170)}, {"name": "🐲 Void Dragon", "hp": 350, "atk": 50, "def": 45, "xp": 160, "coins": (140, 220)}], "boss": {"name": "🌑 The Void Emperor", "hp": 1500, "atk": 90, "def": 60, "xp": 800, "coins": (800, 1500)}, "boss_chance": 0.05},
]

# ── Routes ──

@app.route("/")
def index():
    if "user_id" not in session:
        return redirect(url_for("login"))
    return redirect(url_for("dashboard"))

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        user_id = request.form.get("user_id", "").strip()
        guild_id = request.form.get("guild_id", "0").strip()
        if user_id:
            session["user_id"] = user_id
            session["guild_id"] = guild_id
            session["username"] = request.form.get("username", f"Player#{user_id[-4:]}")
            return redirect(url_for("dashboard"))
        return render_template("login.html", error="Please enter your Discord User ID")
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

@app.route("/dashboard")
def dashboard():
    if "user_id" not in session:
        return redirect(url_for("login"))
    player = get_player(session.get("guild_id", "0"), session["user_id"])
    xp_needed = player["level"] * 50
    xp_percent = min(100, int((player["xp"] / xp_needed) * 100)) if xp_needed > 0 else 0
    hp_percent = min(100, int((player["health"] / player["max_health"]) * 100)) if player["max_health"] > 0 else 0
    return render_template("dashboard.html", player=player, xp_needed=xp_needed, xp_percent=xp_percent, hp_percent=hp_percent, username=session.get("username", "Player"))

@app.route("/adventure")
def adventure_page():
    if "user_id" not in session:
        return redirect(url_for("login"))
    player = get_player(session.get("guild_id", "0"), session["user_id"])
    available = [loc for loc in ADVENTURE_LOCATIONS if loc["min_level"] <= player["level"]]
    return render_template("adventure.html", player=player, locations=available, username=session.get("username", "Player"))

@app.route("/api/adventure", methods=["POST"])
def api_adventure():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    player = get_player(session.get("guild_id", "0"), session["user_id"])
    now = time.time()
    if now - player.get("last_adventure", 0) < 30:
        return jsonify({"error": f"Cooldown! Wait {int(30 - (now - player.get('last_adventure', 0)))}s"}), 429

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
    gid = str(session.get("guild_id", "0"))
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
        xp_needed = player["level"] * 50
        while player["xp"] >= xp_needed:
            player["level"] += 1
            player["xp"] -= xp_needed
            player["max_health"] += 10
            player["health"] = player["max_health"]
            player["attack"] += 3
            player["defense"] += 2
            xp_needed = player["level"] * 50
            leveled_up = True
    else:
        player["deaths"] += 1
        player["health"] = player["max_health"] // 2
        player["coins"] = max(0, player["coins"] - 20)

    player["last_adventure"] = now
    save_player(session.get("guild_id", "0"), session["user_id"], player)

    return jsonify({
        "won": won, "enemy": enemy, "location": location["name"],
        "rounds": rounds, "combat_log": combat_log,
        "xp_gain": xp_gain if won else 0, "coin_gain": coin_gain if won else -20,
        "leveled_up": leveled_up, "player": player,
        "is_boss": is_boss,
    })

@app.route("/shop")
def shop_page():
    if "user_id" not in session:
        return redirect(url_for("login"))
    player = get_player(session.get("guild_id", "0"), session["user_id"])
    shops = load_shops()
    gid = str(session.get("guild_id", "0"))
    shop = shops.get(gid, {"weapons": [], "armor": [], "potions": [], "special": []})
    return render_template("shop.html", player=player, shop=shop, username=session.get("username", "Player"))

@app.route("/api/buy", methods=["POST"])
def api_buy():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    item_id = request.json.get("item_id", "").lower()
    player = get_player(session.get("guild_id", "0"), session["user_id"])
    shops = load_shops()
    gid = str(session.get("guild_id", "0"))
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
    elif cat in ["weapons", "armor"]:
        player["inventory"].append(item["id"])
        msg = f"Bought {item['name']}! Equip it from your inventory."
    else:
        if item["id"] == "lucky_charm":
            player["inventory"].append(item["id"])
        elif item["id"] == "shield_ring":
            player["defense"] += 5
        elif item["id"] == "power_ring":
            player["attack"] += 5
        elif item["id"] == "life_crystal":
            player["max_health"] += 20
            player["health"] += 20
        msg = f"Bought {item['name']}! {item['desc']}"

    save_player(session.get("guild_id", "0"), session["user_id"], player)
    return jsonify({"success": True, "message": msg, "player": player})

@app.route("/api/equip", methods=["POST"])
def api_equip():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    item_id = request.json.get("item_id", "").lower()
    player = get_player(session.get("guild_id", "0"), session["user_id"])
    shops = load_shops()
    gid = str(session.get("guild_id", "0"))
    shop = shops.get(gid, {})

    if item_id not in player["inventory"]:
        return jsonify({"error": "Item not in inventory"}), 400

    for item in shop.get("weapons", []):
        if item["id"] == item_id:
            player["equipped_weapon"] = item_id
            save_player(session.get("guild_id", "0"), session["user_id"], player)
            return jsonify({"success": True, "message": f"Equipped {item['name']}!", "player": player})
    for item in shop.get("armor", []):
        if item["id"] == item_id:
            player["equipped_armor"] = item_id
            save_player(session.get("guild_id", "0"), session["user_id"], player)
            return jsonify({"success": True, "message": f"Equipped {item['name']}!", "player": player})

    return jsonify({"error": "Not equippable"}), 400

@app.route("/api/heal", methods=["POST"])
def api_heal():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    player = get_player(session.get("guild_id", "0"), session["user_id"])
    if player["health"] >= player["max_health"]:
        return jsonify({"error": "Already at full health"}), 400
    if player["coins"] < 10:
        return jsonify({"error": "Not enough coins (need 10)"}), 400
    player["coins"] -= 10
    healed = min(player["max_health"] - player["health"], 30)
    player["health"] += healed
    save_player(session.get("guild_id", "0"), session["user_id"], player)
    return jsonify({"success": True, "message": f"Healed {healed} HP!", "player": player})

@app.route("/api/daily", methods=["POST"])
def api_daily():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    player = get_player(session.get("guild_id", "0"), session["user_id"])
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
    save_player(session.get("guild_id", "0"), session["user_id"], player)
    return jsonify({"success": True, "coins": base_coins, "xp": bonus_xp, "bonus": bonus_text, "player": player})

@app.route("/inventory")
def inventory_page():
    if "user_id" not in session:
        return redirect(url_for("login"))
    player = get_player(session.get("guild_id", "0"), session["user_id"])
    shops = load_shops()
    gid = str(session.get("guild_id", "0"))
    shop = shops.get(gid, {})
    items = []
    from collections import Counter
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
    return render_template("inventory.html", player=player, items=items, equipped=equipped, username=session.get("username", "Player"))

@app.route("/leaderboard")
def leaderboard_page():
    players = load_players()
    guild_players = {k: v for k, v in players.items() if str(v.get("guild_id")) == str(session.get("guild_id", "0"))}
    sorted_p = sorted(guild_players.values(), key=lambda x: x.get("level", 0), reverse=True)[:20]
    return render_template("leaderboard.html", players=sorted_p, username=session.get("username", "Player"))

if __name__ == "__main__":
    port = int(os.environ.get("WEB_PORT", 8081))
    app.run(host="0.0.0.0", port=port, debug=False)
