import { randomBytes } from "node:crypto";
import { GameError, notFound } from "../lib/errors.ts";
import { HOUR } from "../lib/time.ts";
import type { GameCtx } from "./context.ts";
import { type Player, grantCoins, spendCoins } from "./player.ts";

export interface FixedDeposit {
  id: string;
  amount: number;
  interestRate: number; // e.g. 0.02, 0.08, 0.18, 0.40
  durationHours: number;
  createdAt: number;
  matureAt: number;
  claimed: boolean;
}

export interface ActiveLoan {
  amount: number;
  totalOwed: number;
  interestRate: number;
  takenAt: number;
  dueAt: number;
  lastPenaltyAt: number;
}

export interface PlayerBankState {
  savings: number;
  fds: FixedDeposit[];
  loan: ActiveLoan | null;
}

export const FD_TIERS = [
  { hours: 1, rate: 0.02, label: "1 Hour", desc: "+2% yield" },
  { hours: 6, rate: 0.08, label: "6 Hours", desc: "+8% yield" },
  { hours: 12, rate: 0.18, label: "12 Hours", desc: "+18% yield" },
  { hours: 24, rate: 0.40, label: "24 Hours", desc: "+40% yield" },
] as const;

export const LOAN_RATE = 0.15;
export const LOAN_TERM_HOURS = 24;
export const OVERDUE_PENALTY_RATE = 0.05;
export const MAX_ACTIVE_FDS = 10;
export const MIN_FD_AMOUNT = 100;
export const MIN_LOAN_LEVEL = 3;

export function ensureBank(p: Player): PlayerBankState {
  if (!p.state.bank) {
    p.state.bank = { savings: 0, fds: [], loan: null };
  }
  if (typeof p.state.bank.savings !== "number" || p.state.bank.savings < 0) {
    p.state.bank.savings = 0;
  }
  if (!Array.isArray(p.state.bank.fds)) {
    p.state.bank.fds = [];
  }
  return p.state.bank;
}

export function maxLoanAmount(p: Player): number {
  if (p.level < MIN_LOAN_LEVEL) return 0;
  return Math.max(500, p.level * 300);
}

function applyLoanPenalties(loan: ActiveLoan, now: number) {
  if (now <= loan.dueAt) return;
  const overdueInterval = 24 * HOUR;
  // Calculate how many 24h intervals have passed since lastPenaltyAt
  const elapsedSinceLast = now - loan.lastPenaltyAt;
  if (elapsedSinceLast >= overdueInterval) {
    const intervals = Math.floor(elapsedSinceLast / overdueInterval);
    const penaltyPerInterval = Math.max(1, Math.round(loan.amount * OVERDUE_PENALTY_RATE));
    loan.totalOwed += penaltyPerInterval * intervals;
    loan.lastPenaltyAt += intervals * overdueInterval;
  }
}

export function getBankView(g: GameCtx, p: Player) {
  const bank = ensureBank(p);
  const now = g.clock.now();

  if (bank.loan) {
    applyLoanPenalties(bank.loan, now);
  }

  const fds = bank.fds.map((fd) => {
    const timeRemaining = Math.max(0, fd.matureAt - now);
    const matured = now >= fd.matureAt;
    const payout = Math.floor(fd.amount * (1 + fd.interestRate));
    return {
      ...fd,
      timeRemaining,
      matured,
      payout,
      profit: payout - fd.amount,
    };
  });

  const loan = bank.loan
    ? {
        ...bank.loan,
        overdue: now > bank.loan.dueAt,
        timeRemaining: Math.max(0, bank.loan.dueAt - now),
      }
    : null;

  return {
    savings: bank.savings,
    coins: p.coins,
    fds,
    loan,
    maxLoan: maxLoanAmount(p),
    fdTiers: FD_TIERS,
  };
}

export function depositSavings(g: GameCtx, p: Player, coins: number) {
  const bank = ensureBank(p);
  const amt = Math.floor(coins);
  if (amt < 1) throw new GameError("Enter a valid deposit amount.");
  spendCoins(p, amt, "bank deposit");
  bank.savings += amt;
  return { savings: bank.savings, deposited: amt };
}

