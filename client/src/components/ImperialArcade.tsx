import { useState } from "react";
import { fmt } from "../lib/format.ts";
import { play } from "../lib/sound.ts";
import { useAction, useData, useHero } from "../state/game.ts";
import { Button, Coins, Countdown, Panel } from "./ui.tsx";
import type { DailyEventRotation, MiniGameDef } from "../../../shared/data/minigames.ts";

interface ArcadeOverview {
  rotation: DailyEventRotation;
  games: MiniGameDef[];
  stats: {
    totalWagered: number;
    totalWon: number;
    gamesPlayed: number;
    biggestWin: number;
    tokens: number;
  };
  topWinners: { name: string; won: number; level: number }[];
  triviaPool: { id: number; q: string; options: string[] }[];
}

export function ImperialArcade() {
  const { hero } = useHero();
  const { data, refetch } = useData<ArcadeOverview>(["arcade"], "/api/arcade", { refetchInterval: 30_000 });

  const [selectedGameId, setSelectedGameId] = useState<string>("goblet_of_fates");
  const [stake, setStake] = useState<number>(10_000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- response shape varies per mini-game
  const [lastResult, setLastResult] = useState<any>(null);

  // Game-specific interaction states
  const [selectedCup, setSelectedCup] = useState<number>(0);
  const [dicePred, setDicePred] = useState<"low" | "seven" | "high">("high");
  const [minePicks, setMinePicks] = useState<number[]>([0, 1, 2]);
  const [aimPower, setAimPower] = useState<number>(50);
  const [reagent1, setReagent1] = useState<string>("dragon_blood");
  const [reagent2, setReagent2] = useState<string>("sun_shard");
  const [chosenBeast, setChosenBeast] = useState<string>("drake");
  const [triviaAns, setTriviaAns] = useState<number>(0);
  const [runeSeq, setRuneSeq] = useState<number[]>([1, 2, 3, 4]);

  const playGame = useAction<
    { gameId: string; stake: number; choice: Record<string, unknown> },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >("/api/arcade/play", {
    invalidate: [["arcade"], ["me"], ["event"]],
    onSuccess: (res) => {
      setLastResult(res);
      if (res.isWin) {
        play(res.multiplier >= 5 ? "level" : "coin");
      } else {
        play("hit");
      }
      refetch();
    },
  });

  if (!data) return null;

  const { rotation, games, stats, triviaPool } = data;
  const currentGame = games.find((g) => g.id === selectedGameId) ?? games[0]!;
  const isFeatured = rotation.featuredGameId === currentGame.id;

  const handlePlay = () => {
    let choice: Record<string, unknown> = {};
    if (currentGame.id === "goblet_of_fates") choice = { cup: selectedCup };
    else if (currentGame.id === "abyssal_dice") choice = { prediction: dicePred };
    else if (currentGame.id === "damned_blackjack") choice = { action: "deal" };
    else if (currentGame.id === "celestial_wheel") choice = { spin: true };
    else if (currentGame.id === "mines_of_eldoria") choice = { picks: minePicks };
    else if (currentGame.id === "archery_blitz") choice = { aim: aimPower };
    else if (currentGame.id === "alchemists_cauldron") choice = { reagent1, reagent2 };
    else if (currentGame.id === "gladiator_arena") choice = { beast: chosenBeast };
    else if (currentGame.id === "sages_trials") {
      const q = triviaPool[0] ?? { id: 1 };
      choice = { questionId: q.id, answerIndex: triviaAns };
    } else if (currentGame.id === "memory_runes") choice = { sequence: runeSeq };

    playGame.mutate({
      gameId: currentGame.id,
      stake,
      choice,
    });
  };

  const toggleMinePick = (index: number) => {
    if (minePicks.includes(index)) {
      setMinePicks(minePicks.filter((p) => p !== index));
    } else {
      if (minePicks.length < 8) {
        setMinePicks([...minePicks, index]);
      }
    }
  };

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      {/* Daily Rotation Hero Banner */}
      <div
        style={{
          background: "#111",
          border: "1px solid #333",
          borderRadius: "8px",
          padding: "1.25rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.4rem" }}>🎪</span>
            <span style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>
              Daily Imperial Event & Carnival
            </span>
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", marginTop: "0.25rem" }}>
            {rotation.featuredGame.icon} {rotation.featuredGame.name} · {rotation.modifierName}
          </div>
          <div style={{ color: "#aaa", fontSize: "0.9rem", marginTop: "0.25rem" }}>
            {rotation.modifierDesc}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.8rem", color: "#888" }}>Next Event Rotation</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--gold, #d4af37)", marginTop: "0.2rem" }}>
            <Countdown to={rotation.nextRotationAt} done="Rotating..." />
          </div>
          <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "0.25rem" }}>
            Carnival Tokens: <b style={{ color: "#fff" }}>{fmt(stats.tokens)}</b>
          </div>
        </div>
      </div>

      {/* 10 Mini-Games Selector Bar */}
      <Panel title="Imperial Mini-Games (10 Event Categories)">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "0.6rem",
          }}
        >
          {games.map((g) => {
            const active = g.id === selectedGameId;
            const featured = g.id === rotation.featuredGameId;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setSelectedGameId(g.id);
                  setLastResult(null);
                  play("click");
                }}
                style={{
                  background: active ? "#222" : "#141414",
                  border: `1px solid ${active ? "#fff" : featured ? "#d4af3766" : "#2a2a2a"}`,
                  borderRadius: "6px",
                  padding: "0.75rem",
                  textAlign: "left",
                  cursor: "pointer",
                  color: "#fff",
                  position: "relative",
                  transition: "all 0.15s ease",
                }}
              >
                {featured && (
                  <span
                    style={{
                      position: "absolute",
                      top: "6px",
                      right: "6px",
                      fontSize: "0.65rem",
                      background: "var(--gold, #d4af37)",
                      color: "#000",
                      fontWeight: 700,
                      padding: "1px 5px",
                      borderRadius: "3px",
                    }}
                  >
                    FEATURED
                  </span>
                )}
                <div style={{ fontSize: "1.3rem" }}>{g.icon}</div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem", marginTop: "0.25rem" }}>{g.name}</div>
                <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "0.15rem" }}>{g.tagline}</div>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* Active Game Stage */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
        {/* Game Play Area */}
        <Panel
          title={
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>{currentGame.icon}</span>
              <span>{currentGame.name}</span>
              {isFeatured && (
                <span className="chip chip--gold" style={{ fontSize: "0.75rem", padding: "2px 6px" }}>
                  ⭐ +25% Gold & 2× Tokens
                </span>
              )}
            </div>
          }
        >
          <div className="stack" style={{ gap: "1rem" }}>
            <div style={{ color: "#bbb", fontSize: "0.9rem" }}>{currentGame.description}</div>

            {/* Stakes Selection */}
            <div>
              <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.4rem" }}>
                Select Gold Stake (Min: {fmt(currentGame.minStake)} · Max: {fmt(currentGame.maxStake)}):
              </div>
              <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                {[10_000, 50_000, 250_000, 1_000_000, 5_000_000, 10_000_000].map((amt) => (
                  <Button
                    key={amt}
                    size="sm"
                    variant={stake === amt ? "primary" : "ghost"}
                    disabled={amt > currentGame.maxStake || hero.coins < amt}
                    onClick={() => setStake(amt)}
                  >
                    {fmt(amt)}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={hero.coins < currentGame.minStake}
                  onClick={() => setStake(Math.min(currentGame.maxStake, Math.floor(hero.coins)))}
                >
                  Max Stake
                </Button>
              </div>
            </div>

            {/* Specific Mini-Game Controls */}
            <div style={{ background: "#0e0e0e", border: "1px solid #282828", borderRadius: "6px", padding: "1rem" }}>
              {/* 1. Goblet of Fates */}
              {currentGame.id === "goblet_of_fates" && (
                <div className="stack" style={{ gap: "0.75rem", textAlign: "center" }}>
                  <div style={{ fontSize: "0.85rem", color: "#aaa" }}>
                    Choose a goblet to uncover the Celestial Pearl:
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem" }}>
                    {[0, 1, 2].map((cupIdx) => (
                      <button
                        key={cupIdx}
                        type="button"
                        onClick={() => setSelectedCup(cupIdx)}
                        style={{
                          background: selectedCup === cupIdx ? "#262626" : "#181818",
                          border: `2px solid ${selectedCup === cupIdx ? "var(--gold, #d4af37)" : "#333"}`,
                          borderRadius: "8px",
                          padding: "1rem 1.5rem",
                          cursor: "pointer",
                          color: "#fff",
                        }}
                      >
                        <div style={{ fontSize: "2.5rem" }}>🏆</div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600, marginTop: "0.4rem" }}>
                          Goblet #{cupIdx + 1}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Abyssal Dice Duel */}
              {currentGame.id === "abyssal_dice" && (
                <div className="stack" style={{ gap: "0.75rem" }}>
                  <div style={{ fontSize: "0.85rem", color: "#aaa" }}>Predict the two dice sum:</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                    {[
                      { id: "low", label: "Low (2-6)", odds: "2.1×" },
                      { id: "seven", label: "Lucky Seven (7)", odds: "4.5×" },
                      { id: "high", label: "High (8-12)", odds: "2.1×" },
                    ].map((opt) => (
                      <Button
                        key={opt.id}
                        variant={dicePred === opt.id ? "primary" : "ghost"}
                        onClick={() => setDicePred(opt.id as "low" | "seven" | "high")}
                        style={{ padding: "0.8rem" }}
                      >
                        <div>
                          <b>{opt.label}</b>
                          <div style={{ fontSize: "0.75rem", color: "#aaa" }}>Pays {opt.odds}</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Spectral Twenty-One */}
              {currentGame.id === "damned_blackjack" && (
                <div className="stack" style={{ gap: "0.5rem", textAlign: "center" }}>
                  <div style={{ fontSize: "2rem" }}>🃏 ♠️ ♥️ ♣️ ♦️</div>
                  <div style={{ fontSize: "0.85rem", color: "#aaa" }}>
                    Direct showdown against the Spectral Dealer. Natural 21 pays 2.5×!
                  </div>
                </div>
              )}

              {/* 4. Celestial Wheel */}
              {currentGame.id === "celestial_wheel" && (
                <div className="stack" style={{ gap: "0.5rem", textAlign: "center" }}>
                  <div style={{ fontSize: "3rem" }}>🎡</div>
                  <div style={{ fontSize: "0.85rem", color: "#aaa" }}>
                    Slices: 0×, 0.5×, 1.2×, 2×, 5×, 10×, and the 50× Cosmic Jackpot!
                  </div>
                </div>
              )}

              {/* 5. Mines of Eldoria */}
              {currentGame.id === "mines_of_eldoria" && (
                <div className="stack" style={{ gap: "0.75rem" }}>
                  <div style={{ fontSize: "0.85rem", color: "#aaa" }}>
                    Select safe diamond tiles (Selected: {minePicks.length}/8). Avoid the 3 skulls!
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(5, 1fr)",
                      gap: "6px",
                      maxWidth: "280px",
                      margin: "0 auto",
                    }}
                  >
                    {Array.from({ length: 25 }).map((_, idx) => {
                      const selected = minePicks.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleMinePick(idx)}
                          style={{
                            aspectRatio: "1",
                            background: selected ? "#1e3a1e" : "#1c1c1c",
                            border: `1px solid ${selected ? "#22c55e" : "#333"}`,
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "1rem",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {selected ? "💎" : idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 6. Imperial Bullseye */}
              {currentGame.id === "archery_blitz" && (
                <div className="stack" style={{ gap: "0.75rem" }}>
                  <div style={{ fontSize: "0.85rem", color: "#aaa" }}>
                    Calibrate Shot Aim & Release Angle: <b>{aimPower}%</b>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={aimPower}
                    onChange={(e) => setAimPower(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "var(--gold, #d4af37)" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#666" }}>
                    <span>Left Gale Arc</span>
                    <span>Dead Center (50%)</span>
                    <span>Right Crosswind</span>
                  </div>
                </div>
              )}

              {/* 7. Alchemist's Cauldron */}
              {currentGame.id === "alchemists_cauldron" && (
                <div className="stack" style={{ gap: "0.75rem" }}>
                  <div style={{ fontSize: "0.85rem", color: "#aaa" }}>Select 2 elemental reagents to brew:</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <select
                      value={reagent1}
                      onChange={(e) => setReagent1(e.target.value)}
                      style={{ background: "#1c1c1c", color: "#fff", border: "1px solid #333", padding: "0.6rem", borderRadius: "4px" }}
                    >
                      <option value="dragon_blood">🐉 Dragon Blood</option>
                      <option value="sun_shard">☀️ Sun Shard</option>
                      <option value="moon_quartz">🌙 Moon Quartz</option>
                      <option value="starlight_dew">💧 Starlight Dew</option>
                      <option value="abyssal_ash">🌋 Abyssal Ash</option>
                      <option value="phoenix_feather">🪶 Phoenix Feather</option>
                    </select>

                    <select
                      value={reagent2}
                      onChange={(e) => setReagent2(e.target.value)}
                      style={{ background: "#1c1c1c", color: "#fff", border: "1px solid #333", padding: "0.6rem", borderRadius: "4px" }}
                    >
                      <option value="sun_shard">☀️ Sun Shard</option>
                      <option value="dragon_blood">🐉 Dragon Blood</option>
                      <option value="moon_quartz">🌙 Moon Quartz</option>
                      <option value="starlight_dew">💧 Starlight Dew</option>
                      <option value="abyssal_ash">🌋 Abyssal Ash</option>
                      <option value="phoenix_feather">🪶 Phoenix Feather</option>
                    </select>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#888" }}>
                    Tip: Dragon Blood + Sun Shard creates Philosopher's Gold (8×)!
                  </div>
                </div>
              )}

              {/* 8. Gladiator Beast Pit */}
              {currentGame.id === "gladiator_arena" && (
                <div className="stack" style={{ gap: "0.75rem" }}>
                  <div style={{ fontSize: "0.85rem", color: "#aaa" }}>Select your champion gladiator:</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                    {[
                      { id: "drake", name: "Inferno Drake", icon: "🐉", odds: "2.1×" },
                      { id: "behemoth", name: "Frost Behemoth", icon: "🦣", odds: "2.8×" },
                      { id: "stalker", name: "Abyssal Shadow", icon: "🐆", odds: "4.2×" },
                    ].map((b) => (
                      <Button
                        key={b.id}
                        variant={chosenBeast === b.id ? "primary" : "ghost"}
                        onClick={() => setChosenBeast(b.id)}
                        style={{ padding: "0.8rem", textAlign: "center" }}
                      >
                        <div>
                          <div style={{ fontSize: "1.8rem" }}>{b.icon}</div>
                          <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{b.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "#888" }}>Odds: {b.odds}</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* 9. Sage's Lore Trials */}
              {currentGame.id === "sages_trials" && (
                <div className="stack" style={{ gap: "0.75rem" }}>
                  <div style={{ fontSize: "0.95rem", color: "#fff", fontWeight: 600 }}>
                    {triviaPool[0]?.q ?? "Which hero class starts with the highest base Defense?"}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    {(triviaPool[0]?.options ?? ["Paladin", "Sorcerer", "Rogue", "Hunter"]).map((opt, oIdx) => (
                      <Button
                        key={oIdx}
                        variant={triviaAns === oIdx ? "primary" : "ghost"}
                        onClick={() => setTriviaAns(oIdx)}
                      >
                        {opt}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* 10. Matrix of Runes */}
              {currentGame.id === "memory_runes" && (
                <div className="stack" style={{ gap: "0.75rem" }}>
                  <div style={{ fontSize: "0.85rem", color: "#aaa" }}>
                    Align the 4 invocation runes in harmony:
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: "0.8rem" }}>
                    {[1, 2, 3, 4].map((rVal, rIdx) => (
                      <button
                        key={rIdx}
                        type="button"
                        onClick={() => {
                          const next = [...runeSeq];
                          const cur = next[rIdx] ?? 1;
                          next[rIdx] = (cur % 4) + 1;
                          setRuneSeq(next);
                        }}
                        style={{
                          background: "#1c1c1c",
                          border: "1px solid #333",
                          borderRadius: "6px",
                          padding: "0.8rem 1.2rem",
                          cursor: "pointer",
                          color: "#fff",
                          fontSize: "1.2rem",
                        }}
                      >
                        {["🔥", "💧", "⚡", "🌿"][(runeSeq[rIdx] ?? 1) - 1]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Play Button & Feedback */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
              <div>
                <span style={{ fontSize: "0.85rem", color: "#888" }}>Wager: </span>
                <b style={{ color: "#fff" }}><Coins value={stake} /></b>
              </div>
              <Button
                variant="primary"
                size="lg"
                loading={playGame.isPending}
                disabled={hero.coins < stake}
                onClick={handlePlay}
              >
                Play {currentGame.name}
              </Button>
            </div>

            {/* Last Result Box */}
            {lastResult && (
              <div
                style={{
                  background: lastResult.isWin ? "#122416" : "#241212",
                  border: `1px solid ${lastResult.isWin ? "#22c55e66" : "#ef444466"}`,
                  borderRadius: "6px",
                  padding: "0.9rem 1.1rem",
                }}
              >
                <div style={{ fontWeight: 600, color: lastResult.isWin ? "#4ade80" : "#f87171" }}>
                  {lastResult.message}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "#ccc", marginTop: "0.4rem" }}>
                  <span>Payout: <b style={{ color: "var(--gold, #d4af37)" }}>+{fmt(lastResult.payout)} coins</b> ({lastResult.multiplier}×)</span>
                  <span>Tokens: <b style={{ color: "#38bdf8" }}>+{lastResult.tokensEarned}</b></span>
                </div>
              </div>
            )}
          </div>
        </Panel>

        {/* Sidebar: Rules & Hall of Fame */}
        <div className="stack" style={{ gap: "1rem" }}>
          <Panel title="Carnival Rules & Odds">
            <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem", color: "#aaa" }}>
              {currentGame.rules.map((r, idx) => (
                <li key={idx} style={{ marginBottom: "0.4rem" }}>{r}</li>
              ))}
            </ul>
          </Panel>

          <Panel title="Your Carnival Record">
            <dl className="stats" style={{ margin: 0 }}>
              <div className="stat"><dt>Total Wagered</dt><dd>{fmt(stats.totalWagered)}</dd></div>
              <div className="stat"><dt>Total Won</dt><dd className="gold">{fmt(stats.totalWon)}</dd></div>
              <div className="stat"><dt>Games Played</dt><dd>{fmt(stats.gamesPlayed)}</dd></div>
              <div className="stat"><dt>Biggest Win</dt><dd className="gold">{fmt(stats.biggestWin)}</dd></div>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
