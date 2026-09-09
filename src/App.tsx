import { useCallback, useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { Dashboard } from "@/components/Dashboard/Dashboard";
import { DashboardStrip } from "@/components/Dashboard/DashboardStrip";
import { WelcomeBack } from "@/components/Dashboard/WelcomeBack";
import { AgentPanel } from "@/components/Agent/AgentPanel";
import { CommandBar } from "@/components/Agent/CommandBar";
import { SYNC_CHIP } from "@/components/Agent/QuickChips";
import { Onboarding } from "@/components/Onboarding/Onboarding";
import type { OnboardingProfile } from "@/components/Onboarding/Onboarding";
import { INCOME_SHAPES } from "@/components/Onboarding/onboardingModel";
import { useLedger } from "@/hooks/useLedger";
import { useAgent } from "@/hooks/useAgent";
import { useMemory } from "@/hooks/useMemory";
import { useWallet } from "@/hooks/useWallet";
import { StashMark } from "@/components/UI/StashMark";
import { AccountMenu } from "@/components/UI/AccountMenu";
import { BuildBadge } from "@/components/UI/BuildBadge";
import { MemoryIcon } from "@/components/UI/icons";
import { useTheme } from "@/hooks/useTheme";
import {
  Marker,
  MarkerContent,
  MarkerIcon,
} from "@/components/shadcn/marker";
import { ensureStorageSchema, getStoredRootHash } from "@/lib/ogStorage";
import { deriveObservation } from "@/lib/observations";
import { deriveWelcomeBack } from "@/lib/welcomeBack";
import type { WelcomeBack as WelcomeBackData } from "@/lib/welcomeBack";
import { rememberedCount, rememberedName } from "@/lib/opener";
import { memoryDisabled, rememberOnboarding } from "@/lib/memory";
import { analyzeSpending, isSpendingQuery } from "@/lib/analysis";
import {
  addGoal,
  getGoals,
  goalProgressPct,
  radarBadge,
  removeGoal,
  removeHustle,
  removeScholarship,
} from "@/lib/ledger";
import { formatMoneyCompact } from "@/lib/currency";
import { ManageSheet } from "@/components/Dashboard/ManageSheet";
import { GoalDetail } from "@/components/Dashboard/GoalDetail";
import type { ManageItem } from "@/components/Dashboard/ManageSheet";
import type { Ledger } from "@/types";

// One-time forced reset onto the new local-first schema (runs once at load,
// before any hook reads localStorage).
ensureStorageSchema();

const ONBOARDED_KEY = "stash_onboarded";
const LAST_VISIT_KEY = "stash_last_visit";

type SectionKey = "activity" | "scholarships" | "hustles" | "goals";

/** Which dashboard section a turn touched. Pure reducers swap only the changed
 *  array, so reference inequality pinpoints it exactly. */
function changedSection(before: Ledger, after: Ledger): SectionKey | null {
  if (before.transactions !== after.transactions) return "activity";
  if (before.scholarships !== after.scholarships) return "scholarships";
  if (before.hustles !== after.hustles) return "hustles";
  if (before.goals !== after.goals) return "goals";
  return null;
}

const SYNC_CONFIRMATION =
  "Your financial data is encrypted and backed up safely. Nobody else can access it. It'll be here next time you open Stash.";

export default function App() {
  const { ledger, hydrating, syncPhase, sync, applyLedger, initProfile } =
    useLedger();
  // Sibyl memory: hydrated once on mount and handed to the agent as a port, so
  // every turn recalls from it and any write refreshes it.
  const { recall, hydrating: recalling, port: memoryPort } = useMemory();
  // The connected account decides WHOSE memory that is, so any change to it
  // has to re-read the pack. Without this the tenant would move while the
  // previous account's remembered habits stayed on screen — and, worse, fed
  // the next turn's observations.
  const wallet = useWallet(memoryPort.refresh);
  // Read once per mount: the flag is a session decision, not live state.
  const [memoryOff] = useState(memoryDisabled);
  // Owned here, not inside AccountMenu, so the Toaster can be painted in the
  // same mode. Two useTheme() callers would each hold their own state and
  // silently drift apart the moment one of them changed it.
  const { theme, setTheme } = useTheme();
  const {
    messages,
    isThinking,
    send,
    stop,
    pushAssistant,
    pushCard,
    editMessage,
    openerFromMemory,
    startFresh,
  } = useAgent(memoryPort);

  // Returning users (a synced ledger exists) skip onboarding.
  const [onboarded, setOnboarded] = useState(
    () =>
      Boolean(localStorage.getItem(ONBOARDED_KEY)) ||
      Boolean(getStoredRootHash()),
  );

  // Split-Shift: dashboard is full by default; asking anything opens the
  // agent panel (dashboard condenses to a strip). Tap the strip to return.
  const [agentActive, setAgentActive] = useState(false);

  // "Just updated" emphasis — the section a turn changed.
  const [highlight, setHighlight] = useState<SectionKey | null>(null);
  // Stable identity: the dashboard's consume effect is keyed on the highlight
  // AND this callback, so an inline arrow here would give it a new function
  // every render and restart the timer forever.
  const consumeHighlight = useCallback(() => setHighlight(null), []);

  // Which tracker's Manage sheet is open (null = closed).
  const [manage, setManage] = useState<
    "scholarships" | "hustles" | "goals" | null
  >(null);

  // Which goal's history is open. The ID, not the goal — so a turn that
  // contributes while the detail is open updates what's on screen, and a goal
  // the agent removes closes it instead of stranding a copy of something the
  // ledger no longer has.
  const [openGoalId, setOpenGoalId] = useState<string | null>(null);
  const openGoal = getGoals(ledger).find((g) => g.id === openGoalId) ?? null;

  // Welcome-back greeting — "Since you were last here…". Computed ONCE per load,
  // after the ledger has hydrated, from the deterministic delta vs the last
  // visit (code owns every number). Null when there's nothing worth saying.
  const [welcome, setWelcome] = useState<WelcomeBackData | null>(null);
  useEffect(() => {
    if (!onboarded || hydrating || recalling) return;
    const last = localStorage.getItem(LAST_VISIT_KEY);
    setWelcome(deriveWelcomeBack(ledger, last, recall));
    // The transcript's first line is the same recall, as prose. Computed here so
    // both surfaces say the same thing from the same facts.
    openerFromMemory(ledger, last);
    localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
    // Intentionally keyed on hydration settling, not on every ledger change —
    // the greeting is a one-shot snapshot of "since last visit". It also waits
    // on the Sibyl read, since what Stash remembers IS the greeting.
  }, [onboarded, hydrating, recalling]);

  /**
   * Finish first run: seed the ledger, then seed MEMORY.
   *
   * The memory writes are the point. Onboarding used to set three ledger fields
   * and tell Sibyl nothing, so a brand-new user's first session had nothing to
   * recall. Now identity and income shape land as memories immediately, and a
   * stated goal lands both as a real `Goal` (structured, code-owned) and as a
   * goal memory (so the agent can speak about it).
   *
   * Fire-and-forget and individually guarded: a sidecar that is down must not
   * block anyone from entering the app. Memory is additive here, never a gate.
   */
  function completeOnboarding(profile: OnboardingProfile) {
    let next = initProfile(profile);

    if (profile.goal) {
      next = addGoal(next, profile.goal);
      applyLedger(next);
      void sync(next);
    }

    const shape = INCOME_SHAPES.find((s) => s.value === profile.incomeShape);
    void rememberOnboarding({
      owner: profile.owner,
      currency: profile.currency,
      incomeMemory: shape?.memory ?? null,
      goal: profile.goal,
    });

    localStorage.setItem(ONBOARDED_KEY, "1");
    setOnboarded(true);
  }

  if (!onboarded) {
    return <Onboarding onComplete={completeOnboarding} />;
  }

  async function handleSend(text: string) {
    setAgentActive(true);
    setWelcome(null); // greeting gives way once the conversation starts

    // 1. The back-up chip → real storage sync, no model call needed.
    if (text === SYNC_CHIP) {
      const ok = await sync();
      pushAssistant(
        ok
          ? SYNC_CONFIRMATION
          : "I couldn't back up just now: the upload didn't go through. Check the toast for details and try again.",
      );
      return;
    }

    // 2. Everything else → the agent. It may call tools that mutate the
    //    ledger; when it does, persist the new ledger and back it up.
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
      const observation = deriveObservation(before, updated, memoryPort.read());
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
          const observation = deriveObservation(before, updated, memoryPort.read());
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
        toast("Edit rolled back: your conversation is unchanged.");
      }
    })();
  }

  // Remove a tracked scholarship/hustle/goal directly (from the Manage sheet).
  function removeTracked(
    domain: "scholarships" | "hustles" | "goals",
    id: string,
  ) {
    const next =
      domain === "scholarships"
        ? removeScholarship(ledger, id)
        : domain === "hustles"
          ? removeHustle(ledger, id)
          : removeGoal(ledger, id);
    applyLedger(next);
    void sync(next);
    const remaining =
      domain === "scholarships"
        ? next.scholarships.length
        : domain === "hustles"
          ? next.hustles.length
          : next.goals.length;
    if (remaining === 0) setManage(null); // nothing left to manage
  }

  // Adding always flows through the agent — close the sheet, prime the chat.
  function addViaAgent(domain: "scholarships" | "hustles" | "goals") {
    setManage(null);
    void handleSend(
      domain === "scholarships"
        ? "I want to track a new scholarship deadline."
        : domain === "hustles"
          ? "I want to add a side income stream."
          : "I want to set a savings goal.",
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
        : manage === "goals"
          ? ledger.goals.map((g) => ({
              id: g.id,
              primary: g.name,
              secondary: `${formatMoneyCompact(g.savedAmount, ledger.currency)} / ${formatMoneyCompact(g.targetAmount, ledger.currency)}`,
              badge: `${Math.round(goalProgressPct(g))}%`,
            }))
          : [];

  /**
   * Has a conversation actually started?
   *
   * Derived from the transcript, never stored. The opener Stash writes on load
   * is an assistant message, so the presence of a USER message is the honest
   * signal that someone asked for something — and it is the same state
   * `startFresh` clears, so "New conversation" returns to the dashboard without
   * a second flag to reset. `agentActive` still means what it always meant:
   * which pane is showing below lg.
   */
  const conversing = messages.some((m) => m.role === "user");

  /* The dashboard's content, defined once. Both shells render exactly this;
     only the column around it differs, so the two states cannot drift. */
  const dashboardBody = (
    <>
      {/* The deletion test, stated on screen. Without this the absence of
          memory looks like a bug rather than the point being demonstrated. */}
      {memoryOff && (
        <Marker role="status" variant="border">
          <MarkerIcon>
            <MemoryIcon className="size-4" />
          </MarkerIcon>
          <MarkerContent>
            Memory is switched off for this session. Stash keeps the maths and
            forgets the person. Drop <code>?nomemory</code> from the URL to
            bring it back.
          </MarkerContent>
        </Marker>
      )}
      {recalling ? (
        <Marker role="status">
          <MarkerIcon>
            <MemoryIcon className="size-4" />
          </MarkerIcon>
          <MarkerContent className="shimmer">
            Recalling what I know about you…
          </MarkerContent>
        </Marker>
      ) : (
        welcome && (
          <WelcomeBack data={welcome} onDismiss={() => setWelcome(null)} />
        )
      )}
      <Dashboard
        ledger={ledger}
        syncPhase={syncPhase}
        hydrating={hydrating}
        onPrompt={handleSend}
        onManage={setManage}
        onOpenGoal={(g) => setOpenGoalId(g.id)}
        highlight={highlight}
        onHighlightConsumed={consumeHighlight}
      />
    </>
  );

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      {/* The ONE app header, at every breakpoint and in every mode. There used
          to be two competing ones: this bar (dashboard only) and the agent
          panel's own "Stash AI" bar. At lg both panes are on screen together,
          so those would have stacked in the same corner. */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
        <StashMark className="size-7" />
        <h1 className="text-lg font-semibold leading-none">Stash</h1>
        <div className="ml-auto flex items-center gap-3">
          {/* Proof of freshness, and it is load-bearing for the demo rather
              than chrome: the recall beat is shot as ONE unbroken take across a
              reload, and a constant build SHA beside a RUNNING clock is what
              shows on camera that there was no cut. The clock has to be here,
              in the always-visible header — it used to sit inside the account
              menu, where a continuous shot can never see it. Hidden below sm
              only because a phone header has no room for it. */}
          <BuildBadge clock className="hidden sm:inline" />
          <AccountMenu
            name={rememberedName(ledger, recall)}
            currency={ledger.currency}
            memoryCount={rememberedCount(recall)}
            onCurrencyChange={(next) =>
              applyLedger({ ...ledger, currency: next })
            }
            onSync={() => void sync()}
            syncing={syncPhase !== "idle"}
            theme={theme}
            onThemeChange={setTheme}
            onStartFresh={() => {
              startFresh(ledger, localStorage.getItem(LAST_VISIT_KEY));
              setAgentActive(true);
            }}
            walletAddress={wallet.address}
            walletAvailable={wallet.available}
            connectingWallet={wallet.connecting}
            onConnectWallet={() => {
              void wallet.connect().catch((e) =>
                toast.error("Couldn't connect that wallet", {
                  description: e instanceof Error ? e.message : undefined,
                }),
              );
            }}
            onDisconnectWallet={wallet.disconnect}
          />
        </div>
      </header>
      {/*
        The shell has two states, and which one you get is derived from the
        transcript rather than tracked separately: `conversing` is simply
        "has the user said anything yet". That means a reload lands back on the
        dashboard for free (the transcript is session-local) and "New
        conversation" resets it too, without a second flag to keep in sync.

        Before that: ONE full-width dashboard with the composer at its foot.
        After: the existing two-pane shell, unchanged. Chat is something you
        open by asking, not a permanent half of the application.
      */}
      {conversing ? (
        <div className="mx-auto flex w-full min-h-0 max-w-[100rem] flex-1 flex-col lg:flex-row">
          {/* Dashboard pane. Owns its own width once, here, for everything in it. */}
          <div
            className={`min-w-0 flex-col lg:flex lg:min-h-0 lg:flex-[2] lg:border-r lg:border-border ${
              agentActive ? "hidden" : "flex min-h-0 flex-1"
            }`}
          >
            {/* lg:px-8 — at lg this pane is a ~576px column hard against the
                window edge, and px-4 left the cards with a 16px gutter on one
                side while the transcript beside them sat in ~96px of air. */}
            <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
              <div className="@container mx-auto w-full max-w-2xl space-y-5">
                {dashboardBody}
              </div>
            </main>
          </div>

          {/* Conversation pane. The command bar lives at its foot in BOTH
              layouts, which is why this pane is always mounted: below lg, with
              the transcript closed, the pane collapses to just the composer, so
              the draft you are typing survives opening and closing it. */}
          <div
            className={`flex min-w-0 flex-col lg:min-h-0 lg:flex-[3] ${
              agentActive ? "min-h-0 flex-1" : "lg:flex-1"
            }`}
          >
            {agentActive && (
              <div className="lg:hidden">
                <DashboardStrip
                  ledger={ledger}
                  onExpand={() => setAgentActive(false)}
                />
              </div>
            )}

            <div
              className={`min-h-0 flex-1 flex-col ${
                agentActive ? "flex animate-slide-up lg:animate-none" : "hidden lg:flex"
              }`}
            >
              <AgentPanel
                messages={messages}
                onEditMessage={handleEditMessage}
                isThinking={isThinking}
                goals={ledger.goals}
                scholarships={ledger.scholarships}
                currency={ledger.currency}
              />
            </div>

            <div className="shrink-0">
              <CommandBar
                onSend={handleSend}
                onStop={stop}
                isThinking={isThinking}
                active={agentActive}
                onOpenPanel={() => setAgentActive(true)}
                canOpenPanel={!agentActive}
              />
            </div>
          </div>
        </div>
      ) : (
        /* Home. One column, the dashboard scrolling above a composer pinned to
           the foot of the screen — the composer is bottom-anchored rather than
           floating mid-page, and shares the dashboard's max width so their
           edges line up on the same axis. max-w-4xl rather than the pane's
           2xl: with no transcript beside it there is real room, and at 896px
           the dashboard's own @container queries pair the two secondary
           trackers side by side instead of stacking them down a narrow strip. */
        <div className="flex min-h-0 flex-1 flex-col">
          <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
            <div className="@container mx-auto w-full max-w-4xl space-y-6">
              {dashboardBody}
            </div>
          </main>
          <div className="shrink-0">
            <CommandBar onSend={handleSend} isThinking={isThinking} compact />
          </div>
        </div>
      )}

      {manage && manageItems.length > 0 && (
        <ManageSheet
          title={
            manage === "scholarships"
              ? "Scholarship Radar"
              : manage === "hustles"
                ? "Hustle Ledger"
                : "Goals"
          }
          items={manageItems}
          addLabel={
            manage === "scholarships"
              ? "Add a deadline with Stash"
              : manage === "hustles"
                ? "Add an income stream with Stash"
                : "Add a savings goal with Stash"
          }
          onRemove={(id) => removeTracked(manage, id)}
          onAdd={() => addViaAgent(manage)}
          onClose={() => setManage(null)}
        />
      )}

      {/* One goal, opened up: its standing, and everything that happened to it.
          "Ask Stash about this" hands the goal to the conversation rather than
          answering inside the detail — the agent stays the one place that
          talks. */}
      <GoalDetail
        goal={openGoal}
        currency={ledger.currency}
        onClose={() => setOpenGoalId(null)}
        onAsk={(g) => {
          setOpenGoalId(null);
          void handleSend(`How am I doing on ${g.name}?`);
        }}
      />

      {/* Follows the app's own theme. It was pinned to "dark", which since the
          two-mode palette landed meant a dark toast dropped onto a light page. */}
      <Toaster theme={theme} position="top-center" richColors closeButton />
    </div>
  );
}
