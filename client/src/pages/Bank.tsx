import { useState } from "react";
import { Building2, PiggyBank, Clock, ShieldCheck, AlertTriangle, ArrowUpRight, ArrowDownLeft, CheckCircle2 } from "lucide-react";
import { Button, Chip, Coins, Countdown, PageHead, Panel, Tabs } from "../components/ui.tsx";
import { fmt } from "../lib/format.ts";
import { play } from "../lib/sound.ts";
import { useAction, useData, useHero } from "../state/game.ts";

interface FixedDepositItem {
  id: string;
  amount: number;
  interestRate: number;
  durationHours: number;
  createdAt: number;
  matureAt: number;
  claimed: boolean;
  timeRemaining: number;
  matured: boolean;
  payout: number;
  profit: number;
}

interface ActiveLoanItem {
  amount: number;
  totalOwed: number;
  interestRate: number;
  takenAt: number;
  dueAt: number;
  lastPenaltyAt: number;
  overdue: boolean;
  timeRemaining: number;
}

interface BankView {
  savings: number;
  coins: number;
  fds: FixedDepositItem[];
  loan: ActiveLoanItem | null;
  maxLoan: number;
  fdTiers: { hours: number; rate: number; label: string; desc: string }[];
}

export default function BankPage() {
  const { hero } = useHero();
  const bank = useData<BankView>(["bank"], "/api/bank", { refetchInterval: 10000 });
  const [tab, setTab] = useState<"savings" | "fd" | "loan">("savings");

  // Savings inputs
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");

  // FD inputs
  const [fdAmount, setFdAmount] = useState<string>("");
  const [fdDuration, setFdDuration] = useState<number>(1);

  // Loan inputs
  const [borrowAmount, setBorrowAmount] = useState<string>("");
  const [repayAmount, setRepayAmount] = useState<string>("");

  // Actions
  const depositAction = useAction<{ amount: number }>("/api/bank/deposit", {
    invalidate: [["bank"], ["me"]],
    onSuccess: () => {
      play("coin");
      setDepositAmount("");
    },
  });

  const withdrawAction = useAction<{ amount: number }>("/api/bank/withdraw", {
    invalidate: [["bank"], ["me"]],
    onSuccess: () => {
      play("coin");
      setWithdrawAmount("");
    },
  });

  const createFdAction = useAction<{ amount: number; durationHours: number }>("/api/bank/fd/create", {
    invalidate: [["bank"], ["me"]],
    onSuccess: () => {
      play("level");
      setFdAmount("");
    },
  });

  const claimFdAction = useAction<{ fdId: string }>("/api/bank/fd/claim", {
    invalidate: [["bank"], ["me"]],
    onSuccess: () => {
      play("level");
    },
  });

  const takeLoanAction = useAction<{ amount: number }>("/api/bank/loan/take", {
    invalidate: [["bank"], ["me"]],
    onSuccess: () => {
      play("coin");
      setBorrowAmount("");
    },
  });

  const repayLoanAction = useAction<{ amount: number }>("/api/bank/loan/repay", {
    invalidate: [["bank"], ["me"]],
    onSuccess: () => {
      play("coin");
      setRepayAmount("");
    },
  });

  const data = bank.data;
  const currentSavings = data?.savings ?? 0;
  const walletCoins = hero.coins;
  const activeFds = data?.fds ?? [];
  const loan = data?.loan ?? null;
  const maxLoan = data?.maxLoan ?? 0;
  const fdTiers = data?.fdTiers ?? [];

  const selectedTier = fdTiers.find((t) => t.hours === fdDuration) ?? fdTiers[0];
  const numFdAmount = Math.max(0, parseInt(fdAmount || "0", 10));
  const estimatedFdPayout = selectedTier ? Math.floor(numFdAmount * (1 + selectedTier.rate)) : 0;
  const estimatedFdProfit = Math.max(0, estimatedFdPayout - numFdAmount);

  return (
    <div className="bank-page stack" style={{ maxWidth: 1040, margin: "0 auto", padding: "1rem" }}>
      <PageHead
        title="Iron Bank of the Realm"
        actions={
          <div className="row" style={{ gap: "1rem", alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.75rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>In Purse</div>
              <Coins value={walletCoins} />
            </div>
            <div style={{ textAlign: "right", borderLeft: "1px solid #333", paddingLeft: "1rem" }}>
              <div style={{ fontSize: "0.75rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>In Savings</div>
              <Coins value={currentSavings} />
            </div>
          </div>
        }
      >
        <p style={{ color: "#aaa", fontSize: "0.9rem", margin: 0 }}>
          Safeguard your fortune against death and theft, earn locked fixed-deposit interest, or request emergency gold loans.
        </p>
      </PageHead>

      <Tabs
        label="Bank Options"
        value={tab}
        onChange={(v) => setTab(v as "savings" | "fd" | "loan")}
        options={[
          { value: "savings", label: "💰 Personal Savings" },
          { value: "fd", label: `📜 Fixed Deposits (${activeFds.length})` },
          { value: "loan", label: loan ? `⚖️ Loan (Owed: ${fmt(loan.totalOwed)})` : "⚖️ Gold Loans" },
        ]}
      />

      {/* ──────────────────────────────── SAVINGS TAB ──────────────────────────────── */}
      {tab === "savings" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
          {/* Deposit Panel */}
          <Panel title="Deposit into Vault">
            <div className="stack" style={{ gap: "1rem" }}>
              <p style={{ color: "#aaa", fontSize: "0.85rem", margin: 0 }}>
                Store gold in your private vault safe from death penalties and wild adventures.
              </p>
              <div className="row" style={{ gap: "0.5rem" }}>
                {[100, 1000, 10000].map((amt) => (
                  <Button
                    key={amt}
                    size="sm"
                    variant="ghost"
                    onClick={() => setDepositAmount(String(amt))}
                    disabled={walletCoins < amt}
                  >
                    +{fmt(amt)}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDepositAmount(String(walletCoins))}
                  disabled={walletCoins <= 0}
                >
                  All
                </Button>
              </div>

              <div className="row" style={{ gap: "0.5rem" }}>
                <input
                  type="number"
                  placeholder="Amount to deposit"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  style={{
                    flex: 1,
                    background: "#141414",
                    border: "1px solid #333",
                    color: "#fff",
                    padding: "0.6rem 0.8rem",
                    borderRadius: "4px",
                  }}
                />
                <Button
                  variant="primary"
                  loading={depositAction.isPending}
                  disabled={!depositAmount || parseInt(depositAmount, 10) <= 0 || parseInt(depositAmount, 10) > walletCoins}
                  onClick={() => depositAction.mutate({ amount: parseInt(depositAmount, 10) })}
                >
                  <ArrowDownLeft size={16} /> Deposit
                </Button>
              </div>
            </div>
          </Panel>

          {/* Withdraw Panel */}
          <Panel title="Withdraw from Vault">
            <div className="stack" style={{ gap: "1rem" }}>
              <p style={{ color: "#aaa", fontSize: "0.85rem", margin: 0 }}>
                Withdraw gold back to your purse for trading, shopping, or smithing.
              </p>
              <div className="row" style={{ gap: "0.5rem" }}>
                {[100, 1000, 10000].map((amt) => (
                  <Button
                    key={amt}
                    size="sm"
                    variant="ghost"
                    onClick={() => setWithdrawAmount(String(amt))}
                    disabled={currentSavings < amt}
                  >
                    {fmt(amt)}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setWithdrawAmount(String(currentSavings))}
                  disabled={currentSavings <= 0}
                >
                  All
                </Button>
              </div>

              <div className="row" style={{ gap: "0.5rem" }}>
                <input
                  type="number"
                  placeholder="Amount to withdraw"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  style={{
                    flex: 1,
                    background: "#141414",
                    border: "1px solid #333",
                    color: "#fff",
                    padding: "0.6rem 0.8rem",
                    borderRadius: "4px",
                  }}
                />
                <Button
                  variant="primary"
                  loading={withdrawAction.isPending}
                  disabled={!withdrawAmount || parseInt(withdrawAmount, 10) <= 0 || parseInt(withdrawAmount, 10) > currentSavings}
                  onClick={() => withdrawAction.mutate({ amount: parseInt(withdrawAmount, 10) })}
                >
                  <ArrowUpRight size={16} /> Withdraw
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* ──────────────────────────────── FIXED DEPOSIT TAB ──────────────────────────────── */}
      {tab === "fd" && (
        <div className="stack" style={{ gap: "1.5rem" }}>
          {/* Create new FD */}
          <Panel title="Open a Fixed Deposit (FD)">
            <div className="stack" style={{ gap: "1.25rem" }}>
              <p style={{ color: "#aaa", fontSize: "0.85rem", margin: 0 }}>
                Lock your gold with the Royal Bank for guaranteed interest upon maturity. Coins are locked until the full duration elapses.
              </p>

              {/* Tier selector cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
                {fdTiers.map((t) => {
                  const selected = fdDuration === t.hours;
                  return (
                    <div
                      key={t.hours}
                      onClick={() => setFdDuration(t.hours)}
                      style={{
                        cursor: "pointer",
                        padding: "1rem",
                        borderRadius: "6px",
                        background: selected ? "#1a1a1a" : "#111",
                        border: selected ? "1px solid var(--gold, #d4af37)" : "1px solid #2a2a2a",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ fontWeight: 600, color: selected ? "var(--gold, #d4af37)" : "#fff", marginBottom: "0.25rem" }}>
                        {t.label}
                      </div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>
                        +{Math.round(t.rate * 100)}%
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "0.25rem" }}>{t.desc}</div>
                    </div>
                  );
                })}
              </div>

              {/* Amount input & yield calc */}
              <div style={{ background: "#111", border: "1px solid #222", padding: "1rem", borderRadius: "6px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "center" }}>
                  <div className="stack" style={{ gap: "0.5rem" }}>
                    <label style={{ fontSize: "0.8rem", color: "#888" }}>Deposit Amount (Min 100 coins)</label>
                    <div className="row" style={{ gap: "0.5rem" }}>
                      <input
                        type="number"
                        placeholder="e.g. 5000"
                        value={fdAmount}
                        onChange={(e) => setFdAmount(e.target.value)}
                        style={{
                          background: "#161616",
                          border: "1px solid #333",
                          color: "#fff",
                          padding: "0.6rem 0.8rem",
                          borderRadius: "4px",
                          width: "200px",
                        }}
                      />
                      <Button size="sm" variant="ghost" onClick={() => setFdAmount(String(Math.floor(walletCoins / 2)))}>50%</Button>
                      <Button size="sm" variant="ghost" onClick={() => setFdAmount(String(walletCoins))}>Max</Button>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.8rem", color: "#888" }}>Estimated Return</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--gold, #d4af37)" }}>
                      {fmt(estimatedFdPayout)} coins
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#66bb6a" }}>
                      +{fmt(estimatedFdProfit)} profit
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "1rem", textAlign: "right" }}>
                  <Button
                    variant="primary"
                    loading={createFdAction.isPending}
                    disabled={numFdAmount < 100 || numFdAmount > walletCoins || activeFds.length >= 10}
                    onClick={() => createFdAction.mutate({ amount: numFdAmount, durationHours: fdDuration })}
                  >
                    Lock Deposit
                  </Button>
                </div>
              </div>
            </div>
          </Panel>

          {/* Active FDs */}
          <Panel title={`Active Fixed Deposits (${activeFds.length})`}>
            {activeFds.length === 0 ? (
              <div style={{ color: "#777", textAlign: "center", padding: "2rem" }}>
                No active fixed deposits. Open one above to earn safe passive interest!
              </div>
            ) : (
              <div className="stack" style={{ gap: "0.75rem" }}>
                {activeFds.map((fd) => (
                  <div
                    key={fd.id}
                    style={{
                      background: "#121212",
                      border: "1px solid #282828",
                      borderRadius: "6px",
                      padding: "1rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "1rem",
                    }}
                  >
                    <div>
                      <div className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
                        <span style={{ fontWeight: 600, color: "#fff" }}>{fmt(fd.amount)} coins</span>
                        <Chip tone={fd.matured ? "good" : "gold"}>
                          +{Math.round(fd.interestRate * 100)}% ({fd.durationHours}h)
                        </Chip>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#888", marginTop: "0.25rem" }}>
                        Payout: <strong style={{ color: "var(--gold, #d4af37)" }}>{fmt(fd.payout)}</strong> (+{fmt(fd.profit)} profit)
                      </div>
                    </div>

                    <div className="row" style={{ gap: "1rem", alignItems: "center" }}>
                      {fd.matured ? (
                        <Button
                          variant="primary"
                          size="sm"
                          loading={claimFdAction.isPending}
                          onClick={() => claimFdAction.mutate({ fdId: fd.id })}
                        >
                          <CheckCircle2 size={16} /> Claim {fmt(fd.payout)}
                        </Button>
                      ) : (
                        <div className="row" style={{ gap: "0.4rem", color: "#aaa", fontSize: "0.85rem", alignItems: "center" }}>
                          <Clock size={16} />
                          <span>Matures in: </span>
                          <Countdown to={fd.matureAt} done="Ready to claim!" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* ──────────────────────────────── LOANS TAB ──────────────────────────────── */}
      {tab === "loan" && (
        <div className="stack" style={{ gap: "1.5rem" }}>
          {loan ? (
            <Panel title="Active Loan Owed">
              <div className="stack" style={{ gap: "1.25rem" }}>
                {loan.overdue && (
                  <div
                    style={{
                      background: "rgba(220, 38, 38, 0.15)",
                      border: "1px solid #ef4444",
                      padding: "0.75rem 1rem",
                      borderRadius: "6px",
                      color: "#fca5a5",
                      fontSize: "0.85rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <AlertTriangle size={18} />
                    <span>Your loan is overdue! A 5% penalty is added every 24 hours until fully settled.</span>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                  <div style={{ background: "#111", border: "1px solid #222", padding: "1rem", borderRadius: "6px" }}>
                    <div style={{ fontSize: "0.75rem", color: "#888", textTransform: "uppercase" }}>Original Principal</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff", marginTop: "0.25rem" }}>
                      {fmt(loan.amount)} coins
                    </div>
                  </div>
                  <div style={{ background: "#111", border: "1px solid #222", padding: "1rem", borderRadius: "6px" }}>
                    <div style={{ fontSize: "0.75rem", color: "#888", textTransform: "uppercase" }}>Total Currently Owed</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 700, color: loan.overdue ? "#ef4444" : "var(--gold, #d4af37)", marginTop: "0.25rem" }}>
                      {fmt(loan.totalOwed)} coins
                    </div>
                  </div>
                  <div style={{ background: "#111", border: "1px solid #222", padding: "1rem", borderRadius: "6px" }}>
                    <div style={{ fontSize: "0.75rem", color: "#888", textTransform: "uppercase" }}>Due Date</div>
                    <div style={{ fontSize: "0.95rem", color: "#fff", marginTop: "0.35rem" }}>
                      {loan.overdue ? (
                        <span style={{ color: "#ef4444", fontWeight: 600 }}>OVERDUE</span>
                      ) : (
                        <Countdown to={loan.dueAt} done="Overdue!" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Repay form */}
                <div style={{ background: "#111", border: "1px solid #282828", padding: "1.25rem", borderRadius: "6px" }}>
                  <h4 style={{ margin: "0 0 0.75rem 0", color: "#fff" }}>Repay Loan</h4>
                  <div className="row" style={{ gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <Button size="sm" variant="ghost" onClick={() => setRepayAmount(String(Math.min(walletCoins, Math.ceil(loan.totalOwed / 2))))}>
                      50% Owed
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRepayAmount(String(Math.min(walletCoins, loan.totalOwed)))}>
                      Pay in Full ({fmt(loan.totalOwed)})
                    </Button>
                  </div>
                  <div className="row" style={{ gap: "0.5rem" }}>
                    <input
                      type="number"
                      placeholder="Amount to repay"
                      value={repayAmount}
                      onChange={(e) => setRepayAmount(e.target.value)}
                      style={{
                        flex: 1,
                        background: "#161616",
                        border: "1px solid #333",
                        color: "#fff",
                        padding: "0.6rem 0.8rem",
                        borderRadius: "4px",
                      }}
                    />
                    <Button
                      variant="primary"
                      loading={repayLoanAction.isPending}
                      disabled={!repayAmount || parseInt(repayAmount, 10) <= 0 || parseInt(repayAmount, 10) > walletCoins}
                      onClick={() => repayLoanAction.mutate({ amount: parseInt(repayAmount, 10) })}
                    >
                      Repay
                    </Button>
                  </div>
                </div>
              </div>
            </Panel>
          ) : (
            <Panel title="Request a Gold Loan">
              <div className="stack" style={{ gap: "1.25rem" }}>
                <p style={{ color: "#aaa", fontSize: "0.85rem", margin: 0 }}>
                  Need urgent capital for gear or crafting? Borrow gold directly from the Crown Vault. Loans carry a flat 15% interest rate and must be repaid within 24 hours.
                </p>

                <div style={{ background: "#111", border: "1px solid #222", padding: "1rem", borderRadius: "6px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "#888" }}>Your Borrowing Limit</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--gold, #d4af37)", marginTop: "0.25rem" }}>
                        {fmt(maxLoan)} coins
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#666" }}>Based on Hero Level {hero.level}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "#888" }}>Interest Rate</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff", marginTop: "0.25rem" }}>
                        15% Flat
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#666" }}>24-hour term</div>
                    </div>
                  </div>
                </div>

                <div className="stack" style={{ gap: "0.75rem" }}>
                  <label style={{ fontSize: "0.8rem", color: "#888" }}>Borrow Amount (100 - {fmt(maxLoan)})</label>
                  <div className="row" style={{ gap: "0.5rem" }}>
                    <input
                      type="number"
                      placeholder={`Max ${maxLoan}`}
                      value={borrowAmount}
                      onChange={(e) => setBorrowAmount(e.target.value)}
                      style={{
                        flex: 1,
                        background: "#141414",
                        border: "1px solid #333",
                        color: "#fff",
                        padding: "0.6rem 0.8rem",
                        borderRadius: "4px",
                      }}
                    />
                    <Button size="sm" variant="ghost" onClick={() => setBorrowAmount(String(maxLoan))}>Max</Button>
                    <Button
                      variant="primary"
                      loading={takeLoanAction.isPending}
                      disabled={!borrowAmount || parseInt(borrowAmount, 10) < 100 || parseInt(borrowAmount, 10) > maxLoan}
                      onClick={() => takeLoanAction.mutate({ amount: parseInt(borrowAmount, 10) })}
                    >
                      Borrow Gold
                    </Button>
                  </div>
                  {borrowAmount && parseInt(borrowAmount, 10) >= 100 && (
                    <div style={{ fontSize: "0.8rem", color: "#aaa" }}>
                      You will receive <strong>{fmt(parseInt(borrowAmount, 10))}</strong> coins and owe <strong>{fmt(Math.round(parseInt(borrowAmount, 10) * 1.15))}</strong> coins upon maturity.
                    </div>
                  )}
                </div>
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
