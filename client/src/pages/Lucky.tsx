import { useEffect, useRef, useState } from "react";
import { HIGH_ROLLER_STAKES, LUCKY_DAILY_SPINS, LUCKY_PAIR_MULT, LUCKY_PAYOUT, LUCKY_SYMBOLS, luckyCost } from "../../../shared/data/meta.ts";
import { Button, Coins, PageHead, Panel } from "../components/ui.tsx";
import { play } from "../lib/sound.ts";
import { useAction, useData, useHero } from "../state/game.ts";

export default function LuckyPage() {
  const { hero } = useHero();
  const daily = useData<{ lucky: { spinsUsed: number } }>(["daily"], "/api/daily");
  const [reels, setReels] = useState<string[]>(["👑", "👑", "👑"]);
  const [spinning, setSpinning] = useState(false);
  const [last, setLast] = useState<{ win: number; jackpot: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // High Roller state
  const [tab, setTab] = useState<"daily" | "highroller">("daily");
  const [hrStake, setHrStake] = useState<number>(10_000);
  const [hrGame, setHrGame] = useState<"coin" | "dice" | "slots">("coin");
  const [coinChoice, setCoinChoice] = useState<"heads" | "tails">("heads");
  const [hrOutcome, setHrOutcome] = useState<{
    game: string;
    stake: number;
    win: number;
    multiplier: number;
    outcomeDesc: string;
    details: Record<string, unknown>;
  } | null>(null);

  const spin = useAction<void, { reels: string[]; win: number; jackpot: boolean; spinsLeft: number }>("/api/lucky/spin", {
    invalidate: [["daily"]],
    onSuccess: (r) => {
      const stop = (i: number) => setTimeout(() => {
        setReels((cur) => cur.map((s, j) => (j === i ? r.reels[i]! : s)));
        play("flip");
        if (i === 2) {
          if (timer.current) clearInterval(timer.current);
          setSpinning(false);
          setLast({ win: r.win, jackpot: r.jackpot });
          if (r.win) play(r.jackpot ? "level" : "coin");
        }
      }, 450 + i * 380);
      [0, 1, 2].forEach(stop);
    },
    onError: () => {
      if (timer.current) clearInterval(timer.current);
      setSpinning(false);
    },
  });

  const highRollerAction = useAction<
    { game: "coin" | "dice" | "slots"; stake: number; choice?: string },
    { game: string; stake: number; win: number; multiplier: number; outcomeDesc: string; coins: number; details: Record<string, unknown> }
  >("/api/lucky/highroller", {
    onSuccess: (r) => {
      setHrOutcome(r);
      if (r.win > 0) {
        play(r.win >= r.stake * 3 ? "level" : "coin");
      } else {
        play("hit");
      }
    },
  });

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const go = () => {
    setLast(null);
    setSpinning(true);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      timer.current = setInterval(() => setReels(() => [0, 1, 2].map(() => LUCKY_SYMBOLS[Math.floor(Math.random() * LUCKY_SYMBOLS.length)]!)), 80);
    }
    spin.mutate(undefined);
  };
  const cost = luckyCost(hero.level);
  const left = LUCKY_DAILY_SPINS - (daily.data?.lucky.spinsUsed ?? 0);

  const playHighRoller = () => {
    setHrOutcome(null);
    highRollerAction.mutate({
      game: hrGame,
      stake: hrStake,
      choice: hrGame === "coin" ? coinChoice : undefined,
    });
  };

  return (
    <>
      <PageHead
        title="Lucky Roll & High-Roller"
        actions={
          <div className="row" style={{ gap: "var(--s-2)" }}>
            <Button
              variant={tab === "daily" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setTab("daily")}
            >
              Daily Wheel ({left} left)
            </Button>
            <Button
              variant={tab === "highroller" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setTab("highroller")}
            >
              💎 High-Roller Salon
            </Button>
          </div>
        }
      >
        {tab === "daily"
          ? "Three reels, one pull. Any pair returns 1.2× your stake; three of a kind pays by symbol."
          : "Unlimited high-stakes wagers. Bet from 10,000 to 500,000 coins on coin tosses, dragon dice, or slots."}
      </PageHead>

      {tab === "daily" ? (
        <div className="lucky">
          <Panel>
            <div className={`reels${spinning ? " reels--spinning" : ""}`} aria-live="polite" aria-label={`Reels: ${reels.join(" ")}`}>
              {reels.map((s, i) => <div key={i} className="reel"><span className="art">{s}</span></div>)}
            </div>
            <p className="lucky__result" role="status">
              {last ? (last.jackpot ? "JACKPOT!" : last.win ? <>You win <Coins value={last.win} compact /></> : "No luck this time.") : " "}
            </p>
            <Button variant="primary" size="lg" block disabled={spinning || left <= 0 || hero.coins < cost} onClick={go}>
              {left <= 0 ? "The wheel rests until tomorrow" : <>Pull · <Coins value={cost} compact /></>}
            </Button>
          </Panel>
          <Panel title="Payouts">
            <dl className="stats">
              {LUCKY_SYMBOLS.map((s) => <div className="stat" key={s}><dt><span className="art">{s}{s}{s}</span></dt><dd>{LUCKY_PAYOUT[s]}× stake</dd></div>)}
              <div className="stat"><dt>Any pair</dt><dd>{LUCKY_PAIR_MULT}× stake</dd></div>
            </dl>
            <p className="faint" style={{ marginTop: "var(--s-3)" }}>The house wins over time. Spins are capped daily so it stays a bit of fun.</p>
          </Panel>
        </div>
      ) : (
        <div className="lucky">
          <Panel title="High-Roller Salon 💎">
            <div className="stack stack--md">
              <div>
                <label className="faint" style={{ display: "block", marginBottom: "var(--s-1)" }}>Select Stake</label>
                <div className="row row--wrap" style={{ gap: "var(--s-2)" }}>
                  {HIGH_ROLLER_STAKES.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={hrStake === s ? "primary" : "ghost"}
                      onClick={() => setHrStake(s)}
                    >
                      <Coins value={s} compact />
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="faint" style={{ display: "block", marginBottom: "var(--s-1)" }}>Choose Game</label>
                <div className="row" style={{ gap: "var(--s-2)" }}>
                  <Button
                    size="sm"
                    variant={hrGame === "coin" ? "primary" : "ghost"}
                    onClick={() => setHrGame("coin")}
                  >
                    🪙 Coin Toss (2.0×)
                  </Button>
                  <Button
                    size="sm"
                    variant={hrGame === "dice" ? "primary" : "ghost"}
                    onClick={() => setHrGame("dice")}
                  >
                    🎲 Dragon Dice (Up to 10×)
                  </Button>
                  <Button
                    size="sm"
                    variant={hrGame === "slots" ? "primary" : "ghost"}
                    onClick={() => setHrGame("slots")}
                  >
                    🎰 High Slots
                  </Button>
                </div>
              </div>

              {hrGame === "coin" && (
                <div>
                  <label className="faint" style={{ display: "block", marginBottom: "var(--s-1)" }}>Your Call</label>
                  <div className="row" style={{ gap: "var(--s-2)" }}>
                    <Button
                      variant={coinChoice === "heads" ? "primary" : "ghost"}
                      onClick={() => setCoinChoice("heads")}
                    >
                      🪙 Heads
                    </Button>
                    <Button
                      variant={coinChoice === "tails" ? "primary" : "ghost"}
                      onClick={() => setCoinChoice("tails")}
                    >
                      🦅 Tails
                    </Button>
                  </div>
                </div>
              )}

              {hrOutcome && (
                <div
                  style={{
                    padding: "var(--s-3)",
                    border: "1px solid var(--border)",
                    borderRadius: "4px",
                    background: hrOutcome.win > 0 ? "rgba(234, 179, 8, 0.1)" : "rgba(239, 68, 68, 0.1)",
                    textAlign: "center",
                  }}
                >
                  <h4 style={{ margin: 0, color: hrOutcome.win > 0 ? "var(--gold)" : "var(--danger)" }}>
                    {hrOutcome.win > 0 ? `🎉 VICTORY! Won +${hrOutcome.win.toLocaleString("en-US")} Coins!` : "💀 DEFEAT — Stake Lost"}
                  </h4>
                  <p style={{ margin: "var(--s-1) 0 0 0" }}>{hrOutcome.outcomeDesc}</p>
                  {hrOutcome.game === "dice" && (
                    <p className="faint" style={{ margin: "var(--s-1) 0 0 0" }}>
                      Dice rolled: [{String(hrOutcome.details.d1)}] + [{String(hrOutcome.details.d2)}] = <b>{String(hrOutcome.details.total)}</b>
                    </p>
                  )}
                  {hrOutcome.game === "slots" && Array.isArray(hrOutcome.details.reels) && (
                    <p style={{ fontSize: "1.5rem", margin: "var(--s-1) 0 0 0" }}>
                      {hrOutcome.details.reels.join(" ")}
                    </p>
                  )}
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                block
                disabled={highRollerAction.isPending || hero.coins < hrStake}
                onClick={playHighRoller}
              >
                {hero.coins < hrStake ? "Not enough coins" : `Wager ${hrStake.toLocaleString("en-US")} Coins`}
              </Button>
            </div>
          </Panel>

          <Panel title="High-Roller Rules">
            <dl className="stats">
              <div className="stat"><dt>🪙 Coin Toss</dt><dd>50/50 fair odds. 2.0× payout.</dd></div>
              <div className="stat"><dt>🎲 Dragon Dice (12)</dt><dd className="gold">Double Sixes: 10.0× JACKPOT!</dd></div>
              <div className="stat"><dt>🎲 Dragon Dice (2)</dt><dd>Snake Eyes: 5.0× payout</dd></div>
              <div className="stat"><dt>🎲 Dragon Dice (10-11)</dt><dd>3.0× payout</dd></div>
              <div className="stat"><dt>🎲 Dragon Dice (7-9)</dt><dd>1.5× payout</dd></div>
              <div className="stat"><dt>🎰 High Slots</dt><dd>Pairs 1.2×, 3-of-a-kind up to 25×.</dd></div>
            </dl>
            <p className="faint" style={{ marginTop: "var(--s-3)" }}>
              Wins over 250,000 coins are broadcast realm-wide. Play responsibly!
            </p>
          </Panel>
        </div>
      )}
    </>
  );
}
