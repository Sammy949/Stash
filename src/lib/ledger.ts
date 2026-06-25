import type {
  Hustle,
  Ledger,
  ParsedTransaction,
  Scholarship,
  Transaction,
  UrgencyColor,
} from "@/types";
import { formatMoney } from "@/lib/currency";

/**
 * Ledger state management — seed data + pure helpers.
 *
 * Money in/out (transactions) are the source of truth; the spendable
 * balance is always DERIVED (never stored): see `balance()`.
 */

/**
 * A brand-new user's ledger — the empty-first starting point. Onboarding
 * fills in owner/currency/openingBalance; everything else grows from the
 * user's own entries. No hardcoded demo data anywhere.
 */
export const EMPTY_LEDGER: Ledger = {
  version: 2,
  owner: "",
  currency: "NGN",
  openingBalance: 0,
  monthlyBudget: null,
  transactions: [],
  scholarships: [],
  hustles: [],
  lastSyncedAt: null,
};

/** ───────────────── Formatting ───────────────── */

/** Human "Last synced" string; null → not yet synced. */
export function formatSyncedAt(iso: string | null): string {
  if (!iso) return "Not yet synced to 0G";
  const time = new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `Last synced: ${time}`;
}

/** ───────────────── Balance math (derived) ───────────────── */

export function totalIncome(ledger: Ledger): number {
  return ledger.transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
}

export function totalExpenses(ledger: Ledger): number {
  return ledger.transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
}

/** Spendable balance = opening + income − expenses. Never stored. */
export function balance(ledger: Ledger): number {
  return ledger.openingBalance + totalIncome(ledger) - totalExpenses(ledger);
}

/**
 * Percentage for the Vault ring, 0–100. Against the monthly budget cap if
 * one is set, otherwise against total inflow (opening + income).
 */
export function outflowPct(ledger: Ledger): number {
  const spent = totalExpenses(ledger);
  const denom =
    ledger.monthlyBudget && ledger.monthlyBudget > 0
      ? ledger.monthlyBudget
      : ledger.openingBalance + totalIncome(ledger);
  if (denom <= 0) return 0;
  return Math.min(100, Math.max(0, (spent / denom) * 100));
}

/**
 * "Decision context" — the facts a wise friend would notice, computed in
 * code (the accountant) so the agent never has to do arithmetic. Fields are
 * omitted when not meaningful (e.g. runway with too little history), so we
 * never hand the model a garbage number it would faithfully repeat.
 */
export interface DecisionContext {
  balance: number;
  /** Whole days of money left at the current average spend pace, if known. */
  runwayDays: number | null;
  /** Whether the balance is now below zero. */
  inTheRed: boolean;
  /** Average spend per active day, if there's enough history. */
  avgDailySpend: number | null;
}

export function decisionContext(
  ledger: Ledger,
  now: Date = new Date(),
): DecisionContext {
  const bal = balance(ledger);
  const expenses = ledger.transactions.filter((t) => t.type === "expense");

  // Average daily spend needs a real span and a couple of data points to
  // mean anything — otherwise runway is noise (e.g. "0.5 days" on day one).
  let avgDailySpend: number | null = null;
  let runwayDays: number | null = null;
  if (expenses.length >= 3) {
    const times = expenses.map((t) => new Date(t.createdAt).getTime());
    const firstTs = Math.min(...times);
    const spanDays = Math.max(1, (now.getTime() - firstTs) / 86_400_000);
    if (spanDays >= 1) {
      avgDailySpend = totalExpenses(ledger) / spanDays;
      if (avgDailySpend > 0 && bal > 0) {
        runwayDays = Math.floor(bal / avgDailySpend);
      }
    }
  }

  return { balance: bal, runwayDays, inTheRed: bal < 0, avgDailySpend };
}

/** ───────────────── Scholarship urgency ───────────────── */

/** Whole days from `now` until an ISO date (negative = past). */
export function daysUntil(isoDate: string, now: Date = new Date()): number {
  const MS_PER_DAY = 86_400_000;
  const target = new Date(isoDate).setHours(0, 0, 0, 0);
  const today = new Date(now).setHours(0, 0, 0, 0);
  return Math.round((target - today) / MS_PER_DAY);
}

/**
 * Urgency band for the radar. Deadline-bearing entries are derived
 * dynamically (red <7d, amber <30d, else emerald); status-only entries
 * fall back to their stored color.
 */
export function deriveUrgency(s: Scholarship, now: Date = new Date()): UrgencyColor {
  if (s.deadline) {
    const d = daysUntil(s.deadline, now);
    if (d < 7) return "red";
    if (d < 30) return "amber";
    return "emerald";
  }
  return s.color;
}

/** Short countdown/status text for a scholarship's right-side badge. */
export function radarBadge(s: Scholarship, now: Date = new Date()): string {
  if (s.deadline) {
    const d = daysUntil(s.deadline, now);
    if (d < 0) return "Closed";
    if (d === 0) return "Due today";
    return `${d} ${d === 1 ? "day" : "days"}`;
  }
  return s.statusLabel;
}

/** ───────────────── Hustle totals ───────────────── */

/** Sum of recurring monthly income from currently-active streams. */
export function totalActiveIncome(hustles: Hustle[]): number {
  return hustles
    .filter((h) => h.status === "active")
    .reduce((sum, h) => sum + h.monthlyValue, 0);
}

/** ───────────────── Mutations (pure) ───────────────── */

/** Window in which an identical transaction is treated as a duplicate. */
const DEDUPE_WINDOW_MS = 90_000;

/**
 * True if an identical transaction (same type + amount + label) was logged
 * within the dedupe window — the model re-logging the same item, or a
 * retry after a failed sync. Deterministic; doesn't rely on model discipline.
 */
