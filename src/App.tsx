import { VaultCard } from "@/components/Dashboard/VaultCard";
import { ScholarshipRadar } from "@/components/Dashboard/ScholarshipRadar";
import { HustleLedger } from "@/components/Dashboard/HustleLedger";
import { ChatWindow } from "@/components/Agent/ChatWindow";
import { useLedger } from "@/hooks/useLedger";
import { useAgent } from "@/hooks/useAgent";

export default function App() {
  const { ledger } = useLedger();
  const { messages } = useAgent();

  // Placeholder until step 5 wires the agent + ledger together.
  const handleSend = (text: string) => {
    console.log("send:", text);
  };

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
            <VaultCard ledger={ledger} />
            <ScholarshipRadar scholarships={ledger.scholarships} />
            <HustleLedger hustles={ledger.hustles} />
          </div>

          {/* RIGHT: Stash Agent — 60% */}
          <div className="lg:col-span-3 lg:h-[calc(100vh-9rem)]">
            <ChatWindow messages={messages} onSend={handleSend} />
          </div>
        </div>
      </main>
    </div>
  );
}
