import random, math, copy

# ── UTILITY ──────────────────────────────────────────────
def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def xp_for_level(level):
    """Steep XP curve: quadratic (N²·20) past the tutorial so auto-grinding
    slows down — before Lv.20 the classic N*100 keeps new players moving."""
    if level < 20:
        return int(100 * (1.35 ** (level - 1)))
    return int(level * level * 20)

MAX_PLAYER_LEVEL = 100

def get_level(player):
    """Player level based on cumulative XP. Unlimited — no cap."""
    xp = player.get("xp", 0)
    lv = player.get("level", 1)
    while True:
        needed = xp_for_level(lv)
        if xp >= needed:
            xp -= needed
            lv += 1
        else:
            return lv

def level_up(player):
    """Apply pending level-ups while XP >= threshold. Unlimited — no cap.
    Before Lv.20 the classic curve applies; from Lv.20 the curve is quadratic
    (N²·20) so leveling meaningfully slows after the tutorial. Returns levels gained.
    Every 5th level (Lv.5, 10, 15, ...) also grants one Mystery Egg so pets come
    from level milestones instead of raining from every kill."""
    gained = 0
    old_lv = player.get("level", 1)
    while player.get("xp", 0) >= xp_for_level(player.get("level", 1)):
        player["xp"] -= xp_for_level(player.get("level", 1))
        player["level"] = player.get("level", 1) + 1
        player["max_health"] = player.get("max_health", 100) + 10
        player["health"] = player["max_health"]
        player["attack"] = player.get("attack", 10) + 3
        player["defense"] = player.get("defense", 5) + 2
        gained += 1
    # Milestone egg: one per crossed multiple of 5 (Lv.5, 10, 15 ...) up to the cap.
    for lv in range(old_lv + 1, player.get("level", 1) + 1):
        if lv % 5 == 0:
            player.setdefault("inventory", []).append({
                "name": "Mystery Egg", "type": "egg", "icon": "🥚",
                "rarity": "Common", "id": f"egg_{int(random.random() * 1e9)}",
                "stats": {}})
    return gained

# ── ASSIGN STARTER CLASS ─────────────────────────────
# Starter rolls deliberately use the 18 non-unique classes. UNIQUE classes are
# globally scarce progression rewards and must never leak into account creation.
STARTER_RARITY_WEIGHTS = {
    "common": 40,
    "uncommon": 30,
    "rare": 18,
    "epic": 9,
    "legendary": 3,
}


def assign_starter(player):
    """Assign one of the 18 starter classes using rarity-first weighting."""
    from game_data import CLASSES
    if player.get("class_name"):
        return None  # already has a class

    pools = {
        rarity: [c for c in CLASSES.values() if c.get("rarity") == rarity]
        for rarity in STARTER_RARITY_WEIGHTS
    }
    available_rarities = [rarity for rarity, classes in pools.items() if classes]
    if not available_rarities:
        raise RuntimeError("No starter classes are configured")

    # Roll the rarity first so adding another class does not silently increase
    # that tier's overall probability, then choose uniformly within the tier.
    rarity = random.choices(
        available_rarities,
        weights=[STARTER_RARITY_WEIGHTS[r] for r in available_rarities],
        k=1,
    )[0]
    c = random.choice(pools[rarity])

    player["class_name"] = c["name"]
    player["class_emoji"] = c["emoji"]
    player["class_rarity"] = c["rarity"]
    player["base_hp"] = c["base_hp"]
    player["base_atk"] = c["base_atk"]
    player["base_def"] = c["base_def"]
    player["base_spd"] = c["base_spd"]
    # Init derived
    player["atk"] = c["base_atk"]
    player["def"] = c["base_def"]
    player["spd"] = c["base_spd"]
    player["hp"] = c["base_hp"]
    player["max_hp"] = c["base_hp"]
    player["coins"] = player.get("coins", 50)
    player["xp"] = player.get("xp", 0)
    player["level"] = 1
    player["tower_floor"] = 1
    player["highest_floor"] = 1
    return c

def calc_stats(player):
    """Compute player stats with level scaling + pet bonuses."""
    lv = get_level(player)
    base_atk = player.get("base_atk", 10)
    base_def = player.get("base_def", 5)
    base_spd = player.get("base_spd", 6)
    base_hp  = player.get("base_hp", 80)
    # Skills
    skills = player.get("skills", {})
    skill_atk = sum(v.get("atk", 0) for v in skills.values())
    skill_def = sum(v.get("def", 0) for v in skills.values())
    skill_spd = sum(v.get("spd", 0) for v in skills.values())
    skill_hp  = sum(v.get("hp", 0) for v in skills.values())

    # Level scaling: +5% per level
    scale = 1 + (lv - 1) * 0.05

    atk = int((base_atk + skill_atk) * scale)
    defense = int((base_def + skill_def) * scale)
    
    # Equipment bonuses
    eq_w = player.get("equipped_weapon")
    eq_a = player.get("equipped_armor")
    eq_h = player.get("equipped_helmet")
    eq_s = player.get("equipped_shield")
    eq_b = player.get("equipped_boots")

    # Role-locked weapons: wield a weapon your role/class can't use → 0 damage.
    if isinstance(eq_w, dict) and eq_w.get("roles"):
        my_roles = _player_role_set(player)
        if not (my_roles & set(eq_w["roles"])):
            eq_w = dict(eq_w)  # copy, don't mutate player data
            eq_w["stats"] = {**eq_w.get("stats", {}), "attack": 0}

    for eq in [eq_w, eq_a, eq_h, eq_s, eq_b]:
        if eq:
            if isinstance(eq, dict):
                atk += eq.get("stats", {}).get("attack", 0)
                defense += eq.get("stats", {}).get("defense", 0)
            else:
                atk += 10
                defense += 10

            
    player["atk"] = atk
    player["def"] = defense
    player["spd"] = int((base_spd + skill_spd) * scale)
    player["max_hp"] = int((base_hp + skill_hp) * scale)

    # Pet bonuses (equipped + owned in party). New web pets are stored as
    # dicts with stable IDs; legacy pets use names from PET_TIERS.
    party = player.get("equipped_pets", [])
    if player.get("equipped_pet") and player["equipped_pet"] not in party:
        party.append(player["equipped_pet"])
    owned_pets = {p.get("id"): p for p in player.get("pets", []) if isinstance(p, dict) and p.get("id")}
    for pet_name in party:
        saved_pet = owned_pets.get(pet_name)
        if saved_pet:
            player["atk"] += int(saved_pet.get("atk_bonus", 0) or 0)
            player["def"] += int(saved_pet.get("def_bonus", 0) or 0)
            player["max_hp"] += int(saved_pet.get("hp_bonus", 0) or 0)
            continue
        from game_data import PET_TIERS, PET_LEVEL_CAP
        info = PET_TIERS.get(pet_name)
        if not info:
            continue
        pet_lv = min(player.get("pet_levels", {}).get(pet_name, 1), PET_LEVEL_CAP)
        pmult = 1 + (pet_lv - 1) * 0.2
        player["atk"] += int(info["atk_bonus"] * pmult)
        player["def"] += int(info["def_bonus"] * pmult)
        player["max_hp"] += int(info["hp_bonus"] * pmult)

    player["hp"] = min(player.get("hp", player["max_hp"]), player["max_hp"])

    # Dual class: 33% of second class base stats added
    if player.get("has_second_class") and player.get("second_class_name"):
        from game_data import CLASSES
        sc = CLASSES.get(player["second_class_name"])
        if sc:
            player["atk"] += int(sc["base_atk"] * 0.33)
            player["def"] += int(sc["base_def"] * 0.33)
            player["max_hp"] += int(sc["base_hp"] * 0.33)
            player["spd"] += int(sc["base_spd"] * 0.33)
            player["hp"] = min(player.get("hp", player["max_hp"]), player["max_hp"])

    # Mirror to legacy keys used by combat routes (adventure/tower/dungeon/duel/heal)
    player["attack"] = player["atk"]
    player["defense"] = player["def"]
    player["speed"] = player["spd"]
    player["max_health"] = player["max_hp"]
    player["health"] = min(player.get("health", player["max_health"]), player["max_health"])
    return player

