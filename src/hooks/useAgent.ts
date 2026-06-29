import { useCallback, useRef, useState } from "react";
import type { ChatMessage, Ledger } from "@/types";
import { runAgentTurn, StashComputeError } from "@/lib/ogCompute";

const OPENING_MESSAGE = `Hey. I'm Stash — your personal finance agent.
I know your balance, your deadlines, and your income streams. Your financial memory is saved here and backed up to 0G. Pick up right where you left off.

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
    ) => {
    const userMsg = makeMessage("user", text);
    const history = [...ref.current, userMsg];
    const pending = makeMessage("assistant", "", { pending: true });
    commit([...history, pending]);
    setIsThinking(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const turn = await runAgentTurn(history, ledger, controller.signal);
      if (turn.mutated) onLedgerUpdate?.(turn.ledger);
      commit(
        ref.current.map((m) =>
          m.id === pending.id
            ? { ...m, content: turn.reply, pending: false }
            : m,
        ),
      );
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
    } finally {
      abortRef.current = null;
      setIsThinking(false);
    }
  }, []);

  return { messages, isThinking, send, stop, pushAssistant };
}
