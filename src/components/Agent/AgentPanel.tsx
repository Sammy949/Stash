import { useEffect, useRef } from "react";
import type { ChatMessage, Currency, Goal, Scholarship } from "@/types";
import { BuildBadge } from "@/components/UI/BuildBadge";
import { StashMark } from "@/components/UI/StashMark";
import { MessageBubble } from "./MessageBubble";

/** The conversation transcript — fills the space under the strip when active. */
export function AgentPanel({
  messages,
  onEditMessage,
  onStartFresh,
  isThinking,
  goals,
  scholarships,
  currency,
}: {
  messages: ChatMessage[];
  onEditMessage: (id: string, text: string) => void;
  /**
   * Clear the transcript without touching memory. The reason it exists: a new
   * session should meet a Stash that still knows you.
   */
  onStartFresh?: () => void;
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
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-3">
        <StashMark className="h-7 w-7" />
        <h2 className="shrink-0 text-sm font-semibold">Stash AI</h2>
        {/* Hidden on the narrowest screens so the header can't overflow now that
            it also carries the reset and the build badge. */}
        <span className="hidden items-center gap-1.5 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="label-caps text-[10px] text-muted-foreground">Active</span>
        </span>
        <div className="ml-auto flex items-center gap-2">
          {onStartFresh && (
            <button
              type="button"
              onClick={onStartFresh}
              disabled={isThinking}
              title="Clear this conversation. Stash keeps what it remembers."
              className="flex h-9 items-center rounded-lg px-2 text-[11px] text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:opacity-40"
            >
              Start fresh
            </button>
          )}
          <BuildBadge />
        </div>
      </div>

      {/* Transcript */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-y-auto px-5 py-4"
      >
        {greeting ? (
          <div className="flex h-full flex-col items-center justify-center px-2 text-center">
            <StashMark className="h-12 w-12" />
            <p className="mt-4 max-w-sm whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
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
      <p className="shrink-0 px-5 pb-2 text-center text-[10px] text-muted-foreground">
        Stash can make mistakes — double-check anything important.
      </p>
    </div>
  );
}
