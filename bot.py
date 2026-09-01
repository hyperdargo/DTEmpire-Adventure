#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════╗
║                    HERMES BOT v2.0                          ║
║           Multi-Tasking Discord Bot by Ankit                ║
║                                                              ║
║  Features: Auto-Mod, Welcome, Tickets, Music, Games,        ║
║            Logging, Watchdog, Self-Upgrade, Changelog       ║
║  Multi-guild. No DMs. Logs → central channel.               ║
╚══════════════════════════════════════════════════════════════╝
"""

import discord
from discord.ext import commands, tasks
import asyncio
import json
import os
import sys
import subprocess
import time
import datetime
import logging
import re
import random
from pathlib import Path
from collections import defaultdict

# ═══════════════════════════════════════════════════════════════
# CONFIG — loaded from environment
# ═══════════════════════════════════════════════════════════════

# Paths (needed for .env loading)
BASE_DIR = Path(__file__).parent

# Load .env file
from dotenv import load_dotenv
load_dotenv(BASE_DIR / ".env")
load_dotenv(Path.home() / ".hermes" / ".env")  # fallback

BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "")
HOME_GUILD_ID = int(os.environ.get("DISCORD_HOME_GUILD_ID") or "0")
LOG_CHANNEL_ID = 1514565322882158602
ALLOWED_USERS = [int(u) for u in os.environ.get("DISCORD_ALLOWED_USERS", "").split(",") if u.strip()]

CLI_MODE = None  # ("announce", text, title) when launched as: bot.py announce <message> [title]

# Data paths
DATA_DIR = BASE_DIR / "data"
LOG_DIR = BASE_DIR / "logs"
DATA_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)

# ═══════════════════════════════════════════════════════════════
# LOGGING
# ═══════════════════════════════════════════════════════════════

log_handler = logging.FileHandler(LOG_DIR / "bot.log", encoding="utf-8")
log_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
console_handler = logging.StreamHandler()
console_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
logging.basicConfig(level=logging.INFO, handlers=[log_handler, console_handler])
logger = logging.getLogger("HermesBot")

# ═══════════════════════════════════════════════════════════════
# CHANGELOG
# ═══════════════════════════════════════════════════════════════

CHANGELOG = [
    {
        "version": "v4.4",
        "date": "2026-07-28",
        "changes": [
            "🌪️ 2 new monsters in Storm Peaks: Cyclone Wraith (+52 ATK) and Hailstorm Golem (+32 DEF)",
            "🔧 Fixed guild_shops.json drift: real guild ID was missing 11 shop items present in bot.py (chrono_edge, abyssal_trident, celestial_scepter, temporal_aegis, abyssal_mantle, cosmic_mantle, elixir_of_forever, deep_tide_potion, chrono_core, trench_treasure, astral_convergence)",
            "🔧 Regenerated adventure_locations.json and guild_shops.json caches from bot.py source of truth for all guild keys",
        ],
    },
    {
        "version": "v4.3",
        "date": "2026-07-14",
        "changes": [
            "🕳️ 2 new monsters in Celestial Abyss: Singularity Worm (+360 ATK) and Cosmic Remnant (+380 ATK)",
            "🌌 New shop weapon: Celestial Scepter (+2500 ATK, 1,100,000 coins)",
            "🌌 New shop armor: Cosmic Mantle (+2300 DEF, 1,000,000 coins)",
            "💫 New shop special: Astral Convergence (+4000 ATK/DEF, +22000 HP permanent boost, 1,200,000 coins)",
            "🔧 Regenerated adventure_locations.json cache from bot.py source of truth",
            "🔧 Synced web dashboard buy handler with astral_convergence special item",
        ],
    },
    {
        "version": "v4.2",
        "date": "2026-07-13",
        "changes": [
            "🫧 2 new monsters in Abyssal Trench: Void Anglerfish (+195 ATK) and Megalodon Breacher (+210 ATK)",
            "🔱 New shop weapon: Abyssal Trident (+2300 ATK)",
            "🌊 New shop armor: Abyssal Mantle (+2100 DEF)",
            "💠 New shop special: Trench Treasure (+1600 ATK/DEF, +6500 HP permanent boost)",
            "🧪 New shop potion: Deep Tide Potion (18000 HP + 18000 XP)",
            "🔧 Regenerated adventure_locations.json cache from bot.py source of truth",
            "🔧 Synced web dashboard with all new items (trench_treasure handler)",
        ],
    },
    {
        "version": "v4.1",
        "date": "2026-07-12",
        "changes": [
            "⏳ New location: Chrono Sanctum (Lv.29+) — time-bent dimension with 4 monsters + Chronos, The Time Lord boss",
            "🗡️ New shop weapon: Chrono Edge (+2100 ATK)",
            "🛡️ New shop armor: Temporal Aegis (+1900 DEF)",
            "🧪 New shop potion: Elixir of Forever (20000 HP + 20000 XP)",
            "⏳ New shop special: Chrono Core (+3500 ATK/DEF, +18000 HP permanent boost)",
            "🔧 JSON caches synced with all new content",
        ],
    },
    {
        "version": "v3.11",
        "date": "2026-07-09",
        "changes": [
            "💫 Added 2 new monsters to Nebula Nexus: Pulsar Beast and Meteor Wyrm",
            "🔧 Fixed Nebula Nexus coin style from [] to () for consistency",
            "🔧 Fixed web dashboard dragon_heart special item (had abyssal_heart values, +25/+25/+50 now)",
            "🔧 Added missing abyssal_heart handler to web dashboard buy route",
            "🔧 Regenerated adventure_locations.json cache from bot.py source of truth",
            "🔧 Synced web dashboard JSON cache with all locations + new Nebula Nexus monsters",
        ],
    },
    {
        "version": "v3.10",
        "date": "2026-07-06",
        "changes": [
            "Added 2 new monsters to Dark Forest: Firefly Swarm and Boggart"
        ],
    },
    {
        "version": "v3.9",
        "date": "2026-06-29",
        "changes": [
            "New monster: Celestial Warden added to Celestial Abyss",
            "New monster: Nebula Colossus added to Celestial Abyss",
            "Updated adventure_locations.json and guild_shops.json"
        ],
    },
    {
        "version": "v3.8",
        "date": "2026-06-28",
        "changes": [
            "🌌 New location: Celestial Abyss (Lv.28+) — rift between galaxies with 4 monsters + Aethera, The Cosmic Architect boss",
            "🗡️ New shop weapon: Aether Blade (+1900 ATK)",
            "🛡️ New shop armor: Cosmic Aegis (+1700 DEF)",
            "🧪 New shop potion: Abyssal Convergence (15000 HP + 15000 XP)",
            "✨ New shop special: Aether Shard (+2800 ATK/DEF, +14000 HP permanent boost)",
            "🔧 Fixed guild_shops.json corruption (regenerated 100 items per guild)",
            "🔧 Added missing celestial_blessing handler to web dashboard buy route",
            "🔧 Web dashboard + JSON caches synced with all new content",
        ],
    },
    {
        "version": "v3.7",
        "date": "2026-06-27",
        "changes": [
            "🌌 New location: Astral Depths (Lv.27+) — cosmic void beyond dimensions with 4 monsters + Infinity, The Primordial boss",
            "🗡️ New shop weapons: Astral Blade (+1400 ATK), Stellar Talon (+1600 ATK)",
            "🛡️ New shop armor: Voidweave Aegis (+1250 DEF), Astral Plate (+1450 DEF)",
            "🧪 New shop potions: Cosmic Convergence (10000 HP + 10000 XP), Elixir of Infinity (25000 XP + full heal)",
            "✨ New shop specials: Infinity Fragment (+1800 ATK/DEF, +7500 HP), Cosmic Seed (+2200 ATK/DEF, +10000 HP)",
            "🔧 Web-only: Role system, Duel system, Player profiles, Enhanced leaderboard",
            "🔧 Web dashboard + JSON caches synced with all new content",
        ],
    },
    {
        "version": "v3.6",
        "date": "2026-06-27",
        "changes": [
            "🌌 New location: Astral Depths (Lv.27+) — cosmic void beyond dimensions with 4 monsters + Infinity, The Primordial boss",
            "🗡️ New shop weapons: Astral Blade (+1400 ATK), Stellar Talon (+1600 ATK)",
            "🛡️ New shop armor: Voidweave Aegis (+1250 DEF), Astral Plate (+1450 DEF)",
            "🧪 New shop potions: Cosmic Convergence (10000 HP + 10000 XP), Elixir of Infinity (25000 XP + full heal)",
            "✨ New shop specials: Infinity Fragment (+1800 ATK/DEF, +7500 HP), Cosmic Seed (+2200 ATK/DEF, +10000 HP)",
            "🔧 Web dashboard + JSON caches synced with all new content",
        ],
    },
    {
        "version": "v3.5",
        "date": "2026-06-26",
        "changes": [
            "🌊 New location: Abyssal Trench (Lv.26+) — deepest ocean abyss with 4 monsters + The Scarred One boss",
            "🗡️ New shop weapon: Stormsplitter Blade (+1200 ATK)",
            "🛡️ New shop armor: Tidalwave Barrier (+1100 DEF)",
            "🧪 New shop potion: Phantom Tide (20000 XP + full heal)",
            "👑 New shop special: Indigo Monarch's Crown (+1500 ATK/DEF, +6000 HP permanent boost)",
            "🔧 Web dashboard + JSON caches synced with all new content",
        ],
    },
    {
        "version": "v3.4",
        "date": "2026-06-25",
        "changes": [
            "🏔️ New location: Glacial Citadel (Lv.25+) — ancient ice fortress with 4 monsters + Aurora, The Eternal Winter boss",
            "🗡️ New shop weapons: Glacial Blade (+950 ATK), Frostbite Staff (+1050 ATK)",
            "🛡️ New shop armor: Frostweave Cloak (+820 DEF), Aurora Aegis (+950 DEF)",
            "🧪 New shop potions: Frostfire Mixture (7000 HP + 7000 XP), Elixir of the Aurora (15000 XP)",
            "✨ New shop specials: Crystal of Eternal Frost (+1100 ATK/DEF, +4000 HP), Northern Star (+1300 ATK/DEF, +5000 HP)",
            "🔧 Web dashboard + JSON caches synced with all new content",
        ],
    },
    {
        "version": "v3.3",
        "date": "2026-06-24",
        "changes": [
            "🏜️ New location: Sunscorched Wastes (Lv.24+) — scorching desert with 4 monsters + Solarius, The Undying Sun boss",
            "🔥 New shop weapon: Scorching Mirage (+820 ATK)",
            "🛡️ New shop armor: Sunforged Plate (+700 DEF)",
            "🍼 New shop potion: Mirage Flask (5000 HP + 5000 XP)",
            "💠 New shop special: Solar Prism (+900 ATK/DEF, +3000 HP permanent boost)",
            "💰 Shop data synced: guild_shops.json updated with all new items and previous missing entries",
        ],
    },
    {
        "version": "v3.2",
        "date": "2026-06-23",
        "changes": [
            "🌙 New location: Moonlit Sanctum (Lv.22+) — celestial temple with 4 lunar monsters + Selene, Moon Goddess boss",
            "🌿 New location: Overgrown Ruins (Lv.23+) — ancient ruins reclaimed by nature with 4 monsters + Gaia, Primal Colossus boss",
            "🗡️ New shop weapons: Gaia's Wrath (+650 ATK), Eclipse Blade (+720 ATK)",
            "🛡️ New shop armor: Gaia's Bark (+520 DEF), Eclipse Aegis (+600 DEF)",
            "🧪 New potions: Nectar of the Gods (3000 HP heal), Elixir of Eternity (10000 XP + full heal)",
            "✨ New shop specials: Gaia's Heart (+600 ATK/DEF, +1500 HP), Eclipse Core (+750 ATK/DEF, +2000 HP)",
            "🔧 Fixed corrupt changelog entry in ADVENTURE_LOCATIONS array",
            "🔧 Web shop synced: all new items added to web dashboard buy handlers",
        ],
    },
    {
        "version": "v3.1",
        "date": "2026-06-22",
        "changes": [
            "🌙 New location: Moonlit Sanctum (Lv.22+) — a celestial temple bathed in eternal moonlight with 4 monsters + boss",
            "🌋 Volcanic Caverns expanded: +2 new monsters (Obsidian Golem & Pyroclasm Elemental)",
            "🗡️ New shop items: Lunar Crescent (mythic sword, +580 ATK), Moonweave Robes (mythic armor, +440 DEF)",
            "✨ New shop special: Moonstone Aegis (+500 ATK/DEF, +1250 HP permanent boost)",
            "🔧 Web dashboard synced: all new items and locations added to web data",
        ],
    },
    {
        "version": "v3.0",
        "date": "2026-06-21",
        "changes": [
            "🌋 New location: Molten Core (Lv.21+) — the heart of the world with fire titans and the Ignis boss",
            "🗡️ New shop items: Ember Fang (mythic sword, +500 ATK), Molten Plate (mythic armor, +370 DEF)",
            "✨ New shop special: Flame of Eternity (+400 ATK/DEF, +1000 HP permanent boost)",
            "🔧 Fixed adventure_locations.json cache corruption (changelog entry leaked into data)",
            "🔧 Web shop synced: all new items added to web dashboard",
        ],
    },
    {
        "version": "v2.0",
        "date": "2026-06-11",
        "changes": [
            "🎵 Full music system (play, pause, skip, queue, volume, loop, shuffle)",
            "🛡️ Auto-mod (bad words, spam, caps, links, mentions)",
            "🎫 Ticket system (>ticket, >close, >add, >remove)",
            "👋 Welcome/Leave messages with custom channel",
            "🎮 Games (roll, coinflip, 8ball, rps, trivia, guess, hack)",
            "📊 Centralized logging to #hermes-logs",
            "🔄 Self-upgrade via git pull + restart",
            "🌐 Web Dashboard — Play in browser at port 8081",
            "📰 >latestnews command for changelog",
            "🖥️ System status monitoring",
            "🔒 Server-locked, no DMs allowed",
            "📝 >purge, >poll, >remind, >say, >avatar commands",
        ]
    },
    {
        "version": "v2.1",
        "date": "2026-06-12",
        "changes": [
            "🌊 New location: Sunken Depths (Lv.8+) — underwater dungeon with 4 monsters + boss",
            "🌲 Dark Forest expanded: +2 new monsters (Bandit & Mushroom Sprite)",
            "🗡️ New shop items: Obsidian Katana, Titanium Armor, Mega Elixir, Gravity Well",
            "🎣 New >fish command — fishing mini-game with 15+ catches (common to legendary)",
            "🌐 Web dashboard: new Daily Heal button, improved inventory UX",
        ]
    },
    {
        "version": "v2.2",
        "date": "2026-06-13",
        "changes": [
            "🌅 New location: Celestial Spire (Lv.12+) — floating tower above the clouds with 4 monsters + boss",
            "🌲 Dark Forest expanded: +2 new monsters (Vampire Bat & Thorn Beast)",
            "🗡️ New shop items: Stormbreaker (legendary sword), Celestial Aegis (legendary armor), Elixir of Power",
            "🔄 Web dashboard synced with bot data — all locations and shop items match",
        ]
    },
    {
        "version": "v2.3",
        "date": "2026-06-14",
        "changes": [
            "🌸 New location: Enchanted Garden (Lv.3+) — magical garden with mystical creatures and 4 monsters + boss",
            "🏔️ Frozen Mountains expanded: +2 new monsters (Avalanche Yeti & Crystal Golem)",
            "🗡️ New shop items: Phoenix Blade (legendary weapon), Mystic Robes (epic armor), Time Warp Potion, Enchanted Lure",
            "🐟 New >fishlb command — fishing leaderboard to see top anglers",
            "🌐 Web dashboard: new Enchanted Garden location, updated shop with new categories",
        ]
    },
    {
        "version": "v2.4",
        "date": "2026-06-15",
        "changes": [
            "💀 New location: Cursed Catacombs (Lv.17+) — ancient underground tomb with undead horrors and 4 monsters + boss",
            "🌋 Volcanic Caverns expanded: +2 new monsters (Magma Titan & Inferno Wraith)",
            "🗡️ New shop items: Doomhammer (legendary maul), Abyssal Cloak (legendary armor), Soul Gem (special)",
            "🏆 New >achievements command — track milestones like monster kills, boss slays, and levelups",
            "🆕 New players now start with a Wooden Sword instead of nothing",
            "🌐 Web dashboard: new Catacombs location, achievements section on dashboard, updated shop",
        ],
    },
    {
        "version": "v2.5",
        "date": "2026-06-16",
        "changes": [
            "🌪️ New location: Storm Peaks (Lv.14+) — treacherous mountain peaks battered by eternal storms with 4 monsters + boss",
            "🌊 Sunken Depths expanded: +2 new monsters (Abyssal Serpent & Coral Guardian)",
            "🏔️ Frozen Mountains expanded: +2 new monsters (Blizzard Wolf & Frozen Wraith)",
            "🗡️ New shop items: Tempest Fury (legendary sword), Storm Shield (legendary armor), Elixir of Fortune",
            "🎣 New >fishstats command — view your personal fishing statistics",
            "🔧 Web shop synced: added missing Doomhammer, Abyssal Cloak, and Soul Gem to web shop data",
            "🌐 Web dashboard: new Storm Peaks location, updated shop with new items",
        ]
    },
    {
        "version": "v2.6",
        "date": "2026-06-17",
        "changes": [
            "🌫️ New location: Twilight Marsh (Lv.16+) — haunted swamp with will-o'-wisps and 4 monsters + boss",
            "🌌 The Void expanded: +2 new monsters (Abyssal Horror & All-Seeing Eye)",
            "🗡️ New shop items: Void Reaper (mythic sword), Eternal Flame (mythic sword), Void Plate (mythic armor), Eternal Aegis (mythic armor)",
            "✨ New shop specials: Dragon Heart, Celestial Blessing — powerful permanent stat boosts",
            "🌐 Web dashboard: new Twilight Marsh location, updated shop with mythic-tier items",
        ]
    },
    {
        "version": "v2.7",
        "date": "2026-06-18",
        "changes": [
            "💎 New location: Crystal Caverns (Lv.18+) — dazzling underground crystal labyrinth with 4 monsters + boss",
            "🌸 Enchanted Garden expanded: +2 new monsters (Crystal Chameleon & Pollen Drifter)",
            "🗡️ New shop items: Prismatic Blade (legendary sword), Crystal Staff (legendary weapon), Prismatic Shield (legendary armor), Crystal Plate (legendary armor)",
            "🧪 New potions: Crystal Elixir (1000 HP heal), Elixir of the Gods (2500 XP boost)",
            "✨ New shop specials: Crystal Core (+60 ATK/DEF, +150 HP), Essence of Eternity (+100 ATK/DEF, +250 HP)",
            "📊 New >serverstats command — view server member count, channels, roles, and boost info",
            "🌐 Web dashboard: new Crystal Caverns location, updated shop with all new items",
        ]
    },
    {
        "version": "v2.8",
        "date": "2026-06-19",
        "changes": [
            "🔥 New location: Abyssal Rift (Lv.20+) — a scorching dimension between worlds with 6 monsters + boss",
            "🌲 Dark Forest expanded: +2 new monsters (Shadow Fox & Dark Sprite)",
            "🌌 The Void expanded: +2 new monsters (Void Leviathan & Soul Devourer)",
            "🗡️ New shop items: Abyssal Blade, Soul Reaper (weapons), Abyssal Armor, Soul Guard (armor)",
            "🧪 New potions: Abyssal Brew (2000 HP heal), Soul Elixir (5000 XP + full heal)",
            "✨ New shop specials: Abyssal Heart, Soul Stone — powerful permanent stat boosts",
            "⚔️ New >duel command — challenge another player to a PvP duel!",
            "🔧 Web shop synced: added all missing items (Crystal Core, Essence of Eternity, Dragon Heart, Celestial Blessing, Prismatic Blade/Shield, Crystal Staff/Plate)",
        ]
    },
]

# ═══════════════════════════════════════════════════════════════
# BOT SETUP
# ═══════════════════════════════════════════════════════════════

intents = discord.Intents.default()
intents.message_content = True
intents.members = True
intents.voice_states = True
intents.guilds = True
intents.guild_scheduled_events = False
intents.presences = False
intents.auto_moderation = False
intents.integrations = False
intents.webhooks = False
intents.invites = False
intents.moderation = False

bot = commands.Bot(command_prefix=">", intents=intents, help_command=None)
bot.start_time = time.time()

# ═══════════════════════════════════════════════════════════════
# PER-GUILD ANNOUNCEMENT CHANNELS — /advannoucement + /setchannel
# ═══════════════════════════════════════════════════════════════

ANN_FILE = DATA_DIR / "announce_channels.json"   # {guild_id: channel_id}
HOME_UPDATES_CHANNEL_ID = 1531265353949253742    # home "updates" channel

def load_announce_channels():
    try:
        return json.loads(ANN_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}

def save_announce_channels(data):
    tmp = ANN_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    tmp.replace(ANN_FILE)

def check_announce_channel_perms(channel):
    """Return error string if the bot can't use the channel, else None."""
    if not isinstance(channel, discord.TextChannel):
        return "channel must be a text channel"
    perms = channel.permissions_for(channel.guild.me)
    missing = []
    if not perms.view_channel:
        missing.append("View Channel")
    if not perms.send_messages:
        missing.append("Send Messages")
    if not perms.embed_links:
        missing.append("Embed Links")
    return ("bot is missing: " + ", ".join(missing)) if missing else None

