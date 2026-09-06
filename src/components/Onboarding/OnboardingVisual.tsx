import type { Currency } from "@/types";
import { BalanceInstrument } from "@/components/Dashboard/BalanceInstrument";
import { formatMoney } from "@/lib/currency";
import { useOnboardingPreview } from "./onboardingPreview";
import type { IncomeShape, StepId } from "./onboardingModel";

/**
 * The right-hand panel: the instrument being calibrated.
 *
 * This replaces four decorative scenes (a radar sweep, counter-rotating orbits,
 * orbiting currency coins behind a blue glow, and a fake terminal boot log). All
 * of that was ornament that taught nothing about the product, and it held the
 * last hardcoded colours in the app.
 *
 * What shows instead is the real `BalanceInstrument`, fed a ledger built from
 * whatever has been answered so far, so the thing you are setting up IS the
 * thing you are looking at and the dashboard is familiar before you reach it.
 *
 * Desktop only, like the scenes it replaces. Nothing depends on it.
 */
export function OnboardingVisual({
  step,
  owner,
  currency,
  openingBalance,
  incomeShape,
  goalName,
  goalTarget,
}: {
  step: StepId;
  owner: string;
  currency: Currency;
  openingBalance: number;
  incomeShape: IncomeShape | null;
  goalName: string;
  goalTarget: number;
}) {
  const { ledger, illustrative } = useOnboardingPreview({
    currency,
    openingBalance,
    incomeShape,
    step,
  });

  const showGoal = step === "goal" && goalName.trim().length > 0 && goalTarget > 0;
  const named = owner.trim();

  return (
    <aside
      className="relative hidden flex-col justify-center gap-4 bg-secondary/40 p-8 md:flex"
      aria-hidden
    >
      {/* Who this belongs to. Appears the moment a name is typed, so the panel
          reads as "yours" rather than as a generic sample. */}
      <div className="min-h-5">
        <span className="label-caps text-[10px] text-muted-foreground">
          {named ? `${named}'s balance` : "Your balance"}
        </span>
      </div>

      <BalanceInstrument ledger={ledger} />

      {/* The goal as a target line under the instrument rather than another card,
          so it reads as part of the same measurement. Fixed min-height reserves
          the space, so arriving at step 4 does not shove the instrument upward. */}
      <div className="min-h-[4.5rem]">
        {showGoal && (
          <div className="animate-slide-up rounded-lg bg-card p-3 ring-1 ring-foreground/10">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-xs font-medium">{goalName.trim()}</span>
              <span className="font-data shrink-0 text-xs text-muted-foreground">
                {formatMoney(0, currency)} / {formatMoney(goalTarget, currency)}
              </span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-sm bg-secondary">
              {/* Deliberately empty: nothing has been set aside yet, and showing
                  invented progress would be a lie on the very first screen. */}
              <div className="h-full w-0 rounded-sm bg-success" />
            </div>
          </div>
        )}
      </div>

      {/* Says plainly that the shape is a sample. Without this the trace reads as
          data the user never entered, which would undermine every real number
          Stash shows afterwards. */}
      <p className="min-h-10 text-[11px] leading-relaxed text-muted-foreground">
        {illustrative
          ? "An example of how that pattern looks over a month. Your own trace starts empty and fills in as you tell Stash about real money."
          : "This is the instrument you will land on. It fills in as you go."}
      </p>
    </aside>
  );
}
