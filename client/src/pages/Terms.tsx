import { FileText, Shield, Sparkles } from "lucide-react";
import { Link } from "react-router";
import { Panel } from "../components/ui.tsx";

export function TermsPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1><FileText size={28} aria-hidden style={{ verticalAlign: "middle", marginRight: "8px" }} /> Terms of Service</h1>
          <p className="lead">Last updated: September 24, 2026. Please read these terms before adventuring in DTEmpire Adventure.</p>
        </div>
      </div>

      <div className="stack" style={{ gap: "20px" }}>
        <Panel title={<h2>1. Acceptance of Terms</h2>}>
          <p className="muted" style={{ lineHeight: "1.7" }}>
            By creating an account, linking your Discord account, or otherwise accessing <b>DTEmpire Adventure</b> ("the Service", "the Game"),
            you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
          </p>
        </Panel>

        <Panel title={<h2>2. Accounts and Authentication</h2>}>
          <ul className="muted stack" style={{ paddingLeft: "20px", lineHeight: "1.7" }}>
            <li><b>Eligibility:</b> You must be at least 13 years old (or the minimum legal age in your jurisdiction) to use DTEmpire Adventure.</li>
            <li><b>Account Responsibility:</b> You are responsible for safeguarding your login credentials. You agree not to share your account or allow others to play on your behalf.</li>
            <li><b>Discord Authentication:</b> If you choose to link your Discord account via Discord OAuth2, you authorize us to retrieve your public Discord ID, username, and avatar to verify your identity. You may unlink Discord at any time in Settings.</li>
          </ul>
        </Panel>

        <Panel title={<h2>3. Fair Play and Code of Conduct</h2>}>
          <p className="muted" style={{ lineHeight: "1.7" }}>
            To keep the realm fun and equitable for all players, you agree not to:
          </p>
          <ul className="muted stack" style={{ paddingLeft: "20px", lineHeight: "1.7" }}>
            <li>Use automated bots, scripts, packet injectors, or macros to simulate gameplay or gain unfair competitive advantages.</li>
            <li>Exploit bugs, unintended economy loops, or glitches. Discovered vulnerabilities should be reported responsibly to the moderation team.</li>
            <li>Engage in harassment, hate speech, spamming, impersonation, or toxic conduct in chat or community channels.</li>
            <li>Attempt to circumvent server authentication, reverse-engineer proprietary game servers, or conduct denial-of-service attacks.</li>
          </ul>
        </Panel>

        <Panel title={<h2>4. Virtual Goods and Currency</h2>}>
          <p className="muted" style={{ lineHeight: "1.7" }}>
            All in-game assets, items, gold, equipment, pets, and titles are virtual tokens solely for amusement within DTEmpire Adventure.
            Virtual items have no monetary value outside the game, cannot be redeemed for fiat currency, and may not be sold for real-world money.
            We reserve the right to balance, re-tier, adjust stats, or modify in-game economy parameters to preserve gameplay health.
          </p>
        </Panel>

        <Panel title={<h2>5. Termination and Account Deletion</h2>}>
          <p className="muted" style={{ lineHeight: "1.7" }}>
            You may permanently delete your account and all associated hero data at any time directly through the in-game Settings page.
            We reserve the right to suspend or terminate accounts that violate these Terms of Service or engage in abusive or fraudulent behavior.
          </p>
        </Panel>

        <Panel title={<h2>6. Disclaimer of Warranties and Limitation of Liability</h2>}>
          <p className="muted" style={{ lineHeight: "1.7" }}>
            The Service is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind.
            In no event shall DTEmpire Adventure, its creators, or administrators be liable for any indirect, incidental, or consequential damages resulting from the use or inability to use the game.
          </p>
        </Panel>

        <Panel title={<h2>7. Contact and Support</h2>}>
          <p className="muted" style={{ lineHeight: "1.7" }}>
            For questions regarding these Terms, bug disclosures, or support inquiries, contact the administration team via the official DTEmpire Discord server or community hub.
          </p>
          <div style={{ marginTop: "14px" }}>
            <Link to="/privacy" className="btn btn--ghost">View Privacy Policy &rarr;</Link>
          </div>
        </Panel>
      </div>
    </>
  );
}

export function TermsStandalone() {
  return (
    <div className="landing" style={{ minHeight: "100vh", padding: "0 var(--s-4) var(--s-8)" }}>
      <header className="landing__bar">
        <Link to="/" className="rail__brand">
          <img src="/logo.png" alt="" width={46} height={46} />
          <div><b>DTEmpire</b><span>Adventure</span></div>
        </Link>
        <nav className="row" style={{ gap: "10px", flexWrap: "wrap" }}>
          <Link className="btn btn--ghost" to="/">Home</Link>
          <Link className="btn btn--ghost" to="/apps">Get App</Link>
          <Link className="btn btn--ghost" to="/privacy">Privacy Policy</Link>
          <Link className="btn btn--primary" to="/login">Sign in</Link>
        </nav>
      </header>
      <div style={{ maxWidth: "860px", margin: "0 auto", paddingTop: "24px" }}>
        <TermsPage />
      </div>
    </div>
  );
}
