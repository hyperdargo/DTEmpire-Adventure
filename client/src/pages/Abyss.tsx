import { Compass, Sparkles, Trophy } from "lucide-react";
import { useState } from "react";
import { Bar, Button, Empty, Loading, PageHead, Panel, Tabs } from "../components/ui.tsx";
import { fmt } from "../lib/format.ts";
import { useAction, useData, useHero } from "../state/game.ts";
import { useStartBattle } from "./Table.tsx";

interface BoonView {
  id: string;
  name: string;
  desc: string;
  icon: string;
}

interface NextFoeView {
  level: number;
  tier: "normal" | "elite" | "boss";
  def: {
    name: string;
    art: string;
    role: string;
    desc: string;
  };
}

interface AbyssRunView {
  wave: number;
  hp: number;
  maxHp: number;
  corruption: number;
  shards: number;
  boons: BoonView[];
  pendingBoons: BoonView[] | null;
  nextFoe: NextFoeView;
}

interface AbyssShopEntryView {
  id: string;
  name: string;
  icon: string;
  desc: string;
  kind: "gear" | "stack" | "title";
  ref: string;
  price: number;
  minWave: number;
}

interface LeaderboardEntry {
  userId: number;
  name: string;
  avatar?: string | null;
  abyssBest: number;
  level: number;
}

interface AbyssView {
  minLevel: number;
  unlocked: boolean;
  bestWave: number;
  shardsOwned: number;
  run: AbyssRunView | null;
  shop: AbyssShopEntryView[];
  leaderboard: LeaderboardEntry[];
}

