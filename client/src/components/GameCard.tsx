import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from "react";
import type { ItemView, PetView, Rarity } from "../../../shared/data/types.ts";
import { fmtCompact } from "../lib/format.ts";

const FOIL = new Set<Rarity>(["rare", "epic", "legendary", "mythic", "unique"]);

export interface GameCardProps {
  rarity: Rarity | string;
  art: string;
  name: ReactNode;
  type?: ReactNode;
  text?: ReactNode;
  cost?: ReactNode;
  atk?: number;
  hp?: number;
  def?: number;
  level?: number;
  badge?: ReactNode;
  badgeRight?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  selected?: boolean;
  disabled?: boolean;
  equipped?: boolean;
  onClick?: () => void;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

function trackFoil(e: PointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
  el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
}

/** The single card component every collectible in the game is drawn with. */
export function GameCard(p: GameCardProps) {
  const foil = FOIL.has(p.rarity as Rarity);
  const interactive = !!p.onClick;
  const cls = [
    "card", `card--${p.size ?? "md"}`, `r-${p.rarity}`, foil && "card--foil", interactive && "card--interactive",
    p.selected && "card--selected", p.disabled && "card--disabled", p.equipped && "card--equipped", p.className,
  ].filter(Boolean).join(" ");
  const onKey = (e: KeyboardEvent) => {
    if (interactive && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      p.onClick!();
    }
  };
  return (
    <article
      className={cls}
      style={p.style}
      onPointerMove={foil ? trackFoil : undefined}
      onClick={p.onClick}
      onKeyDown={onKey}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive && p.selected !== undefined ? p.selected : undefined}
      aria-label={p.label}
    >
      <div className="card__face">
        <div className="card__name">
          <span>{p.name}</span>
          {p.cost != null && <span className="card__cost">{p.cost}</span>}
        </div>
        <div className="card__art">
          <span className="art" aria-hidden>{p.art}</span>
          {p.badge && <span className="card__badge">{p.badge}</span>}
          {p.badgeRight && <span className="card__badge card__badge--right">{p.badgeRight}</span>}
        </div>
        {p.type && <div className="card__type">{p.type}</div>}
        <div className="card__text">{p.text}</div>
      </div>
      {(p.atk != null || p.hp != null || p.def != null || p.level != null) && (
        <div className="card__gems" aria-hidden>
          {p.atk != null ? <span className="gem gem--atk">{fmtCompact(p.atk)}</span> : p.level != null ? <span className="gem gem--lvl">{p.level}</span> : <span />}
          {p.def != null && p.hp == null ? <span className="gem gem--def">{fmtCompact(p.def)}</span> : null}
          {p.hp != null ? <span className="gem gem--hp">{fmtCompact(p.hp)}</span> : p.def == null ? <span /> : null}
        </div>
      )}
    </article>
  );
}

export function CardBack({ size = "md", label, onClick }: { size?: GameCardProps["size"]; label?: string; onClick?: () => void }) {
  return (
    <article
      className={`card card--${size} card--back${onClick ? " card--interactive" : ""}`}
      aria-label={label ?? "Face-down card"}
      role={onClick ? "button" : "img"}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="card__face" />
    </article>
  );
}

/** Face-down card that turns over to reveal its face. */
export function Flip({ revealed, back, children }: { revealed: boolean; back: ReactNode; children: ReactNode }) {
  return (
    <div className={`flip${revealed ? " flip--revealed" : ""}`}>
      <div className="flip__inner">
        {back}
        {children}
      </div>
    </div>
  );
}

const SLOT_LABEL: Record<string, string> = {
  weapon: "Weapon", armor: "Armor", helmet: "Helm", boots: "Boots", accessory: "Relic",
  potion: "Potion", material: "Material", egg: "Egg", book: "Tome",
};

export const isGear = (i: ItemView) => ["weapon", "armor", "helmet", "boots", "accessory"].includes(i.kind);

export function itemTypeLine(i: ItemView) {
  if (isGear(i)) {
    return (
      <>
        <b>{i.rarity}</b> {SLOT_LABEL[i.kind]}{i.weaponType ? ` · ${i.weaponType}` : ""} · iL{i.ilvl}
      </>
    );
  }
  return <>{SLOT_LABEL[i.kind] ?? i.kind}{i.levelReq > 1 ? ` · Lv ${i.levelReq}` : ""}</>;
}

export function ItemCard({ item, size = "md", onClick, selected, disabled }: { item: ItemView; size?: GameCardProps["size"]; onClick?: () => void; selected?: boolean; disabled?: boolean }) {
  const gear = isGear(item);
  const text = gear
    ? Object.entries(item.stats).filter(([k]) => !["atk", "def", "hp"].includes(k)).slice(0, 3)
        .map(([k, v]) => `+${v}${["crit", "critDmg", "dodge", "lifesteal", "luck", "xpBonus"].includes(k) ? "%" : ""} ${k === "critDmg" ? "crit dmg" : k === "xpBonus" ? "XP" : k}`).join(" · ") || item.desc
    : item.desc;
  return (
    <GameCard
      size={size}
      rarity={item.rarity}
      art={item.icon}
      name={<>{item.name}{item.upgrade > 0 && <span className="gold"> +{item.upgrade}</span>}</>}
      type={itemTypeLine(item)}
      text={text}
      atk={gear && item.stats.atk ? item.stats.atk : undefined}
      def={gear && item.stats.def && !item.stats.hp ? item.stats.def : undefined}
      hp={gear && item.stats.hp ? item.stats.hp : undefined}
      badge={!gear && item.qty > 1 ? `×${item.qty}` : item.equipped ? "Worn" : item.locked ? "Locked" : undefined}
      equipped={item.equipped}
      onClick={onClick}
      selected={selected}
      disabled={disabled}
      label={`${item.name}, ${item.rarity} ${item.kind}${item.qty > 1 ? `, ${item.qty} owned` : ""}`}
    />
  );
}

export function PetCard({ pet, size = "md", onClick, selected }: { pet: PetView; size?: GameCardProps["size"]; onClick?: () => void; selected?: boolean }) {
  const abilityText = { strike: "Strikes every 3rd turn.", mend: "Heals you every 3rd turn.", ward: "Shields you every 3rd turn." }[pet.ability];
  return (
    <GameCard
      size={size}
      rarity={pet.rarity}
      art={pet.icon}
      name={pet.name}
      type={<><b>{pet.rarity}</b> Pet · Lv {pet.level}/{pet.maxLevel}</>}
      text={abilityText}
      level={pet.level}
      badge={pet.active ? "Active" : undefined}
      onClick={onClick}
      selected={selected}
      label={`${pet.name}, ${pet.rarity} pet, level ${pet.level}`}
    />
  );
}
