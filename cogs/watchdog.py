"""
Watchdog & Server Management Cog
Monitors bot health, Minecraft servers, and provides server utilities.
"""

import discord
from discord.ext import commands
import json
import urllib.request
import datetime
import subprocess
import os
import logging

logger = logging.getLogger("HermesBot.Watchdog")

# Pterodactyl config
PTERO_URL = "https://panel.ankitgupta.com.np"
PTERO_API_KEY = os.environ.get("PTERO_API_KEY", "")

# Server IDs
MC_SERVERS = {
    "Ghar Ko Survival": "0fc4668f",
    "WarmBrew SMP": "331ef165",
}


def ptero_get(path):
    """Make a GET request to Pterodactyl API."""
    req = urllib.request.Request(
        f"{PTERO_URL}{path}",
        headers={
            "Authorization": f"Bearer {PTERO_API_KEY}",
            "Accept": "application/json",
        }
    )
    resp = urllib.request.urlopen(req, timeout=15)
    return json.loads(resp.read())


def ptero_post_cmd(server_id, command):
    """Send a console command to a Pterodactyl server."""
    import json as _json
    body = _json.dumps({"command": command}).encode()
    req = urllib.request.Request(
        f"{PTERO_URL}/api/client/servers/{server_id}/command",
        data=body,
        headers={
            "Authorization": f"Bearer {PTERO_API_KEY}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        method="POST"
    )
    urllib.request.urlopen(req, timeout=15)


class Watchdog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command(name="mcstatus")
    async def mcstatus(self, ctx, server_name: str = None):
        """Check Minecraft server status. Usage: !mcstatus [server name]"""
        servers = {}
        if server_name:
            matched = {k: v for k, v in MC_SERVERS.items() if server_name.lower() in k.lower()}
            if not matched:
                return await ctx.send(f"❌ Server not found. Available: {', '.join(MC_SERVERS.keys())}")
            servers = matched
        else:
            servers = MC_SERVERS

        embed = discord.Embed(
            title="🖥️ Minecraft Server Status",
            color=discord.Color.blue(),
            timestamp=datetime.datetime.utcnow()
        )

        for name, sid in servers.items():
            try:
                data = ptero_get(f"/api/client/servers/{sid}/resources")
                state = data["attributes"]["current_state"]
                res = data["attributes"]["resources"]

                cpu = res.get("cpu_absolute", 0)
                mem_bytes = res.get("memory_bytes", 0)
                mem_mb = mem_bytes / (1024 * 1024)
                disk_bytes = res.get("disk_bytes", 0)
                disk_mb = disk_bytes / (1024 * 1024)
                net_rx = res.get("network_rx_bytes", 0)
                net_tx = res.get("network_tx_bytes", 0)

                status_emoji = "🟢" if state == "running" else "🔴" if state == "offline" else "🟡"

                embed.add_field(
                    name=f"{status_emoji} {name}",
                    value=(
                        f"State: **{state}**\n"
                        f"CPU: **{cpu:.1f}%**\n"
                        f"RAM: **{mem_mb:.0f} MB**\n"
                        f"Disk: **{disk_mb:.0f} MB**\n"
                        f"Net: ↓{net_rx/1024:.0f}KB ↑{net_tx/1024:.0f}KB"
                    ),
                    inline=True
                )
            except Exception as e:
                embed.add_field(name=f"⚠️ {name}", value=f"Error: {e}", inline=True)

        await ctx.send(embed=embed)

    @commands.command(name="mcplayers")
    async def mcplayers(self, ctx, server_name: str = None):
        """List online players on a Minecraft server."""
        if not server_name:
            # Default to first server
            server_name = list(MC_SERVERS.keys())[0]

        matched = {k: v for k, v in MC_SERVERS.items() if server_name.lower() in k.lower()}
        if not matched:
            return await ctx.send(f"❌ Server not found. Available: {', '.join(MC_SERVERS.keys())}")

        name, sid = list(matched.items())[0]

        try:
            # Get logs to find players
            log_req = urllib.request.Request(
                f"{PTERO_URL}/api/client/servers/{sid}/files/download?file=/logs/latest.log",
                headers={"Authorization": f"Bearer {PTERO_API_KEY}", "Accept": "application/json"}
            )
            log_url = json.loads(urllib.request.urlopen(log_req, timeout=15).read())["attributes"]["url"]
            log_data = urllib.request.urlopen(log_url, timeout=15).read().decode("utf-8", errors="ignore")

            # Parse player list from logs
            players = set()
            for line in log_data.split("\n")[-500:]:
                if "joined the game" in line:
                    parts = line.split()
                    for i, p in enumerate(parts):
                        if p == "joined" and i > 0:
                            players.add(parts[i-1])
                elif "left the game" in line:
                    parts = line.split()
                    for i, p in enumerate(parts):
                        if p == "left" and i > 0:
                            players.discard(parts[i-1])

            if players:
                embed = discord.Embed(
                    title=f"👥 Online Players — {name}",
                    description="\n".join(f"• {p}" for p in sorted(players)),
                    color=discord.Color.green(),
                    timestamp=datetime.datetime.utcnow()
                )
                embed.set_footer(text=f"{len(players)} player(s) online")
            else:
                embed = discord.Embed(
                    title=f"👥 Online Players — {name}",
                    description="No players online (or could not parse logs).",
                    color=discord.Color.orange(),
                    timestamp=datetime.datetime.utcnow()
                )
            await ctx.send(embed=embed)
        except Exception as e:
            await ctx.send(f"❌ Error: {e}")

    @commands.command(name="mccmd")
    @commands.is_owner()
    async def mccmd(self, ctx, server_name: str, *, command: str):
        """Send a console command to a Minecraft server (owner only)."""
        matched = {k: v for k, v in MC_SERVERS.items() if server_name.lower() in k.lower()}
        if not matched:
            return await ctx.send(f"❌ Server not found. Available: {', '.join(MC_SERVERS.keys())}")

        name, sid = list(matched.items())[0]
        try:
            ptero_post_cmd(sid, command)
            await ctx.send(f"✅ Command sent to **{name}**: `{command}`")
        except Exception as e:
            await ctx.send(f"❌ Error: {e}")

    @commands.command(name="mclogs")
    async def mclogs(self, ctx, server_name: str = None, lines: int = 20):
        """View recent server logs. Usage: !mclogs [server] [lines]"""
        if not server_name:
            server_name = list(MC_SERVERS.keys())[0]

        matched = {k: v for k, v in MC_SERVERS.items() if server_name.lower() in k.lower()}
        if not matched:
            return await ctx.send(f"❌ Server not found. Available: {', '.join(MC_SERVERS.keys())}")

        name, sid = list(matched.items())[0]
        try:
            log_req = urllib.request.Request(
                f"{PTERO_URL}/api/client/servers/{sid}/files/download?file=/logs/latest.log",
                headers={"Authorization": f"Bearer {PTERO_API_KEY}", "Accept": "application/json"}
            )
            log_url = json.loads(urllib.request.urlopen(log_req, timeout=15).read())["attributes"]["url"]
            log_data = urllib.request.urlopen(log_url, timeout=15).read().decode("utf-8", errors="ignore")
            recent = log_data.split("\n")[-lines:]
            content = "\n".join(recent)[-1900:]
            await ctx.send(f"```{content}```")
        except Exception as e:
            await ctx.send(f"❌ Error: {e}")

    @commands.command(name="system")
    async def system(self, ctx):
        """Show system resource usage of the host machine."""
        try:
            # CPU
            cpu = subprocess.run(
                ["top", "-bn1"], capture_output=True, text=True, timeout=5
            ).stdout
            cpu_line = [l for l in cpu.split("\n") if "Cpu" in l]
            cpu_pct = cpu_line[0].split(",")[0].split(":")[1].strip() if cpu_line else "N/A"

            # RAM
            mem = subprocess.run(
                ["free", "-m"], capture_output=True, text=True, timeout=5
            ).stdout
            mem_lines = mem.split("\n")
            mem_info = mem_lines[1].split() if len(mem_lines) > 1 else ["N/A"]
            mem_total = mem_info[1] if len(mem_info) > 1 else "N/A"
            mem_used = mem_info[2] if len(mem_info) > 2 else "N/A"

            # Disk
            disk = subprocess.run(
                ["df", "-h", "/"], capture_output=True, text=True, timeout=5
            ).stdout
            disk_lines = disk.split("\n")
            disk_info = disk_lines[1].split() if len(disk_lines) > 1 else ["N/A"]

            # Uptime
            uptime = subprocess.run(
                ["uptime", "-p"], capture_output=True, text=True, timeout=5
            ).stdout.strip()

            embed = discord.Embed(
                title="🖥️ System Status",
                color=discord.Color.blue(),
                timestamp=datetime.datetime.utcnow()
            )
            embed.add_field(name="CPU", value=cpu_pct, inline=True)
            embed.add_field(name="RAM", value=f"{mem_used}/{mem_total} MB", inline=True)
            embed.add_field(name="Disk", value=f"{disk_info[2]}/{disk_info[1]} ({disk_info[4]})" if len(disk_info) > 4 else "N/A", inline=True)
            embed.add_field(name="Uptime", value=uptime, inline=False)
            await ctx.send(embed=embed)
        except Exception as e:
            await ctx.send(f"❌ Error: {e}")


async def setup(bot):
    await bot.add_cog(Watchdog(bot))
