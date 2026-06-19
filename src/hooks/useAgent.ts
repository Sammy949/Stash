import { useState } from "react";
import type { ChatMessage } from "@/types";

/**
 * useAgent — owns the chat transcript and 0G Compute calls.
 *
 * STUB (wired up in step 5).
 */
export function useAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  return { messages, setMessages };
}
