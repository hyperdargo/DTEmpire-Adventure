# ── PET SYSTEM ──
PET_TIERS = {
    "common":    {"name":"Slime","emoji":"🟢","atk_bonus":2,"def_bonus":1,"hp_bonus":5,"drop_rate":0.08},
    "uncommon":  {"name":"Ember Fox","emoji":"🦊","atk_bonus":4,"def_bonus":2,"hp_bonus":10,"drop_rate":0.05},
    "rare":      {"name":"Storm Drake","emoji":"🐉","atk_bonus":7,"def_bonus":4,"hp_bonus":18,"drop_rate":0.03},
    "epic":      {"name":"Shadow Wraith","emoji":"👻","atk_bonus":12,"def_bonus":7,"hp_bonus":30,"drop_rate":0.015},
    "legendary": {"name":"Phoenix","emoji":"🔥","atk_bonus":20,"def_bonus":12,"hp_bonus":50,"drop_rate":0.005},
}
# Pet max level = 20, gains +20% bonus per level
PET_LEVEL_CAP = 20

# Player level cap — removed 2026-08-01: unlimited leveling (auto-grind made 100 too easy).
# Kept as a huge safety bound so `min()` gates still work; effectively uncapped.
MAX_PLAYER_LEVEL = 9999

# Tower spans 100 floors — bosses every 5th floor
TOWER_MAX_FLOORS = 100
BOSS_FLOORS = set(range(5, TOWER_MAX_FLOORS + 1, 5))

def get_required_level(floor):
    """Floor N requires player level 2×N (floor 1→level 2, floor 10→level 20,
    floor 50→level 100 cap). Tower is HARD: 10 floors ≈ 20 levels of grinding.""" 
    return min(floor * 2, 100)

# ── TOWER FLOOR ENEMIES ──
# HARD tower: brutal stat curve, but rewards scale hard too so the climb pays.
TOWER_ENEMY_SCALING = {
    "base_hp": 50, "hp_per_floor": 18,
    "base_atk": 8, "atk_per_floor": 4,
    "base_def": 4, "def_per_floor": 2,
    "base_spd": 5, "spd_per_floor": 1,
    "xp_base": 20, "xp_per_floor": 8,
    "coin_base": 10, "coin_per_floor": 5,
}
BOSS_MULT = {"hp": 2.5, "atk": 1.8, "def": 1.5, "xp": 2.0, "coins": 2.0}
# Loot boost on boss floors: bosses shower gear/eggs/books
def tower_loot_bonus(floor, is_boss):
    """Extra reward multiplier — towers pay better the higher you climb."""
    return (1.0 + floor * 0.01) * (2.0 if is_boss else 1.0)

# ── FLOOR REWARDS (Mail loot table) ──
FLOOR_REWARDS = {
    "skill_book":      {"name":"Skill Book","emoji":"📘","weight":30,"desc":"Learn a random skill"},
    "xp_scroll":       {"name":"XP Scroll","emoji":"📜","weight":20,"desc":"Free XP"},
    "temple_coupon":   {"name":"Temple Coupon","emoji":"🏛️","weight":10,"desc":"Free class upgrade at temple"},
    "pet_egg":         {"name":"Pet Egg","emoji":"🥚","weight":2,"desc":"Chance at a pet"},
    "healing_potion":  {"name":"Healing Potion","emoji":"🧪","weight":40,"desc":"Restore HP"},
    "iron_ore":        {"name":"Iron Ore","emoji":"🪨","weight":14,"desc":"Blacksmith material"},
    "undead_bones":    {"name":"Undead Bones","emoji":"🦴","weight":12,"desc":"Blacksmith material"},
    "dragon_scales":   {"name":"Dragon Scales","emoji":"🐉","weight":8,"desc":"Blacksmith material (boss floors)"},
    "silk_cloth":      {"name":"Silk Cloth","emoji":"🧵","weight":4,"desc":"Blacksmith material (high floors)"},
    
    # Rarity-based gear (1-10 common, 11-25 rare, 26-40 epic, 41-50 legendary)
    "common_weapon":   {"name":"Common Weapon","emoji":"⚔️","weight":15,"desc":"Basic gear"},
    "rare_weapon":     {"name":"Rare Weapon","emoji":"⚔️","weight":8,"desc":"Random rare gear"},
    "epic_weapon":     {"name":"Epic Weapon","emoji":"⚔️","weight":4,"desc":"Random epic gear"},
    "legendary_weapon":{"name":"Legendary Weapon","emoji":"⚔️","weight":1,"desc":"Random legendary gear"},
    
    # Blacksmith materials
    "scales":          {"name":"Dragon Scales","emoji":"🐉","weight":15,"desc":"Crafting material"},
    "bones":           {"name":"Undead Bones","emoji":"💀","weight":15,"desc":"Crafting material"},
    "ores":            {"name":"Iron Ore","emoji":"🪨","weight":20,"desc":"Crafting material"},
    "cloth":           {"name":"Silk Cloth","emoji":"🧵","weight":20,"desc":"Crafting material"},
    "gems":            {"name":"Mystic Gem","emoji":"💎","weight":5,"desc":"Crafting material"},
}

# ── SELL PRICES ──
SELL_PRICES = {
    "common": 50, "uncommon": 150, "rare": 500, "epic": 1500, "legendary": 5000,
    "mythic": 15000, "unique": 50000,
}

