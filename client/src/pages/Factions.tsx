import { Crown, Flag, Landmark } from "lucide-react";
import { Bar, Button, Coins, Empty, Loading, PageHead, Panel } from "../components/ui.tsx";
import { fmt } from "../lib/format.ts";
import { useAction, useData, useHero } from "../state/game.ts";

interface FactionRankInfo {
  rank: number;
  title: string;
  repRequired: number;
  multiplier: number;
}

interface FactionCardInfo {
  id: string;
  name: string;
  banner: string;
  motto: string;
  desc: string;
  perks: string[];
  title: string;
  isPledged: boolean;
  bonuses: {
    atkPct?: number;
    defPct?: number;
    hpPct?: number;
    crit?: number;
    coinPct?: number;
    xpPct?: number;
  };
}

interface FactionOverview {
  currentFactionId: string | null;
  reputation: number;
  rank: FactionRankInfo;
  nextRank: FactionRankInfo | null;
  bonuses: {
    atkPct: number;
    defPct: number;
    hpPct: number;
    crit: number;
    coinPct: number;
    xpPct: number;
  };
  canTribute: boolean;
  tributeCost: number;
  switchCost: number;
  minLevel: number;
  hasPrestigeTitle: boolean;
  factions: FactionCardInfo[];
}

export default function FactionsPage() {
  const { hero } = useHero();
  const { data, isPending } = useData<FactionOverview>(["factions"], "/api/factions", {
    enabled: hero.level >= 10,
  });

  const inv = [["factions"], ["me"]];
  const pledge = useAction<{ factionId: string }>("/api/factions/pledge", {
    invalidate: inv,
    success: "Your allegiance has been sworn.",
  });
  const tribute = useAction("/api/factions/tribute", {
    invalidate: inv,
    success: "Daily tribute received. The faction blesses your loyalty.",
  });
  const claimTitle = useAction("/api/factions/title", {
    invalidate: inv,
    success: "Prestige title unlocked and equipped.",
  });

  if (hero.level < 10) {
    return (
      <Empty art="🚩" title="Imperial Factions await heroes of level 10">
        The realm's three sovereign factions only welcome seasoned adventurers into their ranks. Reach level 10 to pledge fealty.
      </Empty>
    );
  }

  if (isPending || !data) return <Loading rows={4} />;

  const activeFaction = data.factions.find((f) => f.id === data.currentFactionId);
  const nextTargetRep = data.nextRank?.repRequired ?? data.reputation;
  const currentBaseRep = data.rank.repRequired;
  const progressRep = Math.max(0, data.reputation - currentBaseRep);
  const spanRep = Math.max(1, nextTargetRep - currentBaseRep);

  return (
    <>
      <PageHead title="Imperial Factions">
        Swear fealty to one of the realm's three legendary orders. Earn reputation through daily tributes, Spire climbs, dungeon runs, and battle victories to empower permanent passive blessings and unlock prestige titles.
      </PageHead>

      <div className="stack" style={{ gap: "1.25rem" }}>
        {activeFaction ? (
          <Panel
            title={
              <div className="row" style={{ alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.4rem" }}>{activeFaction.banner}</span>
                <h2>{activeFaction.name} — Allegiance Active</h2>
              </div>
            }
          >
            <div className="stack" style={{ gap: "1rem" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "0.75rem",
                  background: "#111",
                  border: "1px solid #333",
                  borderRadius: "8px",
                  padding: "1rem",
                }}
              >
                <div>
                  <div className="faint" style={{ textTransform: "uppercase", fontSize: "0.75rem" }}>Faction Rank</div>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                    Rank {data.rank.rank}: {data.rank.title}
                  </div>
                  <div className="muted" style={{ fontSize: "0.85rem" }}>
                    Blessing Multiplier: {data.rank.multiplier}x
                  </div>
                </div>

                <div>
                  <div className="faint" style={{ textTransform: "uppercase", fontSize: "0.75rem" }}>Reputation</div>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                    {fmt(data.reputation)} Rep
                  </div>
                  <div className="muted" style={{ fontSize: "0.85rem" }}>
                    {data.nextRank ? `Next Rank at ${fmt(data.nextRank.repRequired)}` : "Max Rank Achieved"}
                  </div>
                </div>

                <div>
                  <div className="faint" style={{ textTransform: "uppercase", fontSize: "0.75rem" }}>Active Resonance</div>
                  <div style={{ fontWeight: 600, color: "#fff", fontSize: "0.95rem" }}>
                    {[
                      data.bonuses.atkPct ? `+${data.bonuses.atkPct}% Attack` : null,
                      data.bonuses.defPct ? `+${data.bonuses.defPct}% Defense` : null,
                      data.bonuses.hpPct ? `+${data.bonuses.hpPct}% Max HP` : null,
                      data.bonuses.crit ? `+${data.bonuses.crit}% Crit Rate` : null,
                      data.bonuses.coinPct ? `+${data.bonuses.coinPct}% Battle Gold` : null,
                      data.bonuses.xpPct ? `+${data.bonuses.xpPct}% Battle XP` : null,
                    ].filter(Boolean).join(" · ") || "Standard"}
                  </div>
                </div>
              </div>

              {data.nextRank && (
                <div className="stack" style={{ gap: "0.25rem" }}>
                  <Bar
                    value={progressRep}
                    max={spanRep}
                    kind="xp"
                    label={`Rank Progress: ${fmt(data.reputation)} / ${fmt(data.nextRank.repRequired)} Rep`}
                  />
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  background: "#141414",
                  border: "1px solid #282828",
                  borderRadius: "8px",
                  padding: "0.85rem 1rem",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>Daily Faction Tribute</div>
                  <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.85rem" }}>
                    Donate {fmt(data.tributeCost)} gold to gain +300 Faction Rep, +500 XP, and a supply ration cache.
                  </p>
                </div>
                <Button
                  variant="primary"
                  disabled={!data.canTribute || hero.coins < data.tributeCost}
                  loading={tribute.isPending}
                  onClick={() => tribute.mutate(undefined)}
                >
                  {data.canTribute ? (
                    <>Offer Tribute (<Coins value={data.tributeCost} />)</>
                  ) : (
                    "Tribute Made Today ✓"
                  )}
                </Button>
              </div>

              {data.rank.rank >= 4 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                    background: "#181818",
                    border: "1px solid #444",
                    borderRadius: "8px",
                    padding: "0.85rem 1rem",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <Crown size={16} /> Prestige Insignia Title
                    </div>
                    <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.85rem" }}>
                      High officers may don the prestigious title: <b>"{activeFaction.title}"</b>.
                    </p>
                  </div>
                  <Button
                    variant="default"
                    disabled={data.hasPrestigeTitle}
                    loading={claimTitle.isPending}
                    onClick={() => claimTitle.mutate(undefined)}
                  >
                    {data.hasPrestigeTitle ? "Title Equipped ✓" : "Claim & Equip Title"}
                  </Button>
                </div>
              )}
            </div>
          </Panel>
        ) : (
          <Panel>
            <div className="row" style={{ alignItems: "center", gap: "0.5rem" }}>
              <Flag size={20} />
              <p style={{ margin: 0 }}>
                You have not pledged allegiance to any Imperial Faction yet. Select an order below to claim your passive blessings!
              </p>
            </div>
          </Panel>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          {data.factions.map((f) => {
            const isCurrent = f.id === data.currentFactionId;
            return (
              <div
                key={f.id}
                className="panel"
                style={{
                  background: isCurrent ? "#141414" : "#0d0d0d",
                  border: isCurrent ? "2px solid #fff" : "1px solid #333",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div className="stack" style={{ gap: "0.75rem" }}>
                  <div className="row" style={{ alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "1.75rem" }}>{f.banner}</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1.15rem" }}>{f.name}</h3>
                      <div className="faint" style={{ fontStyle: "italic", fontSize: "0.8rem" }}>
                        "{f.motto}"
                      </div>
                    </div>
                  </div>

                  <p className="muted" style={{ fontSize: "0.85rem", lineHeight: 1.4 }}>
                    {f.desc}
                  </p>

                  <div className="stack" style={{ gap: "0.4rem" }}>
                    <div className="faint" style={{ textTransform: "uppercase", fontSize: "0.7rem", fontWeight: 700 }}>
                      Faction Perks:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem" }}>
                      {f.perks.map((p, idx) => (
                        <li key={idx} style={{ marginBottom: "0.25rem" }}>{p}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div style={{ marginTop: "1.25rem", paddingTop: "0.75rem", borderTop: "1px solid #222" }}>
                  {isCurrent ? (
                    <Button variant="default" disabled style={{ width: "100%", opacity: 0.8 }}>
                      Pledged Order (Active)
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      style={{ width: "100%" }}
                      loading={pledge.isPending}
                      disabled={Boolean(data.currentFactionId && hero.coins < data.switchCost)}
                      onClick={() => pledge.mutate({ factionId: f.id })}
                    >
                      {data.currentFactionId ? (
                        <>Switch Fealty ({fmt(data.switchCost)} gold)</>
                      ) : (
                        "Pledge Fealty"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Panel title={<h3><Landmark size={18} style={{ display: "inline", verticalAlign: "middle", marginRight: "0.4rem" }} /> Imperial Faction Ranks & Doctrine</h3>}>
          <div className="stack" style={{ gap: "0.75rem", fontSize: "0.85rem" }}>
            <p className="muted">
              Imperial Factions represent the realm's highest military and arcane coalitions. As you slay foes, complete hunt contracts, defeat dungeon bosses, conquer Tower floors, and make daily tributes, your standing rises:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.5rem" }}>
              <div style={{ background: "#111", border: "1px solid #282828", borderRadius: "6px", padding: "0.6rem" }}>
                <b>Rank 1: Initiate</b> (0 Rep)<br />
                <span className="muted">1.0x Base blessing</span>
              </div>
              <div style={{ background: "#111", border: "1px solid #282828", borderRadius: "6px", padding: "0.6rem" }}>
                <b>Rank 2: Veteran</b> (500 Rep)<br />
                <span className="muted">1.25x Blessing boost</span>
              </div>
              <div style={{ background: "#111", border: "1px solid #282828", borderRadius: "6px", padding: "0.6rem" }}>
                <b>Rank 3: Champion</b> (2,500 Rep)<br />
                <span className="muted">1.50x Blessing boost</span>
              </div>
              <div style={{ background: "#111", border: "1px solid #282828", borderRadius: "6px", padding: "0.6rem" }}>
                <b>Rank 4: High Commander</b> (10k Rep)<br />
                <span className="muted">1.75x Boost + Title</span>
              </div>
              <div style={{ background: "#111", border: "1px solid #282828", borderRadius: "6px", padding: "0.6rem" }}>
                <b>Rank 5: Sovereign</b> (30k Rep)<br />
                <span className="muted">2.00x Maximum resonance</span>
              </div>
            </div>
            <p className="faint" style={{ marginTop: "0.5rem" }}>
              Switching allegiance carries a fee of 25,000 gold. Your accumulated reputation with each faction is safely remembered when you return.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
