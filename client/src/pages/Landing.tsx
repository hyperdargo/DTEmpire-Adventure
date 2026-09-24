import { useQueryClient } from "@tanstack/react-query";
import { Download, Monitor, Smartphone } from "lucide-react";
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
        <nav className="row" style={{ gap: "8px" }}>
          <Link className="btn btn--primary" to="/apps" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Download size={15} /> Install App
          </Link>
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
          <div className="row row--wrap" style={{ gap: "8px", alignItems: "center" }}>
            <Button variant="primary" size="lg" loading={busy} onClick={() => void playAsGuest()}>Play now, no signup</Button>
            <Link className="btn btn--lg" to="/register">Create an account</Link>
            <Link className="btn btn--lg btn--default" to="/apps" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Download size={16} /> Install App
            </Link>
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
        <h2>Install Our App · Windows PC & Android</h2>
        <p>Get the full standalone experience. Install our app on your Windows PC or Android phone for instant launching, hardware acceleration, and seamless cross-platform character progress.</p>
        <div className="row row--wrap" style={{ gap: "16px", marginTop: "16px", justifyContent: "center" }}>
          <div className="card" style={{ flex: "1 1 280px", maxWidth: "360px", padding: "16px", background: "var(--surface-sunken)", border: "1px solid var(--line)", textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <Monitor size={24} style={{ color: "var(--gold)" }} />
              <div>
                <b>Windows PC Edition</b>
                <div className="faint" style={{ fontSize: "12px" }}>64-bit Installer · 78 MB</div>
              </div>
            </div>
            <p className="muted" style={{ fontSize: "13px", margin: "8px 0 12px" }}>Smooth 60 FPS gameplay with hardware acceleration and dedicated window frame.</p>
            <div className="row" style={{ gap: "8px" }}>
              <a className="btn btn--primary" href="/downloads/DTEmpire-Adventure-Setup.exe" download="DTEmpire-Adventure-Setup.exe" style={{ flex: 1, justifyContent: "center" }}>
                <Download size={15} /> Installer
              </a>
              <a className="btn btn--ghost" href="/downloads/DTEmpire-Adventure-Portable.exe" download="DTEmpire-Adventure-Portable.exe" style={{ flex: 1, justifyContent: "center" }}>
                <Download size={15} /> Portable
              </a>
            </div>
          </div>

          <div className="card" style={{ flex: "1 1 280px", maxWidth: "360px", padding: "16px", background: "var(--surface-sunken)", border: "1px solid var(--line)", textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <Smartphone size={24} style={{ color: "var(--gold)" }} />
              <div>
                <b>Android Mobile Edition</b>
                <div className="faint" style={{ fontSize: "12px" }}>APK Package · 65 KB</div>
              </div>
            </div>
            <p className="muted" style={{ fontSize: "13px", margin: "8px 0 12px" }}>Ultra-fast lightweight client with immersive full-screen play on mobile devices.</p>
            <a className="btn btn--primary" href="/downloads/DTEmpire-Adventure.apk" download="DTEmpire-Adventure.apk" style={{ width: "100%", justifyContent: "center" }}>
              <Download size={16} /> Download .apk (Android)
            </a>
          </div>
        </div>
        <div style={{ marginTop: "14px", textAlign: "center" }}>
          <Link className="btn btn--ghost" to="/apps">View Installation Guide & Details &rarr;</Link>
        </div>
      </section>

      <footer className="landing__foot faint" style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
        <span>&copy; {new Date().getFullYear()} DTEmpire Adventure</span>
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
          <Link to="/apps">Get App</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/login">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
