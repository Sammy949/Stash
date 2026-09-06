import { useMemo } from "react";
import type { Currency, Ledger, Transaction } from "@/types";
import { EMPTY_LEDGER } from "@/lib/ledger";
import type { IncomeShape, StepId } from "./onboardingModel";

/**
 * The onboarding visual: the user's OWN instrument, calibrating as they answer.
 *
 * This replaces four decorative scenes (a radar sweep, counter-rotating orbits,
 * orbiting currency coins behind a blue glow, and a fake terminal boot log). All
 * of it was ornament that taught nothing, and it held the last hardcoded colours
 * in the app.
 *
 * What it shows instead is the real `BalanceInstrument`, fed a ledger built from
 * whatever has been answered so far. The thing you are setting up IS the thing
 * you are looking at, so by the time onboarding ends the dashboard is already
 * familiar.
 *
 * The sample transactions are ILLUSTRATIVE and clearly labelled as such: they
 * shape the trace so the difference between bursty and steady income is visible.
 * They are never written to the ledger. `initProfile` starts from EMPTY_LEDGER,
 * so the real app begins genuinely empty, and Stash is empty-first for real.
 */

const DAY = 86_400_000;

/**
 * A deterministic 30-day shape per income pattern, as [dayOffset, type, factor]
 * where factor is a fraction of the opening balance. Fixed, not random, so the
 * trace does not twitch on every keystroke.
 */
const SHAPES: Record<IncomeShape, [number, "income" | "expense", number][]> = {
  // Two big arrivals, spent down between them: the freelance sawtooth.
  irregular: [
    [26, "income", 1.6],
    [24, "expense", 0.3],
    [20, "expense", 0.25],
    [16, "expense", 0.35],
    [12, "income", 1.9],
    [9, "expense", 0.4],
    [6, "expense", 0.3],
    [3, "expense", 0.28],
    [1, "expense", 0.15],
  ],
  // Even arrivals, even outflow: a gentle staircase.
  regular: [
    [28, "income", 0.9],
    [24, "expense", 0.3],
    [21, "expense", 0.25],
    [14, "income", 0.9],
    [12, "expense", 0.28],
    [8, "expense", 0.22],
    [4, "expense", 0.26],
    [1, "expense", 0.18],
  ],
  // A steady base with one lumpy top-up.
  mixed: [
    [27, "income", 0.8],
    [23, "expense", 0.28],
    [18, "expense", 0.22],
    [13, "income", 1.3],
    [10, "expense", 0.3],
    [6, "expense", 0.24],
    [2, "expense", 0.2],
  ],
};

/**
 * Build the preview ledger from answers so far.
 *
 * Before the income question is answered there are no sample transactions at all,
 * so the instrument shows its genuine empty/steady state rather than inventing
 * activity the user never described.
 */
export function previewLedger({
  currency,
  openingBalance,
  incomeShape,
  reachedIncome,
}: {
  currency: Currency;
  openingBalance: number;
  incomeShape: IncomeShape | null;
  reachedIncome: boolean;
}): Ledger {
  const base: Ledger = {
    ...EMPTY_LEDGER,
    currency,
    openingBalance,
  };

  if (!reachedIncome || !incomeShape) return base;

  // Scale off the stated balance so the trace is in the user's own magnitude. A
  // sensible floor keeps the shape visible when someone starts from zero.
  const unit = openingBalance > 0 ? openingBalance : 100;

  const now = Date.now();
  const transactions: Transaction[] = SHAPES[incomeShape].map(
    ([dayOffset, type, factor], i) => ({
      id: `preview-${i}`,
      type,
      amount: Math.round(unit * factor),
      label: type === "income" ? "Sample income" : "Sample spend",
      createdAt: new Date(now - dayOffset * DAY).toISOString(),
    }),
  );

  return { ...base, transactions };
}

/** Memoised wrapper, so typing in the amount field does not rebuild the array. */
export function useOnboardingPreview(args: {
  currency: Currency;
  openingBalance: number;
  incomeShape: IncomeShape | null;
  step: StepId;
}): { ledger: Ledger; illustrative: boolean } {
  const reachedIncome = args.step === "income" || args.step === "goal";
  const ledger = useMemo(
    () =>
      previewLedger({
        currency: args.currency,
        openingBalance: args.openingBalance,
        incomeShape: args.incomeShape,
        reachedIncome,
      }),
    [args.currency, args.openingBalance, args.incomeShape, reachedIncome],
  );
  return { ledger, illustrative: reachedIncome && args.incomeShape !== null };
}
