import { useState } from "react";
import type { MerchantOfferDef } from "../../../shared/data/merchant.ts";
import type { ItemView } from "../../../shared/data/types.ts";
import { GameCard } from "../components/GameCard.tsx";
import { Button, Coins, Loading, PageHead, Panel, Tabs } from "../components/ui.tsx";
import { fmt } from "../lib/format.ts";
import { useAction, useData, useHero } from "../state/game.ts";

interface PawnableStack {
  templateId: string;
  name: string;
  icon: string;
  qty: number;
  unitPawnPrice: number;
  totalPawnPrice: number;
}

interface PawnableGear {
  id: number;
  templateId: string;
  name: string;
  icon: string;
  rarity: string;
  ilvl: number;
  upgrade: number;
  pawnPrice: number;
  view: ItemView;
}

interface MerchantViewData {
  offers: MerchantOfferDef[];
  pawnableStacks: PawnableStack[];
  pawnableGear: PawnableGear[];
}

export default function MerchantPage() {
  const { hero } = useHero();
  const { data, isPending } = useData<MerchantViewData>(["merchant"], "/api/merchant");
  const [tab, setTab] = useState<"materials" | "consumables" | "eggs" | "gear" | "sell">("materials");
  const [buyQty, setBuyQty] = useState<Record<string, number>>({});
  const [sellQty, setSellQty] = useState<Record<string, number>>({});

  const buy = useAction<{ offerId: string; qty: number }, { name: string; qty: number; spent: number }>("/api/merchant/buy", {
    invalidate: [["merchant"], ["inventory"], ["hero"]],
    success: (r) => `Purchased ${r.qty > 1 ? `${r.qty}× ` : ""}${r.name} for ${fmt(r.spent)} coins.`,
  });

  const sell = useAction<{ kind: "stack" | "gear"; templateId?: string; itemId?: number; qty?: number }, { name: string; qty: number; earned: number }>("/api/merchant/sell", {
    invalidate: [["merchant"], ["inventory"], ["hero"]],
    success: (r) => `Sold ${r.qty > 1 ? `${r.qty}× ` : ""}${r.name} to the Grand Merchant for +${fmt(r.earned)} coins!`,
  });

  if (isPending || !data) return <Loading rows={4} />;

  const offersByCategory = data.offers.filter((o) => {
    if (tab === "materials") return o.category === "materials";
    if (tab === "consumables") return o.category === "consumables";
    if (tab === "eggs") return o.category === "eggs";
    if (tab === "gear") return o.category === "gear";
    return false;
  });

  return (
    <>
      <PageHead title="Wandering Grand Merchant">
        A legendary dimensional trader dealing in every coveted relic, rare ore, and primordial treasure in the known universe.
        Wares are unlimited, but valuable treasures like <b>Mystic Gems</b> and <b>Star Essences</b> command massive gold premiums.
      </PageHead>

      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <Tabs
          label="Merchant Trade Floor"
          value={tab}
          onChange={setTab}
          options={[
            { value: "materials", label: "💎 Rare Materials" },
            { value: "consumables", label: "🧪 Reagents & Tomes" },
            { value: "eggs", label: "🥚 Pet Eggs" },
            { value: "gear", label: "⚔️ Relics & Gear" },
            { value: "sell", label: `💰 Sell to Merchant (${data.pawnableStacks.length + data.pawnableGear.length})` },
          ]}
        />
      </div>

      {tab !== "sell" ? (
        <Panel tight>
          <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #222", background: "#111", fontSize: "0.85rem", color: "#888" }}>
            {tab === "materials" && "Essential catalysts for Blacksmith forging and high-tier +7 to +10 upgrades. Stock is permanent."}
            {tab === "consumables" && "Mastery grimoires, affix rerollers, and cosmic elixirs."}
            {tab === "eggs" && "Rare, epic, and mythic pet eggs from across the realms."}
            {tab === "gear" && "High-level armaments and Level 100–200 Transcendent artifacts rolled with unique affixes."}
          </div>
          <div className="grid-cards" style={{ "--card-min": "200px", padding: "1rem" } as React.CSSProperties}>
            {offersByCategory.map((o) => {
              const count = buyQty[o.id] ?? 1;
              const locked = hero.level < o.levelReq;
              const totalCost = o.buyPrice * count;
              const canAfford = hero.coins >= totalCost;

              return (
                <div key={o.id} className="offer" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <GameCard
                    size="md"
                    rarity={o.rarity}
                    art={o.icon}
                    name={o.name}
                    type={
                      o.kind === "gear" ? (
                        <>
                          <b>{o.rarity}</b> · iL{o.ilvl} · Lv {o.levelReq}+
                        </>
                      ) : (
                        <>
                          <b>{o.rarity}</b> {o.tagline ? `· ${o.tagline}` : ""}
                        </>
                      )
                    }
                    text={o.desc}
                  />

                  <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.75rem", color: "#888" }}>Price:</span>
                      <Coins value={totalCost} compact />
                    </div>

                    <div className="row" style={{ display: "flex", gap: "0.4rem" }}>
                      {o.kind === "stack" && (
                        <input
                          className="input"
                          type="number"
                          min={1}
                          max={999}
                          value={count}
                          aria-label="Quantity"
                          style={{ width: 65, minHeight: 34, textAlign: "center" }}
                          onChange={(e) =>
                            setBuyQty({
                              ...buyQty,
                              [o.id]: Math.max(1, Math.min(999, Number(e.target.value) || 1)),
                            })
                          }
                        />
                      )}
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={locked || !canAfford}
                        loading={buy.isPending && buy.variables?.offerId === o.id}
                        style={{ flex: 1 }}
                        onClick={() => buy.mutate({ offerId: o.id, qty: count })}
                      >
                        {locked ? `Lv ${o.levelReq}+` : !canAfford ? "Too poor" : "Buy Wares"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Sell Materials & Stacks */}
          <Panel title={<h3>💎 Liquidate Valuable Reagents & Items</h3>} tight>
            <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #222", background: "#111", fontSize: "0.85rem", color: "#aaa" }}>
              The Grand Merchant buys valuable materials like <b>Mystic Gems (50,000c)</b> and <b>Star Essences (120,000c)</b> at premium prices compared to standard salvage!
            </div>
            {data.pawnableStacks.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
                No materials, books, or consumables in your bag to sell.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.75rem", padding: "1rem" }}>
                {data.pawnableStacks.map((s) => {
                  const n = sellQty[s.templateId] ?? 1;
                  const currentQty = Math.min(s.qty, n);
                  const payout = s.unitPawnPrice * currentQty;

                  return (
                    <div
                      key={s.templateId}
                      style={{
                        background: "#141414",
                        border: "1px solid #333",
                        borderRadius: "6px",
                        padding: "0.75rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontSize: "1.5rem" }}>{s.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#eee", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {s.name}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#888" }}>
                            Owned: <b>{fmt(s.qty)}</b> · Rate: <Coins value={s.unitPawnPrice} compact /> each
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "auto" }}>
                        <input
                          className="input"
                          type="number"
                          min={1}
                          max={s.qty}
                          value={currentQty}
                          aria-label="Sell quantity"
                          style={{ width: 65, minHeight: 34, textAlign: "center" }}
                          onChange={(e) =>
                            setSellQty({
                              ...sellQty,
                              [s.templateId]: Math.max(1, Math.min(s.qty, Number(e.target.value) || 1)),
                            })
                          }
                        />
                        <button
                          type="button"
                          className="chip"
                          style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                          onClick={() => setSellQty({ ...sellQty, [s.templateId]: s.qty })}
                        >
                          All ({s.qty})
                        </button>
                        <Button
                          size="sm"
                          variant="primary"
                          loading={sell.isPending && sell.variables?.templateId === s.templateId}
                          style={{ flex: 1 }}
                          onClick={() => sell.mutate({ kind: "stack", templateId: s.templateId, qty: currentQty })}
                        >
                          Sell (+<Coins value={payout} compact />)
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* Sell Unequipped Gear */}
          <Panel title={<h3>⚔️ Pawn Unequipped Gear (1.6× Enhanced Rate)</h3>} tight>
            <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #222", background: "#111", fontSize: "0.85rem", color: "#aaa" }}>
              Pawn your unequipped, unlocked weapons and armor for 160% of standard vendor value.
            </div>
            {data.pawnableGear.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
                No unequipped, unlocked gear pieces available to pawn.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem", padding: "1rem" }}>
                {data.pawnableGear.map((g) => (
                  <div
                    key={g.id}
                    style={{
                      background: "#141414",
                      border: "1px solid #333",
                      borderRadius: "6px",
                      padding: "0.75rem",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "1.5rem" }}>{g.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#eee" }}>
                          {g.name} {g.upgrade > 0 ? `+${g.upgrade}` : ""}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#888" }}>
                          <b style={{ textTransform: "capitalize" }}>{g.rarity}</b> · iL{g.ilvl}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.25rem" }}>
                      <span style={{ fontSize: "0.8rem", color: "#888" }}>Pawn Value:</span>
                      <Coins value={g.pawnPrice} compact />
                    </div>

                    <Button
                      size="sm"
                      variant="primary"
                      loading={sell.isPending && sell.variables?.itemId === g.id}
                      onClick={() => sell.mutate({ kind: "gear", itemId: g.id })}
                    >
                      Pawn for +{fmt(g.pawnPrice)} coins
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
