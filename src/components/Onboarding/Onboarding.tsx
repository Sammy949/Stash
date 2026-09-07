import { useState } from "react";
import type { Currency } from "@/types";
import { CURRENCY_LIST, currencySymbol } from "@/lib/currency";
import { Button } from "@/components/shadcn/button";
import { ButtonGroup } from "@/components/shadcn/button-group";
import { Input } from "@/components/shadcn/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/shadcn/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/shadcn/field";
import { StashMark } from "@/components/UI/StashMark";
import { OnboardingVisual } from "./OnboardingVisual";
import {
  INCOME_SHAPES,
  STEPS,
  TOTAL_STEPS,
  parseAmount,
  type IncomeShape,
  type OnboardingProfile,
  type StepId,
} from "./onboardingModel";

export type { OnboardingProfile } from "./onboardingModel";

/**
 * First run. Four steps, no auth, nothing leaves the device.
 *
 * What changed and why: the old flow spent a whole screen on a welcome message
 * and then asked for currency and opening balance separately, collecting three
 * facts in four steps and writing NOTHING to memory. This asks for four facts in
 * the same four steps by collapsing currency into the amount field (they are one
 * decision) and putting the welcome copy on step 1 where it costs nothing.
 *
 * The two new questions are the ones that make Stash *Stash*: how money reaches
 * you, which is the entire premise of the product, and what you are working
 * toward. Both are seeded into Sibyl memory by App on completion, so the very
 * first session already has something to recall. The goal is skippable, because
 * a required aspiration is a bad first impression.
 *
 * Deliberately still no login: the hackathon rules require none, and a wallet is
 * only needed later, at the point of locking money into a vault.
 */
export function Onboarding({
  onComplete,
}: {
  onComplete: (profile: OnboardingProfile) => void;
}) {
  const [index, setIndex] = useState(0);
  const [maxIndex, setMaxIndex] = useState(0);

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<Currency>("NGN");
  const [amountText, setAmountText] = useState("");
  const [incomeShape, setIncomeShape] = useState<IncomeShape | null>(null);
  const [goalName, setGoalName] = useState("");
  const [goalText, setGoalText] = useState("");

  const step: StepId = STEPS[index];
  const openingBalance = parseAmount(amountText);
  const goalTarget = parseAmount(goalText);

  function go(next: number) {
    setIndex(next);
    setMaxIndex((m) => Math.max(m, next));
  }

  function finish() {
    const owner = name.trim();
    // Back-navigation could have emptied a required field; return rather than
    // submitting a half-built profile.
    if (!owner) return go(0);
    if (!incomeShape) return go(2);

    onComplete({
      owner,
      currency,
      openingBalance,
      incomeShape,
      goal:
        goalName.trim() && goalTarget > 0
          ? { name: goalName.trim(), targetAmount: goalTarget }
          : null,
    });
  }

  return (
    <div className="flex min-h-dvh overflow-y-auto bg-background p-4 py-[max(1rem,env(safe-area-inset-top))] text-foreground md:p-8">
      {/* m-auto centres when there is room but still lets the card scroll into
          view when a small screen plus an open keyboard makes it taller than the
          viewport, so the primary action is never trapped behind the keyboard. */}
      <div className="m-auto grid w-full max-w-4xl overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10 md:grid-cols-2">
        <div className="flex flex-col justify-center p-6 sm:p-10">
          <div className="mx-auto w-full max-w-sm">
            <Header index={index} maxIndex={maxIndex} onJump={setIndex} />

            {step === "name" && (
              <StepName
                name={name}
                onName={setName}
                onNext={() => name.trim() && go(1)}
              />
            )}

            {step === "balance" && (
              <StepBalance
                currency={currency}
                onCurrency={setCurrency}
                amountText={amountText}
                onAmount={setAmountText}
                onNext={() => go(2)}
              />
            )}

            {step === "income" && (
              <StepIncome
                value={incomeShape}
                onChange={(v) => {
                  setIncomeShape(v);
                  go(3);
                }}
              />
            )}

            {step === "goal" && (
              <StepGoal
                currency={currency}
                goalName={goalName}
                onGoalName={setGoalName}
                goalText={goalText}
                onGoalText={setGoalText}
                onFinish={finish}
              />
            )}
          </div>
        </div>

        <OnboardingVisual
          step={step}
          owner={name}
          currency={currency}
          openingBalance={openingBalance}
          incomeShape={incomeShape}
          goalName={goalName}
          goalTarget={goalTarget}
        />
      </div>
    </div>
  );
}

