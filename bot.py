#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════╗
║                    HERMES BOT v2.0                          ║
║           Multi-Tasking Discord Bot by Ankit                ║
║                                                              ║
║  Features: Auto-Mod, Welcome, Tickets, Music, Games,        ║
║            Logging, Watchdog, Self-Upgrade, Changelog       ║
║  Locked to home server. No DMs. Logs → central channel.     ║
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
    """Block ALL DMs. Only allow home server."""
    if ctx.guild is None:
        return False  # No DMs — ever
    if bot.home_guild_id and ctx.guild.id != bot.home_guild_id:
        return False
    return True

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

@bot.event
async def on_message(message):
    # Block ALL DMs
    if message.guild is None:
        return
    # Block other servers
    if bot.home_guild_id and message.guild.id != bot.home_guild_id:
        return
    # Ignore bots
    if message.author.bot:
        return

    # Auto-mod check (before commands)
    if automod_config["enabled"]:
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
        if "Already up to date" not in result.stdout:
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
        embed.add_field(name="`>adventurehelp`", value="Detailed adventure & RPG help", inline=False)
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
    embed = discord.Embed(
        title="🤖 HermesBot — Command Help",
        description="Multi-purpose Discord bot. Prefix: `>`\nLocked to this server. No DMs.\nUse `>help <category>` for details or `>adventurehelp` for RPG guide.",
        color=discord.Color.blurple(),
        timestamp=datetime.datetime.utcnow()
    )
    embed.add_field(name="📋 General",
        value="`>help` `>ping` `>uptime` `>status` `>serverinfo` `>serverstats` `>userinfo` `>avatar` `>latestnews`",
        inline=False)
    embed.add_field(name="🎮 Games",
        value="`>roll` `>coinflip` `>8ball` `>rps` `>trivia` `>guess` `>hack` `>fish` `>fishlb` `>fishstats`",
        inline=False)
    embed.add_field(name="⚔️ Adventure & RPG",
        value="`>adventure` `>profile` `>shop` `>buy` `>equip` `>inventory` `>heal` `>daily` `>locations` `>leaderboard` `>duel`\\n`>adventurehelp` — Full RPG guide",
        inline=False)
    embed.add_field(name="🎫 Tickets",
        value="`>ticket` `>close` `>add` `>remove`",
        inline=False)
    embed.add_field(name="🛡️ Auto-Mod",
        value="`>automod` — Bad words, caps, spam, invites",
        inline=False)
    embed.add_field(name="🔧 Utility",
        value="`>poll` `>say` `>purge` `>announce` `>remind`",
        inline=False)
    embed.add_field(name="⚙️ Admin",
        value="`>upgrade` `>restart` `>logs` `>setwelcome` `>setleave` `>eval`",
        inline=False)
    embed.add_field(name="🌐 Web Dashboard",
        value="Play in browser! Same data as Discord.\nPort **8081** — Open in your browser!",
        inline=False)
    embed.set_footer(text="HermesBot v2.0 | Everything is logged 🔒 | Use >help <category> for details")
    await ctx.send(embed=embed)

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
    player = get_player(ctx.guild.id, ctx.author.id)
    players = load_players()
    key = f"{ctx.guild.id}_{ctx.author.id}"

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

    # Level up check
    xp_needed = player["level"] * 50
    leveled_up = False
    while player["xp"] >= xp_needed:
        player["level"] += 1
        player["xp"] -= xp_needed
        player["max_health"] += 10
        player["health"] = player["max_health"]
        player["attack"] += 3
        player["defense"] += 2
        xp_needed = player["level"] * 50
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

def load_players():
    try:
        with open(PLAYER_FILE) as f:
            return json.load(f)
    except:
        return {}

def save_players(data):
    with open(PLAYER_FILE, "w") as f:
        json.dump(data, f, indent=2)

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
                {"id": "wooden_sword", "name": "🗡️ Wooden Sword", "attack": 5, "price": 50, "desc": "A basic wooden sword. +5 ATK"},
                {"id": "iron_sword", "name": "⚔️ Iron Sword", "attack": 12, "price": 150, "desc": "A sturdy iron blade. +12 ATK"},
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
            ],
            "armor": [
                {"id": "leather_armor", "name": "🥋 Leather Armor", "defense": 3, "price": 40, "desc": "Basic leather protection. +3 DEF"},
                {"id": "chainmail", "name": "⛓️ Chainmail", "defense": 8, "price": 120, "desc": "Linked metal rings. +8 DEF"},
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
            ],
            "potions": [
                {"id": "health_potion", "name": "❤️ Health Potion", "heal": 30, "price": 25, "desc": "Restores 30 HP"},
                {"id": "large_potion", "name": "💖 Large Potion", "heal": 75, "price": 60, "desc": "Restores 75 HP"},
                {"id": "elixir", "name": "🧪 Elixir", "heal": 200, "price": 150, "desc": "Fully restores HP"},
                {"id": "mega_elixir", "name": "💫 Mega Elixir", "heal": 500, "price": 350, "desc": "Heals 500 HP instantly"},
                {"id": "xp_potion", "name": "⭐ XP Potion", "xp_boost": 50, "price": 80, "desc": "Grants 50 XP"},
                {"id": "elixir_of_power", "name": "🧬 Elixir of Power", "xp_boost": 200, "price": 500, "desc": "Grants 200 XP instantly"},
                {"id": "time_warp_potion", "name": "⏳ Time Warp Potion", "xp_boost": 500, "price": 1200, "desc": "Bends spacetime for 500 XP"},
                {"id": "elixir_of_fortune", "name": "🍀 Elixir of Fortune", "xp_boost": 1000, "price": 2500, "desc": "Grants 1000 XP and doubles fishing rewards for 5 minutes"},
                {"id": "crystal_elixir", "name": "💎 Crystal Elixir", "heal": 1000, "price": 800, "desc": "A potent crystalline brew. Restores 1000 HP"},
                {"id": "elixir_of_the_gods", "name": "🌟 Elixir of the Gods", "xp_boost": 2500, "price": 5000, "desc": "Divine elixir. Grants 2500 XP instantly"},
                {"id": "abyssal_brew", "name": "🔥 Abyssal Brew", "heal": 2000, "price": 1500, "desc": "A fiery concoction from the Abyssal Rift. Restores 2000 HP"},
                {"id": "soul_elixir", "name": "💀 Soul Elixir", "xp_boost": 5000, "price": 8000, "desc": "Grants 5000 XP and fully restores HP"},
            ],
            "special": [
                {"id": "lucky_charm", "name": "🍀 Lucky Charm", "price": 200, "desc": "Increases rare drop chance"},
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
]

