import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/types";
import { MessageBubble } from "./MessageBubble";

/** The conversation transcript — fills the space under the strip when active. */
export function AgentPanel({
  messages,
  onEditMessage,
  isThinking,
}: {
  messages: ChatMessage[];
  onEditMessage: (id: string, text: string) => void;
  isThinking: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-line px-5 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald/30 bg-emerald/10">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-emerald">
            <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.75" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
        </div>
        <h2 className="text-sm font-semibold">Stash AI</h2>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
          <span className="text-[11px] text-muted">Active</span>
        </span>
        <span className="ml-auto rounded-full border border-line px-2 py-1 text-[10px] font-medium text-muted">
          ⚡ 0G powered
        </span>
      </div>

      {/* Transcript */}
      <div className="mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line/80 bg-bg/60 p-4 text-sm text-muted">
            <p className="font-medium text-ink">Start the story</p>
            <p className="mt-1">
              Try a real money event like “I got paid ₦20,000” or “I spent ₦3,000 on lunch” and Stash will ground it in your ledger.
            </p>
          </div>
        ) : null}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            onEdit={onEditMessage}
            editable={!isThinking}
          />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
