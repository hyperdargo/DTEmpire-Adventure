import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { ItemView } from "../../../shared/data/types.ts";
import { ItemCard, isGear } from "../components/GameCard.tsx";
import { ItemSheet } from "../components/ItemSheet.tsx";
import { Button, Empty, Loading, PageHead, Sheet, Tabs } from "../components/ui.tsx";
import { fmt } from "../lib/format.ts";
import { useAction, useData, useHero } from "../state/game.ts";

type Filter = "all" | "gear" | "potion" | "material" | "egg";
type Sort = "newest" | "power" | "rarity";
const RARITY_RANK: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, unique: 6 };

export default function BagPage() {
  const { hero } = useHero();
  const { data, isPending } = useData<{ items: ItemView[] }>(["inventory"], "/api/inventory");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [open, setOpen] = useState<number | null>(null);
  const [bulk, setBulk] = useState(false);
  const bulkAction = useAction<{ mode: "sell" | "salvage"; maxRarity: string }, { count: number; coins: number }>("/api/inventory/bulk", {
    invalidate: [["inventory"]], onSuccess: () => setBulk(false),
    success: (r) => (r.count ? `Cleared ${r.count} item${r.count > 1 ? "s" : ""}${r.coins ? ` for ${fmt(r.coins)} coins` : ""}.` : "Nothing matched."),
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const shown = useMemo(() => {
    const list = items.filter((i) => filter === "all" || (filter === "gear" ? isGear(i) : i.kind === filter || (filter === "potion" && i.kind === "book")));
    return [...list].sort((a, b) =>
      sort === "power" ? b.power - a.power : sort === "rarity" ? RARITY_RANK[b.rarity]! - RARITY_RANK[a.rarity]! || b.power - a.power : Number(b.equipped) - Number(a.equipped) || b.id - a.id,
    );
  }, [items, filter, sort]);
  const selected = items.find((i) => i.id === open) ?? null;

  if (isPending) return <Loading rows={4} />;
  const count = (f: Filter) => items.filter((i) => (f === "gear" ? isGear(i) : i.kind === f)).length;

  return (
    <>
      <PageHead title="Bag" actions={<Button onClick={() => setBulk(true)}>Clear out gear</Button>}>
        {fmt(hero.bag.used)} of {fmt(hero.bag.capacity)} slots used. Bags grow as you level; when full, new gear sells automatically.
      </PageHead>
      <div className="row row--between row--wrap" style={{ marginBottom: "var(--s-5)" }}>
        <Tabs label="Filter" value={filter} onChange={setFilter} options={[
          { value: "all", label: "All" }, { value: "gear", label: `Gear · ${count("gear")}` }, { value: "potion", label: "Potions & tomes" },
          { value: "material", label: "Materials" }, { value: "egg", label: `Eggs${count("egg") ? ` · ${count("egg")}` : ""}` },
        ]} />
        <label className="row">
          <span className="faint">Sort</span>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ width: "auto" }}>
            <option value="newest">Newest</option>
            <option value="power">Power</option>
            <option value="rarity">Rarity</option>
          </select>
        </label>
      </div>
      {shown.length === 0 ? (
        <Empty art="🎒" title="Nothing here yet" action={<Link className="btn btn--primary" to="/">Draw an encounter</Link>}>Monsters drop gear, potions, materials and the occasional egg.</Empty>
      ) : (
        <div className="grid-cards" style={{ "--card-min": "150px" } as React.CSSProperties}>
          {shown.map((i) => <ItemCard key={i.id} item={i} onClick={() => setOpen(i.id)} />)}
        </div>
      )}
      <ItemSheet item={selected} items={items} onClose={() => setOpen(null)} />
      <Sheet open={bulk} onClose={() => setBulk(false)} title="Clear out gear">
        <div className="stack">
          <p className="muted">Removes every gear piece that is not equipped or locked, up to the rarity you choose. Lock anything you want to keep first.</p>
          {(["common", "uncommon", "rare"] as const).map((r) => (
            <div key={r} className="row row--wrap">
              <span className={`chip chip--rarity r-${r}`} style={{ minWidth: 150 }}>{r} and below</span>
              <Button size="sm" variant="danger" loading={bulkAction.isPending} onClick={() => bulkAction.mutate({ mode: "sell", maxRarity: r })}>Sell</Button>
              <Button size="sm" variant="danger" loading={bulkAction.isPending} onClick={() => bulkAction.mutate({ mode: "salvage", maxRarity: r })}>Salvage</Button>
            </div>
          ))}
        </div>
      </Sheet>
    </>
  );
}
