import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { Dashboard } from "@/components/Dashboard/Dashboard";
import { DashboardStrip } from "@/components/Dashboard/DashboardStrip";
import { WelcomeBack } from "@/components/Dashboard/WelcomeBack";
import { AgentPanel } from "@/components/Agent/AgentPanel";
import { CommandBar } from "@/components/Agent/CommandBar";
import { SYNC_CHIP } from "@/components/Agent/QuickChips";
import { Onboarding } from "@/components/Onboarding/Onboarding";
import type { OnboardingProfile } from "@/components/Onboarding/Onboarding";
import { useLedger } from "@/hooks/useLedger";
import { useAgent } from "@/hooks/useAgent";
import { ensureStorageSchema, getStoredRootHash } from "@/lib/ogStorage";
import { deriveObservation } from "@/lib/observations";
import { deriveWelcomeBack } from "@/lib/welcomeBack";
import type { WelcomeBack as WelcomeBackData } from "@/lib/welcomeBack";
import { analyzeSpending, isSpendingQuery } from "@/lib/analysis";
import { radarBadge, removeHustle, removeScholarship } from "@/lib/ledger";
import { ManageSheet } from "@/components/Dashboard/ManageSheet";
import type { ManageItem } from "@/components/Dashboard/ManageSheet";
import type { Ledger } from "@/types";

// One-time forced reset onto the new local-first schema (runs once at load,
// before any hook reads localStorage).
ensureStorageSchema();

const ONBOARDED_KEY = "stash_onboarded";
const LAST_VISIT_KEY = "stash_last_visit";

type SectionKey = "activity" | "scholarships" | "hustles";

/** Which dashboard section a turn touched. Pure reducers swap only the changed
 *  array, so reference inequality pinpoints it exactly. */
function changedSection(before: Ledger, after: Ledger): SectionKey | null {
  if (before.transactions !== after.transactions) return "activity";
  if (before.scholarships !== after.scholarships) return "scholarships";
  if (before.hustles !== after.hustles) return "hustles";
  return null;
}

const SYNC_CONFIRMATION =
  "Your financial data is encrypted and stored on 0G's decentralized network. Nobody else can access it. It'll be here next time you open Stash.";

