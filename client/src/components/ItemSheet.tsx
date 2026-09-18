import { Hammer, Lock, LockOpen, Recycle, Shirt, Sparkles } from "lucide-react";
import { useNavigate } from "react-router";
import { CONSUMABLE_BY_ID } from "../../../shared/data/items.ts";
import type { ItemView } from "../../../shared/data/types.ts";
import { STAT_LABEL, fmt, statValue } from "../lib/format.ts";
import { useAction, useHero } from "../state/game.ts";
import { ItemCard, isGear } from "./GameCard.tsx";
import { Button, Coins, Sheet } from "./ui.tsx";

/** Everything you can do with one item, with a comparison against what's equipped in that slot. */
export function ItemSheet({ item, items, onClose }: { item: ItemView | null; items: ItemView[]; onClose: () => void }) {
  const { hero } = useHero();
  const navigate = useNavigate();
  const inv = [["inventory"]];
  const equip = useAction<{ itemId: number }>("/api/inventory/equip", { invalidate: inv, success: "Equipped.", onSuccess: onClose });
  const unequip = useAction<{ slot: string }>("/api/inventory/unequip", { invalidate: inv, success: "Unequipped.", onSuccess: onClose });
  const lock = useAction<{ itemId: number; locked: boolean }>("/api/inventory/lock", { invalidate: inv });
  const sell = useAction<{ itemId: number; qty: number }, { coins: number }>("/api/inventory/sell", { invalidate: inv, success: (r) => `Sold for ${fmt(r.coins)} coins.`, onSuccess: onClose });
  const salvage = useAction<{ itemId: number }, { materials: Record<string, number> }>("/api/inventory/salvage", {
    invalidate: inv, onSuccess: onClose,
    success: (r) => `Salvaged into ${Object.entries(r.materials).map(([m, q]) => `${q} ${CONSUMABLE_BY_ID[m]?.name ?? m}`).join(", ")}.`,
  });
  const use = useAction<{ itemId: number }, { kind: string; healed?: number; xp?: number; skill?: string; rank?: number; learned?: boolean; pet?: { name: string; rarity: string } }>("/api/inventory/use", {
    invalidate: [["inventory"], ["pets"], ["skills"]], onSuccess: onClose,
    success: (r) =>
      r.kind === "pet" ? `Hatched a ${r.pet!.rarity} ${r.pet!.name}!`
      : r.kind === "skill" ? (r.learned ? `Learned ${r.skill}!` : r.skill ? `${r.skill} rose to rank ${r.rank}.` : "You know everything the book could teach. It sold for 2,500 coins.")
      : [r.healed ? `+${fmt(r.healed)} HP` : "", r.xp ? `+${fmt(r.xp)} XP` : ""].filter(Boolean).join(" · ") || "Used.",
  });

  if (!item) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;
  const gear = isGear(item);
  const worn = gear ? items.find((i) => i.equipped && i.kind === item.kind && i.id !== item.id) : undefined;
  const statKeys = Array.from(new Set([...Object.keys(item.stats), ...Object.keys(worn?.stats ?? {})]));
  const tooLow = hero.level < item.levelReq;
  const consumable = CONSUMABLE_BY_ID[item.templateId];
  const usable = consumable && (consumable.kind === "potion" || consumable.kind === "egg" || consumable.kind === "book");

  return (
    <Sheet open onClose={onClose} title={item.name} wide>
      <div className="item-sheet">
        <ItemCard item={item} size="lg" />
        <div className="stack">
          <p className="muted">{item.desc}</p>
          {gear && (
            <dl className="stats">
              {statKeys.map((k) => {
                const mine = item.stats[k as keyof typeof item.stats] ?? 0;
                const theirs = worn?.stats[k as keyof typeof worn.stats] ?? 0;
                const diff = Math.round((mine - theirs) * 10) / 10;
                return (
                  <div className="stat" key={k}>
                    <dt>{STAT_LABEL[k] ?? k}</dt>
                    <dd>{statValue(k, mine)} {worn && diff !== 0 && <span className={diff > 0 ? "up" : "down"}>({diff > 0 ? "+" : ""}{statValue(k, diff)})</span>}</dd>
                  </div>
                );
              })}
            </dl>
          )}
          {gear && worn && <p className="faint">Compared with your equipped {worn.name}.</p>}
          {item.affixes.length > 0 && <p className="faint">{item.affixes.length} enchantment{item.affixes.length > 1 ? "s" : ""} included above.</p>}
          {tooLow && <p className="field-error">Requires level {item.levelReq}.</p>}
          <p className="faint">Sells for <Coins value={item.sellPrice} compact />{item.qty > 1 ? " each" : ""}.</p>

          <div className="row row--wrap">
            {gear && !item.equipped && <Button variant="primary" icon={<Shirt size={16} />} disabled={tooLow} loading={equip.isPending} onClick={() => equip.mutate({ itemId: item.id })}>Equip</Button>}
            {gear && item.equipped && <Button onClick={() => unequip.mutate({ slot: item.kind })}>Unequip</Button>}
            {usable && <Button variant="primary" icon={<Sparkles size={16} />} disabled={tooLow} loading={use.isPending} onClick={() => use.mutate({ itemId: item.id })}>{consumable.kind === "egg" ? "Hatch" : consumable.kind === "book" ? "Read" : "Drink"}</Button>}
            {gear && <Button icon={<Hammer size={16} />} onClick={() => navigate(`/smithy?item=${item.id}`)}>Upgrade</Button>}
            <Button variant="ghost" icon={item.locked ? <LockOpen size={16} /> : <Lock size={16} />} onClick={() => lock.mutate({ itemId: item.id, locked: !item.locked })}>{item.locked ? "Unlock" : "Lock"}</Button>
          </div>
          {!item.equipped && !item.locked && (
            <div className="row row--wrap">
              <Button variant="danger" loading={sell.isPending} onClick={() => sell.mutate({ itemId: item.id, qty: 1 })}>Sell {item.qty > 1 ? "one" : ""}</Button>
              {item.qty > 1 && <Button variant="danger" onClick={() => sell.mutate({ itemId: item.id, qty: item.qty })}>Sell all {item.qty}</Button>}
              {gear && <Button variant="danger" icon={<Recycle size={16} />} loading={salvage.isPending} onClick={() => salvage.mutate({ itemId: item.id })}>Salvage</Button>}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
