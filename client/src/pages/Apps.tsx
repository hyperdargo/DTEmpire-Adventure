import { CheckCircle2, Download, Monitor, ShieldCheck, Smartphone, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Button, Panel } from "../components/ui.tsx";

export function AppsPage() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const triggerDownload = (filename: string) => {
    setDownloading(filename);
    const a = document.createElement("a");
    a.href = `/downloads/${filename}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setDownloading(null), 2500);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1><Download size={28} aria-hidden style={{ verticalAlign: "middle", marginRight: "8px" }} /> Native Apps & Downloads</h1>
          <p className="lead">Play DTEmpire Adventure anywhere with synchronized real-time progress across Web, Windows PC, and Android.</p>
        </div>
      </div>

      <div className="stack">
        <Panel title={<h2><Sparkles size={22} aria-hidden /> Download Standalone Clients</h2>}>
          <div className="row row--wrap" style={{ gap: "20px", marginTop: "12px" }}>
            <div className="card" style={{ flex: "1 1 320px", padding: "20px", background: "var(--surface-sunken)", border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <Monitor size={32} style={{ color: "var(--gold)" }} />
                <div>
                  <h3 style={{ margin: 0 }}>Windows PC Edition</h3>
                  <span className="faint">Windows 10 / 11 · 64-bit · v5.1.1</span>
                </div>
              </div>
              <p className="muted" style={{ fontSize: "14px", lineHeight: "1.5" }}>
                Full desktop experience with high-resolution scaling, Discord Rich Presence integration, multi-tier graphics engine, and 60 FPS rendering.
              </p>
              <div className="row row--wrap" style={{ marginTop: "16px", gap: "10px" }}>
                <Button
                  variant="primary"
                  loading={downloading === "DTEmpire-Adventure-Setup.exe"}
                  onClick={() => triggerDownload("DTEmpire-Adventure-Setup.exe")}
                >
                  <Download size={16} /> Installer (.exe)
                </Button>
                <Button
                  variant="ghost"
                  loading={downloading === "DTEmpire-Adventure-Portable.exe"}
                  onClick={() => triggerDownload("DTEmpire-Adventure-Portable.exe")}
                >
                  <Download size={16} /> Portable (.exe)
                </Button>
              </div>
              <div className="faint" style={{ marginTop: "8px", fontSize: "12px" }}>
                Installer: 78 MB · Portable: 8.6 MB (No install required)
              </div>
            </div>

            <div className="card" style={{ flex: "1 1 320px", padding: "20px", background: "var(--surface-sunken)", border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <Smartphone size={32} style={{ color: "var(--gold)" }} />
                <div>
                  <h3 style={{ margin: 0 }}>Android Mobile Edition</h3>
                  <span className="faint">Android 7.0+ · APK Package · v5.1.0</span>
                </div>
              </div>
              <p className="muted" style={{ fontSize: "14px", lineHeight: "1.5" }}>
                Ultra-lightweight native client with hardware acceleration, full-screen immersive play, and instant background sync.
              </p>
              <div style={{ marginTop: "16px" }}>
                <Button
                  variant="primary"
                  size="lg"
                  loading={downloading === "DTEmpire-Adventure.apk"}
                  onClick={() => triggerDownload("DTEmpire-Adventure.apk")}
                >
                  <Download size={18} /> Download APK (.apk)
                </Button>
                <div className="faint" style={{ marginTop: "8px", fontSize: "12px" }}>
                  File: DTEmpire-Adventure.apk (65 KB)
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title={<h2><Zap size={22} aria-hidden /> Features & Cross-Platform Sync</h2>}>
          <div className="stack" style={{ gap: "12px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <CheckCircle2 size={20} style={{ color: "var(--gold)", flexShrink: 0, marginTop: "2px" }} />
              <div>
                <b>100% Real-Time Cloud Save Synchronization</b>
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  Log in with your existing account. All hero levels, gold, blacksmith equipment, guild chat, and dungeon runs are instantly synchronized between the browser and apps.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <CheckCircle2 size={20} style={{ color: "var(--gold)", flexShrink: 0, marginTop: "2px" }} />
              <div>
                <b>Dynamic 2D Lighting & Ambient Particles</b>
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  Advanced visual engine inspired by retro isometric classics. Featuring rising campfire embers, forge glows, cyan magic pools, and arcade battle damage numbers.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <CheckCircle2 size={20} style={{ color: "var(--gold)", flexShrink: 0, marginTop: "2px" }} />
              <div>
                <b>Custom Graphics Tiers (Low, Medium, High)</b>
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  Control visual fidelity in Settings to match your device. Switch between ultra performance mode or cinematic arcade effects with retro CRT scanline filters.
                </p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title={<h2><ShieldCheck size={22} aria-hidden /> Installation Instructions</h2>}>
          <div className="row row--wrap" style={{ gap: "20px" }}>
            <div style={{ flex: "1 1 300px" }}>
              <h4>Windows Setup:</h4>
              <ol className="muted" style={{ paddingLeft: "20px", lineHeight: "1.8", fontSize: "14px" }}>
                <li>Click <b>Download Installer (.exe)</b> above.</li>
                <li>Open the downloaded <code className="code">DTEmpire-Adventure-Setup.exe</code>.</li>
                <li>If prompted by Windows SmartScreen, click <i>More Info</i> &rarr; <i>Run anyway</i>.</li>
                <li>The game will install to your Start Menu and Desktop.</li>
              </ol>
            </div>
            <div style={{ flex: "1 1 300px" }}>
              <h4>Android APK Setup:</h4>
              <ol className="muted" style={{ paddingLeft: "20px", lineHeight: "1.8", fontSize: "14px" }}>
                <li>Click <b>Download APK (.apk)</b> on your Android phone.</li>
                <li>Open the downloaded <code className="code">DTEmpire-Adventure.apk</code> from your notifications or Downloads folder.</li>
                <li>If prompted, enable <i>Allow from this source</i> in your browser settings.</li>
                <li>Tap <b>Install</b> and launch the game.</li>
              </ol>
            </div>
          </div>
          <div style={{ marginTop: "20px", borderTop: "1px solid var(--line)", paddingTop: "14px" }}>
            <Link to="/settings" className="btn btn--default">Configure Graphics in Settings &rarr;</Link>
          </div>
        </Panel>
      </div>
    </>
  );
}

export function AppsStandalone() {
  return (
    <div className="landing" style={{ minHeight: "100vh", padding: "0 var(--s-4) var(--s-8)" }}>
      <header className="landing__bar">
        <Link to="/" className="rail__brand">
          <img src="/logo.png" alt="" width={46} height={46} />
          <div><b>DTEmpire</b><span>Adventure</span></div>
        </Link>
        <nav className="row" style={{ gap: "10px" }}>
          <Link className="btn btn--ghost" to="/">Home</Link>
          <Link className="btn btn--ghost" to="/login">Sign in</Link>
          <Link className="btn btn--primary" to="/register">Create account</Link>
        </nav>
      </header>
      <div style={{ maxWidth: "980px", margin: "0 auto", paddingTop: "24px" }}>
        <AppsPage />
      </div>
    </div>
  );
}