export function withdrawSavings(g: GameCtx, p: Player, coins: number) {
  const bank = ensureBank(p);
  const amt = Math.floor(coins);
  if (amt < 1) throw new GameError("Enter a valid withdrawal amount.");
  if (bank.savings < amt) throw new GameError("You do not have that many coins in savings.");
  bank.savings -= amt;
  grantCoins(g, p, amt);
  return { savings: bank.savings, withdrawn: amt };
}

export function createFixedDeposit(g: GameCtx, p: Player, coins: number, durationHours: number) {
  const bank = ensureBank(p);
  const tier = FD_TIERS.find((t) => t.hours === durationHours);
  if (!tier) throw new GameError("Invalid fixed deposit duration.");

  const amt = Math.floor(coins);
  if (amt < MIN_FD_AMOUNT) throw new GameError(`Minimum fixed deposit is ${MIN_FD_AMOUNT.toLocaleString()} coins.`);
  if (bank.fds.filter((f) => !f.claimed).length >= MAX_ACTIVE_FDS) {
    throw new GameError(`You can only have up to ${MAX_ACTIVE_FDS} active fixed deposits.`);
  }

  spendCoins(p, amt, `fixed deposit (${tier.label})`);
  const now = g.clock.now();
  const matureAt = now + tier.hours * HOUR;

  const fd: FixedDeposit = {
    id: randomBytes(6).toString("hex"),
    amount: amt,
    interestRate: tier.rate,
    durationHours: tier.hours,
    createdAt: now,
    matureAt,
    claimed: false,
  };

  bank.fds.push(fd);
  return fd;
}

export function claimFixedDeposit(g: GameCtx, p: Player, fdId: string) {
  const bank = ensureBank(p);
  const now = g.clock.now();
  const idx = bank.fds.findIndex((f) => f.id === fdId);
  if (idx === -1) throw notFound("Fixed deposit");

  const fd = bank.fds[idx]!;
  if (fd.claimed) throw new GameError("That deposit has already been claimed.");
  if (now < fd.matureAt) {
    const mins = Math.ceil((fd.matureAt - now) / 60000);
    throw new GameError(`Deposit has not matured yet. Wait another ${mins} minute(s).`);
  }

  const payout = Math.floor(fd.amount * (1 + fd.interestRate));
  grantCoins(g, p, payout);
  // Remove matured and claimed deposit
  bank.fds.splice(idx, 1);

  return { payout, profit: payout - fd.amount };
}

export function takeLoan(g: GameCtx, p: Player, coins: number) {
  const bank = ensureBank(p);
  if (p.level < MIN_LOAN_LEVEL) throw new GameError(`Loans unlock at Level ${MIN_LOAN_LEVEL}.`);
  if (bank.loan) throw new GameError("You already have an active loan. Repay it before taking another.");

  const max = maxLoanAmount(p);
  const amt = Math.floor(coins);
  if (amt < 100) throw new GameError("Minimum loan amount is 100 coins.");
  if (amt > max) throw new GameError(`Maximum loan you can borrow is ${max.toLocaleString()} coins.`);

  const now = g.clock.now();
  const totalOwed = Math.round(amt * (1 + LOAN_RATE));
  const dueAt = now + LOAN_TERM_HOURS * HOUR;

  bank.loan = {
    amount: amt,
    totalOwed,
    interestRate: LOAN_RATE,
    takenAt: now,
    dueAt,
    lastPenaltyAt: dueAt,
  };

  grantCoins(g, p, amt);
  return bank.loan;
}

export function repayLoan(g: GameCtx, p: Player, coins: number) {
  const bank = ensureBank(p);
  if (!bank.loan) throw new GameError("You do not have an active loan.");

  const now = g.clock.now();
  applyLoanPenalties(bank.loan, now);

  const reqAmt = Math.floor(coins);
  if (reqAmt < 1) throw new GameError("Enter a valid repayment amount.");

  const toPay = Math.min(reqAmt, bank.loan.totalOwed);
  spendCoins(p, toPay, "loan repayment");

  bank.loan.totalOwed -= toPay;
  const cleared = bank.loan.totalOwed <= 0;
  if (cleared) {
    bank.loan = null;
  }

  return {
    repaid: toPay,
    cleared,
    remainingOwed: bank.loan ? bank.loan.totalOwed : 0,
  };
}
