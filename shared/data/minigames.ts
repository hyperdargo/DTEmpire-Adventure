export interface MiniGameDef {
  id: string;
  name: string;
  category: "chance" | "strategy" | "reflex" | "prediction";
  icon: string;
  tagline: string;
  description: string;
  minStake: number;
  maxStake: number;
  rules: string[];
}

export const MINI_GAMES: MiniGameDef[] = [
  {
    id: "goblet_of_fates",
    name: "Goblet of Fates",
    category: "chance",
    icon: "🏆",
    tagline: "The Imperial Shell Game",
    description: "Three enchanted crystal goblets hide a celestial pearl. Track the shuffle and claim 2.85x your stake.",
    minStake: 1_000,
    maxStake: 10_000_000,
    rules: [
      "Select your bet amount (from 1k up to 10M gold).",
      "One goblet contains the Celestial Pearl; the other two are empty.",
      "Pick correctly to win 2.85× your wager plus festival tokens.",
    ],
  },
  {
    id: "abyssal_dice",
    name: "Abyssal Dice Duel",
    category: "chance",
    icon: "🎲",
    tagline: "High, Low, or Devil's Seven",
    description: "Roll two ancient demon-carved dice. Predict whether the sum is Low (2-6), Seven (7), or High (8-12).",
    minStake: 1_000,
    maxStake: 10_000_000,
    rules: [
      "Low (2-6) pays 2.1× wager.",
      "High (8-12) pays 2.1× wager.",
      "Lucky Seven (exact 7) pays 4.5× wager.",
    ],
  },
  {
    id: "damned_blackjack",
    name: "Spectral Twenty-One",
    category: "strategy",
    icon: "🃏",
    tagline: "Blackjack of the Underworld",
    description: "Face off against the Spectral Dealer. Get closer to 21 than the dealer without going bust.",
    minStake: 2_500,
    maxStake: 10_000_000,
    rules: [
      "Natural 21 (Blackjack) pays 2.5× wager.",
      "Dealer must hit on 16 and stand on 17.",
      "Double down allowed on initial deal.",
    ],
  },
  {
    id: "celestial_wheel",
    name: "Celestial Wheel",
    category: "chance",
    icon: "🎡",
    tagline: "Wheel of Cosmic Fortune",
    description: "Spin the cosmic astrolabe for grand multipliers, rare relics, and the elusive 50x Mega Jackpot.",
    minStake: 5_000,
    maxStake: 10_000_000,
    rules: [
      "Slices: 0×, 0.5×, 1.2×, 2×, 5×, 10×, and the 50× Cosmic Jackpot!",
      "Every spin awards Imperial Carnival Tokens.",
    ],
  },
  {
    id: "mines_of_eldoria",
    name: "Mines of Eldoria",
    category: "strategy",
    icon: "💎",
    tagline: "Gold Minefield & Cashout",
    description: "A 5×5 cavern hides 22 glittering rubies and 3 cursed goblin skulls. Cash out anytime before you hit a skull!",
    minStake: 1_000,
    maxStake: 10_000_000,
    rules: [
      "Each safe diamond uncovered increases your payout multiplier (up to 12.5×).",
      "Cash out anytime to lock in your profit.",
      "Uncovering a skull collapses the tunnel and claims your stake.",
    ],
  },
  {
    id: "archery_blitz",
    name: "Imperial Bullseye",
    category: "reflex",
    icon: "🎯",
    tagline: "Wind, Arc, and Critical Target Blitz",
    description: "Steady your breath and loose an arrow at the royal target. Bullseyes award up to 6× and critical marks.",
    minStake: 1_000,
    maxStake: 5_000_000,
    rules: [
      "Select your aim zone and release timing.",
      "Rings award 0.5× (Outer), 1.5× (Inner), 3× (Center), or 6× (Bullseye Critical).",
    ],
  },
  {
    id: "alchemists_cauldron",
    name: "Alchemist's Cauldron",
    category: "strategy",
    icon: "⚗️",
    tagline: "Transmute Elements for Elixirs",
    description: "Mix two ancient reagents into the bubbling cauldron. Master recipes yield philosopher's gold!",
    minStake: 2_000,
    maxStake: 5_000_000,
    rules: [
      "Reagents: Dragon Blood, Phoenix Feather, Starlight Dew, Abyssal Ash, Moon Quartz, Sun Shard.",
      "Recipes can produce Common Tonic (0.5×), Greater Philter (2×), Divine Elixir (4×), or Philosopher's Gold (8×).",
    ],
  },
  {
    id: "gladiator_arena",
    name: "Gladiator Beast Pit",
    category: "prediction",
    icon: "🦁",
    tagline: "Place Wagers on Legendary Beasts",
    description: "Three champion monsters clash in the sand: Flame Drake, Frost Behemoth, and Shadow Stalker. Back the victor!",
    minStake: 2_500,
    maxStake: 10_000_000,
    rules: [
      "Examine combatant odds and forms.",
      "Win payouts range from 1.8× to 3.5× based on underdogs and favorites.",
    ],
  },
  {
    id: "sages_trials",
    name: "Sage's Lore Trials",
    category: "strategy",
    icon: "📜",
    tagline: "Imperial Realm Lore & Wisdom",
    description: "Answer the Grand Sage's riddles and realm history questions correctly under timed scrutiny.",
    minStake: 1_000,
    maxStake: 5_000_000,
    rules: [
      "Solve trivia questions on DTEmpire lore, combat mechanics, and monster weaknesses.",
      "Correct answer awards 2.2× your stake plus high wisdom score.",
    ],
  },
  {
    id: "memory_runes",
    name: "Matrix of Runes",
    category: "reflex",
    icon: "🔮",
    tagline: "Arcane Pattern Recall",
    description: "Memorize the sequence of lit runes and replicate the invocation to unlock imperial treasuries.",
    minStake: 1_000,
    maxStake: 5_000_000,
    rules: [
      "Rune patterns flash in rapid sequence.",
      "Input matching sequence to multiply your deposit up to 3×.",
    ],
  },
];

