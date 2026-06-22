import { useState } from "react";
import type { Currency } from "@/types";
import { CURRENCY_LIST, currencySymbol } from "@/lib/currency";

export interface OnboardingProfile {
  owner: string;
  currency: Currency;
  openingBalance: number;
}

/**
 * First-run onboarding: welcome → name → currency → opening balance.
 * Lightweight and intentional — no auth (the wallet/0G identity owns the
 * data). After this, the dashboard grows from the user's own entries.
 */
export function Onboarding({
  onComplete,
}: {
  onComplete: (profile: OnboardingProfile) => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<Currency>("NGN");
  const [openingText, setOpeningText] = useState("");

  const total = 4;

  function finish() {
    const opening = Math.max(
      0,
      Math.round(parseFloat(openingText.replace(/[^\d.]/g, "")) || 0),
    );
    onComplete({ owner: name.trim(), currency, openingBalance: opening });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 text-ink">
      <div className="w-full max-w-sm">
        <img src="/vault.svg" alt="" className="mb-6 h-12 w-12" />

        {/* Progress dots */}
        <div className="mb-6 flex gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-emerald" : "bg-line"
              }`}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="animate-slide-up">
            <h1 className="text-2xl font-semibold">Welcome to Stash</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Your money, understood. Track what comes in and goes out, stay
              ahead of deadlines, and ask Stash anything.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Your financial memory is encrypted and stored on 0G&apos;s
              decentralized network — only you can read it.
            </p>
            <Primary onClick={() => setStep(1)}>Get started</Primary>
          </div>
        )}

        {step === 1 && (
          <form
            className="animate-slide-up"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) setStep(2);
            }}
          >
            <h1 className="text-2xl font-semibold">What should I call you?</h1>
            <p className="mt-2 text-sm text-muted">
              Just a name — no email, no password.
            </p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="mt-5 w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted focus:border-emerald/50"
            />
            <Primary type="submit" disabled={!name.trim()}>
              Continue
            </Primary>
          </form>
        )}

        {step === 2 && (
          <div className="animate-slide-up">
            <h1 className="text-2xl font-semibold">Which currency?</h1>
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
                  <span className="w-7 shrink-0 text-base font-semibold tabular-nums">
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
            <Primary onClick={() => setStep(3)}>Continue</Primary>
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
            <h1 className="text-2xl font-semibold">
              How much do you have right now?
            </h1>
            <p className="mt-2 text-sm text-muted">
              Your current balance to start from. Skip it to start at zero.
            </p>
            <div className="mt-5 flex items-center rounded-xl border border-line bg-card px-3.5 focus-within:border-emerald/50">
              <span className="mr-2 text-sm text-muted">
                {currencySymbol(currency)}
              </span>
              <input
                autoFocus
                inputMode="decimal"
                value={openingText}
                onChange={(e) => setOpeningText(e.target.value)}
                placeholder="0"
                className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted"
              />
            </div>
            <Primary type="submit">Enter Stash</Primary>
          </form>
        )}
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
