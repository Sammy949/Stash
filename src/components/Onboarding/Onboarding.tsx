import { useState } from "react";
import type { Currency } from "@/types";
import { CURRENCY_LIST, currencySymbol } from "@/lib/currency";
import { OnboardingVisual } from "./OnboardingVisual";

export interface OnboardingProfile {
  owner: string;
  currency: Currency;
  openingBalance: number;
}

/**
 * First-run onboarding: welcome → name → currency → opening balance.
 * Floating split-layout — form on the left, a "Stash Core" system visual on
 * the right (desktop only; mobile is form-only). Lightweight and intentional:
 * no auth (the wallet/0G identity owns the data).
 */
export function Onboarding({
  onComplete,
}: {
  onComplete: (profile: OnboardingProfile) => void;
}) {
  const [step, setStep] = useState(0);
  // Furthest step the user has reached — they can jump back to any of these
  // (entries are preserved in state), but not skip ahead past unvisited steps.
  const [maxStep, setMaxStep] = useState(0);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<Currency>("NGN");
  const [openingText, setOpeningText] = useState("");

  const total = 4;

  /** Advance forward (from a validated Continue), unlocking the new step. */
  function go(n: number) {
    setStep(n);
    setMaxStep((m) => Math.max(m, n));
  }

  function finish() {
    // Back-nav could leave the name blank — don't submit an empty owner.
    if (!name.trim()) {
      setStep(1);
      return;
    }
    const opening = Math.max(
      0,
      Math.round(parseFloat(openingText.replace(/[^\d.]/g, "")) || 0),
    );
    onComplete({ owner: name.trim(), currency, openingBalance: opening });
  }

  return (
    <div className="flex min-h-dvh overflow-y-auto bg-bg p-4 py-[max(1rem,env(safe-area-inset-top))] text-ink md:p-8">
      {/* Floating card — split on desktop, form-only on mobile. `m-auto` centers
          when there's room but lets the card scroll into view (top and bottom)
          when a small screen + open keyboard make it taller than the viewport,
          so the primary CTA is never trapped behind the keyboard. */}
      <div className="m-auto grid w-full max-w-4xl overflow-hidden rounded-3xl border border-line bg-card/20 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.85)] md:grid-cols-2">
        {/* ── Form side ─────────────────────────────────────────── */}
        <div className="flex flex-col justify-center p-6 sm:p-10">
          <div className="mx-auto w-full max-w-sm">
            {/* Brand + step indicator */}
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/vault.svg" alt="" className="h-8 w-8" />
                <span className="label-caps text-sm text-ink">Stash</span>
              </div>
              <span className="label-caps text-[10px] text-muted">
                Step {step + 1} of {total}
              </span>
            </div>

            {/* Progress segments — click a reached one to jump back and edit.
                Unreached steps are inert (plain spans): not clickable, and the
                cursor stays normal — no disabled/blocked-cursor affordance. */}
            <div className="mb-8 flex gap-1.5">
              {Array.from({ length: total }).map((_, i) => {
                const reached = i <= maxStep;
                const bar = (
                  <span
                    className={`block h-1 rounded-full transition-colors ${
                      i <= step
                        ? "bg-emerald"
                        : reached
                          ? "bg-line group-hover:bg-emerald/50"
                          : "bg-line"
                    }`}
                  />
                );
                return reached ? (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setStep(i)}
                    aria-label={`Go to step ${i + 1}`}
                    aria-current={i === step ? "step" : undefined}
                    className="group -my-2 flex-1 cursor-pointer py-2"
                  >
                    {bar}
                  </button>
                ) : (
                  <span key={i} aria-hidden className="-my-2 flex-1 py-2">
                    {bar}
                  </span>
                );
              })}
            </div>

            {step === 0 && (
              <div className="animate-slide-up">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Welcome to Stash
                </h1>
                <p className="mt-3 text-base font-medium text-ink">
                  Your financial memory.
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Track money, remember what matters, and get guidance that grows
                  with you.
                </p>
                <Primary onClick={() => go(1)}>Get started</Primary>
              </div>
            )}

            {step === 1 && (
              <form
                className="animate-slide-up"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim()) go(2);
                }}
              >
                <h1 className="text-2xl font-semibold tracking-tight">
                  What should I call you?
                </h1>
                <p className="mt-2 text-sm text-muted">
                  Just a name — no email, no password.
                </p>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  aria-label="Your name"
                  className="mt-5 w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted focus:border-emerald/50"
                />
                <Primary type="submit" disabled={!name.trim()}>
                  Continue
                </Primary>
              </form>
            )}

            {step === 2 && (
              <div className="animate-slide-up">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Which currency?
                </h1>
                <p className="mt-2 text-sm text-muted">
                  The currency you earn and spend in.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {CURRENCY_LIST.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => setCurrency(c.code)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                        currency === c.code
                          ? "border-emerald/60 bg-emerald/10 text-ink"
                          : "border-line bg-card text-muted hover:text-ink"
                      }`}
                    >
                      <span className="font-data w-7 shrink-0 text-base font-semibold">
                        {c.symbol}
                      </span>
                      <span className="min-w-0">
                        <span className="block leading-none">{c.code}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {c.name}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                <Primary onClick={() => go(3)}>Continue</Primary>
              </div>
            )}

            {step === 3 && (
              <form
                className="animate-slide-up"
                onSubmit={(e) => {
                  e.preventDefault();
                  finish();
                }}
              >
                <h1 className="text-2xl font-semibold tracking-tight">
                  How much do you have right now?
                </h1>
                <p className="mt-2 text-sm text-muted">
                  Your current balance to start from. Skip it to start at zero.
                </p>
                <div className="mt-5 flex items-center rounded-xl border border-line bg-card px-3.5 focus-within:border-emerald/50">
                  <span className="font-data mr-2 text-sm text-muted">
                    {currencySymbol(currency)}
                  </span>
                  <input
                    autoFocus
                    inputMode="decimal"
                    value={openingText}
                    onChange={(e) => setOpeningText(e.target.value)}
                    placeholder="0"
                    aria-label={`Opening balance in ${currency}`}
                    className="font-data w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted"
                  />
                </div>
                <Primary type="submit">Enter Stash</Primary>
              </form>
            )}
          </div>
        </div>

        {/* ── Visual side (desktop only) ────────────────────────── */}
        <OnboardingVisual step={step} currency={currency} />
      </div>
    </div>
  );
}

function Primary({
  children,
  onClick,
  type = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="mt-7 w-full rounded-xl bg-emerald px-4 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
