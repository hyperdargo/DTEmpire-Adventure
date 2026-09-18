import { useState } from "react";
import { AUCTION_FEE_PCT, AUCTION_HOURS } from "../../../shared/data/meta.ts";
import type { ItemView } from "../../../shared/data/types.ts";
import { ItemCard } from "../components/GameCard.tsx";
import { Button, Coins, Countdown, Empty, Loading, PageHead, Sheet, Tabs } from "../components/ui.tsx";
import { useAction, useData, useHero } from "../state/game.ts";

interface Listing { id: number; sellerId: number; seller: string; price: number; qty: number; expiresAt: number; item: ItemView; mine: boolean }

export default function AuctionPage() {
  const { hero } = useHero();
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [kind, setKind] = useState("");
  const [rarity, setRarity] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"new" | "cheap" | "pricey">("new");
  const [selling, setSelling] = useState(false);
  const qs = new URLSearchParams({ ...(kind && { kind }), ...(rarity && { rarity }), ...(q && { q }), sort, ...(tab === "mine" && { mine: "true" }) }).toString();
  const { data, isPending } = useData<{ listings: Listing[] }>(["auctions", qs], `/api/auctions?${qs}`, { enabled: hero.level >= 15 });
  const buy = useAction<{ id: number }>((b) => `/api/auctions/${b.id}/buy`, { invalidate: [["auctions"], ["inventory"]], success: "Purchased. It's in your bag." });
  const cancel = useAction<{ id: number }>((b) => `/api/auctions/${b.id}/cancel`, { invalidate: [["auctions"], ["inventory"]], success: "Listing withdrawn." });

  if (hero.level < 15) return <Empty art="🔨" title="The auction house opens at level 15">Until then, the Market and trades with friends will keep you equipped.</Empty>;

  return (
    <>
      <PageHead title="Auction House" actions={<Button variant="primary" onClick={() => setSelling(true)}>List an item</Button>}>
        Buy and sell with every hero in the realm. Sellers pay a 1% listing deposit and a {AUCTION_FEE_PCT}% fee on sale. Unsold items return by mail.
      </PageHead>
      <Tabs label="Auctions" value={tab} onChange={setTab} options={[{ value: "browse", label: "Browse" }, { value: "mine", label: "My listings" }]} />
      <div className="auction-filters">
        <input className="input" type="search" placeholder="Search items" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select className="select" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type">
          <option value="">All types</option>
          {["weapon", "armor", "helmet", "boots", "accessory", "potion", "material", "egg", "book"].map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <select className="select" value={rarity} onChange={(e) => setRarity(e.target.value)} aria-label="Rarity">
          <option value="">Any rarity</option>
          {["common", "uncommon", "rare", "epic", "legendary", "mythic"].map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
          <option value="new">Newest</option><option value="cheap">Cheapest</option><option value="pricey">Priciest</option>
        </select>
      </div>
      {isPending ? <Loading rows={3} /> : (data?.listings ?? []).length === 0 ? <Empty art="🔨" title={tab === "mine" ? "You have nothing listed" : "No listings match"} /> : (
        <div className="grid-cards" style={{ "--card-min": "170px" } as React.CSSProperties}>
          {data!.listings.map((l) => (
            <div key={l.id} className="offer">
              <ItemCard item={l.item} />
              <span className="faint">by {l.seller} · ends in <Countdown to={l.expiresAt} /></span>
              {l.mine ? <Button size="sm" onClick={() => cancel.mutate({ id: l.id })}>Withdraw</Button> : (
                <Button size="sm" variant="primary" disabled={hero.coins < l.price} onClick={() => buy.mutate({ id: l.id })}>Buy · <Coins value={l.price} compact /></Button>
              )}
            </div>
          ))}
        </div>
      )}
      <SellSheet open={selling} onClose={() => setSelling(false)} />
    </>
  );
}

function SellSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const inv = useData<{ items: ItemView[] }>(["inventory"], "/api/inventory", { enabled: open });
  const [picked, setPicked] = useState<ItemView | null>(null);
  const [price, setPrice] = useState(100);
  const [qty, setQty] = useState(1);
  const [hours, setHours] = useState<number>(24);
  const list = useAction("/api/auctions", { invalidate: [["auctions"], ["inventory"]], success: "Listed.", onSuccess: () => { setPicked(null); onClose(); } });
  const items = (inv.data?.items ?? []).filter((i) => !i.equipped && !i.locked);
  return (
    <Sheet open={open} onClose={onClose} title={picked ? `List ${picked.name}` : "Choose an item"} wide>
      {!picked ? (
        <div className="grid-cards" style={{ "--card-min": "124px" } as React.CSSProperties}>
          {items.map((i) => <ItemCard key={i.id} item={i} size="sm" onClick={() => { setPicked(i); setPrice(Math.max(10, i.sellPrice * 2)); setQty(1); }} />)}
        </div>
      ) : (
        <div className="item-sheet">
          <ItemCard item={picked} size="md" />
          <div className="stack">
            {picked.qty > 1 && <label className="field"><span>Quantity (of {picked.qty})</span><input className="input" type="number" min={1} max={picked.qty} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(picked.qty, Number(e.target.value) || 1)))} /></label>}
            <label className="field"><span>Price for the lot</span><input className="input" type="number" min={10} value={price} onChange={(e) => setPrice(Math.max(10, Number(e.target.value) || 10))} /></label>
            <p className="faint">Merchants would pay <Coins value={picked.sellPrice * qty} compact />. You'd receive <Coins value={Math.round(price * (1 - AUCTION_FEE_PCT / 100))} compact /> after fees.</p>
            <div className="row" role="radiogroup" aria-label="Duration">
              {AUCTION_HOURS.map((h) => <button key={h} type="button" role="radio" aria-checked={hours === h} className={`chip${hours === h ? " chip--gold" : ""}`} onClick={() => setHours(h)}>{h}h</button>)}
            </div>
            <div className="row">
              <Button variant="primary" loading={list.isPending} onClick={() => list.mutate({ itemId: picked.id, qty, price, hours })}>List it</Button>
              <Button variant="ghost" onClick={() => setPicked(null)}>Choose another</Button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
