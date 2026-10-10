import { useState, useEffect } from "react";
import { Award, CheckCircle2 } from "lucide-react";
import { JOBS, JOB_RANKS, JOB_COMMISSIONS, type TradeCommissionReward } from "../../../shared/data/meta.ts";
import { Button, Chip, Coins, Loading, PageHead, Panel } from "../components/ui.tsx";
import { fmt } from "../lib/format.ts";
import { useAction, useHero } from "../state/game.ts";

interface JobStatusResponse {
  jobId: string | null;
  shiftStartedAt: number | null;
  endsAt: number | null;
  ready: boolean;
  shiftsCompleted: number;
  rank: { id: string; name: string; shiftsRequired: number; wageBonusPct: number };
  wageWithBonus: number;
  commissionReady: boolean;
  commissionReadyAt: number;
  commissionDef: { name: string; desc: string; reward: TradeCommissionReward } | null;
}

interface CollectShiftResult {
  coins: number;
  xp: number;
}

interface CommissionResult {
  coins: number;
  xp: number;
}

export default function JobsPage() {
  const { hero } = useHero();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const takeJob = useAction<{ jobId: string }>("/api/jobs/take", {
    invalidate: [["hero"]],
    success: "Employed in new profession.",
  });
  const startShift = useAction("/api/jobs/start", {
    invalidate: [["hero"]],
    success: "Shift started. Work hard!",
  });
  const collectShift = useAction<undefined, CollectShiftResult>("/api/jobs/collect", {
    invalidate: [["hero"]],
    success: (r: CollectShiftResult) => `Collected ${fmt(r.coins)} coins and ${fmt(r.xp)} XP!`,
  });
  const claimCommission = useAction<undefined, CommissionResult>("/api/jobs/commission", {
    invalidate: [["hero"]],
    success: (r: CommissionResult) => `Commission completed! Received ${fmt(r.coins)} coins, ${fmt(r.xp)} XP, and trade materials.`,
  });

  if (!hero) return <Loading />;

  const status = hero.jobStatus as JobStatusResponse | undefined;
  const activeJob = JOBS.find((j) => j.id === status?.jobId);
  const shiftsCompleted = status?.shiftsCompleted ?? 0;
  const currentRank = status?.rank ?? JOB_RANKS[0]!;

  const shiftRemainingMs = status?.endsAt ? Math.max(0, status.endsAt - now) : 0;
  const shiftMins = Math.floor(shiftRemainingMs / 60000);
  const shiftSecs = Math.floor((shiftRemainingMs % 60000) / 1000);

  const commissionRemainingMs = status?.commissionReadyAt ? Math.max(0, status.commissionReadyAt - now) : 0;
  const commHours = Math.floor(commissionRemainingMs / 3600000);
  const commMins = Math.floor((commissionRemainingMs % 3600000) / 60000);
  const commSecs = Math.floor((commissionRemainingMs % 60000) / 1000);

  return (
    <div className="stack" style={{ gap: "var(--s-4)" }}>
      <PageHead title="Guild of Artisans & Professions">
        Master imperial crafts, execute specialized trade commissions, and earn honest coin.
      </PageHead>

      {/* Career Mastery Overview */}
      <Panel
        title="Artisan Career Mastery"
        action={
          <span style={{ fontSize: "0.85rem", color: "#aaa" }}>
            Total Career Shifts: <strong style={{ color: "#fff" }}>{shiftsCompleted}</strong>
          </span>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.2rem" }}>
          <div style={{ background: "#111", border: "1px solid #282828", borderRadius: "6px", padding: "1rem" }}>
            <div style={{ color: "#888", fontSize: "0.75rem", textTransform: "uppercase", marginBottom: "0.3rem" }}>Career Rank</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Award size={18} /> {currentRank.name}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "0.3rem" }}>
              {currentRank.wageBonusPct > 0 ? `+${currentRank.wageBonusPct}% Wage Bonus` : "Base Wages"}
            </div>
          </div>

          <div style={{ background: "#111", border: "1px solid #282828", borderRadius: "6px", padding: "1rem" }}>
            <div style={{ color: "#888", fontSize: "0.75rem", textTransform: "uppercase", marginBottom: "0.3rem" }}>Active Profession</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              {activeJob ? `${activeJob.icon} ${activeJob.name}` : "Unemployed"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "0.3rem" }}>
              {activeJob ? `Level ${activeJob.level} Requirement` : "Select a profession below"}
            </div>
          </div>

          <div style={{ background: "#111", border: "1px solid #282828", borderRadius: "6px", padding: "1rem" }}>
            <div style={{ color: "#888", fontSize: "0.75rem", textTransform: "uppercase", marginBottom: "0.3rem" }}>Next Rank Goal</div>
            {(() => {
              const nextRank = JOB_RANKS.find((r) => r.shiftsRequired > shiftsCompleted);
              if (!nextRank) return <div style={{ fontSize: "1.1rem", color: "#fff", fontWeight: 600 }}>Grandmaster Capped</div>;
              return (
                <div>
                  <div style={{ fontSize: "1.1rem", color: "#fff", fontWeight: 600 }}>{nextRank.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "0.3rem" }}>
                    {shiftsCompleted} / {nextRank.shiftsRequired} shifts ({nextRank.shiftsRequired - shiftsCompleted} needed)
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Rank Progression Bar */}
        <div style={{ borderTop: "1px solid #222", paddingTop: "0.8rem", fontSize: "0.8rem", color: "#888" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
            <span>Rank Tiers:</span>
            <span>Apprentice (0) • Journeyman (5) • Artisan (15) • Master (30) • Grandmaster (50)</span>
          </div>
        </div>
      </Panel>

      {/* Active Shift & Daily Trade Commission Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
        {/* Work Shift Card */}
        <Panel title="Active Work Shift (8 Hours)">
          {!activeJob ? (
            <div style={{ textAlign: "center", padding: "2rem 1rem", color: "#777" }}>
              Select a profession below to begin taking shifts.
            </div>
          ) : (
            <div className="stack" style={{ gap: "0.8rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "1.1rem", fontWeight: 600, color: "#fff" }}>
                  {activeJob.icon} {activeJob.name} Shift
                </span>
                <span style={{ fontSize: "0.85rem", color: "#aaa" }}>
                  Base: <Coins value={activeJob.wage} /> {currentRank.wageBonusPct > 0 && <span style={{ color: "#fff" }}> (+{currentRank.wageBonusPct}%)</span>}
                </span>
              </div>

              {status?.shiftStartedAt ? (
                <div style={{ background: "#111", border: "1px solid #282828", borderRadius: "6px", padding: "1rem" }}>
                  {status.ready ? (
                    <div>
                      <div style={{ color: "#4ade80", fontWeight: 600, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <CheckCircle2 size={18} /> Shift Complete! Wages Ready.
                      </div>
                      <p style={{ color: "#888", fontSize: "0.85rem", margin: "0 0 1rem" }}>
                        Your shift ended. Collect your hard-earned wages and career experience.
                      </p>
                      <Button onClick={() => collectShift.mutate()} disabled={collectShift.isPending} style={{ width: "100%" }}>
                        Collect Wages (<Coins value={status.wageWithBonus || activeJob.wage} />)
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <span style={{ color: "#aaa", fontSize: "0.85rem" }}>Time Remaining:</span>
                        <strong style={{ color: "#fff", fontFamily: "monospace", fontSize: "1rem" }}>
                          {shiftMins}m {shiftSecs}s
                        </strong>
                      </div>
                      <p style={{ color: "#666", fontSize: "0.8rem", margin: "0" }}>
                        You are actively working this shift. Check back when the timer completes.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: "#111", border: "1px solid #282828", borderRadius: "6px", padding: "1rem" }}>
                  <p style={{ color: "#888", fontSize: "0.85rem", margin: "0 0 1rem" }}>
                    Begin an 8-hour shift to earn <strong style={{ color: "#fff" }}>{fmt(status?.wageWithBonus || activeJob.wage)} coins</strong> and profession experience.
                  </p>
                  <Button onClick={() => startShift.mutate()} disabled={startShift.isPending} style={{ width: "100%" }}>
                    Start 8-Hour Shift
                  </Button>
                </div>
              )}
            </div>
          )}
        </Panel>

        {/* Daily Trade Commission Card */}
        <Panel title="Specialty Trade Commission (6h Cooldown)">
          {!activeJob ? (
            <div style={{ textAlign: "center", padding: "2rem 1rem", color: "#777" }}>
              Select a profession below to unlock trade commissions.
            </div>
          ) : (
            <div className="stack" style={{ gap: "0.8rem" }}>
              {(() => {
                const commission = JOB_COMMISSIONS[activeJob.id];
                if (!commission) return null;

                const isReady = status ? status.commissionReady : true;

                return (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                      <span style={{ fontWeight: 600, color: "#fff" }}>{commission.name}</span>
                      {isReady ? <Chip tone="gold">Ready</Chip> : <Chip>On Cooldown</Chip>}
                    </div>
                    <p style={{ fontSize: "0.82rem", color: "#888", margin: "0 0 0.8rem", lineHeight: 1.4 }}>
                      {commission.desc}
                    </p>

                    <div style={{ background: "#111", border: "1px solid #282828", borderRadius: "6px", padding: "0.8rem", marginBottom: "1rem", fontSize: "0.8rem" }}>
                      <div style={{ color: "#aaa", marginBottom: "0.3rem" }}>Commission Yield:</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem", color: "#fff" }}>
                        <span>🪙 {fmt(commission.reward.coins)} coins</span>
                        <span>⭐ +{Math.round(commission.reward.xpPct * 100)}% XP</span>
                        {commission.reward.materials && (
                          <span>📦 {Object.entries(commission.reward.materials).map(([k, v]) => `${v}x ${k}`).join(", ")}</span>
                        )}
                        {commission.reward.egg && <span>🥚 1x Mystery Egg</span>}
                        {commission.reward.healsHpPct && <span>❤️ 100% Full Vitality</span>}
                      </div>
                    </div>

                    <Button
                      onClick={() => claimCommission.mutate()}
                      disabled={!isReady || claimCommission.isPending}
                      style={{ width: "100%" }}
                    >
                      {isReady ? "Execute Trade Commission" : `Cooldown (${commHours}h ${commMins}m ${commSecs}s)`}
                    </Button>
                  </div>
                );
              })()}
            </div>
          )}
        </Panel>
      </div>

      {/* Available Professions Directory */}
      <Panel title="Artisan Professions Catalog">
        <p style={{ color: "#888", fontSize: "0.85rem", margin: "0 0 1rem" }}>
          Choose your craft. Higher-level professions offer greater shift wages and lucrative trade materials.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
          {JOBS.map((job) => {
            const isUnlocked = hero.level >= job.level;
            const isCurrent = activeJob?.id === job.id;
            const bonusWage = Math.round(job.wage * (1 + currentRank.wageBonusPct / 100));
            const comm = JOB_COMMISSIONS[job.id];

            return (
              <div
                key={job.id}
                style={{
                  background: isCurrent ? "#161616" : isUnlocked ? "#101010" : "#0a0a0a",
                  border: isCurrent ? "1px solid #fff" : isUnlocked ? "1px solid #282828" : "1px dashed #222",
                  borderRadius: "6px",
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  opacity: isUnlocked ? 1 : 0.5,
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.6rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <span style={{ fontSize: "1.6rem" }}>{job.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: "#fff" }}>{job.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "#888" }}>
                          Requires Hero Level {job.level}
                        </div>
                      </div>
                    </div>
                    {isCurrent ? (
                      <Chip tone="gold">Active</Chip>
                    ) : !isUnlocked ? (
                      <Chip>Lv {job.level}</Chip>
                    ) : null}
                  </div>

                  <div style={{ fontSize: "0.85rem", margin: "0.5rem 0", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#aaa" }}>Shift Wage:</span>
                    <span style={{ color: "#fff", fontWeight: 600 }}>
                      <Coins value={bonusWage} />
                    </span>
                  </div>

                  {comm && (
                    <div style={{ fontSize: "0.78rem", color: "#777", marginTop: "0.4rem", borderTop: "1px solid #1c1c1c", paddingTop: "0.4rem" }}>
                      <strong style={{ color: "#999" }}>Commission:</strong> {comm.name}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: "1rem" }}>
                  <Button
                    onClick={() => takeJob.mutate({ jobId: job.id })}
                    disabled={!isUnlocked || isCurrent || takeJob.isPending || !!status?.shiftStartedAt}
                    style={{ width: "100%" }}
                  >
                    {isCurrent
                      ? "Current Profession"
                      : !isUnlocked
                      ? `Locked (Level ${job.level})`
                      : status?.shiftStartedAt
                      ? "Finish shift first"
                      : "Take Profession"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
