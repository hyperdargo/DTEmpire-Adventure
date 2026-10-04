import { useState } from "react";
import type { ItemView, PetView } from "../../../shared/data/types.ts";
import { CardBack, Flip, PetCard } from "../components/GameCard.tsx";
import { Bar, Button, Coins, Empty, Loading, PageHead, Panel, Sheet } from "../components/ui.tsx";
import { STAT_LABEL } from "../lib/format.ts";
import { play } from "../lib/sound.ts";
import { useAction, useData, useHero } from "../state/game.ts";

export default function PetsPage() {
  const { hero } = useHero();
  const { data, isPending } = useData<{ pets: PetView[] }>(["pets"], "/api/pets");
  const inv = useData<{ items: ItemView[] }>(["inventory"], "/api/inventory");
  const eggs = (inv.data?.items ?? []).filter((i) => i.kind === "egg");
  const xpScrolls = (inv.data?.items ?? []).find((i) => i.templateId === "xp_scroll")?.qty ?? 0;
  const [open, setOpen] = useState<number | null>(null);
  const [fusing, setFusing] = useState<number[] | null>(null);
  const [hatched, setHatched] = useState<PetView | null>(null);
  const [revealed, setRevealed] = useState(false);

  const hatch = useAction<{ itemId: number }, { pet: PetView }>("/api/inventory/use", {
    invalidate: [["pets"], ["inventory"]],
    onSuccess: (r) => {
      setHatched(r.pet);
      setRevealed(false);
      setTimeout(() => { setRevealed(true); play(["rare", "epic", "legendary", "mythic"].includes(r.pet.rarity) ? "rare" : "flip"); }, 350);
    },
  });
  const setActive = useAction<{ petId: number | null }>("/api/pets/active", { invalidate: [["pets"]], success: "Your companion is ready." });
  const release = useAction<{ petId: number }, { coins: number }>("/api/pets/release", { invalidate: [["pets"]], success: (r) => `Released. The shelter paid ${r.coins.toLocaleString()} coins.`, onSuccess: () => setOpen(null) });
  const rename = useAction<{ petId: number; name: string }>("/api/pets/rename", { invalidate: [["pets"]], success: "Renamed." });
  const toggleParty = useAction<{ petId: number }, { inParty: boolean; partyCount: number }>(
    "/api/pets/party/toggle",
    {
      invalidate: [["pets"], ["hero"]],
      success: (r) => (r.inParty ? `🐾 Companion added to your Pet Party squad!` : `🐾 Companion removed from party squad.`),
    }
  );
  const fuse = useAction<{ petIds: number[] }, { egg: string; rarity: string; unique?: boolean; pet?: PetView }>("/api/pets/fuse", {
    invalidate: [["pets"], ["inventory"]],
    success: (r) => (r.unique ? `🌟 UNIQUE ASCENSION! Summoned the supreme ${r.pet?.name || "Dragon Lord"}!` : `Fused into a ${r.egg}!`),
    onSuccess: () => setFusing(null),
  });
  const train = useAction<
    { petId: number; method: "scroll" | "coins"; mode?: "single" | "max" },
    { pet: PetView; levelsGained: number; usedScrolls: number; coinsSpent: number; newLevel: number }
  >("/api/pets/train", {
    invalidate: [["pets"], ["inventory"], ["hero"]],
    success: (r) =>
      r.levelsGained > 0
        ? `🐾 ${r.pet.name} gained ${r.levelsGained} level${r.levelsGained > 1 ? "s" : ""}! Now Lv ${r.newLevel}.`
        : `🐾 Training finished.`,
  });

  if (isPending) return <Loading rows={3} />;
  const pets = data?.pets ?? [];
  const pet = pets.find((p) => p.id === open);
  const partyPets = pets.filter((p) => p.inParty);
  const maxPartySlots = Math.min(5, Math.max(1, 1 + Math.floor((hero?.towerFloor ?? 0) / 10)));
  const fuseRarity = fusing?.length ? pets.find((p) => p.id === fusing[0])?.rarity : null;
  const targetCount = fuseRarity === "mythic" ? 10 : 3;

  return (
    <>
      <PageHead title="Pets" actions={pets.length >= 3 && <Button onClick={() => setFusing(fusing ? null : [])}>{fusing ? "Cancel fusing" : "Fuse pets"}</Button>}>
        One pet fights at your side: it adds stats and acts every third turn. Form a Pet Party Squad for +50% stat resonance and shared battle XP. Fuse 3 pets into a rarer egg, or sacrifice 10 Mythic pets to summon the supreme Unique Dragon Lord.
      </PageHead>

      <Panel title={`🐾 Pet Party Squad (${partyPets.length}/${maxPartySlots} Slots Unlocked)`}>
        <p className="faint" style={{ fontSize: "0.85rem", marginBottom: "10px" }}>
          Squad companions grant +50% passive stat resonance (HP, ATK, DEF) and earn shared battle XP. Unlocks +1 slot per 10 floors in Tower of Ascension (max 5).
        </p>
        {partyPets.length > 0 ? (
          <div className="row row--wrap" style={{ gap: "8px" }}>
            {partyPets.map((p) => (
              <div
                key={p.id}
                style={{
                  background: "#111111",
                  border: "1px solid #333333",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>{p.icon}</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#ffffff" }}>
                  {p.name} <span className="faint">(Lv {p.level})</span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => toggleParty.mutate({ petId: p.id })}>
                  ✕
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="faint" style={{ fontSize: "0.85rem" }}>
            No squad companions in your party. Select any companion below to add them to your squad.
          </p>
        )}
      </Panel>

      {eggs.length > 0 && (
        <Panel title="Eggs to hatch">
          <div className="row row--wrap">
            {eggs.map((e) => (
              <div key={e.id} className="egg">
                <span className="art" aria-hidden>{e.icon}</span>
                <div><b>{e.name}</b> <span className="faint">×{e.qty}</span><p className="faint">{e.desc}</p></div>
                <Button variant="primary" size="sm" loading={hatch.isPending} onClick={() => hatch.mutate({ itemId: e.id })}>Hatch</Button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {fusing && (
        <div className="banner banner--info" role="status">
          {fuseRarity === "mythic" ? (
            <>👑 <b>Unique Ascension:</b> Select 10 inactive Mythic pets to summon the supreme <b>Dragon Lord</b>. Selected {fusing.length}/10.</>
          ) : (
            <>Choose 3 inactive pets of the same rarity (or 10 Mythic pets for Unique Ascension). Selected {fusing.length}/{targetCount}{fuseRarity ? ` (${fuseRarity})` : ""}.</>
          )}
          <Button size="sm" variant="primary" disabled={fusing.length !== targetCount} loading={fuse.isPending} onClick={() => fuse.mutate({ petIds: fusing })}>
            {fuseRarity === "mythic" ? "Ascend Unique Pet" : "Fuse"}
          </Button>
        </div>
      )}

      {pets.length === 0 ? (
        <Empty art="🥚" title="No companions yet">Every fifth level grants a Mystery Egg, and eggs drop from monsters and bosses. The Market sells them too.</Empty>
      ) : (
        <div className="grid-cards" style={{ "--card-min": "150px", marginTop: "var(--s-5)" } as React.CSSProperties}>
          {pets.map((p) => {
            const selectable = fusing && !p.active && (!fuseRarity || p.rarity === fuseRarity);
            return (
              <PetCard key={p.id} pet={p} selected={fusing ? fusing.includes(p.id) : undefined}
                onClick={fusing ? (selectable ? () => setFusing(fusing.includes(p.id) ? fusing.filter((x) => x !== p.id) : fusing.length < targetCount ? [...fusing, p.id] : fusing) : undefined) : () => setOpen(p.id)} />
            );
          })}
        </div>
      )}

      <Sheet open={!!pet} onClose={() => setOpen(null)} title={pet?.name ?? ""}>
        {pet && (
          <div className="item-sheet">
            <PetCard pet={pet} size="lg" />
            <div className="stack">
              <Bar value={pet.xp} max={pet.xpToNext || 1} kind="xp" label={pet.xpToNext ? `Level ${pet.level} of ${pet.maxLevel}` : "Max level"} showNumbers={!!pet.xpToNext} />

              {pet.level < pet.maxLevel ? (
                <div style={{ background: "#141414", border: "1px solid #282828", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <b style={{ fontSize: "0.85rem", color: "#ddd" }}>🐾 Companion Training</b>
                    <span style={{ fontSize: "0.8rem", color: "#888" }}>Bag: <b style={{ color: "#fff" }}>{xpScrolls}</b> scrolls</span>
                  </div>
                  <div className="row row--wrap" style={{ gap: "6px" }}>
                    <Button
                      size="sm"
                      disabled={xpScrolls <= 0 || train.isPending}
                      onClick={() => train.mutate({ petId: pet.id, method: "scroll", mode: "single" })}
                    >
                      📜 Train (1 Scroll)
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={xpScrolls <= 0 || train.isPending}
                      onClick={() => train.mutate({ petId: pet.id, method: "scroll", mode: "max" })}
                    >
                      ⚡ Train to Max ({xpScrolls} Scrolls)
                    </Button>
                    <Button
                      size="sm"
                      disabled={hero.coins < Math.round(1000 * pet.level * 1.4) || train.isPending}
                      onClick={() => train.mutate({ petId: pet.id, method: "coins", mode: "single" })}
                    >
                      🪙 Train Lv ({Math.round(1000 * pet.level * 1.4).toLocaleString()}c)
                    </Button>
                  </div>
                </div>
              ) : (
                <div style={{ background: "#1c1808", border: "1px solid #ffd70044", borderRadius: "6px", padding: "8px 12px", textAlign: "center", color: "#ffd700", fontWeight: 600, fontSize: "0.85rem" }}>
                  👑 Maximum Companion Level Reached (Lv {pet.maxLevel})
                </div>
              )}

              <dl className="stats">
                {Object.entries(pet.bonus).map(([k, v]) => <div className="stat" key={k}><dt>{STAT_LABEL[k]}</dt><dd>+{v}</dd></div>)}
                <div className="stat"><dt>Power</dt><dd>{pet.power}</dd></div>
              </dl>
              <form className="row" onSubmit={(e) => { e.preventDefault(); const n = new FormData(e.currentTarget).get("name"); rename.mutate({ petId: pet.id, name: String(n) }); }}>
                <input className="input" name="name" defaultValue={pet.name} maxLength={20} aria-label="Pet name" />
                <Button type="submit">Rename</Button>
              </form>
              <div className="row row--wrap" style={{ gap: "6px" }}>
                {pet.active ? (
                  <Button onClick={() => setActive.mutate({ petId: null })}>Rest this pet</Button>
                ) : (
                  <Button variant="primary" onClick={() => setActive.mutate({ petId: pet.id })}>
                    Make active
                  </Button>
                )}
                {pet.inParty ? (
                  <Button size="sm" onClick={() => toggleParty.mutate({ petId: pet.id })}>
                    🛡️ Remove from Party
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={partyPets.length >= maxPartySlots && !pet.inParty}
                    onClick={() => toggleParty.mutate({ petId: pet.id })}
                  >
                    🛡️ Add to Party ({partyPets.length}/{maxPartySlots})
                  </Button>
                )}
                {!pet.active && !pet.inParty && (
                  <Button variant="danger" onClick={() => release.mutate({ petId: pet.id })}>
                    Release for coins
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={!!hatched} onClose={() => setHatched(null)} title="The egg cracks open">
        {hatched && (
          <div className="stack" style={{ justifyItems: "center", textAlign: "center" }}>
            <Flip revealed={revealed} back={<CardBack size="lg" />}><PetCard pet={hatched} size="lg" /></Flip>
            {revealed && <p>A <b className={`rarity-text r-${hatched.rarity}`}>{hatched.rarity}</b> {hatched.name}{hatched.active ? " joins you as your active companion." : " joins your menagerie."}</p>}
            <Button variant="primary" onClick={() => setHatched(null)}>Wonderful</Button>
          </div>
        )}
      </Sheet>
      <p className="faint" style={{ marginTop: "var(--s-5)" }}>Released pets pay <Coins value={60} compact /> and up, more for rarer and higher-level pets.</p>
    </>
  );
}
