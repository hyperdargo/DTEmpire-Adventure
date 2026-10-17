import { useState } from "react";
import { useSearchParams } from "react-router";
import { CONSUMABLE_BY_ID, GEAR_BY_ID, type Recipe } from "../../../shared/data/items.ts";
import type { ItemView } from "../../../shared/data/types.ts";
import type { TransmutationRecipe } from "../../../shared/data/transmutation.ts";
import { GameCard, ItemCard, isGear } from "../components/GameCard.tsx";
import { Button, Coins, Empty, Loading, PageHead, Panel, Tabs } from "../components/ui.tsx";
import { useAction, useData, useHero } from "../state/game.ts";

type Cost = { coins: number; materials: Record<string, number> } | null;

interface TransmutationState {
  recipes: (TransmutationRecipe & {
    available: number;
    canAfford: boolean;
    userFromQty: number;
    fromName: string;
    fromIcon: string;
    toName: string;
    toIcon: string;
  })[];
}

function MaterialList({ materials, have }: { materials: Record<string, number>; have: Record<string, number> }) {
  return (
    <div className="row row--wrap">
      {Object.entries(materials).map(([m, q]) => {
        const c = CONSUMABLE_BY_ID[m];
        const ok = (have[m] ?? 0) >= q;
        return <span key={m} className={`chip${ok ? "" : " chip--warn"}`}><span className="art">{c?.icon}</span>{c?.name} {have[m] ?? 0}/{q}</span>;
      })}
    </div>
  );
}