# Write adventure data to JSON cache for web dashboard
_adventure_cache = DATA_DIR / "adventure_locations.json"
with open(_adventure_cache, "w") as _acf:
    json.dump(ADVENTURE_LOCATIONS, _acf, indent=2)

# ── Commands ──

@bot.command(name="adventure", aliases=["adv", "explore", "fight"])
async def adventure(ctx):
    """Go on an adventure! Fight monsters, earn coins and XP."""
    player = get_player(ctx.guild.id, ctx.author.id)
    now = time.time()

    # Cooldown: 30 seconds between adventures
    if now - player.get("last_adventure", 0) < 30:
        remaining = int(30 - (now - player.get("last_adventure", 0)))
        return await ctx.send(f"⏳ You're catching your breath! Wait **{remaining}s** before your next adventure.")

    # Pick available locations based on level
    available = [loc for loc in ADVENTURE_LOCATIONS if loc["min_level"] <= player["level"]]
    if not available:
        return await ctx.send("❌ No adventures available at your level!")

    location = _rand.choice(available)

    # Determine if boss fight
    is_boss = _rand.random() < location["boss_chance"]
    if is_boss:
        enemy = location["boss"].copy()
        enemy["is_boss"] = True
    else:
        enemy = _rand.choice(location["monsters"]).copy()
        enemy["is_boss"] = False

    # Calculate player stats with equipment
    player_atk = player["attack"]
    player_def = player["defense"]
    if player.get("equipped_weapon"):
        shop = get_default_shop(ctx.guild.id)
        for w in shop["weapons"]:
            if w["id"] == player["equipped_weapon"]:
                player_atk += w["attack"]
                break
    if player.get("equipped_armor"):
        shop = get_default_shop(ctx.guild.id)
        for a in shop["armor"]:
            if a["id"] == player["equipped_armor"]:
                player_def += a["defense"]
                break

    # Combat simulation
    player_hp = player["health"]
    enemy_hp = enemy["hp"]
    rounds = 0
    combat_log = []

    while player_hp > 0 and enemy_hp > 0 and rounds < 20:
        rounds += 1
        # Player attacks
        dmg_to_enemy = max(1, player_atk - enemy["def"] + _rand.randint(-3, 3))
        enemy_hp -= dmg_to_enemy
        combat_log.append(f"⚔️ You deal **{dmg_to_enemy}** damage!")

        if enemy_hp <= 0:
            break

        # Enemy attacks
        dmg_to_player = max(1, enemy["atk"] - player_def + _rand.randint(-3, 3))
        player_hp -= dmg_to_player
        combat_log.append(f"💥 {enemy['name']} deals **{dmg_to_player}** damage to you!")

    # Determine outcome
    won = enemy_hp <= 0 and player_hp > 0

    if won:
        xp_gain = enemy["xp"] + _rand.randint(0, enemy["xp"] // 2)
        coin_gain = _rand.randint(enemy["coins"][0], enemy["coins"][1])

        player["xp"] += xp_gain
        player["coins"] += coin_gain
        player["health"] = max(1, player_hp)
        player["monsters_killed"] += 1
        player["adventures_completed"] += 1
        if is_boss:
            player["bosses_killed"] += 1

        # Level up check
        xp_needed = player["level"] * 50
        leveled_up = False
        while player["xp"] >= xp_needed:
            player["level"] += 1
            player["xp"] -= xp_needed
            player["max_health"] += 10
            player["health"] = player["max_health"]
            player["attack"] += 3
            player["defense"] += 2
            xp_needed = player["level"] * 50
            leveled_up = True

        player["last_adventure"] = now
        save_players(load_players())  # trigger save via get_player

        # Build result embed
        boss_tag = " 👑 BOSS" if is_boss else ""
        embed = discord.Embed(
            title=f"⚔️ Victory! — {location['name']}{boss_tag}",
            description=f"You defeated **{enemy['name']}** in **{rounds}** rounds!",
            color=discord.Color.gold() if is_boss else discord.Color.green(),
            timestamp=datetime.datetime.utcnow()
        )
        embed.add_field(name="Rewards", value=f"⭐ **+{xp_gain}** XP\n🪙 **+{coin_gain}** Coins", inline=True)
        embed.add_field(name="Status", value=f"❤️ HP: **{max(1, player_hp)}/{player['max_health']}**\n📊 Level: **{player['level']}**", inline=True)
        if leveled_up:
            embed.add_field(name="🎉 LEVEL UP!", value=f"You are now **Level {player['level']}**!\nATK +3 | DEF +2 | Max HP +10", inline=False)
        # Show last 4 combat lines
        if combat_log:
            embed.add_field(name="Combat", value="\n".join(combat_log[-4:]), inline=False)
        embed.set_footer(text=f"Monsters killed: {player['monsters_killed']} | Bosses: {player['bosses_killed']}")
        await ctx.send(embed=embed)

    else:
        # Player died
        player["deaths"] += 1
        player["health"] = player["max_health"] // 2  # Respawn with half HP
        player["coins"] = max(0, player["coins"] - 20)  # Lose some coins
        player["last_adventure"] = now

        embed = discord.Embed(
            title=f"💀 Defeated! — {location['name']}",
            description=f"You were slain by **{enemy['name']}** after **{rounds}** rounds...",
            color=discord.Color.red(),
            timestamp=datetime.datetime.utcnow()
        )
        embed.add_field(name="Penalty", value="🪙 Lost **20** coins\n❤️ Respawned with **half HP**", inline=True)
        embed.add_field(name="Stats", value=f"💀 Deaths: **{player['deaths']}**\n📊 Level: **{player['level']}**", inline=True)
        if combat_log:
            embed.add_field(name="Combat", value="\n".join(combat_log[-4:]), inline=False)
        embed.set_footer(text="Heal up and try again! Use >shop to buy potions.")
        await ctx.send(embed=embed)

    # Save player data
    players = load_players()
    key = f"{ctx.guild.id}_{ctx.author.id}"
    players[key] = player
    save_players(players)


@bot.command(name="profile", aliases=["me", "stats", "character"])
async def profile(ctx, member: discord.Member = None):
    """View your adventure profile and stats."""
    member = member or ctx.author
    player = get_player(ctx.guild.id, member.id)

    # Calculate equipment bonuses
    equip_text = []
    shop = get_default_shop(ctx.guild.id)
    if player.get("equipped_weapon"):
        for w in shop["weapons"]:
            if w["id"] == player["equipped_weapon"]:
                equip_text.append(f"⚔️ {w['name']} (+{w['attack']} ATK)")
                break
    if player.get("equipped_armor"):
        for a in shop["armor"]:
            if a["id"] == player["equipped_armor"]:
                equip_text.append(f"🛡️ {a['name']} (+{a['defense']} DEF)")
                break

    total_atk = player["attack"]
    total_def = player["defense"]
    if player.get("equipped_weapon"):
        for w in shop["weapons"]:
            if w["id"] == player["equipped_weapon"]:
                total_atk += w["attack"]
    if player.get("equipped_armor"):
        for a in shop["armor"]:
            if a["id"] == player["equipped_armor"]:
                total_def += a["defense"]

    xp_needed = player["level"] * 50
    xp_bar_filled = int((player["xp"] / xp_needed) * 10)
    xp_bar = "█" * xp_bar_filled + "░" * (10 - xp_bar_filled)

    embed = discord.Embed(
        title=f"👤 {member.display_name}'s Profile",
        color=discord.Color.blue(),
        timestamp=datetime.datetime.utcnow()
    )
    embed.set_thumbnail(url=member.avatar.url if member.avatar else None)

    embed.add_field(name="📊 Level", value=f"**{player['level']}**", inline=True)
    embed.add_field(name="⭐ XP", value=f"`{xp_bar}` {player['xp']}/{xp_needed}", inline=True)
    embed.add_field(name="🪙 Coins", value=f"**{player['coins']}**", inline=True)

    embed.add_field(name="❤️ Health", value=f"**{player['health']}/{player['max_health']}**", inline=True)
    embed.add_field(name="⚔️ Attack", value=f"**{total_atk}** (base {player['attack']})", inline=True)
    embed.add_field(name="🛡️ Defense", value=f"**{total_def}** (base {player['defense']})", inline=True)

    if equip_text:
        embed.add_field(name="🎒 Equipment", value="\n".join(equip_text), inline=False)

    embed.add_field(name="🏆 Stats",
        value=f"Monsters killed: **{player['monsters_killed']}**\nBosses slain: **{player['bosses_killed']}**\nAdventures: **{player['adventures_completed']}**\nDeaths: **{player['deaths']}**",
        inline=False)
    embed.set_footer(text="Use >adventure to fight! | >shop to buy gear")
    await ctx.send(embed=embed)


@bot.command(name="shop", aliases=["store", "market"])
async def shop(ctx, category: str = "all"):
    """Browse the shop. Categories: weapons, armor, potions, special, all."""
    shop_data = get_default_shop(ctx.guild.id)
    player = get_player(ctx.guild.id, ctx.author.id)

    cat_map = {
        "weapons": ("⚔️ Weapons", "weapons"),
        "weapon": ("⚔️ Weapons", "weapons"),
        "w": ("⚔️ Weapons", "weapons"),
        "armor": ("🛡️ Armor", "armor"),
        "a": ("🛡️ Armor", "armor"),
        "potions": ("🧪 Potions", "potions"),
        "potion": ("🧪 Potions", "potions"),
        "p": ("🧪 Potions", "potions"),
        "special": ("✨ Special Items", "special"),
        "s": ("✨ Special Items", "special"),
    }

    embed = discord.Embed(
        title="🏪 Hermes' Shop",
        description=f"Your coins: **🪙 {player['coins']}**\nUse `>buy <item_id>` to purchase!",
        color=discord.Color.gold(),
        timestamp=datetime.datetime.utcnow()
    )

    if category.lower() == "all":
        for cat_key, (cat_name, cat_id) in [("weapons", ("⚔️ Weapons", "weapons")), ("armor", ("🛡️ Armor", "armor")), ("potions", ("🧪 Potions", "potions")), ("special", ("✨ Special Items", "special"))]:
            items = shop_data.get(cat_id, [])
            item_text = ""
            for item in items:
                item_text += f"`{item['id']}` — **{item['name']}** — 🪙 {item['price']}\n  *{item['desc']}*\n"
            embed.add_field(name=cat_name, value=item_text or "Empty", inline=False)
    elif category.lower() in cat_map:
        cat_name, cat_id = cat_map[category.lower()]
        items = shop_data.get(cat_id, [])
        item_text = ""
        for item in items:
            item_text += f"`{item['id']}` — **{item['name']}** — 🪙 {item['price']}\n  *{item['desc']}*\n"
        embed.add_field(name=cat_name, value=item_text or "Empty", inline=False)
    else:
        return await ctx.send("❌ Categories: `weapons`, `armor`, `potions`, `special`, `all`")

    embed.set_footer(text="Use >buy <item_id> to purchase | >equip <item_id> to equip")
    await ctx.send(embed=embed)


@bot.command(name="buy")
async def buy(ctx, item_id: str):
    """Buy an item from the shop. Usage: >buy <item_id>"""
    shop_data = get_default_shop(ctx.guild.id)
    player = get_player(ctx.guild.id, ctx.author.id)
    players = load_players()
    key = f"{ctx.guild.id}_{ctx.author.id}"

    # Find item in any category
    found_item = None
    for cat in ["weapons", "armor", "potions", "special"]:
        for item in shop_data.get(cat, []):
            if item["id"] == item_id.lower():
                found_item = item
                break
        if found_item:
            break

    if not found_item:
        return await ctx.send(f"❌ Item `{item_id}` not found. Use `>shop` to see available items.")

    if player["coins"] < found_item["price"]:
        return await ctx.send(f"❌ Not enough coins! You need **🪙 {found_item['price']}** but only have **🪙 {player['coins']}**.")

    # Purchase
    player["coins"] -= found_item["price"]

    # Handle different item types
    if "heal" in found_item:
        # Potion — use immediately
        player["health"] = min(player["max_health"], player["health"] + found_item["heal"])
        players[key] = player
        save_players(players)
        await ctx.send(f"✅ Used **{found_item['name']}**! Restored **{found_item['heal']}** HP. ❤️ {player['health']}/{player['max_health']}")
    elif "xp_boost" in found_item:
        player["xp"] += found_item["xp_boost"]
        # Soul Elixir also heals
        if found_item["id"] == "soul_elixir":
            player["health"] = player["max_health"]
        players[key] = player
        save_players(players)
        msg = f"✅ Used **{found_item['name']}**! Gained **{found_item['xp_boost']}** XP!"
        if found_item["id"] == "soul_elixir":
            msg += f"\n❤️ Fully healed to {player['health']}/{player['max_health']}!"
        await ctx.send(msg)
    elif cat in ["weapons", "armor"]:
        # Add to inventory
        player["inventory"].append(found_item["id"])
        players[key] = player
        save_players(players)
        await ctx.send(f"✅ Bought **{found_item['name']}** for **🪙 {found_item['price']}**!\nUse `>equip {found_item['id']}` to equip it.")
    else:
        # Special items — apply permanent bonuses
        if found_item["id"] == "lucky_charm":
            player["inventory"].append(found_item["id"])
        elif found_item["id"] == "shield_ring":
            player["defense"] += 5
        elif found_item["id"] == "power_ring":
            player["attack"] += 5
        elif found_item["id"] == "life_crystal":
            player["max_health"] += 20
            player["health"] += 20
        elif found_item["id"] == "gravity_well":
            player["attack"] += 10
            player["defense"] += 10
        elif found_item["id"] == "enchanted_lure":
            player["inventory"].append(found_item["id"])
        elif found_item["id"] == "soul_gem":
            player["attack"] += 15
            player["defense"] += 15
            player["max_health"] += 30
            player["health"] += 30
        elif found_item["id"] == "dragon_heart":
            player["attack"] += 25
            player["defense"] += 25
            player["max_health"] += 50
            player["health"] += 50
        elif found_item["id"] == "celestial_blessing":
            player["attack"] += 40
            player["defense"] += 40
            player["max_health"] += 100
            player["health"] += 100
        elif found_item["id"] == "crystal_core":
            player["attack"] += 60
            player["defense"] += 60
            player["max_health"] += 150
            player["health"] += 150
        elif found_item["id"] == "essence_of_eternity":
            player["attack"] += 100
            player["defense"] += 100
            player["max_health"] += 250
            player["health"] += 250
        elif found_item["id"] == "abyssal_heart":
            player["attack"] += 150
            player["defense"] += 150
            player["max_health"] += 350
            player["health"] += 350
        elif found_item["id"] == "soul_stone":
            player["attack"] += 200
            player["defense"] += 200
            player["max_health"] += 500
            player["health"] += 500
        players[key] = player
        save_players(players)
        await ctx.send(f"✅ Bought **{found_item['name']}** for **🪙 {found_item['price']}!**\n*{found_item['desc']}*")


@bot.command(name="equip")
async def equip(ctx, item_id: str):
    """Equip a weapon or armor from your inventory."""
    player = get_player(ctx.guild.id, ctx.author.id)
    players = load_players()
    key = f"{ctx.guild.id}_{ctx.author.id}"
    shop_data = get_default_shop(ctx.guild.id)

    # Check if item is in inventory
    if item_id.lower() not in player["inventory"]:
        return await ctx.send(f"❌ You don't have `{item_id}` in your inventory. Buy it from `>shop` first!")

    # Find item in shop to determine type
    for item in shop_data.get("weapons", []):
        if item["id"] == item_id.lower():
            # Unequip current weapon
            player["equipped_weapon"] = item["id"]
            players[key] = player
            save_players(players)
            await ctx.send(f"⚔️ Equipped **{item['name']}**! (+{item['attack']} ATK)")
            return

    for item in shop_data.get("armor", []):
        if item["id"] == item_id.lower():
            player["equipped_armor"] = item["id"]
            players[key] = player
            save_players(players)
            await ctx.send(f"🛡️ Equipped **{item['name']}**! (+{item['defense']} DEF)")
            return

    await ctx.send(f"❌ `{item_id}` is not equippable.")


@bot.command(name="inventory", aliases=["inv", "bag"])
async def inventory(ctx):
    """View your inventory."""
    player = get_player(ctx.guild.id, ctx.author.id)
    shop_data = get_default_shop(ctx.guild.id)

    if not player["inventory"]:
        return await ctx.send("🎒 Your inventory is empty! Use `>shop` to buy items.")

    items_text = []
    # Count items
    from collections import Counter
    counts = Counter(player["inventory"])
    for item_id, count in counts.items():
        # Find item name
        name = item_id
        for cat in ["weapons", "armor", "potions", "special"]:
            for item in shop_data.get(cat, []):
                if item["id"] == item_id:
                    name = item["name"]
                    break
        count_text = f" x{count}" if count > 1 else ""
        items_text.append(f"• {name}{count_text}")

    embed = discord.Embed(
        title=f"🎒 {ctx.author.display_name}'s Inventory",
        description="\n".join(items_text[:30]),
        color=discord.Color.blue(),
        timestamp=datetime.datetime.utcnow()
    )
    equipped = []
    if player.get("equipped_weapon"):
        for w in shop_data.get("weapons", []):
            if w["id"] == player["equipped_weapon"]:
                equipped.append(f"⚔️ {w['name']}")
    if player.get("equipped_armor"):
        for a in shop_data.get("armor", []):
            if a["id"] == player["equipped_armor"]:
                equipped.append(f"🛡️ {a['name']}")
    if equipped:
        embed.add_field(name="Equipped", value="\n".join(equipped), inline=False)
    embed.set_footer(text="Use >equip <item_id> to equip weapons/armor")
    await ctx.send(embed=embed)


@bot.command(name="achievements", aliases=["achieve", "milestones"])
async def achievements(ctx, member: discord.Member = None):
    """View your adventure achievements and milestones."""
    member = member or ctx.author
    player = get_player(ctx.guild.id, member.id)

    # Define achievement tiers
    monster_milestones = [10, 25, 50, 100, 250, 500, 1000]
    boss_milestones = [1, 5, 10, 25, 50, 100]
    level_milestones = [5, 10, 15, 20, 25, 30, 50]
    adventure_milestones = [10, 50, 100, 250, 500, 1000]

    def get_achieved(value, milestones):
        return [m for m in milestones if value >= m]

    mon_achieved = get_achieved(player["monsters_killed"], monster_milestones)
    boss_achieved = get_achieved(player["bosses_killed"], boss_milestones)
    lvl_achieved = get_achieved(player["level"], level_milestones)
    adv_achieved = get_achieved(player["adventures_completed"], adventure_milestones)

    embed = discord.Embed(
        title=f"🏆 {member.display_name}'s Achievements",
        color=discord.Color.gold(),
        timestamp=datetime.datetime.utcnow()
    )

    # Monster kills
    mon_text = ""
    for m in monster_milestones:
        status = "✅" if m in mon_achieved else "⬜"
        mon_text += f"{status} {m} monsters killed\n"
    embed.add_field(name="⚔️ Monster Hunter", value=mon_text, inline=True)

    # Boss kills
    boss_text = ""
    for m in boss_milestones:
        status = "✅" if m in boss_achieved else "⬜"
        boss_text += f"{status} {m} bosses slain\n"
    embed.add_field(name="👑 Boss Slayer", value=boss_text, inline=True)

    # Level
    lvl_text = ""
    for m in level_milestones:
        status = "✅" if m in lvl_achieved else "⬜"
        lvl_text += f"{status} Reach Level {m}\n"
    embed.add_field(name="📊 Level Milestones", value=lvl_text, inline=True)

    # Adventures
    adv_text = ""
    for m in adventure_milestones:
        status = "✅" if m in adv_achieved else "⬜"
        adv_text += f"{status} {m} adventures\n"
    embed.add_field(name="🗺️ Explorer", value=adv_text, inline=True)

    # Summary
    total_achieved = len(mon_achieved) + len(boss_achieved) + len(lvl_achieved) + len(adv_achieved)
    total_possible = len(monster_milestones) + len(boss_milestones) + len(level_milestones) + len(adventure_milestones)
    embed.set_footer(text=f"Achievements: {total_achieved}/{total_possible} | Keep playing to unlock more!")
    await ctx.send(embed=embed)


@bot.command(name="duel")
async def duel(ctx, opponent: discord.Member = None):
    """Challenge another player to a duel! Usage: >duel @user"""
    if not opponent:
        return await ctx.send("❌ You need to mention someone to duel! Usage: `>duel @user`")
    if opponent.bot:
        return await ctx.send("❌ You can't duel a bot!")
    if opponent == ctx.author:
        return await ctx.send("❌ You can't duel yourself!")

    challenger = get_player(ctx.guild.id, ctx.author.id)
    defender = get_player(ctx.guild.id, opponent.id)

    # Calculate stats with equipment
    def calc_stats(player):
        atk = player["attack"]
        df = player["defense"]
        shop = get_default_shop(ctx.guild.id)
        if player.get("equipped_weapon"):
            for w in shop["weapons"]:
                if w["id"] == player["equipped_weapon"]:
                    atk += w["attack"]
                    break
        if player.get("equipped_armor"):
            for a in shop["armor"]:
                if a["id"] == player["equipped_armor"]:
                    df += a["defense"]
                    break
        return atk, df

    catk, cdef = calc_stats(challenger)
    datk, ddef = calc_stats(defender)

    # Simulate combat
    chp = challenger["health"]
    dhp = defender["health"]
    rounds = 0

    while chp > 0 and dhp > 0 and rounds < 30:
        rounds += 1
        dmg = max(1, catk - ddef + _rand.randint(-5, 5))
        dhp -= dmg
        if dhp <= 0:
            break
        dmg = max(1, datk - cdef + _rand.randint(-5, 5))
        chp -= dmg

    challenger_won = dhp <= 0 and chp > 0

    embed = discord.Embed(
        title="⚔️ Duel Results!",
        description=f"**{ctx.author.display_name}** vs **{opponent.display_name}**",
        color=discord.Color.gold() if challenger_won else discord.Color.red(),
        timestamp=datetime.datetime.utcnow()
    )
    embed.add_field(name="⚔️ Challenger", value=f"{ctx.author.mention}\nATK: {catk} | DEF: {cdef}\nHP: {challenger['health']}", inline=True)
    embed.add_field(name="🛡️ Defender", value=f"{opponent.mention}\nATK: {datk} | DEF: {ddef}\nHP: {defender['health']}", inline=True)
    embed.add_field(name="📊 Result", value=f"**{'🎉 ' + ctx.author.display_name + ' wins!' if challenger_won else '💀 ' + opponent.display_name + ' wins!'}**\nAfter {rounds} rounds of combat!", inline=False)
    await ctx.send(embed=embed)


@bot.command(name="heal")
async def heal(ctx):
    """Heal yourself (costs 10 coins)."""
    player = get_player(ctx.guild.id, ctx.author.id)
    players = load_players()
    key = f"{ctx.guild.id}_{ctx.author.id}"

    if player["health"] >= player["max_health"]:
        return await ctx.send("✅ You're already at full health!")

    if player["coins"] < 10:
        return await ctx.send("❌ Not enough coins! Healing costs **🪙 10**.")

    player["coins"] -= 10
    healed = min(player["max_health"] - player["health"], 30)
    player["health"] += healed
    players[key] = player
    save_players(players)
    await ctx.send(f"💚 Healed **{healed}** HP for **🪙 10**! ❤️ {player['health']}/{player['max_health']}")


@bot.command(name="daily")
async def daily(ctx):
    """Claim your daily reward."""
    player = get_player(ctx.guild.id, ctx.author.id)
    players = load_players()
    key = f"{ctx.guild.id}_{ctx.author.id}"
    now = time.time()

    if now - player.get("last_daily", 0) < 86400:
        remaining = int(86400 - (now - player.get("last_daily", 0)))
        h, m = divmod(remaining, 3600)
        m, s = divmod(m, 60)
        return await ctx.send(f"⏳ Daily reward available in **{h}h {m}m {s}s**!")

    # Scale reward with level
    base_coins = 50 + (player["level"] * 10)
    bonus_xp = 20 + (player["level"] * 5)

    # Random bonus
    bonus_roll = _rand.random()
    bonus_text = ""
    if bonus_roll < 0.05:
        bonus_coins = 500
        player["coins"] += bonus_coins
        bonus_text = f"🎉 JACKPOT! Bonus **🪙 {bonus_coins}** coins!"
    elif bonus_roll < 0.2:
        bonus_coins = 100
        player["coins"] += bonus_coins
        bonus_text = f"🍀 Lucky! Bonus **🪙 {bonus_coins}** coins!"

    player["coins"] += base_coins
    player["xp"] += bonus_xp
    player["last_daily"] = now
    players[key] = player
    save_players(players)

    embed = discord.Embed(
        title="🎁 Daily Reward!",
        description=f"**🪙 +{base_coins}** coins\n**⭐ +{bonus_xp}** XP",
        color=discord.Color.gold(),
        timestamp=datetime.datetime.utcnow()
    )
    if bonus_text:
        embed.add_field(name="Bonus!", value=bonus_text, inline=False)
    embed.set_footer(text="Come back tomorrow for more!")
    await ctx.send(embed=embed)


@bot.command(name="leaderboard", aliases=["lb", "top"])
async def leaderboard(ctx, category: str = "level"):
    """View the server leaderboard. Categories: level, coins, kills, bosses."""
    players = load_players()
    guild_players = {k: v for k, v in players.items() if str(v.get("guild_id")) == str(ctx.guild.id)}

    if not guild_players:
        return await ctx.send("❌ No players found. Start playing with `>adventure`!")

    cat_map = {
        "level": ("📊 Level", "level", True),
        "coins": ("🪙 Coins", "coins", True),
        "kills": ("⚔️ Monsters Killed", "monsters_killed", True),
        "bosses": ("👑 Bosses Slain", "bosses_killed", True),
        "deaths": ("💀 Deaths", "deaths", True),
        "adventures": ("🗺️ Adventures", "adventures_completed", True),
    }

    if category.lower() not in cat_map:
        return await ctx.send("❌ Categories: `level`, `coins`, `kills`, `bosses`, `deaths`, `adventures`")

    cat_name, cat_key, reverse = cat_map[category.lower()]
    sorted_players = sorted(guild_players.values(), key=lambda x: x.get(cat_key, 0), reverse=reverse)[:10]

    lines = []
    medals = ["🥇", "🥈", "🥉"]
    for i, p in enumerate(sorted_players):
        medal = medals[i] if i < 3 else f"`{i+1}.`"
        # Try to get member name
        member = ctx.guild.get_member(p["user_id"])
        name = member.display_name if member else f"User#{p['user_id']}"
        lines.append(f"{medal} **{name}** — {p.get(cat_key, 0)}")

    embed = discord.Embed(
        title=f"🏆 Leaderboard — {cat_name}",
        description="\n".join(lines) or "No data yet!",
        color=discord.Color.gold(),
        timestamp=datetime.datetime.utcnow()
    )
    embed.set_footer(text=f"Category: {category} | Use >leaderboard <category>")
    await ctx.send(embed=embed)


@bot.command(name="locations", aliases=["areas", "zones"])
async def locations(ctx):
    """View all adventure locations and their requirements."""
    player = get_player(ctx.guild.id, ctx.author.id)
    embed = discord.Embed(
        title="🗺️ Adventure Locations",
        description="Travel to different areas to fight monsters and earn rewards!",
        color=discord.Color.blue(),
        timestamp=datetime.datetime.utcnow()
    )
    for loc in ADVENTURE_LOCATIONS:
        locked = "🔒" if player["level"] < loc["min_level"] else "✅"
        monsters = ", ".join(m["name"] for m in loc["monsters"])
        embed.add_field(
            name=f"{locked} {loc['name']} (Lv.{loc['min_level']}+)",
            value=f"{loc['description']}\nMonsters: {monsters}\nBoss: {loc['boss']['name']}",
            inline=False
        )
    embed.set_footer(text=f"Your level: {player['level']} | Use >adventure to explore!")
    await ctx.send(embed=embed)


@bot.command(name="adventurehelp", aliases=["advhelp", "rpghelp", "howtoplay"])
async def adventure_help(ctx):
    """Full guide to the Adventure & RPG system."""
    embed = discord.Embed(
        title="⚔️ Adventure & RPG — Complete Guide",
        description="Fight monsters, earn coins & XP, buy gear, and become the strongest!",
        color=discord.Color.gold(),
        timestamp=datetime.datetime.utcnow()
    )

    embed.add_field(
        name="🎮 Getting Started",
        value=(
            "1. Use `>adventure` to go on an adventure (30s cooldown)\n"
            "2. Fight monsters to earn ⭐ XP and 🪙 Coins\n"
            "3. Level up to unlock new areas and get stronger\n"
            "4. Use `>shop` to buy weapons, armor, and potions\n"
            "5. Use `>equip` to gear up and fight harder enemies!"
        ),
        inline=False
    )

    embed.add_field(
        name="⚔️ Combat System",
        value=(
            "• Combat is automatic — you and the monster take turns\n"
            "• Your damage = `ATK - enemy DEF` (with some randomness)\n"
            "• Equip weapons to increase ATK, armor to increase DEF\n"
            "• If you die, you lose 20 coins and respawn with half HP\n"
            "• Boss fights give much better rewards but are harder!"
        ),
        inline=False
    )

    embed.add_field(
        name="📊 Leveling",
        value=(
            "• XP needed to level = `Level × 50`\n"
            "• Each level: **+3 ATK, +2 DEF, +10 Max HP**\n"
            "• Higher levels unlock tougher areas with better loot\n"
            "• Use `>profile` to see your stats and XP progress"
        ),
        inline=False
    )

    embed.add_field(
        name="🗺️ Locations",
        value=(
            "Use `>locations` to see all areas!\\n"
            "• 🌲 **Dark Forest** (Lv.1) — Wolves, Spiders, Ghosts\\n"
            "• 🌸 **Enchanted Garden** (Lv.3) — Flower Sprites, Fairy Dragons\\n"
            "• 🏔️ **Frozen Mountains** (Lv.5) — Ice Elementals, Polar Bears\\n"
            "• 🌊 **Sunken Depths** (Lv.8) — Krakens, Sirens, Shark Warriors\\n"
            "• 🌋 **Volcanic Caverns** (Lv.10) — Fire Imps, Magma Beasts\\n"
            "• 🌅 **Celestial Spire** (Lv.12) — Winged Sentinels, Solar Wraiths\\n"
            "• 🌪️ **Storm Peaks** (Lv.14) — Storm Elementals, Thunder Rocs\\n"
            "• 🏰 **Abandoned Castle** (Lv.15) — Dark Knights, Vampires\\n"
            "• 💀 **Cursed Catacombs** (Lv.17) — Skeleton Warriors, Wraiths\\n"
            "• 🌌 **The Void** (Lv.20) — Void Watchers, Chaos Entities"
        ),
        inline=False
    )

    embed.add_field(
        name="🏪 Shop & Items",
        value=(
            "`>shop all` — View everything\n"
            "`>shop weapons` — Browse weapons\n"
            "`>shop armor` — Browse armor\n"
            "`>shop potions` — Browse potions\n"
            "`>shop special` — Browse special items\n"
            "`>buy <item_id>` — Purchase an item\n"
            "`>equip <item_id>` — Equip weapon/armor\n"
            "`>inventory` — View your items"
        ),
        inline=False
    )

    embed.add_field(
        name="💰 Economy",
        value=(
            "• Kill monsters → earn coins\n"
            "• `>daily` — Free daily reward (scales with level, 5% jackpot chance!)\n"
            "• `>heal` — Restore 30 HP for 10 coins\n"
            "• Die → lose 20 coins\n"
            "• `>leaderboard coins` — See who's the richest!"
        ),
        inline=False
    )

    embed.add_field(
        name="🏆 Leaderboards",
        value=(
            "`>leaderboard level` — Top levels\n"
            "`>leaderboard coins` — Richest players\n"
            "`>leaderboard kills` — Most monsters killed\n"
            "`>leaderboard bosses` — Most bosses slain\n"
            "`>leaderboard deaths` — Most deaths (oops)\n"
            "`>leaderboard adventures` — Most adventures"
        ),
        inline=False
    )

    embed.add_field(
        name="🌐 Web Dashboard",
        value=(
            "Play the same game in your browser with a nice UI!\n"
            "Same data, same account — just open port **8081**!\n"
            "Adventure, shop, equip, and more from your browser."
        ),
        inline=False
    )

    embed.set_footer(text="Tip: Start with >adventure and work your way up! Good luck, adventurer! ⚔️")
    await ctx.send(embed=embed)


@bot.command(name="fishlb", aliases=["fishleaderboard", "fishingtop", "castlb"])
async def fish_leaderboard(ctx):
    """View the fishing leaderboard — top anglers by total catches and legendary hauls."""
    players = load_players()
    guild_players = {k: v for k, v in players.items() if str(v.get("guild_id")) == str(ctx.guild.id)}

    if not guild_players:
        return await ctx.send("❌ No fishing data yet. Start fishing with `>fish`!")

    # Sort by fish_caught (fish count), then by fish_legendary
    sorted_p = sorted(
        guild_players.values(),
        key=lambda x: (x.get("fish_caught", 0), x.get("fish_legendary", 0)),
        reverse=True
    )[:10]

    lines = []
    medals = ["🥇", "🥈", "🥉"]
    for i, p in enumerate(sorted_p):
        medal = medals[i] if i < 3 else f"`{i+1}.`"
        member = ctx.guild.get_member(p["user_id"])
        name = member.display_name if member else f"User#{p['user_id']}"
        caught = p.get("fish_caught", 0)
        legendary = p.get("fish_legendary", 0)
        lines.append(f"{medal} **{name}** — 🎣 {caught} catches | ⭐ {legendary} legendary")

    embed = discord.Embed(
        title="🎣 Fishing Leaderboard",
        description="\n".join(lines) or "No data yet!",
        color=discord.Color.blue(),
        timestamp=datetime.datetime.utcnow(),
    )
    embed.set_footer(text="Use >fish to catch fish and climb the ranks!")
    await ctx.send(embed=embed)


@bot.command(name="fishstats", aliases=["myfish", "fishingstats", "caststats"])
async def fish_stats(ctx):
    """View your personal fishing statistics."""
    player = get_player(ctx.guild.id, ctx.author.id)

    caught = player.get("fish_caught", 0)
    legendary = player.get("fish_legendary", 0)
    coins_from_fishing = player.get("fish_coins", 0)

    # Calculate rarity breakdown (estimated from total and legendary)
    epic_est = max(0, int(caught * 0.04))
    rare_est = max(0, int(caught * 0.10))
    uncommon_est = max(0, int(caught * 0.25))
    common_est = max(0, caught - legendary - epic_est - rare_est - uncommon_est)

    embed = discord.Embed(
        title=f"🎣 {ctx.author.display_name}'s Fishing Stats",
        color=discord.Color.blue(),
        timestamp=datetime.datetime.utcnow(),
    )
    embed.add_field(name="🎣 Total Catches", value=f"**{caught}**", inline=True)
    embed.add_field(name="⭐ Legendary Catches", value=f"**{legendary}**", inline=True)
    embed.add_field(name="🪙 Coins from Fishing", value=f"**{coins_from_fishing}**", inline=True)

    rarity_text = (
        f"⚪ Common: ~{common_est}\n"
        f"🟢 Uncommon: ~{uncommon_est}\n"
        f"🔵 Rare: ~{rare_est}\n"
        f"🟣 Epic: ~{epic_est}\n"
        f"🟡 Legendary: ~{legendary}"
    )
    embed.add_field(name="📊 Rarity Breakdown", value=rarity_text, inline=True)

    # Best catch estimate
    if legendary > 0:
        embed.add_field(name="🏆 Best Catch", value="Mermaid's Tear (1000-2000 coins)", inline=True)
    elif epic_est > 0:
        embed.add_field(name="🏆 Best Catch", value="Sea Crown (200-400 coins)", inline=True)
    elif rare_est > 0:
        embed.add_field(name="🏆 Best Catch", value="Ancient Coin (80-150 coins)", inline=True)
    else:
        embed.add_field(name="🏆 Best Catch", value="Keep fishing!", inline=True)

    embed.set_footer(text="Use >fish to catch more! Cooldown: 60s")
    await ctx.send(embed=embed)


# ═══════════════════════════════════════════════════════════════
# ADMIN COMMANDS
# ═══════════════════════════════════════════════════════════════

@bot.command(name="upgrade")
@commands.is_owner()
async def upgrade_cmd(ctx):
    await ctx.send("🔄 Checking for updates...")
    try:
        result = subprocess.run(["git", "pull"], capture_output=True, text=True, timeout=30, cwd=str(BASE_DIR))
        if "Already up to date" in result.stdout:
            await ctx.send("✅ Already up to date!")
        else:
            await ctx.send(f"✅ Updated! Restarting...\n```{result.stdout[:300]}```")
            await bot.close()
            os.execv(sys.executable, [sys.executable] + sys.argv)
    except Exception as e:
        await ctx.send(f"❌ Error: {e}")

@bot.command(name="restart")
@commands.is_owner()
async def restart_cmd(ctx):
    await ctx.send("🔄 Restarting...")
    await bot.close()
    os.execv(sys.executable, [sys.executable] + sys.argv)

@bot.command(name="logs")
@commands.is_owner()
async def logs_cmd(ctx, lines: int = 20):
    log_file = LOG_DIR / "bot.log"
    if not log_file.exists(): return await ctx.send("No logs.")
    with open(log_file) as f:
        recent = f.readlines()[-lines:]
    await ctx.send(f"```{''.join(recent)[-1900:]}```")

@bot.command(name="eval")
@commands.is_owner()
async def eval_cmd(ctx, *, code: str):
    """Evaluate Python code (owner only)."""
    try:
        result = eval(code)
        await ctx.send(f"```{result}```")
    except Exception as e:
        await ctx.send(f"❌ {e}")

# ═══════════════════════════════════════════════════════════════
# COG LOADING
# ═══════════════════════════════════════════════════════════════

async def load_extensions():
    """Load all cogs."""
    cogs = ["cogs.music"]
    for cog in cogs:
        try:
            await bot.load_extension(cog)
            logger.info(f"Loaded cog: {cog}")
        except Exception as e:
            logger.error(f"Failed to load cog {cog}: {e}")

_started = False

def main():
    global _started
    if _started:
        logger.warning("main() called again — ignoring")
        return
    _started = True
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