# ── PLAYER CLASSES (extended with rarity) ──
# Format: name, emoji, rarity, base_hp, base_atk, base_def, base_spd
CLASS_DATA = [
    # Common
    ("Warrior",   "⚔️", "common",    100, 12, 8,  6),
    ("Mage",      "🔮", "common",    70,  15, 4,  5),
    ("Archer",    "🏹", "common",    75,  13, 5,  8),
    ("Thief",     "🗡️", "common",    80,  11, 5,  10),
    # Uncommon
    ("Knight",    "🛡️", "uncommon",  110, 14, 10, 5),
    ("Sorcerer",  "✨", "uncommon",  75,  18, 5,  6),
    ("Hunter",    "🎯", "uncommon",  85,  15, 6,  9),
    ("Assassin",  "🥷", "uncommon",  80,  16, 5,  11),
    # Rare
    ("Paladin",   "⚔️", "rare",      130, 15, 12, 6),
    ("Warlock",   "🌑", "rare",      85,  22, 6,  7),
    ("Ranger",    "🌲", "rare",      95,  18, 7,  10),
    ("Ninja",     "💨", "rare",      85,  19, 6,  12),
    # Epic
    ("Berserker", "💢", "epic",      140, 24, 8,  7),
    ("Necromancer","💀","epic",      95,  26, 7,  8),
    ("Shadow Blade","🗡️","epic",     100, 25, 8,  13),
    # Legendary
    ("Dragon Knight","🐉","legendary", 160, 28, 15, 10),
    ("Void Mage", "🌌", "legendary", 100, 32, 10, 9),
    ("Phantom Lord","👻","legendary", 110, 30, 12, 14),
    # Unique (one player per class, ever)
    ("Chronomancer","⏳","unique", 180, 35, 16, 13),
    ("Chimera",   "🐲", "unique",   175, 34, 18, 12),
]

CLASSES = {}
for name, emoji, rarity, hp, atk, dfn, spd in CLASS_DATA:
    CLASSES[name] = {
        "name": name, "emoji": emoji, "rarity": rarity,
        "base_hp": hp, "base_atk": atk, "base_def": dfn, "base_spd": spd,
    }

# ── SKILLS ──
SKILLS = {
    "Power Strike":  {"emoji":"⚡","cost":50,  "atk":15,"desc":"+15 ATK"},
    "Iron Wall":     {"emoji":"🛡️","cost":50,  "def":10,"desc":"+10 DEF"},
    "Swift Step":    {"emoji":"💨","cost":50,  "spd":8, "desc":"+8 SPD"},
    "Berserk":       {"emoji":"🔥","cost":120, "atk":30,"def":-5,"desc":"+30 ATK, -5 DEF"},
    "Meditate":      {"emoji":"🧘","cost":80,  "hp":30, "desc":"+30 max HP"},
    "Shadow Strike": {"emoji":"🗡️","cost":150,"atk":25,"spd":15,"desc":"+25 ATK, +15 SPD"},
    "Fortress":      {"emoji":"🏰","cost":150,"def":25,"hp":20,"desc":"+25 DEF, +20 HP"},
    "Flame Burst":   {"emoji":"🔥","cost":200,"atk":40,"desc":"+40 ATK"},
    "Thunderclap":   {"emoji":"🌩️","cost":250,"atk":35,"spd":15,"desc":"+35 ATK, +15 SPD"},
    "Divine Shield": {"emoji":"✨","cost":300,"def":35,"hp":50,"desc":"+35 DEF, +50 HP"},
    "Life Steal":    {"emoji":"💉","cost":200,"atk":20,"hp":25,"desc":"+20 ATK, +25 HP"},
    "Blade Dance":   {"emoji":"💃","cost":300,"atk":30,"spd":25,"desc":"+30 ATK, +25 SPD"},
    "Earthshaker":   {"emoji":"🌍","cost":400,"atk":50,"def":15,"desc":"+50 ATK, +15 DEF"},
    "Mana Surge":    {"emoji":"🌀","cost":400,"atk":45,"spd":20,"desc":"+45 ATK, +20 SPD"},
}

RARITY_ORDER = {"common":0,"uncommon":1,"rare":2,"epic":3,"legendary":4,"mythic":5,"unique":6}
RARITY_COLORS = {"common":"#94a3b8","uncommon":"#22c55e","rare":"#3b82f6","epic":"#a855f7","legendary":"#f59e0b","unique":"#ffd54a"}
RARITY_STARS  = {"common":"★","uncommon":"★★","rare":"★★★","epic":"★★★★","legendary":"★★★★★","unique":"★★★★★★"}

# ── DUNGEON SYSTEM (100 floors) ──
DUNGEON_SCALING = {
    "base_hp": 30, "hp_per_floor": 22,
    "base_atk": 8, "atk_per_floor": 3.5,
    "base_def": 3, "def_per_floor": 2,
    "base_spd": 3, "spd_per_floor": 0.8,
    "xp_base": 8, "xp_per_floor": 4,
    "coin_base": 5, "coin_per_floor": 3,
}
DUNGEON_BOSS_MULT = {"hp": 2.5, "atk": 1.8, "def": 1.5, "xp": 2.0, "coins": 2.5}
DUNGEON_BOSS_FLOORS = {10, 20, 30, 40, 50, 60, 70, 80, 90, 100}
DUNGEON_MAX_FLOORS = 100

