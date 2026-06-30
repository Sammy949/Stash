import { useCallback, useRef, useState } from "react";
import type { AgentCard, ChatMessage, Ledger } from "@/types";
import { runAgentTurn, StashComputeError } from "@/lib/ogCompute";
import { getGoals } from "@/lib/ledger";
import {
  matchScholarshipsByMention,
  mostUrgentScholarships,
} from "@/lib/scholarshipContext";
import {
  REVIEW_GOALS_CHIP,
  SCHOLARSHIP_DEADLINES_CHIP,
} from "@/components/Agent/QuickChips";

const OPENING_MESSAGE = `Welcome back.

I remember your financial world, so you don't have to.

What do you want to stay ahead of today?`;

function makeMessage(
  role: ChatMessage["role"],
  content: string,
  extra?: Partial<ChatMessage>,
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

/**
 * useAgent — chat transcript + 0G Compute calls.
 *
 * A ref mirrors the transcript so async handlers always read the latest
 * state (no stale closures); `setMessages` just pushes the ref to React.
 */
export function useAgent() {
  const ref = useRef<ChatMessage[]>([makeMessage("assistant", OPENING_MESSAGE)]);
  const [messages, setMessages] = useState<ChatMessage[]>(ref.current);
  const [isThinking, setIsThinking] = useState(false);
  // Lets the user cancel an in-flight turn (slow node, wrong message). The
  // signal is threaded down to the chat-completion fetch; aborting it rejects
  // the turn with an AbortError, which `send` settles as "Stopped.".
  const abortRef = useRef<AbortController | null>(null);
  // Single-flight lock. Set SYNCHRONOUSLY (a ref, not state — `isThinking`
  // only flips on the next render) so two near-simultaneous calls can't both
  // pass the guard. Any send/editMessage that arrives while a turn is in
  // flight is dropped, so a second Save (e.g. from another open editor) can
  // never spawn a concurrent loop that races on the shared transcript.
  const inFlightRef = useRef(false);

  const commit = (next: ChatMessage[]) => {
    ref.current = next;
    setMessages(next);
  };

  /** Cancel the current turn. Input re-enables immediately. */
  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** Append a free-form assistant message (used by step-5 actions). */
  const pushAssistant = useCallback((content: string) => {
    commit([...ref.current, makeMessage("assistant", content)]);
  }, []);

  /** Append an assistant message carrying a structured card (code-computed). */
  const pushCard = useCallback((card: AgentCard, content = "") => {
    commit([...ref.current, makeMessage("assistant", content, { card })]);
  }, []);

  /**
   * Send a user turn. The agent may call tools that mutate the ledger; if
   * so, `onLedgerUpdate` is invoked with the new ledger (App persists +
   * syncs it). The reply streams into a pending bubble.
   */
  const send = useCallback(
    async (
      text: string,
      ledger: Ledger,
      onLedgerUpdate?: (next: Ledger) => void,
    ): Promise<boolean> => {
    // Single-flight: ignore a turn that starts while another is in flight.
    if (inFlightRef.current) return false;
    inFlightRef.current = true;
    // Snapshot the state Stash holds going INTO this turn, attached to the
    // user message. Editing the message later restores exactly this.
    const userMsg = makeMessage("user", text, { memorySnapshot: ledger });
    const history = [...ref.current, userMsg];
    const pending = makeMessage("assistant", "", { pending: true });
    commit([...history, pending]);
    setIsThinking(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const turn = await runAgentTurn(history, ledger, controller.signal);
      if (turn.mutated) onLedgerUpdate?.(turn.ledger);
      // Inline goal cards: tools that touched a goal already report their IDs.
      // The "Review my goals" chip is a plain query (no tool fires), so on that
      // exact prompt we surface ALL active goals — the grouped-stack moment.
      const isReview =
        text.trim().toLowerCase() === REVIEW_GOALS_CHIP.toLowerCase();
      const relatedGoalIds = isReview
        ? getGoals(turn.ledger)
            .filter((g) => g.targetAmount > 0)
            .map((g) => g.id)
        : turn.relatedGoalIds;
      // Inline scholarship cards — a controlled combination of triggers, all
      // detected in code (never invented). The "Scholarship deadlines" chip
      // shows the top 3 most urgent. Otherwise the turn already carries the
      // add_scholarship and proactive-nudge ids (computed in ogCompute, where
      // the nudge's FACTS line is injected so the model MENTIONS it); here we
      // only layer on any scholarship the user NAMED this turn.
      const isDeadlines =
        text.trim().toLowerCase() === SCHOLARSHIP_DEADLINES_CHIP.toLowerCase();
      let relatedScholarshipIds: string[];
      if (isDeadlines) {
        relatedScholarshipIds = mostUrgentScholarships(turn.ledger, 3).map(
          (s) => s.id,
        );
      } else {
        const ids = new Set(turn.relatedScholarshipIds);
        for (const id of matchScholarshipsByMention(turn.ledger, text)) {
          ids.add(id);
        }
        relatedScholarshipIds = [...ids];
      }
      commit(
        ref.current.map((m) =>
          m.id === pending.id
            ? {
                ...m,
                content: turn.reply,
                pending: false,
                ...(relatedGoalIds.length ? { relatedGoalIds } : {}),
                ...(relatedScholarshipIds.length
                  ? { relatedScholarshipIds }
                  : {}),
              }
            : m,
        ),
      );
      return true;
    } catch (e) {
      // User-initiated stop → settle the bubble calmly, not as an error.
      const aborted = e instanceof DOMException && e.name === "AbortError";
      const msg = aborted
        ? "Stopped."
        : e instanceof StashComputeError
          ? e.message
          : "Something went wrong reaching 0G Compute. Try again in a moment.";
      commit(
        ref.current.map((m) =>
          m.id === pending.id ? { ...m, content: msg, pending: false } : m,
        ),
      );
      return false;
    } finally {
      abortRef.current = null;
      inFlightRef.current = false;
      setIsThinking(false);
    }
  }, []);

  /**
   * Edit a past user message and re-run from there (ChatGPT-style). The old
   * exchange — and everything after it — is replaced.
   *
   * Determinism rule: the ledger is RESTORED from the message's snapshot, never
   * reconstructed by replaying the model. Money is exact; only fuzzy memory may
   * shift when the edited turn re-runs.
   *
   * Transactional: the edit truncates the transcript and rewinds the ledger
   * BEFORE the re-run, but if that re-run fails or is stopped, the prior
   * conversation must not be lost. We capture the full pre-edit transcript and
   * restore it on failure; the caller rolls the ledger back and skips the sync.
   * Returns true only when the re-run completed successfully.
   *
   * @param onRestore  applies the restored snapshot to the live ledger (App).
   * @param onLedgerUpdate  same callback `send` uses when the re-run mutates.
   */
  const editMessage = useCallback(
    async (
      messageId: string,
      newText: string,
      onRestore: (snapshot: Ledger) => void,
      onLedgerUpdate?: (next: Ledger) => void,
    ): Promise<boolean> => {
      // Single-flight: never rewind/truncate while a turn is already running.
      // `send` sets the lock synchronously, so a second edit (or a normal turn)
      // landing mid-flight is dropped here before it can touch the transcript.
      if (inFlightRef.current) return false;
      const idx = ref.current.findIndex((m) => m.id === messageId);
      if (idx < 0) return false;
      const target = ref.current[idx];
      // Only user messages carry a snapshot; without one we can't safely rewind.
      if (target.role !== "user" || !target.memorySnapshot) return false;
      const snapshot = target.memorySnapshot;

      // Capture the full pre-edit transcript so a failed/aborted re-run can be
      // rolled back wholesale — nothing is destroyed until the re-run lands.
      const prevTranscript = ref.current;

      // Drop the edited message and everything after it, then restore the
      // pre-turn state and re-run with the new text from that exact point.
      commit(ref.current.slice(0, idx));
      onRestore(snapshot);
      const ok = await send(newText, snapshot, onLedgerUpdate);
      // Re-run failed or was stopped → put the original conversation back; the
      // caller restores the ledger. The edit becomes a no-op, never a data loss.
      if (!ok) commit(prevTranscript);
      return ok;
    },
    [send],
  );

  return { messages, isThinking, send, stop, pushAssistant, pushCard, editMessage };
}
