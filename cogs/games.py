"""
Games Cog — Fun games and entertainment commands
"""

import discord
from discord.ext import commands
import random
import asyncio
import datetime
import logging

logger = logging.getLogger("HermesBot.Games")

# Trivia questions
TRIVIA = [
    {"q": "What is the capital of Nepal?", "a": "Kathmandu"},
    {"q": "What year did World War II end?", "a": "1945"},
    {"q": "What is the largest planet in our solar system?", "a": "Jupiter"},
    {"q": "Who painted the Mona Lisa?", "a": "Leonardo da Vinci"},
    {"q": "What is the chemical symbol for gold?", "a": "Au"},
    {"q": "How many continents are there?", "a": "7"},
    {"q": "What is the speed of light in km/s (approx)?", "a": "300000"},
    {"q": "Who wrote 'Romeo and Juliet'?", "a": "Shakespeare"},
    {"q": "What is the smallest country in the world?", "a": "Vatican"},
    {"q": "What programming language was created by Guido van Rossum?", "a": "Python"},
    {"q": "What does HTTP stand for?", "a": "HyperText Transfer Protocol"},
    {"q": "What year was the first iPhone released?", "a": "2007"},
    {"q": "What is the hardest natural substance?", "a": "Diamond"},
    {"q": "How many bones are in the adult human body?", "a": "206"},
    {"q": "What is the longest river in the world?", "a": "Nile"},
    {"q": "What does CPU stand for?", "a": "Central Processing Unit"},
    {"q": "Who discovered penicillin?", "a": "Alexander Fleming"},
    {"q": "What is the square root of 144?", "a": "12"},
    {"q": "What gas do plants absorb from the atmosphere?", "a": "Carbon dioxide"},
    {"q": "What is the currency of Japan?", "a": "Yen"},
]

EIGHT_BALL = [
    "It is certain.", "It is decidedly so.", "Without a doubt.",
    "Yes — definitely.", "You may rely on it.", "As I see it, yes.",
    "Most likely.", "Outlook good.", "Yes.", "Signs point to yes.",
    "Reply hazy, try again.", "Ask again later.", "Better not tell you now.",
    "Cannot predict now.", "Concentrate and ask again.",
    "Don't count on it.", "My reply is no.", "My sources say no.",
    "Outlook not so good.", "Very doubtful.",
]


