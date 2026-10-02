import { createRng, freshSeed } from "../../shared/rules/rng.ts";
import {
  MINI_GAMES,
  MINI_GAME_BY_ID,
  getDailyFeaturedRotation,
  type DailyEventRotation,
} from "../../shared/data/minigames.ts";
import { GameError } from "../lib/errors.ts";
import type { GameCtx } from "./context.ts";
import { type Player, spendCoins, savePlayer } from "./player.ts";

export interface MiniGameResult {
  gameId: string;
  gameName: string;
  stake: number;
  payout: number;
  netWin: number;
  multiplier: number;
  tokensEarned: number;
  isWin: boolean;
  isFeatured: boolean;
  message: string;
  details: Record<string, unknown>;
  coins: number;
  rotation: DailyEventRotation;
}

export const TRIVIA_QUESTIONS = [
  {
    id: 1,
    q: "Which hero class starts with the highest base Defense and heavy shield?",
    options: ["Paladin", "Sorcerer", "Rogue", "Hunter"],
    answer: 0,
    lore: "Paladins of the Suncrest Order are renowned for impenetrable armor.",
  },
  {
    id: 2,
    q: "What ancient tier of gear is forged only in the highest Paragon ascensions?",
    options: ["Celestial / Mythic", "Rusty Iron", "Worn Leather", "Chipped Stone"],
    answer: 0,
    lore: "Celestial armaments channel pure astral starlight.",
  },
  {
    id: 3,
    q: "What is the primary currency used to enact the Guild Imperial Tax Haven Charter?",
    options: ["Vault Coins", "Dragon Scales", "Arena Badges", "Fish Bones"],
    answer: 0,
    lore: "Guild treasuries accumulate vault gold through member donations.",
  },
  {
    id: 4,
    q: "Which abyssal floor in the Tower of Ascension is guarded by the Void Sovereign?",
    options: ["Floor 100", "Floor 1", "Floor 10", "Floor 20"],
    answer: 0,
    lore: "Floor 100 of the Tower tests only the realm's grandmasters.",
  },
  {
    id: 5,
    q: "What pet species grants the highest innate magic affinity and bonus mana?",
    options: ["Kitsune", "Wolf Cub", "Bear", "Boar"],
    answer: 0,
    lore: "Nine-tailed Kitsune are beings woven from pure astral mana.",
  },
  {
    id: 6,
    q: "What estate luxury tier grants sovereign dominance over the sky realm?",
    options: ["Sovereign Sky-Empire", "Woodland Cabin", "Mud Hut", "Campfire"],
    answer: 0,
    lore: "The Sovereign Sky-Empire floats above the highest clouds of Eldoria.",
  },
  {
    id: 7,
    q: "What is the maximum Paragon rank achievable by ascended adventurers?",
    options: ["Rank 50", "Rank 10", "Rank 5", "Rank 100"],
    answer: 0,
    lore: "Ascending to Paragon Rank 50 grants the title 'Mythic Transcendent'.",
  },
  {
    id: 8,
    q: "Which elemental reagent reacts violently with Dragon Blood to craft Philosopher's Gold?",
    options: ["Sun Shard", "Plain Water", "River Mud", "Dry Grass"],
    answer: 0,
    lore: "Sun Shards focus solar heat to transmute Dragon Blood into liquid gold.",
  },
];

export function getArcadeOverview(g: GameCtx, p: Player) {
  const rotation = getDailyFeaturedRotation(g.clock.now());

  // Top high-rollers today or lifetime from arcade
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- player state is untyped
  const stats = (p.state as any).arcade ?? {
    totalWagered: 0,
    totalWon: 0,
    gamesPlayed: 0,
    biggestWin: 0,
    tokens: 0,
  };

  const topWinners = g.db.all<{ name: string; won: number; level: number }>(
    `SELECT name,
            COALESCE(json_extract(state, '$.arcade.biggestWin'), 0) as won,
            level
     FROM players
     WHERE json_extract(state, '$.arcade.biggestWin') > 0
     ORDER BY won DESC LIMIT 10`
  );

  return {
    rotation,
    games: MINI_GAMES,
    stats,
    topWinners,
    triviaPool: TRIVIA_QUESTIONS.map(({ id, q, options }) => ({ id, q, options })),
  };
}

