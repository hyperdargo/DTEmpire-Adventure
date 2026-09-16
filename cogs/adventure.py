"""Adventure game slash commands — fight, dungeon, tower, duels, status, leaderboard."""
import discord
from discord.ext import commands
from discord import app_commands
import json, random, time, math
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
PLAYERS_FILE = DATA_DIR / "players.json"

# Adventure save lives in the home guild world — same data as the web dashboard.
HOME_GUILD_ID = 1454372389692641444

def load_players():
    try:
        with open(PLAYERS_FILE) as f: return json.load(f)
    except: return {}
def save_players(data):
    with open(PLAYERS_FILE, "w") as f: json.dump(data, f, indent=2)
def get_player(guild_id, user_id):
    p = load_players()
    key = f"{guild_id}_{user_id}"
    if key not in p:
        p[key] = {
            "name": "", "level": 1, "xp": 0, "coins": 100, "health": 100, "max_health": 100,
            "attack": 10, "defense": 5, "monsters_killed": 0, "deaths": 0, "dungeon_floor": 1,
            "tower_floor": 1, "inventory": [], "last_adventure": 0, "highest_floor": 1,
        }
        save_players(p)
    return p[key]
def save_player(guild_id, user_id, data):
    p = load_players()
    p[f"{guild_id}_{user_id}"] = data
    save_players(p)

ADVENTURE_LOCATIONS = [
    {"name":"Whispering Woods","emoji":"🌲","min_level":1,"boss_chance":0.08,
     "monsters":[{"name":"Slime","hp":20,"atk":3,"coins":[3,6],"xp":4},{"name":"Goblin Scout","hp":25,"atk":4,"coins":[4,8],"xp":5},{"name":"Wolf","hp":30,"atk":5,"coins":[5,10],"xp":6}],
     "boss":{"name":"Forest Troll","hp":60,"atk":8,"coins":[15,25],"xp":15}},
    {"name":"Crystal Caverns","emoji":"💎","min_level":5,"boss_chance":0.1,
     "monsters":[{"name":"Crystal Beetle","hp":40,"atk":7,"coins":[7,12],"xp":9},{"name":"Shadow Bat","hp":35,"atk":8,"coins":[6,11],"xp":8},{"name":"Rock Golem","hp":60,"atk":6,"coins":[9,15],"xp":12}],
     "boss":{"name":"Crystal Wyrm","hp":120,"atk":15,"coins":[30,50],"xp":35}},
    {"name":"Frozen Tundra","emoji":"❄️","min_level":12,"boss_chance":0.12,
     "monsters":[{"name":"Ice Wolf","hp":70,"atk":12,"coins":[12,20],"xp":15},{"name":"Yeti","hp":90,"atk":10,"coins":[15,25],"xp":18},{"name":"Frost Elemental","hp":80,"atk":14,"coins":[14,22],"xp":20}],
     "boss":{"name":"Winter Sovereign","hp":200,"atk":25,"coins":[60,100],"xp":60}},
    {"name":"Volcanic Caverns","emoji":"🌋","min_level":20,"boss_chance":0.15,
     "monsters":[{"name":"Lava Hound","hp":100,"atk":18,"coins":[20,35],"xp":25},{"name":"Fire Imp","hp":85,"atk":20,"coins":[18,30],"xp":22},{"name":"Magma Golem","hp":140,"atk":16,"coins":[25,40],"xp":30}],
     "boss":{"name":"Ifrit, Flame Lord","hp":350,"atk":40,"coins":[120,200],"xp":120}},
]

