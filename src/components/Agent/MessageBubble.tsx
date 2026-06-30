import { useEffect, useRef, useState } from "react";
import type { ChatMessage, Currency, Goal } from "@/types";
import { CloseIcon, PencilIcon, SendIcon } from "@/components/UI/icons";
import { RowButton } from "@/components/UI/RowButton";
import { CopyButton } from "@/components/UI/CopyButton";
import { GoalCard } from "@/components/UI/GoalCard";
import { SpendingCard } from "./SpendingCard";
import { Markdown } from "./Markdown";

/** Stash avatar — small emerald vault glyph. */
function StashAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald/30 bg-emerald/10">
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-emerald">
        <circle
          cx="12"
          cy="12"
          r="7"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1">
      {[0, 0.2, 0.4].map((d) => (
        <span
          key={d}
          className="h-1.5 w-1.5 rounded-full bg-muted animate-blink"
          style={{ animationDelay: `${d}s` }}
        />
      ))}
    </span>
  );
}

export function MessageBubble({
  message,
  onEdit,
  editable,
  isThinking,
  goals,
  currency,
}: {
  message: ChatMessage;
  /** Edit + re-run this user message (replaces everything below it). */
  onEdit?: (id: string, text: string) => void;
  /** False while a turn is in flight — hides the edit affordance. */
  editable?: boolean;
  /** True while a turn is in flight. */
  isThinking?: boolean;
  /** Live goals — used to resolve this message's relatedGoalIds to cards. */
  goals?: Goal[];
  /** Ledger currency for the goal cards. */
  currency?: Currency;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Close the editor if a turn starts mid-edit. The single-flight lock already
  // makes Save a no-op during a turn, but a stale open textarea looks broken —
  // snap it back to the normal bubble.
  useEffect(() => {
    if (isThinking) setEditing(false);
  }, [isThinking]);

  // Auto-size the textarea to its content while editing.
  useEffect(() => {
    const el = taRef.current;
    if (editing && el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [editing, draft]);

  const mine = message.role === "user";

  function startEdit() {
    setDraft(message.content);
    setEditing(true);
  }

  function save() {
    const text = draft.trim();
    if (text) onEdit?.(message.id, text);
    setEditing(false);
  }

  // ── User message, editing ──────────────────────────────────────────
  if (mine && editing) {
    return (
      <div className="animate-slide-up">
        <div className="ml-auto max-w-[85%]">
          <textarea
            ref={taRef}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                save();
              }
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-full resize-none overflow-hidden rounded-2xl rounded-br-sm bg-slate px-3.5 py-2.5 text-sm leading-relaxed text-ink outline-none ring-1 ring-emerald/50 focus:ring-emerald"
          />
          <div className="mt-1 flex items-center justify-end gap-1">
            <RowButton label="Cancel edit" onClick={() => setEditing(false)}>
              <CloseIcon className="h-4 w-4" />
            </RowButton>
            <RowButton label="Save and resend" tone="emerald" onClick={save}>
              <SendIcon className="h-4 w-4" />
            </RowButton>
          </div>
          <p className="mt-0.5 text-right text-[10px] text-muted">
            Saving replaces everything below.
          </p>
        </div>
      </div>
    );
  }

  // ── User message, default ──────────────────────────────────────────
  if (mine) {
    return (
      <div className="group flex items-start justify-end gap-1.5 animate-slide-up">
        <div className="mt-1.5 flex items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
          <CopyButton text={message.content} />
          {editable && onEdit && (
            <button
              type="button"
              aria-label="Edit message"
              onClick={startEdit}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-bg hover:text-ink"
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-slate px-3.5 py-2.5 text-sm leading-relaxed text-ink">
          {message.content}
        </p>
      </div>
    );
  }

  // ── Assistant message ──────────────────────────────────────────────
  return (
    <div className="group flex items-start gap-2.5 animate-slide-up">
      <StashAvatar />
      <div className="flex max-w-[85%] flex-col items-start gap-1.5">
        {message.pending ? (
          <div className="rounded-2xl rounded-tl-sm border border-line bg-bg/60 px-3.5 py-2.5">
            <TypingDots />
          </div>
        ) : (
          <>
            {message.content && (
              <div className="rounded-2xl rounded-tl-sm border border-line bg-bg/60 px-3.5 py-2.5 text-sm leading-relaxed text-ink">
                <Markdown>{message.content}</Markdown>
              </div>
            )}
            {message.card?.type === "spending" && (
              <SpendingCard data={message.card.data} />
            )}
            {/* Inline goal proof — resolve IDs to live goals; skip any that
                were since removed (the card silently disappears, never errors). */}
            {message.relatedGoalIds && currency
              ? message.relatedGoalIds
                  .map((id) => goals?.find((g) => g.id === id))
                  .filter((g): g is Goal => Boolean(g))
                  .map((g) => (
                    <GoalCard key={g.id} goal={g} currency={currency} />
                  ))
              : null}
            {message.content && (
              <div className="-ml-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                <CopyButton text={message.content} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
