import { useCallback, useRef, useState } from "react";
import type { ChatMessage, Ledger } from "@/types";
import { runAgentTurn, StashComputeError } from "@/lib/ogCompute";

const OPENING_MESSAGE = `Hey. I'm Stash — your personal finance agent.
I know your balance, your deadlines, and your income streams. I remember everything across sessions — your data lives on 0G Storage, encrypted and sovereign.

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

  const commit = (next: ChatMessage[]) => {
    ref.current = next;
    setMessages(next);
  };

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

    try {
      const turn = await runAgentTurn(history, ledger);
      if (turn.mutated) onLedgerUpdate?.(turn.ledger);
      commit(
        ref.current.map((m) =>
          m.id === pending.id
            ? { ...m, content: turn.reply, pending: false }
            : m,
        ),
      );
    } catch (e) {
      const msg =
        e instanceof StashComputeError
          ? e.message
          : "Something went wrong reaching 0G Compute. Try again in a moment.";
      commit(
        ref.current.map((m) =>
          m.id === pending.id ? { ...m, content: msg, pending: false } : m,
        ),
      );
    } finally {
      setIsThinking(false);
    }
  }, []);

  return { messages, isThinking, send, pushAssistant };
}
