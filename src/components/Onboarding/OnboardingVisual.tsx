import type { Currency } from "@/types";
import { currencySymbol } from "@/lib/currency";
import { LockIcon } from "@/components/UI/icons";

/**
 * The right-hand "Stash Core" system visual (desktop only). Each onboarding
 * step gets a distinct, animated scene so the panel feels alive and makes the
 * product feel worth exploring. Motion is calm (slow rotation, gentle float)
 * and respects prefers-reduced-motion (see index.css).
 */

const SCENES = [
  {
    tag: "Secure Foundation",
    title: "Stash is listening",
    body: "An agent that watches your whole financial picture — income, deadlines, goals — and acts on it.",
  },
  {
    tag: "Identity",
    title: "Just you",
    body: "No email, no password. Your wallet owns the data; Stash simply remembers what matters.",
  },
  {
    tag: "Base Currency",
    title: "Grounded in your world",
    body: "Everything Stash tracks is denominated in the currency you actually live and earn in.",
  },
  {
    tag: "Baseline",
    title: "Your starting point",
    body: "Tell Stash where you stand today — every number from here on is derived, never guessed.",
  },
];

export function OnboardingVisual({
  step,
  currency,
}: {
  step: number;
  currency: Currency;
}) {
  const scene = SCENES[step] ?? SCENES[0];
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden border-l border-line bg-gradient-to-b from-card/70 to-bg p-8 md:flex">
      <GridBackdrop />

      {/* System status header */}
      <div className="label-caps relative z-10 flex items-center justify-between text-[10px] text-muted">
        <span>Stash Core</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald" />
          0G · Secure
        </span>
      </div>

      {/* The scene */}
      <div className="relative z-10 flex flex-1 items-center justify-center py-6">
        <Scene step={step} currency={currency} />
      </div>

      {/* Caption — re-keyed per step so it re-animates on change */}
      <div key={step} className="relative z-10 animate-slide-up">
        <p className="label-caps text-[10px] text-emerald">{scene.tag}</p>
        <p className="mt-2 text-lg font-semibold tracking-tight text-ink">
          {scene.title}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{scene.body}</p>
      </div>
    </div>
  );
}

function Scene({ step, currency }: { step: number; currency: Currency }) {
  // Re-key each scene so swapping steps replays its entry animation.
  if (step === 1) return <IdentityScene key="id" />;
  if (step === 2) return <CurrencyScene key="cur" currency={currency} />;
  if (step === 3) return <LedgerScene key="led" />;
  return <RadarScene key="radar" />;
}

/** Faint blueprint grid, radially masked toward the centre. */
function GridBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.18]"
      style={{
        backgroundImage:
          "linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
        maskImage: "radial-gradient(circle at 50% 45%, black, transparent 72%)",
        WebkitMaskImage:
          "radial-gradient(circle at 50% 45%, black, transparent 72%)",
      }}
    />
  );
}

/** Step 0 — a radar sweep over concentric rings, with blips. */
function RadarScene() {
  return (
    <div className="relative h-60 w-60 animate-slide-up">
      {/* rotating sweep wedge */}
      <div
        className="absolute inset-0 animate-spin-slow rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(59,130,246,0) 0deg, rgba(59,130,246,0.22) 48deg, rgba(59,130,246,0) 72deg)",
        }}
      />
      <svg viewBox="0 0 200 200" className="absolute inset-0">
        <circle cx="100" cy="100" r="92" strokeWidth="1" className="fill-none stroke-line" />
        <circle cx="100" cy="100" r="66" strokeWidth="1" className="fill-none stroke-line" />
        <circle cx="100" cy="100" r="40" strokeWidth="1.25" className="fill-none stroke-emerald/40" />
        <line x1="100" y1="8" x2="100" y2="192" strokeWidth="0.75" strokeDasharray="2 5" className="stroke-line" />
        <line x1="8" y1="100" x2="192" y2="100" strokeWidth="0.75" strokeDasharray="2 5" className="stroke-line" />
        <circle cx="100" cy="100" r="11" strokeWidth="1.5" className="fill-bg stroke-emerald" />
        <circle cx="100" cy="100" r="3.5" className="fill-emerald" />
      </svg>
      {/* blips */}
      <span className="absolute left-[70%] top-[36%] h-1.5 w-1.5 animate-pulse rounded-full bg-emerald" />
      <span className="absolute left-[34%] top-[64%] h-1.5 w-1.5 animate-pulse rounded-full bg-emerald [animation-delay:0.8s]" />
    </div>
  );
}