/** Brand, progress, and back-navigation to any step already reached. */
function Header({
  index,
  maxIndex,
  onJump,
}: {
  index: number;
  maxIndex: number;
  onJump: (n: number) => void;
}) {
  return (
    <div className="mb-8">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StashMark className="h-7 w-7" />
          <span className="text-sm font-semibold">Stash</span>
        </div>
        <span className="font-data text-[11px] text-muted-foreground">
          {index + 1}/{TOTAL_STEPS}
        </span>
      </div>

      {/* Reached steps are real buttons back to an answer; unreached ones are
          inert spans, so there is no disabled affordance to fight with. */}
      <div className="flex gap-1.5">
        {STEPS.map((id, i) => {
          const reached = i <= maxIndex;
          const cls = `h-0.5 flex-1 rounded-sm transition-colors ${
            i <= index ? "bg-foreground" : "bg-border"
          }`;
          return reached ? (
            <button
              key={id}
              type="button"
              onClick={() => onJump(i)}
              aria-label={`Back to step ${i + 1}`}
              className={`${cls} cursor-pointer`}
            />
          ) : (
            <span key={id} className={cls} />
          );
        })}
      </div>
    </div>
  );
}

function StepName({
  name,
  onName,
  onNext,
}: {
  name: string;
  onName: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <form
      className="animate-slide-up"
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
    >
      <h1 className="text-2xl font-semibold tracking-tight">
        What should Stash call you?
      </h1>
      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
        Stash is a financial memory: it keeps track of your money and what you
        are working toward. No email, no password, and nothing leaves this
        device unless you ask it to.
      </p>
      <Input
        autoFocus
        value={name}
        onChange={(e) => onName(e.target.value)}
        placeholder="Your name"
        aria-label="Your name"
        className="mt-6 h-11 text-base"
      />
      <Button type="submit" size="lg" disabled={!name.trim()} className="mt-6 w-full">
        Continue
      </Button>
    </form>
  );
}

/**
 * Currency and opening balance as ONE decision, which is what they are: the
 * currency lives inside the amount field as an addon, so you read it as
 * "£ ___" rather than answering two questions about the same number.
 */
