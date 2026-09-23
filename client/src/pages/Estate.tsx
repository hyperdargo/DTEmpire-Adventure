import { Building, Home, PawPrint, Sparkles, Coins, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import type { EstateHouseDef, EstateObjectDef, EstatePetHouseDef, EstateStats } from "../../../shared/data/estate.ts";
import { Button, Loading, PageHead, Panel } from "../components/ui.tsx";
import { fmt } from "../lib/format.ts";
import { useAction, useData, useHero } from "../state/game.ts";

interface EstateView {
  estate: {
    houseId?: string | null;
    petHouseId?: string | null;
    objects?: string[];
    lastCollectedDay?: string;
  };
  currentHouse: EstateHouseDef | null;
  currentPetHouse: EstatePetHouseDef | null;
  placedObjects: EstateObjectDef[];
  totalStats: EstateStats;
  dailyCollected: boolean;
  dailyDividend?: number;
  dailyReward?: {
    coins: number;
    buffDurationHours: number;
    xpBonusPct: number;
    coinBonusPct: number;
  };
  catalog: {
    houses: EstateHouseDef[];
    petHouses: EstatePetHouseDef[];
    objects: EstateObjectDef[];
  };
}

export default function EstatePage() {
  const { hero } = useHero();
  const [tab, setTab] = useState<"overview" | "houses" | "furniture" | "pethouse">("overview");

  const estateData = useData<EstateView>(["estate"], "/api/estate");
  const inv = [["estate"], ["hero"]];

  const buyHouse = useAction<{ houseId: string }, { currentHouse?: { name?: string } }>("/api/estate/house/buy", {
    invalidate: inv,
    success: (r) => `Property acquired: ${r?.currentHouse?.name ?? "House"}!`,
  });

  const sellHouse = useAction<unknown, { refund?: number; houseRefund?: number; petRefund?: number; furnRefund?: number }>("/api/estate/house/sell", {
    invalidate: inv,
    success: (r) =>
      `Estate liquidated! Total refunded: ${fmt(r?.refund ?? 0)} Gold (Property: ${fmt(r?.houseRefund ?? 0)}, Pet Sanctuary: ${fmt(r?.petRefund ?? 0)}, Furnishings: ${fmt(r?.furnRefund ?? 0)}).`,
  });

  const buyPetHouse = useAction<{ petHouseId: string }>("/api/estate/pethouse/buy", {
    invalidate: inv,
    success: "Pet sanctuary established!",
  });

  const sellPetHouse = useAction("/api/estate/pethouse/sell", {
    invalidate: inv,
    success: "Pet sanctuary disassembled and refunded.",
  });

  const buyObject = useAction<{ objectId: string }>("/api/estate/object/buy", {
    invalidate: inv,
    success: () => `Furnishing placed in your residence!`,
  });

  const sellObject = useAction<{ objectId: string }>("/api/estate/object/sell", {
    invalidate: inv,
    success: "Furnishing sold.",
  });

  const collectDividend = useAction<unknown, { dividend?: number }>("/api/estate/collect", {
    invalidate: inv,
    success: (r) => `Collected ${fmt(r?.dividend ?? 0)} gold and activated Rested Estate buff!`,
  });

  if (estateData.isPending || !estateData.data) return <Loading rows={4} />;
  const data = estateData.data;
  const currentHouse = data.currentHouse;
  const currentPetHouse = data.currentPetHouse;
  const roomsUsed = data.placedObjects.length;
  const totalRooms = currentHouse?.rooms ?? 0;
  const totalLiquidationValue =
    (currentHouse?.sellPrice ?? 0) +
    (currentPetHouse?.sellPrice ?? 0) +
    data.placedObjects.reduce((acc: number, obj: EstateObjectDef) => acc + (obj.sellPrice ?? 0), 0);

  return (
    <>
      <PageHead title="Royal Estate & Residence">
        Invest your surplus gold into real estate, custom room furnishings, and pet sanctuaries for permanent combat and dividend bonuses.
      </PageHead>

      {/* Navigation tabs */}
      <div className="segmented-bar" style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <Button
          variant={tab === "overview" ? "primary" : "ghost"}
          onClick={() => setTab("overview")}
        >
          <Home size={16} aria-hidden /> Overview
        </Button>
        <Button
          variant={tab === "houses" ? "primary" : "ghost"}
          onClick={() => setTab("houses")}
        >
          <Building size={16} aria-hidden /> Properties ({data.catalog.houses.length})
        </Button>
        <Button
          variant={tab === "furniture" ? "primary" : "ghost"}
          onClick={() => setTab("furniture")}
        >
          <Sparkles size={16} aria-hidden /> Furnishings ({roomsUsed}/{totalRooms || "-"})
        </Button>
        <Button
          variant={tab === "pethouse" ? "primary" : "ghost"}
          onClick={() => setTab("pethouse")}
        >
          <PawPrint size={16} aria-hidden /> Pet Sanctuary
        </Button>
      </div>

      {/* ── TAB 1: OVERVIEW ── */}
      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Panel
            title={
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Home size={20} /> Current Residence
                </span>
                {currentHouse && (
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={sellHouse.isPending}
                    onClick={() => {
                      if (confirm(`Sell your ${currentHouse.name} for ${fmt(totalLiquidationValue)} gold? (House: ${fmt(currentHouse.sellPrice)}, Pet Sanctuary: ${fmt(currentPetHouse?.sellPrice ?? 0)}, Furnishings: ${fmt(data.placedObjects.reduce((acc: number, o: EstateObjectDef) => acc + (o.sellPrice ?? 0), 0))}). Everything will be refunded to your purse.`)) {
                        sellHouse.mutate({});
                      }
                    }}
                  >
                    Sell Property & All Contents ({fmt(totalLiquidationValue)} Gold)
                  </Button>
                )}
              </div>
            }
          >
            {currentHouse ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ fontSize: "40px" }}>{currentHouse.icon}</div>
                  <div>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "1.2rem" }}>{currentHouse.name}</h3>
                    <p style={{ margin: 0, color: "#888", fontSize: "0.9rem" }}>{currentHouse.desc}</p>
                    <div style={{ marginTop: "6px", display: "flex", gap: "12px", fontSize: "0.85rem", color: "#aaa" }}>
                      <span>Rooms: <b>{roomsUsed} / {totalRooms}</b></span>
                      <span>Resale Value: <b>{fmt(currentHouse.sellPrice)} Gold</b></span>
                    </div>
                  </div>
                </div>

                {/* Daily Dividend Banner */}
                <div style={{ background: "#111", border: "1px solid #333", borderRadius: "8px", padding: "14px", marginTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                      <Coins size={16} /> Daily Estate Dividend
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#888", marginTop: "2px" }}>
                      Earn <b>{fmt(data.dailyReward?.coins ?? data.dailyDividend ?? 0)} Gold</b> + <b>{data.dailyReward?.buffDurationHours ?? 4}h Rested Buff (+{data.dailyReward?.xpBonusPct ?? 10}% XP, +{data.dailyReward?.coinBonusPct ?? 5}% Gold)</b>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    disabled={data.dailyCollected || collectDividend.isPending}
                    onClick={() => collectDividend.mutate({})}
                  >
                    {data.dailyCollected ? "Collected Today" : "Collect Dividend"}
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "32px 16px", color: "#888" }}>
                <Building size={48} style={{ opacity: 0.3, marginBottom: "12px" }} />
                <h3>You do not own a residence yet</h3>
                <p style={{ maxWidth: "420px", margin: "8px auto 16px auto", fontSize: "0.9rem" }}>
                  Purchase land and build your manor to unlock room furnishing slots, daily gold dividends, and permanent hero buffs!
                </p>
                <Button variant="primary" onClick={() => setTab("houses")}>
                  Browse Available Properties
                </Button>
              </div>
            )}
          </Panel>

          {/* Active Estate Buffs Breakdown */}
          <Panel title={<span><Sparkles size={18} /> Active Estate Buffs</span>}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
              <div style={{ background: "#141414", border: "1px solid #2a2a2a", padding: "10px", borderRadius: "6px" }}>
                <div style={{ color: "#888", fontSize: "0.8rem" }}>Max Health</div>
                <div style={{ fontWeight: 600, color: "#4ade80", fontSize: "1.1rem" }}>
                  +{data.totalStats.hpPct}% {data.totalStats.flatHp ? `(+${fmt(data.totalStats.flatHp)})` : ""}
                </div>
              </div>
              <div style={{ background: "#141414", border: "1px solid #2a2a2a", padding: "10px", borderRadius: "6px" }}>
                <div style={{ color: "#888", fontSize: "0.8rem" }}>Attack Power</div>
                <div style={{ fontWeight: 600, color: "#f87171", fontSize: "1.1rem" }}>
                  +{data.totalStats.atkPct}% {data.totalStats.flatAtk ? `(+${fmt(data.totalStats.flatAtk)})` : ""}
                </div>
              </div>
              <div style={{ background: "#141414", border: "1px solid #2a2a2a", padding: "10px", borderRadius: "6px" }}>
                <div style={{ color: "#888", fontSize: "0.8rem" }}>Defense</div>
                <div style={{ fontWeight: 600, color: "#e5e5e5", fontSize: "1.1rem" }}>
                  +{data.totalStats.defPct}% {data.totalStats.flatDef ? `(+${fmt(data.totalStats.flatDef)})` : ""}
                </div>
              </div>
              <div style={{ background: "#141414", border: "1px solid #2a2a2a", padding: "10px", borderRadius: "6px" }}>
                <div style={{ color: "#888", fontSize: "0.8rem" }}>Coin & XP Yield</div>
                <div style={{ fontWeight: 600, color: "#fbbf24", fontSize: "1.1rem" }}>
                  +{data.totalStats.coinPct}% Coins / +{data.totalStats.xpPct}% XP
                </div>
              </div>
              <div style={{ background: "#141414", border: "1px solid #2a2a2a", padding: "10px", borderRadius: "6px" }}>
                <div style={{ color: "#888", fontSize: "0.8rem" }}>Critical & Luck</div>
                <div style={{ fontWeight: 600, color: "#e5e5e5", fontSize: "1.1rem" }}>
                  +{data.totalStats.crit}% Crit / +{data.totalStats.luck} Luck
                </div>
              </div>
              <div style={{ background: "#141414", border: "1px solid #2a2a2a", padding: "10px", borderRadius: "6px" }}>
                <div style={{ color: "#888", fontSize: "0.8rem" }}>Pet Power & Healing</div>
                <div style={{ fontWeight: 600, color: "#e5e5e5", fontSize: "1.1rem" }}>
                  +{data.totalStats.petPowerPct}% Pet / +{data.totalStats.potionPct}% Heal
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* ── TAB 2: PROPERTIES (BUY / UPGRADE) ── */}
      {tab === "houses" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {data.catalog.houses.map((house) => {
            const isOwned = currentHouse?.id === house.id;
            const canAfford = hero.coins >= house.price;
            const meetsLevel = hero.level >= house.minLevel;

            return (
              <div
                key={house.id}
                style={{
                  background: isOwned ? "#111d14" : "#0d0d0d",
                  border: isOwned ? "1px solid #22c55e" : "1px solid #333",
                  borderRadius: "8px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span style={{ fontSize: "36px" }}>{house.icon}</span>
                    {isOwned && (
                      <span style={{ background: "#22c55e", color: "#000", fontWeight: 700, fontSize: "0.75rem", padding: "2px 8px", borderRadius: "4px" }}>
                        CURRENT HOME
                      </span>
                    )}
                  </div>
                  <h3 style={{ margin: "8px 0 4px 0" }}>{house.name}</h3>
                  <p style={{ fontSize: "0.85rem", color: "#888", margin: "0 0 12px 0", minHeight: "40px" }}>{house.desc}</p>

                  <div style={{ borderTop: "1px solid #222", paddingTop: "8px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.85rem" }}>
                    <div>Capacity: <b>{house.rooms} Rooms</b></div>
                    <div>Level Required: <b>Lv {house.minLevel}</b> {!meetsLevel && <span style={{ color: "#ef4444" }}>(Too low)</span>}</div>
                    <div>Base Buffs: <b>+{house.stats.hpPct}% HP, +{house.stats.atkPct}% ATK</b></div>
                    {house.stats.defPct ? <div>Defense: <b>+{house.stats.defPct}%</b></div> : null}
                    {house.stats.coinPct ? <div>Income: <b>+{house.stats.coinPct}% Coins</b></div> : null}
                  </div>
                </div>

                <div style={{ marginTop: "16px", borderTop: "1px solid #222", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "#888" }}>Price</div>
                    <div style={{ fontWeight: 700, color: canAfford ? "#fbbf24" : "#ef4444" }}>{fmt(house.price)} Gold</div>
                  </div>
                  <Button
                    variant={isOwned ? "ghost" : "primary"}
                    disabled={isOwned || !canAfford || !meetsLevel || buyHouse.isPending}
                    onClick={() => {
                      const tradeIn = currentHouse ? currentHouse.sellPrice : 0;
                      const msg = currentHouse
                        ? `Purchase ${house.name} for ${fmt(house.price)} gold? You'll receive a trade-in credit of ${fmt(tradeIn)} gold from your ${currentHouse.name}.`
                        : `Purchase ${house.name} for ${fmt(house.price)} gold?`;
                      if (confirm(msg)) {
                        buyHouse.mutate({ houseId: house.id });
                      }
                    }}
                  >
                    {isOwned ? "Owned" : currentHouse ? "Upgrade / Move" : "Purchase"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB 3: FURNISHINGS & DECOR ── */}
      {tab === "furniture" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {!currentHouse && (
            <div style={{ background: "#221111", border: "1px solid #772222", padding: "12px", borderRadius: "6px", color: "#fca5a5" }}>
              You need to own a property first before you can purchase and place room furnishings!
            </div>
          )}

          {currentHouse && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#111", padding: "12px 16px", borderRadius: "6px", border: "1px solid #333" }}>
              <span>Furnishing Slots in <b>{currentHouse.name}</b>: <b>{roomsUsed} / {totalRooms}</b></span>
              <span style={{ color: roomsUsed >= totalRooms ? "#ef4444" : "#4ade80", fontSize: "0.9rem" }}>
                {roomsUsed >= totalRooms ? "Residence Full (Upgrade house for more rooms)" : `${totalRooms - roomsUsed} slots available`}
              </span>
            </div>
          )}

          {/* Placed objects in home */}
          {data.placedObjects.length > 0 && (
            <Panel title={<span><CheckCircle2 size={18} /> Placed in Your Residence ({roomsUsed})</span>}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" }}>
                {data.placedObjects.map((obj, idx) => (
                  <div key={`${obj.id}-${idx}`} style={{ background: "#141414", border: "1px solid #2a2a2a", padding: "12px", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "24px" }}>{obj.icon}</span>
                        <div>
                          <div style={{ fontWeight: 600 }}>{obj.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "#888" }}>Furnishing</div>
                        </div>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#4ade80", marginTop: "4px" }}>
                        {Object.entries(obj.stats).map(([k, v]) => `+${v} ${k}`).join(", ")}
                      </div>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={sellObject.isPending}
                      onClick={() => {
                        if (confirm(`Sell ${obj.name} for ${fmt(obj.sellPrice)} gold?`)) {
                          sellObject.mutate({ objectId: obj.id });
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Catalog of available furnishings */}
          <Panel title={<span><Plus size={18} /> Available Furnishings & Luxury Decor</span>}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "14px" }}>
              {data.catalog.objects.map((obj) => {
                const canAfford = hero.coins >= obj.price;
                const hasRoom = roomsUsed < totalRooms;

                return (
                  <div key={obj.id} style={{ background: "#0d0d0d", border: "1px solid #333", borderRadius: "8px", padding: "14px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "30px" }}>{obj.icon}</span>
                        <div>
                          <h4 style={{ margin: 0 }}>{obj.name}</h4>
                          <span style={{ fontSize: "0.75rem", color: "#888" }}>Furnishing</span>
                        </div>
                      </div>
                      <p style={{ fontSize: "0.8rem", color: "#777", margin: "8px 0" }}>{obj.desc}</p>
                      <div style={{ background: "#141414", padding: "6px 8px", borderRadius: "4px", fontSize: "0.8rem", color: "#4ade80" }}>
                        {Object.entries(obj.stats).map(([k, v]) => `+${v} ${k}`).join(" · ")}
                      </div>
                    </div>

                    <div style={{ marginTop: "12px", borderTop: "1px solid #222", paddingTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, color: canAfford ? "#fbbf24" : "#ef4444", fontSize: "0.9rem" }}>{fmt(obj.price)} Gold</span>
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={!currentHouse || !hasRoom || !canAfford || buyObject.isPending}
                        onClick={() => buyObject.mutate({ objectId: obj.id })}
                      >
                        Buy & Place
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      )}

      {/* ── TAB 4: PET SANCTUARY ── */}
      {tab === "pethouse" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {!currentHouse && (
            <div style={{ background: "#221111", border: "1px solid #772222", padding: "12px", borderRadius: "6px", color: "#fca5a5" }}>
              You need to own a property first before establishing a Pet Sanctuary!
            </div>
          )}

          {data.currentPetHouse && (
            <Panel title={<span><PawPrint size={18} /> Established Pet Sanctuary</span>}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <span style={{ fontSize: "36px" }}>{data.currentPetHouse.icon}</span>
                  <div>
                    <h3 style={{ margin: "0 0 4px 0" }}>{data.currentPetHouse.name}</h3>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#888" }}>{data.currentPetHouse.desc}</p>
                    <div style={{ color: "#4ade80", fontWeight: 600, fontSize: "0.85rem", marginTop: "4px" }}>
                      +{data.currentPetHouse.stats.petPowerPct}% All Pet Multipliers
                    </div>
                  </div>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={sellPetHouse.isPending}
                  onClick={() => {
                    if (confirm(`Disassemble your ${data.currentPetHouse?.name} for ${fmt(data.currentPetHouse?.sellPrice ?? 0)} gold?`)) {
                      sellPetHouse.mutate({});
                    }
                  }}
                >
                  Disassemble ({fmt(data.currentPetHouse.sellPrice)} Gold)
                </Button>
              </div>
            </Panel>
          )}

          <Panel title={<span>Available Pet Sanctuary Tiers</span>}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "14px" }}>
              {data.catalog.petHouses.map((ph) => {
                const isCurrent = data.currentPetHouse?.id === ph.id;
                const canAfford = hero.coins >= ph.price;

                return (
                  <div key={ph.id} style={{ background: isCurrent ? "#141414" : "#0d0d0d", border: isCurrent ? "1px solid #fff" : "1px solid #333", borderRadius: "8px", padding: "14px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "32px" }}>{ph.icon}</span>
                        {isCurrent && <span style={{ background: "#fff", color: "#000", fontWeight: 700, fontSize: "0.75rem", padding: "2px 8px", borderRadius: "4px" }}>ACTIVE</span>}
                      </div>
                      <h4 style={{ margin: "8px 0 4px 0" }}>{ph.name}</h4>
                      <p style={{ fontSize: "0.8rem", color: "#777", margin: "0 0 10px 0" }}>{ph.desc}</p>
                      <div style={{ color: "#4ade80", fontWeight: 600, fontSize: "0.85rem" }}>
                        +{ph.stats.petPowerPct}% Pet Power
                      </div>
                    </div>

                    <div style={{ marginTop: "12px", borderTop: "1px solid #222", paddingTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, color: canAfford ? "#fbbf24" : "#ef4444" }}>{fmt(ph.price)} Gold</span>
                      <Button
                        size="sm"
                        variant={isCurrent ? "ghost" : "primary"}
                        disabled={isCurrent || !currentHouse || !canAfford || buyPetHouse.isPending}
                        onClick={() => {
                          if (confirm(`Establish ${ph.name} for ${fmt(ph.price)} gold?`)) {
                            buyPetHouse.mutate({ petHouseId: ph.id });
                          }
                        }}
                      >
                        {isCurrent ? "Active" : data.currentPetHouse ? "Upgrade" : "Establish"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