export function playMiniGame(
  g: GameCtx,
  p: Player,
  gameId: string,
  stakeInput: number,
  choice: Record<string, unknown>
): MiniGameResult {
  const def = MINI_GAME_BY_ID[gameId];
  if (!def) throw new GameError(`Unknown mini-game '${gameId}'.`);

  const stake = Math.floor(stakeInput);
  if (isNaN(stake) || stake < def.minStake) {
    throw new GameError(`Minimum stake for ${def.name} is ${def.minStake.toLocaleString()} gold.`);
  }
  if (stake > def.maxStake) {
    throw new GameError(`Maximum stake for ${def.name} is ${def.maxStake.toLocaleString()} gold.`);
  }
  if (p.coins < stake) {
    throw new GameError(`You don't have enough coins (Need ${stake.toLocaleString()}, have ${p.coins.toLocaleString()}).`);
  }

  spendCoins(p, stake, `arcade:${gameId}`);

  const now = g.clock.now();
  const rotation = getDailyFeaturedRotation(now);
  const isFeatured = rotation.featuredGameId === gameId;
  const rng = createRng(freshSeed());

  let rawMultiplier = 0;
  let message = "";
  let details: Record<string, unknown> = {};

  switch (gameId) {
    // ── 1. Goblet of Fates (Shell game) ──────────────────────
    case "goblet_of_fates": {
      const pickedCup = Number(choice?.cup ?? 0);
      const winningCup = rng.int(0, 2);
      const won = pickedCup === winningCup;
      rawMultiplier = won ? 2.85 : 0;
      message = won
        ? `✨ The crystal goblet reveals the Celestial Pearl! You win 2.85× your wager!`
        : `💨 The goblet was empty! The pearl was hidden under cup #${winningCup + 1}.`;
      details = { pickedCup, winningCup, won };
      break;
    }

    // ── 2. Abyssal Dice Duel ────────────────────────────────
    case "abyssal_dice": {
      const pred = String(choice?.prediction ?? "low").toLowerCase();
      const d1 = rng.int(1, 6);
      const d2 = rng.int(1, 6);
      const sum = d1 + d2;
      let won = false;

      if (pred === "low" && sum >= 2 && sum <= 6) {
        won = true;
        rawMultiplier = 2.1;
      } else if (pred === "high" && sum >= 8 && sum <= 12) {
        won = true;
        rawMultiplier = 2.1;
      } else if (pred === "seven" && sum === 7) {
        won = true;
        rawMultiplier = 4.5;
      } else {
        rawMultiplier = 0;
      }

      message = won
        ? `🎲 The demonic dice rolled ${d1} + ${d2} = ${sum}! Your prediction '${pred.toUpperCase()}' paid out ${rawMultiplier}×!`
        : `💀 The dice rolled ${d1} + ${d2} = ${sum}. You bet '${pred.toUpperCase()}'; the house claims the pot.`;
      details = { d1, d2, sum, pred, won };
      break;
    }

    // ── 3. Spectral Twenty-One ──────────────────────────────
    case "damned_blackjack": {
      const p1 = rng.int(2, 11);
      const p2 = rng.int(2, 11);
      let playerTotal = p1 + p2;
      if (playerTotal === 22) playerTotal = 12;

      const d1 = rng.int(2, 11);
      const d2 = rng.int(2, 11);
      let dealerTotal = d1 + d2;
      if (dealerTotal === 22) dealerTotal = 12;

      // Dealer hits to 17
      while (dealerTotal < 17) {
        const hit = rng.int(2, 10);
        dealerTotal += hit;
      }

      let won = false;
      let push = false;
      if (playerTotal === 21 && (p1 === 11 || p2 === 11)) {
        won = true;
        rawMultiplier = 2.5;
        message = `🃏 Natural Blackjack! Spectral Dealer collapses! Payout 2.5×!`;
      } else if (dealerTotal > 21) {
        won = true;
        rawMultiplier = 2.0;
        message = `💀 Spectral Dealer busts with ${dealerTotal}! You win with ${playerTotal} (2.0×)!`;
      } else if (playerTotal > dealerTotal) {
        won = true;
        rawMultiplier = 2.0;
        message = `⚔️ Your hand of ${playerTotal} beats Dealer's ${dealerTotal}! Payout 2.0×!`;
      } else if (playerTotal === dealerTotal) {
        push = true;
        rawMultiplier = 1.0;
        message = `⚖️ Stand-off! Both you and Dealer hold ${playerTotal}. Stake refunded.`;
      } else {
        won = false;
        rawMultiplier = 0;
        message = `💀 Dealer takes it with ${dealerTotal} over your ${playerTotal}.`;
      }
      details = { playerTotal, dealerTotal, won, push };
      break;
    }

    // ── 4. Celestial Wheel ──────────────────────────────────
    case "celestial_wheel": {
      // Slices: 0x, 0.5x, 1.2x, 1.5x, 2x, 5x, 10x, 50x
      const roll = rng.int(1, 100);
      let sliceName: string;
      if (roll <= 30) {
        rawMultiplier = 0;
        sliceName = "Empty Void (0×)";
      } else if (roll <= 55) {
        rawMultiplier = 0.5;
        sliceName = "Minor Echo (0.5×)";
      } else if (roll <= 75) {
        rawMultiplier = 1.2;
        sliceName = "Lunar Gleam (1.2×)";
      } else if (roll <= 88) {
        rawMultiplier = 2.0;
        sliceName = "Solar Flare (2.0×)";
      } else if (roll <= 96) {
        rawMultiplier = 5.0;
        sliceName = "Astral Blessing (5.0×)";
      } else if (roll <= 99) {
        rawMultiplier = 10.0;
        sliceName = "Supernova (10.0×)";
      } else {
        rawMultiplier = 50.0;
        sliceName = "👑 50× COSMIC JACKPOT 👑";
        p.title = "🌟 Fortune's Favorite";
      }
      message = `🎡 The Astrolabe spun and landed on: ${sliceName}!`;
      details = { roll, sliceName, multiplier: rawMultiplier };
      break;
    }

    // ── 5. Mines of Eldoria (5x5 grid, 3 skulls) ───────────
    case "mines_of_eldoria": {
      const rawPicks = Array.isArray(choice?.picks) ? choice.picks : [0, 1, 2];
      const picks = Array.from(new Set<number>(rawPicks.map((n: unknown) => Math.min(24, Math.max(0, Number(n)))))).slice(0, 10);
      const skullSet = new Set<number>();
      while (skullSet.size < 3) {
        skullSet.add(rng.int(0, 24));
      }
      const hitSkull = picks.some((pos: number) => skullSet.has(pos));
      const skulls = Array.from(skullSet);

      if (hitSkull) {
        rawMultiplier = 0;
        message = `💥 BOOM! You triggered a cursed goblin skull at tile! The cavern collapsed!`;
      } else {
        const multipliers = [1.0, 1.25, 1.6, 2.1, 2.9, 4.2, 6.5, 10.0, 16.0, 25.0, 40.0];
        rawMultiplier = multipliers[picks.length] ?? 2.0;
        message = `💎 Flawless excavation! Cleared ${picks.length} safe ruby chambers for a ${rawMultiplier}× cashout!`;
      }
      details = { picks, skulls, hitSkull, safeCount: picks.length };
      break;
    }

    // ── 6. Imperial Bullseye ────────────────────────────────
    case "archery_blitz": {
      const aim = Math.min(100, Math.max(1, Number(choice?.aim ?? 50)));
      const wind = rng.int(-15, 15);
      const score = Math.max(0, 100 - Math.abs(aim + wind - 50) * 2);

      if (score >= 95) {
        rawMultiplier = 6.0;
        message = `🎯 CRITICAL BULLSEYE! Dead center through the gale (Score: ${score})! Payout 6.0×!`;
      } else if (score >= 75) {
        rawMultiplier = 3.0;
        message = `🎯 Inner Gold Ring! Superb marksmanship (Score: ${score})! Payout 3.0×!`;
      } else if (score >= 50) {
        rawMultiplier = 1.5;
        message = `🏹 Red Target Ring struck (Score: ${score})! Payout 1.5×!`;
      } else if (score >= 25) {
        rawMultiplier = 0.5;
        message = `🏹 Outer rim graze (Score: ${score}). 0.5× returned.`;
      } else {
        rawMultiplier = 0;
        message = `💨 The arrow was carried off by the wind into the dirt (Score: ${score}).`;
      }
      details = { aim, wind, score };
      break;
    }

    // ── 7. Alchemist's Cauldron ─────────────────────────────
    case "alchemists_cauldron": {
      const r1 = String(choice?.reagent1 ?? "dragon_blood");
      const r2 = String(choice?.reagent2 ?? "sun_shard");
      const combo = [r1, r2].sort().join("+");

      if (combo === "dragon_blood+sun_shard") {
        rawMultiplier = 8.0;
        message = `⚗️ Transmutation achieved! Produced legendary Philosopher's Gold! Payout 8.0×!`;
      } else if (combo === "moon_quartz+starlight_dew") {
        rawMultiplier = 5.0;
        message = `✨ Luminescent glow! Synthesized Divine Elixir of Eternity! Payout 5.0×!`;
      } else if (combo === "abyssal_ash+phoenix_feather") {
        rawMultiplier = 3.5;
        message = `🔥 Rebirth combustion! Brewed Phoenix Fire Flask! Payout 3.5×!`;
      } else {
        const roll = rng.int(1, 100);
        if (roll <= 40) {
          rawMultiplier = 2.0;
          message = `🧪 Successful distillation: Greater Philter of Vitality (2.0×).`;
        } else if (roll <= 70) {
          rawMultiplier = 1.0;
          message = `🧪 Stable balance: Common Reagent Tonic (1.0× stake refunded).`;
        } else {
          rawMultiplier = 0;
          message = `💨 Foul purple smoke! The reaction yielded volatile toxic sludge (0×).`;
        }
      }
      details = { r1, r2, combo };
      break;
    }

    // ── 8. Gladiator Beast Pit ──────────────────────────────
    case "gladiator_arena": {
      const chosenBeast = String(choice?.beast ?? "drake").toLowerCase();
      const beasts = [
        { id: "drake", name: "Inferno Drake", odds: 2.1, power: 85 },
        { id: "behemoth", name: "Frost Behemoth", odds: 2.8, power: 75 },
        { id: "stalker", name: "Abyssal Shadowstalker", odds: 4.2, power: 60 },
      ];
      const target = beasts.find((b) => b.id === chosenBeast) ?? beasts[0]!;

      // Weighted pit fight roll
      const drakeScore = 85 + rng.int(0, 40);
      const beheScore = 75 + rng.int(0, 55);
      const stalkScore = 60 + rng.int(0, 80);

      let winner = "drake";
      let highest = drakeScore;
      if (beheScore > highest) {
        winner = "behemoth";
        highest = beheScore;
      }
      if (stalkScore > highest) {
        winner = "stalker";
      }

      const won = winner === target.id;
      rawMultiplier = won ? target.odds : 0;
      message = won
        ? `🦁 ${target.name} tears through the colosseum sands to victory! You win ${rawMultiplier}×!`
        : `💀 Your champion fell in the dust! Victor: ${beasts.find((b) => b.id === winner)?.name}!`;
      details = { chosenBeast, winner, won, drakeScore, beheScore, stalkScore };
      break;
    }

    // ── 9. Sage's Lore Trials ───────────────────────────────
    case "sages_trials": {
      const qId = Number(choice?.questionId ?? 1);
      const ansIdx = Number(choice?.answerIndex ?? 0);
      const qObj = TRIVIA_QUESTIONS.find((t) => t.id === qId) ?? TRIVIA_QUESTIONS[0]!;
      const correct = ansIdx === qObj.answer;

      rawMultiplier = correct ? 2.2 : 0;
      message = correct
        ? `📜 Wise answer! "${qObj.lore}" The Imperial Sage awards 2.2× your stake!`
        : `❌ Incorrect! The correct answer was "${qObj.options[qObj.answer]}". "${qObj.lore}"`;
      details = { qId, ansIdx, correct, lore: qObj.lore };
      break;
    }

    // ── 10. Matrix of Runes ─────────────────────────────────
    case "memory_runes": {
      const userSeq = Array.isArray(choice?.sequence) ? choice.sequence : [1, 2, 3];
      const targetSeq = [rng.int(1, 4), rng.int(1, 4), rng.int(1, 4), rng.int(1, 4)];
      const matches = userSeq.slice(0, 4).every((val: unknown, idx: number) => Number(val) === targetSeq[idx]);

      rawMultiplier = matches ? 3.0 : 0;
      message = matches
        ? `🔮 Flawless resonance! All 4 elemental runes lit in harmony! Payout 3.0×!`
        : `⚡ Rune resonance broken! Target pattern was [${targetSeq.join(", ")}].`;
      details = { userSeq, targetSeq, matches };
      break;
    }
  }

  // Calculate effective final payout
  let finalMultiplier = rawMultiplier;
  if (isFeatured && rawMultiplier > 0) {
    finalMultiplier = Number((rawMultiplier * rotation.bonusMultiplier).toFixed(2));
  }

  const payout = Math.floor(stake * finalMultiplier);
  const netWin = payout - stake;
  const isWin = payout > 0;

  // Carnival tokens: 5 base + 1 per 10k staked + featured multiplier
  let tokens = isWin ? Math.max(5, Math.floor(stake / 10_000)) : 2;
  if (isFeatured) tokens = Math.round(tokens * rotation.tokenMultiplier);

  p.coins += payout;

  // Track arcade stats in player state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- player state is untyped
  const playerState = p.state as any;
  playerState.arcade = playerState.arcade ?? {
    totalWagered: 0,
    totalWon: 0,
    gamesPlayed: 0,
    biggestWin: 0,
    tokens: 0,
  };
  playerState.arcade.totalWagered += stake;
  playerState.arcade.totalWon += payout;
  playerState.arcade.gamesPlayed += 1;
  playerState.arcade.tokens += tokens;
  if (payout > playerState.arcade.biggestWin) {
    playerState.arcade.biggestWin = payout;
  }

  savePlayer(g, p);

  // Big win broadcast
  if (payout >= 500_000) {
    g.hub.toChannel("world", {
      type: "feed",
      icon: isFeatured ? "🌟" : "🎰",
      text: `${p.name} won ${payout.toLocaleString()} coins (${finalMultiplier}×) playing ${def.name} in the Imperial Carnival!`,
      at: now,
    });
  }

  return {
    gameId,
    gameName: def.name,
    stake,
    payout,
    netWin,
    multiplier: finalMultiplier,
    tokensEarned: tokens,
    isWin,
    isFeatured,
    message,
    details,
    coins: p.coins,
    rotation,
  };
}
