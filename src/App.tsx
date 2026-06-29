import { useState } from "react";
import { Toaster } from "sonner";
import { Dashboard } from "@/components/Dashboard/Dashboard";
import { DashboardStrip } from "@/components/Dashboard/DashboardStrip";
import { AgentPanel } from "@/components/Agent/AgentPanel";
import { CommandBar } from "@/components/Agent/CommandBar";
import { SYNC_CHIP } from "@/components/Agent/QuickChips";
import { Onboarding } from "@/components/Onboarding/Onboarding";
import type { OnboardingProfile } from "@/components/Onboarding/Onboarding";
import { useLedger } from "@/hooks/useLedger";
import { useAgent } from "@/hooks/useAgent";
import { ensureStorageSchema, getStoredRootHash } from "@/lib/ogStorage";
import { deriveObservation } from "@/lib/observations";

// One-time forced reset onto the new local-first schema (runs once at load,
// before any hook reads localStorage).
ensureStorageSchema();

const ONBOARDED_KEY = "stash_onboarded";

const SYNC_CONFIRMATION =
  "Your financial data is encrypted and stored on 0G's decentralized network. Nobody else can access it. It'll be here next time you open Stash.";

export default function App() {
  const { ledger, hydrating, syncPhase, sync, applyLedger, initProfile } =
    useLedger();
  const { messages, isThinking, send, stop, pushAssistant, editMessage } =
    useAgent();

  // Returning users (a synced ledger exists) skip onboarding.
  const [onboarded, setOnboarded] = useState(
    () =>
      Boolean(localStorage.getItem(ONBOARDED_KEY)) ||
      Boolean(getStoredRootHash()),
  );

  // Split-Shift: dashboard is full by default; asking anything opens the
  // agent panel (dashboard condenses to a strip). Tap the strip to return.
  const [agentActive, setAgentActive] = useState(false);

  function completeOnboarding(profile: OnboardingProfile) {
    initProfile(profile);
    localStorage.setItem(ONBOARDED_KEY, "1");
    setOnboarded(true);
  }

  if (!onboarded) {
    return <Onboarding onComplete={completeOnboarding} />;
  }

  async function handleSend(text: string) {
    setAgentActive(true);

    // 1. "Sync to 0G" chip → real storage sync, no Compute needed.
    if (text === SYNC_CHIP) {
      const ok = await sync();
      pushAssistant(
        ok
          ? SYNC_CONFIRMATION
          : "I couldn't sync to 0G Storage just now — the upload didn't go through. Check the toast for details and try again.",
      );
      return;
    }

    // 2. Everything else → the agent. It may call tools that mutate the
    //    ledger; when it does, persist the new ledger and sync to 0G.
    const before = ledger;
    void send(text, ledger, (updated) => {
      applyLedger(updated);
      void sync(updated);
      // Proactive observation — code (not the model) notices when a money
      // event collides with something Stash remembers, and adds one nudge
      // after the agent's reply. Stays silent when there's nothing to say.
      const observation = deriveObservation(before, updated);
      if (observation) pushAssistant(observation);
    });
  }

  // Edit a past message and re-run from there. The ledger is RESTORED from the
  // message's snapshot (never replayed), the transcript is rewound, and the
  // edited turn runs from that exact state. We persist locally throughout and
  // back up to 0G once at the end, so corrections stay durable.
  function handleEditMessage(id: string, newText: string) {
    setAgentActive(true);
    let before = ledger;
    void (async () => {
      await editMessage(
        id,
        newText,
        (snapshot) => {
          before = snapshot;
          applyLedger(snapshot);
        },
        (updated) => {
          applyLedger(updated);
          const observation = deriveObservation(before, updated);
          if (observation) pushAssistant(observation);
        },
      );
      void sync();
    })();
  }

  return (
    <div className="h-screen bg-bg text-ink">
      {/* Centered platform column — doesn't stretch on wide screens. */}
      <div className="mx-auto flex h-full max-w-2xl flex-col">
        {/* Top bar */}
        <header className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-3">
          <img src="/vault.svg" alt="" className="h-7 w-7" />
          <div>
            <h1 className="text-sm font-semibold leading-none">Stash</h1>
            <p className="mt-1 text-[11px] text-muted">
              Know where you stand. See what&apos;s coming. Stay ahead.
            </p>
          </div>
        </header>

        {/* Content — Split-Shift */}
        {agentActive ? (
          <div className="flex min-h-0 flex-1 animate-slide-up flex-col">
            <DashboardStrip ledger={ledger} onExpand={() => setAgentActive(false)} />
            <AgentPanel
              messages={messages}
              onEditMessage={handleEditMessage}
              isThinking={isThinking}
            />
          </div>
        ) : (
          <main className="flex-1 overflow-y-auto px-4 py-6">
            <Dashboard
              ledger={ledger}
              syncPhase={syncPhase}
              hydrating={hydrating}
            />
          </main>
        )}

        {/* Command bar — always present */}
        <div className="shrink-0">
          <CommandBar onSend={handleSend} onStop={stop} isThinking={isThinking} />
        </div>
      </div>

      <Toaster theme="dark" position="bottom-right" richColors closeButton />
    </div>
  );
}
