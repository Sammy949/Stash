import type {
  ExpenseCategory,
  Hustle,
  IncomeTag,
  Ledger,
  ParsedTransaction,
  Scholarship,
  Transaction,
  UrgencyColor,
} from "@/types";

/**
 * Ledger state management — seed data + pure helpers.
 *
 * Money in/out (transactions) are the source of truth; the spendable
 * balance is always DERIVED (never stored): see `balance()`.
 */

/** A brand-new user's ledger — the empty-first starting point (onboarding). */
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

/** Realistic demo ledger — balance is computed from these transactions. */
export const SEED_LEDGER: Ledger = {
  version: 2,
  owner: "Samuel",
  currency: "NGN",
  openingBalance: 0,
  monthlyBudget: 45_000,
  transactions: [
    // Income
    { id: "tx-cbhf", type: "income", amount: 150_000, label: "Brand Identity — CBHF Project", tag: "Design", createdAt: "2026-06-10T10:00:00.000Z" },
    { id: "tx-bootcamp", type: "income", amount: 25_000, label: "Coding Bootcamp Teaching", tag: "Teaching", createdAt: "2026-06-15T09:00:00.000Z" },
    // Expenses (sum ₦21,400)
    { id: "tx-e1", type: "expense", amount: 9_000, label: "Food", category: "food", createdAt: "2026-06-12T13:00:00.000Z" },
    { id: "tx-e2", type: "expense", amount: 5_000, label: "Data", category: "data", createdAt: "2026-06-13T08:00:00.000Z" },
    { id: "tx-e3", type: "expense", amount: 4_000, label: "Transport", category: "transport", createdAt: "2026-06-16T17:00:00.000Z" },
    { id: "tx-e4", type: "expense", amount: 2_400, label: "Printing", category: "printing", createdAt: "2026-06-17T11:00:00.000Z" },
    { id: "tx-e5", type: "expense", amount: 1_000, label: "Airtime", category: "airtime", createdAt: "2026-06-18T19:00:00.000Z" },
  ],
  scholarships: [
    { id: "mext", name: "MEXT Japanese Government Scholarship 2027", status: "documents_submitted", statusLabel: "Documents Submitted", color: "emerald" },
    { id: "mastercard", name: "Mastercard Foundation Scholars Program", status: "deadline", statusLabel: "Deadline", deadline: "2026-07-15", color: "amber" },
    { id: "alu", name: "ALU Rwanda BSc Software Engineering", status: "pending_confirmation", statusLabel: "Pending Confirmation", color: "amber" },
    { id: "turkiye", name: "Türkiye Burslari Scholarship", status: "opens_later", statusLabel: "Opens Early 2027", color: "muted" },
    { id: "kgsp", name: "KGSP Korean Government Scholarship", status: "deadline", statusLabel: "Deadline", deadline: "2026-09-30", color: "emerald" },
  ],
  hustles: [
    { id: "cbhf", name: "Brand Identity — CBHF Project", amountLabel: "₦150,000", monthlyValue: 0, status: "received", tag: "Design" },
    { id: "bootcamp", name: "Coding Bootcamp Teaching", amountLabel: "₦25,000/mo", monthlyValue: 25_000, status: "active", tag: "Teaching" },
    { id: "logo", name: "Freelance Logo Design", amountLabel: "₦35,000", monthlyValue: 0, status: "pending", tag: "Design" },
    { id: "medium", name: "Medium Writing (@samywrites)", amountLabel: "₦0", monthlyValue: 0, status: "building", tag: "Writing" },
  ],
  lastSyncedAt: null,
};

/** ───────────────── Formatting ───────────────── */

/** "₦45,000" — Naira with thousands separators, no decimals. */
export function formatNaira(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}₦${Math.abs(Math.round(amount)).toLocaleString("en-US")}`;
}

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

/** ───────────────── Natural-language parsing ───────────────── */

/** Keyword → category. First match wins. */
const CATEGORY_KEYWORDS: [ExpenseCategory, string[]][] = [
  ["transport", ["transport", "transit", "bus", "uber", "bolt", "taxi", "fuel", "fare", "ride", "cab"]],
  ["data", ["data", "subscription", "internet", "wifi", "mtn", "airtel", "glo", "9mobile"]],
  ["airtime", ["airtime", "recharge", "call credit"]],
  ["printing", ["print", "printing", "photocopy", "binding"]],
  ["food", ["food", "lunch", "dinner", "breakfast", "snack", "meal", "eat"]],
  ["rent", ["rent", "accommodation", "hostel"]],
];

function categorize(lower: string): { category: ExpenseCategory; label: string } {
  let category: ExpenseCategory = "other";
  for (const [cat, words] of CATEGORY_KEYWORDS) {
    if (words.some((w) => lower.includes(w))) {
      category = cat;
      break;
    }
  }
  const noun = lower.match(/\b(?:on|for|from)\s+([a-z][a-z\s]{1,30})/);
  const label = noun
    ? noun[1].trim().replace(/\s+(today|now|please)$/, "")
    : category === "other"
      ? "expense"
      : category;
  return { category, label: label.charAt(0).toUpperCase() + label.slice(1) };
}

/**
 * Parse a natural-language money statement into a transaction. Handles
 * both expenses ("Spent ₦2,000 on transport") and income ("got paid
 * ₦50k from a client"). Returns null when it isn't a money statement, so
 * it falls through to the conversational agent.
 */
export function parseTransaction(text: string): ParsedTransaction | null {
  const lower = text.toLowerCase();

  const amountMatch = lower.match(/(?:₦|ngn|naira)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m)?\b/);
  if (!amountMatch) return null;

  let amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (amountMatch[2] === "k") amount *= 1_000;
  if (amountMatch[2] === "m") amount *= 1_000_000;
  if (!isFinite(amount) || amount <= 0) return null;

  const incomeSignal =
    /\b(got paid|paid me|received|earned|made|income|deposit(?:ed)?|credited|salary|stipend|disbursed|sent me|cash(?:ed)? in)\b/.test(
      lower,
    );
  const expenseSignal = /\b(spent|spend|paid|pay|bought|buy|cost|used)\b/.test(lower);
  const hasCurrency = /₦|ngn|naira/.test(lower);

  // Income wins if an income phrase is present; otherwise treat as an
  // expense when there's a spend verb or a currency amount.
  if (incomeSignal) {
    const after = lower.match(/\bfrom\s+([a-z][a-z0-9\s]{1,30})/);
    const label = after
      ? after[1].trim().replace(/\s+(today|now|please)$/, "")
      : "income";
    return {
      type: "income",
      amount: Math.round(amount),
      label: label.charAt(0).toUpperCase() + label.slice(1),
      tag: "Other" as IncomeTag,
    };
  }

  if (!expenseSignal && !hasCurrency) return null;

  const { category, label } = categorize(lower);
  return { type: "expense", amount: Math.round(amount), label, category };
}

/** ───────────────── Mutations (pure) ───────────────── */

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

/** Remove a transaction by id (for corrections / future agent actions). */
export function removeTransaction(ledger: Ledger, id: string): Ledger {
  return {
    ...ledger,
    transactions: ledger.transactions.filter((t) => t.id !== id),
  };
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
