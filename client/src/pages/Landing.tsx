import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { CLASS_BY_ID } from "../../../shared/data/classes.ts";
import { REGIONS, STORY_CHAPTERS } from "../../../shared/data/regions.ts";
import { GameCard } from "../components/GameCard.tsx";
import { Button } from "../components/ui.tsx";
import { api, errorMessage } from "../lib/api.ts";
import { meKey } from "../state/game.ts";
import { useNotify } from "../state/notify.tsx";
import { useState } from "react";

const monsterCount = REGIONS.reduce((n, r) => n + r.monsters.length + 1, 0);

const FEATURES = [
  { art: "🏰", title: "The Tower of Ascension", text: `100 floors, a boss every fifth, and a ${STORY_CHAPTERS.length}-chapter story that ends at the Void Gate.` },
  { art: "🕳️", title: "Dungeon runs", text: "Descend, pick a boon every three floors, and decide when to cash out before the dark takes your pouch." },
  { art: "🐉", title: `${REGIONS.length} regions, ${monsterCount} creatures`, text: "From the Dark Forest to Primordial Peak. Master each foe in the bestiary for permanent edges against it." },
  { art: "⚔️", title: "Fights you actually play", text: "Turn-based battles with skills, cooldowns, guarding and potions. Bosses telegraph their heavy blows." },
  { art: "🥚", title: "Pets, forging and loot", text: "Hatch eggs, fuse pets, upgrade gear to +10 and forge two pieces into one of higher rarity." },
  { art: "🤝", title: "A living realm", text: "Live duels, ranked arena, a weekly world boss the whole server fights together, guilds, trading and chat." },
];

export function Landing() {
  const qc = useQueryClient();
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const knight = CLASS_BY_ID.dragon_knight!;

  const playAsGuest = async () => {
    setBusy(true);
    try {
      await api.post("/api/auth/guest");
      await qc.invalidateQueries({ queryKey: meKey });
    } catch (err) {
      notify.toast({ tone: "bad", title: errorMessage(err) });
      setBusy(false);
    }
  };

  return (
    <div className="landing">
      <header className="landing__bar">
        <Link to="/" className="rail__brand">
          <img src="/logo.png" alt="" width={46} height={46} />
          <div><b>DTEmpire</b><span>Adventure</span></div>
        </Link>
        <nav className="row">
          <Link className="btn btn--ghost" to="/login">Sign in</Link>
          <Link className="btn" to="/register">Create account</Link>
        </nav>
      </header>

      <section className="landing__hero">
        <div className="landing__copy">
          <h1>Draw your fate at the dragon's table.</h1>
          <p>
            DTEmpire Adventure is a multiplayer RPG played in cards. Your class, your gear, your pets and every monster you face
            is a card on the table. Climb the Tower, delve the Dungeon, and duel your friends in real time, right in your browser.
          </p>
          <div className="row row--wrap">
            <Button variant="primary" size="lg" loading={busy} onClick={() => void playAsGuest()}>Play now, no signup</Button>
            <Link className="btn btn--lg" to="/register">Create an account</Link>
            <a className="btn btn--ghost" href="/downloads/DTEmpire-Adventure-Setup.exe" download="DTEmpire-Adventure-Setup.exe">💻 Windows (.exe)</a>
            <a className="btn btn--ghost" href="/downloads/DTEmpire-Adventure.apk" download="DTEmpire-Adventure.apk">📱 Android (.apk)</a>
          </div>
          <p className="faint">Free to play. Guests can save their hero to an account at any time.</p>
        </div>
        <div className="landing__fan" aria-hidden>
          <GameCard size="lg" rarity="rare" art="🐺" name="Wolf" type={<><b>Dark Forest</b> · Monster</>} text="The first card most heroes ever draw." atk={9} hp={52} className="fan-1" />
          <GameCard size="lg" rarity="legendary" art={knight.icon} name={knight.name} type={<><b>legendary</b> class · Sword</>} text={`${knight.passive.name}: ${knight.passive.desc}.`} atk={knight.base.atk} hp={knight.base.hp} className="fan-2" />
          <GameCard size="lg" rarity="epic" art="⚡" name="Stormbreaker" type={<><b>epic</b> Weapon · hammer</>} text="Forged in the heart of a storm." atk={118} className="fan-3" />
        </div>
      </section>

      <section className="landing__features" aria-label="What's on the table">
        {FEATURES.map((f) => (
          <article key={f.title} className="feature">
            <span className="art" aria-hidden>{f.art}</span>
            <div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="landing__install panel">
        <h2>Play Everywhere · Web, Windows PC & Android</h2>
        <p>Enjoy synchronized cross-platform gameplay. Play directly in your browser, or install the standalone Windows desktop client and Android mobile app for high-fidelity graphics and offline asset caching.</p>
        <div className="row row--wrap" style={{ gap: "10px", marginTop: "12px", justifyContent: "center" }}>
          <Button variant="primary" loading={busy} onClick={() => void playAsGuest()}>Play Instantly in Browser</Button>
          <a className="btn btn--default" href="/downloads/DTEmpire-Adventure-Setup.exe" download="DTEmpire-Adventure-Setup.exe">💻 Windows (.exe)</a>
          <a className="btn btn--default" href="/downloads/DTEmpire-Adventure.apk" download="DTEmpire-Adventure.apk">📱 Android (.apk)</a>
          <Link className="btn btn--ghost" to="/apps">Learn More</Link>
        </div>
      </section>

      <footer className="landing__foot faint">
        <span>DTEmpire Adventure</span>
        <Link to="/login">Sign in</Link>
      </footer>
    </div>
  );
}
