import { useHero } from "../state/game.ts";
import { fmt } from "../lib/format.ts";
import { GameCard } from "./GameCard.tsx";

/** The player's own card: class art, rank, power and the passive in the text box. */
export function HeroCard({ size = "xl" }: { size?: "lg" | "xl" }) {
  const { hero } = useHero();
  return (
    <GameCard
      size={size}
      rarity={hero.class.rarity}
      art={hero.class.icon}
      name={hero.name}
      cost={`Lv ${hero.level}`}
      type={<><b>{hero.class.rarity}</b> {hero.class.name}{hero.dual ? ` / ${hero.dual.name}` : ""}</>}
      text={<><b className="gold">{hero.class.passive.name}.</b> {hero.class.passive.desc}. <span className="faint">Power {fmt(hero.stats.power)}</span></>}
      atk={hero.stats.atk}
      hp={hero.maxHp}
      badge={hero.class.rank.title}
      label={`${hero.name}, level ${hero.level} ${hero.class.name}`}
    />
  );
}
