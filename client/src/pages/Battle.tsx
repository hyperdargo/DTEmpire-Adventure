import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Flag, Shield, Swords, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { CONSUMABLE_BY_ID } from "../../../shared/data/items.ts";
import { SKILL_BY_ID } from "../../../shared/data/skills.ts";
import type { BattleAction, BattleEvent, BattleState, Combatant, ItemView } from "../../../shared/data/types.ts";
import { CardBack, Flip, GameCard, ItemCard } from "../components/GameCard.tsx";
import { Bar, Button, Coins, Empty, Loading, Sheet } from "../components/ui.tsx";
import { api, type ApiError, type Mutation, type MeSnapshot, type Notice } from "../lib/api.ts";
import { fmt } from "../lib/format.ts";
import { play } from "../lib/sound.ts";
import { meKey, useHero } from "../state/game.ts";
import { useNotify } from "../state/notify.tsx";
import { rememberedRegion } from "./Table.tsx";

type ClientBattle = { id: string; kind: string; context: Record<string, unknown>; state: Omit<BattleState, "seed"> };
interface ActResponse {
  battle: ClientBattle;
  rounds: BattleEvent[][];
  outcome: { result: string; coins?: number; xp?: number; drops?: { view: ItemView | null; templateId: string; qty: number; autoSold?: number; autoSalvaged?: Record<string, number> }[]; extra?: Record<string, unknown> } | null;
  notices: Notice[];
  me: MeSnapshot;
}

interface Floater { id: number; side: "player" | "enemy"; text: string; kind: "dmg" | "crit" | "heal" | "miss" | "block" }

const EFFECT_LABEL: Record<string, string> = { atk_up: "Attack up", def_up: "Defense up", dodge_up: "Evasive", def_down: "Exposed", burn: "Burning", stun: "Stunned", shield: "Shielded", guard: "Guarding" };
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function describe(e: BattleEvent, s: Pick<BattleState, "player" | "enemy"> & { pet?: { name: string } }): string | null {
  const name = (a: string) => (a === "pet" ? s.pet?.name ?? "Your pet" : a === "player" ? "You" : s.enemy.name);
  switch (e.t) {
    case "action": return e.by === "enemy" ? `${s.enemy.name} uses ${e.label}.` : e.by === "pet" ? `${e.label}.` : e.label === "Attack" ? null : `You use ${e.label}.`;
    case "hit": return `${name(e.by)} ${e.by === "player" ? "hit" : "hits"} ${e.target === "player" ? "you" : s.enemy.name} for ${fmt(e.dmg)}${e.crit ? " — critical!" : ""}${e.absorbed ? ` (${fmt(e.absorbed)} absorbed)` : ""}.`;
    case "miss": return `${name(e.by)} ${e.by === "player" ? "miss" : "misses"}.`;
    case "heal": return `${e.target === "player" ? "You recover" : `${s.enemy.name} recovers`} ${fmt(e.amount)} HP.`;
    case "effect": return `${e.target === "player" ? "You are" : `${s.enemy.name} is`} ${EFFECT_LABEL[e.kind]?.toLowerCase() ?? e.kind}.`;
    case "dot": return `${e.target === "player" ? "You burn" : `${s.enemy.name} burns`} for ${fmt(e.dmg)}.`;
    case "stunned": return `${e.target === "player" ? "You are" : `${s.enemy.name} is`} stunned and can't act.`;
    case "telegraph": return e.text;
    case "flee": return e.ok ? "You slip away." : "You fail to escape!";
    default: return null;
  }
}