class Games(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command(name="roll", aliases=["dice"])
    async def roll(self, ctx, dice: str = "1d20"):
        """Roll dice in NdN format (default: 1d20)."""
        try:
            rolls, limit = map(int, dice.lower().split("d"))
            if rolls > 100 or limit > 10000:
                return await ctx.send("❌ Too many dice or sides!")
            results = [random.randint(1, limit) for _ in range(rolls)]
            total = sum(results)
            if rolls == 1:
                await ctx.send(f"🎲 **{ctx.author.display_name}** rolled **{total}** (1d{limit})")
            else:
                await ctx.send(
                    f"🎲 **{ctx.author.display_name}** rolled **{total}** "
                    f"({rolls}d{limit}): {', '.join(map(str, results))}"
                )
        except ValueError:
            await ctx.send("❌ Format: `!roll NdN` (e.g., `!roll 2d6`)")

    @commands.command(name="coinflip", aliases=["coin", "flip"])
    async def coinflip(self, ctx):
        """Flip a coin."""
        result = random.choice(["Heads", "Tails"])
        emoji = "🪙" if result == "Heads" else "💿"
        await ctx.send(f"{emoji} **{result}**!")

    @commands.command(name="8ball", aliases=["eightball"])
    async def eightball(self, ctx, *, question: str):
        """Ask the Magic 8-ball a question."""
        answer = random.choice(EIGHT_BALL)
        embed = discord.Embed(
            title="🎱 Magic 8-Ball",
            color=discord.Color.purple(),
            timestamp=datetime.datetime.utcnow()
        )
        embed.add_field(name="Question", value=question, inline=False)
        embed.add_field(name="Answer", value=answer, inline=False)
        await ctx.send(embed=embed)

    @commands.command(name="rps")
    async def rps(self, ctx, choice: str):
        """Rock Paper Scissors. Usage: !rps rock|paper|scissors"""
        choices = {"rock": "🪨", "paper": "📄", "scissors": "✂️"}
        choice = choice.lower().strip()
        if choice not in choices:
            return await ctx.send("❌ Choose: `rock`, `paper`, or `scissors`")

        bot_choice = random.choice(list(choices.keys()))
        c_emoji = choices[choice]
        b_emoji = choices[bot_choice]

        if choice == bot_choice:
            result = "🤝 It's a tie!"
        elif (choice == "rock" and bot_choice == "scissors") or \
             (choice == "paper" and bot_choice == "rock") or \
             (choice == "scissors" and bot_choice == "paper"):
            result = "🎉 You win!"
        else:
            result = "😈 I win!"

        await ctx.send(f"You: {c_emoji} | Me: {b_emoji}\n**{result}**")

    @commands.command(name="trivia")
    async def trivia(self, ctx):
        """Answer a trivia question."""
        item = random.choice(TRIVIA)
        embed = discord.Embed(
            title="🧠 Trivia Time!",
            description=item["q"],
            color=discord.Color.gold(),
            timestamp=datetime.datetime.utcnow()
        )
        embed.set_footer(text="You have 15 seconds! Type your answer in chat.")
        await ctx.send(embed=embed)

        def check(m):
            return m.channel == ctx.channel and m.author != self.bot.user

        try:
            msg = await self.bot.wait_for("message", check=check, timeout=15)
            if msg.content.lower().strip() == item["a"].lower():
                await ctx.send(f"🎉 **{msg.author.display_name}** got it right! The answer is **{item['a']}**")
            else:
                await ctx.send(f"❌ Wrong! The answer was **{item['a']}**")
        except asyncio.TimeoutError:
            await ctx.send(f"⏰ Time's up! The answer was **{item['a']}**")

    @commands.command(name="meme")
    async def meme(self, ctx):
        """Post a random meme (from a curated list)."""
        memes = [
            "https://i.imgur.com/JYZGj8N.png",
            "https://i.imgur.com/YCybIhQ.jpeg",
            "https://i.imgur.com/KJ4pD1v.png",
            "https://i.imgur.com/8QjIYqF.png",
            "https://i.imgur.com/9P5rN7m.jpeg",
        ]
        embed = discord.Embed(
            title="😂 Meme",
            color=discord.Color.random(),
            timestamp=datetime.datetime.utcnow()
        )
        embed.set_image(url=random.choice(memes))
        embed.set_footer(text=f"Requested by {ctx.author}")
        await ctx.send(embed=embed)

    @commands.command(name="guess")
    async def guess(self, ctx):
        """Guess the number game (1-100)."""
        number = random.randint(1, 100)
        await ctx.send("🎯 I'm thinking of a number between **1 and 100**. You have 30 seconds!")

        def check(m):
            return m.channel == ctx.channel and m.author == ctx.author and m.content.isdigit()

        try:
            msg = await self.bot.wait_for("message", check=check, timeout=30)
            guess_val = int(msg.content)
            if guess_val == number:
                await ctx.send(f"🎉 **Correct!** The number was **{number}**!")
            else:
                diff = abs(guess_val - number)
                hint = "🔥 Very close!" if diff <= 5 else "❄️ Far off!" if diff > 30 else "🌡️ Getting warm!"
                await ctx.send(f"❌ Wrong! The number was **{number}**. {hint}")
        except asyncio.TimeoutError:
            await ctx.send(f"⏰ Time's up! The number was **{number}**")

    @commands.command(name="hack")
    async def hack(self, ctx, member: commands.MemberConverter = None):
        """'Hack' a user (just for fun 😈)."""
        member = member or ctx.author
        stages = [
            "🔍 Finding Discord login...",
            "📧 Email: `***@***.com`",
            "🔑 Password: `********`",
            "💳 Stealing credit card info...",
            "📱 Installing virus on phone...",
            "🏠 Finding home address...",
            "✅ **Hack complete!** Just kidding 😄",
        ]
        msg = await ctx.send(f"💀 Hacking **{member.display_name}**...")
        for stage in stages:
            await asyncio.sleep(1.5)
            await msg.edit(content=stage)


async def setup(bot):
    await bot.add_cog(Games(bot))