class Adventure(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="status", description="View your adventure stats")
    async def status(self, interaction: discord.Interaction):
        player = get_player(HOME_GUILD_ID, interaction.user.id)
        if not player.get("name"):
            player["name"] = interaction.user.display_name
            save_player(HOME_GUILD_ID, interaction.user.id, player)
        embed = discord.Embed(title=f"⚔️ {player.get('name', interaction.user.display_name)}", color=0xffd54a)
        embed.add_field(name="Level", value=f"**{player['level']}**", inline=True)
        embed.add_field(name="XP", value=f"{player.get('xp',0)}/{player['level']*100}", inline=True)
        embed.add_field(name="HP", value=f"{player.get('health',100)}/{player.get('max_health',100)}", inline=True)
        embed.add_field(name="Coins", value=f"🪙 {player.get('coins',0)}", inline=True)
        embed.add_field(name="ATK/DEF", value=f"⚔️ {player.get('attack',10)}/🛡️ {player.get('defense',5)}", inline=True)
        embed.add_field(name="Floor", value=f"🏚️ D{player.get('dungeon_floor',1)} 🗼 T{player.get('tower_floor',1)}", inline=True)
        embed.set_footer(text="DTEmpire Adventure")
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="fight", description="Fight monsters in the wild")
    async def fight(self, interaction: discord.Interaction):
        player = get_player(HOME_GUILD_ID, interaction.user.id)
        now = time.time()
        if now - player.get("last_adventure", 0) < 3:
            await interaction.response.send_message("⏳ Cooldown! Wait a moment.", ephemeral=True)
            return
        available = [loc for loc in ADVENTURE_LOCATIONS if loc["min_level"] <= player["level"]]
        if not available:
            await interaction.response.send_message("❌ No locations available.", ephemeral=True)
            return
        loc = random.choice(available)
        is_boss = random.random() < loc["boss_chance"]
        enemy = (loc["boss"].copy() if is_boss else random.choice(loc["monsters"]).copy())
        # Simple combat
        p_atk = player.get("attack", 10)
        p_def = player.get("defense", 5)
        e_hp, e_atk = enemy["hp"], enemy.get("atk", 5)
        won = False
        for _ in range(50):
            dmg = max(1, p_atk + random.randint(-3, 5))
            e_hp -= dmg
            if e_hp <= 0: won = True; break
            dmg = max(1, e_atk - p_def // 2 + random.randint(-3, 5))
            player["health"] = max(0, player.get("health", 100) - dmg)
            if player["health"] <= 0: break
        if won:
            coins = random.randint(*(enemy.get("coins", [5, 10]) if isinstance(enemy.get("coins"), list) else [5, 10]))
            xp = enemy.get("xp", 5)
            player["coins"] = player.get("coins", 0) + coins
            player["xp"] = player.get("xp", 0) + xp
            player["monsters_killed"] = player.get("monsters_killed", 0) + 1
            msg = f"✅ **Victory!** Defeated **{enemy['name']}** 🪙+{coins} ⭐+{xp} XP"
            # Level up check (cap 100)
            while player["xp"] >= player["level"] * 100 and player["level"] < 100:
                player["xp"] -= player["level"] * 100
                player["level"] += 1
                player["max_health"] = player.get("max_health", 100) + 10
                player["health"] = player["max_health"]
                player["attack"] += 3
                player["defense"] += 2
                msg += f"\n⬆️ **LEVEL UP!** You are now **Lv.{player['level']}**!"
        else:
            msg = f"💀 **Defeated** by {enemy['name']}! Rest to heal."
            player["deaths"] = player.get("deaths", 0) + 1
        player["last_adventure"] = now
        save_player(HOME_GUILD_ID, interaction.user.id, player)
        await interaction.response.send_message(msg)

    @app_commands.command(name="dungeon", description="Challenge the 100-floor dungeon")
    async def dungeon(self, interaction: discord.Interaction):
        player = get_player(HOME_GUILD_ID, interaction.user.id)
        floor = player.get("dungeon_floor", 1)
        if floor > 100:
            await interaction.response.send_message("🏆 Dungeon complete! All 100 floors conquered!")
            return
        won = random.random() < max(0.15, min(0.85, 0.5 + (player["level"] - floor) * 0.03))
        if won:
            coins = 10 + floor * 2 + random.randint(0, floor)
            xp = 8 + floor * 3
            player["dungeon_floor"] = floor + 1
            player["coins"] = player.get("coins", 0) + coins
            player["xp"] = player.get("xp", 0) + xp
            msg = f"⚔️ **Floor {floor} cleared!** Floor {floor+1} unlocked! 🪙+{coins} ⭐+{xp} XP"
        else:
            dmg = random.randint(10, 30)
            player["health"] = max(0, player.get("health", 100) - dmg)
            msg = f"💀 **Floor {floor} defeated you!** -❤️{dmg} HP. Heal and try again."
        save_player(HOME_GUILD_ID, interaction.user.id, player)
        await interaction.response.send_message(msg)

    @app_commands.command(name="leaderboard", description="Top players by level")
    async def leaderboard(self, interaction: discord.Interaction):
        players = load_players()
        if not players:
            await interaction.response.send_message("No players yet!", ephemeral=True)
            return
        sorted_players = sorted(players.values(), key=lambda p: p.get("level", 1), reverse=True)[:10]
        embed = discord.Embed(title="🏆 Leaderboard", color=0xffd54a)
        for i, p in enumerate(sorted_players, 1):
            embed.add_field(
                name=f"#{i} {p.get('name', 'Unknown')}",
                value=f"Lv.{p.get('level',1)} | ⚔️{p.get('attack',0)} 🛡️{p.get('defense',0)} | 🪙{p.get('coins',0)}",
                inline=False
            )
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="daily", description="Claim daily reward")
    async def daily(self, interaction: discord.Interaction):
        player = get_player(HOME_GUILD_ID, interaction.user.id)
        now = time.time()
        last = player.get("last_daily", 0)
        if now - last < 86400:
            rem = int(86400 - (now - last))
            h, m = divmod(rem // 60, 60)
            await interaction.response.send_message(f"⏳ Next daily in {h}h {m}m", ephemeral=True)
            return
        coins = 100 + player["level"] * 10
        xp = 50 + player["level"] * 5
        player["coins"] = player.get("coins", 0) + coins
        player["xp"] = player.get("xp", 0) + xp
        player["last_daily"] = now
        save_player(HOME_GUILD_ID, interaction.user.id, player)
        await interaction.response.send_message(f"🎁 **Daily Reward!** 🪙+{coins} ⭐+{xp} XP")

async def setup(bot):
    await bot.add_cog(Adventure(bot))