export default function SmithyPage() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<"upgrade" | "forge" | "craft" | "unique" | "reforge" | "transmute">(params.get("item") ? "upgrade" : "craft");
  const { hero } = useHero();
  const inv = useData<{ items: ItemView[] }>(["inventory"], "/api/inventory");
  const smithy = useData<{ recipes: Recipe[]; upgradeCosts: Record<string, Cost> }>(["smithy"], "/api/smithy");
  const [picked, setPicked] = useState<number | null>(params.get("item") ? Number(params.get("item")) : null);
  const [forgeA, setForgeA] = useState<number | null>(null);
  const [forgeB, setForgeB] = useState<number | null>(null);
  const [uniquePicked, setUniquePicked] = useState<number[]>([]);
  const [reforgePicked, setReforgePicked] = useState<number | null>(null);
  const invalidate = [["inventory"], ["smithy"]];
  const upgrade = useAction<{ itemId: number }>("/api/smithy/upgrade", { invalidate, success: "The metal takes the heat. Upgrade complete." });
  const craft = useAction<{ recipeId: string }>("/api/smithy/craft", { invalidate, success: "Crafted! It's in your bag." });
  const forge = useAction<{ aId: number; bId: number }, { item: { rarity: string }; jumped: boolean }>("/api/smithy/forge", {
    invalidate, onSuccess: () => { setForgeA(null); setForgeB(null); },
    success: (r) => (r.jumped ? `The forge roars! A ${r.item.rarity} piece, two tiers up!` : `Forged into a ${r.item.rarity} piece.`),
  });
  const forgeUnique = useAction<{ itemIds: number[] }, { item: ItemView; coins: number }>("/api/smithy/forge-unique", {
    invalidate, onSuccess: () => setUniquePicked([]),
    success: (r) => `🔥 UNIQUE RELIC FORGED! Crafted ${r.item.name} (${r.item.rarity})!`,
  });
  const reforge = useAction<{ itemId: number }, { item: ItemView; reforgersRemaining: number }>("/api/smithy/reforge", {
    invalidate,
    success: (r) => `🧿 Void Reforged ${r.item.name}! New magical affixes infused.`,
  });

  if (inv.isPending || smithy.isPending || !smithy.data) return <Loading rows={3} />;
  const items = inv.data?.items ?? [];
  const have: Record<string, number> = Object.fromEntries(items.filter((i) => i.kind === "material").map((i) => [i.templateId, i.qty]));
  const gear = items.filter(isGear);
  const target = gear.find((i) => i.id === picked);
  const cost = target ? smithy.data.upgradeCosts[String(target.id)] : null;
  const a = gear.find((i) => i.id === forgeA);
  const forgeCandidates = a ? gear.filter((i) => i.id !== a.id && i.kind === a.kind && i.rarity === a.rarity && !i.equipped && !i.locked) : gear.filter((i) => !i.equipped && !i.locked && i.rarity !== "mythic" && i.rarity !== "unique");

  const mythicGear = gear.filter((i) => i.rarity === "mythic" && !i.equipped && !i.locked);
  const firstUniqueItem = uniquePicked.length ? gear.find((i) => i.id === uniquePicked[0]) : null;
  const uniqueAllowedSlot = firstUniqueItem ? firstUniqueItem.kind : null;
  const uniqueCandidates = mythicGear.filter((i) => !uniqueAllowedSlot || i.kind === uniqueAllowedSlot);
  const uniqueMaxIlvl = uniquePicked.length ? Math.max(...uniquePicked.map((id) => gear.find((g) => g.id === id)?.ilvl || 50)) : 50;
  const uniqueCost = 150_000 + uniqueMaxIlvl * 1000;

  const voidReforgers = items.find((i) => i.templateId === "void_reforger")?.qty ?? 0;
  const reforgeEligible = gear.filter((i) => i.rarity === "rare" || i.rarity === "epic" || i.rarity === "legendary" || i.rarity === "mythic" || i.rarity === "unique");
  const reforgeTarget = gear.find((i) => i.id === reforgePicked);

  return (
    <>
      <PageHead title="Blacksmith">Upgrade gear to +10, forge two matching pieces into a rarer one, craft from materials, or transmute alchemical reagents into higher-tier essences.</PageHead>
      <div className="row row--wrap" style={{ marginBottom: "var(--s-4)" }}>
        {["iron_ore", "undead_bones", "silk_cloth", "dragon_scales", "mystic_gem", "star_essence", "abyss_shard"].map((m) => (
          <span key={m} className="chip"><span className="art">{CONSUMABLE_BY_ID[m]?.icon}</span>{CONSUMABLE_BY_ID[m]?.name} <b className="num">{have[m] ?? 0}</b></span>
        ))}
      </div>
      <Tabs label="Blacksmith" value={tab} onChange={setTab} options={[
        { value: "craft", label: "Craft" },
        { value: "upgrade", label: "Upgrade" },
        { value: "transmute", label: "⚗️ Transmute" },
        { value: "forge", label: "Forge" },
        { value: "unique", label: "👑 Unique Altar (5 Mythic)" },
        { value: "reforge", label: `🧿 Void Reforge (${voidReforgers})` },
      ]} />
      <div style={{ marginTop: "var(--s-5)" }}>
        {tab === "upgrade" && (
          <div className="smithy-split">
            <Panel title="Choose gear">
              {gear.length === 0 ? <Empty art="⚒️" title="No gear to upgrade" /> : (
                <div className="grid-cards" style={{ "--card-min": "124px" } as React.CSSProperties}>
                  {gear.map((i) => <ItemCard key={i.id} item={i} size="sm" selected={i.id === picked} onClick={() => setPicked(i.id)} />)}
                </div>
              )}
            </Panel>
            <Panel title="Anvil">
              {!target ? <p className="muted">Pick a piece of gear.</p> : (
                <div className="stack" style={{ justifyItems: "center" }}>
                  <ItemCard item={target} size="lg" />
                  {!cost ? <span className="chip chip--gold">Fully upgraded (+10)</span> : (
                    <>
                      <p>Upgrade to <b className="gold">+{target.upgrade + 1}</b>: every stat grows by 6% of its base.</p>
                      <MaterialList materials={cost.materials} have={have} />
                      <Button variant="primary" size="lg" loading={upgrade.isPending}
                        disabled={hero.coins < cost.coins || Object.entries(cost.materials).some(([m, q]) => (have[m] ?? 0) < q)}
                        onClick={() => upgrade.mutate({ itemId: target.id })}>Upgrade · <Coins value={cost.coins} compact /></Button>
                    </>
                  )}
                </div>
              )}
            </Panel>
          </div>
        )}
        {tab === "forge" && (
          <div className="smithy-split">
            <Panel title={a ? "Choose its partner" : "Choose the first piece"}>
              <p className="muted" style={{ marginBottom: "var(--s-3)" }}>Both pieces must share a slot and rarity. The result is one tier rarer (sometimes two) and keeps the higher upgrade.</p>
              {forgeCandidates.length === 0 ? <p className="faint">{a ? "No matching partner in your bag." : "No forgeable gear. Unlock or unequip pieces first."}</p> : (
                <div className="grid-cards" style={{ "--card-min": "124px" } as React.CSSProperties}>
                  {forgeCandidates.map((i) => (
                    <ItemCard key={i.id} item={i} size="sm" selected={i.id === forgeB} onClick={() => (a ? setForgeB(i.id) : setForgeA(i.id))} />
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="The forge">
              <div className="forge">
                {a ? <ItemCard item={a} size="md" onClick={() => { setForgeA(null); setForgeB(null); }} /> : <GameCard size="md" rarity="common" art="❔" name="First piece" disabled />}
                <span className="forge__plus" aria-hidden>+</span>
                {forgeB ? <ItemCard item={gear.find((i) => i.id === forgeB)!} size="md" onClick={() => setForgeB(null)} /> : <GameCard size="md" rarity="common" art="❔" name="Second piece" disabled />}
              </div>
              <Button variant="primary" size="lg" block disabled={!a || !forgeB} loading={forge.isPending} onClick={() => a && forgeB && forge.mutate({ aId: a.id, bId: forgeB })}>
                Forge{a ? <> · <Coins value={Math.round(100 * a.ilvl * 1.2)} compact />+</> : null}
              </Button>
            </Panel>
          </div>
        )}
        {tab === "craft" && (
          <div className="grid-cards" style={{ "--card-min": "200px" } as React.CSSProperties}>
            {smithy.data.recipes.map((r) => {
              const g = GEAR_BY_ID[r.gearId]!;
              const missing = Object.entries(r.materials).some(([m, q]) => (have[m] ?? 0) < q);
              const locked = hero.level < g.levelReq;
              return (
                <div key={r.id} className="recipe">
                  <GameCard size="md" rarity={r.rarity} art={g.icon} name={g.name} type={<><b>{r.rarity}</b> {g.slot}</>} text={g.desc} cost={`Lv ${g.levelReq}`} disabled={locked} />
                  <MaterialList materials={r.materials} have={have} />
                  <Button size="sm" variant={missing || locked ? "default" : "primary"} disabled={missing || locked || hero.coins < r.coins} loading={craft.isPending} onClick={() => craft.mutate({ recipeId: r.id })}>
                    {locked ? `Level ${g.levelReq}` : <>Craft · <Coins value={r.coins} compact /></>}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        {tab === "unique" && (
          <div className="smithy-split">
            <Panel title={`Choose Mythic items to sacrifice (${uniquePicked.length}/5)`}>
              <p className="muted" style={{ marginBottom: "var(--s-3)" }}>
                Combine at least 5 Mythic pieces of the same slot to synthesize an ultra-rare Unique relic. The relic inherits the highest item level and highest upgrade (+N).
              </p>
              {uniqueCandidates.length === 0 ? (
                <p className="faint">
                  {uniqueAllowedSlot
                    ? `No more unlocked, unequipped Mythic ${uniqueAllowedSlot} pieces in your bag.`
                    : "No unlocked, unequipped Mythic gear available to sacrifice."}
                </p>
              ) : (
                <div className="grid-cards" style={{ "--card-min": "124px" } as React.CSSProperties}>
                  {uniqueCandidates.map((i) => {
                    const isSelected = uniquePicked.includes(i.id);
                    return (
                      <ItemCard
                        key={i.id}
                        item={i}
                        size="sm"
                        selected={isSelected}
                        onClick={() =>
                          setUniquePicked((prev) =>
                            prev.includes(i.id) ? prev.filter((x) => x !== i.id) : [...prev, i.id]
                          )
                        }
                      />
                    );
                  })}
                </div>
              )}
            </Panel>
            <Panel title="The Unique Altar">
              <div className="stack" style={{ justifyItems: "center", gap: "var(--s-4)" }}>
                <div className="row row--wrap" style={{ justifyContent: "center", gap: "var(--s-2)" }}>
                  {uniquePicked.map((id) => {
                    const it = gear.find((g) => g.id === id);
                    return it ? (
                      <ItemCard
                        key={it.id}
                        item={it}
                        size="sm"
                        onClick={() => setUniquePicked((prev) => prev.filter((x) => x !== it.id))}
                      />
                    ) : null;
                  })}
                  {Array.from({ length: Math.max(0, 5 - uniquePicked.length) }).map((_, idx) => (
                    <GameCard key={idx} size="sm" rarity="mythic" art="✨" name={`Sacrifice ${uniquePicked.length + idx + 1}`} disabled />
                  ))}
                </div>

                <div style={{ textAlign: "center" }}>
                  <p>
                    <b>Sacrificing {uniquePicked.length} Mythic {uniqueAllowedSlot ? `${uniqueAllowedSlot}s` : "items"}</b>
                  </p>
                  <p className="faint">
                    Unique gear possesses 2.8× base stat multiplier and 4 powerful enchantment affixes.
                  </p>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  block
                  disabled={uniquePicked.length < 5 || hero.coins < uniqueCost}
                  loading={forgeUnique.isPending}
                  onClick={() => forgeUnique.mutate({ itemIds: uniquePicked })}
                >
                  ⚡ Synthesize Unique Relic · <Coins value={uniqueCost} compact />
                </Button>
              </div>
            </Panel>
          </div>
        )}

        {tab === "reforge" && (
          <div className="smithy__reforge" style={{ display: "grid", gap: "var(--s-4)" }}>
            <Panel title="Void Reforging Altar">
              <p className="muted" style={{ margin: "0 0 var(--s-3) 0" }}>
                Channel void essence through a <b>Void Reforger</b> to completely reroll the magical enchantment affixes on any Rare, Epic, Legendary, Mythic, or Unique gear piece. Base stats, upgrade level, and item level are preserved.
              </p>
              <div className="row row--wrap" style={{ gap: "var(--s-2)", marginBottom: "var(--s-4)" }}>
                <span className="chip chip--gold">
                  🧿 {voidReforgers} Void Reforgers in Bag
                </span>
                <span className="chip">
                  ⚔️ {reforgeEligible.length} Eligible Gear Pieces
                </span>
              </div>

              {reforgeEligible.length === 0 ? (
                <p className="faint">You have no Rare or higher gear to reforge.</p>
              ) : (
                <div style={{ display: "grid", gap: "var(--s-4)" }}>
                  <div>
                    <h4 style={{ margin: "0 0 var(--s-2) 0" }}>1. Select Gear to Reforge</h4>
                    <div className="row row--wrap" style={{ gap: "var(--s-2)" }}>
                      {reforgeEligible.map((i) => (
                        <ItemCard
                          key={i.id}
                          item={i}
                          size="sm"
                          selected={i.id === reforgePicked}
                          onClick={() => setReforgePicked(i.id)}
                        />
                      ))}
                    </div>
                  </div>

                  {reforgeTarget && (
                    <div className="card" style={{ padding: "var(--s-4)", background: "var(--surface, #181818)", border: "1px solid var(--border, #333)" }}>
                      <h4 style={{ margin: "0 0 var(--s-3) 0" }}>2. Preview & Reforge</h4>
                      <div className="row row--wrap" style={{ gap: "var(--s-4)", alignItems: "flex-start" }}>
                        <ItemCard item={reforgeTarget} size="md" />
                        <div style={{ flex: 1, minWidth: 240, display: "grid", gap: "var(--s-3)" }}>
                          <div>
                            <p style={{ margin: "0 0 var(--s-1) 0" }}><b>{reforgeTarget.name}</b> (+{reforgeTarget.upgrade})</p>
                            <span className="chip chip--gold">Item Level {reforgeTarget.ilvl}</span>
                          </div>
                          <div>
                            <p className="faint" style={{ margin: "0 0 var(--s-1) 0", fontSize: "0.85rem" }}>Current Enchantment Affixes:</p>
                            {reforgeTarget.affixes && reforgeTarget.affixes.length > 0 ? (
                              <div className="row row--wrap" style={{ gap: "var(--s-1)" }}>
                                {reforgeTarget.affixes.map((af, idx) => (
                                  <span key={idx} className="chip">
                                    +{af.value} {af.stat}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="faint">No affixes currently rolled.</p>
                            )}
                          </div>
                          <div style={{ marginTop: "var(--s-2)" }}>
                            <Button
                              variant="primary"
                              size="lg"
                              disabled={voidReforgers < 1 || reforge.isPending}
                              loading={reforge.isPending}
                              onClick={() => reforge.mutate({ itemId: reforgeTarget.id })}
                            >
                              {voidReforgers < 1 ? "Need 1× Void Reforger" : "🧿 Reforge Affixes (1× Void Reforger)"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Panel>
          </div>
        )}

        {tab === "transmute" && (
          <TransmutePanel have={have} heroLevel={hero?.level ?? 1} heroCoins={hero?.coins ?? 0} />
        )}
      </div>
    </>
  );
}

function TransmutePanel({ have, heroLevel, heroCoins }: { have: Record<string, number>; heroLevel: number; heroCoins: number }) {
  const transData = useData<TransmutationState>(["transmute"], "/api/smithy/transmute");
  const [filter, setFilter] = useState<"all" | "ascend" | "descend">("all");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const invalidate = [["inventory"], ["smithy"], ["transmute"], ["me"]];
  const transmute = useAction<{ recipeId: string; count: number }, { receivedQty: number; toName: string; usedQty: number; fromName: string }>(
    "/api/smithy/transmute",
    {
      invalidate,
      success: (r) => `⚗️ Transmuted ${r.usedQty}× ${r.fromName} into ${r.receivedQty}× ${r.toName}!`,
    }
  );

  if (transData.isPending || !transData.data) return <Loading rows={2} />;

  const recipes = transData.data.recipes.filter((r) => filter === "all" || r.category === filter);

  return (
    <Panel
      title="Alchemical Transmutation Chamber"
      action={
        <div style={{ display: "flex", gap: "6px" }}>
          <Button variant={filter === "all" ? "primary" : "default"} size="sm" onClick={() => setFilter("all")}>
            All
          </Button>
          <Button variant={filter === "ascend" ? "primary" : "default"} size="sm" onClick={() => setFilter("ascend")}>
            Refine ⬆️
          </Button>
          <Button variant={filter === "descend" ? "primary" : "default"} size="sm" onClick={() => setFilter("descend")}>
            Fracture ⬇️
          </Button>
        </div>
      }
    >
      <p className="muted" style={{ marginBottom: "var(--s-4)" }}>
        Harness ancient alchemical crucibles to transmute common materials into rare reagents, or fracture high-tier essences into bulk crafting components.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "var(--s-4)" }}>
        {recipes.map((r) => {
          const userQty = have[r.fromMaterial] ?? 0;
          const selectedCount = counts[r.id] ?? 1;
          const reqMaterial = r.fromQty * selectedCount;
          const reqCoins = r.coins * selectedCount;
          const canAffordMaterial = userQty >= reqMaterial;
          const canAffordCoins = heroCoins >= reqCoins;
          const meetsLevel = heroLevel >= r.minLevel;
          const canCraft = meetsLevel && canAffordMaterial && canAffordCoins;

          return (
            <div
              key={r.id}
              style={{
                background: "#141414",
                border: "1px solid #333",
                borderRadius: "8px",
                padding: "var(--s-4)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--s-3)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h4 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px", color: "#eee", fontSize: "1rem" }}>
                    <span>{r.icon}</span> {r.name}
                  </h4>
                  <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#888" }}>{r.desc}</p>
                </div>
                <span
                  style={{
                    background: r.category === "ascend" ? "#1f2a1f" : "#2a1f1f",
                    color: r.category === "ascend" ? "#7cee7c" : "#ee7c7c",
                    border: `1px solid ${r.category === "ascend" ? "#335533" : "#553333"}`,
                    borderRadius: "4px",
                    padding: "2px 8px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  {r.category === "ascend" ? "Refine" : "Fracture"}
                </span>
              </div>

              {/* Conversion Diagram */}
              <div
                style={{
                  background: "#0a0a0a",
                  border: "1px solid #282828",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.85rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>{r.fromIcon}</span>
                  <span style={{ color: canAffordMaterial ? "#ccc" : "#f77" }}>
                    {reqMaterial}× {r.fromName}
                  </span>
                  <span style={{ color: "#666", fontSize: "0.75rem" }}>({userQty})</span>
                </div>
                <span style={{ color: "#888" }}>➔</span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#fff", fontWeight: 600 }}>
                  <span>{r.toIcon}</span>
                  <span>{r.toQty * selectedCount}× {r.toName}</span>
                </div>
              </div>

              {/* Cost & Requirements */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", color: canAffordCoins ? "#ccc" : "#f77" }}>
                  <span>🪙</span>
                  <span>{reqCoins.toLocaleString("en-US")} coins</span>
                </div>
                <span style={{ color: meetsLevel ? "#888" : "#f77", fontSize: "0.75rem" }}>
                  Req. Lv.{r.minLevel}
                </span>
              </div>

              {/* Multiplier buttons */}
              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", color: "#666", marginRight: "4px" }}>Batch:</span>
                {[1, 5, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCounts((c) => ({ ...c, [r.id]: num }))}
                    style={{
                      background: selectedCount === num ? "#fff" : "#1a1a1a",
                      color: selectedCount === num ? "#000" : "#bbb",
                      border: "1px solid #444",
                      borderRadius: "4px",
                      padding: "2px 8px",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      fontWeight: selectedCount === num ? 700 : 400,
                    }}
                  >
                    {num}×
                  </button>
                ))}
                {r.available > 1 && (
                  <button
                    type="button"
                    onClick={() => setCounts((c) => ({ ...c, [r.id]: Math.min(50, r.available) }))}
                    style={{
                      background: selectedCount === Math.min(50, r.available) ? "#fff" : "#1a1a1a",
                      color: selectedCount === Math.min(50, r.available) ? "#000" : "#bbb",
                      border: "1px solid #444",
                      borderRadius: "4px",
                      padding: "2px 8px",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      fontWeight: selectedCount === Math.min(50, r.available) ? 700 : 400,
                    }}
                  >
                    Max ({Math.min(50, r.available)})
                  </button>
                )}
              </div>

              {/* Action Button */}
              <Button
                variant="primary"
                size="lg"
                disabled={!canCraft || transmute.isPending}
                loading={transmute.isPending}
                onClick={() => transmute.mutate({ recipeId: r.id, count: selectedCount })}
                style={{ width: "100%", marginTop: "auto" }}
              >
                {!meetsLevel
                  ? `Requires Lv.${r.minLevel}`
                  : !canAffordMaterial
                  ? `Need ${reqMaterial}× ${r.fromName}`
                  : !canAffordCoins
                  ? "Not enough coins"
                  : `Transmute (${selectedCount}×)`}
              </Button>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
