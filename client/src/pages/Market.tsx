import { useState } from "react";
import { CONSUMABLE_BY_ID, GEAR_BY_ID } from "../../../shared/data/items.ts";
import type { Rarity } from "../../../shared/data/types.ts";
import { GameCard } from "../components/GameCard.tsx";
import { Button, Coins, Loading, PageHead, Panel, Tabs } from "../components/ui.tsx";
import { useAction, useData, useHero } from "../state/game.ts";

interface Offer { offerId: string; templateId: string; kind: "gear" | "stack"; rarity: Rarity; ilvl: number; price: number; stock: number | null }

export default function MarketPage() {
  const { hero } = useHero();
  const { data, isPending } = useData<{ offers: Offer[]; bought: string[] }>(["market"], "/api/market");
  const [tab, setTab] = useState<"gear" | "potion" | "egg" | "other">("gear");
  const [qty, setQty] = useState<Record<string, number>>({});
  const buy = useAction<{ offerId: string; qty: number }, { name: string; qty: number }>("/api/market/buy", {
    invalidate: [["market"], ["inventory"]], success: (r) => `Bought ${r.qty > 1 ? `${r.qty}× ` : ""}${r.name}.`,
  });

  if (isPending || !data) return <Loading rows={3} />;
  const shown = data.offers.filter((o) => {
    if (tab === "gear") return o.kind === "gear";
    const c = CONSUMABLE_BY_ID[o.templateId];
    if (tab === "potion") return c?.kind === "potion";
    if (tab === "egg") return c?.kind === "egg";
    return c && c.kind !== "potion" && c.kind !== "egg";
  });

  return (
    <>
      <PageHead title="Market">Gear on the racks changes every day at midnight UTC and matches your level. Potions, eggs and supplies are always in stock.</PageHead>
      <Tabs label="Market sections" value={tab} onChange={setTab} options={[{ value: "gear", label: "Today's gear" }, { value: "potion", label: "Potions" }, { value: "egg", label: "Eggs" }, { value: "other", label: "Supplies" }]} />
      <Panel className="market" tight>
        <div className="grid-cards" style={{ "--card-min": "170px" } as React.CSSProperties}>
          {shown.map((o) => {
            const g = GEAR_BY_ID[o.templateId];
            const c = CONSUMABLE_BY_ID[o.templateId];
            const sold = data.bought.includes(o.offerId);
            const n = qty[o.offerId] ?? 1;
            const locked = hero.level < (g?.levelReq ?? c?.levelReq ?? 1);
            return (
              <div key={o.offerId} className="offer">
                <GameCard size="md" rarity={g ? o.rarity : c?.kind === "egg" && c.eggRarity && !["mystery", "golden"].includes(c.eggRarity) ? c.eggRarity : "common"}
                  art={g?.icon ?? c?.icon ?? "📦"} name={g?.name ?? c?.name ?? o.templateId}
                  type={g ? <><b>{o.rarity}</b> {g.slot} · iL{o.ilvl}</> : c?.kind}
                  text={g?.desc ?? c?.desc} disabled={sold} badge={sold ? "Sold" : undefined} />
                <div className="row">
                  {o.kind === "stack" && (
                    <input className="input" type="number" min={1} max={99} value={n} aria-label="Quantity" style={{ width: 70, minHeight: 34 }}
                      onChange={(e) => setQty({ ...qty, [o.offerId]: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })} />
                  )}
                  <Button size="sm" variant="primary" disabled={sold || locked || hero.coins < o.price * n} loading={buy.isPending && buy.variables?.offerId === o.offerId}
                    onClick={() => buy.mutate({ offerId: o.offerId, qty: n })}>
                    {sold ? "Sold" : locked ? "Too low level" : <><Coins value={o.price * n} compact /></>}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}
