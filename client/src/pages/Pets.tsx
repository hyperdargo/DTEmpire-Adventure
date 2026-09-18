import { useState } from "react";
import type { ItemView, PetView } from "../../../shared/data/types.ts";
import { CardBack, Flip, PetCard } from "../components/GameCard.tsx";
import { Bar, Button, Coins, Empty, Loading, PageHead, Panel, Sheet } from "../components/ui.tsx";
import { STAT_LABEL } from "../lib/format.ts";
import { play } from "../lib/sound.ts";
import { useAction, useData } from "../state/game.ts";

export default function PetsPage() {
  const { data, isPending } = useData<{ pets: PetView[] }>(["pets"], "/api/pets");
  const inv = useData<{ items: ItemView[] }>(["inventory"], "/api/inventory");
  const eggs = (inv.data?.items ?? []).filter((i) => i.kind === "egg");
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
  const fuse = useAction<{ petIds: number[] }, { egg: string; rarity: string }>("/api/pets/fuse", { invalidate: [["pets"], ["inventory"]], success: (r) => `Fused into a ${r.egg}!`, onSuccess: () => setFusing(null) });

  if (isPending) return <Loading rows={3} />;
  const pets = data?.pets ?? [];
  const pet = pets.find((p) => p.id === open);
  const fuseRarity = fusing?.length ? pets.find((p) => p.id === fusing[0])?.rarity : null;

  return (
    <>
      <PageHead title="Pets" actions={pets.length >= 3 && <Button onClick={() => setFusing(fusing ? null : [])}>{fusing ? "Cancel fusing" : "Fuse pets"}</Button>}>
        One pet fights at your side: it adds stats and acts every third turn. Pets grow with your battles. Fuse three of the same rarity into an egg of the next.
      </PageHead>

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
          Choose three inactive pets of the same rarity. Selected {fusing.length}/3{fuseRarity ? ` (${fuseRarity})` : ""}.
          <Button size="sm" variant="primary" disabled={fusing.length !== 3} loading={fuse.isPending} onClick={() => fuse.mutate({ petIds: fusing })}>Fuse</Button>
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
                onClick={fusing ? (selectable ? () => setFusing(fusing.includes(p.id) ? fusing.filter((x) => x !== p.id) : fusing.length < 3 ? [...fusing, p.id] : fusing) : undefined) : () => setOpen(p.id)} />
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
              <dl className="stats">
                {Object.entries(pet.bonus).map(([k, v]) => <div className="stat" key={k}><dt>{STAT_LABEL[k]}</dt><dd>+{v}</dd></div>)}
                <div className="stat"><dt>Power</dt><dd>{pet.power}</dd></div>
              </dl>
              <form className="row" onSubmit={(e) => { e.preventDefault(); const n = new FormData(e.currentTarget).get("name"); rename.mutate({ petId: pet.id, name: String(n) }); }}>
                <input className="input" name="name" defaultValue={pet.name} maxLength={20} aria-label="Pet name" />
                <Button type="submit">Rename</Button>
              </form>
              <div className="row row--wrap">
                {pet.active ? <Button onClick={() => setActive.mutate({ petId: null })}>Rest this pet</Button> : <Button variant="primary" onClick={() => setActive.mutate({ petId: pet.id })}>Make active</Button>}
                {!pet.active && <Button variant="danger" onClick={() => release.mutate({ petId: pet.id })}>Release for coins</Button>}
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
