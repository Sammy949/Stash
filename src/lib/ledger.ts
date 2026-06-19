import type {
  Budget,
  Hustle,
  Ledger,
  Scholarship,
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