# Enemy names per floor range
DUNGEON_ENEMIES = {
    (1, 20):   ["🐺 Goblin", "🟢 Slime", "🐗 Boar", "🕷️ Spider", "🐀 Giant Rat", "🦇 Bat Swarm", "🌿 Thorn Vine", "👹 Imp"],
    (21, 40):  ["💀 Skeleton", "🔮 Dark Elf", "👻 Wraith", "🐺 Werewolf", "🪦 Ghoul", "⚔️ Orc Scout", "🦂 Stinger", "🔥 Fire Elemental"],
    (41, 60):  ["🐉 Drake", "👹 Ogre", "🌀 Phantom", "💀 Lich", "🌑 Shadow Beast", "🗡️ Assassin", "🧊 Ice Golem", "🦴 Bone Dragon"],
    (61, 80):  ["🐲 Wyrm", "👁️ Beholder", "⚡ Storm Titan", "🔥 Archfiend", "🌊 Abyssal Kraken", "💀 Death Knight", "🛡️ Dark Paladin", "🌀 Void Walker"],
    (81, 100): ["🌌 Void Lord", "🐉 Ancient Dragon", "👑 Demon King", "⭐ Celestial Guardian", "🌀 Chaos Beast", "💀 Lich King", "🌑 Shadow Titan", "🔥 Primordial Flame"],
}

# Loot pool by floor range (higher floors = better loot weights shift)
DUNGEON_LOOT = {
    "coins_bonus": {"weight": 30, "emoji": "🪙"},
    "xp_scroll":   {"weight": 25, "emoji": "📜"},
    "heal_pot":    {"weight": 18, "emoji": "🧪"},
    "gear":        {"weight": 10, "emoji": "⚔️"},
    "pet_egg":     {"weight": 2,  "emoji": "🥚"},
    "skill_book":  {"weight": 5,  "emoji": "📘"},
    "material":    {"weight": 12, "emoji": "🪨"},
}

