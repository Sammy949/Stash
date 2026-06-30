import { useEffect, useRef } from "react";
import type { ChatMessage, Currency, Goal, Scholarship } from "@/types";
import { MessageBubble } from "./MessageBubble";

/** Stash's vault glyph in its accent ring. */
function StashGlyph({ size = 7 }: { size?: number }) {
  return (
    <div
      className={`flex items-center justify-center rounded-full border border-emerald/30 bg-emerald/10`}
      style={{ height: `${size * 4}px`, width: `${size * 4}px` }}
    >
      <svg viewBox="0 0 24 24" fill="none" className="text-emerald" style={{ height: `${size * 2.3}px`, width: `${size * 2.3}px` }}>
        <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.75" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
    </div>
  );
}

/** The conversation transcript — fills the space under the strip when active. */
export function AgentPanel({
  messages,
  onEditMessage,
  isThinking,
  goals,
  scholarships,
  currency,
}: {
  messages: ChatMessage[];
  onEditMessage: (id: string, text: string) => void;
  isThinking: boolean;
  /** Live goals — passed to bubbles to render inline goal cards. */
  goals: Goal[];
  /** Live scholarships — passed to bubbles to render inline scholarship cards. */
  scholarships: Scholarship[];
  /** Ledger currency for the goal cards. */
  currency: Currency;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Whether the user is parked at (or near) the bottom. Only then do we
  // auto-follow new messages — so reading older history isn't yanked away
  // when a reply lands or a proactive observation/card is appended.
  const pinnedRef = useRef(true);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  useEffect(() => {
    if (pinnedRef.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  // Before the first user turn, show a centered greeting instead of a lone
  // left-aligned bubble. The starter chips live on the command bar (above the
  // input) — no need to repeat them here.
  const greeting =
    messages.length === 1 && messages[0].role === "assistant" && !messages[0].pending
      ? messages[0]
      : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-line px-5 py-3">
        <StashGlyph size={7} />
        <h2 className="text-sm font-semibold">Stash AI</h2>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
          <span className="label-caps text-[10px] text-muted">Active</span>
        </span>
        <span className="label-caps ml-auto rounded-full border border-line px-2 py-1 text-[10px] text-muted">
          0G Powered
        </span>
      </div>

      {/* Transcript */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-y-auto px-5 py-4"
      >
        {greeting ? (
          <div className="flex h-full flex-col items-center justify-center px-2 text-center">
            <StashGlyph size={12} />
            <p className="mt-4 max-w-sm whitespace-pre-wrap text-sm leading-relaxed text-muted">
              {greeting.content}
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onEdit={onEditMessage}
              editable={!isThinking}
              isThinking={isThinking}
              goals={goals}
              scholarships={scholarships}
              currency={currency}
            />
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* Disclaimer — code owns the numbers, but advice/prose can still err. */}
      <p className="shrink-0 px-5 pb-2 text-center text-[10px] text-muted">
        Stash can make mistakes — double-check anything important.
      </p>
    </div>
  );
}
