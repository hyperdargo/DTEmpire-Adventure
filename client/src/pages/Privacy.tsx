import { Database, Lock, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { Panel } from "../components/ui.tsx";

export function PrivacyPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1><ShieldCheck size={28} aria-hidden style={{ verticalAlign: "middle", marginRight: "8px" }} /> Privacy Policy</h1>
          <p className="lead">Last updated: September 24, 2026. How DTEmpire Adventure collects, handles, and protects your information.</p>
        </div>
      </div>

      <div className="stack" style={{ gap: "20px" }}>
        <Panel title={<h2>1. Overview</h2>}>
          <p className="muted" style={{ lineHeight: "1.7" }}>
            <b>DTEmpire Adventure</b> ("we", "our", or "the Service") respects your privacy.
            We design our application with a privacy-first approach: we collect only the minimal data required to save your character progress, synchronize your gameplay across platforms (Web, Windows Desktop, Android), and authenticate your account.
          </p>
        </Panel>

        <Panel title={<h2>2. Information We Collect</h2>}>
          <ul className="muted stack" style={{ paddingLeft: "20px", lineHeight: "1.7" }}>
            <li><b>Account Credentials:</b> If you register with a username and password, we securely hash passwords with salted bcrypt. We never store raw passwords. If provided, email addresses are stored only for account recovery.</li>
            <li><b>Discord OAuth2 Information:</b> When you choose to authenticate via Discord, we receive your Discord user ID, username, and avatar URL. <b>We never access your Discord password, payment methods, direct messages, or friends list.</b></li>
            <li><b>Gameplay Progression:</b> Character level, class, equipment, inventory items, town upgrades, quest logs, and combat history are stored in our game database to persist your adventure across sessions.</li>
            <li><b>Technical & Session Data:</b> IP address, browser user-agent, and session cookies used solely for security logging, rate limiting, and anti-CSRF protection (`x-dte-request`).</li>
          </ul>
        </Panel>

        <Panel title={<h2>3. How We Use Your Information</h2>}>
          <p className="muted" style={{ lineHeight: "1.7" }}>
            We use collected information exclusively to:
          </p>
          <ul className="muted stack" style={{ paddingLeft: "20px", lineHeight: "1.7" }}>
            <li>Maintain, operate, and synchronize your game state across Web, Windows Desktop, and Android APK clients.</li>
            <li>Authenticate your login sessions and prevent account takeovers.</li>
            <li>Prevent fraud, botting, cheating, and unauthorized access to game servers.</li>
          </ul>
          <p className="muted" style={{ lineHeight: "1.7", marginTop: "10px" }}>
            <b>We do NOT sell, rent, monetize, or disclose your personal data to any third-party advertisers or data brokers.</b>
          </p>
        </Panel>

        <Panel title={<h2>4. Third-Party Integrations</h2>}>
          <p className="muted" style={{ lineHeight: "1.7" }}>
            Our Service interacts with Discord via Discord's official OAuth2 APIs:
          </p>
          <ul className="muted stack" style={{ paddingLeft: "20px", lineHeight: "1.7" }}>
            <li><b>Discord OAuth:</b> Authorizes your login using Discord's identity endpoint (`https://discord.com/api/oauth2/token`). Information received is governed by Discord's Privacy Policy.</li>
            <li><b>Discord Rich Presence:</b> On the Windows Desktop application, a local pipe connection communicates with your local Discord client to display your active game zone or battle state on your Discord profile. No private gameplay or credentials are sent outside your local machine.</li>
          </ul>
        </Panel>

        <Panel title={<h2>5. Data Retention & Account Deletion</h2>}>
          <p className="muted" style={{ lineHeight: "1.7" }}>
            You have full ownership and control over your data.
            You can unlink your Discord account or permanently delete your account, hero, inventory, and all associated records at any time directly through <b>Settings &rarr; Delete account</b>.
            Upon confirmation, your data is immediately and permanently purged from active databases.
          </p>
        </Panel>

        <Panel title={<h2>6. Cookies and Storage</h2>}>
          <p className="muted" style={{ lineHeight: "1.7" }}>
            We use secure `HttpOnly` session cookies and local storage tokens strictly necessary for game state preservation, anti-tampering, and graphics settings preferences. We do not use third-party tracking cookies or advertising pixels.
          </p>
        </Panel>

        <Panel title={<h2>7. Contact and Inquiries</h2>}>
          <p className="muted" style={{ lineHeight: "1.7" }}>
            If you have questions about this Privacy Policy or wish to exercise your privacy rights, please reach out via our community Discord server or support channels.
          </p>
          <div style={{ marginTop: "14px" }}>
            <Link to="/terms" className="btn btn--ghost">View Terms of Service &rarr;</Link>
          </div>
        </Panel>
      </div>
    </>
  );
}

export function PrivacyStandalone() {
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
          <Link className="btn btn--ghost" to="/terms">Terms of Service</Link>
          <Link className="btn btn--primary" to="/login">Sign in</Link>
        </nav>
      </header>
      <div style={{ maxWidth: "860px", margin: "0 auto", paddingTop: "24px" }}>
        <PrivacyPage />
      </div>
    </div>
  );
}
