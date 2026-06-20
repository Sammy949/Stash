import { VaultCard } from "@/components/Dashboard/VaultCard";
import { ScholarshipRadar } from "@/components/Dashboard/ScholarshipRadar";
import { HustleLedger } from "@/components/Dashboard/HustleLedger";
import { Toaster } from "sonner";
import { ChatWindow } from "@/components/Agent/ChatWindow";
import { SYNC_CHIP } from "@/components/Agent/QuickChips";
import { useLedger } from "@/hooks/useLedger";
import { useAgent } from "@/hooks/useAgent";
import { parseExpense } from "@/lib/ledger";

const SYNC_CONFIRMATION =
  "Your financial data is encrypted and stored on 0G's decentralized network. Nobody else can access it. It'll be here next time you open Stash.";

export default function App() {
  const { ledger, hydrating, syncPhase, sync, logExpense } = useLedger();
  const { messages, isThinking, send, pushAssistant } = useAgent();

  async function handleSend(text: string) {
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

    // 2. Natural-language expense → update dashboard + sync, agent acks.
    const expense = parseExpense(text);
    if (expense) {
      const updated = logExpense(expense);
      void sync(updated);
      void send(text, updated);
      return;
    }

    // 3. Everything else → the agent, with live ledger context.
    void send(text, ledger);
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-4">
          <img src="/vault.svg" alt="" className="h-7 w-7" />
          <div>
            <h1 className="text-base font-semibold leading-none">Stash</h1>
            <p className="mt-1 text-xs text-muted">
              Know where you stand. See what&apos;s coming. Stay ahead.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* LEFT: Dashboard — 40% */}
          <div className="space-y-6 lg:col-span-2">
            <VaultCard
              ledger={ledger}
              syncPhase={syncPhase}
              hydrating={hydrating}
            />
            <ScholarshipRadar scholarships={ledger.scholarships} />
            <HustleLedger hustles={ledger.hustles} />
          </div>

          {/* RIGHT: Stash Agent — 60% */}
          <div className="lg:col-span-3 lg:h-[calc(100vh-9rem)]">
            <ChatWindow
              messages={messages}
              onSend={handleSend}
              isThinking={isThinking}
            />
          </div>
        </div>
      </main>

      {/* richColors gives full vibrant success/error fills — no custom
          style override (that would defeat richColors). */}
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
    </div>
  );
}
