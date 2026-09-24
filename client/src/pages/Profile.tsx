import { useState } from "react";
import { Ban, MessageCircle, Swords, Handshake, UserPlus } from "lucide-react";
import { Link, useParams } from "react-router";
import type { ItemView, PetView } from "../../../shared/data/types.ts";
import { GameCard, ItemCard, PetCard } from "../components/GameCard.tsx";
import { Button, Empty, Loading, PageHead, Panel } from "../components/ui.tsx";
import { GuildSheet } from "../components/GuildSheet.tsx";
import { STAT_LABEL, fmt, statValue, timeAgo } from "../lib/format.ts";
import { useAction, useData, useHero } from "../state/game.ts";
import { useChallenge, useDirectMessage } from "./Friends.tsx";

interface Profile {
  userId: number; name: string; title: string; bio: string | null; avatar: string | null; level: number;
  class: { id: string; name: string; icon: string; rarity: string; passive: { name: string; desc: string } };
  dual: { name?: string; icon?: string; level: number } | null;
  stats: Record<string, number>; power: number; towerFloor: number; dungeonBest: number; arenaRating: number;
  counters: Record<string, number>; achievements: number; achievementsTotal: number;
  equipped: ItemView[]; pet: PetView | null; guild: { id: number; name: string; tag: string; emblem: string } | null;
  online: boolean; lastSeenAt: number; createdAt: number; relation: "self" | "friend" | "outgoing" | "incoming" | "none"; blocked: boolean;
}

const BOT_NAMES = new Set([
  "Aria_Dawnseeker", "Seraphina_Vane", "Theron_Shieldheart", "Brant_Oakhaven", "Lyra_Starweaver",
  "Kaelen_Voidstrider", "Valen_Ironbark", "Zephyr_Shadowstep", "Morwenna_Frost", "Garrick_Flamehand"
]);

export default function ProfilePage() {
  const { name = "" } = useParams();
  const { hero } = useHero();
  const [selectedGuildId, setSelectedGuildId] = useState<number | null>(null);
  const { data, isPending, isError } = useData<Profile>(["profile", name], `/api/players/${encodeURIComponent(name)}`);
  const add = useAction<{ userId: number }>("/api/friends/request", { invalidate: [["profile", name]], success: "Friend request sent." });
  const block = useAction<{ userId: number; blocked: boolean }>("/api/block", { invalidate: [["profile", name]], success: "Updated." });
  const dm = useDirectMessage();
  const challenge = useChallenge();

  if (isPending) return <Loading rows={3} />;
  if (isError || !data) return <Empty art="🔍" title="No hero by that name" action={<Link className="btn" to="/ranks">Browse the leaderboards</Link>} />;
  const p = data;
  const self = p.relation === "self";

  return (
    <>
      <PageHead title={p.name} actions={!self && (
        <>
          <Button icon={<MessageCircle size={16} />} onClick={() => void dm(p.userId)} disabled={p.blocked}>Message</Button>
          {p.relation === "none" && <Button icon={<UserPlus size={16} />} onClick={() => add.mutate({ userId: p.userId })}>Add friend</Button>}
          {(p.online || BOT_NAMES.has(p.name)) && hero.level >= 5 && <Button icon={<Swords size={16} />} onClick={() => void challenge(p.userId, p.name)}>Duel now</Button>}
          <Link className="btn" to={`/trade?to=${p.userId}&name=${encodeURIComponent(p.name)}`}><Handshake size={16} aria-hidden /> Trade</Link>
          <Button variant="ghost" icon={<Ban size={16} />} onClick={() => block.mutate({ userId: p.userId, blocked: !p.blocked })}>{p.blocked ? "Unblock" : "Block"}</Button>
        </>
      )}>
        {p.title}{p.guild ? (
          <>
            {" "}of{" "}
            <button
              type="button"
              className="link faint"
              style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}
              title="View Clan & Members"
              onClick={() => setSelectedGuildId(p.guild!.id)}
            >
              <span className="art">{p.guild.emblem}</span> <b>{p.guild.name}</b> [{p.guild.tag}]
            </button>
          </>
        ) : null} · {p.online ? "online now" : `seen ${timeAgo(p.lastSeenAt)}`}
      </PageHead>
      <div className="profile">
        <div className="stack">
          <GameCard size="xl" rarity={p.class.rarity} art={p.class.icon} name={p.name} cost={`Lv ${p.level}`}
            type={<><b>{p.class.rarity}</b> {p.class.name}{p.dual ? ` / ${p.dual.name}` : ""}</>} text={p.bio ?? `${p.class.passive.name}: ${p.class.passive.desc}.`} atk={p.stats.atk} hp={p.stats.maxHp} />
          {p.avatar && <img className="profile__avatar" src={p.avatar} alt={`${p.name}'s portrait`} width={96} height={96} />}
        </div>
        <div className="stack stack--lg">
          <Panel title="Record">
            <dl className="stats">
              <div className="stat"><dt>Power</dt><dd className="gold">{fmt(p.power)}</dd></div>
              <div className="stat"><dt>Tower floor</dt><dd>{p.towerFloor}</dd></div>
              <div className="stat"><dt>Deepest dungeon</dt><dd>{p.dungeonBest}</dd></div>
              <div className="stat"><dt>Arena rating</dt><dd>{fmt(p.arenaRating)}</dd></div>
              <div className="stat"><dt>Monsters slain</dt><dd>{fmt(p.counters.kills ?? 0)}</dd></div>
              <div className="stat"><dt>Bosses slain</dt><dd>{fmt(p.counters.bossKills ?? 0)}</dd></div>
              <div className="stat"><dt>Achievements</dt><dd>{p.achievements}/{p.achievementsTotal}</dd></div>
              <div className="stat"><dt>Joined</dt><dd>{new Date(p.createdAt).toLocaleDateString()}</dd></div>
            </dl>
          </Panel>
          <Panel title="Stats">
            <dl className="stats">
              {["atk", "def", "spd", "crit", "critDmg", "dodge", "lifesteal"].map((k) => <div className="stat" key={k}><dt>{STAT_LABEL[k]}</dt><dd>{statValue(k, p.stats[k] ?? 0)}</dd></div>)}
            </dl>
          </Panel>
          <Panel title="Equipped">
            {p.equipped.length === 0 ? <p className="muted">Nothing equipped.</p> : (
              <div className="row row--wrap">{p.equipped.map((i) => <ItemCard key={i.id} item={i} size="sm" />)}{p.pet && <PetCard pet={p.pet} size="sm" />}</div>
            )}
          </Panel>
        </div>
      </div>
      <GuildSheet guildId={selectedGuildId} onClose={() => setSelectedGuildId(null)} />
    </>
  );
}
