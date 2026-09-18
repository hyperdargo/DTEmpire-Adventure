import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, LogOut } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Portrait } from "../components/Shell.tsx";
import { Button, PageHead, Panel } from "../components/ui.tsx";
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
  const settings = useAction<{ autoSalvageCommon?: boolean }>("/api/settings", { success: "Saved." });
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

        <Panel title="Preferences">
          <div className="stack">
            <label className="toggle"><input type="checkbox" checked={sound} onChange={(e) => { setSoundEnabled(e.target.checked); setSound(e.target.checked); }} /> Sound effects</label>
            <label className="toggle"><input type="checkbox" checked={!!hero.settings.autoSalvageCommon} onChange={(e) => settings.mutate({ autoSalvageCommon: e.target.checked })} /> Automatically salvage common gear drops into materials</label>
            <p className="faint">Animations follow your device's reduced-motion setting.</p>
          </div>
        </Panel>

        <Panel title="App">
          <p className="muted">Install DTEmpire on your phone or desktop for a full-screen app that opens instantly and works offline for browsing.</p>
          {installable ? (
            <Button variant="primary" icon={<Download size={16} />} onClick={async () => { await deferredInstall?.prompt(); deferredInstall = null; setInstallable(false); }}>Install the app</Button>
          ) : <p className="faint">Already installed, or use your browser's “Add to Home Screen” / “Install app” option.</p>}
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
