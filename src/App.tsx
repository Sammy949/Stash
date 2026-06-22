import { useState } from "react";
import { Toaster } from "sonner";
import { Dashboard } from "@/components/Dashboard/Dashboard";
import { DashboardStrip } from "@/components/Dashboard/DashboardStrip";
import { AgentPanel } from "@/components/Agent/AgentPanel";
import { CommandBar } from "@/components/Agent/CommandBar";
import { SYNC_CHIP } from "@/components/Agent/QuickChips";
import { Onboarding } from "@/components/Onboarding/Onboarding";
import { useLedger } from "@/hooks/useLedger";
import { useAgent } from "@/hooks/useAgent";
import { parseTransaction } from "@/lib/ledger";
import { getStoredRootHash } from "@/lib/ogStorage";

const ONBOARDED_KEY = "stash_onboarded";

const SYNC_CONFIRMATION =
  "Your financial data is encrypted and stored on 0G's decentralized network. Nobody else can access it. It'll be here next time you open Stash.";

export default function App() {
  const { ledger, hydrating, syncPhase, sync, logTransaction, setOwner } =
    useLedger();
  const { messages, isThinking, send, pushAssistant } = useAgent();

  // Returning users (a synced ledger exists) skip onboarding.
  const [onboarded, setOnboarded] = useState(
    () =>
      Boolean(localStorage.getItem(ONBOARDED_KEY)) ||
      Boolean(getStoredRootHash()),
  );

  // Split-Shift: dashboard is full by default; asking anything opens the
  // agent panel (dashboard condenses to a strip). Tap the strip to return.
  const [agentActive, setAgentActive] = useState(false);

  function completeOnboarding(name: string) {
    setOwner(name);
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

    // 2. Natural-language money statement (income or expense) → update
    //    dashboard + sync, agent acknowledges with the new numbers.
    const txn = parseTransaction(text);
    if (txn) {
      const updated = logTransaction(txn);
      void sync(updated);
      void send(text, updated);
      return;
    }

    // 3. Everything else → the agent, with live ledger context.
    void send(text, ledger);
  }

  return (
    <div className="flex h-screen flex-col bg-bg text-ink">
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
          <AgentPanel messages={messages} />
        </div>
      ) : (
        <main className="flex-1 overflow-y-auto px-4 py-6">
          <Dashboard ledger={ledger} syncPhase={syncPhase} hydrating={hydrating} />
        </main>
      )}

      {/* Command bar — always present */}
      <div className="shrink-0">
        <CommandBar onSend={handleSend} isThinking={isThinking} />
      </div>

      <Toaster theme="dark" position="bottom-right" richColors closeButton />
    </div>
  );
}