export function isDuplicateTransaction(
  ledger: Ledger,
  parsed: ParsedTransaction,
  now: number = Date.now(),
): boolean {
  const label = parsed.label.trim().toLowerCase();
  return ledger.transactions.some(
    (t) =>
      t.type === parsed.type &&
      t.amount === parsed.amount &&
      t.label.trim().toLowerCase() === label &&
      now - new Date(t.createdAt).getTime() < DEDUPE_WINDOW_MS,
  );
}

/** Append a transaction. Balance recomputes automatically (it's derived). */
export function addTransaction(ledger: Ledger, parsed: ParsedTransaction): Ledger {
  const tx: Transaction = {
    id: crypto.randomUUID(),
    type: parsed.type,
    amount: parsed.amount,
    label: parsed.label,
    category: parsed.category,
    tag: parsed.tag,
    createdAt: new Date().toISOString(),
  };
  return { ...ledger, transactions: [...ledger.transactions, tx] };
}

/** Remove a transaction by id (for corrections / agent actions). */
export function removeTransaction(ledger: Ledger, id: string): Ledger {
  return {
    ...ledger,
    transactions: ledger.transactions.filter((t) => t.id !== id),
  };
}

/** Remove the most recently logged transaction (agent "undo that"). */
export function removeLastTransaction(ledger: Ledger): Ledger {
  if (ledger.transactions.length === 0) return ledger;
  return { ...ledger, transactions: ledger.transactions.slice(0, -1) };
}

/** Set (or clear) the optional monthly budget cap. */
export function setMonthlyBudget(ledger: Ledger, amount: number | null): Ledger {
  return {
    ...ledger,
    monthlyBudget: amount && amount > 0 ? Math.round(amount) : null,
  };
}

/** Normalize a date string to YYYY-MM-DD, or null if unparseable. */
function normalizeDate(input?: string | null): string | null {
  if (!input) return null;
  const t = Date.parse(input);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/** Add a scholarship to the radar (agent action). */
export function addScholarship(
  ledger: Ledger,
  input: { name: string; deadline?: string | null },
): Ledger {
  const deadline = normalizeDate(input.deadline);
  const s: Scholarship = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    status: deadline ? "deadline" : "pending_confirmation",
    statusLabel: deadline ? "Deadline" : "Tracking",
    deadline: deadline ?? undefined,
    color: deadline ? "amber" : "muted",
  };
  return { ...ledger, scholarships: [...ledger.scholarships, s] };
}

/** Add an income stream / hustle (agent action). */
export function addHustle(
  ledger: Ledger,
  input: { name: string; amount?: number; recurring?: boolean },
): Ledger {
  const amount = input.amount && input.amount > 0 ? Math.round(input.amount) : 0;
  const recurring = Boolean(input.recurring);
  const h: Hustle = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    amountLabel: amount
      ? `${formatMoney(amount, ledger.currency)}${recurring ? "/mo" : ""}`
      : "—",
    monthlyValue: recurring ? amount : 0,
    status: recurring ? "active" : amount ? "received" : "building",
    tag: "Other",
  };
  return { ...ledger, hustles: [...ledger.hustles, h] };
}

/** Remove the first scholarship/hustle whose name matches (case-insensitive). */
export function removeScholarshipByName(ledger: Ledger, name: string): Ledger {
  const q = name.trim().toLowerCase();
  const idx = ledger.scholarships.findIndex((s) =>
    s.name.toLowerCase().includes(q),
  );
  if (idx < 0) return ledger;
  return {
    ...ledger,
    scholarships: ledger.scholarships.filter((_, i) => i !== idx),
  };
}

export function removeHustleByName(ledger: Ledger, name: string): Ledger {
  const q = name.trim().toLowerCase();
  const idx = ledger.hustles.findIndex((h) => h.name.toLowerCase().includes(q));
  if (idx < 0) return ledger;
  return { ...ledger, hustles: ledger.hustles.filter((_, i) => i !== idx) };
}

/** ───────────────── Migration ───────────────── */

/**
 * Normalize a ledger loaded from 0G/localStorage into the current (v2)
 * shape. Guards against NaN when an older v1 ledger (budget: {total,spent})
 * is restored: maps budget.total → monthlyBudget, synthesizes a single
 * expense for the old `spent` so the balance stays consistent.
 */
export function migrateLedger(raw: unknown): Ledger {
  if (!raw || typeof raw !== "object") return EMPTY_LEDGER;
  const r = raw as Record<string, unknown>;

  // Already v2.
  if (typeof r.openingBalance === "number" && Array.isArray(r.transactions)) {
    return {
      ...(r as unknown as Ledger),
      monthlyBudget: (r.monthlyBudget as number | null) ?? null,
    };
  }

  // v1 → v2.
  const budget = r.budget as { total?: number; spent?: number } | undefined;
  const transactions = Array.isArray(r.transactions)
    ? (r.transactions as Transaction[])
    : [];
  if (budget?.spent && budget.spent > 0) {
    transactions.push({
      id: "tx-legacy-spent",
      type: "expense",
      amount: budget.spent,
      label: "Previous spending",
      category: "other",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  }
  return {
    version: 2,
    owner: (r.owner as string) ?? "",
    currency: "NGN",
    openingBalance: 0,
    monthlyBudget: budget?.total ?? null,
    transactions,
    scholarships: (r.scholarships as Ledger["scholarships"]) ?? [],
    hustles: (r.hustles as Ledger["hustles"]) ?? [],
    lastSyncedAt: (r.lastSyncedAt as string | null) ?? null,
  };
}