# ── POTIONS ───────────────────────────────────────────────────────────────
# Many dropped potions are {"name":"Healing Potion","type":"potion","rarity":"Common"}
# with NO stats dict, so heal amount defaults to POTION_DEFAULT_HEAL.
POTION_DEFAULT_HEAL = 50

def potion_heal_amount(item):
    """Heal value of a potion item — from stats if present, else default."""
    if not isinstance(item, dict):
        return 0
    itype = str(item.get("type") or item.get("category") or "").lower()
    if "potion" not in itype:
        return 0
    stats = item.get("stats") or {}
    heal = int(stats.get("heal", 0) or 0)
    return heal if heal > 0 else POTION_DEFAULT_HEAL

def maybe_auto_drink(player):
    """Auto-drink one healing potion when HP <= 50% of max. Returns (drank, message)."""
    inv = player.get("inventory") or []
    if not inv:
        return False, ""
    cur = player.get("health", 0)
    max_hp = player.get("max_health", 100)
    if cur > max_hp * 0.5 or cur >= max_hp:
        return False, ""
    for i, item in enumerate(inv):
        heal = potion_heal_amount(item)
        if heal <= 0:
            continue
        healed = min(max_hp, cur + heal) - cur
        player["health"] = min(max_hp, cur + heal)
        name = item.get("name", "Healing Potion") if isinstance(item, dict) else "Healing Potion"
        inv.pop(i)
        player["inventory"] = inv
        return True, f"🧪 Auto-drank **{name}**! +{healed} HP ({player['health']}/{max_hp})"
    return False, ""

# ── Role-locked weapons ───────────────────────────────────────────────
_CLASS_ROLE_GROUP = {
    "warrior": ("swordmaster", "berserker", "paladin", "warlord"),
    "mage": ("mage", "archmage"),
    "archer": ("ranger",),
    "thief": ("assassin",),
    "knight": ("paladin", "swordmaster", "warlord"),
    "sorcerer": ("mage", "archmage"),
    "hunter": ("ranger", "assassin"),
    "assassin": ("assassin",),
    "paladin": ("paladin", "swordmaster"),
    "warlock": ("mage", "archmage", "necromancer"),
    "ranger": ("ranger",),
    "ninja": ("assassin", "swordmaster"),
    "berserker": ("berserker", "swordmaster"),
    "necromancer": ("mage", "archmage"),
    "shadow blade": ("assassin", "swordmaster"),
    "dragon knight": ("swordmaster", "berserker", "paladin"),
    "void mage": ("mage", "archmage"),
    "phantom lord": ("assassin", "warlord"),
}

def _player_role_set(player):
    """Roles this player can fight with — from chosen role + class group."""
    roles = set()
    r = str(player.get("role", "") or "").strip().lower()
    if r:
        roles.add(r)
    c = str(player.get("class_name", "") or "").strip().lower()
    if c:
        roles.update(_CLASS_ROLE_GROUP.get(c, (c,)))
    return roles

# ── Class rank progression (Novice → Awakening → Expert → Master) ──
_ROLE_STAGE_NAMES = {
    "swordmaster": ("Novice Swordsman", "Qi Awakening", "Aura Expert", "Swordmaster"),
    "mage":        ("Novice Mage", "Mana Awakening", "Aura Expert", "Archmage"),
    "ranger":      ("Novice Ranger", "Wind Awakening", "Aura Expert", "Ranger Master"),
    "paladin":     ("Novice Squire", "Light Awakening", "Aura Expert", "Paladin"),
    "berserker":   ("Novice Warrior", "Rage Awakening", "Aura Expert", "Berserker"),
    "assassin":    ("Novice Assassin", "Shadow Awakening", "Aura Expert", "Assassin Master"),
    "archmage":    ("Novice Mage", "Mana Awakening", "Aura Expert", "Archmage"),
    "warlord":     ("Novice Warrior", "Rage Awakening", "Aura Expert", "Warlord"),
}
_ROLE_STAGE_ICONS = ("🌱", "✨", "⚡", "👑")


