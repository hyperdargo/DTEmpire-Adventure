import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cpu, Download, LogOut, Monitor, RefreshCw, Smartphone, Sparkles, Zap } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Portrait } from "../components/Shell.tsx";
import { Button, PageHead, Panel } from "../components/ui.tsx";
import {
  getStoredCrtFilter,
  getStoredGraphicsQuality,
  setStoredCrtFilter,
  setStoredGraphicsQuality,
  type GraphicsQuality,
} from "../components/GraphicsEngine.tsx";
import { api, errorMessage } from "../lib/api.ts";
import { setSoundEnabled, soundEnabled } from "../lib/sound.ts";
import { meKey, useAction, useHero } from "../state/game.ts";
import { useNotify } from "../state/notify.tsx";

interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferredInstall: InstallEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e as InstallEvent;
  });
}

export default function SettingsPage() {
  const me = useHero();
  const { hero, user } = me;
  const qc = useQueryClient();
  const notify = useNotify();
  const providers = useQuery({ queryKey: ["providers"], queryFn: () => api.get<{ discord: boolean; email: boolean }>("/api/auth/providers") });
  const [sound, setSound] = useState(soundEnabled());
  const [installable, setInstallable] = useState(!!deferredInstall);
  const [busy, setBusy] = useState<string | null>(null);
  const [graphics, setGraphics] = useState<GraphicsQuality>(
    () => (hero.settings?.graphicsQuality as GraphicsQuality) ?? getStoredGraphicsQuality()
  );
  const [crt, setCrt] = useState<boolean>(() => hero.settings?.crtFilter ?? getStoredCrtFilter());
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const settings = useAction<{
    autoSalvageCommon?: boolean;
    graphicsQuality?: GraphicsQuality;
    crtFilter?: boolean;
  }>("/api/settings", { success: "Saved." });
  const profile = useAction<{ bio: string }>("/api/profile", { success: "Profile saved." });

  useEffect(() => {
    const on = () => setInstallable(true);
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) notify.toast({ tone: "good", title: ok });
      await qc.invalidateQueries({ queryKey: meKey });
      return true;
    } catch (err) {
      notify.toast({ tone: "bad", title: errorMessage(err) });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const selectGraphics = (q: GraphicsQuality) => {
    setGraphics(q);
    setStoredGraphicsQuality(q);
    settings.mutate({ graphicsQuality: q });
    notify.toast({
      tone: "good",
      title: `Graphics set to ${q.toUpperCase()}`,
    });
  };

  const toggleCrt = (enabled: boolean) => {
    setCrt(enabled);
    setStoredCrtFilter(enabled);
    settings.mutate({ crtFilter: enabled });
  };

  const handleLiveUpdate = async () => {
    setCheckingUpdate(true);
    try {
      // 1. Fetch server version info
      const ver = await api.get<{ version: string; buildTime: number; appVersion?: string }>("/api/version");
      
      // 2. Check Service Worker for new cache assets
      let foundSwUpdate = false;
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          if (reg.waiting || reg.installing) {
            foundSwUpdate = true;
          }
        }
      }

      if (foundSwUpdate) {
        notify.toast({
          tone: "good",
          title: "New realm patch found! Reloading assets...",
        });
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        notify.toast({
          tone: "good",
          title: `You are playing on the latest version (${ver.appVersion ?? ver.version}). Realm is synchronized!`,
        });
      }
    } catch {
      notify.toast({
        tone: "warn",
        title: "Could not reach version server. Refreshing local caches...",
      });
      setTimeout(() => window.location.reload(), 1000);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const forceCachePurge = async () => {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    notify.toast({ tone: "good", title: "Caches cleared. Reloading realm..." });
    setTimeout(() => {
      window.location.href = window.location.pathname + "?v=" + Date.now();
    }, 800);
  };

  const upgrade = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("confirm")) return notify.toast({ tone: "bad", title: "The passwords don't match." });
    void run("upgrade", () => api.post("/api/auth/upgrade", { username: f.get("username"), password: f.get("password"), email: f.get("email") }), "Your hero is saved to your account.");
  };
  const changePassword = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    void run("password", () => api.post("/api/auth/password", { current: f.get("current") || undefined, next: f.get("next") }), "Password changed.").then((ok) => ok && form.reset());
  };
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.append("avatar", file);
    await run("avatar", () => api.upload("/api/profile/avatar", form), "Portrait updated.");
  };
  const logout = async () => {
    await api.post("/api/auth/logout").catch(() => {});
    qc.clear();
    location.href = "/";
  };
  const del = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = await run("delete", () => api.post("/api/auth/delete", { password: f.get("password") || undefined, confirm: f.get("confirm") }));
    if (ok) {
      qc.clear();
      location.href = "/";
    }
  };

  return (
    <>
      <PageHead title="Settings" actions={<Button icon={<LogOut size={16} />} onClick={() => void logout()}>Sign out</Button>} />
      <div className="settings">
        {user!.isGuest && (
          <Panel title="Save your hero">
            <p className="muted">You're playing as a guest. Choose a username and password to keep your hero, chat in World, trade and use the auction house.</p>
            <form className="stack" onSubmit={upgrade}>
              <label className="field"><span>Username</span><input className="input" name="username" required pattern="[A-Za-z0-9_]{3,20}" autoComplete="username" /></label>
              <label className="field"><span>Email (optional)</span><input className="input" name="email" type="email" autoComplete="email" /></label>
              <label className="field"><span>Password</span><input className="input" name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
              <label className="field"><span>Confirm password</span><input className="input" name="confirm" type="password" minLength={8} required autoComplete="new-password" /></label>
              <Button type="submit" variant="primary" loading={busy === "upgrade"}>Save my hero</Button>
            </form>
          </Panel>
        )}

        <Panel title="Profile">
          <div className="row row--wrap" style={{ alignItems: "center" }}>
            <Portrait classId={hero.class.id} avatar={hero.avatar} rarity={hero.class.rarity} />
            <label className="btn btn--sm">
              Upload portrait
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} />
            </label>
            <span className="faint">PNG, JPEG or WebP, up to 1 MB.</span>
          </div>
          <form className="stack" style={{ marginTop: "var(--s-4)" }} onSubmit={(e) => { e.preventDefault(); profile.mutate({ bio: String(new FormData(e.currentTarget).get("bio") ?? "") }); }}>
            <label className="field"><span>Motto</span><input className="input" name="bio" maxLength={160} defaultValue={hero.bio ?? ""} placeholder="A line for your profile" /></label>
            <Button type="submit" size="sm">Save motto</Button>
          </form>
          <p className="faint" style={{ marginTop: "var(--s-3)" }}>Titles are chosen in <Link to="/records">Records</Link>. Your public page: <Link to={`/players/${encodeURIComponent(hero.name)}`}>{hero.name}</Link>.</p>
        </Panel>

        <Panel title={<h2><Sparkles size={20} aria-hidden /> Visuals & Graphics Quality</h2>}>
          <p className="muted">Customize the visual fidelity of the realm. High mode activates dynamic 2D lighting, forge and dungeon particle atmosphere, and arcade combat popouts.</p>
          <div className="stack" style={{ gap: "var(--s-4)", marginTop: "var(--s-3)" }}>
            <div className="row row--wrap" role="radiogroup" aria-label="Graphics Quality">
              <Button
                variant={graphics === "low" ? "primary" : "ghost"}
                size="sm"
                icon={<Cpu size={16} />}
                onClick={() => selectGraphics("low")}
              >
                Low (60 FPS Performance)
              </Button>
              <Button
                variant={graphics === "medium" ? "primary" : "ghost"}
                size="sm"
                icon={<Sparkles size={16} />}
                onClick={() => selectGraphics("medium")}
              >
                Medium (Balanced)
              </Button>
              <Button
                variant={graphics === "high" ? "primary" : "ghost"}
                size="sm"
                icon={<Zap size={16} />}
                onClick={() => selectGraphics("high")}
              >
                High (Ultra Engine)
              </Button>
            </div>
            <div className="stack" style={{ gap: "var(--s-2)" }}>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={crt}
                  onChange={(e) => toggleCrt(e.target.checked)}
                />
                Retro CRT & Scanline post-processing filter
              </label>
              <p className="faint">
                {graphics === "high"
                  ? "High mode enables real-time 2D canvas lighting, particle embers in forge/camp, mystical dungeon dust, and screen shakes."
                  : graphics === "medium"
                  ? "Medium mode provides smooth animations, clean isometric depth, and subtle ambient motes."
                  : "Low mode turns off all canvas shaders and particles for maximum battery life and minimum latency."}
              </p>
            </div>
          </div>
        </Panel>

        <Panel title={<h2><RefreshCw size={20} aria-hidden /> Realm Version & Live Update</h2>}>
          <p className="muted">Keep your client synchronized with the latest realm updates. When new content or balance patches are released, update immediately without losing game state.</p>
          <div className="row row--wrap" style={{ gap: "var(--s-3)", marginTop: "var(--s-3)", alignItems: "center" }}>
            <Button
              variant="primary"
              icon={<RefreshCw size={16} className={checkingUpdate ? "spin" : ""} />}
              loading={checkingUpdate}
              onClick={() => void handleLiveUpdate()}
            >
              Check for live updates
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void forceCachePurge()}
            >
              Force refresh realm assets
            </Button>
          </div>
        </Panel>

        <Panel title={<h2><Monitor size={20} aria-hidden /> Native Apps (.exe & .apk)</h2>}>
          <p className="muted">Play on desktop or mobile with native hardware acceleration. Both the webapp and native apps use your same hero account in real-time sync.</p>
          <div className="row row--wrap" style={{ gap: "var(--s-3)", marginTop: "var(--s-3)" }}>
            <a
              className="btn btn--primary"
              href="/downloads/DTEmpire-Adventure-Setup.exe"
              download="DTEmpire-Adventure-Setup.exe"
            >
              <Monitor size={16} /> Download for Windows (.exe)
            </a>
            <a
              className="btn btn--primary"
              href="/downloads/DTEmpire-Adventure.apk"
              download="DTEmpire-Adventure.apk"
            >
              <Smartphone size={16} /> Download for Android (.apk)
            </a>
            {installable && (
              <Button
                variant="ghost"
                icon={<Download size={16} />}
                onClick={async () => {
                  await deferredInstall?.prompt();
                  deferredInstall = null;
                  setInstallable(false);
                }}
              >
                Install Web App (PWA)
              </Button>
            )}
          </div>
          <p className="faint" style={{ marginTop: "var(--s-3)" }}>
            All progress, equipment, and level advancements save to your central account across Web, Windows, and Android.
          </p>
        </Panel>

        <Panel title="Preferences">
          <div className="stack">
            <label className="toggle"><input type="checkbox" checked={sound} onChange={(e) => { setSoundEnabled(e.target.checked); setSound(e.target.checked); }} /> Sound effects</label>
            <label className="toggle"><input type="checkbox" checked={!!hero.settings.autoSalvageCommon} onChange={(e) => settings.mutate({ autoSalvageCommon: e.target.checked })} /> Automatically salvage common gear drops into materials</label>
            <p className="faint">Animations follow your device's reduced-motion setting.</p>
          </div>
        </Panel>

        {!user!.isGuest && (
          <Panel title="Security">
            <form className="stack" onSubmit={changePassword}>
              {user!.hasPassword && <label className="field"><span>Current password</span><input className="input" name="current" type="password" autoComplete="current-password" required /></label>}
              <label className="field"><span>New password</span><input className="input" name="next" type="password" minLength={8} autoComplete="new-password" required /></label>
              <Button type="submit" size="sm" loading={busy === "password"}>{user!.hasPassword ? "Change password" : "Set a password"}</Button>
            </form>
            {providers.data?.discord && (
              <p style={{ marginTop: "var(--s-4)" }}>
                {user!.discordLinked ? <span className="chip chip--good">Discord linked</span> : <a className="btn btn--sm btn--discord" href="/api/auth/discord/start">Link Discord</a>}
              </p>
            )}
          </Panel>
        )}

        <Panel title="Delete account">
          <form className="stack" onSubmit={(e) => void del(e)}>
            <p className="muted">Permanently deletes your hero, items, pets and messages. This can't be undone.</p>
            {user!.hasPassword && <label className="field"><span>Password</span><input className="input" name="password" type="password" required autoComplete="current-password" /></label>}
            <label className="field"><span>Type DELETE to confirm</span><input className="input" name="confirm" required pattern="DELETE" /></label>
            <Button type="submit" variant="danger" size="sm" loading={busy === "delete"}>Delete forever</Button>
          </form>
        </Panel>
      </div>
    </>
  );
}
