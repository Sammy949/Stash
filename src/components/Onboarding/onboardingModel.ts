import type { Currency } from "@/types";

/** ───────────────── What onboarding learns ───────────────── */

/**
 * How money reaches this person. The whole product exists for the first case,
 * so asking is not idle curiosity: it decides how Stash reads a quiet week
 * (normal for a freelancer, a warning sign for a salary) and it is the first
 * durable thing Stash knows about you.
 */
export type IncomeShape = "irregular" | "regular" | "mixed";

export interface IncomeShapeOption {
  value: IncomeShape;
  label: string;
  detail: string;
  /** Seeded into memory verbatim, so recall reads as a sentence about a person. */
  memory: string;
}

export const INCOME_SHAPES: IncomeShapeOption[] = [
  {
    value: "irregular",
    label: "In bursts",
    detail: "Gigs, clients, allowances. Uneven, and hard to predict.",
    memory: "Income arrives in uneven bursts (freelance, gigs, allowances)",
  },
  {
    value: "regular",
    label: "On a schedule",
    detail: "Roughly the same amount, at roughly the same time.",
    memory: "Income is regular and predictable",
  },
  {
    value: "mixed",
    label: "A bit of both",
    detail: "Something steady, topped up by work that comes and goes.",
    memory: "Income is part steady, part irregular top-ups",
  },
];

/** Everything the first run collects. Goal fields are optional by design. */
export interface OnboardingProfile {
  owner: string;
  currency: Currency;
  openingBalance: number;
  incomeShape: IncomeShape;
  /** Null when skipped. */
  goal: { name: string; targetAmount: number } | null;
}

/** ───────────────── Steps ───────────────── */

export const STEPS = ["name", "balance", "income", "goal"] as const;
export type StepId = (typeof STEPS)[number];

export const TOTAL_STEPS = STEPS.length;

/**
 * Parse a typed money string into whole units.
 *
 * Deliberately forgiving: people type "1,200", "£240", "240.50" or "12k". Strips
 * everything that is not a digit or a separator, expands a trailing k/m, and
 * never returns NaN, a negative, or a non-integer. Opening balance CAN be 0.
 *
 * Negatives are read as their magnitude rather than rejected: "how much do you
 * have" is never a negative answer, and being overdrawn is expressed by logging
 * expenses, not by typing a minus sign.
 */
export function parseAmount(raw: string): number {
  const cleaned = raw.trim().toLowerCase().replace(/[^\d.,km]/g, "");
  if (!cleaned) return 0;

  const mult = cleaned.endsWith("m") ? 1_000_000 : cleaned.endsWith("k") ? 1_000 : 1;
  // Commas are thousands separators here, never decimal marks: the field shows a
  // currency symbol and asks for a total, so "1,5" means 15 far more often than
  // it means 1.5 in this context.
  const numeric = cleaned.replace(/[km]$/, "").replace(/,/g, "");
  const parsed = parseFloat(numeric);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;

  const scaled = Math.round(parsed * mult);
  // Clamp to the safe-integer range. Past 2^53 arithmetic silently loses
  // precision, so a fat-fingered paste would corrupt every derived figure rather
  // than being obviously wrong.
  return Math.min(scaled, Number.MAX_SAFE_INTEGER);
}
