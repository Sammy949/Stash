import type {
  Budget,
  ExpenseCategory,
  Hustle,
  Ledger,
  ParsedExpense,
  Scholarship,
  Transaction,
  UrgencyColor,
} from "@/types";

/**
 * Ledger state management — seed data + pure helpers.
 *
 * Mutations (addExpense/addIncome) land in step 5; this file currently
 * exports the seed ledger plus the pure derived-value helpers the
 * dashboard needs (percentages, remaining, deadline countdowns,
 * urgency bands, totals, formatting).
 */

export const SEED_LEDGER: Ledger = {
  version: 1,
  owner: "Samuel",
  currency: "NGN",
  budget: { total: 45_000, spent: 21_400 },
  transactions: [],
  scholarships: [
    {
      id: "mext",
      name: "MEXT Japanese Government Scholarship 2027",
      status: "documents_submitted",
      statusLabel: "Documents Submitted",
      color: "emerald",
    },
    {
      id: "mastercard",
      name: "Mastercard Foundation Scholars Program",
      status: "deadline",
      statusLabel: "Deadline",
      deadline: "2026-07-15",
      color: "amber",
    },
    {
      id: "alu",
      name: "ALU Rwanda BSc Software Engineering",
      status: "pending_confirmation",
      statusLabel: "Pending Confirmation",
      color: "amber",
    },
    {
      id: "turkiye",
      name: "Türkiye Burslari Scholarship",
      status: "opens_later",
      statusLabel: "Opens Early 2027",
      color: "muted",
    },
    {
      id: "kgsp",
      name: "KGSP Korean Government Scholarship",
      status: "deadline",
      statusLabel: "Deadline",
      deadline: "2026-09-30",
      color: "emerald",
    },
  ],
  hustles: [
    {
      id: "cbhf",
      name: "Brand Identity — CBHF Project",
      amountLabel: "₦150,000",
      monthlyValue: 0,
      status: "received",
      tag: "Design",
    },
    {
      id: "bootcamp",
      name: "Coding Bootcamp Teaching",
      amountLabel: "₦25,000/mo",
      monthlyValue: 25_000,
      status: "active",
      tag: "Teaching",
    },
    {
      id: "logo",
      name: "Freelance Logo Design",
      amountLabel: "₦35,000",
      monthlyValue: 0,
      status: "pending",
      tag: "Design",
    },
    {
      id: "medium",
      name: "Medium Writing (@samywrites)",
      amountLabel: "₦0",
      monthlyValue: 0,
      status: "building",
      tag: "Writing",
    },
  ],
  lastSyncedAt: null,
};

/** ───────────────── Formatting ───────────────── */

/** "₦45,000" — Naira with thousands separators, no decimals. */
export function formatNaira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString("en-US")}`;
}

/** Human "Last synced" string; null → not yet synced. */
export function formatSyncedAt(iso: string | null): string {
  if (!iso) return "Not yet synced to 0G";
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `Last synced: ${time}`;
}

/** ───────────────── Budget math ───────────────── */

export function remaining(budget: Budget): number {
  return budget.total - budget.spent;
}

/** Percentage of budget spent, clamped to 0–100. */
export function spentPct(budget: Budget): number {
  if (budget.total <= 0) return 0;
  return Math.min(100, Math.max(0, (budget.spent / budget.total) * 100));
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
export function deriveUrgency(
  s: Scholarship,
  now: Date = new Date(),
): UrgencyColor {
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

/** ───────────────── Expense parsing ───────────────── */

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

  // Prefer the noun after "on"/"for" as the human label.
  const noun = lower.match(/\b(?:on|for)\s+([a-z][a-z\s]{1,30})/);
  const label = noun
    ? noun[1].trim().replace(/\s+(today|now|please)$/, "")
    : category === "other"
      ? "expense"
      : category;

  return { category, label: label.charAt(0).toUpperCase() + label.slice(1) };
}

/**
 * Parse a natural-language expense like "Spent ₦2,000 on transport" or
 * "₦3.5k for data". Returns null when the message isn't an expense
 * (no amount, or no spend signal) so it can fall through to the agent.
 */
export function parseExpense(text: string): ParsedExpense | null {
  const lower = text.toLowerCase();

  const amountMatch = lower.match(
    /(?:₦|ngn|naira)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m)?\b/,
  );
  if (!amountMatch) return null;

  let amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (amountMatch[2] === "k") amount *= 1_000;
  if (amountMatch[2] === "m") amount *= 1_000_000;
  if (!isFinite(amount) || amount <= 0) return null;

  const hasSpendVerb = /\b(spent|spend|paid|pay|bought|buy|cost|used)\b/.test(
    lower,
  );
  const hasCurrency = /₦|ngn|naira/.test(lower);
  // Need a spend signal so questions like "how much have I spent?" (no
  // amount) and statements like "I have 5000 left" don't get logged.
  if (!hasSpendVerb && !hasCurrency) return null;

  const { category, label } = categorize(lower);
  return { amount: Math.round(amount), label, category };
}

/** Append an expense and update the spent total. Returns a new ledger. */
export function addExpense(ledger: Ledger, parsed: ParsedExpense): Ledger {
  const tx: Transaction = {
    id: crypto.randomUUID(),
    type: "expense",
    amount: parsed.amount,
    label: parsed.label,
    category: parsed.category,
    createdAt: new Date().toISOString(),
  };
  return {
    ...ledger,
    transactions: [...ledger.transactions, tx],
    budget: { ...ledger.budget, spent: ledger.budget.spent + parsed.amount },
  };
}
