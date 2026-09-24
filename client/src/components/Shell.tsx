import { useQueryClient } from "@tanstack/react-query";
import { Backpack, LayoutGrid, Lock, Mail, Menu, MessageCircle, Swords, Volume2, VolumeX, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { CLASS_BY_ID } from "../../../shared/data/classes.ts";
import type { Badges, HeroSnap } from "../lib/api.ts";
import { realtime, type ConnectionState, type ServerEvent } from "../lib/realtime.ts";
import { play, setSoundEnabled, soundEnabled } from "../lib/sound.ts";
import { useAction, meKey } from "../state/game.ts";
import { useNotify } from "../state/notify.tsx";
import { isNativeApp } from "../lib/platform.ts";
import { NAV } from "./nav.ts";
import { Bar, Button, Coins, Countdown, Sheet } from "./ui.tsx";

function badgeCount(key: string | undefined, b: Badges | undefined): number {
  if (!key || !b) return 0;
  switch (key) {
    case "mail": return b.mail;
    case "quests": return (b.daily ? 1 : 0) + b.contracts + b.missions;
    case "town": return (b.expedition === "ready" ? 1 : 0) + (b.job === "ready" ? 1 : 0);
    case "worldBoss": return b.worldBossAttempts > 0 ? b.worldBossAttempts : 0;
    case "friends": return b.friendRequests;
    case "trades": return b.trades;
    case "event": return b.event ? 1 : 0;
    default: return 0;
  }
}

export function Portrait({ classId, avatar, level, rarity }: { classId: string; avatar?: string | null; level?: number; rarity?: string }) {
  const cls = CLASS_BY_ID[classId];
  return (
    <span className={`portrait r-${rarity ?? cls?.rarity ?? "common"}`}>
      {avatar ? <img src={avatar} alt="" /> : <span className="art" aria-hidden>{cls?.icon ?? "⚔️"}</span>}
      {level != null && <span className="portrait__lvl num">{level}</span>}
    </span>
  );
}

function useRealtime(me: HeroSnap) {
  const qc = useQueryClient();
  const notify = useNotify();
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<ConnectionState>(realtime.state);
  const [challenge, setChallenge] = useState<{ challengeId: string; from: string; level: number; expiresAt: number } | null>(null);

  useEffect(() => {
    realtime.start();
    const offState = realtime.onState(setState);
    return () => {
      offState();
      realtime.stop();
    };
  }, []);

  useEffect(() => {
    return realtime.on((e: ServerEvent) => {
      switch (e.type) {
        case "chat": {
          void qc.invalidateQueries({ queryKey: ["chat", e.channel] });
          const channel = String(e.channel);
          const msg = e.message as { userId: number; name: string; body: string };
          if (channel.startsWith("dm:") && msg.userId !== me.user?.id && !location.pathname.startsWith("/chat")) {
            notify.toast({ tone: "info", title: `${msg.name} messaged you`, body: msg.body.slice(0, 80) });
          }
          break;
        }
        case "mail":
          void qc.invalidateQueries({ queryKey: meKey });
          void qc.invalidateQueries({ queryKey: ["mail"] });
          break;
        case "trade_offer":
          notify.toast({ tone: "info", title: `${e.from} sent you a trade offer`, art: "🤝" });
          void qc.invalidateQueries({ queryKey: meKey });
          void qc.invalidateQueries({ queryKey: ["trades"] });
          break;
        case "trade_update":
          void qc.invalidateQueries({ queryKey: ["trades"] });
          void qc.invalidateQueries({ queryKey: meKey });
          break;
        case "friend_request":
          notify.toast({ tone: "info", title: `${e.from} wants to be friends`, art: "🤝" });
          void qc.invalidateQueries({ queryKey: meKey });
          void qc.invalidateQueries({ queryKey: ["friends"] });
          break;
        case "friend_accepted":
          notify.toast({ tone: "good", title: `${e.by} accepted your friend request` });
          void qc.invalidateQueries({ queryKey: ["friends"] });
          break;
        case "guild_event":
        case "guild_request":
          notify.toast({ tone: "info", title: String(e.text ?? `${e.from} asked to join your guild`), art: "🛡️" });
          void qc.invalidateQueries({ queryKey: ["guild"] });
          break;
        case "arena_defended":
          notify.toast({ tone: e.won ? "good" : "warn", title: e.won ? `You defended against ${e.by}` : `${e.by} beat your arena champion`, body: `Rating ${Number(e.delta) >= 0 ? "+" : ""}${e.delta}` });
          break;
        case "worldboss":
          qc.setQueryData(["raid"], (old: Record<string, unknown> | undefined) => (old ? { ...old, hp: e.hp, maxHp: e.maxHp } : old));
          break;
        case "feed":
          qc.setQueryData(["feed"], (old: ServerEvent[] | undefined) => [e, ...(old ?? [])].slice(0, 20));
          break;
        case "duel_challenge":
          setChallenge({ challengeId: String(e.challengeId), from: String(e.from), level: Number(e.level), expiresAt: Number(e.expiresAt) });
          play("flip");
          break;
        case "duel_start":
          qc.setQueryData(["liveDuel"], e);
          navigate("/arena/live");
          break;
        case "duel_round":
        case "duel_end":
        case "duel_opponent_ready":
          qc.setQueryData(["liveDuel"], (old: ServerEvent | undefined) => (e.type === "duel_opponent_ready" ? { ...(old ?? {}), opponentReady: true } : e));
          if (e.type === "duel_end") void qc.invalidateQueries({ queryKey: meKey });
          break;
        case "duel_declined":
          notify.toast({ tone: "warn", title: `${e.by} declined your duel` });
          break;
        case "hello":
          if (e.duel) qc.setQueryData(["liveDuel"], { type: "duel_round", ...(e.duel as object) });
          break;
      }
    });
  }, [qc, notify, navigate, location.pathname, me.user?.id]);

  return { state, challenge, clearChallenge: () => setChallenge(null) };
}

function DuelInvite({ challenge, onDone }: { challenge: { challengeId: string; from: string; level: number; expiresAt: number }; onDone: () => void }) {
  const respond = useAction<{ challengeId: string; accept: boolean }>("/api/duels/live/respond", { onSuccess: onDone, onError: () => void onDone() });
  useEffect(() => {
    const t = setTimeout(onDone, Math.max(0, challenge.expiresAt - Date.now()));
    return () => clearTimeout(t);
  }, [challenge, onDone]);
  return (
    <Sheet open onClose={onDone} title="You've been challenged">
      <div className="stack">
        <p><b>{challenge.from}</b> (level {challenge.level}) challenges you to a live duel. Both of you fight at full health; nothing is lost.</p>
        <p className="faint">Expires in <Countdown to={challenge.expiresAt} done="now" /></p>
        <div className="row">
          <Button variant="primary" loading={respond.isPending} onClick={() => respond.mutate({ challengeId: challenge.challengeId, accept: true })}>Accept duel</Button>
          <Button onClick={() => respond.mutate({ challengeId: challenge.challengeId, accept: false })}>Decline</Button>
        </div>
      </div>
    </Sheet>
  );
}

export function Shell({ me, children }: { me: HeroSnap; children: ReactNode }) {
  const hero = me.hero!;
  const { state, challenge, clearChallenge } = useRealtime(me);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sound, setSound] = useState(soundEnabled());
  const [online, setOnline] = useState(navigator.onLine);
  const location = useLocation();

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const isNative = isNativeApp();
  const navGroups = useMemo(() => {
    if (!isNative) return NAV;
    return NAV.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.to !== "/apps"),
    }));
  }, [isNative]);

  const quests = badgeCount("quests", me.badges);
  const mail = badgeCount("mail", me.badges);
  const toggleSound = () => {
    setSoundEnabled(!sound);
    setSound(!sound);
  };

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <nav className="rail" aria-label="Main">
        <Link to="/" className="rail__brand">
          <img src="/logo.png" alt="" width={46} height={46} />
          <div>
            <b>DTEmpire</b>
            <span>Adventure</span>
          </div>
        </Link>
        {navGroups.map((group) => (
          <div className="rail__group" key={group.label}>
            <div className="rail__label">{group.label}</div>
            {group.items.map((item) => {
              const locked = item.minLevel != null && hero.level < item.minLevel;
              const count = badgeCount(item.badge, me.badges);
              return (
                <NavLink key={item.to} to={item.to} end={item.to === "/"} className={`rail__link${locked ? " rail__link--locked" : ""}`}>
                  <item.icon size={18} aria-hidden />
                  {item.label}
                  {locked ? <span className="rail__lock"><Lock size={12} aria-hidden /> Lv {item.minLevel}</span> : count > 0 && <span className="badge" aria-label={`${count} new`}>{count}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <header className="topbar">
        <Link to="/hero" className="topbar__hero" aria-label="Your hero">
          <Portrait classId={hero.class.id} avatar={hero.avatar} level={hero.level} rarity={hero.class.rarity} />
          <div className="topbar__who">
            <b>{hero.name}</b>
            <span>{hero.title}</span>
          </div>
        </Link>
        <div className="topbar__bars">
          <div className="topbar__hp">
            <span className="num">{hero.hp.toLocaleString()} / {hero.maxHp.toLocaleString()} HP</span>
            {hero.hp < hero.maxHp && !hero.inDungeon && <span>full in <Countdown to={hero.hpFullAt} done="now" /></span>}
          </div>
          <Bar value={hero.hp} max={hero.maxHp} kind="hp" />
          <Bar value={hero.xp} max={hero.xpToNext || 1} kind="xp" />
        </div>
        <div className="topbar__spacer" />
        <div className="topbar__meta">
          <span className={`online${state === "open" ? "" : " online--off"}`} title={state === "open" ? "Connected" : "Reconnecting"}>
            {state === "open" ? `${me.onlineCount} online` : "Reconnecting"}
          </span>
          <Coins value={hero.coins} />
          <button type="button" className="icon-link" onClick={toggleSound} aria-label={sound ? "Mute sound" : "Turn sound on"} aria-pressed={sound}>
            {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <Link to="/mail" className="icon-link" aria-label={`Mail${mail ? `, ${mail} unread` : ""}`}>
            <Mail size={20} />
            {mail > 0 && <span className="badge">{mail}</span>}
          </Link>
        </div>
      </header>

      <main id="main" className="main" tabIndex={-1}>
        {!online && (
          <div className="banner" role="status"><WifiOff size={18} aria-hidden /> You're offline. You can browse your last-known hero, but actions need a connection.</div>
        )}
        {me.activeBattle && !location.pathname.startsWith("/battle") && (
          <div className="banner banner--info" role="status">
            <Swords size={18} aria-hidden /> A battle is waiting for you.
            <Link className="btn btn--sm btn--primary" to="/battle">Return to battle</Link>
          </div>
        )}
        {children}
      </main>

      <nav className="tabbar" aria-label="Quick">
        <NavLink to="/" end><LayoutGrid size={22} aria-hidden />Table{quests > 0 && <span className="badge badge--dot" />}</NavLink>
        <NavLink to="/adventure"><Swords size={22} aria-hidden />Adventure</NavLink>
        <NavLink to="/bag"><Backpack size={22} aria-hidden />Bag</NavLink>
        <NavLink to="/chat"><MessageCircle size={22} aria-hidden />Chat</NavLink>
        <button type="button" onClick={() => setMenuOpen(true)} aria-haspopup="dialog">
          <Menu size={22} aria-hidden />More
          {(mail > 0 || me.badges.friendRequests > 0 || me.badges.trades > 0) && <span className="badge badge--dot" />}
        </button>
      </nav>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Everywhere">
        <div className="menu-grid">
          {navGroups.map((group) => (
            <div key={group.label}>
              <h4>{group.label}</h4>
              <div className="menu-grid__group">
                {group.items.map((item) => {
                  const count = badgeCount(item.badge, me.badges);
                  const locked = item.minLevel != null && hero.level < item.minLevel;
                  return (
                    <Link key={item.to} to={item.to} className="menu-tile" style={locked ? { opacity: 0.5 } : undefined} onClick={() => setMenuOpen(false)}>
                      <item.icon size={22} aria-hidden />
                      {item.label}
                      {count > 0 && <span className="badge">{count}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <Button onClick={toggleSound} icon={sound ? <Volume2 size={18} /> : <VolumeX size={18} />}>{sound ? "Sound on" : "Sound off"}</Button>
        </div>
      </Sheet>

      {challenge && <DuelInvite challenge={challenge} onDone={clearChallenge} />}
    </div>
  );
}
