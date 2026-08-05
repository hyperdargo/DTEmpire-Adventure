#!/usr/bin/env python3
"""DTEmpire Adventure — Website Help Bot.

Support bot for the adventure WEBSITE only. No game commands, no general
commands — just how-to-play, FAQ, links, server status, updates and bug
reporting. Everything points at adventure.ankitgupta.com.np.

Run: python3 discord_bot.py  (token from DISCORD_BOT_TOKEN env / ~/.hermes/.env)
"""

import os, sys, json, asyncio
from pathlib import Path
import discord
from discord.ext import commands

# ── CONFIG ──
TOKEN = os.getenv("DISCORD_BOT_TOKEN", "")
if not TOKEN:
    env_path = Path.home() / ".hermes" / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("DISCORD_BOT_TOKEN="):
                TOKEN = line.split("=", 1)[1].strip().strip('"').strip("'")

BASE_DIR = Path(__file__).parent
PLAYERS_PATH = BASE_DIR / "data" / "players.json"
VERSION_PATH = BASE_DIR / "data" / "version.json"
SITE_URL = "https://adventure.ankitgupta.com.np"
UPDATES_CHANNEL_ID = int(os.getenv("ADVENTURE_UPDATES_CHANNEL_ID", "1531265353949253742"))
SUPPORT_CHANNEL_ID = int(os.getenv("ADVENTURE_SUPPORT_CHANNEL_ID", "0") or "0")

intents = discord.Intents.default()
bot = commands.Bot(command_prefix=None, intents=intents)  # slash-only: help bot, no prefix games


# ── HELPERS ──
def load_players():
    if not PLAYERS_PATH.exists():
        return {}
    try:
        return json.loads(PLAYERS_PATH.read_text())
    except (json.JSONDecodeError, OSError):
        return {}


def load_version():
    if not VERSION_PATH.exists():
        return {}
    try:
        return json.loads(VERSION_PATH.read_text())
    except (json.JSONDecodeError, OSError):
        return {}


def player_count():
    data = load_players()
    return len(data)


def site_up():
    """Cheap local health check — the web app and the bot share this host."""
    import socket
    try:
        with socket.create_connection(("127.0.0.1", 8081), timeout=3):
            return True
    except OSError:
        return False


def gold_embed(title, fields, footer=None):
    e = discord.Embed(title=title, color=discord.Color.from_str("#ffd54a"))
    for name, value in fields:
        e.add_field(name=name, value=value, inline=False)
    if footer:
        e.set_footer(text=footer)
    return e


# ── EVENTS ──
@bot.event
async def on_ready():
    print(f"✅ Adventure Help Bot online as {bot.user}")
    try:
        synced = await bot.tree.sync()
        print(f"   Synced {len(synced)} slash commands")
    except Exception as e:
        print(f"   Sync: {e}")


# ── COMMANDS — website support only ──
@bot.tree.command(name="help", description="List all website-help commands")
async def help_cmd(interaction: discord.Interaction):
    fields = [
        ("⚔️ /adventure", "Open DTEmpire Adventure"),
        ("📖 /guide", "How to play DTEmpire Adventure on the website"),
        ("❓ /faq", "Common questions & answers"),
        ("🌐 /website", "Links to the adventure website"),
        ("📊 /status", "Is the site up? Player count, version"),
        ("📰 /updates", "Latest website update notes"),
        ("🐛 /bug", "How to report a bug"),
        ("🆘 /support", "Where to get help"),
        ("📢 /announce", "Post a site update (admin only)"),
    ]
    e = gold_embed("🎮 DTEmpire Adventure — Website Help", fields,
                   footer="This bot is for website support only. All gameplay happens at the website.")
    await interaction.response.send_message(embed=e)


@bot.tree.command(name="website", description="Links to the adventure website")
async def website(interaction: discord.Interaction):
    e = gold_embed("🌐 DTEmpire Adventure", [
        ("Play now", f"[{SITE_URL}]({SITE_URL})"),
        ("What you need", "Just your Discord account — login with Discord, pick a class, start adventuring."),
        ("Works everywhere", "Play on any browser: phone, tablet, desktop. Progress is saved to your Discord ID."),
    ])
    await interaction.response.send_message(embed=e)


@bot.tree.command(name="adventure", description="Open DTEmpire Adventure")
async def adventure(interaction: discord.Interaction):
    e = gold_embed("⚔️ DTEmpire Adventure", [
        ("Play now", f"[{SITE_URL}]({SITE_URL})"),
        ("Commands", "Adventure gameplay runs on the website. No `>fish`, `>daily`, or other legacy text commands are required."),
    ], footer="Progress is saved to your Discord ID.")
    await interaction.response.send_message(embed=e)


