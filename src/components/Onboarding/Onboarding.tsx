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
    <div className="flex min-h-screen items-center justify-center bg-bg p-4 text-ink md:p-8">
      {/* Floating card — split on desktop, form-only on mobile. */}
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-line bg-card/20 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.85)] md:grid-cols-2">
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

            {/* Progress segments */}
            <div className="mb-8 flex gap-1.5">
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
                <h1 className="text-2xl font-semibold tracking-tight">
                  Welcome to Stash
                </h1>
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
                    className="font-data w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted"
                  />
                </div>
                <Primary type="submit">Enter Stash</Primary>
              </form>
            )}
          </div>
        </div>

        {/* ── Visual side (desktop only) ────────────────────────── */}
        <OnboardingVisual step={step} />
      </div>
    </div>
  );
}

/** Per-step caption for the visual panel. */
const SCENES = [
  {
    tag: "Secure Foundation",
    title: "Encrypted on 0G",
    body: "Your financial memory is sovereign — encrypted on 0G's decentralized network, readable only by you.",
  },
  {
    tag: "Identity",
    title: "Just you",
    body: "No email, no password. Your wallet owns the data; Stash simply remembers.",
  },
  {
    tag: "Base Currency",
    title: "Grounded in your world",
    body: "Everything Stash tracks is denominated in the currency you actually live in.",
  },
  {
    tag: "Baseline",
    title: "Your starting point",
    body: "Tell Stash where you stand today — it derives every number from here on.",
  },
];

/** The right-hand "Stash Core" system visual — desktop only. */
function OnboardingVisual({ step }: { step: number }) {
  const scene = SCENES[step] ?? SCENES[0];
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden border-l border-line bg-gradient-to-b from-card/70 to-bg p-8 md:flex">
      <div className="label-caps flex items-center justify-between text-[10px] text-muted">
        <span>Stash Core</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
          0G · Secure
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center py-8">
        <CoreScene />
      </div>

      <div className="animate-slide-up" key={step}>
        <p className="label-caps text-[10px] text-emerald">{scene.tag}</p>
        <p className="mt-2 text-lg font-semibold tracking-tight text-ink">
          {scene.title}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{scene.body}</p>
      </div>
    </div>
  );
}

/** Concentric-ring "core" mark — hairline rings + a single accent node. */
function CoreScene() {
  return (
    <svg viewBox="0 0 200 200" className="h-auto w-full max-w-[300px]">
      <circle cx="100" cy="100" r="70" className="fill-emerald/[0.06]" />
      {/* concentric rings */}
      <circle cx="100" cy="100" r="84" strokeWidth="1" className="fill-none stroke-line" />
      <circle cx="100" cy="100" r="64" strokeWidth="1" className="fill-none stroke-line" />
      <circle cx="100" cy="100" r="44" strokeWidth="1.25" className="fill-none stroke-emerald/40" />
      <circle cx="100" cy="100" r="24" strokeWidth="1" className="fill-none stroke-line" />
      {/* crosshair */}
      <line x1="100" y1="8" x2="100" y2="192" strokeWidth="0.75" strokeDasharray="2 5" className="stroke-line" />
      <line x1="8" y1="100" x2="192" y2="100" strokeWidth="0.75" strokeDasharray="2 5" className="stroke-line" />
      {/* orbit nodes */}
      <circle cx="144" cy="100" r="3" className="animate-pulse fill-emerald" />
      <circle cx="100" cy="36" r="2" className="fill-muted" />
      <circle cx="62" cy="138" r="2" className="fill-muted" />
      {/* center */}
      <circle cx="100" cy="100" r="11" strokeWidth="1.5" className="fill-bg stroke-emerald" />
      <circle cx="100" cy="100" r="3.5" className="fill-emerald" />
    </svg>
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