/** Step 1 — an identity node with two counter-rotating orbits. */
function IdentityScene() {
  return (
    <div className="relative flex h-60 w-60 animate-slide-up items-center justify-center">
      <div className="absolute inset-8 rounded-full border border-line" />
      <div className="absolute inset-16 rounded-full border border-line/60" />

      <div className="absolute inset-8 animate-spin-slower">
        <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-emerald" />
      </div>
      <div className="absolute inset-16 animate-spin-rev">
        <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-muted" />
      </div>

      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald/40 bg-emerald/10">
        <LockIcon className="h-6 w-6 text-emerald" />
      </div>
    </div>
  );
}

const ORBIT_CODES: Currency[] = ["USD", "EUR", "GBP", "NGN", "KES", "ZAR"];

/** Step 2 — the chosen currency at the centre, others orbiting it. */
function CurrencyScene({ currency }: { currency: Currency }) {
  const others = ORBIT_CODES.filter((c) => c !== currency).slice(0, 5);
  return (
    <div className="relative flex h-60 w-60 animate-slide-up items-center justify-center">
      <div className="absolute inset-3 rounded-full border border-line/70" />
      <div className="absolute inset-16 rounded-full border border-line/40" />

      {/* rotating orbit carrying the other currency symbols */}
      <div className="absolute inset-0 animate-spin-slower">
        {others.map((code, i) => {
          const angle = (i / others.length) * 2 * Math.PI - Math.PI / 2;
          const left = 50 + 44 * Math.cos(angle);
          const top = 50 + 44 * Math.sin(angle);
          return (
            <span
              key={code}
              className="font-data absolute -translate-x-1/2 -translate-y-1/2 text-sm text-muted"
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              {currencySymbol(code)}
            </span>
          );
        })}
      </div>

      {/* chosen currency */}
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-emerald/40 bg-emerald/10">
        <span className="font-data text-3xl font-semibold text-emerald">
          {currencySymbol(currency)}
        </span>
      </div>
    </div>
  );
}

const BARS = [42, 66, 30, 82, 54];

/** Step 3 — a live ledger card: bars rise, a boot-log confirms. */
function LedgerScene() {
  return (
    <div className="w-64 animate-float rounded-xl border border-line bg-card/80 p-4 shadow-[0_16px_50px_-20px_rgba(0,0,0,0.8)]">
      <div className="label-caps flex items-center justify-between text-[9px] text-muted">
        <span>Ledger · Baseline</span>
        <span className="flex items-center gap-1 text-emerald">
          <span className="h-1 w-1 animate-pulse rounded-full bg-emerald" />
          Live
        </span>
      </div>

      <div className="mt-4 flex h-20 items-end gap-2">
        {BARS.map((h, i) => (
          <div
            key={i}
            className={`flex-1 animate-rise rounded-sm ${
              i === 3 ? "bg-emerald" : "bg-emerald/25"
            }`}
            style={{ height: `${h}%`, animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>

      <div className="font-data mt-4 space-y-1 text-[10px] text-muted">
        <p>
          &gt; SET_BASELINE ········ <span className="text-emerald">[OK]</span>
        </p>
        <p>
          &gt; DERIVE_RUNWAY ······· <span className="text-emerald">[OK]</span>
        </p>
        <p>
          &gt; AWAIT_INPUT{" "}
          <span className="animate-blink">▍</span>
        </p>
      </div>
    </div>
  );
}