def get_role_rank(player):
    """Stage + rank ladder: Lv1-10 Novice, 11-20 Awakening, 21-30 Expert, 31+ Master.
    Master rank (1-10) advances via Tower climbing — duels no longer gate ranks."""
    lv = get_level(player)
    role = str(player.get("role", "") or "").lower()
    names = _ROLE_STAGE_NAMES.get(role, ("Novice", "Awakening", "Expert", "Master"))
    if lv <= 10:
        stage, rank = 0, max(1, lv)
    elif lv <= 20:
        stage, rank = 1, max(1, lv - 10)
    elif lv <= 30:
        stage, rank = 2, max(1, lv - 20)
    else:
        stage = 3
        if "master_floor_base" not in player:
            player["master_floor_base"] = player.get("highest_floor", 1)
        rank = min(10, max(1, 1 + int(player.get("highest_floor", 1)) - int(player.get("master_floor_base", 1))))
    stage_name = names[stage]
    stage_icon = _ROLE_STAGE_ICONS[stage]
    # Rank-accurate hint: each rank = +1 level inside a stage (same cadence as the
    # very first rank). Only at Rank 10 does the hint point at the next stage.
    if stage == 3:
        hint = "Climb the Tower to advance your Master rank!"
    elif rank >= 10:
        hint = f"Reach Lv.{(stage + 1) * 10 + 1} to advance to {names[stage + 1]}!"
    else:
        hint = f"Reach Lv.{lv + 1} to advance"
    return {"stage": stage, "stage_name": stage_name, "icon": stage_icon,
            "rank": rank, "rank_max": 10, "hint": hint}


# ── DUAL CLASS LEVELING ────────────────────────────────
# Second class gains 50% of the XP you earn in Adventure/Duels.
# Rarity upgrades at milestone levels; Lv25 tries to claim a UNIQUE slot
# (one-of-a-kind — first player to reach it locks it forever).
# Cost matches the main-class cadence (level * ~20 XP) so the dual class
# keeps pace with your main class instead of crawling 6x slower.
SECOND_CLASS_MAX_LEVEL = 25
SECOND_CLASS_XP_PER_LEVEL = 20  # level N needs N*20 XP (same feel as main leveling)
SECOND_RARITY_MILESTONES = {5: "uncommon", 10: "rare", 15: "epic", 20: "legendary", 25: "unique"}
_SECOND_CIRCLES = ((21, "Circle VII", "🔮"), (18, "Circle VI", "💠"), (15, "Circle V", "⭐"),
                   (12, "Circle IV", "✨"), (9, "Circle III", "🌟"), (6, "Circle II", "☀️"),
                   (1, "Circle I", "🌱"))


def second_class_rank(player):
    """Circle ladder for the second class, driven by second_class_level (1-15)."""
    lvl = max(1, player.get("second_class_level", 1))
    for floor, name, icon in _SECOND_CIRCLES:
        if lvl >= floor:
            return {"circle": name, "icon": icon, "level": lvl,
                    "xp": player.get("second_class_xp", 0),
                    "xp_needed": lvl * SECOND_CLASS_XP_PER_LEVEL}
    return {"circle": "Circle I", "icon": "🌱", "level": lvl,
            "xp": player.get("second_class_xp", 0),
            "xp_needed": lvl * SECOND_CLASS_XP_PER_LEVEL}


def level_up_second_class(player, xp_gain):
    """Grant XP to the dual class. Returns event list:
    {"type":"level","level":N}, {"type":"rarity","rarity":r}, {"type":"unique_claim","class_name":n}.
    NOTE: unique_claim events need the caller to confirm via the claims store;
    on rejection the caller must reset rarity to "legendary"."""
    events = []
    if not player.get("has_second_class"):
        return events
    lvl = max(1, player.get("second_class_level", 1))
    xp = player.get("second_class_xp", 0) + max(1, int(xp_gain))
    while lvl < SECOND_CLASS_MAX_LEVEL:
        need = lvl * SECOND_CLASS_XP_PER_LEVEL
        if xp < need:
            break
        xp -= need
        lvl += 1
        events.append({"type": "level", "level": lvl})
        if lvl in SECOND_RARITY_MILESTONES:
            player["second_class_rarity"] = SECOND_RARITY_MILESTONES[lvl]
            events.append({"type": "rarity", "rarity": player["second_class_rarity"]})
            if lvl == SECOND_CLASS_MAX_LEVEL:
                events.append({"type": "unique_claim", "class_name": player.get("second_class_name", "")})
    player["second_class_level"] = lvl
    player["second_class_xp"] = xp
    return events

def get_enemy_stats(floor):
    """Generate enemy stats for tower floor."""
    from game_data import TOWER_ENEMY_SCALING as T, BOSS_FLOORS, BOSS_MULT, tower_loot_bonus
    is_boss = floor in BOSS_FLOORS
    hp  = T["base_hp"] + T["hp_per_floor"] * (floor - 1)
    atk = T["base_atk"] + T["atk_per_floor"] * (floor - 1)
    dfn = T["base_def"] + T["def_per_floor"] * (floor - 1)
    spd = T["base_spd"] + T["spd_per_floor"] * (floor - 1)
    xp_r = int((T["xp_base"] + T["xp_per_floor"] * (floor - 1)) * tower_loot_bonus(floor, is_boss))
    coin = int((T["coin_base"] + T["coin_per_floor"] * (floor - 1)) * tower_loot_bonus(floor, is_boss))

    names_pool = ["Goblin","Skeleton","Slime","Shadow Wolf","Cultist","Dark Elf","Wraith","Minotaur","Chimera","Hydra"]
    boss_names = ["Abyssal Lord","Dragon King","Shadow Titan","Void Emperor","Celestial Guardian"]
    if is_boss:
        hp  = int(hp * BOSS_MULT["hp"])
        atk = int(atk * BOSS_MULT["atk"])
        dfn = int(dfn * BOSS_MULT["def"])
        name = random.choice(boss_names)
    else:
        name = random.choice(names_pool) + f" Lv.{floor}"
    return {"name": name, "hp": hp, "max_hp": hp, "atk": atk, "def": dfn, "spd": spd,
            "xp_reward": xp_r, "coin_reward": coin, "is_boss": is_boss, "floor": floor}

def roll_pet_drop(floor, is_boss):
    """Roll for pet drop (boss = 2x rate)."""
    from game_data import PET_TIERS
    roll = random.random()
    mult = 2 if is_boss else 1
    # Higher floors favor rarer pets
    rarity_order = ["legendary","epic","rare","uncommon","common"]
    for r in rarity_order:
        info = PET_TIERS[r]
        rate = info["drop_rate"] * mult * (1 + floor * 0.005)
        if roll < rate:
            return r
        roll -= rate
    return None