async def broadcast_announcement(text: str, title: str = "📢 DTEmpire Update"):
    """Post an update embed to the home updates channel + every guild's announcement channel."""
    sent = []
    embed = discord.Embed(title=title, description=text[:4000], color=discord.Color.gold(),
                          timestamp=datetime.datetime.utcnow())
    embed.set_footer(text="⚔️ DTEmpire Adventure · By Hermes")
    home = bot.get_channel(HOME_UPDATES_CHANNEL_ID)
    if home:
        try:
            await home.send(embed=embed)
            sent.append(f"home #{home.name}")
        except Exception as e:
            logger.error(f"Home announcement send failed: {e}")
    for gid, cid in load_announce_channels().items():
        ch = bot.get_channel(int(cid))
        if not ch:
            continue
        try:
            await ch.send(embed=embed)
            sent.append(f"{ch.guild.name} #{ch.name}")
        except Exception as e:
            logger.error(f"Announcement to guild {gid} failed: {e}")
    return sent
bot.home_guild_id = HOME_GUILD_ID
bot.log_channel_id = LOG_CHANNEL_ID

@bot.event
async def on_connect():
    """Load cogs on first connect."""
    if not getattr(bot, '_cogs_loaded', False):
        await load_extensions()
        bot._cogs_loaded = True

# Auto-mod state
automod_config = {
    "bad_words": ["fuck", "shit", "bitch", "asshole", "damn", "bastard", "dick", "pussy", "cunt", "nigger", "nigga", "faggot"],
    "max_caps_percent": 70,
    "max_mentions": 5,
    "max_spam_messages": 5,
    "max_spam_seconds": 10,
    "block_invites": True,
    "block_links": False,
    "enabled": True,
}
user_message_times = defaultdict(list)  # user_id -> [timestamps]

# Ticket state
ticket_counter = 0
active_tickets = {}  # channel_id -> {"user_id": int, "ticket_num": int}

# Welcome config
welcome_channel_id = 0
leave_channel_id = 0

# ═══════════════════════════════════════════════════════════════
# CENTRALIZED LOGGING — Everything goes to LOG_CHANNEL_ID
# ═══════════════════════════════════════════════════════════════

async def log_event(title: str, description: str, color: discord.Color, fields: dict = None,
                    source_guild: str = None, source_channel: str = None, source_user: str = None):
    """Send a rich embed log to the central logging channel."""
    log_ch = bot.get_channel(LOG_CHANNEL_ID)
    if not log_ch:
        return

    embed = discord.Embed(
        title=title,
        description=description[:2048],
        color=color,
        timestamp=datetime.datetime.utcnow()
    )

    if source_guild:
        embed.add_field(name="Server", value=source_guild, inline=True)
    if source_channel:
        embed.add_field(name="Channel", value=f"#{source_channel}", inline=True)
    if source_user:
        embed.add_field(name="User", value=source_user, inline=True)
    if fields:
        for k, v in fields.items():
            embed.add_field(name=k, value=str(v)[:1024], inline=True)

    try:
        await log_ch.send(embed=embed)
    except Exception as e:
        logger.error(f"Log send failed: {e}")

# ═══════════════════════════════════════════════════════════════
# SERVER LOCK + DM BLOCK
# ═══════════════════════════════════════════════════════════════

@bot.check
async def server_only(ctx):
    """Block ALL DMs. Prefix commands work in any guild."""
    return ctx.guild is not None

@bot.event
async def on_ready():
    logger.info(f"✅ HermesBot online: {bot.user} (ID: {bot.user.id})")
    logger.info(f"🏠 Home guild: {bot.home_guild_id}")
    logger.info(f"📡 Guilds: {len(bot.guilds)}")

    if not bot.home_guild_id and bot.guilds:
        bot.home_guild_id = bot.guilds[0].id
        logger.info(f"Auto-set home guild: {bot.home_guild_id}")

    # Start background tasks
    for task_loop in [watchdog_loop, self_upgrade_check, status_rotate]:
        if not task_loop.is_running():
            task_loop.start()
    # New-player watcher (fires repeatedly; guard against reconnects)
    if not getattr(bot, "_np_watcher_started", False):
        bot._np_watcher_started = True
        bot.loop.create_task(check_new_players())

    # Online notification
    await log_event(
        "🟢 HermesBot Online",
        f"Bot `{bot.user}` is ready!",
        discord.Color.green(),
        fields={"Latency": f"{round(bot.latency*1000)}ms", "Guilds": str(len(bot.guilds))},
        source_guild=bot.guilds[0].name if bot.guilds else "N/A",
        source_channel="system",
        source_user="HermesBot"
    )

    # Sync slash commands per guild so /advannoucement & /setchannel appear instantly
    for g in bot.guilds:
        try:
            await bot.tree.sync(guild=g)
        except Exception as e:
            logger.warning(f"tree.sync failed for {g.name}: {e}")
    logger.info(f"Synced slash commands for {len(bot.guilds)} guild(s)")

    # CLI announce mode: broadcast once, then exit
    if CLI_MODE and CLI_MODE[0] == "announce":
        logger.info("CLI announce mode — broadcasting once, then exiting")
        try:
            sent = await broadcast_announcement(CLI_MODE[1], CLI_MODE[2])
            print("ANNOUNCED_TO=" + (", ".join(sent) if sent else "NOWHERE"))
        except Exception as e:
            logger.error(f"CLI announce failed: {e}")
            print(f"ANNOUNCE_ERROR={e}")
        finally:
            await bot.close()

@bot.event
async def on_message(message):
    # Block ALL DMs
    if message.guild is None:
        return
    # Ignore bots
    if message.author.bot:
        return

    # Auto-mod only in home guild
    if automod_config["enabled"] and (not bot.home_guild_id or message.guild.id == bot.home_guild_id):
        await check_automod(message)

    await bot.process_commands(message)

async def check_automod(message):
    """Run auto-mod checks on a message."""
    content = message.content
    deleted = False

    # Bad words
    for word in automod_config["bad_words"]:
        if re.search(rf'\b{re.escape(word)}\b', content, re.IGNORECASE):
            try:
                await message.delete()
                deleted = True
                await message.channel.send(
                    f"⚠️ {message.author.mention} Watch your language!",
                    delete_after=5
                )
            except:
                pass
            await log_event(
                "🛡️ Auto-Mod: Bad Word",
                f"Message deleted from {message.author.mention}",
                discord.Color.red(),
                fields={"Content": content[:200], "Word": word},
                source_guild=message.guild.name,
                source_channel=message.channel.name,
                source_user=str(message.author)
            )
            return

    # Caps check
    if len(content) > 10:
        caps_count = sum(1 for c in content if c.isupper())
        caps_percent = (caps_count / len(content)) * 100
        if caps_percent > automod_config["max_caps_percent"]:
            try:
                await message.delete()
                deleted = True
                await message.channel.send(
                    f"⚠️ {message.author.mention} Too many caps!",
                    delete_after=5
                )
            except:
                pass
            await log_event(
                "🛡️ Auto-Mod: Caps",
                f"Excessive caps detected ({caps_percent:.0f}%)",
                discord.Color.orange(),
                fields={"Content": content[:200]},
                source_guild=message.guild.name,
                source_channel=message.channel.name,
                source_user=str(message.author)
            )
            return

    # Mention spam
    if len(message.mentions) > automod_config["max_mentions"]:
        try:
            await message.delete()
            deleted = True
            await message.channel.send(
                f"⚠️ {message.author.mention} Too many mentions!",
                delete_after=5
            )
        except:
            pass
        await log_event(
            "🛡️ Auto-Mod: Mention Spam",
            f"Message with {len(message.mentions)} mentions deleted",
            discord.Color.red(),
            source_guild=message.guild.name,
            source_channel=message.channel.name,
            source_user=str(message.author)
        )
        return

    # Invite links
    if automod_config["block_invites"] and re.search(r'discord\.gg/\w+|discord\.com/invite/\w+', content):
        try:
            await message.delete()
            deleted = True
            await message.channel.send(
                f"⚠️ {message.author.mention} No invite links allowed!",
                delete_after=5
            )
        except:
            pass
        await log_event(
            "🛡️ Auto-Mod: Invite Link",
            f"Invite link deleted",
            discord.Color.red(),
            fields={"Content": content[:200]},
            source_guild=message.guild.name,
            source_channel=message.channel.name,
            source_user=str(message.author)
        )
        return

    # Spam detection
    now = time.time()
    uid = message.author.id
    user_message_times[uid].append(now)
    # Clean old
    user_message_times[uid] = [t for t in user_message_times[uid] if now - t < automod_config["max_spam_seconds"]]
    if len(user_message_times[uid]) > automod_config["max_spam_messages"]:
        try:
            await message.delete()
            await message.channel.send(
                f"⚠️ {message.author.mention} Stop spamming!",
                delete_after=5
            )
        except:
            pass
        await log_event(
            "🛡️ Auto-Mod: Spam",
            f"Spam detected ({len(user_message_times[uid])} msgs in {automod_config['max_spam_seconds']}s)",
            discord.Color.red(),
            source_guild=message.guild.name,
            source_channel=message.channel.name,
            source_user=str(message.author)
        )

# ═══════════════════════════════════════════════════════════════
# LOGGING EVENTS — Everything goes to central log channel
# ═══════════════════════════════════════════════════════════════

@bot.event
async def on_member_join(member):
    if bot.home_guild_id and member.guild.id != bot.home_guild_id:
        return
    await log_event(
        "📥 Member Joined",
        f"{member.mention} ({member}) joined the server",
        discord.Color.green(),
        fields={"Account Created": f"<t:{int(member.created_at.timestamp())}:R>", "ID": str(member.id)},
        source_guild=member.guild.name,
        source_channel="system",
        source_user=str(member)
    )
    # Welcome message
    if welcome_channel_id:
        ch = bot.get_channel(welcome_channel_id)
        if ch:
            embed = discord.Embed(
                title="👋 Welcome!",
                description=f"Welcome to **{member.guild.name}**, {member.mention}!\nYou are member #{member.guild.member_count}.",
                color=discord.Color.green(),
                timestamp=datetime.datetime.utcnow()
            )
            if member.avatar:
                embed.set_thumbnail(url=member.avatar.url)
            await ch.send(embed=embed)

@bot.event
async def on_member_remove(member):
    if bot.home_guild_id and member.guild.id != bot.home_guild_id:
        return
    await log_event(
        "📤 Member Left",
        f"{member} left the server",
        discord.Color.orange(),
        fields={"Joined": f"<t:{int(member.joined_at.timestamp())}:R>" if member.joined_at else "Unknown", "ID": str(member.id)},
        source_guild=member.guild.name,
        source_channel="system",
        source_user=str(member)
    )
    if leave_channel_id:
        ch = bot.get_channel(leave_channel_id)
        if ch:
            await ch.send(f"👋 **{member}** has left the server.")

@bot.event
async def on_message_delete(message):
    if message.guild is None or message.author.bot:
        return
    if bot.home_guild_id and message.guild.id != bot.home_guild_id:
        return
    await log_event(
        "🗑️ Message Deleted",
        message.content[:500] or "[No content / Embed]",
        discord.Color.dark_red(),
        fields={"Message ID": str(message.id)},
        source_guild=message.guild.name,
        source_channel=message.channel.name,
        source_user=str(message.author)
    )

@bot.event
async def on_message_edit(before, after):
    if before.guild is None or before.author.bot:
        return
    if bot.home_guild_id and before.guild.id != bot.home_guild_id:
        return
    if before.content == after.content:
        return
    await log_event(
        "✏️ Message Edited",
        f"[Jump to message]({after.jump_url})",
        discord.Color.gold(),
        fields={
            "Before": before.content[:300] or "[Empty]",
            "After": after.content[:300] or "[Empty]"
        },
        source_guild=before.guild.name,
        source_channel=before.channel.name,
        source_user=str(before.author)
    )

@bot.event
async def on_member_update(before, after):
    if bot.home_guild_id and before.guild.id != bot.home_guild_id:
        return
    # Nickname change
    if before.nick != after.nick:
        await log_event(
            "🏷️ Nickname Changed",
            f"**{before}** changed nickname",
            discord.Color.blue(),
            fields={"Before": before.nick or "None", "After": after.nick or "None"},
            source_guild=before.guild.name,
            source_channel="system",
            source_user=str(before)
        )
    # Role change
    if before.roles != after.roles:
        added = set(after.roles) - set(before.roles)
        removed = set(before.roles) - set(after.roles)
        if added:
            await log_event(
                "🟢 Role Added",
                f"Roles added to {after.mention}",
                discord.Color.green(),
                fields={"Roles": ", ".join(r.name for r in added)},
                source_guild=before.guild.name,
                source_channel="system",
                source_user=str(before)
            )
        if removed:
            await log_event(
                "🔴 Role Removed",
                f"Roles removed from {after.mention}",
                discord.Color.red(),
                fields={"Roles": ", ".join(r.name for r in removed)},
                source_guild=before.guild.name,
                source_channel="system",
                source_user=str(before)
            )

@bot.event
async def on_voice_state_update(member, before, after):
    if bot.home_guild_id and member.guild.id != bot.home_guild_id:
        return
    if before.channel != after.channel:
        if after.channel:
            await log_event(
                "🔊 Voice Join",
                f"{member.mention} joined **{after.channel.name}**",
                discord.Color.teal(),
                source_guild=member.guild.name,
                source_channel=after.channel.name,
                source_user=str(member)
            )
        elif before.channel:
            await log_event(
                "🔇 Voice Leave",
                f"{member.mention} left **{before.channel.name}**",
                discord.Color.dark_teal(),
                source_guild=member.guild.name,
                source_channel=before.channel.name,
                source_user=str(member)
            )

@bot.event
async def on_command_completion(ctx):
    await log_event(
        "⌨️ Command Used",
        f"`{ctx.message.content[:200]}`",
        discord.Color.purple(),
        source_guild=ctx.guild.name if ctx.guild else "DM",
        source_channel=ctx.channel.name if ctx.guild else "N/A",
        source_user=str(ctx.author)
    )

