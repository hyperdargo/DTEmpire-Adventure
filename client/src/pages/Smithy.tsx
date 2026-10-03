import { useState } from "react";
import { useSearchParams } from "react-router";
import { CONSUMABLE_BY_ID, GEAR_BY_ID, type Recipe } from "../../../shared/data/items.ts";
import type { ItemView } from "../../../shared/data/types.ts";
import { GameCard, ItemCard, isGear } from "../components/GameCard.tsx";
import { Button, Coins, Empty, Loading, PageHead, Panel, Tabs } from "../components/ui.tsx";
import { useAction, useData, useHero } from "../state/game.ts";

type Cost = { coins: number; materials: Record<string, number> } | null;

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
  const [tab, setTab] = useState<"upgrade" | "forge" | "craft" | "unique">(params.get("item") ? "upgrade" : "craft");
  const { hero } = useHero();
  const inv = useData<{ items: ItemView[] }>(["inventory"], "/api/inventory");
  const smithy = useData<{ recipes: Recipe[]; upgradeCosts: Record<string, Cost> }>(["smithy"], "/api/smithy");
  const [picked, setPicked] = useState<number | null>(params.get("item") ? Number(params.get("item")) : null);
  const [forgeA, setForgeA] = useState<number | null>(null);
  const [forgeB, setForgeB] = useState<number | null>(null);
  const [uniquePicked, setUniquePicked] = useState<number[]>([]);
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

  return (
    <>
      <PageHead title="Blacksmith">Upgrade gear to +10, forge two matching pieces into a rarer one, craft from materials, or sacrifice 5 Mythic pieces to synthesize supreme Unique relics.</PageHead>
      <div className="row row--wrap" style={{ marginBottom: "var(--s-4)" }}>
        {["iron_ore", "undead_bones", "silk_cloth", "dragon_scales", "mystic_gem", "star_essence"].map((m) => (
          <span key={m} className="chip"><span className="art">{CONSUMABLE_BY_ID[m]?.icon}</span>{CONSUMABLE_BY_ID[m]?.name} <b className="num">{have[m] ?? 0}</b></span>
        ))}
      </div>
      <Tabs label="Blacksmith" value={tab} onChange={setTab} options={[
        { value: "craft", label: "Craft" },
        { value: "upgrade", label: "Upgrade" },
        { value: "forge", label: "Forge" },
        { value: "unique", label: "👑 Unique Altar (5 Mythic)" },
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
      </div>
    </>
  );
}