function StepBalance({
  currency,
  onCurrency,
  amountText,
  onAmount,
  onNext,
}: {
  currency: Currency;
  onCurrency: (c: Currency) => void;
  amountText: string;
  onAmount: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <form
      className="animate-slide-up"
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
    >
      <h1 className="text-2xl font-semibold tracking-tight">
        How much do you have right now?
      </h1>
      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
        Everything Stash tracks starts from here. A rough figure is fine, and you
        can correct it any time by telling Stash.
      </p>

      <ButtonGroup className="mt-6">
        <NativeSelect
          value={currency}
          onChange={(e) => onCurrency(e.target.value as Currency)}
          aria-label="Currency"
          className="font-data h-11 w-auto [&_select]:h-full"
          size="default"
        >
          {CURRENCY_LIST.map((c) => (
            <NativeSelectOption key={c.code} value={c.code}>
              {c.symbol} {c.code}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Input
          autoFocus
          value={amountText}
          onChange={(e) => onAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          aria-label={`Amount in ${currency}`}
          className="font-data h-11 flex-1 text-base"
        />
      </ButtonGroup>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Starting from nothing is fine. Leave it at zero.
      </p>

      <Button type="submit" size="lg" className="mt-6 w-full">
        Continue
      </Button>
    </form>
  );
}

/**
 * The question the whole product rests on. Answering it is what lets Stash read
 * a quiet week correctly: normal for a freelancer, a warning for a salary.
 *
 * Picking an option advances immediately: it is a choice, not a form, and making
 * someone select then press Continue is a wasted tap.
 */
function StepIncome({
  value,
  onChange,
}: {
  value: IncomeShape | null;
  onChange: (v: IncomeShape) => void;
}) {
  return (
    <div className="animate-slide-up">
      <h1 className="text-2xl font-semibold tracking-tight">
        How does money reach you?
      </h1>
      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
        This is the one thing most money apps assume wrongly. Stash uses it to
        judge whether a quiet week is normal for you or worth mentioning.
      </p>

      <RadioGroup
        value={value ?? ""}
        onValueChange={(v) => onChange(v as IncomeShape)}
        className="mt-6 flex flex-col gap-2.5"
      >
        {INCOME_SHAPES.map((opt) => (
          // FieldLabel ships the selectable-card pattern, including its checked
          // state, and it is a real <label> wrapping a real radio, so the whole
          // card is clickable and keyboard-navigable without any hand-rolling.
          <FieldLabel key={opt.value} htmlFor={`income-${opt.value}`}>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>{opt.label}</FieldTitle>
                <FieldDescription>{opt.detail}</FieldDescription>
              </FieldContent>
              <RadioGroupItem value={opt.value} id={`income-${opt.value}`} />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
    </div>
  );
}

/**
 * Optional by design. A required aspiration is a bad first impression, and the
 * agent can create goals conversationally later, which is the intended route
 * anyway.
 */
function StepGoal({
  currency,
  goalName,
  onGoalName,
  goalText,
  onGoalText,
  onFinish,
}: {
  currency: Currency;
  goalName: string;
  onGoalName: (v: string) => void;
  goalText: string;
  onGoalText: (v: string) => void;
  onFinish: () => void;
}) {
  const partial =
    (goalName.trim().length > 0) !== (parseAmount(goalText) > 0);

  return (
    <form
      className="animate-slide-up"
      onSubmit={(e) => {
        e.preventDefault();
        onFinish();
      }}
    >
      <h1 className="text-2xl font-semibold tracking-tight">
        Anything you are working toward?
      </h1>
      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
        One thing you are saving for. Stash will hold it, track what you set
        aside, and tell you when a purchase pushes it further away.
      </p>

      <Input
        autoFocus
        value={goalName}
        onChange={(e) => onGoalName(e.target.value)}
        placeholder="A laptop, next term's fees, a trip"
        aria-label="What you are saving for"
        className="mt-6 h-11 text-base"
      />

      <ButtonGroup className="mt-2.5">
        <div
          data-slot="button-group-text"
          className="flex h-11 items-center rounded-lg border border-input bg-transparent px-3 text-sm"
        >
          <span className="font-data text-muted-foreground">
            {currencySymbol(currency)}
          </span>
        </div>
        <Input
          value={goalText}
          onChange={(e) => onGoalText(e.target.value)}
          inputMode="decimal"
          placeholder="How much it costs"
          aria-label={`Target amount in ${currency}`}
          className="font-data h-11 flex-1 text-base"
        />
      </ButtonGroup>

      {/* Only nudge when one half is filled: silence is not an error here. */}
      <p className="mt-2 min-h-4 text-[11px] text-warning">
        {partial ? "Add both a name and an amount, or skip for now." : ""}
      </p>

      <Button type="submit" size="lg" className="mt-4 w-full">
        {goalName.trim() && parseAmount(goalText) > 0
          ? "Start with this goal"
          : "Enter Stash"}
      </Button>
      {/* Only offered while the goal is empty or half-filled. Once both fields
          are valid the primary button already says what happens, and a "skip"
          next to a completed answer just invites you to discard your own work. */}
      {!(goalName.trim() && parseAmount(goalText) > 0) && (
        <button
          type="button"
          onClick={onFinish}
          className="mt-3 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip, I will tell Stash later
        </button>
      )}
    </form>
  );
}
