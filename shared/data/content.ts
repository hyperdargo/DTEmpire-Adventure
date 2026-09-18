// Content carried over from the original DTEmpire Adventure (original/). Generated once by a conversion script; edit freely.
import type { RegionDef, StoryChapterDef, DungeonBand, ItemTemplateSource } from "./types.ts";

export const REGIONS_SOURCE: RegionDef[] = [
  {
    "id": "dark_forest",
    "name": "Dark Forest",
    "icon": "🌲",
    "description": "A dense, mysterious forest where shadows lurk between the trees.",
    "monsters": [
      {
        "id": "wolf",
        "name": "Wolf",
        "icon": "🐺",
        "hp": 30,
        "atk": 8,
        "def": 2
      },
      {
        "id": "giant_spider",
        "name": "Giant Spider",
        "icon": "🕷️",
        "hp": 25,
        "atk": 10,
        "def": 1
      },
      {
        "id": "ghost",
        "name": "Ghost",
        "icon": "👻",
        "hp": 40,
        "atk": 12,
        "def": 3
      },
      {
        "id": "zombie",
        "name": "Zombie",
        "icon": "🧟",
        "hp": 50,
        "atk": 7,
        "def": 5
      },
      {
        "id": "bandit",
        "name": "Bandit",
        "icon": "🗡️",
        "hp": 45,
        "atk": 14,
        "def": 3
      },
      {
        "id": "mushroom_sprite",
        "name": "Mushroom Sprite",
        "icon": "🍄",
        "hp": 35,
        "atk": 11,
        "def": 6
      },
      {
        "id": "vampire_bat",
        "name": "Vampire Bat",
        "icon": "🦇",
        "hp": 40,
        "atk": 16,
        "def": 4
      },
      {
        "id": "thorn_beast",
        "name": "Thorn Beast",
        "icon": "🌿",
        "hp": 55,
        "atk": 13,
        "def": 8
      },
      {
        "id": "shadow_fox",
        "name": "Shadow Fox",
        "icon": "🦊",
        "hp": 50,
        "atk": 18,
        "def": 5
      },
      {
        "id": "dark_sprite",
        "name": "Dark Sprite",
        "icon": "🌑",
        "hp": 45,
        "atk": 15,
        "def": 10
      },
      {
        "id": "firefly_swarm",
        "name": "Firefly Swarm",
        "icon": "🪰",
        "hp": 20,
        "atk": 6,
        "def": 2
      },
      {
        "id": "boggart",
        "name": "Boggart",
        "icon": "👹",
        "hp": 40,
        "atk": 14,
        "def": 5
      }
    ],
    "boss": {
      "id": "treant_guardian",
      "name": "Treant Guardian",
      "icon": "🌳",
      "hp": 150,
      "atk": 20,
      "def": 10
    }
  },
  {
    "id": "enchanted_garden",
    "name": "Enchanted Garden",
    "icon": "🌸",
    "description": "A magical garden where flowers sing and mushrooms dance. Mystical creatures guard ancient secrets.",
    "monsters": [
      {
        "id": "flower_sprite",
        "name": "Flower Sprite",
        "icon": "🌺",
        "hp": 40,
        "atk": 12,
        "def": 5
      },
      {
        "id": "fairy_dragon",
        "name": "Fairy Dragon",
        "icon": "🦋",
        "hp": 55,
        "atk": 15,
        "def": 7
      },
      {
        "id": "autumn_wisp",
        "name": "Autumn Wisp",
        "icon": "🍂",
        "hp": 35,
        "atk": 18,
        "def": 3
      },
      {
        "id": "vine_ent",
        "name": "Vine Ent",
        "icon": "🌿",
        "hp": 70,
        "atk": 10,
        "def": 10
      },
      {
        "id": "crystal_chameleon",
        "name": "Crystal Chameleon",
        "icon": "🦎",
        "hp": 60,
        "atk": 20,
        "def": 8
      },
      {
        "id": "pollen_drifter",
        "name": "Pollen Drifter",
        "icon": "🌺",
        "hp": 45,
        "atk": 16,
        "def": 5
      }
    ],
    "boss": {
      "id": "garden_queen",
      "name": "Garden Queen",
      "icon": "👸",
      "hp": 200,
      "atk": 25,
      "def": 15
    }
  },
  {
    "id": "frozen_mountains",
    "name": "Frozen Mountains",
    "icon": "🏔️",
    "description": "Icy peaks where only the brave dare to tread.",
    "monsters": [
      {
        "id": "ice_elemental",
        "name": "Ice Elemental",
        "icon": "❄️",
        "hp": 60,
        "atk": 18,
        "def": 8
      },
      {
        "id": "polar_bear",
        "name": "Polar Bear",
        "icon": "🐻",
        "hp": 80,
        "atk": 22,
        "def": 6
      },
      {
        "id": "frost_hawk",
        "name": "Frost Hawk",
        "icon": "🦅",
        "hp": 45,
        "atk": 25,
        "def": 4
      },
      {
        "id": "ice_golem",
        "name": "Ice Golem",
        "icon": "🧊",
        "hp": 100,
        "atk": 15,
        "def": 15
      },
      {
        "id": "avalanche_yeti",
        "name": "Avalanche Yeti",
        "icon": "🏔️",
        "hp": 110,
        "atk": 20,
        "def": 12
      },
      {
        "id": "crystal_golem",
        "name": "Crystal Golem",
        "icon": "💎",
        "hp": 90,
        "atk": 16,
        "def": 20
      },
      {
        "id": "blizzard_wolf",
        "name": "Blizzard Wolf",
        "icon": "🐺",
        "hp": 85,
        "atk": 26,
        "def": 8
      },
      {
        "id": "frozen_wraith",
        "name": "Frozen Wraith",
        "icon": "👻",
        "hp": 70,
        "atk": 30,
        "def": 5
      }
    ],
    "boss": {
      "id": "frost_dragon",
      "name": "Frost Dragon",
      "icon": "🐉",
      "hp": 300,
      "atk": 35,
      "def": 20
    }
  },
  {
    "id": "sunken_depths",
    "name": "Sunken Depths",
    "icon": "🌊",
    "description": "An ancient underwater city, swallowed by the sea millennia ago. Bioluminescent creatures light the way.",
    "monsters": [
      {
        "id": "kraken_spawn",
        "name": "Kraken Spawn",
        "icon": "🐙",
        "hp": 75,
        "atk": 22,
        "def": 10
      },
      {
        "id": "siren",
        "name": "Siren",
        "icon": "🧜",
        "hp": 55,
        "atk": 28,
        "def": 6
      },
      {
        "id": "shark_warrior",
        "name": "Shark Warrior",
        "icon": "🦈",
        "hp": 95,
        "atk": 25,
        "def": 14
      },
      {
        "id": "jelly_swarm",
        "name": "Jelly Swarm",
        "icon": "🪼",
        "hp": 65,
        "atk": 20,
        "def": 12
      },
      {
        "id": "abyssal_serpent",
        "name": "Abyssal Serpent",
        "icon": "🐍",
        "hp": 110,
        "atk": 26,
        "def": 16
      },
      {
        "id": "coral_guardian",
        "name": "Coral Guardian",
        "icon": "🪸",
        "hp": 130,
        "atk": 20,
        "def": 22
      }
    ],
    "boss": {
      "id": "leviathan",
      "name": "Leviathan",
      "icon": "🐋",
      "hp": 400,
      "atk": 42,
      "def": 25
    }
  },
  {
    "id": "volcanic_caverns",
    "name": "Volcanic Caverns",
    "icon": "🌋",
    "description": "Rivers of lava and chambers of fire. Only the strong survive.",
    "monsters": [
      {
        "id": "fire_imp",
        "name": "Fire Imp",
        "icon": "🔥",
        "hp": 70,
        "atk": 30,
        "def": 10
      },
      {
        "id": "magma_beast",
        "name": "Magma Beast",
        "icon": "🌋",
        "hp": 120,
        "atk": 28,
        "def": 18
      },
      {
        "id": "lava_skeleton",
        "name": "Lava Skeleton",
        "icon": "💀",
        "hp": 90,
        "atk": 35,
        "def": 12
      },
      {
        "id": "fire_scorpion",
        "name": "Fire Scorpion",
        "icon": "🦂",
        "hp": 85,
        "atk": 32,
        "def": 15
      },
      {
        "id": "magma_titan",
        "name": "Magma Titan",
        "icon": "🗿",
        "hp": 160,
        "atk": 38,
        "def": 22
      },
      {
        "id": "inferno_wraith",
        "name": "Inferno Wraith",
        "icon": "👻",
        "hp": 100,
        "atk": 45,
        "def": 14
      }
    ],
    "boss": {
      "id": "inferno_lord",
      "name": "Inferno Lord",
      "icon": "👹",
      "hp": 500,
      "atk": 50,
      "def": 30
    }
  },
  {
    "id": "celestial_spire",
    "name": "Celestial Spire",
    "icon": "🌅",
    "description": "A floating tower that rises above the clouds, touching the stars themselves. Ancient celestial guardians protect its heights.",
    "monsters": [
      {
        "id": "winged_sentinel",
        "name": "Winged Sentinel",
        "icon": "👼",
        "hp": 110,
        "atk": 38,
        "def": 22
      },
      {
        "id": "solar_wraith",
        "name": "Solar Wraith",
        "icon": "☀️",
        "hp": 130,
        "atk": 42,
        "def": 18
      },
      {
        "id": "lunar_shade",
        "name": "Lunar Shade",
        "icon": "🌙",
        "hp": 100,
        "atk": 48,
        "def": 15
      },
      {
        "id": "star_colossus",
        "name": "Star Colossus",
        "icon": "⭐",
        "hp": 160,
        "atk": 35,
        "def": 28
      }
    ],
    "boss": {
      "id": "astral_titan",
      "name": "Astral Titan",
      "icon": "🌌",
      "hp": 700,
      "atk": 60,
      "def": 40
    }
  },
  {
    "id": "storm_peaks",
    "name": "Storm Peaks",
    "icon": "🌪️",
    "description": "Treacherous mountain peaks battered by eternal storms. Lightning cracks the sky as thunder beasts roam the crags.",
    "monsters": [
      {
        "id": "storm_elemental",
        "name": "Storm Elemental",
        "icon": "⚡",
        "hp": 130,
        "atk": 48,
        "def": 20
      },
      {
        "id": "thunder_roc",
        "name": "Thunder Roc",
        "icon": "🦅",
        "hp": 160,
        "atk": 42,
        "def": 28
      },
      {
        "id": "lightning_sprite",
        "name": "Lightning Sprite",
        "icon": "🌩️",
        "hp": 100,
        "atk": 55,
        "def": 15
      },
      {
        "id": "tempest_hound",
        "name": "Tempest Hound",
        "icon": "⛈️",
        "hp": 140,
        "atk": 45,
        "def": 22
      },
      {
        "id": "cyclone_wraith",
        "name": "Cyclone Wraith",
        "icon": "🌀",
        "hp": 150,
        "atk": 52,
        "def": 24
      },
      {
        "id": "hailstorm_golem",
        "name": "Hailstorm Golem",
        "icon": "🌨️",
        "hp": 175,
        "atk": 40,
        "def": 32
      }
    ],
    "boss": {
      "id": "storm_tyrant",
      "name": "Storm Tyrant",
      "icon": "🌪️",
      "hp": 750,
      "atk": 68,
      "def": 38
    }
  },
  {
    "id": "abandoned_castle",
    "name": "Abandoned Castle",
    "icon": "🏰",
    "description": "A once-great castle now ruled by dark forces.",
    "monsters": [
      {
        "id": "dark_knight",
        "name": "Dark Knight",
        "icon": "⚔️",
        "hp": 150,
        "atk": 40,
        "def": 25
      },
      {
        "id": "dark_mage",
        "name": "Dark Mage",
        "icon": "🧙",
        "hp": 100,
        "atk": 50,
        "def": 15
      },
      {
        "id": "vampire",
        "name": "Vampire",
        "icon": "🦇",
        "hp": 130,
        "atk": 45,
        "def": 20
      },
      {
        "id": "death_knight",
        "name": "Death Knight",
        "icon": "💀",
        "hp": 180,
        "atk": 38,
        "def": 30
      }
    ],
    "boss": {
      "id": "shadow_king",
      "name": "Shadow King",
      "icon": "👑",
      "hp": 800,
      "atk": 65,
      "def": 40
    }
  },
  {
    "id": "twilight_marsh",
    "name": "Twilight Marsh",
    "icon": "🌫️",
    "description": "A haunted swamp shrouded in perpetual twilight. Will-o'-wisps lure travelers astray while ancient horrors lurk beneath the murky water.",
    "monsters": [
      {
        "id": "bog_zombie",
        "name": "Bog Zombie",
        "icon": "💀",
        "hp": 160,
        "atk": 42,
        "def": 28
      },
      {
        "id": "swamp_crocodile",
        "name": "Swamp Crocodile",
        "icon": "🐊",
        "hp": 200,
        "atk": 48,
        "def": 35
      },
      {
        "id": "will_o_wisp",
        "name": "Will-o'-Wisp",
        "icon": "👻",
        "hp": 120,
        "atk": 58,
        "def": 18
      },
      {
        "id": "swamp_lurker",
        "name": "Swamp Lurker",
        "icon": "🧟",
        "hp": 180,
        "atk": 50,
        "def": 30
      },
      {
        "id": "shadow_newt",
        "name": "Shadow Newt",
        "icon": "🦎",
        "hp": 150,
        "atk": 55,
        "def": 25
      },
      {
        "id": "bog_wraith",
        "name": "Bog Wraith",
        "icon": "🫧",
        "hp": 170,
        "atk": 48,
        "def": 32
      }
    ],
    "boss": {
      "id": "marsh_hydra",
      "name": "Marsh Hydra",
      "icon": "🐉",
      "hp": 900,
      "atk": 72,
      "def": 45
    }
  },
  {
    "id": "cursed_catacombs",
    "name": "Cursed Catacombs",
    "icon": "💀",
    "description": "Ancient underground tombs filled with undead horrors. The air is thick with dark magic and the whispers of the damned.",
    "monsters": [
      {
        "id": "skeleton_warrior",
        "name": "Skeleton Warrior",
        "icon": "💀",
        "hp": 140,
        "atk": 45,
        "def": 30
      },
      {
        "id": "wraith",
        "name": "Wraith",
        "icon": "👻",
        "hp": 110,
        "atk": 52,
        "def": 20
      },
      {
        "id": "bone_colossus",
        "name": "Bone Colossus",
        "icon": "🦴",
        "hp": 200,
        "atk": 40,
        "def": 38
      },
      {
        "id": "blood_revenant",
        "name": "Blood Revenant",
        "icon": "🩸",
        "hp": 160,
        "atk": 55,
        "def": 28
      }
    ],
    "boss": {
      "id": "lich_king",
      "name": "Lich King",
      "icon": "☠️",
      "hp": 1000,
      "atk": 75,
      "def": 50
    }
  },
  {
    "id": "crystal_caverns",
    "name": "Crystal Caverns",
    "icon": "💎",
    "description": "A dazzling underground labyrinth of crystalline formations. Ancient geomantic energy pulses through every facet, and crystalline guardians protect the deepest chambers.",
    "monsters": [
      {
        "id": "crystal_spider",
        "name": "Crystal Spider",
        "icon": "💠",
        "hp": 170,
        "atk": 50,
        "def": 35
      },
      {
        "id": "prismatic_golem",
        "name": "Prismatic Golem",
        "icon": "🔮",
        "hp": 250,
        "atk": 42,
        "def": 48
      },
      {
        "id": "shimmer_wisp",
        "name": "Shimmer Wisp",
        "icon": "✨",
        "hp": 130,
        "atk": 62,
        "def": 22
      },
      {
        "id": "gemstone_colossus",
        "name": "Gemstone Colossus",
        "icon": "🪨",
        "hp": 320,
        "atk": 38,
        "def": 55
      },
      {
        "id": "diamond_wraith",
        "name": "Diamond Wraith",
        "icon": "💎",
        "hp": 290,
        "atk": 58,
        "def": 40
      },
      {
        "id": "obsidian_guardian",
        "name": "Obsidian Guardian",
        "icon": "🗿",
        "hp": 380,
        "atk": 45,
        "def": 60
      }
    ],
    "boss": {
      "id": "crystal_emperor",
      "name": "Crystal Emperor",
      "icon": "👑",
      "hp": 1200,
      "atk": 85,
      "def": 65
    }
  },
  {
    "id": "shadowfall_depths",
    "name": "Shadowfall Depths",
    "icon": "🌋",
    "description": "A chaotic underground rift where shadows cascade in every direction. The boundary between worlds grows thin here, and creatures from the in-between stalk the ever-shifting darkness.",
    "monsters": [
      {
        "id": "shadow_stalker",
        "name": "Shadow Stalker",
        "icon": "🌑",
        "hp": 280,
        "atk": 72,
        "def": 45
      },
      {
        "id": "void_gazer",
        "name": "Void Gazer",
        "icon": "👁️",
        "hp": 240,
        "atk": 80,
        "def": 35
      },
      {
        "id": "dread_bat",
        "name": "Dread Bat",
        "icon": "🦇",
        "hp": 200,
        "atk": 85,
        "def": 25
      },
      {
        "id": "rift_weaver",
        "name": "Rift Weaver",
        "icon": "🕸️",
        "hp": 320,
        "atk": 65,
        "def": 55
      }
    ],
    "boss": {
      "id": "shadowlord",
      "name": "Shadowlord",
      "icon": "🌑",
      "hp": 1400,
      "atk": 95,
      "def": 65
    }
  },
  {
    "id": "the_void",
    "name": "The Void",
    "icon": "🌌",
    "description": "The final frontier. Reality bends here. Only legends dare enter.",
    "monsters": [
      {
        "id": "void_watcher",
        "name": "Void Watcher",
        "icon": "👁️",
        "hp": 200,
        "atk": 55,
        "def": 35
      },
      {
        "id": "chaos_entity",
        "name": "Chaos Entity",
        "icon": "🌀",
        "hp": 250,
        "atk": 60,
        "def": 30
      },
      {
        "id": "reaper",
        "name": "Reaper",
        "icon": "💀",
        "hp": 180,
        "atk": 70,
        "def": 25
      },
      {
        "id": "void_dragon",
        "name": "Void Dragon",
        "icon": "🐲",
        "hp": 350,
        "atk": 50,
        "def": 45
      },
      {
        "id": "abyssal_horror",
        "name": "Abyssal Horror",
        "icon": "🕳️",
        "hp": 280,
        "atk": 65,
        "def": 40
      },
      {
        "id": "all_seeing_eye",
        "name": "All-Seeing Eye",
        "icon": "👁️",
        "hp": 220,
        "atk": 75,
        "def": 35
      },
      {
        "id": "void_leviathan",
        "name": "Void Leviathan",
        "icon": "🌀",
        "hp": 400,
        "atk": 68,
        "def": 50
      },
      {
        "id": "soul_devourer",
        "name": "Soul Devourer",
        "icon": "💀",
        "hp": 300,
        "atk": 80,
        "def": 38
      }
    ],
    "boss": {
      "id": "the_void_emperor",
      "name": "The Void Emperor",
      "icon": "🌑",
      "hp": 1500,
      "atk": 90,
      "def": 60
    }
  },
  {
    "id": "abyssal_rift",
    "name": "Abyssal Rift",
    "icon": "🔥",
    "description": "A scorching dimension between worlds where the boundaries of reality melt away. Demons and abyssal creatures pour through the rift, threatening to consume everything.",
    "monsters": [
      {
        "id": "abyssal_imp",
        "name": "Abyssal Imp",
        "icon": "👿",
        "hp": 220,
        "atk": 65,
        "def": 35
      },
      {
        "id": "hellfire_hound",
        "name": "Hellfire Hound",
        "icon": "🔥",
        "hp": 260,
        "atk": 58,
        "def": 42
      },
      {
        "id": "doom_knight",
        "name": "Doom Knight",
        "icon": "💀",
        "hp": 320,
        "atk": 55,
        "def": 50
      },
      {
        "id": "magma_fiend",
        "name": "Magma Fiend",
        "icon": "🌋",
        "hp": 280,
        "atk": 70,
        "def": 38
      },
      {
        "id": "rift_stalker",
        "name": "Rift Stalker",
        "icon": "👁️",
        "hp": 240,
        "atk": 75,
        "def": 30
      },
      {
        "id": "abyssal_drake",
        "name": "Abyssal Drake",
        "icon": "🐲",
        "hp": 380,
        "atk": 60,
        "def": 55
      }
    ],
    "boss": {
      "id": "abyssal_overlord",
      "name": "Abyssal Overlord",
      "icon": "👹",
      "hp": 1800,
      "atk": 100,
      "def": 70
    }
  },
  {
    "id": "molten_core",
    "name": "Molten Core",
    "icon": "🌋",
    "description": "The heart of the world, where magma flows like rivers and ancient fire titans forge legendary weapons in the flames of creation. Only the strongest adventurers survive.",
    "monsters": [
      {
        "id": "magma_titan",
        "name": "Magma Titan",
        "icon": "🔥",
        "hp": 400,
        "atk": 85,
        "def": 50
      },
      {
        "id": "lava_serpent",
        "name": "Lava Serpent",
        "icon": "🌋",
        "hp": 350,
        "atk": 95,
        "def": 40
      },
      {
        "id": "fire_giant",
        "name": "Fire Giant",
        "icon": "👹",
        "hp": 500,
        "atk": 75,
        "def": 60
      },
      {
        "id": "inferno_scorpion",
        "name": "Inferno Scorpion",
        "icon": "🦂",
        "hp": 300,
        "atk": 100,
        "def": 35
      }
    ],
    "boss": {
      "id": "ignis_the_eternal_flame",
      "name": "Ignis, The Eternal Flame",
      "icon": "🌋",
      "hp": 2500,
      "atk": 120,
      "def": 80
    }
  },
  {
    "id": "moonlit_sanctum",
    "name": "Moonlit Sanctum",
    "icon": "🌙",
    "description": "A celestial temple bathed in eternal moonlight, hidden beyond the veil of night. Lunar guardians protect ancient secrets under the watchful gaze of the moon goddess.",
    "monsters": [
      {
        "id": "lunar_sentinel",
        "name": "Lunar Sentinel",
        "icon": "🌙",
        "hp": 450,
        "atk": 105,
        "def": 60
      },
      {
        "id": "moonbeam_wisp",
        "name": "Moonbeam Wisp",
        "icon": "⭐",
        "hp": 380,
        "atk": 115,
        "def": 45
      },
      {
        "id": "nightmare_bat",
        "name": "Nightmare Bat",
        "icon": "🦇",
        "hp": 420,
        "atk": 110,
        "def": 55
      },
      {
        "id": "eclipse_shade",
        "name": "Eclipse Shade",
        "icon": "🌑",
        "hp": 500,
        "atk": 100,
        "def": 70
      }
    ],
    "boss": {
      "id": "selene_moon_goddess",
      "name": "Selene, Moon Goddess",
      "icon": "🌕",
      "hp": 3000,
      "atk": 130,
      "def": 85
    }
  },
  {
    "id": "overgrown_ruins",
    "name": "Overgrown Ruins",
    "icon": "🌿",
    "description": "Ancient ruins reclaimed by nature, where massive roots twist through crumbling stone and primal forest spirits guard forgotten treasures.",
    "monsters": [
      {
        "id": "root_terror",
        "name": "Root Terror",
        "icon": "🌿",
        "hp": 480,
        "atk": 110,
        "def": 65
      },
      {
        "id": "stone_guardian",
        "name": "Stone Guardian",
        "icon": "🪨",
        "hp": 600,
        "atk": 95,
        "def": 80
      },
      {
        "id": "blight_bloom",
        "name": "Blight Bloom",
        "icon": "🌸",
        "hp": 420,
        "atk": 120,
        "def": 50
      },
      {
        "id": "thornback_drake",
        "name": "Thornback Drake",
        "icon": "🦎",
        "hp": 550,
        "atk": 115,
        "def": 70
      }
    ],
    "boss": {
      "id": "gaia_primal_colossus",
      "name": "Gaia, Primal Colossus",
      "icon": "🌳",
      "hp": 3500,
      "atk": 140,
      "def": 90
    }
  },
  {
    "id": "sunscorched_wastes",
    "name": "Sunscorched Wastes",
    "icon": "🏜️",
    "description": "An endless desert where the sun beats down mercilessly and mirages dance on the scorching sand. Ancient ruins buried beneath the dunes hold treasures and terrors alike.",
    "monsters": [
      {
        "id": "sand_scorpion",
        "name": "Sand Scorpion",
        "icon": "🦂",
        "hp": 620,
        "atk": 125,
        "def": 75
      },
      {
        "id": "dust_devil_serpent",
        "name": "Dust Devil Serpent",
        "icon": "🌊",
        "hp": 580,
        "atk": 135,
        "def": 65
      },
      {
        "id": "scorpion_king",
        "name": "Scorpion King",
        "icon": "🦂",
        "hp": 700,
        "atk": 120,
        "def": 85
      },
      {
        "id": "mirage_wraith",
        "name": "Mirage Wraith",
        "icon": "👻",
        "hp": 550,
        "atk": 140,
        "def": 60
      }
    ],
    "boss": {
      "id": "solarius_the_undying_sun",
      "name": "Solarius, The Undying Sun",
      "icon": "🌞",
      "hp": 4000,
      "atk": 155,
      "def": 100
    }
  },
  {
    "id": "glacial_citadel",
    "name": "Glacial Citadel",
    "icon": "🏔️",
    "description": "An ancient fortress of ice and stone, buried deep within a mountain of eternal frost. The halls echo with the footsteps of forgotten warriors, and the throne room is guarded by the coldest heart in the realm.",
    "monsters": [
      {
        "id": "frost_lich",
        "name": "Frost Lich",
        "icon": "🧊",
        "hp": 850,
        "atk": 150,
        "def": 95
      },
      {
        "id": "dire_frost_wolf",
        "name": "Dire Frost Wolf",
        "icon": "🐺",
        "hp": 720,
        "atk": 165,
        "def": 80
      },
      {
        "id": "glacier_golem",
        "name": "Glacier Golem",
        "icon": "🗿",
        "hp": 1000,
        "atk": 130,
        "def": 120
      },
      {
        "id": "blizzard_phoenix",
        "name": "Blizzard Phoenix",
        "icon": "🦅",
        "hp": 680,
        "atk": 175,
        "def": 70
      }
    ],
    "boss": {
      "id": "aurora_the_eternal_winter",
      "name": "Aurora, The Eternal Winter",
      "icon": "❄️",
      "hp": 5000,
      "atk": 180,
      "def": 130
    }
  },
  {
    "id": "abyssal_trench",
    "name": "Abyssal Trench",
    "icon": "🌊",
    "description": "The deepest point of the ocean, where sunlight never reaches and the weight of the sea itself can crush entire civilizations. Here dwells the most ancient entity the world has ever known.",
    "monsters": [
      {
        "id": "abyssal_squidhound",
        "name": "Abyssal Squidhound",
        "icon": "🐙",
        "hp": 900,
        "atk": 180,
        "def": 90
      },
      {
        "id": "deep_sea_wraith",
        "name": "Deep Sea Wraith",
        "icon": "⛆",
        "hp": 1100,
        "atk": 175,
        "def": 110
      },
      {
        "id": "predator_croc_requiem",
        "name": "Predator Croc Requiem",
        "icon": "🦞",
        "hp": 1300,
        "atk": 170,
        "def": 130
      },
      {
        "id": "trench_digger_amalgam",
        "name": "Trench Digger Amalgam",
        "icon": "🕷️",
        "hp": 1000,
        "atk": 190,
        "def": 85
      },
      {
        "id": "void_anglerfish",
        "name": "Void Anglerfish",
        "icon": "🫧",
        "hp": 950,
        "atk": 195,
        "def": 100
      },
      {
        "id": "megalodon_breacher",
        "name": "Megalodon Breacher",
        "icon": "🦈",
        "hp": 1200,
        "atk": 210,
        "def": 120
      }
    ],
    "boss": {
      "id": "the_scarred_one",
      "name": "The Scarred One",
      "icon": "🐙",
      "hp": 6000,
      "atk": 200,
      "def": 160
    }
  },
  {
    "id": "astral_depths",
    "name": "Astral Depths",
    "icon": "🌌",
    "description": "Beyond the fabric of reality lies the Astral Depths — an infinite expanse of cosmic energy where stars are born and die in seconds.",
    "monsters": [
      {
        "id": "astral_phantom",
        "name": "Astral Phantom",
        "icon": "🌀",
        "hp": 1200,
        "atk": 210,
        "def": 140
      },
      {
        "id": "stellar_construct",
        "name": "Stellar Construct",
        "icon": "⭐",
        "hp": 1500,
        "atk": 195,
        "def": 180
      },
      {
        "id": "void_wyrm",
        "name": "Void Wyrm",
        "icon": "🌑",
        "hp": 1800,
        "atk": 225,
        "def": 160
      },
      {
        "id": "cosmic_horror",
        "name": "Cosmic Horror",
        "icon": "💫",
        "hp": 1400,
        "atk": 250,
        "def": 120
      }
    ],
    "boss": {
      "id": "infinity_the_primordial",
      "name": "Infinity, The Primordial",
      "icon": "♾️",
      "hp": 8000,
      "atk": 280,
      "def": 200
    }
  },
  {
    "id": "celestial_abyss",
    "name": "Celestial Abyss",
    "icon": "🌌",
    "description": "A rift between galaxies where raw cosmic creation energy swirls into being. Stars sing in frequencies that shatter mortal minds, and the architects of reality itself dwell here as silent overseers.",
    "monsters": [
      {
        "id": "astral_leviathan",
        "name": "Astral Leviathan",
        "icon": "🌌",
        "hp": 2000,
        "atk": 310,
        "def": 220
      },
      {
        "id": "stellar_devourer",
        "name": "Stellar Devourer",
        "icon": "⭐",
        "hp": 2400,
        "atk": 290,
        "def": 260
      },
      {
        "id": "dimensional_riftbeast",
        "name": "Dimensional Riftbeast",
        "icon": "🌀",
        "hp": 1800,
        "atk": 340,
        "def": 190
      },
      {
        "id": "constellation_wraith",
        "name": "Constellation Wraith",
        "icon": "✨",
        "hp": 2200,
        "atk": 320,
        "def": 240
      },
      {
        "id": "singularity_worm",
        "name": "Singularity Worm",
        "icon": "🕳️",
        "hp": 2600,
        "atk": 360,
        "def": 210
      },
      {
        "id": "cosmic_remnant",
        "name": "Cosmic Remnant",
        "icon": "🌠",
        "hp": 2100,
        "atk": 380,
        "def": 170
      }
    ],
    "boss": {
      "id": "aethera_the_cosmic_architect",
      "name": "Aethera, The Cosmic Architect",
      "icon": "🌌",
      "hp": 10000,
      "atk": 380,
      "def": 280
    }
  },
  {
    "id": "chrono_sanctum",
    "name": "Chrono Sanctum",
    "icon": "⏳",
    "description": "A realm where time fractures and folds upon itself. Past, present, and future collide in an endless loop, guarded by temporal wardens who have seen the birth and death of a thousand timelines.",
    "monsters": [
      {
        "id": "temporal_shade",
        "name": "Temporal Shade",
        "icon": "⏳",
        "hp": 3000,
        "atk": 380,
        "def": 300
      },
      {
        "id": "chrono_guardian",
        "name": "Chrono Guardian",
        "icon": "🕰️",
        "hp": 3500,
        "atk": 350,
        "def": 350
      },
      {
        "id": "time_weaver",
        "name": "Time Weaver",
        "icon": "🔮",
        "hp": 2800,
        "atk": 420,
        "def": 280
      },
      {
        "id": "paradox_warden",
        "name": "Paradox Warden",
        "icon": "🌀",
        "hp": 4000,
        "atk": 360,
        "def": 380
      }
    ],
    "boss": {
      "id": "chronos_the_time_lord",
      "name": "Chronos, The Time Lord",
      "icon": "♾️",
      "hp": 15000,
      "atk": 450,
      "def": 360
    }
  },
  {
    "id": "nebula_nexus",
    "name": "Nebula Nexus",
    "icon": "🌌",
    "description": "A convergence point of interstellar gases and energies, where new stars are born and ancient ones die in spectacular explosions.",
    "monsters": [
      {
        "id": "stellar_nursery",
        "name": "Stellar Nursery",
        "icon": "🌟",
        "hp": 2200,
        "atk": 320,
        "def": 220
      },
      {
        "id": "nova_burst",
        "name": "Nova Burst",
        "icon": "💫",
        "hp": 2000,
        "atk": 350,
        "def": 200
      },
      {
        "id": "comet_traveller",
        "name": "Comet Traveller",
        "icon": "🌠",
        "hp": 2400,
        "atk": 300,
        "def": 240
      },
      {
        "id": "astral_miner",
        "name": "Astral Miner",
        "icon": "🪐",
        "hp": 2600,
        "atk": 280,
        "def": 260
      },
      {
        "id": "pulsar_beast",
        "name": "Pulsar Beast",
        "icon": "💫",
        "hp": 2800,
        "atk": 360,
        "def": 280
      },
      {
        "id": "meteor_wyrm",
        "name": "Meteor Wyrm",
        "icon": "☄️",
        "hp": 2600,
        "atk": 380,
        "def": 260
      }
    ],
    "boss": {
      "id": "nebulon_the_star_forger",
      "name": "Nebulon, The Star Forger",
      "icon": "🌠",
      "hp": 12000,
      "atk": 420,
      "def": 320
    }
  },
  {
    "id": "void_nexus",
    "name": "Void Nexus",
    "icon": "🌑",
    "description": "A swirling vortex of nothingness where reality unravels. The fabric of existence frays at the edges, and entities from beyond the known universe stir in the darkness, waiting for the veil to tear completely.",
    "monsters": [
      {
        "id": "void_walker",
        "name": "Void Walker",
        "icon": "🌑",
        "hp": 4500,
        "atk": 420,
        "def": 380
      },
      {
        "id": "null_entity",
        "name": "Null Entity",
        "icon": "⚫",
        "hp": 5000,
        "atk": 390,
        "def": 420
      },
      {
        "id": "entropy_beast",
        "name": "Entropy Beast",
        "icon": "🌀",
        "hp": 4200,
        "atk": 460,
        "def": 350
      },
      {
        "id": "chaos_harbinger",
        "name": "Chaos Harbinger",
        "icon": "🌪️",
        "hp": 4800,
        "atk": 440,
        "def": 390
      }
    ],
    "boss": {
      "id": "the_void_sovereign",
      "name": "The Void Sovereign",
      "icon": "👑",
      "hp": 18000,
      "atk": 500,
      "def": 420
    }
  },
  {
    "id": "primordial_peak",
    "name": "Primordial Peak",
    "icon": "⚡",
    "description": "The highest summit of creation, where the raw energy of the universe's birth still crackles through ancient stone. Primordial elementals and the architects of reality's foundation guard secrets older than time itself.",
    "monsters": [
      {
        "id": "primordial_spark",
        "name": "Primordial Spark",
        "icon": "⚡",
        "hp": 5500,
        "atk": 520,
        "def": 450
      },
      {
        "id": "magma_titan",
        "name": "Magma Titan",
        "icon": "🌋",
        "hp": 6000,
        "atk": 480,
        "def": 520
      },
      {
        "id": "storm_avatar",
        "name": "Storm Avatar",
        "icon": "🌪️",
        "hp": 5200,
        "atk": 560,
        "def": 420
      },
      {
        "id": "cosmic_warden",
        "name": "Cosmic Warden",
        "icon": "✨",
        "hp": 5800,
        "atk": 540,
        "def": 480
      }
    ],
    "boss": {
      "id": "primordius_the_first_born",
      "name": "Primordius, The First Born",
      "icon": "⚡",
      "hp": 22000,
      "atk": 600,
      "def": 500
    }
  }
];
export const STORY_CHAPTERS: StoryChapterDef[] = [
  {
    "chapter": 1,
    "title": "The Awakening",
    "subtitle": "Every legend begins with a single step",
    "text": "You open your eyes at the base of the Great Tower. The air is thick with ancient magic. A mysterious voice echoes in your mind: 'At last, you have arrived. The tower has been waiting for you.'\n\nBefore you stands the Tower of Ascension — a colossal spire that pierces the clouds. Few who enter ever return. But those who do emerge with power beyond imagination.\n\nArmed with nothing but courage, you step through the archway. Your journey begins now.",
    "enemies": "🐺 Goblins · 🟢 Slimes · 🐗 Boars · 🕷️ Cave Spiders",
    "boss": {
      "name": "Goblin Chieftain",
      "emoji": "👑",
      "line": "A grizzled goblin wielding a rusted blade snarls at you."
    },
    "lore": "The tower was built by the Ancients to seal away the Void beneath the world.",
    "skills": [],
    "relic": {
      "name": "Rusty Blade",
      "rarity": "common",
      "chance": 30
    }
  },
  {
    "chapter": 2,
    "title": "Whispers in the Dark",
    "subtitle": "The tower tests your resolve",
    "text": "The torches flicker as you descend deeper. The walls are covered in faded runes that pulse with a faint blue light. You feel something watching you from the shadows.\n\nScattered bones line the corridors — the remains of fallen adventurers. Among their belongings, you find a journal entry:\n\n'Day 34. The shadows move when I'm not looking. I swear I hear whispers in the ancient tongue. The Goblins are the least of our worries. Something darker stirs below.'\n\nA cold breeze brushes past you. The whispers grow louder.",
    "enemies": "🕷️ Giant Spiders · 🦇 Bat Swarms · 🌿 Thorn Vines · 👹 Imps",
    "boss": {
      "name": "Shadow Wraith",
      "emoji": "👻",
      "line": "A translucent figure emerges from the wall, its hollow eyes fixed on you."
    },
    "lore": "The runes tell of a great battle — the Ancients imprisoned something that even they feared.",
    "skills": [
      "Life Steal"
    ],
    "relic": {
      "name": "Shadow Dagger",
      "rarity": "uncommon",
      "chance": 20
    }
  },
  {
    "chapter": 3,
    "title": "The Goblin Kingdom",
    "subtitle": "A civilization built in darkness",
    "text": "The narrow corridor opens into a massive cavern. Before you lies an entire underground city — crude huts, bonfires, and thousands of goblins going about their dark business.\n\nThis is no mere tribe. This is a kingdom.\n\nA goblin merchant approaches, offering you a crooked grin. 'First time in the Under-City, eh? Watch your purse, adventurer. The rats here walk on two legs.'\n\nHe points toward the far end of the cavern where a crude fortress stands. 'The King sits up there. If you're looking to get to the lower floors, you'll have to get past him.'",
    "enemies": "⚔️ Goblin Warriors · 🏹 Goblin Archers · 🛡️ Goblin Guards · 💀 Undead Slaves",
    "boss": {
      "name": "King Grok",
      "emoji": "👑",
      "line": "The Goblin King sits on a throne of bones, wielding a massive spiked club."
    },
    "lore": "The goblins were once servants of the Ancients. When their masters fell, they built their own kingdom in the ruins.",
    "skills": [],
    "relic": {
      "name": "King's Crown",
      "rarity": "rare",
      "chance": 10
    }
  },
  {
    "chapter": 4,
    "title": "The Crystal Caverns",
    "subtitle": "Beauty hides the deadliest dangers",
    "text": "The rough stone gives way to shimmering crystal formations. The cavern sparkles with an ethereal light — purple, blue, and green crystals jut from every surface, illuminating the path ahead.\n\nBut beauty is a trap in the tower.\n\nThe crystals hum with a strange energy. Some say they're alive. Others say they're the crystallized souls of adventurers who came before.\n\nAs you step forward, a crystal cracks. From within, a creature of pure gemstone claws its way out.",
    "enemies": "💎 Crystal Golems · 🔮 Mana Wisps · 🧊 Ice Shards · ⚡ Crystal Stalkers",
    "boss": {
      "name": "The Crystal Queen",
      "emoji": "💠",
      "line": "A being of pure crystal rises from the cavern floor, her voice like breaking glass."
    },
    "lore": "The crystals are fragments of a celestial meteor that crashed into the tower ages ago, imbued with raw magic.",
    "skills": [
      "Mana Surge"
    ],
    "relic": {
      "name": "Crystal Bow",
      "rarity": "rare",
      "chance": 12
    }
  },
  {
    "chapter": 5,
    "title": "The Abyssal Descent",
    "subtitle": "Beyond the light, shadows reign",
    "text": "The crystalline beauty fades as you descend into utter darkness. Your torch barely illuminates the path ahead. The air grows cold and heavy.\n\nThis is the Abyss — a vertical chasm that plunges miles into the earth. Narrow bridges connect crumbling platforms. One wrong step and you fall into endless nothing.\n\nThe shadows here are alive. They reach for you, whisper your name, show you visions of your deepest fears.\n\nA voice cuts through the darkness: 'Turn back, mortal. What lies below is not meant for the living.'",
    "enemies": "💀 Skeletons · 👻 Wraiths · 🪦 Ghouls · 🐺 Werewolves",
    "boss": {
      "name": "The Abyss Watcher",
      "emoji": "🌀",
      "line": "A towering figure cloaked in shadows steps from the void, twin blades gleaming."
    },
    "lore": "The Abyss is a wound in reality — a place where the veil between worlds is thinnest.",
    "skills": [
      "Blade Dance"
    ],
    "relic": {
      "name": "Abyss Keeper's Blade",
      "rarity": "epic",
      "chance": 8
    }
  },
  {
    "chapter": 6,
    "title": "The Forgotten Library",
    "subtitle": "Knowledge is power. And madness.",
    "text": "The darkness recedes, replaced by a vast library that stretches as far as the eye can see. Bookshelves tower hundreds of feet high, filled with tomes of forgotten knowledge.\n\nThis is the Library of the Ancients — where all the knowledge of the old world was stored.\n\nBut the knowledge here is guarded. Magical constructs patrol the aisles. Trapped books scream when touched. And somewhere in the deepest archive, a being of pure knowledge awaits those brave enough to seek its wisdom.\n\nA floating tome approaches you, its pages flipping open. 'Welcome, seeker. What knowledge do you seek? Power? Truth? Or death?'",
    "enemies": "📖 Animated Tomes · 🤖 Arcane Constructs · 🌀 Mana Elementals · 👁️ Watchers",
    "boss": {
      "name": "The Archivist",
      "emoji": "📚",
      "line": "An ancient being bound in scrolls and leather, its eyes burning with arcane fire."
    },
    "lore": "The Ancients recorded everything — spells, prophecies, and the true nature of the Void. Some knowledge was meant to stay forgotten.",
    "skills": [
      "Thunderclap"
    ],
    "relic": {
      "name": "Archivist's Staff",
      "rarity": "epic",
      "chance": 8
    }
  },
  {
    "chapter": 7,
    "title": "The Forge of Souls",
    "subtitle": "Where weapons are born and heroes fall",
    "text": "The temperature rises with every step. The air smells of molten metal and burnt magic. You've entered the Forge of Souls — a colossal workshop where the Ancients crafted their most powerful artifacts.\n\nMassive furnaces line the walls, still burning after centuries. Anvils the size of boulders sit abandoned. Weapons of unimaginable power hang on racks, waiting for worthy hands.\n\nBut the forge is not empty. The souls of ancient smiths still haunt this place, bound to their work for eternity. They do not take kindly to thieves.\n\nA deep voice rumbles: 'State your purpose, intruder. Are you here to create... or to steal?'",
    "enemies": "🔥 Fire Elementals · ⛓️ Soulbound Knights · 🛠️ Animated Armors · 🌋 Lava Beasts",
    "boss": {
      "name": "The Soul Forgemaster",
      "emoji": "⚒️",
      "line": "A giant of molten metal and shadow, hammer in hand, stands before the great anvil."
    },
    "lore": "The Ancients bound souls to their weapons, granting them sentience. Some of those weapons still hunger for battle.",
    "skills": [
      "Flame Burst"
    ],
    "relic": {
      "name": "Soulforged Blade",
      "rarity": "epic",
      "chance": 6
    }
  },
  {
    "chapter": 8,
    "title": "The Garden of Nightmares",
    "subtitle": "Reality bends and breaks",
    "text": "The industrial heat gives way to an impossible sight — a lush garden blooming in the depths of the tower. Bioluminescent flowers sway in an unfelt breeze. Trees with silver leaves tower overhead.\n\nBut something is deeply wrong. The flowers sing in forgotten tongues. The trees have faces in their bark. The paths shift when you're not looking.\n\nThis is the Garden of Nightmares, where the tower's magic manifests your fears and desires into reality.\n\nA figure that looks exactly like you stands across the clearing, wielding a mirror-polished blade. 'To go forward, you must first face yourself.'",
    "enemies": "🌺 Nightmare Blooms · 🌳 Ents · 🦋 Phantom Moths · 🪞 Mirror Images",
    "boss": {
      "name": "The Nightmare King",
      "emoji": "🌑",
      "line": "A shifting mass of shadow and fear takes form, wearing the faces of everyone you've lost."
    },
    "lore": "The garden was created by a lonely Ancient who wished to preserve beauty. But isolation twisted the garden into something sinister.",
    "skills": [
      "Divine Shield"
    ],
    "relic": {
      "name": "Dreamweaver's Bow",
      "rarity": "epic",
      "chance": 5
    }
  },
  {
    "chapter": 9,
    "title": "The Dragon's Lair",
    "subtitle": "Face the fire that forged the world",
    "text": "The garden collapses behind you as you step into a vast volcanic chamber. Rivers of lava flow between stone pathways. The heat is unbearable.\n\nAt the center of the chamber, coiled around a pillar of obsidian, lies a dragon of immense size. Its scales shimmer like molten gold. Its eyes — ancient and knowing — fix upon you.\n\n'Ah,' it rumbles, smoke curling from its nostrils. 'Another one. The tower sends me many. But you... you carry a spark the others lacked. Tell me, little flame, why should I let you pass?'\n\nThe dragon rises, unfurling wings that blot out the lava-light. 'Prove your worth, or be reduced to ash.'",
    "enemies": "🐉 Drakes · 🔥 Lava Wyrms · 🦎 Fire Lizards · 🪨 Obsidian Golems",
    "boss": {
      "name": "Ignis, the Ancient Wyrm",
      "emoji": "🐲",
      "line": "The great dragon Ignis rises, molten gold dripping from its scales. The air itself catches fire."
    },
    "lore": "Ignis was once the companion of the First Ancient. When the Ancients fell, Ignis chose to guard the tower's deepest secrets.",
    "skills": [
      "Earthshaker"
    ],
    "relic": {
      "name": "Scale of Ignis",
      "rarity": "legendary",
      "chance": 3
    }
  },
  {
    "chapter": 10,
    "title": "The Celestial Summit",
    "subtitle": "The final ascent",
    "text": "The volcanic chamber opens into a sight that steals your breath. You are above the clouds. The tower's peak is a platform of white marble, suspended in an endless sky.\n\nStars wheel overhead in patterns that shouldn't exist. Constellations tell stories of battles between gods and monsters. The wind carries the echoes of ancient songs.\n\nAt the center of the platform stands a lone figure — tall, cloaked in starlight, their face obscured by a hood of woven galaxies.\n\n'I've been waiting for you,' the figure says. 'I am the last of the Ancients. And you... you are the first mortal in a thousand years to reach this height.'\n\nThey extend a hand. 'Join me. Or challenge me. Either way, the truth of the tower will be revealed.'",
    "enemies": "⭐ Celestial Guardians · 🌌 Void Walkers · 🌀 Chaos Beasts · ✨ Starlight Sentinels",
    "boss": {
      "name": "The Last Ancient",
      "emoji": "👁️",
      "line": "The hood falls back to reveal a face of pure starlight. 'I am the beginning and the end of this tower.'"
    },
    "lore": "The Last Ancient awaits at the summit, guarding the truth of the tower's purpose. Beyond the summit lies the Void Gate.",
    "skills": [],
    "relic": {
      "name": "Celestial Crest",
      "rarity": "legendary",
      "chance": 2
    }
  },
  {
    "chapter": 11,
    "title": "The Veil of Mists",
    "subtitle": "Where memory fades and fog breathes",
    "text": "Beyond the summit of the tower's first half lies something the stories never mention — a sea of pale mist that swallows the stairs whole. The Celestial Summit is not the end. It was a gateway.\n\nThe mist coils around your legs like living silk. Every step you take is echoed by a second set of footsteps. Whispers carry your own name, your own secrets, your own regrets.\n\nSomewhere ahead, a lighthouse bell tolls. It has not stopped ringing for a thousand years.\n\n'The mist keeps what it takes,' a voice says from everywhere at once. 'Are you sure you want to be kept?'",
    "enemies": "🌫️ Mist Wraiths · 🔔 Bell Sentinels · 🕯️ Lantern Sprites · 🎭 Echoes of the Fallen",
    "boss": {
      "name": "The Keeper of Mist",
      "emoji": "🌁",
      "line": "A hooded figure of condensed fog steps forth, a lantern of blue fire in its hands. 'You should have turned back when the whispers knew your name.'"
    },
    "lore": "The Veil was conjured by the Ancients to hide the tower's second half from the eyes of gods and mortals alike. Only the worthy forget themselves and find the path.",
    "skills": [
      "Iron Wall"
    ],
    "relic": {
      "name": "Mistrend's Lantern",
      "rarity": "epic",
      "chance": 7
    }
  },
  {
    "chapter": 12,
    "title": "The Clockwork Sanctum",
    "subtitle": "Time itself ticks to the tower's rhythm",
    "text": "The mist parts onto a cathedral of brass and glass. Gears the size of houses turn in the walls. Pendulums swing in perfect, deafening unison. This is the Clockwork Sanctum — the tower's beating heart.\n\nNothing here is alive in the way you understand. Brass knights patrol the halls with clockwork precision. Glass-pane guardians watch with unfocused eyes. Every mechanism was built for a purpose no one remembers.\n\nAt the center of the sanctum, a colossal clock face counts down — to what, no one knows. The hands move in reverse.\n\nA voice like grinding gears booms out: 'You are early. Or late. For the tower, it is all the same.'",
    "enemies": "🤖 Brass Knights · ⚙️ Gear Golems · 🕰️ Temporal Shades · 🎡 Pendulum Reapers",
    "boss": {
      "name": "Chronos, the Gearfather",
      "emoji": "⏳",
      "line": "The great clock face opens like a mouth. Within, a creature of pure mechanism watches you with a hundred ticking eyes. 'All things come to me — eventually.'"
    },
    "lore": "The Ancients built the Sanctum to hold back time itself, buying the tower the ages it needed to complete its purpose. The reverse-counting clock marks the tower's true age.",
    "skills": [
      "Swift Step"
    ],
    "relic": {
      "name": "Temporal Blade",
      "rarity": "epic",
      "chance": 6
    }
  },
  {
    "chapter": 13,
    "title": "The Sunken Cathedral",
    "subtitle": "Faith drowned, prayers unanswered",
    "text": "The gears wind down into silence. Before you lies a cathedral drowned in an ocean of still, black water. Vaulted ceilings arch overhead, their stained glass windows glowing with images of gods long forgotten.\n\nPews float in the aisles. Hymnals drift like fallen leaves. A choir of drowned voices rises and falls with the ripple of unseen currents — singing a hymn you somehow know.\n\nAt the altar, something kneels. It has been kneeling for a very long time.\n\n'They stopped answering,' the kneeling thing says without turning. 'So I stopped leaving. Pray with me, traveler. Perhaps your voice will reach them.'",
    "enemies": "🌊 Drowned Priests · 🕯️ Candle Ghasts · ⛪ Choir Shades · 🫧 Bubble Wraiths",
    "boss": {
      "name": "The Drowned Abbot",
      "emoji": "🕯️",
      "line": "The kneeling figure rises, revealing a face of endless water. 'The gods did not answer. So I became the answer.'"
    },
    "lore": "When the Ancients sealed the tower, the faithful sealed themselves inside with it — certain their gods would return. The waters rose. The gods did not.",
    "skills": [
      "Meditate"
    ],
    "relic": {
      "name": "Tidecaller's Staff",
      "rarity": "epic",
      "chance": 5
    }
  },
  {
    "chapter": 14,
    "title": "The Ashen Plains",
    "subtitle": "A kingdom burned to keep its secret",
    "text": "The cathedral gives way to an endless plain of grey ash. Wind sculpts the ash into shapes — a crown here, a sword there, the suggestion of a city skyline that crumbles the moment you focus.\n\nThis was a kingdom once. A proud one. The kind that built monuments to itself and believed the sky would always be theirs.\n\nNow every step you take raises a plume of what used to be someone's home. Charred banners hang from skeletal towers. A throne sits alone on a hill, still perfectly intact.\n\nA figure in blackened armor stands before the throne, hand resting on a sword embedded in the ash. 'Sit,' it offers. 'Everyone else who ruled here did. It did not end well.'",
    "enemies": "🔥 Cinder Knights · 🏚️ Ash Beasts · 🗡️ Burned Blades · 🪦 Tomb Embers",
    "boss": {
      "name": "The Last King of Ash",
      "emoji": "👑",
      "line": "The armored figure draws the sword. Flames erupt along its edge. 'I burned my kingdom to hide my shame. You will not leave to speak of it.'"
    },
    "lore": "The kingdom's vault held a fragment of the tower's origin. Rather than let it fall to invaders, the king burned everything — himself included — to keep it from leaving.",
    "skills": [
      "Power Strike"
    ],
    "relic": {
      "name": "Ashen Monarch's Sword",
      "rarity": "legendary",
      "chance": 4
    }
  },
  {
    "chapter": 15,
    "title": "The Hall of Mirrors",
    "subtitle": "Every reflection hides a truth",
    "text": "The ash settles. You stand in a corridor of mirrors, stretching infinitely in every direction. Countless versions of you look back — some older, some scarred, some smiling in ways you don't like.\n\nEvery mirror shows a different path you could have walked. The warrior you might have been. The king. The monster.\n\nOne mirror shows you turning back. In it, you live a long, quiet life. The reflection meets your eyes and mouths: 'Run.'\n\nThe mirrors ripple in unison. From each one, a copy of you steps forward — same face, same blade, same purpose. To reach the end of the hall, you must defeat every self you could have become.\n\n'Welcome,' they say together. 'We've been expecting the original.'",
    "enemies": "🪞 Mirror Doppelgangers · 🌀 Shatter Sprites · 👤 Phantom Doubles · 🗡️ Reflected Blades",
    "boss": {
      "name": "The Mirror King",
      "emoji": "🪞",
      "line": "A thousand reflections of you merge into one towering figure of fractured glass. 'I am every choice you never made. And I am done waiting.'"
    },
    "lore": "The Ancients stored their regrets here. Every reflection is a real person from a discarded timeline, imprisoned by the tower to keep their mistakes from spreading.",
    "skills": [
      "Shadow Strike"
    ],
    "relic": {
      "name": "Glass Crown",
      "rarity": "legendary",
      "chance": 3
    }
  },
  {
    "chapter": 16,
    "title": "The Umbral Court",
    "subtitle": "Judgment awaits the unworthy",
    "text": "The mirrors shatter into motes of light. You stand in a vast courtroom, its ceiling lost in darkness. Rows of shadowed figures fill the benches — jurors who have not moved in millennia.\n\nAt the head of the court, twelve thrones. Eleven are occupied by hooded silhouettes. The twelfth sits empty.\n\nA gavel strikes. The sound cracks through your bones.\n\n'The tower has judged your kind before,' a voice intones. 'It found humanity wanting. It will find you wanting. But the court is merciful — it gives every accused one chance to plead their case.'\n\nThe shadows rise as one. 'Your case will be argued in steel.'",
    "enemies": "⚖️ Shadow Bailiffs · 🧑‍⚖️ Verdict Shades · 🔒 Chain Wraiths · 🛡️ Black Jurors",
    "boss": {
      "name": "The Judge of Umbral",
      "emoji": "⚖️",
      "line": "The eleventh hood falls back, revealing a face of pure darkness with two cold stars for eyes. 'The court finds you... interesting. Let us see if that changes.'"
    },
    "lore": "The Umbral Court was the Ancients' last check on themselves — a council that could veto any decision, including the one that doomed them.",
    "skills": [
      "Fortress"
    ],
    "relic": {
      "name": "Verdict of Night",
      "rarity": "legendary",
      "chance": 3
    }
  },
  {
    "chapter": 17,
    "title": "The Iron Grave",
    "subtitle": "Where armies go to die standing",
    "text": "The courtroom dissolves into a battlefield frozen in time. Thousands of soldiers stand mid-charge, swords raised, mouths open in silent war cries. They have stood this way for centuries — not statues, but preserved corpses, held upright by their rusted armor.\n\nThis is where the tower's first invasion force died. The army that tried to conquer it from within.\n\nEvery soldier faces the same direction — toward a door at the far end of the field, sealed with chains thicker than a man.\n\nSomething moves among the dead. A figure in armor blacker than the rest, walking the ranks, straightening a helmet here, saluting a fallen captain there.\n\nIt turns to you. 'They followed me,' it says. 'They believed in me. I led them here, and the tower killed them all. I am the only one who survived. That is my crime, and my punishment.'",
    "enemies": "🪖 Risen Legionnaires · ⚔️ Sword Captains · 🛡️ Shield Walls · 💀 War Phantoms",
    "boss": {
      "name": "The Iron General",
      "emoji": "🪖",
      "line": "The black-armored figure draws a blade that has not tasted blood in a thousand years. 'My soldiers died following my dream. Die for it too, stranger.'"
    },
    "lore": "The General's army was the last organized attempt to reach the Void Gate. The tower broke them without a single living defender — it simply refused to let them leave.",
    "skills": [
      "Berserk"
    ],
    "relic": {
      "name": "Black Banner",
      "rarity": "legendary",
      "chance": 2
    }
  },
  {
    "chapter": 18,
    "title": "The Realm of Echoes",
    "subtitle": "Speak, and the world answers back",
    "text": "The battlefield fades. You stand in a space that is not quite a place — a realm of sound made visible. Every word you've ever spoken hangs in the air as a glowing thread. Every laugh, every whisper, every cry.\n\nYour footsteps ring like bells. Your breath sounds like a storm. The realm remembers everything, and it repeats it all back to you — out of order.\n\nYou hear your own voice as a child. Then your voice from an hour ago. Then a voice you do not recognize at all, speaking words you have never said, in a language you do not know.\n\n'I am the last echo,' the voice says, now coming from everywhere. 'The tower spoke once, and I am what remains. Do you know what the tower said?'",
    "enemies": "🔊 Sonic Wraiths · 🎵 Melody Fiends · 📣 Thunder Shades · 🗣️ Banshee Choir",
    "boss": {
      "name": "The Last Echo",
      "emoji": "📢",
      "line": "A form of pure sound condenses before you, speaking with the voices of everyone who has ever entered the tower. 'The tower said: LET THEM COME. And they did. And they always will.'"
    },
    "lore": "The Realm of Echoes is the tower's memory. Every sound ever made within its walls is preserved here — including the last words of the Ancients.",
    "skills": [
      "Life Steal"
    ],
    "relic": {
      "name": "Silent Bell",
      "rarity": "legendary",
      "chance": 2
    }
  },
  {
    "chapter": 19,
    "title": "The Primal Rift",
    "subtitle": "The tower's raw, untamed heart",
    "text": "Sound dies. Gravity wavers. You step into a wound in reality itself — the Primal Rift, where the tower's magic is born raw and unshaped. The walls are not walls; they are the suggestion of walls, flickering between stone and starlight.\n\nCreatures here are not creatures — they are ideas that learned to hunt. A fear given claws. A whisper given wings. A nightmare that grew tired of sleeping.\n\nThe air itself fights you. The floor changes its mind. The light is afraid.\n\nAt the rift's core, something ancient drifts — not alive, not dead, not even present. It is the tower's first thought, still thinking, after all these ages.\n\nIt notices you. 'Ah,' it thinks, and the word shakes the rift. 'A question has arrived. I have been waiting to be asked.'",
    "enemies": "🌀 Rift Spawn · 🌌 Thought Eaters · ⚡ Concept Hounds · 🕳️ Void Lurkers",
    "boss": {
      "name": "The First Thought",
      "emoji": "🌌",
      "line": "The drifting presence coalesces into a shape that is simultaneously a giant, a storm, and a doorway. 'Ask your question, mortal. I will answer. I always answer.'"
    },
    "lore": "The Rift is the engine of the tower — the raw imagination of the Ancients, still running long after its creators faded. To reach the Void Gate, you must pass through the very thoughts that built it.",
    "skills": [
      "Earthshaker"
    ],
    "relic": {
      "name": "Primordial Edge",
      "rarity": "legendary",
      "chance": 2
    }
  },
  {
    "chapter": 20,
    "title": "The Void Gate",
    "subtitle": "The end of the ascent. The start of everything.",
    "text": "The Rift spits you out onto a platform of black glass floating in nothingness. Above you, below you, around you — the Void. Endless, patient, older than the stars.\n\nAnd there, at the platform's edge, stands the Void Gate: a door that is not a door, a threshold that holds back infinity. Chains of light bind it shut. They have never been tested.\n\nThe Last Ancient stands before it, no longer a distant figure but a solid, waiting presence. 'You made it,' they say, and there is something like pride in their voice. 'Through mist and mechanism, faith and fire. Through your own reflections and the tower's oldest memories. You made it.'\n\nThey turn to face the Gate. 'Behind this door is what the Ancients sealed away — the truth of why the tower was built. It is not a secret for everyone. But it may be a secret for you.'\n\nThey step aside. 'One hundred floors. One final choice. The Gate is open to you, Ascendant. Walk through — or walk away, and live a long, unremarkable life. The tower will remember you either way.'",
    "enemies": "👁️ Gate Guardians · 🌑 Void Titans · ⭐ Fallen Celestials · 🌀 Chaos Primordials",
    "boss": {
      "name": "The Void Herald",
      "emoji": "🌑",
      "line": "From beyond the Gate, a voice that is not a voice speaks. 'The Ancients feared what they made. You are the first who did not. Step forward, mortal. The Void has been expecting you.'"
    },
    "lore": "The Void Gate is not the end of the tower — it is the beginning. The Ancients built the tower to hold the Gate, and the Gate to hold what lies beyond. You are the first to stand before it unbroken.",
    "skills": [
      "Mana Surge"
    ],
    "relic": {
      "name": "Gatekeeper's Crown",
      "rarity": "legendary",
      "chance": 2
    }
  }
];
export const DUNGEON_BANDS: DungeonBand[] = [
  {
    "from": 1,
    "to": 20,
    "enemies": [
      {
        "icon": "🐺",
        "name": "Goblin"
      },
      {
        "icon": "🟢",
        "name": "Slime"
      },
      {
        "icon": "🐗",
        "name": "Boar"
      },
      {
        "icon": "🕷️",
        "name": "Spider"
      },
      {
        "icon": "🐀",
        "name": "Giant Rat"
      },
      {
        "icon": "🦇",
        "name": "Bat Swarm"
      },
      {
        "icon": "🌿",
        "name": "Thorn Vine"
      },
      {
        "icon": "👹",
        "name": "Imp"
      }
    ]
  },
  {
    "from": 21,
    "to": 40,
    "enemies": [
      {
        "icon": "💀",
        "name": "Skeleton"
      },
      {
        "icon": "🔮",
        "name": "Dark Elf"
      },
      {
        "icon": "👻",
        "name": "Wraith"
      },
      {
        "icon": "🐺",
        "name": "Werewolf"
      },
      {
        "icon": "🪦",
        "name": "Ghoul"
      },
      {
        "icon": "⚔️",
        "name": "Orc Scout"
      },
      {
        "icon": "🦂",
        "name": "Stinger"
      },
      {
        "icon": "🔥",
        "name": "Fire Elemental"
      }
    ]
  },
  {
    "from": 41,
    "to": 60,
    "enemies": [
      {
        "icon": "🐉",
        "name": "Drake"
      },
      {
        "icon": "👹",
        "name": "Ogre"
      },
      {
        "icon": "🌀",
        "name": "Phantom"
      },
      {
        "icon": "💀",
        "name": "Lich"
      },
      {
        "icon": "🌑",
        "name": "Shadow Beast"
      },
      {
        "icon": "🗡️",
        "name": "Assassin"
      },
      {
        "icon": "🧊",
        "name": "Ice Golem"
      },
      {
        "icon": "🦴",
        "name": "Bone Dragon"
      }
    ]
  },
  {
    "from": 61,
    "to": 80,
    "enemies": [
      {
        "icon": "🐲",
        "name": "Wyrm"
      },
      {
        "icon": "👁️",
        "name": "Beholder"
      },
      {
        "icon": "⚡",
        "name": "Storm Titan"
      },
      {
        "icon": "🔥",
        "name": "Archfiend"
      },
      {
        "icon": "🌊",
        "name": "Abyssal Kraken"
      },
      {
        "icon": "💀",
        "name": "Death Knight"
      },
      {
        "icon": "🛡️",
        "name": "Dark Paladin"
      },
      {
        "icon": "🌀",
        "name": "Void Walker"
      }
    ]
  },
  {
    "from": 81,
    "to": 100,
    "enemies": [
      {
        "icon": "🌌",
        "name": "Void Lord"
      },
      {
        "icon": "🐉",
        "name": "Ancient Dragon"
      },
      {
        "icon": "👑",
        "name": "Demon King"
      },
      {
        "icon": "⭐",
        "name": "Celestial Guardian"
      },
      {
        "icon": "🌀",
        "name": "Chaos Beast"
      },
      {
        "icon": "💀",
        "name": "Lich King"
      },
      {
        "icon": "🌑",
        "name": "Shadow Titan"
      },
      {
        "icon": "🔥",
        "name": "Primordial Flame"
      }
    ]
  }
];
export const WEAPON_SOURCE: ItemTemplateSource[] = [
  {
    "id": "wooden_sword",
    "name": "Wooden Sword",
    "icon": "🗡️",
    "desc": "A basic wooden sword."
  },
  {
    "id": "iron_sword",
    "name": "Iron Sword",
    "icon": "⚔️",
    "desc": "A sturdy iron blade."
  },
  {
    "id": "steel_sword",
    "name": "Steel Sword",
    "icon": "🔪",
    "desc": "Sharp steel."
  },
  {
    "id": "flame_blade",
    "name": "Flame Blade",
    "icon": "🔥",
    "desc": "Burns with eternal fire."
  },
  {
    "id": "obsidian_katana",
    "name": "Obsidian Katana",
    "icon": "🗾",
    "desc": "A razor-sharp volcanic glass blade."
  },
  {
    "id": "dragon_slayer",
    "name": "Dragon Slayer",
    "icon": "🐉",
    "desc": "Forged to slay dragons."
  },
  {
    "id": "excalibur",
    "name": "Excalibur",
    "icon": "👑",
    "desc": "The legendary sword of kings."
  },
  {
    "id": "stormbreaker",
    "name": "Stormbreaker",
    "icon": "⚡",
    "desc": "Forged in the heart of a storm."
  },
  {
    "id": "phoenix_blade",
    "name": "Phoenix Blade",
    "icon": "🔥",
    "desc": "Reborn from immortal flames."
  },
  {
    "id": "doomhammer",
    "name": "Doomhammer",
    "icon": "🔨",
    "desc": "Smashes everything in its path."
  },
  {
    "id": "tempest_fury",
    "name": "Tempest Fury",
    "icon": "🌪️",
    "desc": "A blade infused with the fury of storms."
  },
  {
    "id": "void_reaper",
    "name": "Void Reaper",
    "icon": "🌑",
    "desc": "Forged from the essence of the Void."
  },
  {
    "id": "eternal_flame",
    "name": "Eternal Flame",
    "icon": "🔥",
    "desc": "Burns with the fire of a thousand suns."
  },
  {
    "id": "prismatic_blade",
    "name": "Prismatic Blade",
    "icon": "💠",
    "desc": "Refracts light into devastating energy."
  },
  {
    "id": "crystal_staff",
    "name": "Crystal Staff",
    "icon": "🔮",
    "desc": "Channels geomantic power through crystal."
  },
  {
    "id": "abyssal_blade",
    "name": "Abyssal Blade",
    "icon": "🔥",
    "desc": "Forged in the Abyssal Rift. Burns with hellfire."
  },
  {
    "id": "soul_reaper",
    "name": "Soul Reaper",
    "icon": "💀",
    "desc": "Steals the soul of the fallen."
  },
  {
    "id": "shadow_fang",
    "name": "Shadow Fang",
    "icon": "🌑",
    "desc": "A blade forged in the Shadowfall Depths. Strikes from the void."
  },
  {
    "id": "ember_fang",
    "name": "Ember Fang",
    "icon": "🔥",
    "desc": "Forged in the Molten Core. Burns with eternal flame."
  },
  {
    "id": "lunar_crescent",
    "name": "Lunar Crescent",
    "icon": "🌙",
    "desc": "A crescent blade forged from pure moonlight."
  },
  {
    "id": "gaia_wrath",
    "name": "Gaia's Wrath",
    "icon": "🌿",
    "desc": "A living weapon grown from the World Tree."
  },
  {
    "id": "eclipse_blade",
    "name": "Eclipse Blade",
    "icon": "🌑",
    "desc": "Forged in the space between sun and moon."
  },
  {
    "id": "scorching_mirage",
    "name": "Scorching Mirage",
    "icon": "🏜️",
    "desc": "A blade forged from desert heat and ancient magic."
  },
  {
    "id": "glacial_blade",
    "name": "Glacial Blade",
    "icon": "🧊",
    "desc": "A blade forged in the heart of a glacier."
  },
  {
    "id": "frostbite_staff",
    "name": "Frostbite Staff",
    "icon": "❄️",
    "desc": "Channels the biting cold of eternal winter."
  },
  {
    "id": "stormsplitter_blade",
    "name": "Stormsplitter Blade",
    "icon": "🌊",
    "desc": "Cleaves through tidal waves and thunderstorms alike."
  },
  {
    "id": "astral_blade",
    "name": "Astral Blade",
    "icon": "🌌",
    "desc": "Forged from crystallized astral energy. Cuts through dimensions."
  },
  {
    "id": "stellar_talon",
    "name": "Stellar Talon",
    "icon": "⭐",
    "desc": "A claw-like weapon forged from a dying star."
  },
  {
    "id": "aether_blade",
    "name": "Aether Blade",
    "icon": "🌌",
    "desc": "Forged from pure cosmic creation energy. Cuts through reality itself."
  },
  {
    "id": "chrono_edge",
    "name": "Chrono Edge",
    "icon": "⏳",
    "desc": "A blade that cuts through time itself."
  },
  {
    "id": "abyssal_trident",
    "name": "Abyssal Trident",
    "icon": "🔱",
    "desc": "Forged in the deepest ocean trench. Strikes with the pressure of the abyss."
  },
  {
    "id": "celestial_scepter",
    "name": "Celestial Scepter",
    "icon": "🌟",
    "desc": "Forged from collapsed star matter. Channels cosmic energy."
  },
  {
    "id": "void_render",
    "name": "Void Render",
    "icon": "🌀",
    "desc": "A blade that tears through the fabric of reality."
  }
];
export const ARMOR_SOURCE: ItemTemplateSource[] = [
  {
    "id": "leather_armor",
    "name": "Leather Armor",
    "icon": "🥋",
    "desc": "Basic leather protection."
  },
  {
    "id": "chainmail",
    "name": "Chainmail",
    "icon": "⛓️",
    "desc": "Linked metal rings."
  },
  {
    "id": "iron_armor",
    "name": "Iron Armor",
    "icon": "🛡️",
    "desc": "Solid iron plates."
  },
  {
    "id": "steel_armor",
    "name": "Steel Armor",
    "icon": "🏰",
    "desc": "Heavy steel protection."
  },
  {
    "id": "titanium_armor",
    "name": "Titanium Armor",
    "icon": "🛡️",
    "desc": "Lightweight yet nearly unbreakable."
  },
  {
    "id": "dragon_scale",
    "name": "Dragon Scale",
    "icon": "🐲",
    "desc": "Made from dragon scales."
  },
  {
    "id": "divine_plate",
    "name": "Divine Plate",
    "icon": "✨",
    "desc": "Blessed by the gods."
  },
  {
    "id": "celestial_aegis",
    "name": "Celestial Aegis",
    "icon": "🌟",
    "desc": "Woven from starlight."
  },
  {
    "id": "mystic_robes",
    "name": "Mystic Robes",
    "icon": "🌙",
    "desc": "Enchanted fabric that absorbs magic."
  },
  {
    "id": "abyssal_cloak",
    "name": "Abyssal Cloak",
    "icon": "🌑",
    "desc": "Woven from the fabric of the abyss."
  },
  {
    "id": "storm_shield",
    "name": "Storm Shield",
    "icon": "⛈️",
    "desc": "Forged in the heart of a hurricane."
  },
  {
    "id": "void_plate",
    "name": "Void Plate",
    "icon": "🌌",
    "desc": "Absorbs attacks into the Void."
  },
  {
    "id": "eternal_aegis",
    "name": "Eternal Aegis",
    "icon": "✨",
    "desc": "An indestructible shield of pure light."
  },
  {
    "id": "prismatic_shield",
    "name": "Prismatic Shield",
    "icon": "💠",
    "desc": "A shield that refracts incoming attacks."
  },
  {
    "id": "crystal_plate",
    "name": "Crystal Plate",
    "icon": "🔮",
    "desc": "Forged from enchanted crystal matrices."
  },
  {
    "id": "abyssal_armor",
    "name": "Abyssal Armor",
    "icon": "🔥",
    "desc": "Forged in the Abyssal Rift. Immune to fire."
  },
  {
    "id": "soul_guard",
    "name": "Soul Guard",
    "icon": "💀",
    "desc": "Protects the wearer's soul from harm."
  },
  {
    "id": "shadowfall_armor",
    "name": "Shadowfall Armor",
    "icon": "🌑",
    "desc": "Forged in the depths where shadows reign. Absorbs dark energy."
  },
  {
    "id": "molten_plate",
    "name": "Molten Plate",
    "icon": "🔥",
    "desc": "Forged from the magma of the Eternal Flame."
  },
  {
    "id": "moonweave_robes",
    "name": "Moonweave Robes",
    "icon": "🌙",
    "desc": "Woven from threads of pure moonlight by the Moon Goddess."
  },
  {
    "id": "gaia_bark",
    "name": "Gaia's Bark",
    "icon": "🌿",
    "desc": "Living armor grown from ancient World Tree bark."
  },
  {
    "id": "eclipse_aegis",
    "name": "Eclipse Aegis",
    "icon": "🌑",
    "desc": "A shield forged from the essence of celestial alignment."
  },
  {
    "id": "sunforged_plate",
    "name": "Sunforged Plate",
    "icon": "🌞",
    "desc": "Forged under the eternal desert sun."
  },
  {
    "id": "frostweave_cloak",
    "name": "Frostweave Cloak",
    "icon": "🧣",
    "desc": "Woven from threads of pure ice by winter spirits."
  },
  {
    "id": "aurora_aegis",
    "name": "Aurora Aegis",
    "icon": "🌌",
    "desc": "A shield that captures the northern lights."
  },
  {
    "id": "tidalwave_barrier",
    "name": "Tidalwave Barrier",
    "icon": "🌊",
    "desc": "A shield forged from the pressure of the deepest ocean."
  },
  {
    "id": "voidweave_aegis",
    "name": "Voidweave Aegis",
    "icon": "🌌",
    "desc": "Woven from threads of pure void energy."
  },
  {
    "id": "astral_plate",
    "name": "Astral Plate",
    "icon": "💫",
    "desc": "Armor forged from crystallized starlight."
  },
  {
    "id": "cosmic_aegis",
    "name": "Cosmic Aegis",
    "icon": "🌌",
    "desc": "Woven from the fabric of the Celestial Abyss. Absorbs dimensional energy."
  },
  {
    "id": "temporal_aegis",
    "name": "Temporal Aegis",
    "icon": "⏳",
    "desc": "Woven from the fabric of frozen time. Stops attacks before they land."
  },
  {
    "id": "abyssal_mantle",
    "name": "Abyssal Mantle",
    "icon": "🌊",
    "desc": "Armor woven from the crushing pressure of the deepest ocean trench."
  },
  {
    "id": "cosmic_mantle",
    "name": "Cosmic Mantle",
    "icon": "🌌",
    "desc": "Woven from the fabric of the Celestial Abyss. Absorbs dimensional energy."
  }
];
export const POTION_SOURCE: ItemTemplateSource[] = [
  {
    "id": "health_potion",
    "name": "Health Potion",
    "icon": "❤️",
    "desc": "Restores 30 HP",
    "heal": 30
  },
  {
    "id": "large_potion",
    "name": "Large Potion",
    "icon": "💖",
    "desc": "Restores 75 HP",
    "heal": 75
  },
  {
    "id": "elixir",
    "name": "Elixir",
    "icon": "🧪",
    "desc": "Fully restores HP",
    "heal": 400
  },
  {
    "id": "mega_elixir",
    "name": "Mega Elixir",
    "icon": "💫",
    "desc": "Heals 500 HP instantly",
    "heal": 500
  },
  {
    "id": "xp_potion",
    "name": "XP Potion",
    "icon": "⭐",
    "desc": "Grants 50 XP",
    "xp_boost": 50
  },
  {
    "id": "elixir_of_power",
    "name": "Elixir of Power",
    "icon": "🧬",
    "desc": "Grants 200 XP instantly",
    "xp_boost": 200
  },
  {
    "id": "time_warp_potion",
    "name": "Time Warp Potion",
    "icon": "⏳",
    "desc": "Bends spacetime for 500 XP",
    "xp_boost": 500
  },
  {
    "id": "elixir_of_fortune",
    "name": "Elixir of Fortune",
    "icon": "🍀",
    "desc": "Grants 1000 XP and doubles fishing rewards for 5 minutes",
    "xp_boost": 1000
  },
  {
    "id": "crystal_elixir",
    "name": "Crystal Elixir",
    "icon": "💎",
    "desc": "A potent crystalline brew. Restores 1000 HP",
    "heal": 1000
  },
  {
    "id": "elixir_of_the_gods",
    "name": "Elixir of the Gods",
    "icon": "🌟",
    "desc": "Divine elixir. Grants 2500 XP instantly",
    "xp_boost": 2500
  },
  {
    "id": "abyssal_brew",
    "name": "Abyssal Brew",
    "icon": "🔥",
    "desc": "A fiery concoction from the Abyssal Rift. Restores 2000 HP",
    "heal": 2000
  },
  {
    "id": "soul_elixir",
    "name": "Soul Elixir",
    "icon": "💀",
    "desc": "Grants 5000 XP and fully restores HP",
    "xp_boost": 5000
  },
  {
    "id": "nectar_of_the_gods",
    "name": "Nectar of the Gods",
    "icon": "🌟",
    "desc": "Divine nectar. Restores 3000 HP instantly",
    "heal": 3000
  },
  {
    "id": "elixir_of_eternity",
    "name": "Elixir of Eternity",
    "icon": "⏳",
    "desc": "Grants 10000 XP and fully restores HP",
    "xp_boost": 10000
  },
  {
    "id": "mirage_flask",
    "name": "Mirage Flask",
    "icon": "🌌",
    "desc": "Restores 5000 HP and grants 5000 XP",
    "heal": 5000,
    "xp_boost": 5000
  },
  {
    "id": "frostfire_mixture",
    "name": "Frostfire Mixture",
    "icon": "🧊🔥",
    "desc": "A paradoxical brew of fire and ice. Restores 7000 HP and 7000 XP",
    "heal": 7000,
    "xp_boost": 7000
  },
  {
    "id": "elixir_of_the_aurora",
    "name": "Elixir of the Aurora",
    "icon": "🌌",
    "desc": "Distilled from the northern lights. Grants 15000 XP",
    "xp_boost": 15000
  },
  {
    "id": "phantom_tide",
    "name": "Phantom Tide",
    "icon": "🌊",
    "desc": "A ghostly ocean current. Grants 20000 XP and fully restores HP",
    "xp_boost": 20000
  },
  {
    "id": "cosmic_convergence",
    "name": "Cosmic Convergence",
    "icon": "🌌",
    "desc": "Channels cosmic forces. Restores 10000 HP and 10000 XP",
    "heal": 10000,
    "xp_boost": 10000
  },
  {
    "id": "elixir_of_infinity",
    "name": "Elixir of Infinity",
    "icon": "♾️",
    "desc": "Distilled from infinite space. Grants 25000 XP and fully restores HP",
    "xp_boost": 25000
  },
  {
    "id": "abyssal_convergence",
    "name": "Abyssal Convergence",
    "icon": "🌌",
    "desc": "Channels the full power of the Celestial Abyss. Restores 15000 HP and 15000 XP",
    "heal": 15000,
    "xp_boost": 15000
  },
  {
    "id": "elixir_of_forever",
    "name": "Elixir of Forever",
    "icon": "♾️",
    "desc": "A timeless brew from the Chrono Sanctum. Restores 20000 HP and 20000 XP",
    "heal": 20000,
    "xp_boost": 20000
  },
  {
    "id": "deep_tide_potion",
    "name": "Deep Tide Potion",
    "icon": "🌊",
    "desc": "Bottled pressure from the Abyssal Trench. Restores 18000 HP and 18000 XP",
    "heal": 18000,
    "xp_boost": 18000
  }
];
export const RELIC_SOURCE: ItemTemplateSource[] = [
  {
    "id": "lucky_charm",
    "name": "Lucky Charm",
    "icon": "🍀",
    "desc": "Increases rare drop chance"
  },
  {
    "id": "shield_ring",
    "name": "Shield Ring",
    "icon": "💍",
    "desc": "+5 permanent DEF"
  },
  {
    "id": "power_ring",
    "name": "Power Ring",
    "icon": "💎",
    "desc": "+5 permanent ATK"
  },
  {
    "id": "life_crystal",
    "name": "Life Crystal",
    "icon": "💠",
    "desc": "+20 permanent max HP"
  },
  {
    "id": "gravity_well",
    "name": "Gravity Well",
    "icon": "🌀",
    "desc": "+10 ATK & +10 DEF permanently"
  },
  {
    "id": "enchanted_lure",
    "name": "Enchanted Lure",
    "icon": "✨",
    "desc": "Doubles fishing rare catch chance"
  },
  {
    "id": "soul_gem",
    "name": "Soul Gem",
    "icon": "💎",
    "desc": "+15 ATK & +15 DEF & +30 max HP permanently"
  },
  {
    "id": "dragon_heart",
    "name": "Dragon Heart",
    "icon": "🐲",
    "desc": "+25 ATK & +25 DEF & +50 max HP permanently"
  },
  {
    "id": "celestial_blessing",
    "name": "Celestial Blessing",
    "icon": "🌟",
    "desc": "+40 ATK & +40 DEF & +100 max HP permanently"
  },
  {
    "id": "crystal_core",
    "name": "Crystal Core",
    "icon": "💎",
    "desc": "+60 ATK & +60 DEF & +150 max HP permanently"
  },
  {
    "id": "essence_of_eternity",
    "name": "Essence of Eternity",
    "icon": "✨",
    "desc": "+100 ATK & +100 DEF & +250 max HP permanently"
  },
  {
    "id": "abyssal_heart",
    "name": "Abyssal Heart",
    "icon": "🔥",
    "desc": "+150 ATK & +150 DEF & +350 max HP permanently"
  },
  {
    "id": "soul_stone",
    "name": "Soul Stone",
    "icon": "💀",
    "desc": "+200 ATK & +200 DEF & +500 max HP permanently"
  },
  {
    "id": "void_essence",
    "name": "Void Essence",
    "icon": "🌌",
    "desc": "+300 ATK & +300 DEF & +750 max HP permanently"
  },
  {
    "id": "flame_of_eternity",
    "name": "Flame of Eternity",
    "icon": "🔥",
    "desc": "+400 ATK & +400 DEF & +1000 max HP permanently"
  },
  {
    "id": "moonstone_aegis",
    "name": "Moonstone Aegis",
    "icon": "🌙",
    "desc": "+500 ATK & +500 DEF & +1250 max HP permanently"
  },
  {
    "id": "gaia_heart",
    "name": "Gaia's Heart",
    "icon": "🌿",
    "desc": "+600 ATK & +600 DEF & +1500 max HP permanently"
  },
  {
    "id": "eclipse_core",
    "name": "Eclipse Core",
    "icon": "🌑",
    "desc": "+750 ATK & +750 DEF & +2000 max HP permanently"
  },
  {
    "id": "solar_prism",
    "name": "Solar Prism",
    "icon": "💠",
    "desc": "+900 ATK & +900 DEF & +3000 max HP permanently"
  },
  {
    "id": "crystal_of_eternal_frost",
    "name": "Crystal of Eternal Frost",
    "icon": "💎",
    "desc": "+1100 ATK & +1100 DEF & +4000 max HP permanently"
  },
  {
    "id": "northern_star",
    "name": "Northern Star",
    "icon": "⭐",
    "desc": "+1300 ATK & +1300 DEF & +5000 max HP permanently"
  },
  {
    "id": "indigo_monarch_crown",
    "name": "Indigo Monarch's Crown",
    "icon": "👑",
    "desc": "+1500 ATK & +1500 DEF & +6000 max HP permanently"
  },
  {
    "id": "infinity_fragment",
    "name": "Infinity Fragment",
    "icon": "♾️",
    "desc": "+1800 ATK & +1800 DEF & +7500 max HP permanently"
  },
  {
    "id": "cosmic_seed",
    "name": "Cosmic Seed",
    "icon": "🌌",
    "desc": "+2200 ATK & +2200 DEF & +10000 max HP permanently"
  },
  {
    "id": "aether_shard",
    "name": "Aether Shard",
    "icon": "🌌",
    "desc": "+2800 ATK & +2800 DEF & +14000 max HP permanently"
  },
  {
    "id": "chrono_core",
    "name": "Chrono Core",
    "icon": "⏳",
    "desc": "+3500 ATK & +3500 DEF & +18000 max HP permanently"
  },
  {
    "id": "trench_treasure",
    "name": "Trench Treasure",
    "icon": "💠",
    "desc": "+1600 ATK & +1600 DEF & +6500 max HP permanently"
  },
  {
    "id": "astral_convergence",
    "name": "Astral Convergence",
    "icon": "🌌",
    "desc": "+4000 ATK & +4000 DEF & +22000 max HP permanently"
  },
  {
    "id": "primordius_core",
    "name": "Primordius' Core",
    "icon": "⚡",
    "desc": "+4600 ATK & +4600 DEF & +26000 max HP permanently"
  }
];