# ── ACHIEVEMENTS ──
ACHIEVEMENTS = [
    {"id":"first_win","name":"First Blood","desc":"Win your first battle","condition":"wins>=1","emoji":"🏆"},
    {"id":"tower_5","name":"Tower Novice","desc":"Reach floor 5","condition":"tower_floor>=5","emoji":"🏰"},
    {"id":"tower_10","name":"Tower Adept","desc":"Reach floor 10","condition":"tower_floor>=10","emoji":"🏰"},
    {"id":"tower_25","name":"Tower Champion","desc":"Reach floor 25","condition":"tower_floor>=25","emoji":"🏰"},
    {"id":"tower_50","name":"Tower Legend","desc":"Reach floor 50","condition":"tower_floor>=50","emoji":"🏰"},
    {"id":"level_5","name":"Seasoned","desc":"Reach level 5","condition":"level>=5","emoji":"⭐"},
    {"id":"level_10","name":"Veteran","desc":"Reach level 10","condition":"level>=10","emoji":"⭐"},
    {"id":"level_25","name":"Master","desc":"Reach level 25","condition":"level>=25","emoji":"⭐"},
    {"id":"pet_1","name":"Pet Owner","desc":"Get your first pet","condition":"pets>=1","emoji":"🐾"},
    {"id":"pet_5","name":"Pet Collector","desc":"Collect 5 pets","condition":"pets>=5","emoji":"🐾"},
    {"id":"coins_1000","name":"Wealthy","desc":"Amass 1000 coins","condition":"coins>=1000","emoji":"🪙"},
    {"id":"coins_10000","name":"Rich","desc":"Amass 10000 coins","condition":"coins>=10000","emoji":"🪙"},
    {"id":"skills_5","name":"Scholar","desc":"Learn 5 skills","condition":"skills>=5","emoji":"📚"},
    {"id":"skills_10","name":"Sage","desc":"Learn 10 skills","condition":"skills>=10","emoji":"📚"},
    {"id":"wins_100","name":"War Machine","desc":"Win 100 battles","condition":"wins>=100","emoji":"⚔️"},
    {"id":"tower_75","name":"Tower Master","desc":"Reach floor 75","condition":"tower_floor>=75","emoji":"🏰"},
    {"id":"tower_100","name":"Tower Conqueror","desc":"Conquer all 100 floors","condition":"tower_floor>=100","emoji":"👑"},
    {"id":"level_50","name":"Grandmaster","desc":"Reach level 50","condition":"level>=50","emoji":"⭐"},
    {"id":"level_75","name":"Elder","desc":"Reach level 75","condition":"level>=75","emoji":"🌟"},
    {"id":"level_100","name":"Ascendant","desc":"Reach the level cap: 100","condition":"level>=100","emoji":"🌠"},
    {"id":"coins_100000","name":"Tycoon","desc":"Amass 100,000 coins","condition":"coins>=100000","emoji":"🤑"},
    {"id":"wins_500","name":"Unstoppable","desc":"Win 500 battles","condition":"wins>=500","emoji":"⚔️"},
]
STORY_CHAPTERS = [
    {
        "chapter": 1,
        "title": "The Awakening",
        "subtitle": "Every legend begins with a single step",
        "floors": "1-5",
        "level_required": 1,
        "text": "You open your eyes at the base of the Great Tower. The air is thick with ancient magic. A mysterious voice echoes in your mind: 'At last, you have arrived. The tower has been waiting for you.'\n\nBefore you stands the Tower of Ascension — a colossal spire that pierces the clouds. Few who enter ever return. But those who do emerge with power beyond imagination.\n\nArmed with nothing but courage, you step through the archway. Your journey begins now.",
        "enemies": "🐺 Goblins · 🟢 Slimes · 🐗 Boars · 🕷️ Cave Spiders",
        "boss": {"name": "Goblin Chieftain", "emoji": "👑", "line": "A grizzled goblin wielding a rusted blade snarls at you."},
        "rewards": {"coins": 50, "xp": 30, "items": [], "skills": [], "item_chance": {"name": "Rusty Blade", "rarity": "common", "chance": 30}},
        "lore": "The tower was built by the Ancients to seal away the Void beneath the world."
    },
    {
        "chapter": 2,
        "title": "Whispers in the Dark",
        "subtitle": "The tower tests your resolve",
        "floors": "6-10",
        "level_required": 3,
        "text": "The torches flicker as you descend deeper. The walls are covered in faded runes that pulse with a faint blue light. You feel something watching you from the shadows.\n\nScattered bones line the corridors — the remains of fallen adventurers. Among their belongings, you find a journal entry:\n\n'Day 34. The shadows move when I'm not looking. I swear I hear whispers in the ancient tongue. The Goblins are the least of our worries. Something darker stirs below.'\n\nA cold breeze brushes past you. The whispers grow louder.",
        "enemies": "🕷️ Giant Spiders · 🦇 Bat Swarms · 🌿 Thorn Vines · 👹 Imps",
        "boss": {"name": "Shadow Wraith", "emoji": "👻", "line": "A translucent figure emerges from the wall, its hollow eyes fixed on you."},
        "rewards": {"coins": 100, "xp": 60, "items": [], "skills": ["Life Steal"], "item_chance": {"name": "Shadow Dagger", "rarity": "uncommon", "chance": 20}},
        "lore": "The runes tell of a great battle — the Ancients imprisoned something that even they feared."
    },
    {
        "chapter": 3,
        "title": "The Goblin Kingdom",
        "subtitle": "A civilization built in darkness",
        "floors": "11-15",
        "level_required": 6,
        "text": "The narrow corridor opens into a massive cavern. Before you lies an entire underground city — crude huts, bonfires, and thousands of goblins going about their dark business.\n\nThis is no mere tribe. This is a kingdom.\n\nA goblin merchant approaches, offering you a crooked grin. 'First time in the Under-City, eh? Watch your purse, adventurer. The rats here walk on two legs.'\n\nHe points toward the far end of the cavern where a crude fortress stands. 'The King sits up there. If you're looking to get to the lower floors, you'll have to get past him.'",
        "enemies": "⚔️ Goblin Warriors · 🏹 Goblin Archers · 🛡️ Goblin Guards · 💀 Undead Slaves",
        "boss": {"name": "King Grok", "emoji": "👑", "line": "The Goblin King sits on a throne of bones, wielding a massive spiked club."},
        "rewards": {"coins": 200, "xp": 100, "items": ["Goblin Steel"], "skills": [], "item_chance": {"name": "King's Crown", "rarity": "rare", "chance": 10}},
        "lore": "The goblins were once servants of the Ancients. When their masters fell, they built their own kingdom in the ruins."
    },
    {
        "chapter": 4,
        "title": "The Crystal Caverns",
        "subtitle": "Beauty hides the deadliest dangers",
        "floors": "16-20",
        "level_required": 10,
        "text": "The rough stone gives way to shimmering crystal formations. The cavern sparkles with an ethereal light — purple, blue, and green crystals jut from every surface, illuminating the path ahead.\n\nBut beauty is a trap in the tower.\n\nThe crystals hum with a strange energy. Some say they're alive. Others say they're the crystallized souls of adventurers who came before.\n\nAs you step forward, a crystal cracks. From within, a creature of pure gemstone claws its way out.",
        "enemies": "💎 Crystal Golems · 🔮 Mana Wisps · 🧊 Ice Shards · ⚡ Crystal Stalkers",
        "boss": {"name": "The Crystal Queen", "emoji": "💠", "line": "A being of pure crystal rises from the cavern floor, her voice like breaking glass."},
        "rewards": {"coins": 350, "xp": 180, "items": ["Crystal Shard"], "skills": ["Mana Surge"], "item_chance": {"name": "Crystal Bow", "rarity": "rare", "chance": 12}},
        "lore": "The crystals are fragments of a celestial meteor that crashed into the tower ages ago, imbued with raw magic."
    },
    {
        "chapter": 5,
        "title": "The Abyssal Descent",
        "subtitle": "Beyond the light, shadows reign",
        "floors": "21-25",
        "level_required": 15,
        "text": "The crystalline beauty fades as you descend into utter darkness. Your torch barely illuminates the path ahead. The air grows cold and heavy.\n\nThis is the Abyss — a vertical chasm that plunges miles into the earth. Narrow bridges connect crumbling platforms. One wrong step and you fall into endless nothing.\n\nThe shadows here are alive. They reach for you, whisper your name, show you visions of your deepest fears.\n\nA voice cuts through the darkness: 'Turn back, mortal. What lies below is not meant for the living.'",
        "enemies": "💀 Skeletons · 👻 Wraiths · 🪦 Ghouls · 🐺 Werewolves",
        "boss": {"name": "The Abyss Watcher", "emoji": "🌀", "line": "A towering figure cloaked in shadows steps from the void, twin blades gleaming."},
        "rewards": {"coins": 500, "xp": 300, "items": ["Abyssal Stone"], "skills": ["Blade Dance"], "item_chance": {"name": "Abyss Keeper's Blade", "rarity": "epic", "chance": 8}},
        "lore": "The Abyss is a wound in reality — a place where the veil between worlds is thinnest."
    },
    {
        "chapter": 6,
        "title": "The Forgotten Library",
        "subtitle": "Knowledge is power. And madness.",
        "floors": "26-30",
        "level_required": 20,
        "text": "The darkness recedes, replaced by a vast library that stretches as far as the eye can see. Bookshelves tower hundreds of feet high, filled with tomes of forgotten knowledge.\n\nThis is the Library of the Ancients — where all the knowledge of the old world was stored.\n\nBut the knowledge here is guarded. Magical constructs patrol the aisles. Trapped books scream when touched. And somewhere in the deepest archive, a being of pure knowledge awaits those brave enough to seek its wisdom.\n\nA floating tome approaches you, its pages flipping open. 'Welcome, seeker. What knowledge do you seek? Power? Truth? Or death?'",
        "enemies": "📖 Animated Tomes · 🤖 Arcane Constructs · 🌀 Mana Elementals · 👁️ Watchers",
        "boss": {"name": "The Archivist", "emoji": "📚", "line": "An ancient being bound in scrolls and leather, its eyes burning with arcane fire."},
        "rewards": {"coins": 700, "xp": 400, "items": ["Ancient Tome"], "skills": ["Thunderclap"], "item_chance": {"name": "Archivist's Staff", "rarity": "epic", "chance": 8}},
        "lore": "The Ancients recorded everything — spells, prophecies, and the true nature of the Void. Some knowledge was meant to stay forgotten."
    },
    {
        "chapter": 7,
        "title": "The Forge of Souls",
        "subtitle": "Where weapons are born and heroes fall",
        "floors": "31-35",
        "level_required": 25,
        "text": "The temperature rises with every step. The air smells of molten metal and burnt magic. You've entered the Forge of Souls — a colossal workshop where the Ancients crafted their most powerful artifacts.\n\nMassive furnaces line the walls, still burning after centuries. Anvils the size of boulders sit abandoned. Weapons of unimaginable power hang on racks, waiting for worthy hands.\n\nBut the forge is not empty. The souls of ancient smiths still haunt this place, bound to their work for eternity. They do not take kindly to thieves.\n\nA deep voice rumbles: 'State your purpose, intruder. Are you here to create... or to steal?'",
        "enemies": "🔥 Fire Elementals · ⛓️ Soulbound Knights · 🛠️ Animated Armors · 🌋 Lava Beasts",
        "boss": {"name": "The Soul Forgemaster", "emoji": "⚒️", "line": "A giant of molten metal and shadow, hammer in hand, stands before the great anvil."},
        "rewards": {"coins": 1000, "xp": 600, "items": ["Soulforge Ingot"], "skills": ["Flame Burst"], "item_chance": {"name": "Soulforged Blade", "rarity": "epic", "chance": 6}},
        "lore": "The Ancients bound souls to their weapons, granting them sentience. Some of those weapons still hunger for battle."
    },
    {
        "chapter": 8,
        "title": "The Garden of Nightmares",
        "subtitle": "Reality bends and breaks",
        "floors": "36-40",
        "level_required": 30,
        "text": "The industrial heat gives way to an impossible sight — a lush garden blooming in the depths of the tower. Bioluminescent flowers sway in an unfelt breeze. Trees with silver leaves tower overhead.\n\nBut something is deeply wrong. The flowers sing in forgotten tongues. The trees have faces in their bark. The paths shift when you're not looking.\n\nThis is the Garden of Nightmares, where the tower's magic manifests your fears and desires into reality.\n\nA figure that looks exactly like you stands across the clearing, wielding a mirror-polished blade. 'To go forward, you must first face yourself.'",
        "enemies": "🌺 Nightmare Blooms · 🌳 Ents · 🦋 Phantom Moths · 🪞 Mirror Images",
        "boss": {"name": "The Nightmare King", "emoji": "🌑", "line": "A shifting mass of shadow and fear takes form, wearing the faces of everyone you've lost."},
        "rewards": {"coins": 1500, "xp": 800, "items": ["Nightmare Essence"], "skills": ["Divine Shield"], "item_chance": {"name": "Dreamweaver's Bow", "rarity": "epic", "chance": 5}},
        "lore": "The garden was created by a lonely Ancient who wished to preserve beauty. But isolation twisted the garden into something sinister."
    },
    {
        "chapter": 9,
        "title": "The Dragon's Lair",
        "subtitle": "Face the fire that forged the world",
        "floors": "41-45",
        "level_required": 35,
        "text": "The garden collapses behind you as you step into a vast volcanic chamber. Rivers of lava flow between stone pathways. The heat is unbearable.\n\nAt the center of the chamber, coiled around a pillar of obsidian, lies a dragon of immense size. Its scales shimmer like molten gold. Its eyes — ancient and knowing — fix upon you.\n\n'Ah,' it rumbles, smoke curling from its nostrils. 'Another one. The tower sends me many. But you... you carry a spark the others lacked. Tell me, little flame, why should I let you pass?'\n\nThe dragon rises, unfurling wings that blot out the lava-light. 'Prove your worth, or be reduced to ash.'",
        "enemies": "🐉 Drakes · 🔥 Lava Wyrms · 🦎 Fire Lizards · 🪨 Obsidian Golems",
        "boss": {"name": "Ignis, the Ancient Wyrm", "emoji": "🐲", "line": "The great dragon Ignis rises, molten gold dripping from its scales. The air itself catches fire."},
        "rewards": {"coins": 2500, "xp": 1200, "items": ["Dragon Scale"], "skills": ["Earthshaker"], "item_chance": {"name": "Scale of Ignis", "rarity": "legendary", "chance": 3}},
        "lore": "Ignis was once the companion of the First Ancient. When the Ancients fell, Ignis chose to guard the tower's deepest secrets."
    },
    {
        "chapter": 10,
        "title": "The Celestial Summit",
        "subtitle": "The final ascent",
        "floors": "46-50",
        "level_required": 40,
        "text": "The volcanic chamber opens into a sight that steals your breath. You are above the clouds. The tower's peak is a platform of white marble, suspended in an endless sky.\n\nStars wheel overhead in patterns that shouldn't exist. Constellations tell stories of battles between gods and monsters. The wind carries the echoes of ancient songs.\n\nAt the center of the platform stands a lone figure — tall, cloaked in starlight, their face obscured by a hood of woven galaxies.\n\n'I've been waiting for you,' the figure says. 'I am the last of the Ancients. And you... you are the first mortal in a thousand years to reach this height.'\n\nThey extend a hand. 'Join me. Or challenge me. Either way, the truth of the tower will be revealed.'",
        "enemies": "⭐ Celestial Guardians · 🌌 Void Walkers · 🌀 Chaos Beasts · ✨ Starlight Sentinels",
        "boss": {"name": "The Last Ancient", "emoji": "👁️", "line": "The hood falls back to reveal a face of pure starlight. 'I am the beginning and the end of this tower.'"},
        "rewards": {"coins": 5000, "xp": 2500, "items": ["Star Fragment", "Ancient Key"], "skills": [], "item_chance": {"name": "Celestial Crest", "rarity": "legendary", "chance": 2}},
        "lore": "The Last Ancient awaits at the summit, guarding the truth of the tower's purpose. Beyond the summit lies the Void Gate."
    },
    {
        "chapter": 11,
        "title": "The Veil of Mists",
        "subtitle": "Where memory fades and fog breathes",
        "floors": "51-55",
        "level_required": 45,
        "text": "Beyond the summit of the tower's first half lies something the stories never mention — a sea of pale mist that swallows the stairs whole. The Celestial Summit is not the end. It was a gateway.\n\nThe mist coils around your legs like living silk. Every step you take is echoed by a second set of footsteps. Whispers carry your own name, your own secrets, your own regrets.\n\nSomewhere ahead, a lighthouse bell tolls. It has not stopped ringing for a thousand years.\n\n'The mist keeps what it takes,' a voice says from everywhere at once. 'Are you sure you want to be kept?'",
        "enemies": "🌫️ Mist Wraiths · 🔔 Bell Sentinels · 🕯️ Lantern Sprites · 🎭 Echoes of the Fallen",
        "boss": {"name": "The Keeper of Mist", "emoji": "🌁", "line": "A hooded figure of condensed fog steps forth, a lantern of blue fire in its hands. 'You should have turned back when the whispers knew your name.'"},
        "rewards": {"coins": 6000, "xp": 3000, "items": ["Veil Essence"], "skills": ["Iron Wall"], "item_chance": {"name": "Mistrend's Lantern", "rarity": "epic", "chance": 7}},
        "lore": "The Veil was conjured by the Ancients to hide the tower's second half from the eyes of gods and mortals alike. Only the worthy forget themselves and find the path."
    },
    {
        "chapter": 12,
        "title": "The Clockwork Sanctum",
        "subtitle": "Time itself ticks to the tower's rhythm",
        "floors": "56-60",
        "level_required": 50,
        "text": "The mist parts onto a cathedral of brass and glass. Gears the size of houses turn in the walls. Pendulums swing in perfect, deafening unison. This is the Clockwork Sanctum — the tower's beating heart.\n\nNothing here is alive in the way you understand. Brass knights patrol the halls with clockwork precision. Glass-pane guardians watch with unfocused eyes. Every mechanism was built for a purpose no one remembers.\n\nAt the center of the sanctum, a colossal clock face counts down — to what, no one knows. The hands move in reverse.\n\nA voice like grinding gears booms out: 'You are early. Or late. For the tower, it is all the same.'",
        "enemies": "🤖 Brass Knights · ⚙️ Gear Golems · 🕰️ Temporal Shades · 🎡 Pendulum Reapers",
        "boss": {"name": "Chronos, the Gearfather", "emoji": "⏳", "line": "The great clock face opens like a mouth. Within, a creature of pure mechanism watches you with a hundred ticking eyes. 'All things come to me — eventually.'"},
        "rewards": {"coins": 7500, "xp": 3600, "items": ["Chrono Cog"], "skills": ["Swift Step"], "item_chance": {"name": "Temporal Blade", "rarity": "epic", "chance": 6}},
        "lore": "The Ancients built the Sanctum to hold back time itself, buying the tower the ages it needed to complete its purpose. The reverse-counting clock marks the tower's true age."
    },
    {
        "chapter": 13,
        "title": "The Sunken Cathedral",
        "subtitle": "Faith drowned, prayers unanswered",
        "floors": "61-65",
        "level_required": 55,
        "text": "The gears wind down into silence. Before you lies a cathedral drowned in an ocean of still, black water. Vaulted ceilings arch overhead, their stained glass windows glowing with images of gods long forgotten.\n\nPews float in the aisles. Hymnals drift like fallen leaves. A choir of drowned voices rises and falls with the ripple of unseen currents — singing a hymn you somehow know.\n\nAt the altar, something kneels. It has been kneeling for a very long time.\n\n'They stopped answering,' the kneeling thing says without turning. 'So I stopped leaving. Pray with me, traveler. Perhaps your voice will reach them.'",
        "enemies": "🌊 Drowned Priests · 🕯️ Candle Ghasts · ⛪ Choir Shades · 🫧 Bubble Wraiths",
        "boss": {"name": "The Drowned Abbot", "emoji": "🕯️", "line": "The kneeling figure rises, revealing a face of endless water. 'The gods did not answer. So I became the answer.'"},
        "rewards": {"coins": 9000, "xp": 4400, "items": ["Abyssal Prayer Beads"], "skills": ["Meditate"], "item_chance": {"name": "Tidecaller's Staff", "rarity": "epic", "chance": 5}},
        "lore": "When the Ancients sealed the tower, the faithful sealed themselves inside with it — certain their gods would return. The waters rose. The gods did not."
    },
    {
        "chapter": 14,
        "title": "The Ashen Plains",
        "subtitle": "A kingdom burned to keep its secret",
        "floors": "66-70",
        "level_required": 60,
        "text": "The cathedral gives way to an endless plain of grey ash. Wind sculpts the ash into shapes — a crown here, a sword there, the suggestion of a city skyline that crumbles the moment you focus.\n\nThis was a kingdom once. A proud one. The kind that built monuments to itself and believed the sky would always be theirs.\n\nNow every step you take raises a plume of what used to be someone's home. Charred banners hang from skeletal towers. A throne sits alone on a hill, still perfectly intact.\n\nA figure in blackened armor stands before the throne, hand resting on a sword embedded in the ash. 'Sit,' it offers. 'Everyone else who ruled here did. It did not end well.'",
        "enemies": "🔥 Cinder Knights · 🏚️ Ash Beasts · 🗡️ Burned Blades · 🪦 Tomb Embers",
        "boss": {"name": "The Last King of Ash", "emoji": "👑", "line": "The armored figure draws the sword. Flames erupt along its edge. 'I burned my kingdom to hide my shame. You will not leave to speak of it.'"},
        "rewards": {"coins": 11000, "xp": 5200, "items": ["Cinder Crown Shard"], "skills": ["Power Strike"], "item_chance": {"name": "Ashen Monarch's Sword", "rarity": "legendary", "chance": 4}},
        "lore": "The kingdom's vault held a fragment of the tower's origin. Rather than let it fall to invaders, the king burned everything — himself included — to keep it from leaving."
    },
    {
        "chapter": 15,
        "title": "The Hall of Mirrors",
        "subtitle": "Every reflection hides a truth",
        "floors": "71-75",
        "level_required": 65,
        "text": "The ash settles. You stand in a corridor of mirrors, stretching infinitely in every direction. Countless versions of you look back — some older, some scarred, some smiling in ways you don't like.\n\nEvery mirror shows a different path you could have walked. The warrior you might have been. The king. The monster.\n\nOne mirror shows you turning back. In it, you live a long, quiet life. The reflection meets your eyes and mouths: 'Run.'\n\nThe mirrors ripple in unison. From each one, a copy of you steps forward — same face, same blade, same purpose. To reach the end of the hall, you must defeat every self you could have become.\n\n'Welcome,' they say together. 'We've been expecting the original.'",
        "enemies": "🪞 Mirror Doppelgangers · 🌀 Shatter Sprites · 👤 Phantom Doubles · 🗡️ Reflected Blades",
        "boss": {"name": "The Mirror King", "emoji": "🪞", "line": "A thousand reflections of you merge into one towering figure of fractured glass. 'I am every choice you never made. And I am done waiting.'"},
        "rewards": {"coins": 13000, "xp": 6000, "items": ["Prism Core"], "skills": ["Shadow Strike"], "item_chance": {"name": "Glass Crown", "rarity": "legendary", "chance": 3}},
        "lore": "The Ancients stored their regrets here. Every reflection is a real person from a discarded timeline, imprisoned by the tower to keep their mistakes from spreading."
    },
    {
        "chapter": 16,
        "title": "The Umbral Court",
        "subtitle": "Judgment awaits the unworthy",
        "floors": "76-80",
        "level_required": 70,
        "text": "The mirrors shatter into motes of light. You stand in a vast courtroom, its ceiling lost in darkness. Rows of shadowed figures fill the benches — jurors who have not moved in millennia.\n\nAt the head of the court, twelve thrones. Eleven are occupied by hooded silhouettes. The twelfth sits empty.\n\nA gavel strikes. The sound cracks through your bones.\n\n'The tower has judged your kind before,' a voice intones. 'It found humanity wanting. It will find you wanting. But the court is merciful — it gives every accused one chance to plead their case.'\n\nThe shadows rise as one. 'Your case will be argued in steel.'",
        "enemies": "⚖️ Shadow Bailiffs · 🧑‍⚖️ Verdict Shades · 🔒 Chain Wraiths · 🛡️ Black Jurors",
        "boss": {"name": "The Judge of Umbral", "emoji": "⚖️", "line": "The eleventh hood falls back, revealing a face of pure darkness with two cold stars for eyes. 'The court finds you... interesting. Let us see if that changes.'"},
        "rewards": {"coins": 15000, "xp": 7000, "items": ["Umbral Seal"], "skills": ["Fortress"], "item_chance": {"name": "Verdict of Night", "rarity": "legendary", "chance": 3}},
        "lore": "The Umbral Court was the Ancients' last check on themselves — a council that could veto any decision, including the one that doomed them."
    },
    {
        "chapter": 17,
        "title": "The Iron Grave",
        "subtitle": "Where armies go to die standing",
        "floors": "81-85",
        "level_required": 75,
        "text": "The courtroom dissolves into a battlefield frozen in time. Thousands of soldiers stand mid-charge, swords raised, mouths open in silent war cries. They have stood this way for centuries — not statues, but preserved corpses, held upright by their rusted armor.\n\nThis is where the tower's first invasion force died. The army that tried to conquer it from within.\n\nEvery soldier faces the same direction — toward a door at the far end of the field, sealed with chains thicker than a man.\n\nSomething moves among the dead. A figure in armor blacker than the rest, walking the ranks, straightening a helmet here, saluting a fallen captain there.\n\nIt turns to you. 'They followed me,' it says. 'They believed in me. I led them here, and the tower killed them all. I am the only one who survived. That is my crime, and my punishment.'",
        "enemies": "🪖 Risen Legionnaires · ⚔️ Sword Captains · 🛡️ Shield Walls · 💀 War Phantoms",
        "boss": {"name": "The Iron General", "emoji": "🪖", "line": "The black-armored figure draws a blade that has not tasted blood in a thousand years. 'My soldiers died following my dream. Die for it too, stranger.'"},
        "rewards": {"coins": 17000, "xp": 8000, "items": ["General's Insignia"], "skills": ["Berserk"], "item_chance": {"name": "Black Banner", "rarity": "legendary", "chance": 2}},
        "lore": "The General's army was the last organized attempt to reach the Void Gate. The tower broke them without a single living defender — it simply refused to let them leave."
    },
    {
        "chapter": 18,
        "title": "The Realm of Echoes",
        "subtitle": "Speak, and the world answers back",
        "floors": "86-90",
        "level_required": 80,
        "text": "The battlefield fades. You stand in a space that is not quite a place — a realm of sound made visible. Every word you've ever spoken hangs in the air as a glowing thread. Every laugh, every whisper, every cry.\n\nYour footsteps ring like bells. Your breath sounds like a storm. The realm remembers everything, and it repeats it all back to you — out of order.\n\nYou hear your own voice as a child. Then your voice from an hour ago. Then a voice you do not recognize at all, speaking words you have never said, in a language you do not know.\n\n'I am the last echo,' the voice says, now coming from everywhere. 'The tower spoke once, and I am what remains. Do you know what the tower said?'",
        "enemies": "🔊 Sonic Wraiths · 🎵 Melody Fiends · 📣 Thunder Shades · 🗣️ Banshee Choir",
        "boss": {"name": "The Last Echo", "emoji": "📢", "line": "A form of pure sound condenses before you, speaking with the voices of everyone who has ever entered the tower. 'The tower said: LET THEM COME. And they did. And they always will.'"},
        "rewards": {"coins": 19000, "xp": 9000, "items": ["Resonance Fragment"], "skills": ["Life Steal"], "item_chance": {"name": "Silent Bell", "rarity": "legendary", "chance": 2}},
        "lore": "The Realm of Echoes is the tower's memory. Every sound ever made within its walls is preserved here — including the last words of the Ancients."
    },
    {
        "chapter": 19,
        "title": "The Primal Rift",
        "subtitle": "The tower's raw, untamed heart",
        "floors": "91-95",
        "level_required": 85,
        "text": "Sound dies. Gravity wavers. You step into a wound in reality itself — the Primal Rift, where the tower's magic is born raw and unshaped. The walls are not walls; they are the suggestion of walls, flickering between stone and starlight.\n\nCreatures here are not creatures — they are ideas that learned to hunt. A fear given claws. A whisper given wings. A nightmare that grew tired of sleeping.\n\nThe air itself fights you. The floor changes its mind. The light is afraid.\n\nAt the rift's core, something ancient drifts — not alive, not dead, not even present. It is the tower's first thought, still thinking, after all these ages.\n\nIt notices you. 'Ah,' it thinks, and the word shakes the rift. 'A question has arrived. I have been waiting to be asked.'",
        "enemies": "🌀 Rift Spawn · 🌌 Thought Eaters · ⚡ Concept Hounds · 🕳️ Void Lurkers",
        "boss": {"name": "The First Thought", "emoji": "🌌", "line": "The drifting presence coalesces into a shape that is simultaneously a giant, a storm, and a doorway. 'Ask your question, mortal. I will answer. I always answer.'"},
        "rewards": {"coins": 21000, "xp": 10000, "items": ["Rift Shard"], "skills": ["Earthshaker"], "item_chance": {"name": "Primordial Edge", "rarity": "legendary", "chance": 2}},
        "lore": "The Rift is the engine of the tower — the raw imagination of the Ancients, still running long after its creators faded. To reach the Void Gate, you must pass through the very thoughts that built it."
    },
    {
        "chapter": 20,
        "title": "The Void Gate",
        "subtitle": "The end of the ascent. The start of everything.",
        "floors": "96-100",
        "level_required": 90,
        "text": "The Rift spits you out onto a platform of black glass floating in nothingness. Above you, below you, around you — the Void. Endless, patient, older than the stars.\n\nAnd there, at the platform's edge, stands the Void Gate: a door that is not a door, a threshold that holds back infinity. Chains of light bind it shut. They have never been tested.\n\nThe Last Ancient stands before it, no longer a distant figure but a solid, waiting presence. 'You made it,' they say, and there is something like pride in their voice. 'Through mist and mechanism, faith and fire. Through your own reflections and the tower's oldest memories. You made it.'\n\nThey turn to face the Gate. 'Behind this door is what the Ancients sealed away — the truth of why the tower was built. It is not a secret for everyone. But it may be a secret for you.'\n\nThey step aside. 'One hundred floors. One final choice. The Gate is open to you, Ascendant. Walk through — or walk away, and live a long, unremarkable life. The tower will remember you either way.'",
        "enemies": "👁️ Gate Guardians · 🌑 Void Titans · ⭐ Fallen Celestials · 🌀 Chaos Primordials",
        "boss": {"name": "The Void Herald", "emoji": "🌑", "line": "From beyond the Gate, a voice that is not a voice speaks. 'The Ancients feared what they made. You are the first who did not. Step forward, mortal. The Void has been expecting you.'"},
        "rewards": {"coins": 25000, "xp": 12000, "items": ["Key of Ascension", "Void Fragment"], "skills": ["Mana Surge"], "item_chance": {"name": "Gatekeeper's Crown", "rarity": "legendary", "chance": 2}},
        "lore": "The Void Gate is not the end of the tower — it is the beginning. The Ancients built the tower to hold the Gate, and the Gate to hold what lies beyond. You are the first to stand before it unbroken."
    },
]