@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.CheckFailure):
        return  # Silently ignore
    if isinstance(error, commands.CommandNotFound):
        return
    logger.error(f"Command error: {error}")
    await log_event(
        "❌ Command Error",
        str(error),
        discord.Color.red(),
        fields={"Command": ctx.message.content[:100]},
        source_guild=ctx.guild.name if ctx.guild else "N/A",
        source_channel=ctx.channel.name if ctx.guild else "N/A",
        source_user=str(ctx.author)
    )

# ═══════════════════════════════════════════════════════════════
# BACKGROUND TASKS
# ═══════════════════════════════════════════════════════════════

@tasks.loop(minutes=5)
async def watchdog_loop():
    """Health check every 5 minutes."""
    latency = round(bot.latency * 1000)
    status = "healthy" if latency < 200 else "degraded" if latency < 500 else "critical"
    state = {
        "timestamp": time.time(), "latency_ms": latency,
        "status": status, "guilds": len(bot.guilds),
        "uptime_hours": round((time.time() - bot.start_time) / 3600, 2)
    }
    with open(DATA_DIR / "watchdog.json", "w") as f:
        json.dump(state, f, indent=2)
    if status == "critical":
        await log_event("⚠️ Watchdog Alert", f"Critical latency: {latency}ms", discord.Color.red())

@tasks.loop(hours=1)
async def self_upgrade_check():
    """Check git for updates and self-upgrade."""
    try:
        result = subprocess.run(["git", "pull"], capture_output=True, text=True, timeout=30, cwd=str(BASE_DIR))
        if result.returncode == 0 and "Already up to date" not in result.stdout:
            await log_event("🔄 Self-Upgrade", f"Updated from git. Restarting...\n```{result.stdout[:300]}```", discord.Color.blue())
            await bot.close()
            os.execv(sys.executable, [sys.executable] + sys.argv)
    except Exception as e:
        logger.error(f"Upgrade failed: {e}")

# ═══════════════════════════════════════════════════════════════
# DAILY STATUS — Changes each day + rotates within the day
# ═══════════════════════════════════════════════════════════════

# Day-of-week themed statuses (Monday=0 ... Sunday=6)
WEEKDAY_STATUSES = {
    0: [  # Monday
        "Watching over your Monday blues 🔮",
        "Hermes hates Mondays too 😤",
        "Starting the week like a god ⚡",
        "Monday mode: Activated 💪",
    ],
    1: [  # Tuesday
        "Tuesdays are for conquering 🏰",
        "Watching... and plotting 🦅",
        "Hermes sees all on Tuesday 👁️",
        "Grinding like it's Tuesday 🔥",
    ],
    2: [  # Wednesday
        "Halfway through the week 🐪",
        "Wednesday wisdom incoming 📜",
        "Hump day? More like god day ⚡",
        "Watching the realm from Mount Olympus 🏔️",
    ],
    3: [  # Thursday
        "Almost Friday... almost 🌙",
        "Thursday thoughts from Hermes 💭",
        "Watching mortals rush to weekend 😂",
        "One more day. Hermes is patient ⏳",
    ],
    4: [  # Friday
        "FRIDAY MODE: UNLEASHED 🎉",
        "Hermes approves this Friday 🍻",
        "Weekend loading... 99% 📶",
        "Watching you celebrate Friday 🎊",
    ],
    5: [  # Saturday
        "Even gods rest on Saturday 😴",
        "Watching your weekend adventures 🌴",
        "Saturday vibes only ✌️",
        "Hermes is off-duty (not really) 👀",
    ],
    6: [  # Sunday
        "Sunday scaries? Not on my watch 🛡️",
        "Watching the sunset over the realm 🌅",
        "Rest day. Hermes is meditating 🧘",
        "Preparing for Monday... already 😈",
    ],
}

# Extra rotating messages that appear randomly
BONUS_STATUSES = [
    ">help to summon my power 📖",
    "Messenger of the gods 🏛️",
    "Speed of Hermes, wit of Athena ⚡",
    "Your wish is my command 🪄",
    "Watching from the shadows 👁️",
    "Serving mere mortals since day one 😏",
    "I run on coffee and divine power ☕⚡",
    "The server is under my protection 🛡️",
    "Speak, and I shall listen 🗣️",
    "Hermes has entered the chat 💬",
    "Delivering messages across realms 🌐",
    "God of transitions... and Discord 🔄",
]

@tasks.loop(minutes=5)
async def status_rotate():
    """Change status every 5 minutes — daily theme + random bonus."""
    import random
    from datetime import datetime as dt

    # Pick day-themed status
    day = dt.utcnow().weekday()
    day_statuses = WEEKDAY_STATUSES.get(day, WEEKDAY_STATUSES[0])

    # 70% chance: day-themed, 30% chance: bonus
    if random.random() < 0.7:
        msg = random.choice(day_statuses)
    else:
        msg = random.choice(BONUS_STATUSES)

    activity_type = random.choice([
        discord.ActivityType.watching,
        discord.ActivityType.listening,
        discord.ActivityType.playing,
    ])

    await bot.change_presence(activity=discord.Activity(type=activity_type, name=msg))

for loop_task in [watchdog_loop, self_upgrade_check, status_rotate]:
    @loop_task.before_loop
    async def _wait():
        await bot.wait_until_ready()

# ═══════════════════════════════════════════════════════════════
# GENERAL COMMANDS
# ═══════════════════════════════════════════════════════════════

@bot.command(name="ping")
async def ping(ctx):
    """Check bot latency."""
    await ctx.send(f"🏓 Pong! `{round(bot.latency*1000)}ms`")

@bot.command(name="uptime")
async def uptime_cmd(ctx):
    """Show bot uptime."""
    s = int(time.time() - bot.start_time)
    h, r = divmod(s, 3600)
    m, s = divmod(r, 60)
    d, h = divmod(h, 24)
    parts = [f"{x}{u}" for x, u in [(d,"d"),(h,"h"),(m,"m"),(s,"s")] if x]
    await ctx.send(f"⏱️ Uptime: `{' '.join(parts)}`")

@bot.command(name="status")
async def status_cmd(ctx):
    """Show bot status."""
    try:
        with open(DATA_DIR / "watchdog.json") as f:
            state = json.load(f)
    except:
        state = {"status": "unknown", "latency_ms": 0, "uptime_hours": 0, "guilds": 0}

    embed = discord.Embed(title="📊 HermesBot Status", color=discord.Color.blue(), timestamp=datetime.datetime.utcnow())
    embed.add_field(name="Status", value=state["status"].upper(), inline=True)
    embed.add_field(name="Latency", value=f"{state['latency_ms']}ms", inline=True)
    embed.add_field(name="Uptime", value=f"{state['uptime_hours']}h", inline=True)
    embed.add_field(name="Servers", value=str(state["guilds"]), inline=True)
    embed.add_field(name="Discord.py", value=discord.__version__, inline=True)
    embed.add_field(name="Prefix", value="`>`", inline=True)
    await ctx.send(embed=embed)

# ── ADVENTURE GAME COMMANDS (ported from discord_bot.py) ──
def xp_for_level(level):
    return int(100 * (1.35 ** (level - 1)))

def get_level(player):
    xp = player.get("xp", 0); lv = 1
    while True:
        needed = xp_for_level(lv)
        if xp >= needed: xp -= needed; lv += 1
        else: return lv

RARITY_EMOJIS = {"common":"⬜","uncommon":"🟩","rare":"🟦","epic":"🟪","legendary":"🟧"}

def _save_player_d(player, guild_id, user_id):
    data = load_players()
    data[f"{guild_id}_{user_id}"] = player
    save_players(data)

@bot.command(name="daily")
async def daily(ctx):
    """Claim daily reward!"""
    player = get_player(HOME_GUILD_ID, ctx.author.id)
    if not player:
        await ctx.send("❌ Register on the website!"); return
    now = time.time()
    last = player.get("last_daily", 0)
    if now - last < 86400:
        remain = int(86400 - (now - last))
        await ctx.send(f"⏳ Come back in **{remain//3600}h {(remain%3600)//60}m**"); return
    reward = random.randint(50, 200)
    player["coins"] = player.get("coins", 0) + reward
    player["last_daily"] = now
    _save_player_d(player, HOME_GUILD_ID, ctx.author.id)
    await ctx.send(f"🎁 **Daily:** 🪙+{reward} coins!")

@bot.command(name="heal")
async def heal(ctx):
    """Heal your character."""
    player = get_player(HOME_GUILD_ID, ctx.author.id)
    if not player:
        await ctx.send("❌ Register first!"); return
    cost = max(5, int((player.get("max_hp", 100) - player.get("hp", 0)) * 0.5))
    if player.get("coins", 0) < cost:
        await ctx.send(f"❌ Need {cost} coins"); return
    old = player.get("hp", 0)
    player["coins"] -= cost
    player["hp"] = player.get("max_hp", 100)
    _save_player_d(player, HOME_GUILD_ID, ctx.author.id)
    await ctx.send(f"💚 **Healed!** ❤️ {old}→{player['hp']} (🪙-{cost})")

@bot.command(name="fishlb")
async def fishlb(ctx):
    """Coin leaderboard."""
    data = load_players()
    scores = []
    for key, p in data.items():
        uid = key.split("_")[-1]
        scores.append((p.get("coins", 0), p.get("username", uid[:8])))
    scores.sort(reverse=True)
    embed = discord.Embed(title="🏆 Coin Leaderboard", color=discord.Color.gold())
    medals = ["🥇","🥈","🥉","","","","","","",""]
    for i, (coins, name) in enumerate(scores[:10]):
        embed.add_field(name=f"{medals[i]} {name}", value=f"🪙 {coins}", inline=False)
    await ctx.send(embed=embed)

@bot.command(name="fishstats")
async def fishstats(ctx):
    """Your adventure stats."""
    player = get_player(HOME_GUILD_ID, ctx.author.id)
    if not player:
        await ctx.send("❌ No profile!"); return
    lv = get_level(player)
    embed = discord.Embed(title=f"📊 {ctx.author.display_name}", color=discord.Color.blue())
    for n, v in [("Level", lv), ("Coins", player.get("coins",0)), ("Tower", player.get("tower_floor",1)),
                 ("Pets", len(player.get("pets",[]))), ("Skills", len(player.get("skills",{}))),
                 ("W/L", f'{player.get("total_wins",0)}/{player.get("total_losses",0)}')]:
        embed.add_field(name=n, value=v, inline=True)
    await ctx.send(embed=embed)

