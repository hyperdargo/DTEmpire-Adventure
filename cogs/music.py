"""
Music Cog — yt-dlp based music playback
"""

import discord
from discord.ext import commands
import yt_dlp
import asyncio
import datetime
import logging

logger = logging.getLogger("HermesBot.Music")

YDL_OPTS = {
    "format": "bestaudio/best",
    "noplaylist": True,
    "quiet": True,
    "no_warnings": True,
    "default_search": "ytsearch",
}

FFMPEG_OPTS = {
    "before_options": "-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5",
    "options": "-vn -bufsize 64k",
}


class MusicPlayer:
    def __init__(self):
        self.queue = []
        self.current = None
        self.volume = 0.5
        self.looping = False
        self.text_channel = None


class Music(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.players = {}

    def get_player(self, guild_id):
        if guild_id not in self.players:
            self.players[guild_id] = MusicPlayer()
        return self.players[guild_id]

    async def _search_ytdlp(self, query: str) -> dict:
        loop = asyncio.get_event_loop()
        with yt_dlp.YoutubeDL(YDL_OPTS) as ydl:
            info = await loop.run_in_executor(None, lambda: ydl.extract_info(query, download=False))
        if "entries" in info:
            info = info["entries"][0]
        return {
            "title": info.get("title", "Unknown"),
            "url": info.get("url") or info.get("webpage_url"),
            "webpage_url": info.get("webpage_url", ""),
            "duration": info.get("duration", 0),
            "thumbnail": info.get("thumbnail", ""),
            "uploader": info.get("uploader", "Unknown"),
        }

    @commands.command(name="play", aliases=["p"])
    async def play(self, ctx, *, query: str):
        """Play a song (YouTube URL or search)."""
        player = self.get_player(ctx.guild.id)
        player.text_channel = ctx.channel

        if not ctx.author.voice or not ctx.author.voice.channel:
            return await ctx.send("❌ Join a voice channel first!")

        vc = ctx.voice_client
        if not vc:
            try:
                vc = await ctx.author.voice.channel.connect()
            except Exception as e:
                return await ctx.send(f"❌ Could not connect: {e}")

        async with ctx.typing():
            try:
                info = await self._search_ytdlp(query)
            except Exception as e:
                return await ctx.send(f"❌ Search failed: {e}")

        entry = {**info, "requester": str(ctx.author)}
        player.queue.append(entry)

        if vc.is_playing() or vc.is_paused():
            embed = discord.Embed(title="🎵 Added to Queue",
                description=f"[{info['title']}]({info['webpage_url']})",
                color=discord.Color.teal(), timestamp=datetime.datetime.utcnow())
            embed.set_footer(text=f"Requested by {ctx.author}")
            if info["thumbnail"]: embed.set_thumbnail(url=info["thumbnail"])
            await ctx.send(embed=embed)
        else:
            await self._play_next(ctx.guild.id, vc)

    async def _play_next(self, guild_id, vc):
        player = self.get_player(guild_id)
        if not player.queue:
            player.current = None
            return
        entry = player.queue.pop(0)
        player.current = entry
        try:
            source = discord.FFmpegPCMAudio(entry["url"], **FFMPEG_OPTS)
            source = discord.PCMVolumeTransformer(source, volume=player.volume)
            vc.play(source, after=lambda e: self.bot.loop.call_soon_threadsafe(
                asyncio.ensure_future, self._after_play(guild_id, e)
            ))
        except Exception as e:
            logger.error(f"Playback error: {e}")
            if player.text_channel:
                await player.text_channel.send(f"❌ Playback error: {e}")
            await self._play_next(guild_id, vc)
            return

        if player.text_channel:
            embed = discord.Embed(title="🎶 Now Playing",
                description=f"[{entry['title']}]({entry['webpage_url']})",
                color=discord.Color.teal(), timestamp=datetime.datetime.utcnow())
            embed.add_field(name="Artist", value=entry["uploader"], inline=True)
            dur = entry["duration"]
            if dur: embed.add_field(name="Duration", value=f"{dur//60}:{dur%60:02d}", inline=True)
            embed.add_field(name="Requested by", value=entry["requester"], inline=True)
            if entry["thumbnail"]: embed.set_thumbnail(url=entry["thumbnail"])
            await player.text_channel.send(embed=embed)

    async def _after_play(self, guild_id, error):
        if error:
            logger.error(f"Player error: {error}")
        player = self.get_player(guild_id)
        if player.looping and player.current:
            player.queue.insert(0, player.current)
        guild = self.bot.get_guild(guild_id)
        if guild and guild.voice_client:
            await self._play_next(guild_id, guild.voice_client)

    @commands.command(name="pause")
    async def pause(self, ctx):
        vc = ctx.voice_client
        if vc and vc.is_playing():
            vc.pause()
            await ctx.send("⏸️ Paused.")
        else:
            await ctx.send("❌ Nothing playing.")

    @commands.command(name="resume", aliases=["unpause"])
    async def resume(self, ctx):
        vc = ctx.voice_client
        if vc and vc.is_paused():
            vc.resume()
            await ctx.send("▶️ Resumed.")
        else:
            await ctx.send("❌ Nothing paused.")

    @commands.command(name="skip", aliases=["s", "next"])
    async def skip(self, ctx):
        vc = ctx.voice_client
        if vc and (vc.is_playing() or vc.is_paused()):
            vc.stop()
            await ctx.send("⏭️ Skipped.")
        else:
            await ctx.send("❌ Nothing to skip.")

    @commands.command(name="stop", aliases=["disconnect", "dc", "leave"])
    async def stop(self, ctx):
        vc = ctx.voice_client
        if vc:
            self.get_player(ctx.guild.id).queue.clear()
            self.get_player(ctx.guild.id).current = None
            await vc.disconnect()
            await ctx.send("⏹️ Stopped & disconnected.")
        else:
            await ctx.send("❌ Not in voice.")

    @commands.command(name="queue", aliases=["q"])
    async def queue_cmd(self, ctx):
        player = self.get_player(ctx.guild.id)
        if not player.queue and not player.current:
            return await ctx.send("📭 Queue empty.")
        embed = discord.Embed(title="🎵 Queue", color=discord.Color.teal(), timestamp=datetime.datetime.utcnow())
        if player.current:
            embed.add_field(name="▶️ Now Playing",
                value=f"[{player.current['title']}]({player.current['webpage_url']}) — {player.current['requester']}",
                inline=False)
        if player.queue:
            qt = ""
            for i, e in enumerate(player.queue[:15], 1):
                dur = f" ({e['duration']//60}:{e['duration']%60:02d})" if e["duration"] else ""
                qt += f"`{i}.` [{e['title'][:60]}]({e['webpage_url']}){dur} — {e['requester']}\n"
            if len(player.queue) > 15:
                qt += f"\n*...and {len(player.queue)-15} more*"
            embed.add_field(name="Up Next", value=qt, inline=False)
        embed.set_footer(text=f"Volume: {int(player.volume*100)}% | Loop: {'On' if player.looping else 'Off'}")
        await ctx.send(embed=embed)

    @commands.command(name="nowplaying", aliases=["np"])
    async def nowplaying(self, ctx):
        player = self.get_player(ctx.guild.id)
        if not player.current:
            return await ctx.send("❌ Nothing playing.")
        e = player.current
        embed = discord.Embed(title="🎶 Now Playing",
            description=f"[{e['title']}]({e['webpage_url']})",
            color=discord.Color.teal(), timestamp=datetime.datetime.utcnow())
        embed.add_field(name="Artist", value=e["uploader"], inline=True)
        if e["duration"]: embed.add_field(name="Duration", value=f"{e['duration']//60}:{e['duration']%60:02d}", inline=True)
        embed.add_field(name="Requested by", value=e["requester"], inline=True)
        if e["thumbnail"]: embed.set_thumbnail(url=e["thumbnail"])
        await ctx.send(embed=embed)

    @commands.command(name="volume", aliases=["vol"])
    async def volume(self, ctx, vol: int):
        if not 0 <= vol <= 100:
            return await ctx.send("❌ 0-100 only.")
        player = self.get_player(ctx.guild.id)
        player.volume = vol / 100
        vc = ctx.voice_client
        if vc and vc.is_playing() and isinstance(vc.source, discord.PCMVolumeTransformer):
            vc.source.volume = player.volume
        await ctx.send(f"🔊 Volume: **{vol}%**")

    @commands.command(name="loop")
    async def loop(self, ctx):
        player = self.get_player(ctx.guild.id)
        player.looping = not player.looping
        await ctx.send(f"Loop: {'🔁 On' if player.looping else '🔁 Off'}")

    @commands.command(name="shuffle")
    async def shuffle(self, ctx):
        import random
        player = self.get_player(ctx.guild.id)
        if len(player.queue) < 2:
            return await ctx.send("❌ Not enough songs.")
        random.shuffle(player.queue)
        await ctx.send("🔀 Queue shuffled!")
    @commands.command(name="removequeue", aliases=["rmq"])
    async def remove_queue(self, ctx, index: int):
        """Remove a song from the queue by index."""
        player = self.get_player(ctx.guild.id)
        if index < 1 or index > len(player.queue):
            return await ctx.send("❌ Invalid index.")
        removed = player.queue.pop(index - 1)
        await ctx.send(f"🗑️ Removed: **{removed['title']}**")


async def setup(bot):
    await bot.add_cog(Music(bot))
