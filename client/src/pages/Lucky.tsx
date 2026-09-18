import { useEffect, useRef, useState } from "react";
import { LUCKY_DAILY_SPINS, LUCKY_PAIR_MULT, LUCKY_PAYOUT, LUCKY_SYMBOLS, luckyCost } from "../../../shared/data/meta.ts";
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

  return (
    <>
      <PageHead title="Lucky Roll">Three reels, one pull. Any pair returns 1.2× your stake; three of a kind pays by symbol. {left} spins left today.</PageHead>
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
    </>
  );
}