export default function BattlePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const notify = useNotify();
  const me = useHero();
  const autoResolveAdventure = Boolean(me.hero.settings?.autoResolveAdventure);
  const { data, isPending } = useQuery({ queryKey: ["battle"], queryFn: () => api.get<{ battle: ClientBattle | null }>("/api/battle"), staleTime: Infinity });
  const battle = data?.battle ?? null;

  const [shown, setShown] = useState<{ player: number; enemy: number } | null>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [anim, setAnim] = useState<{ player?: string; enemy?: string; table?: string }>({});
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ActResponse["outcome"]>(null);
  const [potionsOpen, setPotionsOpen] = useState(false);
  const floatId = useRef(0);

  const inventory = useQuery({ queryKey: ["inventory"], queryFn: () => api.get<{ items: ItemView[] }>("/api/inventory"), enabled: !!battle });
  const potions = (inventory.data?.items ?? []).filter((i) => i.kind === "potion" && CONSUMABLE_BY_ID[i.templateId]?.healPct && i.levelReq <= me.hero.level);

  const float = (side: Floater["side"], text: string, kind: Floater["kind"]) => {
    const id = ++floatId.current;
    setFloaters((f) => [...f, { id, side, text, kind }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 1100);
  };

  const playRounds = useCallback(async (rounds: BattleEvent[][], start: { player: number; enemy: number }, state: ClientBattle["state"]) => {
    const fast = reduced();
    const hp = { ...start };
    for (const events of rounds) {
      for (const e of events) {
        const line = describe(e, state);
        if (line) setLog((l) => [...l.slice(-40), line]);
        switch (e.t) {
          case "hit": {
            const target = e.target === "player" ? "player" : "enemy";
            if (e.by !== "pet") setAnim({ [e.by]: e.by === "player" ? "lunge-up" : "lunge-down" });
            await delay(fast ? 0 : 140);
            hp[target] = Math.max(0, hp[target] - e.dmg);
            setShown({ ...hp });
            setAnim({ [target]: e.crit ? "recoil-crit" : "recoil", table: e.crit ? "shake" : undefined });
            float(target, e.dmg ? `-${fmt(e.dmg)}` : "Blocked", e.crit ? "crit" : e.dmg ? "dmg" : "block");
            if (e.absorbed) float(target, `${fmt(e.absorbed)} absorbed`, "block");
            play(e.crit ? "crit" : target === "player" ? "hurt" : "hit");
            await delay(fast ? 60 : 380);
            setAnim({});
            break;
          }
          case "miss":
            float(e.target === "player" ? "player" : "enemy", "Miss", "miss");
            play("block");
            await delay(fast ? 60 : 320);
            break;
          case "heal":
            if (e.target !== "pet") {
              const t = e.target === "player" ? "player" : "enemy";
              hp[t] = hp[t] + e.amount;
              setShown({ ...hp });
              float(t, `+${fmt(e.amount)}`, "heal");
              play("heal");
              await delay(fast ? 60 : 320);
            }
            break;
          case "dot": {
            const t = e.target === "player" ? "player" : "enemy";
            hp[t] = Math.max(0, hp[t] - e.dmg);
            setShown({ ...hp });
            float(t, `-${fmt(e.dmg)} 🔥`, "dmg");
            await delay(fast ? 60 : 300);
            break;
          }
          case "telegraph":
            setAnim({ table: "telegraph" });
            play("block");
            await delay(fast ? 80 : 650);
            setAnim({});
            break;
          case "stunned":
            float(e.target === "player" ? "player" : "enemy", "Stunned", "miss");
            await delay(fast ? 60 : 300);
            break;
          case "action":
            if (e.by === "pet") await delay(fast ? 0 : 150);
            break;
        }
      }
    }
    setShown({ player: state.player.hp, enemy: state.enemy.hp });
  }, []);

  const send = async (path: string, body: unknown) => {
    if (!battle || busy) return;
    setBusy(true);
    const start = shown ?? { player: battle.state.player.hp, enemy: battle.state.enemy.hp };
    try {
      const r = await api.post<ActResponse>(path, body);
      await playRounds(r.rounds, start, r.battle.state);
      qc.setQueryData(["battle"], { battle: r.battle });
      qc.setQueryData(meKey, r.me);
      if (r.notices.length) notify.notices(r.notices);
      if (r.outcome) {
        setOutcome(r.outcome);
        play(r.outcome.result === "won" ? "win" : r.outcome.result === "fled" ? "click" : "lose");
        void qc.invalidateQueries({ queryKey: ["inventory"] });
        void qc.invalidateQueries({ queryKey: ["adventure"] });
        void qc.invalidateQueries({ queryKey: ["tower"] });
        void qc.invalidateQueries({ queryKey: ["dungeon"] });
        void qc.invalidateQueries({ queryKey: ["raid"] });
        void qc.invalidateQueries({ queryKey: ["daily"] });
      }
    } catch (err) {
      const e = err as ApiError;
      notify.toast({ tone: e.status === 429 ? "warn" : "bad", title: e.message });
      if (e.status === 404) void qc.invalidateQueries({ queryKey: ["battle"] });
    } finally {
      setBusy(false);
    }
  };

  const act = (action: BattleAction) => void send(`/api/battle/${battle!.id}/act`, { action });

  useEffect(() => {
    if (!battle || outcome) return;
    const onKey = (e: KeyboardEvent) => {
      if (busy || e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const skills = battle.state.player.skills;
      if (k === "1") act({ type: "attack" });
      else if (["2", "3", "4", "5"].includes(k)) {
        const s = skills[Number(k) - 2];
        if (s && s.cd === 0) act({ type: "skill", skillId: s.id });
      } else if (k === "g") act({ type: "guard" });
      else if (k === "p" && potions.length) setPotionsOpen(true);
      else if (k === "f" && battle.state.canFlee) act({ type: "flee" });
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const toggleAutoResolve = async () => {
    const next = !autoResolveAdventure;
    try {
      const res = await api.post<Mutation<{ autoResolveAdventure: boolean; autoResolvePotions: boolean }>>("/api/adventure/auto-resolve", {
        enabled: next,
        usePotions: true,
      });
      if (res?.me) qc.setQueryData(meKey, res.me);
      notify.toast({
        tone: "good",
        title: `Auto-resolve ${next ? "enabled" : "disabled"} for adventure`,
      });
      if (next && battle?.state?.status === "active" && !busy && !outcome) {
        void send(`/api/battle/${battle.id}/auto`, { usePotions: true });
      }
    } catch (err) {
      notify.toast({ tone: "bad", title: (err as Error).message });
    }
  };

  const again = async () => {
    const kind = battle?.kind;
    const ctx = battle?.context ?? {};
    setOutcome(null);
    setLog([]);
    setShown(null);
    try {
      let path = "";
      let body: unknown = {};
      if (kind === "adventure") { path = "/api/adventure/start"; body = { regionId: ctx.regionId ?? rememberedRegion() }; }
      else if (kind === "tower") path = "/api/tower/start";
      else if (kind === "dungeon") { navigate("/dungeon"); return; }
      else if (kind === "guild_war") { navigate("/guild"); return; }
      else if (kind === "duel_ai") { path = "/api/duels/ai"; body = { duelistId: ctx.duelistId }; }
      else if (kind === "arena") path = "/api/arena/ranked";
      else if (kind === "worldboss") path = "/api/worldboss/strike";
      else if (kind === "event") path = "/api/event/fight";
      else if (kind === "guild_war") {
        path = "/api/guild/war/attack";
        body = { targetUserId: (ctx as { defenderId?: number }).defenderId };
      }
      const r = await api.post<Mutation<ClientBattle>>(path, body);
      qc.setQueryData(meKey, r.me);
      qc.setQueryData(["battle"], { battle: r.result });
    } catch (err) {
      notify.toast({ tone: "bad", title: (err as Error).message });
      qc.setQueryData(["battle"], { battle: null });
    }
  };

  // Auto-resolve active battle when enabled for adventure
  useEffect(() => {
    if (!battle || battle.kind !== "adventure" || !autoResolveAdventure) return;
    if (battle.state.status !== "active" || busy || outcome) return;
    const timer = setTimeout(() => {
      void send(`/api/battle/${battle.id}/auto`, { usePotions: true });
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle?.id, battle?.state?.status, autoResolveAdventure, busy, outcome]);

  // When battle won and autoResolve is ON, automatically queue next encounter
  useEffect(() => {
    if (!outcome || battle?.kind !== "adventure" || !autoResolveAdventure) return;
    if (outcome.result !== "won") return;
    const timer = setTimeout(() => {
      void again();
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome, battle?.kind, autoResolveAdventure]);

  if (isPending) return <Loading rows={3} />;
  if (!battle || (battle.state.status !== "active" && !outcome)) {
    return (
      <Empty art="⚔️" title="No battle in progress" action={<Link className="btn btn--primary" to="/">Back to the table</Link>}>
        Draw an encounter from the table, climb the Tower or enter the Dungeon.
      </Empty>
    );
  }

  const s = battle.state;
  const hp = shown ?? { player: s.player.hp, enemy: s.enemy.hp };
  const ctx = battle.context as { floor?: number; bossLine?: string | null; regionId?: string; elite?: boolean; boss?: boolean };
  const active = s.status === "active" && !outcome;

  return (
    <div className={`battle${anim.table ? ` battle--${anim.table}` : ""}`}>
      <h1 className="sr-only">Battle against {s.enemy.name}</h1>
      <div className="battle__meta">
        <span className="chip">{battleTitle(battle)}</span>
        <span className="chip">Turn {Math.min(s.turn, s.maxTurns)} / {s.maxTurns}</span>
        {s.enemy.charging && <span className="chip chip--warn">Heavy blow incoming: guard!</span>}
      </div>

      <section className="battle__side battle__side--enemy" aria-label="Enemy">
        <Fighter c={s.enemy} hp={hp.enemy} anim={anim.enemy} floaters={floaters.filter((f) => f.side === "enemy")} rarity={s.enemy.isBoss ? "mythic" : ctx.elite ? "epic" : "common"} typeLine={`${s.enemy.isBoss ? "Boss" : ctx.elite ? "Elite" : "Monster"} · Level ${s.enemy.level}`} />
      </section>

      {ctx.bossLine && s.turn === 1 && <p className="battle__line">“{ctx.bossLine}”</p>}

      <section className="battle__side battle__side--player" aria-label="You">
        <Fighter c={s.player} hp={hp.player} anim={anim.player} floaters={floaters.filter((f) => f.side === "player")} rarity={me.hero.class.rarity} art={me.hero.class.icon} typeLine={`${me.hero.class.name} · Level ${s.player.level}`} pet={s.pet} />
      </section>

      {active && (
        <section className="battle__hand" aria-label="Your actions">
          <ActionCard art="⚔️" name="Attack" hint="1" text="A reliable strike." onClick={() => act({ type: "attack" })} disabled={busy} rarity="common" icon={<Swords size={16} />} />
          {s.player.skills.map((sk, i) => {
            const def = SKILL_BY_ID[sk.id];
            if (!def) return null;
            return (
              <ActionCard key={sk.id} art={def.icon} name={def.name} hint={String(i + 2)} text={def.desc} rank={sk.rank}
                cooldown={sk.cd} onClick={() => act({ type: "skill", skillId: sk.id })} disabled={busy || sk.cd > 0} rarity={sk.rank >= 4 ? "epic" : sk.rank >= 2 ? "rare" : "uncommon"} icon={<Zap size={16} />} />
            );
          })}
          <ActionCard art="🛡️" name="Guard" hint="G" text="Take 55% less damage this turn." onClick={() => act({ type: "guard" })} disabled={busy} rarity={s.enemy.charging ? "legendary" : "common"} icon={<Shield size={16} />} />
          <ActionCard art="🧪" name="Potion" hint="P" text={potions.length ? `${potions.reduce((n, p) => n + p.qty, 0)} in your bag` : "No usable potions"} onClick={() => setPotionsOpen(true)} disabled={busy || !potions.length} rarity="uncommon" icon={<FlaskConical size={16} />} />
          <div className="battle__side-actions">
            {s.canFlee && <Button onClick={() => act({ type: "flee" })} disabled={busy} icon={<Flag size={16} />}>Flee <kbd>F</kbd></Button>}
            {battle.kind === "adventure" ? (
              <Button
                variant={autoResolveAdventure ? "primary" : "ghost"}
                disabled={busy}
                onClick={toggleAutoResolve}
                icon={<Zap size={16} />}
              >
                {autoResolveAdventure ? "⚡ Auto-resolve: ON" : "⚡ Auto-resolve: OFF"}
              </Button>
            ) : (
              <Button variant="ghost" disabled={busy} onClick={() => void send(`/api/battle/${battle.id}/auto`, { usePotions: true })}>
                Auto-resolve
              </Button>
            )}
          </div>
        </section>
      )}

      <section className="battle__log panel panel--tight" aria-label="Battle log">
        <h2 className="sr-only">Battle log</h2>
        <ol aria-live="polite">
          {log.length === 0 && <li className="faint">Choose your first move. Keys: 1 attack, 2–5 skills, G guard, P potion{s.canFlee ? ", F flee" : ""}.</li>}
          {log.slice(-8).map((l, i) => <li key={`${log.length}-${i}`}>{l}</li>)}
        </ol>
      </section>

      <Sheet open={potionsOpen} onClose={() => setPotionsOpen(false)} title="Drink a potion">
        <div className="grid-cards" style={{ "--card-min": "130px" } as React.CSSProperties}>
          {potions.map((p) => (
            <ItemCard key={p.id} item={p} size="sm" onClick={() => { setPotionsOpen(false); act({ type: "item", itemId: p.id }); }} />
          ))}
        </div>
      </Sheet>

      {outcome && (
        <Outcome
          battle={battle}
          outcome={outcome}
          onAgain={() => void again()}
          onLeave={() => {
            qc.setQueryData(["battle"], { battle: null });
            navigate(
              battle.kind === "dungeon" ? "/dungeon"
              : battle.kind === "tower" ? "/tower"
              : battle.kind === "worldboss" ? "/raid"
              : battle.kind === "event" ? "/festival"
              : battle.kind === "guild_war" ? "/guild"
              : battle.kind === "adventure" ? "/"
              : "/arena"
            );
          }}
          autoResolveAdventure={autoResolveAdventure}
          onToggleAuto={toggleAutoResolve}
        />
      )}
    </div>
  );
}

function battleTitle(b: ClientBattle) {
  const c = b.context as { floor?: number };
  switch (b.kind) {
    case "tower": return `Tower · Floor ${c.floor}`;
    case "dungeon": return `Dungeon · Floor ${c.floor}`;
    case "duel_ai": return "Exhibition duel";
    case "arena": return "Ranked arena";
    case "worldboss": return "World boss";
    case "event": return "Festival hunt";
    case "guild_war": return "Guild War Clash";
    default: return "Adventure";
  }
}

function Fighter({ c, hp, anim, floaters, rarity, art, typeLine, pet }: { c: Omit<Combatant, "skills"> & { skills?: unknown }; hp: number; anim?: string; floaters: Floater[]; rarity: string; art?: string; typeLine: string; pet?: { name: string; icon: string; ability: string } }) {
  const shielded = c.effects.find((e) => e.kind === "shield")?.value ?? 0;
  const worldBoss = c.maxHp > 10_000_000;
  return (
    <div className="fighter">
      <div className={`fighter__card${anim ? ` anim-${anim}` : ""}`}>
        <GameCard size="lg" rarity={rarity} art={art ?? c.icon} name={c.name} type={typeLine} atk={c.atk} hp={worldBoss ? undefined : c.maxHp} label={`${c.name}, ${fmt(hp)} of ${fmt(c.maxHp)} health`} />
        <div className="floaters" aria-hidden>
          {floaters.map((f) => <span key={f.id} className={`floater floater--${f.kind}`}>{f.text}</span>)}
        </div>
      </div>
      <div className="fighter__status">
        <div className="fighter__name"><b>{c.name}</b>{c.isBoss && <span className="chip chip--warn">Boss</span>}</div>
        {worldBoss ? <p className="muted">Deal as much damage as you can in {10} turns.</p> : <Bar value={hp} max={c.maxHp} kind="hp" size="lg" showNumbers label="Health" />}
        {shielded > 0 && <Bar value={shielded} max={c.maxHp * 0.5} kind="ward" label="Shield" />}
        <div className="row row--wrap">
          {c.effects.filter((e) => e.kind !== "shield").map((e, i) => <span key={i} className={`chip${["def_down", "burn", "stun"].includes(e.kind) ? " chip--warn" : " chip--good"}`}>{EFFECT_LABEL[e.kind]} · {e.turns}</span>)}
          {pet && <span className="chip chip--gold"><span className="art">{pet.icon}</span>{pet.name} · {pet.ability}s every 3rd turn</span>}
        </div>
      </div>
    </div>
  );
}

function ActionCard({ art, name, text, hint, cooldown, rank, onClick, disabled, rarity, icon }: { art: string; name: string; text: string; hint: string; cooldown?: number; rank?: number; onClick: () => void; disabled?: boolean; rarity: string; icon: React.ReactNode }) {
  return (
    <button type="button" className={`action-card r-${rarity}`} onClick={onClick} disabled={disabled} aria-label={`${name}${cooldown ? `, ready in ${cooldown} turns` : ""}. Shortcut ${hint}.`}>
      <span className="art action-card__art" aria-hidden>{art}</span>
      <span className="action-card__name">{icon}{name}{rank && rank > 1 ? <em> · R{rank}</em> : null}</span>
      <span className="action-card__text">{text}</span>
      <kbd className="action-card__key">{hint}</kbd>
      {!!cooldown && <span className="action-card__cd" aria-hidden>{cooldown}</span>}
    </button>
  );
}

function Outcome({
  battle,
  outcome,
  onAgain,
  onLeave,
  autoResolveAdventure,
  onToggleAuto,
}: {
  battle: ClientBattle;
  outcome: NonNullable<ActResponse["outcome"]>;
  onAgain: () => void;
  onLeave: () => void;
  autoResolveAdventure?: boolean;
  onToggleAuto?: () => void;
}) {
  const won = outcome.result === "won";
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 450);
    return () => clearTimeout(t);
  }, []);
  const x = outcome.extra ?? {};
  const chapter = x.chapter as { chapter: number; title: string } | undefined;
  const kindAgain = { adventure: "Draw again", tower: "Next floor", dungeon: "Back to the run", duel_ai: "Rematch", arena: "Next match", worldboss: "Strike again", event: "Hunt again" }[battle.kind] ?? "Again";
  const title = won
    ? battle.kind === "worldboss" ? "Strike landed" : "Victory"
    : outcome.result === "fled" ? "You escaped" : outcome.result === "timeout" ? (battle.kind === "worldboss" ? "Time's up" : "The fight drags on") : "Defeated";
  const cards = (outcome.drops ?? []).filter((d) => d.view);
  const stacks = (outcome.drops ?? []).filter((d) => !d.view);

  return (
    <div className="outcome" role="dialog" aria-modal="true" aria-labelledby="outcome-title">
      <div className={`outcome__panel${won ? " outcome__panel--won" : ""}`}>
        <h2 id="outcome-title">{title}</h2>
        {battle.kind === "worldboss" && typeof x.score === "number" && <p>You added <b className="gold">{fmt(x.score as number)}</b> to the realm's damage.</p>}
        {battle.kind === "event" && typeof x.tokens === "number" && <p className="gold">+{fmt(x.tokens as number)} {String(x.currency)} · {fmt(x.balance as number)} held</p>}
        {battle.kind === "arena" && typeof x.delta === "number" && <p>Rating {(x.delta as number) >= 0 ? "+" : ""}{x.delta as number} · now {fmt(x.rating as number)}</p>}
        {x.runOver === true && <p>The Dungeon claims you on floor {String(x.reached)}. You kept half your pouch: <Coins value={(x.kept as { coins: number }).coins} compact /> and {fmt((x.kept as { xp: number }).xp)} XP.</p>}
        {chapter && <p className="gold">Chapter {chapter.chapter} complete: {chapter.title}. Rewards are in your mail.</p>}
        {!won && outcome.result === "lost" && battle.kind !== "dungeon" && <p className="muted">You limp back to the table with a sliver of health. Upgrade your gear at the Blacksmith, learn skills, or guard when a boss winds up.</p>}
        {(outcome.coins || outcome.xp) ? (
          <div className="row outcome__gains">
            {!!outcome.coins && <Coins value={outcome.coins} compact />}
            {!!outcome.xp && <span className="chip chip--gold">+{fmt(outcome.xp)} XP</span>}
          </div>
        ) : null}
        {(cards.length > 0 || stacks.length > 0) && (
          <div className="outcome__loot">
            {cards.map((d, i) => (
              <Flip key={i} revealed={revealed} back={<CardBack size="md" />}>
                <ItemCard item={d.view!} size="md" />
              </Flip>
            ))}
            {stacks.map((d, i) => {
              const c = CONSUMABLE_BY_ID[d.templateId];
              return (
                <span key={`s${i}`} className="chip">
                  <span className="art">{c?.icon ?? "📦"}</span>{d.autoSold ? `Bag full: sold for ${fmt(d.autoSold)}` : d.autoSalvaged ? "Auto-salvaged" : `${c?.name ?? d.templateId} ×${d.qty}`}
                </span>
              );
            })}
          </div>
        )}
        <div className="row row--wrap outcome__actions">
          <Button variant="primary" size="lg" onClick={onAgain}>{kindAgain}</Button>
          <Button size="lg" onClick={onLeave}>{battle.kind === "adventure" ? "Back to the table" : "Leave"}</Button>
          {battle.kind === "adventure" && onToggleAuto && (
            <Button
              variant={autoResolveAdventure ? "primary" : "ghost"}
              size="lg"
              onClick={onToggleAuto}
              icon={<Zap size={18} />}
            >
              {autoResolveAdventure ? "⚡ Auto-resolve: ON (drawing next...)" : "⚡ Auto-resolve: OFF"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