@bot.command(name="duel")
async def duel(ctx, member: discord.Member = None):
    """Duel another player!"""
    if not member or member == ctx.author:
        await ctx.send("⚠️ `!duel @user`"); return
    p1, p2 = get_player(HOME_GUILD_ID, ctx.author.id), get_player(HOME_GUILD_ID, member.id)
    if not p1 or not p2:
        await ctx.send("❌ Both need profiles!"); return
    d1 = max(1, p1.get("atk",10) - p2.get("def",5)//2 + random.randint(-5,5))
    d2 = max(1, p2.get("atk",10) - p1.get("def",5)//2 + random.randint(-5,5))
    if d1 > d2:
        p1["coins"] += 10; p2["coins"] = max(0, p2.get("coins",0)-5)
        _save_player_d(p1, HOME_GUILD_ID, ctx.author.id); _save_player_d(p2, HOME_GUILD_ID, member.id)
        await ctx.send(f"⚔️ **{ctx.author.display_name}** beats **{member.display_name}**! 💥 {d1} vs {d2} 🪙+10")
    elif d2 > d1:
        p2["coins"] += 10; p1["coins"] = max(0, p1.get("coins",0)-5)
        _save_player_d(p1, HOME_GUILD_ID, ctx.author.id); _save_player_d(p2, HOME_GUILD_ID, member.id)
        await ctx.send(f"⚔️ **{member.display_name}** beats **{ctx.author.display_name}**! 💥 {d2} vs {d1} 🪙+10")
    else:
        await ctx.send(f"⚔️ **DRAW!** Both strike for {d1}!")

@bot.tree.command(name="profile", description="View your adventure profile")
async def profile(interaction: discord.Interaction):
    player = get_player(HOME_GUILD_ID, interaction.user.id)
    if not player:
        await interaction.response.send_message("❌ No profile!", ephemeral=True); return
    lv = get_level(player)
    embed = discord.Embed(title=f"🛡️ {interaction.user.display_name}", color=discord.Color.gold())
    for n, v in [("Level", lv), ("HP", f'{player.get("hp",0)}/{player.get("max_hp",100)}'),
                 ("ATK", player.get('atk',0)), ("DEF", player.get('def',0)), ("SPD", player.get('spd',0)),
                 ("Coins", player.get('coins',0)), ("Pets", len(player.get('pets',[]))),
                 ("Skills", len(player.get('skills',{})))]:
        embed.add_field(name=n, value=v, inline=True)
    pets = player.get("pets", [])
    if pets:
        embed.add_field(name="🐾 Pets", value=", ".join(f"{RARITY_EMOJIS.get(p,p)} {p.title()}" for p in pets), inline=False)
    await interaction.response.send_message(embed=embed)

@bot.tree.command(name="tower", description="Check tower progress")
async def tower(interaction: discord.Interaction):
    player = get_player(HOME_GUILD_ID, interaction.user.id)
    if not player:
        await interaction.response.send_message("❌ No profile!", ephemeral=True); return
    f, h, w, l = player.get("tower_floor",1), player.get("highest_floor",1), player.get("total_wins",0), player.get("total_losses",0)
    embed = discord.Embed(title="🏰 Tower of Trials", color=discord.Color.dark_gold())
    for n, v in [("Current", f"**{f}**"), ("Highest", f"**{h}**"), ("Level", get_level(player)),
                 ("Wins", w), ("Losses", l), ("Win Rate", f"{w/(w+l)*100:.0f}%" if w+l>0 else "N/A")]:
        embed.add_field(name=n, value=v, inline=True)
    await interaction.response.send_message(embed=embed)

@bot.tree.command(name="players", description="Show all adventurers")
async def players(interaction: discord.Interaction):
    data = load_players()
    gid = str(HOME_GUILD_ID)
    guild_data = {k: p for k, p in data.items() if k.startswith(f"{gid}_")}
    if not guild_data:
        await interaction.response.send_message("📭 No players yet."); return
    lines = []
    for key, p in guild_data.items():
        uid = key.split("_")[-1]
        lines.append(f"{p.get('username',uid[:8])} Lv.{get_level(p)} Floor {p.get('tower_floor',1)}")
    embed = discord.Embed(title=f"🌍 Adventurers ({len(guild_data)})", description="\n".join(lines[:20]), color=discord.Color.green())
    if len(guild_data) > 20: embed.set_footer(text=f"+ {len(guild_data)-20} more")
    await interaction.response.send_message(embed=embed)

# New player watcher: announce new adventurers to the guild channel
_known_players = set()

async def check_new_players():
    await bot.wait_until_ready()
    data = load_players()
    for key in data.keys():
        _known_players.add(key.split("_")[-1])
    while not bot.is_closed():
        await asyncio.sleep(60)
        try:
            data = load_players()
            channels = load_announce_channels()
            for key, p in data.items():
                uid = key.split("_")[-1]
                if uid in _known_players: continue
                _known_players.add(uid)
                gid = key.split("_")[0]
                cid = channels.get(str(gid)) or channels.get(gid)
                ch = bot.get_channel(int(cid)) if cid else None
                if ch:
                    await ch.send(f"🌍 **{p.get('username',uid[:8])}** started as {p.get('class_emoji','')} **{p.get('class_name','')}**!")
        except Exception as e:
            print(f"[check_new_players] tick failed: {e}")

@bot.command(name="latestnews")
async def latestnews(ctx):
    """Show the latest changelog / new features."""
    embed = discord.Embed(
        title="📰 HermesBot — Latest News",
        color=discord.Color.gold(),
        timestamp=datetime.datetime.utcnow()
    )
    for entry in CHANGELOG[:3]:
        changes = "\n".join(f"  {c}" for c in entry["changes"])
        embed.add_field(
            name=f"**{entry['version']}** — {entry['date']}",
            value=changes,
            inline=False
        )
    embed.set_footer(text="Use >help to see all commands")
    await ctx.send(embed=embed)

def build_help_embed():
    """Complete command reference — all real commands the bot has."""
    embed = discord.Embed(
        title="🤖 DTEmpire Adventurer — Command Help",
        description="**Prefix:** `>` for text commands · `/` for slash commands\nSame save as the web dashboard — play both!",
        color=discord.Color.gold(),
        timestamp=datetime.datetime.utcnow()
    )
    embed.add_field(name="⚔️ Adventure",
        value="Use the dedicated **DTEmpire Adventure** bot's `/adventure` command.\n"
              "All gameplay is on **adventure.ankitgupta.com.np**.",
        inline=False)
    embed.add_field(name="🎮 Games",
        value="`>roll [NdN]` `>coinflip` `>8ball <q>` `>rps` `>trivia` `>guess` `>hack [@user]`",
        inline=False)
    embed.add_field(name="📋 General",
        value="`>help [category]` `>ping` `>uptime` `>status` `>latestnews` `>serverinfo` `>serverstats` `>userinfo [@user]` `>avatar [@user]`",
        inline=False)
    embed.add_field(name="🎫 Tickets",
        value="`>ticket <subject>` `>close` `>add @user` `>remove @user`",
        inline=False)
    embed.add_field(name="🛡️ Auto-Mod",
        value="`>automod` — toggle, badwords, caps, mentions",
        inline=False)
    embed.add_field(name="🔧 Utility",
        value="`>poll` `>say` `>purge` `>announce` `>remind`",
        inline=False)
    embed.add_field(name="⚙️ Admin",
        value="`/advannoucement` `/setchannel` `>setwelcome` `>setleave`",
        inline=False)
    embed.add_field(name="🌐 Web Dashboard",
        value="Full game in browser — shop, dungeon, forging, PvP arena with retro music!\n**adventure.ankitgupta.com.np**",
        inline=False)
    embed.set_footer(text="DTEmpire Adventurer | Use >help <category> for details")
    return embed


async def adventure_help(ctx):
    """Detailed adventure & RPG guide."""
    embed = discord.Embed(
        title="⚔️ Adventure & RPG Guide",
        description="Your adventurer lives in the **DTEmpire realm** — same save in Discord and on the web dashboard.",
        color=discord.Color.gold(),
        timestamp=datetime.datetime.utcnow()
    )
    embed.add_field(name="🌐 Play Adventure",
        value="Use the dedicated Adventure bot's `/adventure` command, or open\n"
              "**adventure.ankitgupta.com.np**",
        inline=False)
    embed.add_field(name="🌐 Web Dashboard",
        value="**adventure.ankitgupta.com.np** — shop, equipment, forging, dungeons, PvP arena, quests & retro music!",
        inline=False)
    embed.set_footer(text="DTEmpire Adventurer | >help for all commands")
    await ctx.send(embed=embed)


@bot.tree.command(name="help", description="List all DTEmpire Adventure & bot commands")
async def slash_help(interaction: discord.Interaction):
    await interaction.response.send_message(embed=build_help_embed())


@bot.command(name="help")
async def help_cmd(ctx, category: str = None):
    """Show all available commands. Use >help [category] for details. Categories: general, games, adventure, tickets, automod, utility, admin"""
    
    # If user asks for adventure help specifically
    if category and category.lower() in ("adventure", "adv", "rpg"):
        return await adventure_help(ctx)
    
    if category and category.lower() not in ("general", "games", "tickets", "automod", "utility", "admin", "all", None):
        # Check if it's a known category
        return await ctx.send("❌ Unknown category. Use: `general`, `games`, `adventure`, `tickets`, `automod`, `utility`, `admin`")

    # Category-specific help
    if category and category.lower() == "general":
        embed = discord.Embed(title="📋 General Commands", color=discord.Color.blurple(), timestamp=datetime.datetime.utcnow())
        embed.add_field(name="`>help [category]`", value="Show help (categories: general, games, adventure, tickets, automod, utility, admin)", inline=False)
        embed.add_field(name="`>help adventure`", value="Detailed adventure & RPG guide", inline=False)
        embed.add_field(name="`>ping`", value="Check bot latency", inline=False)
        embed.add_field(name="`>uptime`", value="Show bot uptime", inline=False)
        embed.add_field(name="`>status`", value="Bot system status", inline=False)
        embed.add_field(name="`>serverinfo`", value="Server information", inline=False)
        embed.add_field(name="`>serverstats`", value="Server statistics — members, channels, roles", inline=False)
        embed.add_field(name="`>userinfo [@user]`", value="User information", inline=False)
        embed.add_field(name="`>avatar [@user]`", value="Show user avatar", inline=False)
        embed.add_field(name="`>latestnews`", value="Latest changelog", inline=False)
        embed.set_footer(text="HermesBot v2.0 | Everything is logged 🔒")
        return await ctx.send(embed=embed)

    if category and category.lower() == "games":
        embed = discord.Embed(title="🎮 Game Commands", color=discord.Color.blurple(), timestamp=datetime.datetime.utcnow())
        embed.add_field(name="`>roll [NdN]`", value="Roll dice (default: 1d20)", inline=False)
        embed.add_field(name="`>coinflip`", value="Flip a coin", inline=False)
        embed.add_field(name="`>8ball <question>`", value="Magic 8-ball", inline=False)
        embed.add_field(name="`>rps <rock|paper|scissors>`", value="Rock Paper Scissors", inline=False)
        embed.add_field(name="`>trivia`", value="Answer a trivia question", inline=False)
        embed.add_field(name="`>guess`", value="Guess a number 1-100", inline=False)
        embed.add_field(name="`>hack [@user]`", value="Fake hack (just for fun)", inline=False)
        embed.add_field(name="`>fish`", value="Go fishing! Catch fish, treasure, and legendary items (60s cooldown)", inline=False)
        embed.add_field(name="`>fishlb`", value="Fishing leaderboard — see top anglers", inline=False)
        embed.add_field(name="`>fishstats`", value="Your personal fishing statistics", inline=False)
        embed.add_field(name="`>duel @user`", value="Challenge another player to a PvP duel", inline=False)
        embed.set_footer(text="HermesBot v2.0 | Everything is logged 🔒")
        return await ctx.send(embed=embed)

    if category and category.lower() == "tickets":
        embed = discord.Embed(title="🎫 Ticket Commands", color=discord.Color.blurple(), timestamp=datetime.datetime.utcnow())
        embed.add_field(name="`>ticket <subject>`", value="Create a support ticket", inline=False)
        embed.add_field(name="`>close`", value="Close current ticket", inline=False)
        embed.add_field(name="`>add <@user>`", value="Add user to ticket", inline=False)
        embed.add_field(name="`>remove <@user>`", value="Remove user from ticket", inline=False)
        embed.set_footer(text="HermesBot v2.0 | Everything is logged 🔒")
        return await ctx.send(embed=embed)

    if category and category.lower() == "automod":
        embed = discord.Embed(title="🛡️ Auto-Mod Commands", color=discord.Color.blurple(), timestamp=datetime.datetime.utcnow())
        embed.add_field(name="`>automod`", value="Show auto-mod status", inline=False)
        embed.add_field(name="`>automod toggle`", value="Enable/disable auto-mod", inline=False)
        embed.add_field(name="`>automod badwords <add|remove> <word>`", value="Manage bad words list", inline=False)
        embed.add_field(name="`>automod caps <percent>`", value="Set max caps percentage", inline=False)
        embed.add_field(name="`>automod mentions <count>`", value="Set max mentions per message", inline=False)
        embed.set_footer(text="HermesBot v2.0 | Everything is logged 🔒")
        return await ctx.send(embed=embed)

    if category and category.lower() == "utility":
        embed = discord.Embed(title="🔧 Utility Commands", color=discord.Color.blurple(), timestamp=datetime.datetime.utcnow())
        embed.add_field(name="`>poll <question>`", value="Create a poll", inline=False)
        embed.add_field(name="`>say <message>`", value="Make the bot say something", inline=False)
        embed.add_field(name="`>purge <count>`", value="Delete messages (max 100)", inline=False)
        embed.add_field(name="`>announce <message>`", value="Send announcement (manage_messages)", inline=False)
        embed.add_field(name="`>remind <time> <msg>`", value="Set reminder (e.g., 10s, 5m, 1h, 1d)", inline=False)
        embed.set_footer(text="HermesBot v2.0 | Everything is logged 🔒")
        return await ctx.send(embed=embed)

    if category and category.lower() == "admin":
        embed = discord.Embed(title="⚙️ Admin Commands", color=discord.Color.blurple(), timestamp=datetime.datetime.utcnow())
        embed.add_field(name="`>upgrade`", value="Git pull + restart (owner only)", inline=False)
        embed.add_field(name="`>restart`", value="Restart bot (owner only)", inline=False)
        embed.add_field(name="`>logs [lines]`", value="View bot logs (owner only)", inline=False)
        embed.add_field(name="`>setwelcome <#channel>`", value="Set welcome channel", inline=False)
        embed.add_field(name="`>setleave <#channel>`", value="Set leave channel", inline=False)
        embed.add_field(name="`>eval <code>`", value="Evaluate Python (owner only)", inline=False)
        embed.set_footer(text="HermesBot v2.0 | Everything is logged 🔒")
        return await ctx.send(embed=embed)

    # Default: show all commands (main help)
    await ctx.send(embed=build_help_embed())

@bot.command(name="serverinfo")
async def serverinfo(ctx):
    g = ctx.guild
    embed = discord.Embed(title=f"📊 {g.name}", color=discord.Color.blue(), timestamp=datetime.datetime.utcnow())
    if g.icon: embed.set_thumbnail(url=g.icon.url)
    embed.add_field(name="Owner", value=str(g.owner), inline=True)
    embed.add_field(name="Members", value=str(g.member_count), inline=True)
    embed.add_field(name="Channels", value=f"{len(g.text_channels)}💬 {len(g.voice_channels)}🔊", inline=True)
    embed.add_field(name="Roles", value=str(len(g.roles)), inline=True)
    embed.add_field(name="Created", value=f"<t:{int(g.created_at.timestamp())}:R>", inline=True)
    embed.add_field(name="Boosts", value=f"Level {g.premium_tier} ({g.premium_subscription_count})", inline=True)
    await ctx.send(embed=embed)

@bot.command(name="userinfo")
async def userinfo(ctx, member: discord.Member = None):
    member = member or ctx.author
    embed = discord.Embed(title=f"👤 {member}", color=member.color, timestamp=datetime.datetime.utcnow())
    if member.avatar: embed.set_thumbnail(url=member.avatar.url)
    embed.add_field(name="ID", value=member.id, inline=True)
    embed.add_field(name="Bot", value="Yes" if member.bot else "No", inline=True)
    embed.add_field(name="Joined", value=f"<t:{int(member.joined_at.timestamp())}:R>", inline=True)
    embed.add_field(name="Created", value=f"<t:{int(member.created_at.timestamp())}:R>", inline=True)
    roles = ", ".join(r.mention for r in member.roles[1:][:10])
    embed.add_field(name=f"Roles ({len(member.roles)-1})", value=roles or "None", inline=False)
    await ctx.send(embed=embed)

@bot.command(name="avatar")
async def avatar(ctx, member: discord.Member = None):
    member = member or ctx.author
    embed = discord.Embed(title=f"{member}'s Avatar", color=discord.Color.blue())
    if member.avatar: embed.set_image(url=member.avatar.url)
    await ctx.send(embed=embed)

@bot.command(name="serverstats")
async def serverstats(ctx):
    """Show server statistics — member count, channels, roles, and activity."""
    g = ctx.guild
    total_members = g.member_count or 0
    online = sum(1 for m in g.members if m.status != discord.Status.offline)
    offline = total_members - online
    text_ch = len(g.text_channels)
    voice_ch = len(g.voice_channels)
    total_ch = text_ch + voice_ch
    roles_count = len(g.roles) - 1  # exclude @everyone
    admins = sum(1 for m in g.members if m.guild_permissions.administrator and not m.bot)
    bots = sum(1 for m in g.members if m.bot)
    humans = total_members - bots
    boost_level = g.premium_tier
    boosts = g.premium_subscription_count or 0
    created = f"<t:{int(g.created_at.timestamp())}:R>"

    embed = discord.Embed(
        title=f"📊 {g.name} — Server Stats",
        color=discord.Color.blue(),
        timestamp=datetime.datetime.utcnow()
    )
    if g.icon:
        embed.set_thumbnail(url=g.icon.url)
    embed.add_field(name="👥 Members", value=f"**{total_members}** total\n🟢 {online} online\n⚫ {offline} offline\n👤 {humans} humans\n🤖 {bots} bots", inline=True)
    embed.add_field(name="💬 Channels", value=f"**{total_ch}** total\n💬 {text_ch} text\n🔊 {voice_ch} voice", inline=True)
    embed.add_field(name="🏷️ Roles", value=f"**{roles_count}** roles\n🛡️ {admins} admins\n👑 Boost Lvl {boost_level} ({boosts} boosts)", inline=True)
    embed.add_field(name="📅 Created", value=created, inline=True)
    embed.add_field(name="🆔 Server ID", value=str(g.id), inline=True)
    embed.set_footer(text="HermesBot Server Stats")
    await ctx.send(embed=embed)

@bot.command(name="say")
async def say(ctx, *, message: str):
    await ctx.send(message)
    try: await ctx.message.delete()
    except: pass

@bot.command(name="poll")
async def poll(ctx, *, question: str):
    embed = discord.Embed(title="📊 Poll", description=question, color=discord.Color.blue(), timestamp=datetime.datetime.utcnow())
    embed.set_footer(text=f"By {ctx.author}")
    msg = await ctx.send(embed=embed)
    for r in ["👍", "👎", "🤷"]:
        await msg.add_reaction(r)

@bot.command(name="announce")
@commands.has_permissions(manage_messages=True)
async def announce(ctx, *, message: str):
    embed = discord.Embed(title="📢 Announcement", description=message, color=discord.Color.gold(), timestamp=datetime.datetime.utcnow())
    embed.set_footer(text=f"By {ctx.author}")
    await ctx.send(embed=embed)

# ═══════════════════════════════════════════════════════════════
# SLASH COMMANDS — per-guild announcement channel (admin only)
# ═══════════════════════════════════════════════════════════════

async def _set_announcement_channel(interaction, channel: discord.TextChannel):
    """Shared logic for /advannoucement and /setchannel."""
    err = check_announce_channel_perms(channel)
    if err:
        return await interaction.response.send_message(f"❌ Can't use {channel.mention}: {err}", ephemeral=True)
    data = load_announce_channels()
    data[str(interaction.guild_id)] = channel.id
    save_announce_channels(data)
    await interaction.response.send_message(
        f"✅ Announcement channel set to {channel.mention}.\n"
        f"New features & updates for DTEmpire Adventure will be posted here.\n"
        f"Use `>latestnews` in {channel.mention} to check the latest changelog."
    )

@bot.tree.command(name="advannoucement", description="Set the announcement/update channel for this server (admin only)")
@discord.app_commands.describe(channel="Text channel where updates get posted")
@discord.app_commands.default_permissions(administrator=True)
async def advannoucement(interaction, channel: discord.TextChannel):
    await _set_announcement_channel(interaction, channel)

@bot.tree.command(name="setchannel", description="Set the channel the bot uses for updates & commands (admin only)")
@discord.app_commands.describe(channel="Text channel for bot updates")
@discord.app_commands.default_permissions(administrator=True)
async def setchannel(interaction, channel: discord.TextChannel):
    await _set_announcement_channel(interaction, channel)

@bot.command(name="purge")
@commands.has_permissions(manage_messages=True)
async def purge(ctx, count: int):
    if count > 100: return await ctx.send("❌ Max 100.")
    deleted = await ctx.channel.purge(limit=count + 1)
    msg = await ctx.send(f"🗑️ Deleted {len(deleted)-1} messages.")
    await asyncio.sleep(3)
    await msg.delete()

@bot.command(name="remind")
async def remind(ctx, time_str: str, *, message: str):
    """Set a reminder. Time: 10s, 5m, 1h, 1d"""
    multipliers = {"s": 1, "m": 60, "h": 3600, "d": 86400}
    match = re.match(r"(\d+)([smhd])", time_str.lower())
    if not match:
        return await ctx.send("❌ Format: `remind 10s|5m|1h|1d <message>`")
    amount, unit = int(match.group(1)), match.group(2)
    seconds = amount * multipliers[unit]
    if seconds > 604800:
        return await ctx.send("❌ Max 7 days.")
    await ctx.send(f"⏰ Reminder set for **{time_str}** from now!")
    await asyncio.sleep(seconds)
    await ctx.send(f"🔔 {ctx.author.mention} Reminder: {message}")

# ═══════════════════════════════════════════════════════════════
# TICKET SYSTEM
# ═══════════════════════════════════════════════════════════════

@bot.command(name="ticket")
async def ticket(ctx, *, subject: str = "No subject"):
    """Create a support ticket."""
    global ticket_counter
    # Check if user already has a ticket
    for ch_id, data in active_tickets.items():
        if data["user_id"] == ctx.author.id:
            ch = bot.get_channel(ch_id)
            if ch:
                return await ctx.send(f"❌ You already have an open ticket: {ch.mention}")

    ticket_counter += 1
    guild = ctx.guild

    # Create channel
    overwrites = {
        guild.default_role: discord.PermissionOverwrite(read_messages=False),
        ctx.author: discord.PermissionOverwrite(read_messages=True, send_messages=True),
        guild.me: discord.PermissionOverwrite(read_messages=True, send_messages=True, manage_channels=True),
    }
    # Add moderator role if exists
    mod_role = discord.utils.get(guild.roles, name="Moderator") or discord.utils.get(guild.roles, name="Mod")
    if mod_role:
        overwrites[mod_role] = discord.PermissionOverwrite(read_messages=True, send_messages=True)

    try:
        channel = await guild.create_text_channel(
            name=f"ticket-{ticket_counter:04d}",
            overwrites=overwrites,
            category=discord.utils.get(guild.categories, name="Tickets"),
            reason=f"Ticket by {ctx.author}"
        )
    except:
        channel = await guild.create_text_channel(
            name=f"ticket-{ticket_counter:04d}",
            overwrites=overwrites,
            reason=f"Ticket by {ctx.author}"
        )

    active_tickets[channel.id] = {"user_id": ctx.author.id, "ticket_num": ticket_counter}

    embed = discord.Embed(
        title=f"🎫 Ticket #{ticket_counter:04d}",
        description=f"**Subject:** {subject}\n**Created by:** {ctx.author.mention}",
        color=discord.Color.blue(),
        timestamp=datetime.datetime.utcnow()
    )
    embed.add_field(name="Commands", value="`close` — Close ticket\n`add @user` — Add user\n`remove @user` — Remove user")
    await channel.send(f"{ctx.author.mention}", embed=embed)
    await ctx.send(f"✅ Ticket created: {channel.mention}")

    await log_event("🎫 Ticket Created", f"Ticket #{ticket_counter:04d} by {ctx.author.mention}", discord.Color.blue(),
        fields={"Subject": subject, "Channel": channel.mention},
        source_guild=guild.name, source_channel=channel.name, source_user=str(ctx.author))

@bot.command(name="close")
async def close_ticket(ctx):
    """Close a ticket (must be in a ticket channel)."""
    if ctx.channel.id not in active_tickets:
        return await ctx.send("❌ This is not a ticket channel.")
    data = active_tickets.pop(ctx.channel.id)
    await log_event("🎫 Ticket Closed", f"Ticket #{data['ticket_num']:04d} closed by {ctx.author}",
        discord.Color.orange(), source_guild=ctx.guild.name, source_channel=ctx.channel.name, source_user=str(ctx.author))
    await ctx.send("🔒 Closing ticket in 5 seconds...")
    await asyncio.sleep(5)
    await ctx.channel.delete(reason=f"Ticket closed by {ctx.author}")

@bot.command(name="add")
async def add_to_ticket(ctx, member: discord.Member):
    """Add a user to the current ticket."""
    if ctx.channel.id not in active_tickets:
        return await ctx.send("❌ Not a ticket channel.")
    await ctx.channel.set_permissions(member, read_messages=True, send_messages=True)
    await ctx.send(f"✅ Added {member.mention} to this ticket.")

@bot.command(name="remove")
async def remove_from_ticket(ctx, member: discord.Member):
    """Remove a user from the current ticket."""
    if ctx.channel.id not in active_tickets:
        return await ctx.send("❌ Not a ticket channel.")
    if active_tickets[ctx.channel.id]["user_id"] == member.id:
        return await ctx.send("❌ Cannot remove the ticket creator.")
    await ctx.channel.set_permissions(member, overwrite=None)
    await ctx.send(f"✅ Removed {member.mention} from this ticket.")

# ═══════════════════════════════════════════════════════════════
# AUTO-MOD COMMANDS
# ═══════════════════════════════════════════════════════════════

@bot.command(name="automod")
@commands.has_permissions(administrator=True)
async def automod_cmd(ctx, action: str = "status", sub: str = None, value=None):
    """Auto-mod management. Usage: >automod [toggle|badwords|caps|mentions]"""
    global automod_config

    if action == "status":
        embed = discord.Embed(title="🛡️ Auto-Mod Status", color=discord.Color.blue())
        embed.add_field(name="Enabled", value=str(automod_config["enabled"]), inline=True)
        embed.add_field(name="Max Caps %", value=str(automod_config["max_caps_percent"]), inline=True)
        embed.add_field(name="Max Mentions", value=str(automod_config["max_mentions"]), inline=True)
        embed.add_field(name="Block Invites", value=str(automod_config["block_invites"]), inline=True)
        embed.add_field(name="Bad Words", value=str(len(automod_config["bad_words"])) + " words", inline=True)
        embed.add_field(name="Spam Threshold", value=f"{automod_config['max_spam_messages']} msgs / {automod_config['max_spam_seconds']}s", inline=True)
        await ctx.send(embed=embed)

    elif action == "toggle":
        automod_config["enabled"] = not automod_config["enabled"]
        state = "🟢 Enabled" if automod_config["enabled"] else "🔴 Disabled"
        await ctx.send(f"Auto-Mod: {state}")

    elif action == "badwords" and sub and value:
        word = value.lower()
        if sub == "add":
            if word not in automod_config["bad_words"]:
                automod_config["bad_words"].append(word)
            await ctx.send(f"✅ Added `{word}` to bad words.")
        elif sub == "remove":
            if word in automod_config["bad_words"]:
                automod_config["bad_words"].remove(word)
            await ctx.send(f"✅ Removed `{word}` from bad words.")
        else:
            await ctx.send("❌ Use: `automod badwords add|remove <word>`")

    elif action == "caps" and value:
        try:
            automod_config["max_caps_percent"] = int(value)
            await ctx.send(f"✅ Max caps set to **{value}%**")
        except:
            await ctx.send("❌ Provide a number.")

    elif action == "mentions" and value:
        try:
            automod_config["max_mentions"] = int(value)
            await ctx.send(f"✅ Max mentions set to **{value}**")
        except:
            await ctx.send("❌ Provide a number.")

    else:
        await ctx.send("❌ Usage: `automod [toggle|status|badwords add/remove <word>|caps <n>|mentions <n>]`")

# ═══════════════════════════════════════════════════════════════
# WELCOME/LEAVE CHANNEL SETUP
# ═══════════════════════════════════════════════════════════════

@bot.command(name="setwelcome")
@commands.has_permissions(administrator=True)
async def setwelcome(ctx, channel: discord.TextChannel):
    """Set the welcome channel."""
    global welcome_channel_id
    welcome_channel_id = channel.id
    await ctx.send(f"✅ Welcome channel set to {channel.mention}")

@bot.command(name="setleave")
@commands.has_permissions(administrator=True)
async def setleave(ctx, channel: discord.TextChannel):
    """Set the leave channel."""
    global leave_channel_id
    leave_channel_id = channel.id
    await ctx.send(f"✅ Leave channel set to {channel.mention}")

# ═══════════════════════════════════════════════════════════════
# GAMES
# ═══════════════════════════════════════════════════════════════

@bot.command(name="roll", aliases=["dice"])
async def roll(ctx, dice: str = "1d20"):
    try:
        rolls, limit = map(int, dice.lower().split("d"))
        if rolls > 100 or limit > 10000: return await ctx.send("❌ Too big!")
        results = [__import__("random").randint(1, limit) for _ in range(rolls)]
        total = sum(results)
        if rolls == 1:
            await ctx.send(f"🎲 **{ctx.author.display_name}** rolled **{total}** (1d{limit})")
        else:
            await ctx.send(f"🎲 **{ctx.author.display_name}** rolled **{total}** ({rolls}d{limit}): {', '.join(map(str, results))}")
    except ValueError:
        await ctx.send("❌ Format: `roll NdN` (e.g., `roll 2d6`)")

@bot.command(name="coinflip", aliases=["coin", "flip"])
async def coinflip(ctx):
    result = __import__("random").choice(["Heads 🪙", "Tails 💿"])
    await ctx.send(f"**{result}**!")

@bot.command(name="8ball")
async def eightball(ctx, *, question: str):
    answers = ["It is certain.","It is decidedly so.","Without a doubt.","Yes — definitely.",
        "You may rely on it.","As I see it, yes.","Most likely.","Outlook good.","Yes.",
        "Signs point to yes.","Reply hazy, try again.","Ask again later.","Better not tell you now.",
        "Cannot predict now.","Don't count on it.","My reply is no.","Outlook not so good.","Very doubtful."]
    embed = discord.Embed(title="🎱 Magic 8-Ball", color=discord.Color.purple(), timestamp=datetime.datetime.utcnow())
    embed.add_field(name="Question", value=question, inline=False)
    embed.add_field(name="Answer", value=__import__("random").choice(answers), inline=False)
    await ctx.send(embed=embed)

@bot.command(name="rps")
async def rps(ctx, choice: str):
    choices = {"rock": "🪨", "paper": "📄", "scissors": "✂️"}
    choice = choice.lower().strip()
    if choice not in choices: return await ctx.send("❌ Choose: rock, paper, or scissors")
    bot_c = __import__("random").choice(list(choices.keys()))
    if choice == bot_c:
        result = "🤝 Tie!"
    elif (choice=="rock" and bot_c=="scissors") or (choice=="paper" and bot_c=="rock") or (choice=="scissors" and bot_c=="paper"):
        result = "🎉 You win!"
    else:
        result = "😈 I win!"
    await ctx.send(f"You: {choices[choice]} | Me: {choices[bot_c]}\n**{result}**")

@bot.command(name="trivia")
async def trivia(ctx):
    questions = [
        {"q":"Capital of Nepal?","a":"kathmandu"},{"q":"Year WWII ended?","a":"1945"},
        {"q":"Largest planet?","a":"jupiter"},{"q":"Who painted Mona Lisa?","a":"leonardo da vinci"},
        {"q":"Chemical symbol for gold?","a":"au"},{"q":"How many continents?","a":"7"},
        {"q":"Speed of light in km/s?","a":"300000"},{"q":"Who wrote Romeo and Juliet?","a":"shakespeare"},
        {"q":"Smallest country?","a":"vatican"},{"q":"Python creator?","a":"guido van rossum"},
        {"q":"HTTP stands for?","a":"hypertext transfer protocol"},{"q":"First iPhone year?","a":"2007"},
        {"q":"Hardest natural substance?","a":"diamond"},{"q":"Bones in adult body?","a":"206"},
        {"q":"Longest river?","a":"nile"},{"q":"CPU stands for?","a":"central processing unit"},
        {"q":"Penicillin discoverer?","a":"alexander fleming"},{"q":"Square root of 144?","a":"12"},
        {"q":"Gas plants absorb?","a":"carbon dioxide"},{"q":"Currency of Japan?","a":"yen"},
    ]
    item = __import__("random").choice(questions)
    embed = discord.Embed(title="🧠 Trivia!", description=item["q"], color=discord.Color.gold())
    embed.set_footer(text="15 seconds to answer!")
    await ctx.send(embed=embed)
    def check(m): return m.channel == ctx.channel and m.author != bot.user
    try:
        msg = await bot.wait_for("message", check=check, timeout=15)
        if msg.content.lower().strip() == item["a"]:
            await ctx.send(f"🎉 **{msg.author.display_name}** got it! Answer: **{item['a']}**")
        else:
            await ctx.send(f"❌ Wrong! Answer was **{item['a']}**")
    except asyncio.TimeoutError:
        await ctx.send(f"⏰ Time's up! Answer was **{item['a']}**")

@bot.command(name="guess")
async def guess(ctx):
    number = __import__("random").randint(1, 100)
    await ctx.send("🎯 Guess a number 1-100! You have 30s.")
    def check(m): return m.channel == ctx.channel and m.author == ctx.author and m.content.isdigit()
    try:
        msg = await bot.wait_for("message", check=check, timeout=30)
        g = int(msg.content)
        if g == number:
            await ctx.send(f"🎉 Correct! It was **{number}**!")
        else:
            diff = abs(g - number)
            hint = "🔥 Very close!" if diff <= 5 else "❄️ Far!" if diff > 30 else "🌡️ Warm!"
            await ctx.send(f"❌ Wrong! It was **{number}**. {hint}")
    except asyncio.TimeoutError:
        await ctx.send(f"⏰ Time's up! It was **{number}**")

@bot.command(name="hack")
async def hack(ctx, member: discord.Member = None):
    member = member or ctx.author
    stages = ["🔍 Finding Discord login...","📧 Email: `***@***.com`","🔑 Password: `********`",
              "💳 Stealing credit card...","📱 Installing virus...","🏠 Finding address...","✅ Hack complete! Just kidding 😄"]
    msg = await ctx.send(f"💀 Hacking **{member.display_name}**...")
    for s in stages:
        await asyncio.sleep(1.5)
        await msg.edit(content=s)

@bot.command(name="fish", aliases=["fishing", "cast"])
async def fish(ctx):
    """Go fishing! Catch fish, treasure, and rare items. 60s cooldown."""
    player = get_player(HOME_GUILD_ID, ctx.author.id)
    players = load_players()
    key = f"{HOME_GUILD_ID}_{ctx.author.id}"

    # Cooldown check
    now = time.time()
    last_fish = player.get("last_fish", 0)
    if now - last_fish < 60:
        remaining = int(60 - (now - last_fish))
        return await ctx.send(f"🎣 Your line is still out! Wait **{remaining}s** before casting again.")

    # Fishing table: (name, emoji, rarity, min_value, max_value, weight)
    catches = [
        # Common (60%)
        ("Sardine", "🐟", "common", 5, 15, 20),
        ("Mackerel", "🐠", "common", 8, 20, 18),
        ("Bass", "🐡", "common", 10, 25, 15),
        ("Boot", "👢", "common", 1, 3, 7),
        # Uncommon (25%)
        ("Salmon", "🍣", "uncommon", 20, 40, 10),
        ("Swordfish", "⚔️", "uncommon", 30, 55, 8),
        ("Lobster", "🦞", "uncommon", 25, 50, 7),
        # Rare (10%)
        ("Golden Fish", "✨", "rare", 50, 100, 5),
        ("Pearl", "🫧", "rare", 60, 120, 4),
        ("Ancient Coin", "🪙", "rare", 80, 150, 3),
        # Epic (4%)
        ("Trident", "🔱", "epic", 150, 300, 2),
        ("Sea Crown", "👑", "epic", 200, 400, 1.5),
        ("Kraken Tentacle", "🐙", "epic", 180, 350, 1.5),
        # Legendary (1%)
        ("Poseidon's Blessing", "🌊", "legendary", 500, 1000, 0.5),
        ("Neptune's Trident", "🏆", "legendary", 800, 1500, 0.3),
        ("Mermaid's Tear", "💎", "legendary", 1000, 2000, 0.2),
    ]

    # Weighted random selection
    total_weight = sum(c[5] for c in catches)
    roll = _rand.uniform(0, total_weight)
    cumulative = 0
    caught = catches[0]
    for c in catches:
        cumulative += c[5]
        if roll <= cumulative:
            caught = c
            break

    name, emoji, rarity, min_val, max_val, _ = caught
    value = _rand.randint(min_val, max_val)

    # Bonus for lucky charm
    bonus = 1.0
    if "lucky_charm" in player.get("inventory", []):
        bonus = 1.5
    if "enchanted_lure" in player.get("inventory", []):
        bonus = max(bonus, 1.3)

    coins_earned = int(value * bonus)
    xp_earned = max(5, coins_earned // 3)

    player["coins"] += coins_earned
    player["xp"] += xp_earned
    player["last_fish"] = now
    player["fish_caught"] = player.get("fish_caught", 0) + 1
    player["fish_coins"] = player.get("fish_coins", 0) + coins_earned
    if rarity in ("epic", "legendary"):
        player["fish_legendary"] = player.get("fish_legendary", 0) + 1

    # Level up check (cap 100, same curve as the web: level N needs N*100 XP)
    xp_needed = player["level"] * 100
    leveled_up = False
    while player["xp"] >= xp_needed and player["level"] < 100:
        player["level"] += 1
        player["xp"] -= xp_needed
        player["max_health"] += 10
        player["health"] = player["max_health"]
        player["attack"] += 3
        player["defense"] += 2
        xp_needed = player["level"] * 100
        leveled_up = True

    players[key] = player
    save_players(players)

    rarity_colors = {
        "common": discord.Color.light_grey(),
        "uncommon": discord.Color.green(),
        "rare": discord.Color.blue(),
        "epic": discord.Color.purple(),
        "legendary": discord.Color.gold(),
    }
    rarity_emoji = {
        "common": "⚪", "uncommon": "🟢", "rare": "🔵", "epic": "🟣", "legendary": "🟡",
    }

    embed = discord.Embed(
        title="🎣 Fishing Result!",
        description=f"You cast your line into the water...",
        color=rarity_colors.get(rarity, discord.Color.blue()),
        timestamp=datetime.datetime.utcnow(),
    )
    embed.add_field(name="Catch", value=f"{emoji} **{name}** {rarity_emoji.get(rarity, '')} *{rarity.upper()}*", inline=False)
    embed.add_field(name="Reward", value=f"🪙 +**{coins_earned}** coins | ⭐ +**{xp_earned}** XP", inline=True)
    if bonus > 1.0:
        bonus_name = "🍀 Lucky Charm" if bonus >= 1.5 else "✨ Enchanted Lure"
        embed.add_field(name=f"{bonus_name} Bonus", value=f"{int((bonus-1)*100)}% bonus applied!", inline=True)
    if leveled_up:
        embed.add_field(name="🎉 LEVEL UP!", value=f"You are now **Level {player['level']}**!", inline=False)
    embed.set_footer(text="Cooldown: 60s | Use >fish again after cooldown!")
    await ctx.send(embed=embed)

# ═══════════════════════════════════════════════════════════════
# ADVENTURE GAME + ECONOMY + SHOP
# ═══════════════════════════════════════════════════════════════

import random as _rand

# ── Data storage ──
PLAYER_FILE = DATA_DIR / "players.json"
GUILD_SHOP_FILE = DATA_DIR / "guild_shops.json"

_PLAYER_STORE = None

def _player_store():
    """Use the Flask app's locked, rollback-protected player store everywhere."""
    global _PLAYER_STORE
    if _PLAYER_STORE is None:
        web_dir = str(BASE_DIR / "web")
        if web_dir not in sys.path:
            sys.path.insert(0, web_dir)
        import importlib
        protected_store = importlib.import_module("app")
        _PLAYER_STORE = protected_store
    return _PLAYER_STORE


def load_players():
    return _player_store().load_players()


def save_players(data):
    return _player_store().save_players(data)

def load_guild_shops():
    try:
        with open(GUILD_SHOP_FILE) as f:
            return json.load(f)
    except:
        return {}

def save_guild_shops(data):
    with open(GUILD_SHOP_FILE, "w") as f:
        json.dump(data, f, indent=2)

def get_player(guild_id, user_id):
    players = load_players()
    key = f"{guild_id}_{user_id}"
    if key not in players:
        players[key] = {
            "user_id": user_id,
            "guild_id": guild_id,
            "name": "",
            "level": 1,
            "xp": 0,
            "coins": 100,
            "health": 100,
            "max_health": 100,
            "attack": 10,
            "defense": 5,
            "inventory": ["wooden_sword"], "equipped_weapon": None, "equipped_armor": None,
            "monsters_killed": 0,
            "deaths": 0,
            "bosses_killed": 0,
            "adventures_completed": 0,
            "last_daily": 0,
            "last_adventure": 0,
            "created": time.time(),
        }
        save_players(players)
    return players[key]

def get_default_shop(guild_id):
    shops = load_guild_shops()
    gid = str(guild_id)
    if gid not in shops:
        shops[gid] = {
            "weapons": [
                {"id": "wooden_sword", "name": "🗡️ Wooden Sword", "attack": 5, "price": 100, "desc": "A basic wooden sword. +5 ATK"},
                {"id": "iron_sword", "name": "⚔️ Iron Sword", "attack": 12, "price": 300, "desc": "A sturdy iron blade. +12 ATK"},
                {"id": "steel_sword", "name": "🔪 Steel Sword", "attack": 20, "price": 350, "desc": "Sharp steel. +20 ATK"},
                {"id": "flame_blade", "name": "🔥 Flame Blade", "attack": 35, "price": 750, "desc": "Burns with eternal fire. +35 ATK"},
                {"id": "obsidian_katana", "name": "🗾 Obsidian Katana", "attack": 45, "price": 1100, "desc": "A razor-sharp volcanic glass blade. +45 ATK"},
                {"id": "dragon_slayer", "name": "🐉 Dragon Slayer", "attack": 55, "price": 1500, "desc": "Forged to slay dragons. +55 ATK"},
                {"id": "excalibur", "name": "👑 Excalibur", "attack": 80, "price": 3000, "desc": "The legendary sword of kings. +80 ATK"},
                {"id": "stormbreaker", "name": "⚡ Stormbreaker", "attack": 95, "price": 4500, "desc": "Forged in the heart of a storm. +95 ATK"},
                {"id": "phoenix_blade", "name": "🔥 Phoenix Blade", "attack": 110, "price": 6000, "desc": "Reborn from immortal flames. +110 ATK"},
                {"id": "doomhammer", "name": "🔨 Doomhammer", "attack": 130, "price": 8000, "desc": "Smashes everything in its path. +130 ATK"},
                {"id": "tempest_fury", "name": "🌪️ Tempest Fury", "attack": 150, "price": 10000, "desc": "A blade infused with the fury of storms. +150 ATK"},
                {"id": "void_reaper", "name": "🌑 Void Reaper", "attack": 175, "price": 13000, "desc": "Forged from the essence of the Void. +175 ATK"},
                {"id": "eternal_flame", "name": "🔥 Eternal Flame", "attack": 200, "price": 16000, "desc": "Burns with the fire of a thousand suns. +200 ATK"},
                {"id": "prismatic_blade", "name": "💠 Prismatic Blade", "attack": 230, "price": 20000, "desc": "Refracts light into devastating energy. +230 ATK"},
                {"id": "crystal_staff", "name": "🔮 Crystal Staff", "attack": 260, "price": 25000, "desc": "Channels geomantic power through crystal. +260 ATK"},
                {"id": "abyssal_blade", "name": "🔥 Abyssal Blade", "attack": 300, "price": 32000, "desc": "Forged in the Abyssal Rift. Burns with hellfire. +300 ATK"},
                {"id": "soul_reaper", "name": "💀 Soul Reaper", "attack": 350, "price": 40000, "desc": "Steals the soul of the fallen. +350 ATK"},
                {"id": "shadow_fang", "name": "🌑 Shadow Fang", "attack": 420, "price": 50000, "desc": "A blade forged in the Shadowfall Depths. Strikes from the void. +420 ATK"},
                {"id": "ember_fang", "name": "🔥 Ember Fang", "attack": 500, "price": 60000, "desc": "Forged in the Molten Core. Burns with eternal flame. +500 ATK"},
                {"id": "lunar_crescent", "name": "🌙 Lunar Crescent", "attack": 580, "price": 75000, "desc": "A crescent blade forged from pure moonlight. +580 ATK"},
                {"id": "gaia_wrath", "name": "🌿 Gaia's Wrath", "attack": 650, "price": 90000, "desc": "A living weapon grown from the World Tree. +650 ATK"},
                {"id": "eclipse_blade", "name": "🌑 Eclipse Blade", "attack": 720, "price": 110000, "desc": "Forged in the space between sun and moon. +720 ATK"},
                {"id": "scorching_mirage", "name": "🏜️ Scorching Mirage", "attack": 820, "price": 140000, "desc": "A blade forged from desert heat and ancient magic. +820 ATK"},
                {"id": "glacial_blade", "name": "🧊 Glacial Blade", "attack": 950, "price": 180000, "desc": "A blade forged in the heart of a glacier. +950 ATK"},
                {"id": "frostbite_staff", "name": "❄️ Frostbite Staff", "attack": 1050, "price": 220000, "desc": "Channels the biting cold of eternal winter. +1050 ATK"},
                {"id": "stormsplitter_blade", "name": "🌊 Stormsplitter Blade", "attack": 1200, "price": 300000, "desc": "Cleaves through tidal waves and thunderstorms alike. +1200 ATK"},
                {"id": "astral_blade", "name": "🌌 Astral Blade", "attack": 1400, "price": 400000, "desc": "Forged from crystallized astral energy. Cuts through dimensions. +1400 ATK"},
                {"id": "stellar_talon", "name": "⭐ Stellar Talon", "attack": 1600, "price": 500000, "desc": "A claw-like weapon forged from a dying star. +1600 ATK"},
                {"id": "aether_blade", "name": "🌌 Aether Blade", "attack": 1900, "price": 700000, "desc": "Forged from pure cosmic creation energy. Cuts through reality itself. +1900 ATK"},
                {"id": "chrono_edge", "name": "⏳ Chrono Edge", "attack": 2100, "price": 850000, "desc": "A blade that cuts through time itself. +2100 ATK"},
                {"id": "abyssal_trident", "name": "🔱 Abyssal Trident", "attack": 2300, "price": 950000, "desc": "Forged in the deepest ocean trench. Strikes with the pressure of the abyss. +2300 ATK"},
                {"id": "celestial_scepter", "name": "���� Celestial Scepter", "attack": 2500, "price": 1100000, "desc": "Forged from collapsed star matter. Channels cosmic energy. +2500 ATK"},
                                {"id": "void_render", "name": "���� Void Render", "attack": 2800, "price": 1300000, "desc": "A blade that tears through the fabric of reality. +2800 ATK"},
                            ],
            "armor": [
                {"id": "leather_armor", "name": "🥋 Leather Armor", "defense": 3, "price": 40, "desc": "Basic leather protection. +3 DEF"},
                {"id": "chainmail", "name": "⛓️ Chainmail", "defense": 8, "price": 250, "desc": "Linked metal rings. +8 DEF"},
                {"id": "iron_armor", "name": "🛡️ Iron Armor", "defense": 15, "price": 300, "desc": "Solid iron plates. +15 DEF"},
                {"id": "steel_armor", "name": "🏰 Steel Armor", "defense": 25, "price": 600, "desc": "Heavy steel protection. +25 DEF"},
                {"id": "titanium_armor", "name": "🛡️ Titanium Armor", "defense": 32, "price": 900, "desc": "Lightweight yet nearly unbreakable. +32 DEF"},
                {"id": "dragon_scale", "name": "🐲 Dragon Scale", "defense": 40, "price": 1200, "desc": "Made from dragon scales. +40 DEF"},
                {"id": "divine_plate", "name": "✨ Divine Plate", "defense": 60, "price": 2500, "desc": "Blessed by the gods. +60 DEF"},
                {"id": "celestial_aegis", "name": "🌟 Celestial Aegis", "defense": 75, "price": 4000, "desc": "Woven from starlight. +75 DEF"},
                {"id": "mystic_robes", "name": "🌙 Mystic Robes", "defense": 50, "price": 1800, "desc": "Enchanted fabric that absorbs magic. +50 DEF"},
                {"id": "abyssal_cloak", "name": "🌑 Abyssal Cloak", "defense": 90, "price": 5500, "desc": "Woven from the fabric of the abyss. +90 DEF"},
                {"id": "storm_shield", "name": "⛈️ Storm Shield", "defense": 105, "price": 7000, "desc": "Forged in the heart of a hurricane. +105 DEF"},
                {"id": "void_plate", "name": "🌌 Void Plate", "defense": 120, "price": 9000, "desc": "Absorbs attacks into the Void. +120 DEF"},
                {"id": "eternal_aegis", "name": "✨ Eternal Aegis", "defense": 140, "price": 12000, "desc": "An indestructible shield of pure light. +140 DEF"},
                {"id": "prismatic_shield", "name": "💠 Prismatic Shield", "defense": 165, "price": 18000, "desc": "A shield that refracts incoming attacks. +165 DEF"},
                {"id": "crystal_plate", "name": "🔮 Crystal Plate", "defense": 190, "price": 24000, "desc": "Forged from enchanted crystal matrices. +190 DEF"},
                {"id": "abyssal_armor", "name": "🔥 Abyssal Armor", "defense": 220, "price": 30000, "desc": "Forged in the Abyssal Rift. Immune to fire. +220 DEF"},
                {"id": "soul_guard", "name": "💀 Soul Guard", "defense": 260, "price": 38000, "desc": "Protects the wearer's soul from harm. +260 DEF"},
                {"id": "shadowfall_armor", "name": "🌑 Shadowfall Armor", "defense": 310, "price": 48000, "desc": "Forged in the depths where shadows reign. Absorbs dark energy. +310 DEF"},
                {"id": "molten_plate", "name": "🔥 Molten Plate", "defense": 370, "price": 58000, "desc": "Forged from the magma of the Eternal Flame. +370 DEF"},
                {"id": "moonweave_robes", "name": "🌙 Moonweave Robes", "defense": 440, "price": 72000, "desc": "Woven from threads of pure moonlight by the Moon Goddess. +440 DEF"},
                {"id": "gaia_bark", "name": "🌿 Gaia's Bark", "defense": 520, "price": 88000, "desc": "Living armor grown from ancient World Tree bark. +520 DEF"},
                {"id": "eclipse_aegis", "name": "🌑 Eclipse Aegis", "defense": 600, "price": 105000, "desc": "A shield forged from the essence of celestial alignment. +600 DEF"},
                {"id": "sunforged_plate", "name": "🌞 Sunforged Plate", "defense": 700, "price": 130000, "desc": "Forged under the eternal desert sun. +700 DEF"},
                {"id": "frostweave_cloak", "name": "🧣 Frostweave Cloak", "defense": 820, "price": 170000, "desc": "Woven from threads of pure ice by winter spirits. +820 DEF"},
                {"id": "aurora_aegis", "name": "🌌 Aurora Aegis", "defense": 950, "price": 210000, "desc": "A shield that captures the northern lights. +950 DEF"},
                {"id": "tidalwave_barrier", "name": "🌊 Tidalwave Barrier", "defense": 1100, "price": 280000, "desc": "A shield forged from the pressure of the deepest ocean. +1100 DEF"},
                {"id": "voidweave_aegis", "name": "🌌 Voidweave Aegis", "defense": 1250, "price": 350000, "desc": "Woven from threads of pure void energy. +1250 DEF"},
                {"id": "astral_plate", "name": "💫 Astral Plate", "defense": 1450, "price": 450000, "desc": "Armor forged from crystallized starlight. +1450 DEF"},
                {"id": "cosmic_aegis", "name": "🌌 Cosmic Aegis", "defense": 1700, "price": 600000, "desc": "Woven from the fabric of the Celestial Abyss. Absorbs dimensional energy. +1700 DEF"},
                {"id": "temporal_aegis", "name": "⏳ Temporal Aegis", "defense": 1900, "price": 750000, "desc": "Woven from the fabric of frozen time. Stops attacks before they land. +1900 DEF"},
                {"id": "abyssal_mantle", "name": "🌊 Abyssal Mantle", "defense": 2100, "price": 880000, "desc": "Armor woven from the crushing pressure of the deepest ocean trench. +2100 DEF"},
                {"id": "cosmic_mantle", "name": "🌌 Cosmic Mantle", "defense": 2300, "price": 1000000, "desc": "Woven from the fabric of the Celestial Abyss. Absorbs dimensional energy. +2300 DEF"},
            ],
            "potions": [
                {"id": "health_potion", "name": "❤️ Health Potion", "heal": 30, "price": 25, "desc": "Restores 30 HP"},
                {"id": "large_potion", "name": "💖 Large Potion", "heal": 75, "price": 60, "desc": "Restores 75 HP"},
                {"id": "elixir", "name": "🧪 Elixir", "heal": 400, "price": 300, "desc": "Fully restores HP"},
                {"id": "mega_elixir", "name": "💫 Mega Elixir", "heal": 500, "price": 350, "desc": "Heals 500 HP instantly"},
                {"id": "xp_potion", "name": "⭐ XP Potion", "xp_boost": 50, "price": 80, "desc": "Grants 50 XP"},
                {"id": "elixir_of_power", "name": "🧬 Elixir of Power", "xp_boost": 200, "price": 500, "desc": "Grants 200 XP instantly"},
                {"id": "time_warp_potion", "name": "⏳ Time Warp Potion", "xp_boost": 500, "price": 1200, "desc": "Bends spacetime for 500 XP"},
                {"id": "elixir_of_fortune", "name": "🍀 Elixir of Fortune", "xp_boost": 1000, "price": 2500, "desc": "Grants 1000 XP and doubles fishing rewards for 5 minutes"},
                {"id": "crystal_elixir", "name": "💎 Crystal Elixir", "heal": 1000, "price": 800, "desc": "A potent crystalline brew. Restores 1000 HP"},
                {"id": "elixir_of_the_gods", "name": "🌟 Elixir of the Gods", "xp_boost": 2500, "price": 5000, "desc": "Divine elixir. Grants 2500 XP instantly"},
                {"id": "abyssal_brew", "name": "🔥 Abyssal Brew", "heal": 2000, "price": 1500, "desc": "A fiery concoction from the Abyssal Rift. Restores 2000 HP"},
                {"id": "soul_elixir", "name": "💀 Soul Elixir", "xp_boost": 5000, "price": 8000, "desc": "Grants 5000 XP and fully restores HP"},
                {"id": "nectar_of_the_gods", "name": "🌟 Nectar of the Gods", "heal": 3000, "price": 2500, "desc": "Divine nectar. Restores 3000 HP instantly"},
                {"id": "elixir_of_eternity", "name": "⏳ Elixir of Eternity", "xp_boost": 10000, "price": 15000, "desc": "Grants 10000 XP and fully restores HP"},
                {"id": "mirage_flask", "name": "🌌 Mirage Flask", "heal": 5000, "xp_boost": 5000, "price": 20000, "desc": "Restores 5000 HP and grants 5000 XP"},
                {"id": "frostfire_mixture", "name": "🧊🔥 Frostfire Mixture", "heal": 7000, "xp_boost": 7000, "price": 30000, "desc": "A paradoxical brew of fire and ice. Restores 7000 HP and 7000 XP"},
                {"id": "elixir_of_the_aurora", "name": "🌌 Elixir of the Aurora", "xp_boost": 15000, "price": 25000, "desc": "Distilled from the northern lights. Grants 15000 XP"},
                {"id": "phantom_tide", "name": "🌊 Phantom Tide", "xp_boost": 20000, "price": 45000, "desc": "A ghostly ocean current. Grants 20000 XP and fully restores HP"},
                {"id": "cosmic_convergence", "name": "🌌 Cosmic Convergence", "heal": 10000, "xp_boost": 10000, "price": 60000, "desc": "Channels cosmic forces. Restores 10000 HP and 10000 XP"},
                {"id": "elixir_of_infinity", "name": "♾️ Elixir of Infinity", "xp_boost": 25000, "price": 80000, "desc": "Distilled from infinite space. Grants 25000 XP and fully restores HP"},
                {"id": "abyssal_convergence", "name": "🌌 Abyssal Convergence", "heal": 15000, "xp_boost": 15000, "price": 100000, "desc": "Channels the full power of the Celestial Abyss. Restores 15000 HP and 15000 XP"},
                {"id": "elixir_of_forever", "name": "♾️ Elixir of Forever", "heal": 20000, "xp_boost": 20000, "price": 120000, "desc": "A timeless brew from the Chrono Sanctum. Restores 20000 HP and 20000 XP"},
                {"id": "deep_tide_potion", "name": "🌊 Deep Tide Potion", "heal": 18000, "xp_boost": 18000, "price": 130000, "desc": "Bottled pressure from the Abyssal Trench. Restores 18000 HP and 18000 XP"},
            ],
            "special": [
                {"id": "lucky_charm", "name": "🍀 Lucky Charm", "price": 400, "desc": "Increases rare drop chance"},
                {"id": "shield_ring", "name": "💍 Shield Ring", "price": 350, "desc": "+5 permanent DEF"},
                {"id": "power_ring", "name": "💎 Power Ring", "price": 350, "desc": "+5 permanent ATK"},
                {"id": "life_crystal", "name": "💠 Life Crystal", "price": 500, "desc": "+20 permanent max HP"},
                {"id": "gravity_well", "name": "🌀 Gravity Well", "price": 800, "desc": "+10 ATK & +10 DEF permanently"},
                {"id": "enchanted_lure", "name": "✨ Enchanted Lure", "price": 450, "desc": "Doubles fishing rare catch chance"},
                {"id": "soul_gem", "name": "💎 Soul Gem", "price": 2000, "desc": "+15 ATK & +15 DEF & +30 max HP permanently"},
                {"id": "dragon_heart", "name": "🐲 Dragon Heart", "price": 3500, "desc": "+25 ATK & +25 DEF & +50 max HP permanently"},
                {"id": "celestial_blessing", "name": "🌟 Celestial Blessing", "price": 5000, "desc": "+40 ATK & +40 DEF & +100 max HP permanently"},
                {"id": "crystal_core", "name": "💎 Crystal Core", "price": 7500, "desc": "+60 ATK & +60 DEF & +150 max HP permanently"},
                {"id": "essence_of_eternity", "name": "✨ Essence of Eternity", "price": 10000, "desc": "+100 ATK & +100 DEF & +250 max HP permanently"},
                {"id": "abyssal_heart", "name": "🔥 Abyssal Heart", "price": 15000, "desc": "+150 ATK & +150 DEF & +350 max HP permanently"},
                {"id": "soul_stone", "name": "💀 Soul Stone", "price": 20000, "desc": "+200 ATK & +200 DEF & +500 max HP permanently"},
                {"id": "void_essence", "name": "🌌 Void Essence", "price": 28000, "desc": "+300 ATK & +300 DEF & +750 max HP permanently"},
                {"id": "flame_of_eternity", "name": "🔥 Flame of Eternity", "price": 35000, "desc": "+400 ATK & +400 DEF & +1000 max HP permanently"},
                {"id": "moonstone_aegis", "name": "🌙 Moonstone Aegis", "price": 45000, "desc": "+500 ATK & +500 DEF & +1250 max HP permanently"},
                {"id": "gaia_heart", "name": "🌿 Gaia's Heart", "price": 60000, "desc": "+600 ATK & +600 DEF & +1500 max HP permanently"},
                {"id": "eclipse_core", "name": "🌑 Eclipse Core", "price": 80000, "desc": "+750 ATK & +750 DEF & +2000 max HP permanently"},
                {"id": "solar_prism", "name": "💠 Solar Prism", "price": 120000, "desc": "+900 ATK & +900 DEF & +3000 max HP permanently"},
                {"id": "crystal_of_eternal_frost", "name": "💎 Crystal of Eternal Frost", "price": 160000, "desc": "+1100 ATK & +1100 DEF & +4000 max HP permanently"},
                {"id": "northern_star", "name": "⭐ Northern Star", "price": 200000, "desc": "+1300 ATK & +1300 DEF & +5000 max HP permanently"},
                {"id": "indigo_monarch_crown", "name": "👑 Indigo Monarch's Crown", "price": 250000, "desc": "+1500 ATK & +1500 DEF & +6000 max HP permanently"},
                {"id": "infinity_fragment", "name": "♾️ Infinity Fragment", "price": 350000, "desc": "+1800 ATK & +1800 DEF & +7500 max HP permanently"},
                {"id": "cosmic_seed", "name": "🌌 Cosmic Seed", "price": 500000, "desc": "+2200 ATK & +2200 DEF & +10000 max HP permanently"},
                {"id": "aether_shard", "name": "🌌 Aether Shard", "price": 750000, "desc": "+2800 ATK & +2800 DEF & +14000 max HP permanently"},
                {"id": "chrono_core", "name": "⏳ Chrono Core", "price": 900000, "desc": "+3500 ATK & +3500 DEF & +18000 max HP permanently"},
                {"id": "trench_treasure", "name": "💠 Trench Treasure", "price": 200000, "desc": "+1600 ATK & +1600 DEF & +6500 max HP permanently"},
                {"id": "astral_convergence", "name": "🌌 Astral Convergence", "price": 1200000, "desc": "+4000 ATK & +4000 DEF & +22000 max HP permanently"},
            ]
        }
        save_guild_shops(shops)
    return shops[gid]

# ── Adventure locations ──
ADVENTURE_LOCATIONS = [
    {
        "name": "🌲 Dark Forest",
        "description": "A dense, mysterious forest where shadows lurk between the trees.",
        "min_level": 1,
        "monsters": [
            {"name": "🐺 Wolf", "hp": 30, "atk": 8, "def": 2, "xp": 15, "coins": (10, 25)},
            {"name": "🕷️ Giant Spider", "hp": 25, "atk": 10, "def": 1, "xp": 12, "coins": (8, 20)},
            {"name": "👻 Ghost", "hp": 40, "atk": 12, "def": 3, "xp": 20, "coins": (15, 35)},
            {"name": "🧟 Zombie", "hp": 50, "atk": 7, "def": 5, "xp": 18, "coins": (12, 30)},
            {"name": "🗡️ Bandit", "hp": 45, "atk": 14, "def": 3, "xp": 22, "coins": (18, 40)},
            {"name": "🍄 Mushroom Sprite", "hp": 35, "atk": 11, "def": 6, "xp": 16, "coins": (10, 28)},
            {"name": "🦇 Vampire Bat", "hp": 40, "atk": 16, "def": 4, "xp": 20, "coins": (15, 35)},
            {"name": "🌿 Thorn Beast", "hp": 55, "atk": 13, "def": 8, "xp": 24, "coins": (20, 42)},
            {"name": "🦊 Shadow Fox", "hp": 50, "atk": 18, "def": 5, "xp": 26, "coins": (22, 45)},
            {"name": "🌑 Dark Sprite", "hp": 45, "atk": 15, "def": 10, "xp": 22, "coins": (18, 38)},
            {"name": "🪰 Firefly Swarm", "hp": 20, "atk": 6, "def": 2, "xp": 10, "coins": (5, 15)},
            {"name": "👹 Boggart", "hp": 40, "atk": 14, "def": 5, "xp": 20, "coins": (12, 30)},
        ],
        "boss": {"name": "🌳 Treant Guardian", "hp": 150, "atk": 20, "def": 10, "xp": 80, "coins": (80, 150)},
        "boss_chance": 0.15,
    },
    {
        "name": "🌸 Enchanted Garden",
        "description": "A magical garden where flowers sing and mushrooms dance. Mystical creatures guard ancient secrets.",
        "min_level": 3,
        "monsters": [
            {"name": "🌺 Flower Sprite", "hp": 40, "atk": 12, "def": 5, "xp": 20, "coins": (15, 30)},
            {"name": "🦋 Fairy Dragon", "hp": 55, "atk": 15, "def": 7, "xp": 28, "coins": (20, 40)},
            {"name": "🍂 Autumn Wisp", "hp": 35, "atk": 18, "def": 3, "xp": 25, "coins": (18, 35)},
            {"name": "🌿 Vine Ent", "hp": 70, "atk": 10, "def": 10, "xp": 30, "coins": (22, 45)},
            {"name": "🦎 Crystal Chameleon", "hp": 60, "atk": 20, "def": 8, "xp": 32, "coins": (25, 48)},
            {"name": "🌺 Pollen Drifter", "hp": 45, "atk": 16, "def": 5, "xp": 22, "coins": (18, 38)},
        ],
        "boss": {"name": "👸 Garden Queen", "hp": 200, "atk": 25, "def": 15, "xp": 100, "coins": (100, 200)},
        "boss_chance": 0.12,
    },
    {
        "name": "🏔️ Frozen Mountains",
        "description": "Icy peaks where only the brave dare to tread.",
        "min_level": 5,
        "monsters": [
            {"name": "❄️ Ice Elemental", "hp": 60, "atk": 18, "def": 8, "xp": 35, "coins": (25, 50)},
            {"name": "🐻 Polar Bear", "hp": 80, "atk": 22, "def": 6, "xp": 40, "coins": (30, 55)},
            {"name": "🦅 Frost Hawk", "hp": 45, "atk": 25, "def": 4, "xp": 30, "coins": (20, 45)},
            {"name": "🧊 Ice Golem", "hp": 100, "atk": 15, "def": 15, "xp": 45, "coins": (35, 60)},
            {"name": "🏔️ Avalanche Yeti", "hp": 110, "atk": 20, "def": 12, "xp": 48, "coins": (38, 65)},
            {"name": "💎 Crystal Golem", "hp": 90, "atk": 16, "def": 20, "xp": 50, "coins": (40, 70)},
            {"name": "🐺 Blizzard Wolf", "hp": 85, "atk": 26, "def": 8, "xp": 42, "coins": (32, 58)},
            {"name": "👻 Frozen Wraith", "hp": 70, "atk": 30, "def": 5, "xp": 38, "coins": (28, 52)},
        ],
        "boss": {"name": "🐉 Frost Dragon", "hp": 300, "atk": 35, "def": 20, "xp": 150, "coins": (150, 300)},
        "boss_chance": 0.12,
    },
    {
        "name": "🌊 Sunken Depths",
        "description": "An ancient underwater city, swallowed by the sea millennia ago. Bioluminescent creatures light the way.",
        "min_level": 8,
        "monsters": [
            {"name": "🐙 Kraken Spawn", "hp": 75, "atk": 22, "def": 10, "xp": 45, "coins": (35, 65)},
            {"name": "🧜 Siren", "hp": 55, "atk": 28, "def": 6, "xp": 40, "coins": (30, 55)},
            {"name": "🦈 Shark Warrior", "hp": 95, "atk": 25, "def": 14, "xp": 50, "coins": (40, 70)},
            {"name": "🪼 Jelly Swarm", "hp": 65, "atk": 20, "def": 12, "xp": 38, "coins": (28, 52)},
            {"name": "🐍 Abyssal Serpent", "hp": 110, "atk": 26, "def": 16, "xp": 55, "coins": (42, 75)},
            {"name": "🪸 Coral Guardian", "hp": 130, "atk": 20, "def": 22, "xp": 58, "coins": (45, 78)},
        ],
        "boss": {"name": "🐋 Leviathan", "hp": 400, "atk": 42, "def": 25, "xp": 200, "coins": (200, 400)},
        "boss_chance": 0.10,
    },
    {
        "name": "🌋 Volcanic Caverns",
        "description": "Rivers of lava and chambers of fire. Only the strong survive.",
        "min_level": 10,
        "monsters": [
            {"name": "🔥 Fire Imp", "hp": 70, "atk": 30, "def": 10, "xp": 50, "coins": (40, 70)},
            {"name": "🌋 Magma Beast", "hp": 120, "atk": 28, "def": 18, "xp": 60, "coins": (50, 85)},
            {"name": "💀 Lava Skeleton", "hp": 90, "atk": 35, "def": 12, "xp": 55, "coins": (45, 75)},
            {"name": "🦂 Fire Scorpion", "hp": 85, "atk": 32, "def": 15, "xp": 52, "coins": (42, 72)},
            {"name": "🗿 Magma Titan", "hp": 160, "atk": 38, "def": 22, "xp": 70, "coins": (60, 95)},
            {"name": "👻 Inferno Wraith", "hp": 100, "atk": 45, "def": 14, "xp": 65, "coins": (55, 90)},
        ],
        "boss": {"name": "👹 Inferno Lord", "hp": 500, "atk": 50, "def": 30, "xp": 250, "coins": (250, 500)},
        "boss_chance": 0.10,
    },
    {
        "name": "💀 Cursed Catacombs",
        "description": "Ancient underground tombs filled with undead horrors. The air is thick with dark magic and the whispers of the damned.",
        "min_level": 17,
        "monsters": [
            {"name": "💀 Skeleton Warrior", "hp": 140, "atk": 45, "def": 30, "xp": 75, "coins": (55, 95)},
            {"name": "👻 Wraith", "hp": 110, "atk": 52, "def": 20, "xp": 80, "coins": (60, 100)},
            {"name": "🦴 Bone Colossus", "hp": 200, "atk": 40, "def": 38, "xp": 90, "coins": (70, 115)},
            {"name": "🩸 Blood Revenant", "hp": 160, "atk": 55, "def": 28, "xp": 85, "coins": (65, 105)},
        ],
        "boss": {"name": "☠️ Lich King", "hp": 1000, "atk": 75, "def": 50, "xp": 500, "coins": (500, 1000)},
        "boss_chance": 0.07,
    },
    {
        "name": "🏰 Abandoned Castle",
        "description": "A once-great castle now ruled by dark forces.",
        "min_level": 15,
        "monsters": [
            {"name": "⚔️ Dark Knight", "hp": 150, "atk": 40, "def": 25, "xp": 80, "coins": (60, 100)},
            {"name": "🧙 Dark Mage", "hp": 100, "atk": 50, "def": 15, "xp": 90, "coins": (70, 110)},
            {"name": "🦇 Vampire", "hp": 130, "atk": 45, "def": 20, "xp": 85, "coins": (65, 105)},
            {"name": "💀 Death Knight", "hp": 180, "atk": 38, "def": 30, "xp": 95, "coins": (75, 120)},
        ],
        "boss": {"name": "👑 Shadow King", "hp": 800, "atk": 65, "def": 40, "xp": 400, "coins": (400, 800)},
        "boss_chance": 0.08,
    },
    {
        "name": "🌌 The Void",
        "description": "The final frontier. Reality bends here. Only legends dare enter.",
        "min_level": 20,
        "monsters": [
            {"name": "👁️ Void Watcher", "hp": 200, "atk": 55, "def": 35, "xp": 120, "coins": (100, 160)},
            {"name": "🌀 Chaos Entity", "hp": 250, "atk": 60, "def": 30, "xp": 140, "coins": (120, 180)},
            {"name": "💀 Reaper", "hp": 180, "atk": 70, "def": 25, "xp": 130, "coins": (110, 170)},
            {"name": "🐲 Void Dragon", "hp": 350, "atk": 50, "def": 45, "xp": 160, "coins": (140, 220)},
            {"name": "\U0001f573\ufe0f Abyssal Horror", "hp": 280, "atk": 65, "def": 40, "xp": 155, "coins": (130, 200)},
            {"name": "\U0001f441\ufe0f All-Seeing Eye", "hp": 220, "atk": 75, "def": 35, "xp": 145, "coins": (120, 190)},
            {"name": "\U0001f300 Void Leviathan", "hp": 400, "atk": 68, "def": 50, "xp": 175, "coins": (150, 240)},
            {"name": "\U0001f480 Soul Devourer", "hp": 300, "atk": 80, "def": 38, "xp": 160, "coins": (135, 210)},
        ],
        "boss": {"name": "🌑 The Void Emperor", "hp": 1500, "atk": 90, "def": 60, "xp": 800, "coins": (800, 1500)},
        "boss_chance": 0.05,
    },
    {
        "name": "🌅 Celestial Spire",
        "description": "A floating tower that rises above the clouds, touching the stars themselves. Ancient celestial guardians protect its heights.",
        "min_level": 12,
        "monsters": [
            {"name": "👼 Winged Sentinel", "hp": 110, "atk": 38, "def": 22, "xp": 70, "coins": (55, 90)},
            {"name": "☀️ Solar Wraith", "hp": 130, "atk": 42, "def": 18, "xp": 80, "coins": (65, 100)},
            {"name": "🌙 Lunar Shade", "hp": 100, "atk": 48, "def": 15, "xp": 75, "coins": (60, 95)},
            {"name": "⭐ Star Colossus", "hp": 160, "atk": 35, "def": 28, "xp": 90, "coins": (75, 115)},
        ],
        "boss": {"name": "🌌 Astral Titan", "hp": 700, "atk": 60, "def": 40, "xp": 350, "coins": (350, 700)},
        "boss_chance": 0.08,
    },
    {
        "name": "🌪️ Storm Peaks",
        "description": "Treacherous mountain peaks battered by eternal storms. Lightning cracks the sky as thunder beasts roam the crags.",
        "min_level": 14,
        "monsters": [
            {"name": "⚡ Storm Elemental", "hp": 130, "atk": 48, "def": 20, "xp": 85, "coins": (65, 105)},
            {"name": "🦅 Thunder Roc", "hp": 160, "atk": 42, "def": 28, "xp": 90, "coins": (70, 110)},
            {"name": "🌩️ Lightning Sprite", "hp": 100, "atk": 55, "def": 15, "xp": 80, "coins": (60, 100)},
            {"name": "⛈️ Tempest Hound", "hp": 140, "atk": 45, "def": 22, "xp": 88, "coins": (68, 108)},
            {"name": "🌀 Cyclone Wraith", "hp": 150, "atk": 52, "def": 24, "xp": 92, "coins": (72, 112)},
            {"name": "🌨️ Hailstorm Golem", "hp": 175, "atk": 40, "def": 32, "xp": 95, "coins": (75, 118)},
        ],
        "boss": {"name": "🌪️ Storm Tyrant", "hp": 750, "atk": 68, "def": 38, "xp": 380, "coins": (380, 750)},
        "boss_chance": 0.08,
    },
    {
        "name": "🌫️ Twilight Marsh",
        "description": "A haunted swamp shrouded in perpetual twilight. Will-o'-wisps lure travelers astray while ancient horrors lurk beneath the murky water.",
        "min_level": 16,
        "monsters": [
            {"name": "💀 Bog Zombie", "hp": 160, "atk": 42, "def": 28, "xp": 80, "coins": (60, 100)},
            {"name": "🐊 Swamp Crocodile", "hp": 200, "atk": 48, "def": 35, "xp": 90, "coins": (70, 115)},
            {"name": "👻 Will-o'-Wisp", "hp": 120, "atk": 58, "def": 18, "xp": 85, "coins": (65, 105)},
            {"name": "🧟 Swamp Lurker", "hp": 180, "atk": 50, "def": 30, "xp": 88, "coins": (68, 110)},
            {"name": "🦎 Shadow Newt", "hp": 150, "atk": 55, "def": 25, "xp": 82, "coins": (62, 100)},
            {"name": "🫧 Bog Wraith", "hp": 170, "atk": 48, "def": 32, "xp": 86, "coins": (66, 108)},
        ],
        "boss": {"name": "🐉 Marsh Hydra", "hp": 900, "atk": 72, "def": 45, "xp": 450, "coins": (450, 900)},
        "boss_chance": 0.07,
    },
    {
        "name": "💎 Crystal Caverns",
        "description": "A dazzling underground labyrinth of crystalline formations. Ancient geomantic energy pulses through every facet, and crystalline guardians protect the deepest chambers.",
        "min_level": 18,
        "monsters": [
            {"name": "💠 Crystal Spider", "hp": 170, "atk": 50, "def": 35, "xp": 95, "coins": (75, 120)},
            {"name": "🔮 Prismatic Golem", "hp": 250, "atk": 42, "def": 48, "xp": 110, "coins": (90, 140)},
            {"name": "✨ Shimmer Wisp", "hp": 130, "atk": 62, "def": 22, "xp": 88, "coins": (70, 115)},
            {"name": "🪨 Gemstone Colossus", "hp": 320, "atk": 38, "def": 55, "xp": 120, "coins": (100, 160)},
        ],
        "boss": {"name": "👑 Crystal Emperor", "hp": 1200, "atk": 85, "def": 65, "xp": 600, "coins": (600, 1200)},
        "boss_chance": 0.06,
    },
    {
        "name": "🔥 Abyssal Rift",
        "description": "A scorching dimension between worlds where the boundaries of reality melt away. Demons and abyssal creatures pour through the rift, threatening to consume everything.",
        "min_level": 20,
        "monsters": [
            {"name": "👿 Abyssal Imp", "hp": 220, "atk": 65, "def": 35, "xp": 130, "coins": (110, 170)},
            {"name": "🔥 Hellfire Hound", "hp": 260, "atk": 58, "def": 42, "xp": 140, "coins": (120, 180)},
            {"name": "💀 Doom Knight", "hp": 320, "atk": 55, "def": 50, "xp": 155, "coins": (130, 200)},
            {"name": "🌋 Magma Fiend", "hp": 280, "atk": 70, "def": 38, "xp": 145, "coins": (125, 190)},
            {"name": "👁️ Rift Stalker", "hp": 240, "atk": 75, "def": 30, "xp": 135, "coins": (115, 175)},
            {"name": "🐲 Abyssal Drake", "hp": 380, "atk": 60, "def": 55, "xp": 165, "coins": (140, 220)},
        ],
        "boss": {"name": "👹 Abyssal Overlord", "hp": 1800, "atk": 100, "def": 70, "xp": 1000, "coins": (1000, 2000)},
        "boss_chance": 0.05,
    },
    {
        "name": "🌋 Shadowfall Depths",
        "description": "A chaotic underground rift where shadows cascade in every direction. The boundary between worlds grows thin here, and creatures from the in-between stalk the ever-shifting darkness.",
        "min_level": 19,
        "monsters": [
            {"name": "🌑 Shadow Stalker", "hp": 280, "atk": 72, "def": 45, "xp": 140, "coins": (120, 190)},
            {"name": "👁️ Void Gazer", "hp": 240, "atk": 80, "def": 35, "xp": 135, "coins": (115, 180)},
            {"name": "🦇 Dread Bat", "hp": 200, "atk": 85, "def": 25, "xp": 125, "coins": (100, 160)},
            {"name": "🕸️ Rift Weaver", "hp": 320, "atk": 65, "def": 55, "xp": 150, "coins": (130, 200)},
        ],
        "boss": {"name": "🌑 Shadowlord", "hp": 1400, "atk": 95, "def": 65, "xp": 700, "coins": (700, 1400)},
        "boss_chance": 0.05,
        },
    {
        "name": "🌋 Molten Core",
        "description": "The heart of the world, where magma flows like rivers and ancient fire titans forge legendary weapons in the flames of creation. Only the strongest adventurers survive.",
        "min_level": 21,
        "monsters": [
            {"name": "🔥 Magma Titan", "hp": 400, "atk": 85, "def": 50, "xp": 180, "coins": (160, 250)},
            {"name": "🌋 Lava Serpent", "hp": 350, "atk": 95, "def": 40, "xp": 170, "coins": (150, 240)},
            {"name": "👹 Fire Giant", "hp": 500, "atk": 75, "def": 60, "xp": 200, "coins": (180, 280)},
            {"name": "🦂 Inferno Scorpion", "hp": 300, "atk": 100, "def": 35, "xp": 160, "coins": (140, 220)},
        ],
        "boss": {"name": "🌋 Ignis, The Eternal Flame", "hp": 2500, "atk": 120, "def": 80, "xp": 1500, "coins": (1500, 3000)},
        "boss_chance": 0.04,
    },
    {
        "name": "🌙 Moonlit Sanctum",
        "description": "A celestial temple bathed in eternal moonlight, hidden beyond the veil of night. Lunar guardians protect ancient secrets under the watchful gaze of the moon goddess.",
        "min_level": 22,
        "monsters": [
            {"name": "🌙 Lunar Sentinel", "hp": 450, "atk": 105, "def": 60, "xp": 200, "coins": (180, 280)},
            {"name": "⭐ Moonbeam Wisp", "hp": 380, "atk": 115, "def": 45, "xp": 190, "coins": (170, 260)},
            {"name": "🦇 Nightmare Bat", "hp": 420, "atk": 110, "def": 55, "xp": 195, "coins": (175, 270)},
            {"name": "🌑 Eclipse Shade", "hp": 500, "atk": 100, "def": 70, "xp": 210, "coins": (190, 290)},
        ],
        "boss": {"name": "🌕 Selene, Moon Goddess", "hp": 3000, "atk": 130, "def": 85, "xp": 1800, "coins": (1800, 3500)},
        "boss_chance": 0.04,
    },
    {
        "name": "🌿 Overgrown Ruins",
        "description": "Ancient ruins reclaimed by nature, where massive roots twist through crumbling stone and primal forest spirits guard forgotten treasures.",
        "min_level": 23,
        "monsters": [
            {"name": "🌿 Root Terror", "hp": 480, "atk": 110, "def": 65, "xp": 210, "coins": (190, 290)},
            {"name": "🪨 Stone Guardian", "hp": 600, "atk": 95, "def": 80, "xp": 220, "coins": (200, 300)},
            {"name": "🌸 Blight Bloom", "hp": 420, "atk": 120, "def": 50, "xp": 200, "coins": (180, 275)},
            {"name": "🦎 Thornback Drake", "hp": 550, "atk": 115, "def": 70, "xp": 230, "coins": (210, 310)},
        ],
        "boss": {"name": "🌳 Gaia, Primal Colossus", "hp": 3500, "atk": 140, "def": 90, "xp": 2000, "coins": (2000, 4000)},
        "boss_chance": 0.04,
    },
    {
        "name": "🏜️ Sunscorched Wastes",
        "description": "An endless desert where the sun beats down mercilessly and mirages dance on the scorching sand. Ancient ruins buried beneath the dunes hold treasures and terrors alike.",
        "min_level": 24,
        "monsters": [
            {"name": "🦂 Sand Scorpion", "hp": 620, "atk": 125, "def": 75, "xp": 240, "coins": (220, 330)},
            {"name": "🌊 Dust Devil Serpent", "hp": 580, "atk": 135, "def": 65, "xp": 235, "coins": (210, 320)},
            {"name": "🦂 Scorpion King", "hp": 700, "atk": 120, "def": 85, "xp": 255, "coins": (240, 350)},
            {"name": "👻 Mirage Wraith", "hp": 550, "atk": 140, "def": 60, "xp": 230, "coins": (200, 310)},
        ],
        "boss": {"name": "🌞 Solarius, The Undying Sun", "hp": 4000, "atk": 155, "def": 100, "xp": 2500, "coins": (2500, 5000)},
        "boss_chance": 0.03,
    },
        {
        "name": "🏔️ Glacial Citadel",
        "description": "An ancient fortress of ice and stone, buried deep within a mountain of eternal frost. The halls echo with the footsteps of forgotten warriors, and the throne room is guarded by the coldest heart in the realm.",
        "min_level": 25,
        "monsters": [
            {"name": "🧊 Frost Lich", "hp": 850, "atk": 150, "def": 95, "xp": 320, "coins": (300, 480)},
            {"name": "🐺 Dire Frost Wolf", "hp": 720, "atk": 165, "def": 80, "xp": 300, "coins": (280, 450)},
            {"name": "🗿 Glacier Golem", "hp": 1000, "atk": 130, "def": 120, "xp": 350, "coins": (320, 500)},
            {"name": "🦅 Blizzard Phoenix", "hp": 680, "atk": 175, "def": 70, "xp": 280, "coins": (250, 420)},
        ],
        "boss": {"name": "❄️ Aurora, The Eternal Winter", "hp": 5000, "atk": 180, "def": 130, "xp": 3500, "coins": (3500, 6000)},
        "boss_chance": 0.02,
    },
    {
        "name": "🌊 Abyssal Trench",
        "description": "The deepest point of the ocean, where sunlight never reaches and the weight of the sea itself can crush entire civilizations. Here dwells the most ancient entity the world has ever known.",
        "min_level": 26,
        "monsters": [
            {"name": "🐙 Abyssal Squidhound", "hp": 900, "atk": 180, "def": 90, "xp": 380, "coins": (350, 550)},
            {"name": "⛆ Deep Sea Wraith", "hp": 1100, "atk": 175, "def": 110, "xp": 420, "coins": (400, 600)},
            {"name": "🦞 Predator Croc Requiem", "hp": 1300, "atk": 170, "def": 130, "xp": 470, "coins": (450, 680)},
            {"name": "🕷️ Trench Digger Amalgam", "hp": 1000, "atk": 190, "def": 85, "xp": 400, "coins": (380, 580)},
            {"name": "🫧 Void Anglerfish", "hp": 950, "atk": 195, "def": 100, "xp": 390, "coins": (370, 560)},
            {"name": "🦈 Megalodon Breacher", "hp": 1200, "atk": 210, "def": 120, "xp": 450, "coins": (420, 650)},
        ],
        "boss": {"name": "🐙 The Scarred One", "hp": 6000, "atk": 200, "def": 160, "xp": 4000, "coins": (4000, 7500)},
        "boss_chance": 0.02,
    },
    {
        "name": "🌌 Astral Depths",
        "description": "Beyond the fabric of reality lies the Astral Depths — an infinite expanse of cosmic energy where stars are born and die in seconds.",
        "min_level": 27,
        "monsters": [
            {"name": "🌀 Astral Phantom", "hp": 1200, "atk": 210, "def": 140, "xp": 520, "coins": (500, 800)},
            {"name": "⭐ Stellar Construct", "hp": 1500, "atk": 195, "def": 180, "xp": 580, "coins": (550, 850)},
            {"name": "🌑 Void Wyrm", "hp": 1800, "atk": 225, "def": 160, "xp": 620, "coins": (600, 900)},
            {"name": "💫 Cosmic Horror", "hp": 1400, "atk": 250, "def": 120, "xp": 560, "coins": (520, 820)},
        ],
        "boss": {"name": "♾️ Infinity, The Primordial", "hp": 8000, "atk": 280, "def": 200, "xp": 5000, "coins": (5000, 10000)},
        "boss_chance": 0.01,
    },
    {
        "name": "🌌 Celestial Abyss",
        "description": "A rift between galaxies where raw cosmic creation energy swirls into being. Stars sing in frequencies that shatter mortal minds, and the architects of reality itself dwell here as silent overseers.",
        "min_level": 28,
        "monsters": [
            {"name": "🌌 Astral Leviathan", "hp": 2000, "atk": 310, "def": 220, "xp": 750, "coins": (700, 1100)},
            {"name": "⭐ Stellar Devourer", "hp": 2400, "atk": 290, "def": 260, "xp": 820, "coins": (780, 1200)},
            {"name": "🌀 Dimensional Riftbeast", "hp": 1800, "atk": 340, "def": 190, "xp": 700, "coins": (650, 1050)},
            {"name": "✨ Constellation Wraith", "hp": 2200, "atk": 320, "def": 240, "xp": 780, "coins": (720, 1150)},
            {"name": "🕳️ Singularity Worm", "hp": 2600, "atk": 360, "def": 210, "xp": 800, "coins": (750, 1180)},
            {"name": "🌠 Cosmic Remnant", "hp": 2100, "atk": 380, "def": 170, "xp": 760, "coins": (710, 1130)},
        ],
        "boss": {"name": "🌌 Aethera, The Cosmic Architect", "hp": 10000, "atk": 380, "def": 280, "xp": 7000, "coins": (7000, 14000)},
        "boss_chance": 0.01,
    },
    {
        "name": "🌌 Nebula Nexus",
        "description": "A convergence point of interstellar gases and energies, where new stars are born and ancient ones die in spectacular explosions.",
        "min_level": 30,
        "monsters": [
            {"name": "🌟 Stellar Nursery", "hp": 2200, "atk": 320, "def": 220, "xp": 750, "coins": (800, 1200)},
            {"name": "💫 Nova Burst", "hp": 2000, "atk": 350, "def": 200, "xp": 800, "coins": (850, 1250)},
            {"name": "🌠 Comet Traveller", "hp": 2400, "atk": 300, "def": 240, "xp": 700, "coins": (750, 1150)},
            {"name": "🪐 Astral Miner", "hp": 2600, "atk": 280, "def": 260, "xp": 850, "coins": (900, 1300)},
            {"name": "💫 Pulsar Beast", "hp": 2800, "atk": 360, "def": 280, "xp": 850, "coins": (900, 1400)},
            {"name": "☄️ Meteor Wyrm", "hp": 2600, "atk": 380, "def": 260, "xp": 880, "coins": (950, 1450)},
        ],
        "boss": {"name": "🌠 Nebulon, The Star Forger", "hp": 12000, "atk": 420, "def": 320, "xp": 9000, "coins": (9000, 18000)},
        "boss_chance": 0.008
    },
    {
        "name": "⏳ Chrono Sanctum",
        "description": "A realm where time fractures and folds upon itself. Past, present, and future collide in an endless loop, guarded by temporal wardens who have seen the birth and death of a thousand timelines.",
        "min_level": 29,
        "monsters": [
            {"name": "⏳ Temporal Shade", "hp": 3000, "atk": 380, "def": 300, "xp": 950, "coins": (1000, 1500)},
            {"name": "🕰️ Chrono Guardian", "hp": 3500, "atk": 350, "def": 350, "xp": 1000, "coins": (1100, 1600)},
            {"name": "🔮 Time Weaver", "hp": 2800, "atk": 420, "def": 280, "xp": 920, "coins": (950, 1450)},
            {"name": "🌀 Paradox Warden", "hp": 4000, "atk": 360, "def": 380, "xp": 1050, "coins": (1150, 1700)},
        ],
        "boss": {"name": "♾️ Chronos, The Time Lord", "hp": 15000, "atk": 450, "def": 360, "xp": 11000, "coins": (11000, 22000)},
        "boss_chance": 0.008,
    },
    {
        "name": "🌑 Void Nexus",
        "description": "A swirling vortex of nothingness where reality unravels. The fabric of existence frays at the edges, and entities from beyond the known universe stir in the darkness, waiting for the veil to tear completely.",
        "min_level": 31,
        "monsters": [
            {"name": "🌑 Void Walker", "hp": 4500, "atk": 420, "def": 380, "xp": 1100, "coins": (1300, 1900)},
            {"name": "⚫ Null Entity", "hp": 5000, "atk": 390, "def": 420, "xp": 1150, "coins": (1400, 2000)},
            {"name": "🌀 Entropy Beast", "hp": 4200, "atk": 460, "def": 350, "xp": 1080, "coins": (1250, 1850)},
            {"name": "🌪️ Chaos Harbinger", "hp": 4800, "atk": 440, "def": 390, "xp": 1180, "coins": (1350, 1950)},
        ],
        "boss": {"name": "👑 The Void Sovereign", "hp": 18000, "atk": 500, "def": 420, "xp": 14000, "coins": (14000, 28000)},
        "boss_chance": 0.007,
    },
    {
        "name": "⚡ Primordial Peak",
        "description": "The highest summit of creation, where the raw energy of the universe's birth still crackles through ancient stone. Primordial elementals and the architects of reality's foundation guard secrets older than time itself.",
        "min_level": 32,
        "monsters": [
            {"name": "⚡ Primordial Spark", "hp": 5500, "atk": 520, "def": 450, "xp": 1300, "coins": (1600, 2400)},
            {"name": "🌋 Magma Titan", "hp": 6000, "atk": 480, "def": 520, "xp": 1350, "coins": (1700, 2500)},
            {"name": "🌪️ Storm Avatar", "hp": 5200, "atk": 560, "def": 420, "xp": 1280, "coins": (1550, 2350)},
            {"name": "✨ Cosmic Warden", "hp": 5800, "atk": 540, "def": 480, "xp": 1400, "coins": (1650, 2450)},
        ],
        "boss": {"name": "⚡ Primordius, The First Born", "hp": 22000, "atk": 600, "def": 500, "xp": 18000, "coins": (18000, 36000)},
        "boss_chance": 0.006,
    }
]

# ═══════════════════════════════════════════════════════════════
# COG LOADING
# ═══════════════════════════════════════════════════════════════
# COG LOADING
# ═══════════════════════════════════════════════════════════════

async def load_extensions():
    """Load all cogs."""
    # Adventure gameplay belongs to the dedicated website-help bot. Loading the
    # legacy cog here caused duplicate commands and another players.json writer.
    cogs = ["cogs.music"]
    for cog in cogs:
        try:
            await bot.load_extension(cog)
            logger.info(f"Loaded cog: {cog}")
        except Exception as e:
            logger.error(f"Failed to load cog {cog}: {e}")

_started = False

def main():
    global _started, CLI_MODE
    if _started:
        logger.warning("main() called again — ignoring")
        return
    _started = True
    if len(sys.argv) >= 3 and sys.argv[1] == "announce":
        CLI_MODE = ("announce", sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "📢 DTEmpire Update")
        logger.info("CLI announce mode requested")
    if not BOT_TOKEN:
        logger.error("DISCORD_BOT_TOKEN not set!")
        sys.exit(1)
    logger.info("Starting HermesBot v2.0...")
    try:
        bot.run(BOT_TOKEN, reconnect=True)
    except Exception as e:
        logger.error(f"bot.run() exited with error: {e}")
        import traceback
        traceback.print_exc()
    logger.error("bot.run() RETURNED — this should not happen!")
    import time
    time.sleep(999)

if __name__ == "__main__":
    main()
