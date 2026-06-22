import { useState } from "react";

/**
 * First-run onboarding. Lightweight by design: welcome → name, then hand
 * off to the command bar. No auth yet — the wallet/0G identity owns the
 * data. The dashboard starts empty and grows from the first entry.
 */
export function Onboarding({
  onComplete,
}: {
  onComplete: (name: string) => void;
}) {
  const [step, setStep] = useState<0 | 1>(0);
  const [name, setName] = useState("");

  function finish(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    onComplete(n);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 text-ink">
      <div className="w-full max-w-sm">
        <img src="/vault.svg" alt="" className="mb-6 h-12 w-12" />

        {step === 0 ? (
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
            <button
              onClick={() => setStep(1)}
              className="mt-7 w-full rounded-xl bg-emerald px-4 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
            >
              Get started
            </button>
          </div>
        ) : (
          <form onSubmit={finish} className="animate-slide-up">
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
            <p className="mt-3 text-xs text-muted">Currency · ₦ Naira</p>
            <button
              type="submit"
              disabled={!name.trim()}
              className="mt-6 w-full rounded-xl bg-emerald px-4 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Enter Stash
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