@bot.tree.command(name="guide", description="How to play DTEmpire Adventure on the website")
async def guide(interaction: discord.Interaction):
    e = gold_embed("📖 Website Guide", [
        ("1. Register", f"Open **{SITE_URL}** and click **Login with Discord**. Your character is created on first login — no email, no password."),
        ("2. Adventure", "Hit the **Adventure** tab and fight monsters. Wins give XP, coins and loot. Cooldowns gate how fast you can fight — or buy the Auto-Grind pass to fight on its own for an hour."),
        ("3. Tower of Trials", "Climb the 100-floor tower. Bosses every 5th floor. Higher floors = better loot. Each floor needs a minimum player level."),
        ("4. Shop & Eggs", "Spend coins in the **Shop**. Every purchase rolls a random rarity. Mystery/Golden Eggs hatch into pets with random levels."),
        ("5. Pets", "Hatch eggs on the **Pets** page and equip pets for attack/defense bonuses. Sell unwanted pets for coins."),
        ("6. Duels", "Challenge other players on the **Duels** page. Rank up, win rewards, climb the PvP ladder."),
        ("7. Missions & Milestones", "Daily missions refresh every day. Reach leaderboard rank 1 or be the first to level 50 for one-time reward packages."),
    ], footer="Everything happens on the website — this bot only helps you find it.")
    await interaction.response.send_message(embed=e)


@bot.tree.command(name="faq", description="Common questions about the adventure website")
async def faq(interaction: discord.Interaction):
    e = gold_embed("❓ Frequently Asked Questions", [
        ("How do I register?", f"Go to **{SITE_URL}** → **Login with Discord**. Your account is created automatically and tied to your Discord ID."),
        ("Did I lose my progress?", "No — progress is saved server-side, keyed to your Discord ID. Log in with the same Discord account and it's all there."),
        ("Is there a level cap?", "No. Levels are unlimited — level 100 is not the end anymore. XP needed keeps growing (level N needs N×100 XP)."),
        ("How do I get coins?", "Adventure fights, tower floors, missions, duels, and selling pets. Spend them in the shop."),
        ("What are the eggs?", "Mystery Egg (200) and Golden Egg (1,000) from the shop. Buy them, then hatch them on the Pets page. Pet rarity and starting level are random."),
        ("How does Auto-Grind work?", "Buy the 5,000-coin pass on the Adventure page — it auto-fights the zone boss for one hour. Keep the Adventure tab open."),
        ("Why is my XP bar stuck?", "The bar fills by level — XP carries over between levels, so it always keeps filling."),
        ("Found a bug?", "Run **/bug** to see how to report it."),
    ])
    await interaction.response.send_message(embed=e)


@bot.tree.command(name="status", description="Website status: is it up, player count, version")
async def status(interaction: discord.Interaction):
    up = site_up()
    e = gold_embed("📊 Adventure Website Status", [
        ("Website", "🟢 Online" if up else "🔴 Offline"),
        ("Adventurers", f"{player_count()} registered"),
    ])
    v = load_version()
    if v.get("version"):
        e.add_field(name="Version", value=f"v{v.get('version')} — {v.get('name', '')}", inline=False)
    await interaction.response.send_message(embed=e)


@bot.tree.command(name="updates", description="Latest adventure website update notes")
async def updates(interaction: discord.Interaction):
    v = load_version()
    if not v.get("version"):
        await interaction.response.send_message("📰 No update notes yet.")
        return
    e = gold_embed(f"📰 {v.get('name', 'Update')} v{v.get('version', '?')}",
                   [("•", item) for item in v.get("changelog", [])],
                   footer=f"Updated: {v.get('updated', '?')}  — By Hermes")
    await interaction.response.send_message(embed=e)


@bot.tree.command(name="bug", description="How to report a website bug")
async def bug(interaction: discord.Interaction):
    support = f"<#{SUPPORT_CHANNEL_ID}>" if SUPPORT_CHANNEL_ID else "the support channel"
    e = gold_embed("🐛 Report a Bug", [
        ("Steps", f"1. Say what you were doing (which page/tab). 2. What happened vs what you expected. 3. Any error text or screenshot. 4. Post it in {support}."),
        ("Tip", "A screenshot of the page plus the exact error message makes bugs much faster to fix."),
    ])
    await interaction.response.send_message(embed=e)


@bot.tree.command(name="support", description="Where to get help with the website")
async def support(interaction: discord.Interaction):
    support = f"<#{SUPPORT_CHANNEL_ID}>" if SUPPORT_CHANNEL_ID else "a support channel"
    e = gold_embed("🆘 Get Help", [
        ("Website help", f"Ask in {support} — include what page you're on and what happened."),
        ("Latest news", f"Updates are posted in <#{UPDATES_CHANNEL_ID}>."),
        ("Self-serve", "Try /guide and /faq first — most questions are answered there."),
    ])
    await interaction.response.send_message(embed=e)


@bot.tree.command(name="announce", description="Post a website update announcement (admin only)")
async def announce(interaction: discord.Interaction, message: str, title: str = "📢 Announcement"):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ Admin only!", ephemeral=True)
        return
    channel = bot.get_channel(UPDATES_CHANNEL_ID)
    if not channel:
        await interaction.response.send_message(f"❌ Updates channel <#{UPDATES_CHANNEL_ID}> not found.", ephemeral=True)
        return
    e = gold_embed(title, [(" ", message)], footer="- By Hermes")
    await channel.send(embed=e)
    await interaction.response.send_message("✅ Posted to updates channel.", ephemeral=True)


# ── RUN ──
if __name__ == "__main__":
    if not TOKEN:
        print("❌ DISCORD_BOT_TOKEN not set"); sys.exit(1)

    async def main():
        async with bot:
            await bot.start(TOKEN)

    asyncio.run(main())