export default function App() {
  const { ledger, hydrating, syncPhase, sync, applyLedger, initProfile } =
    useLedger();
  const { messages, isThinking, send, stop, pushAssistant, pushCard, editMessage } =
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

  // "Just updated" emphasis — the section a turn changed. Persists (no timer)
  // until the dashboard is next viewed and consumes it, since after an action
  // the user is in the agent panel, not looking at the dashboard.
  const [highlight, setHighlight] = useState<SectionKey | null>(null);

  // Which tracker's Manage sheet is open (null = closed).
  const [manage, setManage] = useState<"scholarships" | "hustles" | null>(null);

  // Welcome-back greeting — "Since you were last here…". Computed ONCE per load,
  // after the ledger has hydrated, from the deterministic delta vs the last
  // visit (code owns every number). Null when there's nothing worth saying.
  const [welcome, setWelcome] = useState<WelcomeBackData | null>(null);
  useEffect(() => {
    if (!onboarded || hydrating) return;
    const last = localStorage.getItem(LAST_VISIT_KEY);
    setWelcome(deriveWelcomeBack(ledger, last));
    localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
    // Intentionally keyed on hydration settling, not on every ledger change —
    // the greeting is a one-shot snapshot of "since last visit".
  }, [onboarded, hydrating]);

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
    setWelcome(null); // greeting gives way once the conversation starts

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
    let latest = ledger;
    const wantsBreakdown = isSpendingQuery(text);
    void send(text, ledger, (updated) => {
      latest = updated;
      applyLedger(updated);
      void sync(updated);
      const changed = changedSection(before, updated);
      if (changed) setHighlight(changed);
      // Proactive observation — code (not the model) notices when a money
      // event collides with something Stash remembers, and adds one nudge
      // after the agent's reply. Stays silent when there's nothing to say.
      const observation = deriveObservation(before, updated);
      if (observation) pushAssistant(observation);
    }).then((ok) => {
      // Inline spending breakdown — code-computed, attached after the agent's
      // prose reply. Numbers are code-owned; the model never sees/derives them.
      if (!ok || !wantsBreakdown) return;
      const breakdown = analyzeSpending(latest);
      if (breakdown) pushCard({ type: "spending", data: breakdown });
    });
  }

  // Edit a past message and re-run from there. The ledger is RESTORED from the
  // message's snapshot (never replayed), the transcript is rewound, and the
  // edited turn runs from that exact state. The edit is TRANSACTIONAL: if the
  // re-run fails or is stopped, we roll the ledger back to its pre-edit state
  // (which also re-persists localStorage) and skip the sync, so a failed edit
  // can never destroy the prior conversation. Only a successful re-run is
  // persisted locally and backed up to 0G once at the end.
  function handleEditMessage(id: string, newText: string) {
    setAgentActive(true);
    const prevLedger = ledger;
    let before = ledger;
    void (async () => {
      const ok = await editMessage(
        id,
        newText,
        (snapshot) => {
          before = snapshot;
          applyLedger(snapshot);
        },
        (updated) => {
          applyLedger(updated);
          const changed = changedSection(before, updated);
          if (changed) setHighlight(changed);
          const observation = deriveObservation(before, updated);
          if (observation) pushAssistant(observation);
        },
      );
      if (ok) {
        void sync();
      } else {
        // Re-run failed or was stopped — restore the pre-edit ledger (the
        // transcript was already rolled back inside editMessage) and do NOT
        // sync a rewind that never took effect. Tell the user so the silent
        // revert doesn't read as "nothing happened".
        applyLedger(prevLedger);
        toast("Edit rolled back — your conversation is unchanged.");
      }
    })();
  }

  // Remove a tracked scholarship/hustle directly (from the Manage sheet).
  function removeTracked(domain: "scholarships" | "hustles", id: string) {
    const next =
      domain === "scholarships"
        ? removeScholarship(ledger, id)
        : removeHustle(ledger, id);
    applyLedger(next);
    void sync(next);
    const remaining =
      domain === "scholarships" ? next.scholarships.length : next.hustles.length;
    if (remaining === 0) setManage(null); // nothing left to manage
  }

  // Adding always flows through the agent — close the sheet, prime the chat.
  function addViaAgent(domain: "scholarships" | "hustles") {
    setManage(null);
    void handleSend(
      domain === "scholarships"
        ? "I want to track a new scholarship deadline."
        : "I want to add a side income stream.",
    );
  }

  const manageItems: ManageItem[] =
    manage === "scholarships"
      ? ledger.scholarships.map((s) => ({
          id: s.id,
          primary: s.name,
          secondary: s.statusLabel,
          badge: radarBadge(s),
        }))
      : manage === "hustles"
        ? ledger.hustles.map((h) => ({
            id: h.id,
            primary: h.name,
            secondary: h.amountLabel,
            badge: h.status.charAt(0).toUpperCase() + h.status.slice(1),
          }))
        : [];

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
              onSend={handleSend}
              isThinking={isThinking}
            />
          </div>
        ) : (
          <main className="flex-1 overflow-y-auto px-4 py-6">
            {welcome && (
              <div className="mx-auto mb-5 w-full max-w-2xl">
                <WelcomeBack data={welcome} onDismiss={() => setWelcome(null)} />
              </div>
            )}
            <Dashboard
              ledger={ledger}
              syncPhase={syncPhase}
              hydrating={hydrating}
              onPrompt={handleSend}
              onManage={setManage}
              highlight={highlight}
              onHighlightConsumed={() => setHighlight(null)}
            />
          </main>
        )}

        {/* Command bar — always present */}
        <div className="shrink-0">
          <CommandBar onSend={handleSend} onStop={stop} isThinking={isThinking} />
        </div>
      </div>

      {manage && manageItems.length > 0 && (
        <ManageSheet
          title={manage === "scholarships" ? "Scholarship Radar" : "Hustle Ledger"}
          items={manageItems}
          addLabel={
            manage === "scholarships"
              ? "Add a deadline with Stash"
              : "Add an income stream with Stash"
          }
          onRemove={(id) => removeTracked(manage, id)}
          onAdd={() => addViaAgent(manage)}
          onClose={() => setManage(null)}
        />
      )}

      <Toaster theme="dark" position="bottom-right" richColors closeButton />
    </div>
  );
}