export const MINI_GAME_BY_ID: Record<string, MiniGameDef> = Object.fromEntries(
  MINI_GAMES.map((m) => [m.id, m])
);

export interface DailyEventRotation {
  dayIndex: number;
  dateKey: string;
  featuredGameId: string;
  featuredGame: MiniGameDef;
  modifierName: string;
  modifierDesc: string;
  bonusMultiplier: number;
  tokenMultiplier: number;
  nextRotationAt: number;
}

const MODIFIERS = [
  { name: "Imperial Jubilee", desc: "+25% extra gold winnings & 2× Carnival Tokens!", bonus: 1.25, tokens: 2 },
  { name: "Goblin High-Roller Surge", desc: "+30% jackpot boost on winning wagers!", bonus: 1.30, tokens: 2 },
  { name: "Astral Alignment", desc: "Doubled token drops and -50% tax on carnival exchanges!", bonus: 1.20, tokens: 2.5 },
  { name: "Festival of Fates", desc: "+35% payouts on all high-stakes bets!", bonus: 1.35, tokens: 2 },
  { name: "Cosmic Favor", desc: "Guaranteed consolation tokens on any loss + 20% bonus payouts!", bonus: 1.20, tokens: 2 },
  { name: "Merchant Baron's Gala", desc: "Top winners receive bonus Imperial Contribution!", bonus: 1.25, tokens: 2 },
  { name: "Dragon's Hoard Hour", desc: "+40% super multiplier across all games!", bonus: 1.40, tokens: 3 },
];

export function getDailyFeaturedRotation(timestamp: number): DailyEventRotation {
  // Epoch day in UTC
  const epochDay = Math.floor(timestamp / (24 * 60 * 60 * 1000));
  const gameIndex = Math.abs(epochDay) % MINI_GAMES.length;
  const modIndex = Math.abs(epochDay) % MODIFIERS.length;
  const featured = MINI_GAMES[gameIndex]!;
  const mod = MODIFIERS[modIndex]!;

  const date = new Date(timestamp);
  const dateKey = date.toISOString().slice(0, 10);
  const nextRotationAt = (epochDay + 1) * 24 * 60 * 60 * 1000;

  return {
    dayIndex: epochDay,
    dateKey,
    featuredGameId: featured.id,
    featuredGame: featured,
    modifierName: mod.name,
    modifierDesc: mod.desc,
    bonusMultiplier: mod.bonus,
    tokenMultiplier: mod.tokens,
    nextRotationAt,
  };
}
