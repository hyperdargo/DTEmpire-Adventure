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
            "🎫 Ticket system (!ticket, !close, !add, !remove)",
            "👋 Welcome/Leave messages with custom channel",
            "🎮 Games (roll, coinflip, 8ball, rps, trivia, guess, hack)",
            "📊 Centralized logging to #hermes-logs",
            "🔄 Self-upgrade via git pull + restart",
            "📰 !latestnews command for changelog",
            "🖥️ System status monitoring",
            "🔒 Server-locked, no DMs allowed",
            "📝 !purge, !poll, !remind, !say, !avatar commands",
        ]
    }
]

# ═══════════════════════════════════════════════════════════════
# BOT SETUP
# ═══════════════════════════════════════════════════════════════

intents = discord.Intents.all()  # Need all intents for logging + auto-mod

bot = commands.Bot(command_prefix="!", intents=intents, help_command=None)
bot.start_time = time.time()
bot.home_guild_id = HOME_GUILD_ID
bot.log_channel_id = LOG_CHANNEL_ID

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
    "!help to summon my power 📖",
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
    embed.add_field(name="Prefix", value="`!`", inline=True)
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
    embed.set_footer(text="Use !help to see all commands")
    await ctx.send(embed=embed)

@bot.command(name="help")
async def help_cmd(ctx):
    """Show all available commands."""
    embed = discord.Embed(
        title="🤖 HermesBot — Command Help",
        description="Multi-purpose Discord bot. Prefix: `!`\nLocked to this server. No DMs.",
        color=discord.Color.blurple(),
        timestamp=datetime.datetime.utcnow()
    )
    embed.add_field(name="📋 General",
        value="`!help` `!ping` `!uptime` `!status` `!serverinfo` `!userinfo [@user]` `!avatar [@user]` `!latestnews`",
        inline=False)
    embed.add_field(name="🎵 Music",
        value="`!play <query>` `!pause` `!resume` `!skip` `!stop` `!queue` `!nowplaying` `!volume <0-100>` `!loop` `!shuffle`",
        inline=False)
    embed.add_field(name="🎮 Games",
        value="`!roll [NdN]` `!coinflip` `!8ball <q>` `!rps <choice>` `!trivia` `!guess` `!hack [@user]`",
        inline=False)
    embed.add_field(name="🎫 Tickets",
        value="`!ticket <subject>` `!close` `!add <@user>` `!remove <@user>`",
        inline=False)
    embed.add_field(name="🛡️ Auto-Mod",
        value="`!automod` `!automod toggle` `!automod badwords <add|remove> <word>` `!automod caps <percent>` `!automod mentions <count>`",
        inline=False)
    embed.add_field(name="🔧 Utility",
        value="`!poll <question>` `!say <msg>` `!purge <count>` `!announce <msg>` `!remind <time> <msg>`",
        inline=False)
    embed.add_field(name="⚙️ Admin",
        value="`!upgrade` `!restart` `!logs [lines]` `!setwelcome <#channel>` `!setleave <#channel>` `!eval <code>`",
        inline=False)
    embed.set_footer(text="HermesBot v2.0 | Everything is logged 🔒")
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
        return await ctx.send("❌ Format: `!remind 10s|5m|1h|1d <message>`")
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
    embed.add_field(name="Commands", value="`!close` — Close ticket\n`!add @user` — Add user\n`!remove @user` — Remove user")
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
    """Auto-mod management. Usage: !automod [toggle|badwords|caps|mentions]"""
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
            await ctx.send("❌ Use: `!automod badwords add|remove <word>`")

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
        await ctx.send("❌ Usage: `!automod [toggle|status|badwords add/remove <word>|caps <n>|mentions <n>]`")

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
        await ctx.send("❌ Format: `!roll NdN` (e.g., `!roll 2d6`)")

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

def main():
    if not BOT_TOKEN:
        logger.error("DISCORD_BOT_TOKEN not set!")
        sys.exit(1)
    logger.info("Starting HermesBot v2.0...")
    # Load cogs synchronously before running
    loop = asyncio.new_event_loop()
    loop.run_until_complete(load_extensions())
    loop.close()
    bot.run(BOT_TOKEN)

if __name__ == "__main__":
    main()
