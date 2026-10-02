import { Crown, Flame, Shield, Skull, Sparkles, Swords, Trophy, Zap } from "lucide-react";
import { useState } from "react";
import { Button, Loading, Panel } from "./ui.tsx";
import { fmt } from "../lib/format.ts";
import { useData } from "../state/game.ts";
import { useStartBattle } from "../pages/Table.tsx";

interface RaidTier {
  tierId: number;
  levelReq: number;
  name: string;
  icon: string;
  bossTitle: string;
  entryFee: number;
  hpMult: number;
  atkMult: number;
  defMult: number;
  firstBloodGearId: string;
  firstBloodGearName: string;
  firstBloodGearSlot: string;
  guaranteedTokens: [number, number];
  bonusGoldReward: number;
  claimed: boolean;
  claimedBy: { userName: string; userId: number; claimedAt: number } | null;
  canAfford: boolean;
  meetsLevel: boolean;
}

interface RaidOverview {
  dateStr: string;
  myCoins: number;
  myLevel: number;
  theme: {
    themeId: string;
    name: string;
    banner: string;
    description: string;
    bonusAffix: string;
  };
  tiers: RaidTier[];
}

export function RealmBossRaids() {
  const { data, isPending } = useData<RaidOverview>(["realmRaids"], "/api/raid/daily", {
    refetchInterval: 30_000,
  });
  const startRaid = useStartBattle("/api/raid/daily/fight", [["realmRaids"], ["me"]]);

  if (isPending || !data) return <Loading rows={4} />;

  const { theme, tiers, myCoins, myLevel } = data;

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      {/* Event Header Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #141414 0%, #1a1515 100%)",
          border: "1px solid #332222",
          borderRadius: "8px",
          padding: "1.25rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "2.2rem" }}>{theme.banner}</span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h2 style={{ margin: 0, fontSize: "1.3rem", color: "#fff" }}>
                  Daily Realm Trial: {theme.name}
                </h2>
                <span
                  className="chip"
                  style={{
                    background: "#ef444422",
                    color: "#f87171",
                    border: "1px solid #ef444455",
                    fontSize: "0.75rem",
                  }}
                >
                  Rotates Daily
                </span>
              </div>
              <p style={{ margin: "0.3rem 0 0", color: "#aaa", fontSize: "0.85rem" }}>
                {theme.description}
              </p>
            </div>
          </div>
          <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
            <span className="chip" style={{ color: "var(--gold, #d4af37)", border: "1px solid #d4af3744" }}>
              ⚡ Affix: {theme.bonusAffix}
            </span>
            <span className="chip" style={{ color: "#aaa", border: "1px solid #333" }}>
              📅 Realm Date: {data.dateStr}
            </span>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.8rem", color: "#888" }}>Pouch Balance</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--gold, #d4af37)" }}>
            {fmt(myCoins)} coins
          </div>
          <div style={{ fontSize: "0.8rem", color: "#888", marginTop: "0.2rem" }}>
            Hero Level: <b>Lv. {myLevel}</b>
          </div>
        </div>
      </div>

      {/* Rules Notice */}
      <div
        style={{
          background: "#111",
          border: "1px solid #282828",
          borderRadius: "6px",
          padding: "0.75rem 1rem",
          fontSize: "0.82rem",
          color: "#aaa",
          lineHeight: 1.5,
        }}
      >
        <span style={{ color: "#facc15", fontWeight: 700 }}>⚔️ Realm Trial Rules:</span> Entry requires the listed gold fee. Bosses are formidable and scaled for endgame builds. The <b>very first player in the entire realm</b> to conquer a boss tier claims the permanent <b>One-Time Limited Relic</b>! All subsequent conquerors reap the full gold bounty and Carnival Tokens.
      </div>

      {/* Boss Tiers List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {tiers.map((t) => {
          const isClaimed = t.claimed;
          const meetsLvl = t.meetsLevel;
          const canPay = t.canAfford;

          return (
            <div
              key={t.tierId}
              style={{
                background: "#141414",
                border: isClaimed ? "1px solid #2e2e2e" : "1px solid #d4af3755",
                borderRadius: "8px",
                padding: "1.25rem",
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                alignItems: "center",
                gap: "1.25rem",
              }}
            >
              {/* Boss Icon */}
              <div
                style={{
                  fontSize: "2.8rem",
                  width: "4rem",
                  height: "4rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#1a1a1a",
                  border: "1px solid #333",
                  borderRadius: "8px",
                }}
              >
                {t.icon}
              </div>

              {/* Info & Rewards */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                  <span
                    className="chip"
                    style={{
                      background: "#222",
                      color: "#fff",
                      fontWeight: 700,
                      border: "1px solid #444",
                    }}
                  >
                    Tier {t.tierId} · Lv. {t.levelReq}+
                  </span>
                  <span style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff" }}>
                    {t.name}
                  </span>
                  <span style={{ fontSize: "0.85rem", color: "#888" }}>
                    [{t.bossTitle}]
                  </span>
                </div>

                {/* Rewards Breakdown */}
                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    flexWrap: "wrap",
                    marginTop: "0.6rem",
                    fontSize: "0.85rem",
                  }}
                >
                  <span style={{ color: "var(--gold, #d4af37)" }}>
                    💰 Bounty: <b>+{fmt(t.bonusGoldReward)} Gold</b>
                  </span>
                  <span style={{ color: "#38bdf8" }}>
                    🎟️ Tokens: <b>{t.guaranteedTokens[0]}–{t.guaranteedTokens[1]} Carnival Tokens</b>
                  </span>
                  <span style={{ color: "#f87171" }}>
                    🪙 Entry Fee: <b>{fmt(t.entryFee)} Coins</b>
                  </span>
                </div>

                {/* First Blood Unique Item Status */}
                <div
                  style={{
                    marginTop: "0.6rem",
                    padding: "0.4rem 0.6rem",
                    background: "#1a1814",
                    border: "1px dashed #d4af3766",
                    borderRadius: "4px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.8rem",
                  }}
                >
                  <Crown size={15} color="#d4af37" />
                  <span style={{ color: "#d4af37", fontWeight: 600 }}>First Blood Limited Relic:</span>
                  <span style={{ color: "#fff" }}>{t.firstBloodGearName}</span>
                  {isClaimed ? (
                    <span style={{ color: "#ef4444", marginLeft: "0.5rem" }}>
                      [Claimed by <b>{t.claimedBy?.userName}</b>]
                    </span>
                  ) : (
                    <span style={{ color: "#4ade80", marginLeft: "0.5rem", fontWeight: 700 }}>
                      [✨ UNCLAIMED — Available to First Victor!]
                    </span>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div style={{ textAlign: "right", minWidth: "160px" }}>
                <Button
                  variant="primary"
                  size="lg"
                  block
                  disabled={!meetsLvl || !canPay}
                  onClick={() => startRaid.mutate({ tierId: t.tierId })}
                >
                  {!meetsLvl
                    ? `Requires Lv. ${t.levelReq}`
                    : !canPay
                    ? `Need ${fmt(t.entryFee)} Gold`
                    : `Enter Trial (${fmt(t.entryFee)})`}
                </Button>
                <div style={{ fontSize: "0.75rem", color: "#777", marginTop: "0.4rem" }}>
                  {isClaimed ? "Farm Bounty & Tokens" : "⚔️ Race for First Blood!"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