def roll_floor_reward(floor, is_boss):
    """Roll floor-aware mail loot; bosses guarantee larger quantities."""
    from game_data import FLOOR_REWARDS
    # Material and gear pools improve by tower band.  This avoids low-floor
    # legendary drops while making high-floor clears meaningfully different.
    if floor <= 20:
        allowed = {"skill_book", "xp_scroll", "healing_potion", "iron_ore",
                   "undead_bones", "common_weapon", "ores", "bones"}
    elif floor <= 40:
        allowed = {"skill_book", "xp_scroll", "temple_coupon", "pet_egg",
                   "healing_potion", "iron_ore", "undead_bones", "rare_weapon",
                   "ores", "bones", "cloth"}
    elif floor <= 70:
        allowed = {"skill_book", "xp_scroll", "temple_coupon", "pet_egg",
                   "healing_potion", "dragon_scales", "silk_cloth", "epic_weapon",
                   "scales", "cloth", "gems"}
    else:
        allowed = {"skill_book", "xp_scroll", "temple_coupon", "pet_egg",
                   "dragon_scales", "silk_cloth", "legendary_weapon",
                   "scales", "cloth", "gems"}

    entries = [(key, reward) for key, reward in FLOOR_REWARDS.items() if key in allowed]
    items = [reward for _, reward in entries]
    weights = []
    for key, reward in entries:
        weight = reward["weight"]
        if is_boss and key in {"pet_egg", "skill_book", "temple_coupon", "gems",
                               "rare_weapon", "epic_weapon", "legendary_weapon"}:
            weight *= 3
        weights.append(weight)
    chosen = random.choices(items, weights=weights, k=1)[0]
    floor_bonus = min(3, floor // 30)
    qty = random.randint(2, 4) + floor_bonus if is_boss else random.randint(1, 2) + floor_bonus
    return {"type": chosen["name"], "emoji": chosen["emoji"],
            "desc": chosen["desc"], "qty": qty, "floor_band": min(4, (floor - 1) // 20 + 1),
            "boss_bonus": bool(is_boss)}

def tower_combat(player):
    """Run a tower floor battle. Returns result dict."""
    from game_data import BOSS_FLOORS, get_required_level

    calc_stats(player)

    floor = player.get("tower_floor", 1)

    # Level gate check
    req_lv = get_required_level(floor)
    p_lv = get_level(player)
    if p_lv < req_lv:
        return {"error": f"❌ Floor {floor} requires Level **{req_lv}** (you're Level {p_lv}). Grind Adventure to level up!"}

    assign_starter(player)
    calc_stats(player)

    enemy = get_enemy_stats(floor)

    # Combat (auto-battle with speed turn system)
    log = []
    p_hp = player["hp"]
    p_atk = player["atk"]
    p_def = player["def"]
    p_spd = player["spd"]
    e_hp = enemy["hp"]
    e_atk = enemy["atk"]
    e_def = enemy["def"]
    e_spd = enemy["spd"]

    log.append(f"**⚔️ Floor {floor}** — {enemy['name']} appears!")
    log.append(f"🗡️ You: ❤️{p_hp}/{player['max_hp']} ⚔️{p_atk} 🛡️{p_def} 💨{p_spd}")
    log.append(f"👹 Enemy: ❤️{e_hp} ⚔️{e_atk} 🛡️{e_def} 💨{e_spd}")

    # Pet party bonuses
    party = player.get("equipped_pets", [])
    if player.get("equipped_pet") and player["equipped_pet"] not in party:
        party.append(player["equipped_pet"])
    if party:
        log.append(f"🐾 Party: {', '.join(p.title() for p in party)}")

    turns = 0
    max_turns = 50
    victory = False
    pet_drop = None
    while turns < max_turns:
        turns += 1
        # Player attacks first if faster
        first = p_spd >= e_spd
        for attacker_first in [first, not first]:
            if attacker_first:
                dmg = max(1, p_atk - e_def // 2 + random.randint(-3, 5))
                e_hp -= dmg
                log.append(f"⚔️ You hit for **{dmg}** (Enemy ❤️{max(0,e_hp)})")
                if e_hp <= 0:
                    victory = True
                    break
            else:
                dmg = max(1, e_atk - p_def // 2 + random.randint(-3, 5))
                p_hp -= dmg
                log.append(f"💥 Enemy hits for **{dmg}** (You ❤️{max(0,p_hp)})")
                if p_hp <= 0:
                    victory = False
                    break
        if victory or p_hp <= 0:
            break

    if victory:
        from game_data import TOWER_MAX_FLOORS
        player["hp"] = p_hp
        player["tower_floor"] = min(floor + 1, TOWER_MAX_FLOORS)  # 100 = summit
        player["highest_floor"] = max(player.get("highest_floor", 1), floor)
        player["total_wins"] = player.get("total_wins", 0) + 1
        player["xp"] = player.get("xp", 0) + enemy["xp_reward"]
        player["coins"] = player.get("coins", 0) + enemy["coin_reward"]

        # Pet drop
        pet_drop = None
        if not player.get("pets"):
            player["pets"] = []
        if not player.get("pet_levels"):
            player["pet_levels"] = {}
        pet_drop = roll_pet_drop(floor, enemy["is_boss"])
        if pet_drop and pet_drop not in player["pets"]:
            player["pets"].append(pet_drop)
            player["pet_levels"][pet_drop] = 1
            log.append(f"🎉 **New Pet: {pet_drop.title()}!**")

        # Floor reward (mail)
        mail_reward = roll_floor_reward(floor, enemy["is_boss"])
        if "mail" not in player:
            player["mail"] = []
        player["mail"].append({
            "subject": f"Floor {floor} Reward",
            "from": "Tower",
            "body": f"🎁 You cleared Floor {floor}! {mail_reward['emoji']} {mail_reward['type']} x{mail_reward['qty']}",
            "reward": mail_reward,
            "claimed": False,
            "floor": floor,
        })

        leveled = False
        old_lv = get_level(player)
        # Recalc with new XP
        new_lv = get_level(player)
        if new_lv > old_lv:
            leveled = True
            player["hp"] = player["max_hp"]  # Full heal on level up
            log.append(f"⬆️ **LEVEL UP!** You are now Level {new_lv}! HP restored!")

        calc_stats(player)
        player["hp"] = p_hp if not leveled else player["max_hp"]

        # Pet XP gain (pets level with you)
        from game_data import PET_LEVEL_CAP
        for pet in player.get("pets", []):
            pet_lv = player["pet_levels"].get(pet, 1)
            if pet_lv < PET_LEVEL_CAP and random.random() < 0.1:  # 10% chance per floor
                player["pet_levels"][pet] = pet_lv + 1
                log.append(f"🐾 **{pet.title()}** leveled up to {pet_lv + 1}!")

        log.append(f"✅ **Victory!** 🪙+{enemy['coin_reward']} ⭐+{enemy['xp_reward']} XP")
        if mail_reward:
            log.append(f"📬 Mail reward: {mail_reward['emoji']} {mail_reward['type']} x{mail_reward['qty']}")
    else:
        player["hp"] = max(1, p_hp // 2)  # Revive with half HP
        player["total_losses"] = player.get("total_losses", 0) + 1
        pity_xp = max(5, enemy["xp_reward"] // 3)
        pity_coins = max(2, enemy["coin_reward"] // 4)
        player["xp"] = player.get("xp", 0) + pity_xp
        player["coins"] = player.get("coins", 0) + pity_coins
        log.append(f"❌ **Defeated!** You wake up with ❤️{player['hp']}. Pity: ⭐+{pity_xp} 🪙+{pity_coins}")

    player["hp"] = clamp(player["hp"], 0, player["max_hp"])

    return {
        "victory": victory,
        "new_floor": player["tower_floor"],
        "log": log,
        "rewards": {"coins": enemy["coin_reward"], "xp": enemy["xp_reward"]},
        "pet_drop": pet_drop,
        "leveled": leveled if victory else False,
        "player_stats": {"hp": player["hp"], "max_hp": player["max_hp"]},
        "enemy": enemy,
    }

def get_story_chapter(tower_floor):
    from game_data import STORY_CHAPTERS
    current = STORY_CHAPTERS[0] if STORY_CHAPTERS else None
    for ch in STORY_CHAPTERS:
        parts = ch["floors"].split("-")
        floor_min = int(parts[0]) if parts else 1
        if tower_floor >= floor_min:
            current = ch
    return current

def get_unlocked_chapter(player):
    """Get the most recent story chapter fully unlocked by player."""
    from game_data import STORY_CHAPTERS
    unlocked = player.get("story_chapter", 0)
    tower_floor = player.get("tower_floor", 1)
    player_level = player.get("level", 1)
    
    latest = None
    for ch in STORY_CHAPTERS:
        parts = ch["floors"].split("-")
        floor_required = int(parts[1]) if len(parts) > 1 else int(parts[0])
        if tower_floor >= floor_required and player_level >= ch.get("level_required", 1):
            latest = ch
    
    # Award first-time rewards for newly unlocked chapters
    completed_chapters = player.get("completed_chapters", [])
    new_rewards = []
    for ch in STORY_CHAPTERS:
        ch_id = ch["chapter"]
        if ch_id in completed_chapters:
            continue
        parts = ch["floors"].split("-")
        floor_required = int(parts[1]) if len(parts) > 1 else int(parts[0])
        if tower_floor >= floor_required and player_level >= ch.get("level_required", 1):
            completed_chapters.append(ch_id)
            new_rewards.append(ch)
    
    if new_rewards:
        player["completed_chapters"] = completed_chapters
        # Award chapter completion rewards
        for ch in new_rewards:
            r = ch.get("rewards", {})
            if r.get("coins"):
                player["coins"] = player.get("coins", 0) + r["coins"]
            if r.get("xp"):
                player["xp"] = player.get("xp", 0) + r["xp"]
            # Skills
            for skill_name in r.get("skills", []):
                from game_data import SKILLS
                if skill_name in SKILLS and skill_name not in player.get("skills", {}):
                    player.setdefault("skills", {})[skill_name] = dict(SKILLS[skill_name])
            # Items
            for item_name in r.get("items", []):
                player.setdefault("inventory", []).append(item_name)
            # Lucky roll for rare items
            ic = r.get("item_chance", {})
            if ic and ic.get("chance", 0) > 0 and random.randint(1, 100) <= ic["chance"]:
                bonus_item = {
                    "id": ic["name"].lower().replace(" ", "_"),
                    "name": ic["name"],
                    "type": "weapon",
                    "rarity": ic.get("rarity", "common"),
                    "stats": {"attack": 5 + (ch["chapter"] * 3), "defense": 2 + ch["chapter"]}
                }
                player.setdefault("inventory", []).append(bonus_item)
                new_rewards[-1]["bonus_item"] = ic["name"]
    
    player["story_chapter"] = latest["chapter"] if latest else 0
    return latest, new_rewards

def get_skill_shop(player):
    from game_data import SKILLS
    owned = player.get("skills", {})
    return {k: v for k, v in SKILLS.items() if k not in owned}

def buy_skill(player, skill_name):
    from game_data import SKILLS
    if skill_name not in SKILLS:
        return False, "Skill not found"
    if skill_name in player.get("skills", {}):
        return False, "Already owned"
    cost = SKILLS[skill_name]["cost"]
    if player.get("coins", 0) < cost:
        return False, f"Need {cost} coins, have {player.get('coins', 0)}"
    if "skills" not in player:
        player["skills"] = {}
    player["skills"][skill_name] = dict(SKILLS[skill_name])
    player["coins"] -= cost
    calc_stats(player)
    return True, f"Learned **{skill_name}**!"

def upgrade_skill(player, skill_name):
    if "skills" not in player or skill_name not in player["skills"]:
        return False, "Skill not owned"
    skill = player["skills"][skill_name]
    lv = skill.get("level", 1)
    if lv >= 5:
        return False, "Skill at max level (5)"
    cost = int(skill["cost"] * 0.6 * lv)
    if player.get("coins", 0) < cost:
        return False, f"Need {cost} coins"
    player["coins"] -= cost
    skill["level"] = lv + 1
    # Boost effect
    for stat in ["atk", "def", "spd", "hp"]:
        if stat in skill:
            skill[stat] = int(skill[stat] * 1.2)
    player["skills"][skill_name] = skill
    calc_stats(player)
    return True, f"**{skill_name}** upgraded to level {lv + 1}!"

TEMPLE_COST = {1: 100, 2: 200, 3: 500, 4: 1500, 5: 5000}
def upgrade_class(player):
    from game_data import RARITY_ORDER, CLASSES
    cur_rarity = player.get("class_rarity", "common")
    order = ["common","uncommon","rare","epic","legendary"]
    idx = order.index(cur_rarity)
    if idx >= len(order) - 1:
        return False, "Already max rarity (Legendary)!"
    cost = TEMPLE_COST.get(idx + 1, 9999)
    if player.get("coins", 0) < cost:
        return False, f"Need {cost} coins for {order[idx+1].title()} upgrade"
    player["coins"] -= cost
    player["class_rarity"] = order[idx + 1]
    calc_stats(player)
    return True, f"✨ Upgraded to **{order[idx+1].title()}** class! {CLASSES[player['class_name']]['emoji']}"

def check_achievements(player):
    from game_data import ACHIEVEMENTS
    new_achs = []
    total_wins = player.get("total_wins", 0)
    tower_floor = player.get("tower_floor", 1)
    lv = get_level(player)
    coins = player.get("coins", 0)
    num_pets = len(player.get("pets", []))
    num_skills = len(player.get("skills", {}))
    unlocked = player.get("achievements", [])

    for a in ACHIEVEMENTS:
        if a["name"] in unlocked:
            continue
        cond = a["condition"]
        met = False
        if cond.startswith("wins>="):
            met = total_wins >= int(cond.split(">=")[1])
        elif cond.startswith("tower_floor>="):
            met = tower_floor >= int(cond.split(">=")[1])
        elif cond.startswith("level>="):
            met = lv >= int(cond.split(">=")[1])
        elif cond.startswith("pets>="):
            met = num_pets >= int(cond.split(">=")[1])
        elif cond.startswith("coins>="):
            met = coins >= int(cond.split(">=")[1])
        elif cond.startswith("skills>="):
            met = num_skills >= int(cond.split(">=")[1])
        if met:
            new_achs.append(a)
            unlocked.append(a["name"])
            player["achievements"] = unlocked
            player["coins"] = player.get("coins", 0) + 20  # Bonus per achievement
    return new_achs

def sell_item(player, item_type, rarity):
    """Sell an item from inventory. Returns (success, msg)."""
    from game_data import SELL_PRICES
    inv = player.get("inventory", [])
    target = None
    for item in inv:
        if item.get("type") == item_type and item.get("rarity") == rarity:
            target = item
            break
    if not target:
        return False, "Item not found in inventory"
    price = SELL_PRICES.get(rarity, 5)
    inv.remove(target)
    player["inventory"] = inv
    player["coins"] = player.get("coins", 0) + price
    return True, f"Sold **{item_type}** ({rarity}) for 🪙{price}"

def grant_mail_reward(player, mail_idx):
    """Grant mail reward to player."""
    mail = player.get("mail", [])
    if mail_idx < 0 or mail_idx >= len(mail):
        return False, "Mail not found"
    entry = mail[mail_idx]
    if entry.get("claimed"):
        return False, "Already claimed"
    reward = entry.get("reward")
    if not isinstance(reward, dict) or not reward.get("type"):
        # Notification-only mail (milestone rewards are granted directly at
        # trigger time, e.g. check_milestones -> grant_package). Nothing to
        # claim — just mark it seen so CLAIM ALL can't crash on it.
        entry["claimed"] = True
        return True, "Claimed!"
    rtype = reward.get("type", "")
    qty = reward.get("qty", 1)

    if "inventory" not in player: player["inventory"] = []
    msg = ""

    if rtype == "pet":
        pet_rarity = reward.get("pet", "common")
        if "pets" not in player: player["pets"] = []
        player["pets"].append(pet_rarity)
        msg = f"Hatched a {pet_rarity.title()} Pet!"
    elif rtype == "Skill Book":
        from game_data import SKILLS
        import random
        avail = [s for s in SKILLS.keys() if s not in player.get("skills", {})]
        if avail:
            for _ in range(qty):
                if not avail: break
                new_s = random.choice(avail)
                player.setdefault("skills", {})[new_s] = SKILLS[new_s]
                avail.remove(new_s)
                msg += f"Learned skill: {new_s}! "
        else:
            player["coins"] += 500 * qty
            msg = f"Already have all skills! Gained {500*qty} coins."
    elif rtype == "XP Scroll":
        player["xp"] += 500 * qty
        msg = f"Gained {500*qty} XP!"
    else:
        # Generic inventory item (weapons, potions, eggs, materials)
        rtype_l = rtype.lower()
        if rtype_l in ("healing potion", "mana potion"):
            item_type, stats = "potion", {"heal": 50}
        elif "egg" in rtype_l:
            item_type, stats = "egg", {}
        elif "weapon" in rtype_l:
            item_type, stats = "weapon", {"attack": 10 if "common" in rtype_l else 50}
        else:
            item_type, stats = "material", {}
        for _ in range(qty):
            player["inventory"].append({"name": rtype, "type": item_type,
                                        "rarity": rtype.split(" ")[0] if item_type == "weapon" else "Common",
                                        "stats": dict(stats)})
        msg = f"Received {qty}x {rtype}!"
        
    entry["claimed"] = True
    return True, f"Claimed! {msg}"

# ── DUNGEON SYSTEM ──
def get_dungeon_enemy(floor):
    """Generate a dungeon enemy for the given floor (1-100)."""
    from game_data import DUNGEON_SCALING, DUNGEON_ENEMIES, DUNGEON_BOSS_FLOORS, DUNGEON_BOSS_MULT
    s = DUNGEON_SCALING
    boss = floor in DUNGEON_BOSS_FLOORS

    hp  = int(s["base_hp"]  + s["hp_per_floor"]  * floor * (random.uniform(0.85, 1.15)))
    atk = int(s["base_atk"] + s["atk_per_floor"] * floor * (random.uniform(0.85, 1.15)))
    dfn = int(s["base_def"] + s["def_per_floor"] * floor * (random.uniform(0.85, 1.15)))
    spd = int(s["base_spd"] + s["spd_per_floor"] * floor * (random.uniform(0.85, 1.15)))
    xp  = int(s["xp_base"]  + s["xp_per_floor"]  * floor)
    coins = int(s["coin_base"] + s["coin_per_floor"] * floor)

    # Pick name from the appropriate tier
    for (lo, hi), names in DUNGEON_ENEMIES.items():
        if lo <= floor <= hi:
            name = random.choice(names)
            break
    else:
        name = "👹 Unknown Horror"

    if boss:
        mult = DUNGEON_BOSS_MULT
        hp    = int(hp * mult["hp"])
        atk   = int(atk * mult["atk"])
        dfn   = int(dfn * mult["def"])
        xp    = int(xp * mult["xp"])
        coins = int(coins * mult["coins"])
        name  = f"👑 {name.replace('🐺','').replace('🟢','').replace('🐗','').replace('🕷️','').replace('🐀','').replace('🦇','').replace('🌿','').replace('👹','').replace('💀','').replace('🔮','').replace('👻','').replace('🐺','').replace('🪦','').replace('⚔️','').replace('🦂','').replace('🔥','').replace('🐉','').replace('👹','').replace('🌀','').replace('💀','').replace('🌑','').replace('🗡️','').replace('🧊','').replace('🦴','').replace('🐲','').replace('👁️','').replace('⚡','').replace('🔥','').replace('🌊','').replace('💀','').replace('🛡️','').replace('🌀','').replace('🌌','').replace('🐉','').replace('👑','').replace('⭐','').replace('🌀','').replace('💀','').replace('🌑','').replace('🔥','').strip()} Lord"

    return {
        "name": name,
        "hp": hp, "max_hp": hp,
        "atk": atk, "def": dfn, "spd": spd,
        "xp": xp, "coins": coins,
        "is_boss": boss,
        "floor": floor,
    }

def run_dungeon_combat(player, floor):
    """Run a turn-based combat for a dungeon floor. Returns (result_dict)."""
    from game_data import DUNGEON_LOOT, DUNGEON_MAX_FLOORS, DUNGEON_BOSS_FLOORS
    enemy = get_dungeon_enemy(floor)

    # Player effective stats
    p_atk = player.get("attack", 10)
    p_def = player.get("defense", 5)
    p_hp  = player.get("health", 100)
    p_max = player.get("max_health", 100)
    for slot in ["equipped_weapon", "equipped_armor", "equipped_helmet", "equipped_shield", "equipped_boots"]:
        eq = player.get(slot)
        if isinstance(eq, dict):
            p_atk += eq.get("stats", {}).get("attack", 0)
            p_def += eq.get("stats", {}).get("defense", 0)

    e_hp   = enemy["hp"]
    e_atk  = enemy["atk"]
    e_def  = enemy["def"]
    e_max  = enemy["max_hp"]

    log    = []
    won    = False
    max_rounds = 100

    log.append(f"⚔️ Floor {floor}: **{enemy['name']}** appears!")

    for rnd in range(1, max_rounds + 1):
        # Player attacks
        p_dmg = max(1, p_atk - e_def // 3 + random.randint(-3, 6))
        e_hp -= p_dmg
        log.append(f"⚔️ You hit **{enemy['name']}** for **{p_dmg}**! ({max(0,e_hp)}/{e_max} ❤️)")

        if e_hp <= 0:
            won = True
            break

        # Enemy attacks
        e_dmg = max(1, e_atk - p_def // 3 + random.randint(-3, 6))
        p_hp -= e_dmg
        log.append(f"💥 {enemy['name']} hits you for **{e_dmg}**! ({max(0,p_hp)}/{p_max} ❤️)")

        if p_hp <= 0:
            won = False
            break

    if won:
        coins_earned = enemy["coins"] + random.randint(0, floor)
        xp_earned    = enemy["xp"]
        player["health"]    = max(1, p_hp)
        player["coins"]     = player.get("coins", 0) + coins_earned
        player["xp"]        = player.get("xp", 0) + xp_earned
        player["dungeon_floor"] = min(floor + 1, DUNGEON_MAX_FLOORS + 1)  # past 100 = completed
        player["highest_dungeon"] = max(player.get("highest_dungeon", 0), floor)

        # Level up check (same formula as tower, capped at 100)
        leveled = level_up(player) > 0

        # Roll loot
        loot_weights = {k: v["weight"] for k, v in DUNGEON_LOOT.items()}
        # Higher floors shift toward better loot
        if floor >= 50:
            loot_weights["gear"] += 10
            loot_weights["pet_egg"] += 5
            loot_weights["skill_book"] += 5
            loot_weights["material"] += 5
            loot_weights["coins_bonus"] -= 10
            loot_weights["heal_pot"] -= 10
        total_w = sum(loot_weights.values())
        roll = random.randint(1, total_w)
        cum = 0
        chosen = "coins_bonus"
        for k, w in loot_weights.items():
            cum += w
            if roll <= cum:
                chosen = k
                break

        loot_msgs = {
            "coins_bonus": f"🪙 Bonus {coins_earned // 2} coins!",
            "xp_scroll": "📜 XP Scroll (stored)",
            "heal_pot": "🧪 Healing Potion",
            "gear": "⚔️ Random gear piece!",
            "pet_egg": "🥚 Pet Egg!",
            "skill_book": "📘 Skill Book!",
            "material": "🪨 Blacksmith material!",
        }
        player.setdefault("inventory", [])
        loot_msg = ""
        if chosen == "coins_bonus":
            bonus = coins_earned // 2
            player["coins"] += bonus
            loot_msg = f"🪙 +{bonus} bonus coins!"
        elif chosen == "heal_pot":
            player["inventory"].append({"name": "Healing Potion", "type": "potion", "rarity": "Common"})
            loot_msg = "🧪 Healing Potion dropped!"
        elif chosen == "material":
            mat = "Undead Bones" if floor < 50 else random.choice(["Undead Bones", "Dragon Scales", "Silk Cloth"])
            qty = random.randint(1, 2) + (1 if floor in DUNGEON_BOSS_FLOORS else 0)
            for _ in range(qty):
                player["inventory"].append({"name": mat, "type": "material", "rarity": "Common",
                                            "icon": "🪨", "id": f"mat_{int(random.random()*1e9)}"})
            loot_msg = f"🪨 {qty}x {mat}!"
        elif chosen == "xp_scroll":
            # XP stored as a mail item or just granted directly
            player["xp"] += 100
            loot_msg = "📜 +100 XP from scroll!"
        elif chosen == "gear":
            from game_data import RARITY_ORDER
            # Dungeon World loot is capped at EPIC — no mythic/legendary/unique
            rarity_roll = random.random()
            if rarity_roll < 0.05: rarity = "epic"
            elif rarity_roll < 0.20: rarity = "rare"
            elif rarity_roll < 0.50: rarity = "uncommon"
            else: rarity = "common"
            atk_bonus = int({"common":3,"uncommon":6,"rare":12,"epic":20}[rarity])
            def_bonus = int(atk_bonus * 0.6)
            player["inventory"].append({"name": f"Dungeon {rarity.title()} Gear", "type": "weapon",
                "rarity": rarity, "stats": {"attack": atk_bonus, "defense": def_bonus}})
            loot_msg = f"⚔️ {rarity.title()} gear dropped! ({atk_bonus} ATK, {def_bonus} DEF)"
        elif chosen == "pet_egg":
            player["inventory"].append({"name": "Mysterious Egg", "type": "pet_egg", "rarity": "rare"})
            loot_msg = "🥚 Mysterious Egg!"
        elif chosen == "skill_book":
            from game_data import SKILLS
            avail = [s for s in SKILLS if s not in player.get("skills", {})]
            if avail:
                new_s = random.choice(avail)
                player.setdefault("skills", {})[new_s] = SKILLS[new_s]
                loot_msg = f"📘 Learned **{new_s}**!"
            else:
                player["coins"] += 300
                loot_msg = "📘 Already know all skills! +300 coins!"
        else:
            loot_msg = ""

        log.append(f"✅ **Victory!** 🪙+{coins_earned} ⭐+{xp_earned} XP " + (f"⬆ **LEVEL UP!** (Lv.{player['level']})" if leveled else ""))
        if loot_msg:
            log.append(f"🎁 {loot_msg}")
        if floor == DUNGEON_MAX_FLOORS:
            log.append("🏆 **DUNGEON COMPLETE!** You conquered all 100 floors!")

        player["monsters_killed"] = player.get("monsters_killed", 0) + 1
        if enemy["is_boss"]:
            player["bosses_killed"] = player.get("bosses_killed", 0) + 1

    else:
        player["health"] = max(0, p_hp)
        _drank, _dmsg = maybe_auto_drink(player)
        player["dungeon_floor"] = max(1, floor - 2)
        log.append(f"💀 **Defeated!** You took fatal damage on Floor {floor}.")
        log.append(f"❤️ {max(0,p_hp)}/{p_max} HP remaining. Rest to recover.")
        if _drank:
            log.append(_dmsg)
        log.append(f"📉 Forced back to Floor {max(1, floor - 2)}.")

    return {
        "won": won, "log": log,
        "coins": enemy["coins"] if won else 0,
        "xp": enemy["xp"] if won else 0,
        "enemy": enemy,
        "player_hp": player["health"],
        "player_max_hp": player.get("max_health", 100),
        "is_boss": enemy["is_boss"],
        "floor": floor,
        "loot_msg": loot_msg if won else "",
    }


# ── UNIVERSAL LOOT ROLLER ────────────────────────────────────────────────────
LOOT_TABLE = [
    (24, "coins"),
    (20, "heal_pot"),
    (18, "xp_scroll"),
    (15, "gear"),
    (3,  "pet_egg"),
    (8,  "material"),
    (7,  "skill_book"),
]

_SOURCE_MATS = {"adventure": "Iron Ore", "dungeon": "Undead Bones", "tower": "Dragon Scales"}

def roll_loot(player, source="adventure", floor=0, is_boss=False):
    """Roll a loot drop and apply it to player in-place.
    Returns human-readable loot_msg (empty string if nothing dropped)."""
    # Adventure map drops EVERY kill — fully random, anything can drop.
    if source != "adventure" and not is_boss and random.random() > 0.40:
        return ""
    table = list(LOOT_TABLE)
    if floor >= 50:
        table = [(w + (5 if t in ("gear","pet_egg","skill_book") else -3), t) for w,t in table]
    if is_boss:
        table = [(w*2 if t in ("gear","pet_egg","skill_book","material") else w, t) for w,t in table]
    total = sum(w for w,_ in table)
    roll  = random.randint(1, max(1, total))
    chosen = table[0][1]; cum = 0
    for w, t in table:
        cum += w
        if roll <= cum:
            chosen = t; break
    player.setdefault("inventory", [])
    if chosen == "coins":
        bonus = random.randint(20,80) * (3 if is_boss else 1)
        player["coins"] = player.get("coins",0) + bonus
        return f"🪙 Loot: +{bonus} bonus coins!"
    elif chosen == "heal_pot":
        player["inventory"].append({"name":"Healing Potion","type":"potion","icon":"🧪","rarity":"Common","id":f"heal_{int(random.random()*1e9)}"})
        return "🧪 Loot: Healing Potion dropped!"
    elif chosen == "material":
        mat = _SOURCE_MATS.get(source, "Iron Ore")
        if is_boss or floor >= 25:
            mat = random.choice([mat, "Silk Cloth"])
        qty = random.randint(1, 2) + (1 if is_boss else 0)
        for _ in range(qty):
            player["inventory"].append({"name": mat, "type": "material", "icon": "🪨",
                                        "rarity": "Common", "id": f"mat_{int(random.random()*1e9)}"})
        return f"🪨 Loot: {qty}x {mat}!"
    elif chosen == "xp_scroll":
        gain = 150 if is_boss else 80
        player["xp"] = player.get("xp",0) + gain
        return f"📜 Loot: +{gain} XP Scroll!"
    elif chosen == "gear":
        rr = random.random()
        # Adventure = wild west: ANY rarity can drop, even mythic/unique
        if source == "adventure":
            rarity = "unique" if rr<0.005 else "mythic" if rr<0.015 else "legendary" if rr<0.05 else "epic" if rr<0.14 else "rare" if rr<0.34 else "uncommon" if rr<0.62 else "common"
        else:
            rarity = "legendary" if rr<0.04 else "epic" if rr<0.13 else "rare" if rr<0.32 else "uncommon" if rr<0.60 else "common"
        base = {"common":3,"uncommon":7,"rare":14,"epic":22,"legendary":40,"mythic":70,"unique":120}[rarity]
        player["inventory"].append({"name":f"{source.title()} {rarity.title()} Gear","type":"weapon","icon":"⚔️","rarity":rarity,"stats":{"attack":base,"defense":int(base*0.6)},"id":f"gear_{int(random.random()*1e9)}"})
        return f"⚔️ Loot: {rarity.title()} Gear! (+{base} ATK)"
    elif chosen == "pet_egg":
        r2 = random.random()
        er = "mythic" if r2<0.02 else "epic" if r2<0.08 else "rare" if r2<0.25 else "uncommon" if r2<0.55 else "common"
        en = {"common":"Slime Egg","uncommon":"Forest Egg","rare":"Dragon Egg","epic":"Void Egg","mythic":"Celestial Egg"}
        player["inventory"].append({"name":en[er],"type":"egg","icon":"🥚","rarity":er.capitalize(),"id":f"egg_{int(random.random()*1e9)}"})
        return f"🥚 Loot: {en[er]}! ({er.title()})"
    elif chosen == "skill_book":
        try:
            from game_data import SKILLS
            avail = [s for s in SKILLS if s not in player.get("skills",{})]
            if avail:
                ns = random.choice(avail)
                player.setdefault("skills",{})[ns] = SKILLS[ns]
                return f"📘 Loot: Learned skill [{ns}]!"
        except Exception:
            pass
        player["coins"] = player.get("coins",0) + 200
        return "📘 Loot: Skill Book (+200 coins)!"
    return ""
