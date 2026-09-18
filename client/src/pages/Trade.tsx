import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { ItemView } from "../../../shared/data/types.ts";
import { ItemCard } from "../components/GameCard.tsx";
import { Button, Coins, Countdown, Empty, Loading, PageHead, Panel, Tabs } from "../components/ui.tsx";
import { fmt, timeAgo } from "../lib/format.ts";
import { useAction, useData, useHero } from "../state/game.ts";

interface Trade {
  id: number; direction: "incoming" | "outgoing"; fromName: string; toName: string; fromId: number; toId: number; offerCoins: number; requestCoins: number;
  offerItems: ItemView[]; requestItems: ItemView[]; message: string; status: string; createdAt: number; expiresAt: number;
}

export default function TradePage() {
  const [params] = useSearchParams();
  const toId = params.get("to") ? Number(params.get("to")) : null;
  const toName = params.get("name");
  const [tab, setTab] = useState<"open" | "new" | "history">(toId ? "new" : "open");
  const { data, isPending } = useData<{ trades: Trade[] }>(["trades"], "/api/trades");
  const trades = data?.trades ?? [];
  const open = trades.filter((t) => t.status === "pending");

  return (
    <>
      <PageHead title="Trades">Offer items and coins to another hero. What you offer is held safely until they accept, decline, or 24 hours pass.</PageHead>
      <Tabs label="Trades" value={tab} onChange={setTab} options={[
        { value: "open", label: "Open", badge: open.filter((t) => t.direction === "incoming").length },
        ...(toId ? [{ value: "new" as const, label: `New offer to ${toName ?? "player"}` }] : []),
        { value: "history", label: "History" },
      ]} />
      <div style={{ marginTop: "var(--s-5)" }}>
        {isPending ? <Loading rows={2} /> : tab === "open" ? (
          open.length === 0 ? <Empty art="🤝" title="No open trades">Start one from any hero's profile page.</Empty> : <div className="stack stack--lg">{open.map((t) => <TradeCard key={t.id} t={t} />)}</div>
        ) : tab === "new" && toId ? <NewTrade toId={toId} toName={toName ?? "them"} onDone={() => setTab("open")} /> : (
          <div className="stack">{trades.filter((t) => t.status !== "pending").map((t) => <TradeCard key={t.id} t={t} />)}</div>
        )}
      </div>
    </>
  );
}

function TradeCard({ t }: { t: Trade }) {
  const respond = useAction<{ id: number; action: string }>((b) => `/api/trades/${b.id}/${b.action}`, { invalidate: [["trades"], ["inventory"]], success: "Done." });
  const incoming = t.direction === "incoming";
  return (
    <Panel tight>
      <div className="row row--between row--wrap">
        <b>{incoming ? <>From <Link to={`/players/${encodeURIComponent(t.fromName)}`}>{t.fromName}</Link></> : <>To <Link to={`/players/${encodeURIComponent(t.toName)}`}>{t.toName}</Link></>}</b>
        <span className="faint">{t.status === "pending" ? <>expires in <Countdown to={t.expiresAt} done="moments" /></> : `${t.status} · ${timeAgo(t.createdAt)}`}</span>
      </div>
      {t.message && <p className="muted">“{t.message}”</p>}
      <div className="trade-sides">
        <div>
          <h4>{incoming ? "They give" : "You give"}</h4>
          <div className="row row--wrap">{t.offerItems.map((i) => <ItemCard key={i.id} item={i} size="sm" />)}{t.offerCoins > 0 && <Coins value={t.offerCoins} compact />}{!t.offerItems.length && !t.offerCoins && <span className="faint">Nothing</span>}</div>
        </div>
        <ArrowLeftRight aria-hidden className="trade-sides__arrow" />
        <div>
          <h4>{incoming ? "You give" : "They give"}</h4>
          <div className="row row--wrap">{t.requestItems.map((i) => <ItemCard key={i.id} item={i} size="sm" />)}{t.requestCoins > 0 && <Coins value={t.requestCoins} compact />}{!t.requestItems.length && !t.requestCoins && <span className="faint">Nothing</span>}</div>
        </div>
      </div>
      {t.status === "pending" && (
        <div className="row">
          {incoming ? (
            <>
              <Button variant="primary" onClick={() => respond.mutate({ id: t.id, action: "accept" })}>Accept</Button>
              <Button onClick={() => respond.mutate({ id: t.id, action: "decline" })}>Decline</Button>
            </>
          ) : <Button onClick={() => respond.mutate({ id: t.id, action: "cancel" })}>Cancel offer</Button>}
        </div>
      )}
    </Panel>
  );
}

function NewTrade({ toId, toName, onDone }: { toId: number; toName: string; onDone: () => void }) {
  const { hero } = useHero();
  const mine = useData<{ items: ItemView[] }>(["inventory"], "/api/inventory");
  const theirs = useData<{ items: ItemView[] }>(["tradable", toId], `/api/players/${toId}/tradable`);
  const [give, setGive] = useState<number[]>([]);
  const [want, setWant] = useState<number[]>([]);
  const [giveCoins, setGiveCoins] = useState(0);
  const [wantCoins, setWantCoins] = useState(0);
  const [message, setMessage] = useState("");
  const create = useAction("/api/trades", { invalidate: [["trades"], ["inventory"]], success: `Offer sent to ${toName}.`, onSuccess: onDone });
  const toggle = (list: number[], set: (v: number[]) => void, id: number) => set(list.includes(id) ? list.filter((x) => x !== id) : list.length < 12 ? [...list, id] : list);
  const tradable = (mine.data?.items ?? []).filter((i) => !i.equipped && !i.locked);

  return (
    <div className="stack stack--lg">
      <div className="trade-builder">
        <Panel title="You offer">
          <label className="field"><span>Coins</span><input className="input" type="number" min={0} max={hero.coins} value={giveCoins} onChange={(e) => setGiveCoins(Math.max(0, Math.min(hero.coins, Number(e.target.value) || 0)))} /></label>
          <div className="grid-cards" style={{ "--card-min": "118px", marginTop: "var(--s-3)" } as React.CSSProperties}>
            {tradable.map((i) => <ItemCard key={i.id} item={i} size="sm" selected={give.includes(i.id)} onClick={() => toggle(give, setGive, i.id)} />)}
          </div>
        </Panel>
        <Panel title={`You ask from ${toName}`}>
          <label className="field"><span>Coins</span><input className="input" type="number" min={0} value={wantCoins} onChange={(e) => setWantCoins(Math.max(0, Number(e.target.value) || 0))} /></label>
          {theirs.isPending ? <Loading rows={1} /> : (
            <div className="grid-cards" style={{ "--card-min": "118px", marginTop: "var(--s-3)" } as React.CSSProperties}>
              {(theirs.data?.items ?? []).map((i) => <ItemCard key={i.id} item={i} size="sm" selected={want.includes(i.id)} onClick={() => toggle(want, setWant, i.id)} />)}
            </div>
          )}
        </Panel>
      </div>
      <label className="field"><span>Message (optional)</span><input className="input" value={message} maxLength={200} onChange={(e) => setMessage(e.target.value)} /></label>
      <Button variant="primary" size="lg" disabled={!give.length && !want.length && !giveCoins && !wantCoins} loading={create.isPending}
        onClick={() => create.mutate({ toId, offerItemIds: give, offerCoins: giveCoins, requestItemIds: want, requestCoins: wantCoins, message })}>
        Send offer {giveCoins > 0 && <>· you give {fmt(giveCoins)} coins</>}
      </Button>
    </div>
  );
}