export default function AbyssPage() {
  const { hero, activeBattle } = useHero();
  const { data, isPending } = useData<AbyssView>(["abyss"], "/api/abyss");
  const [tab, setTab] = useState<"dive" | "shop" | "leaders">("dive");

  const startRun = useAction("/api/abyss/start", { invalidate: [["abyss"]] });
  const fight = useStartBattle("/api/abyss/fight", [["abyss"]]);
  const pickBoon = useAction<{ boonId: string }>("/api/abyss/boon", {
    invalidate: [["abyss"]],
    success: "Infusion absorbed into your soul.",
  });
  const leave = useAction("/api/abyss/leave", {
    invalidate: [["abyss"], ["inventory"]],
    success: (r) => {
      const x = r as { shards: number };
      return `Surfaced safely! Banked ${fmt(x.shards)} Abyssal Shards.`;
    },
  });
  const buyShop = useAction<{ shopId: string }>("/api/abyss/buy", {
    invalidate: [["abyss"], ["inventory"], ["me"]],
    success: "Relic claimed from the void.",
  });

  if (hero.level < 15) {
    return (
      <Empty art="🌌" title="The Endless Abyss unlocks at Level 15">
        Only hardened adventurers may gaze into the eternal void. Hone your blade and reach level 15 first.
      </Empty>
    );
  }

  if (isPending || !data) return <Loading rows={4} />;

  const run = data.run;

  return (
    <>
      <PageHead title="Endless Abyss">
        A descent into infinite void waves. Natural health regeneration is silenced; only a surge of vitality returns on victory. Foes grow corrupted every 3 waves (+5% power), while eldritch infusions are offered every 5 waves. Surface at any time to bank your gathered shards, or risk annihilation.
      </PageHead>

      <div className="row row--wrap row--between" style={{ marginBottom: "var(--s-4)" }}>
        <div className="row row--wrap" style={{ gap: "var(--s-2)" }}>
          <span className="chip chip--gold">
            <Trophy size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
            Deepest Wave: {data.bestWave}
          </span>
          <span className="chip">
            <span className="art" style={{ marginRight: 4 }}>🌌</span>
            {fmt(data.shardsOwned)} Banked Shards
          </span>
        </div>
        <Tabs
          value={tab}
          onChange={setTab}
          label="Abyss navigation"
          options={[
            { value: "dive", label: run ? `Wave ${run.wave} (Active)` : "The Descent" },
            { value: "shop", label: `Void Relic Shop (${data.shop.length})` },
            { value: "leaders", label: "Deepest Divers" },
          ]}
        />
      </div>

      {tab === "dive" && (
        <>
          {!run ? (
            <Panel title="Plunge into the Infinite Void">
              <div style={{ display: "grid", gap: "var(--s-3)", maxWidth: 640 }}>
                <p className="muted">
                  The Abyss tests how far your build can survive without leaving. Prepare your potions, equip your highest affixes, and step past the veil of existence.
                </p>
                <div className="card" style={{ padding: "var(--s-3)", background: "var(--surface-muted, #141414)" }}>
                  <h4 style={{ margin: "0 0 var(--s-2) 0" }}>Void Conditions</h4>
                  <ul style={{ margin: 0, paddingLeft: "1.2rem", display: "grid", gap: "var(--s-1)" }} className="faint">
                    <li><b>No Resting:</b> Health carries over between waves (+15% max HP restored per victory).</li>
                    <li><b>Void Corruption:</b> +5% foe stats every 3 waves.</li>
                    <li><b>Abyssal Infusions:</b> Select powerful game-altering boons every 5 waves.</li>
                    <li><b>Shard Preservation:</b> Retain 100% shards by surfacing manually, or 50% if fallen in combat.</li>
                  </ul>
                </div>
                <div style={{ marginTop: "var(--s-2)" }}>
                  <Button
                    variant="primary"
                    size="lg"
                    icon={<Compass size={20} />}
                    loading={startRun.isPending}
                    disabled={!!activeBattle}
                    onClick={() => startRun.mutate({})}
                  >
                    Descend into Wave 1
                  </Button>
                </div>
              </div>
            </Panel>
          ) : (
            <div style={{ display: "grid", gap: "var(--s-4)" }}>
              <Panel>
                <div className="row row--between row--wrap" style={{ marginBottom: "var(--s-3)" }}>
                  <div>
                    <h2 style={{ margin: 0 }}>
                      Wave {run.wave}
                      {run.wave % 10 === 0 && <span className="chip chip--red" style={{ marginLeft: "var(--s-2)" }}>Void Monarch</span>}
                      {run.wave % 10 !== 0 && run.wave % 5 === 0 && <span className="chip chip--gold" style={{ marginLeft: "var(--s-2)" }}>Elite Voidling</span>}
                    </h2>
                    <span className="faint">Descent in progress · Banked this run: <b>{run.shards} Shards</b></span>
                  </div>
                  <div className="row" style={{ gap: "var(--s-2)" }}>
                    <span className="chip">
                      ☣️ Corruption +{run.corruption * 5}%
                    </span>
                    <span className="chip chip--gold">
                      ✨ {run.boons.length} Infusions
                    </span>
                  </div>
                </div>

                <div style={{ marginBottom: "var(--s-4)" }}>
                  <Bar
                    value={run.hp}
                    max={run.maxHp}
                    kind="hp"
                    label="Soul Vitality (silenced natural regeneration)"
                    showNumbers
                    size="lg"
                  />
                </div>

                {run.pendingBoons && run.pendingBoons.length > 0 ? (
                  <div className="card" style={{ padding: "var(--s-4)", border: "1px solid var(--accent, #d4af37)", background: "rgba(212, 175, 55, 0.04)" }}>
                    <div style={{ marginBottom: "var(--s-3)" }}>
                      <h3 style={{ margin: 0 }}>🔮 Choose an Abyssal Infusion</h3>
                      <p className="faint" style={{ margin: "var(--s-1) 0 0 0" }}>
                        Wave {run.wave - 1} cleared! Absorb one eldritch blessing to augment your character for the rest of this dive.
                      </p>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--s-3)" }}>
                      {run.pendingBoons.map((b) => (
                        <div
                          key={b.id}
                          className="card"
                          style={{
                            padding: "var(--s-3)",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            border: "1px solid var(--border, #333)",
                            background: "var(--surface, #181818)",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: "1.8rem", marginBottom: "var(--s-2)" }}>{b.icon}</div>
                            <h4 style={{ margin: "0 0 var(--s-1) 0" }}>{b.name}</h4>
                            <p className="faint" style={{ fontSize: "0.85rem", lineHeight: 1.4 }}>{b.desc}</p>
                          </div>
                          <div style={{ marginTop: "var(--s-3)" }}>
                            <Button
                              variant="primary"
                              size="sm"
                              loading={pickBoon.isPending}
                              onClick={() => pickBoon.mutate({ boonId: b.id })}
                            >
                              Infuse Soul
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "var(--s-4)" }}>
                    <div className="card" style={{ padding: "var(--s-4)", background: "var(--surface-muted, #141414)" }}>
                      <div className="row row--between row--wrap">
                        <div className="row" style={{ gap: "var(--s-3)" }}>
                          <span style={{ fontSize: "2.4rem" }}>{run.nextFoe.def.art}</span>
                          <div>
                            <div className="row" style={{ gap: "var(--s-2)" }}>
                              <h3 style={{ margin: 0 }}>{run.nextFoe.def.name}</h3>
                              <span className="chip">Lv {run.nextFoe.level}</span>
                              <span className="chip chip--gold">{run.nextFoe.def.role}</span>
                            </div>
                            <p className="faint" style={{ margin: "var(--s-1) 0 0 0", fontSize: "0.85rem" }}>
                              {run.nextFoe.def.desc}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="row row--wrap" style={{ gap: "var(--s-3)" }}>
                      <Button
                        variant="primary"
                        size="lg"
                        icon={<Sparkles size={20} />}
                        loading={fight.isPending}
                        disabled={!!activeBattle}
                        onClick={() => fight.mutate({})}
                      >
                        {run.wave % 10 === 0
                          ? `Confront Void Monarch (Wave ${run.wave})`
                          : run.wave % 5 === 0
                          ? `Engage Elite Voidling (Wave ${run.wave})`
                          : `Engage Wave ${run.wave}`}
                      </Button>
                      <Button
                        size="lg"
                        loading={leave.isPending}
                        disabled={!!activeBattle}
                        onClick={() => {
                          if (window.confirm(`Surface now and safely bank ${run.shards} Abyssal Shards?`)) {
                            leave.mutate({});
                          }
                        }}
                      >
                        Surface & Bank {run.shards} Shards
                      </Button>
                    </div>
                  </div>
                )}
              </Panel>

              {run.boons.length > 0 && (
                <Panel title={`Active Infusions (${run.boons.length})`}>
                  <div className="row row--wrap" style={{ gap: "var(--s-2)" }}>
                    {run.boons.map((b) => (
                      <span key={b.id} className="chip chip--gold" title={b.desc}>
                        <span style={{ marginRight: 4 }}>{b.icon}</span>
                        <b>{b.name}</b>: {b.desc}
                      </span>
                    ))}
                  </div>
                </Panel>
              )}
            </div>
          )}
        </>
      )}

      {tab === "shop" && (
        <div style={{ display: "grid", gap: "var(--s-4)" }}>
          <Panel title="Abyssal Relic Altar">
            <p className="muted" style={{ marginBottom: "var(--s-4)" }}>
              Exchange Abyssal Shards extracted from the void. Powerful void gear, companion eggs, and void reforgers await those who plunge deepest.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--s-3)" }}>
              {data.shop.map((item) => {
                const waveLocked = data.bestWave < item.minWave;
                const canAfford = data.shardsOwned >= item.price;
                return (
                  <div
                    key={item.id}
                    className="card"
                    style={{
                      padding: "var(--s-4)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      border: "1px solid var(--border, #333)",
                      background: waveLocked ? "rgba(255,255,255,0.02)" : "var(--surface, #181818)",
                    }}
                  >
                    <div>
                      <div className="row row--between" style={{ marginBottom: "var(--s-2)" }}>
                        <span style={{ fontSize: "1.8rem" }}>{item.icon}</span>
                        <span className="chip chip--gold">
                          🌌 {fmt(item.price)} Shards
                        </span>
                      </div>
                      <h4 style={{ margin: "0 0 var(--s-1) 0" }}>{item.name}</h4>
                      <p className="faint" style={{ fontSize: "0.85rem", lineHeight: 1.4, margin: "0 0 var(--s-2) 0" }}>
                        {item.desc}
                      </p>
                      {item.minWave > 0 && (
                        <div style={{ marginTop: "var(--s-2)" }}>
                          <span className={`chip ${waveLocked ? "chip--red" : "chip--gold"}`}>
                            {waveLocked ? `🔒 Requires Wave ${item.minWave}` : `✓ Wave ${item.minWave} Cleared`}
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: "var(--s-4)" }}>
                      <Button
                        variant={!waveLocked && canAfford ? "primary" : "default"}
                        size="sm"
                        disabled={waveLocked || !canAfford}
                        loading={buyShop.isPending}
                        onClick={() => buyShop.mutate({ shopId: item.id })}
                      >
                        {waveLocked ? `Reach Wave ${item.minWave}` : !canAfford ? "Need more shards" : "Claim Relic"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      )}

      {tab === "leaders" && (
        <Panel title="Deepest Divers of the Realm">
          <p className="muted" style={{ marginBottom: "var(--s-4)" }}>
            The mortals who have descended deepest into the void and returned to speak of it.
          </p>

          <div style={{ display: "grid", gap: "var(--s-2)" }}>
            {data.leaderboard.length === 0 ? (
              <p className="faint">No divers have braved the Endless Abyss yet. Be the first!</p>
            ) : (
              data.leaderboard.map((entry, idx) => (
                <div
                  key={entry.userId}
                  className="row row--between card"
                  style={{
                    padding: "var(--s-3)",
                    background: idx === 0 ? "rgba(212,175,55,0.08)" : idx < 3 ? "rgba(255,255,255,0.04)" : "var(--surface, #181818)",
                    border: idx === 0 ? "1px solid var(--accent, #d4af37)" : "1px solid var(--border, #333)",
                  }}
                >
                  <div className="row" style={{ gap: "var(--s-3)" }}>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontWeight: "bold",
                        width: 28,
                        textAlign: "center",
                        color: idx === 0 ? "#ffd700" : idx === 1 ? "#c0c0c0" : idx === 2 ? "#cd7f32" : "inherit",
                      }}
                    >
                      #{idx + 1}
                    </span>
                    <div>
                      <b>{entry.name}</b>
                      <span className="faint" style={{ marginLeft: "var(--s-2)", fontSize: "0.85rem" }}>
                        Lv {entry.level}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="chip chip--gold">
                      Wave {entry.abyssBest}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      )}
    </>
  );
}
