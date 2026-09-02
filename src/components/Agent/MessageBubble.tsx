import { useEffect, useRef, useState } from "react";
import type { ChatMessage, Currency, Goal, Scholarship } from "@/types";
import { CloseIcon, PencilIcon, SendIcon } from "@/components/UI/icons";
import { RowButton } from "@/components/UI/RowButton";
import { CopyButton } from "@/components/UI/CopyButton";
import { GoalCard } from "@/components/UI/GoalCard";
import { ScholarshipCard } from "@/components/UI/ScholarshipCard";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/shadcn/avatar";
import { Bubble, BubbleContent } from "@/components/shadcn/bubble";
import {
  Message,
  MessageContent,
  MessageFooter,
} from "@/components/shadcn/message";
import { Marker, MarkerContent, MarkerIcon } from "@/components/shadcn/marker";
import { Spinner } from "@/components/shadcn/spinner";
import { SpendingCard } from "./SpendingCard";
import { Markdown } from "./Markdown";

/**
 * Stash's mark, as the assistant's avatar.
 *
 * Deliberately rounded-lg rather than the primitive's default circle: the mark
 * is a square tile in the header too, and an exclusively-circular avatar is its
 * own generic tell. Decorative — the message text carries the meaning.
 */
function StashAvatar() {
  return (
    <Avatar className="rounded-lg after:rounded-lg">
      <AvatarImage src="/logo.svg" alt="" className="rounded-lg" />
      <AvatarFallback className="rounded-lg">S</AvatarFallback>
    </Avatar>
  );
}

export function MessageBubble({
  message,
  onEdit,
  editable,
  isThinking,
  goals,
  scholarships,
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
  /** Live scholarships — resolves this message's relatedScholarshipIds to cards. */
  scholarships?: Scholarship[];
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
      <Message align="end">
        <MessageContent>
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
            className="w-full max-w-[80%] resize-none self-end overflow-hidden rounded-xl bg-secondary px-3 py-2 text-sm leading-relaxed text-foreground outline-none ring-1 ring-ring/50 focus:ring-ring"
          />
          <MessageFooter className="gap-1">
            <RowButton label="Cancel edit" onClick={() => setEditing(false)}>
              <CloseIcon className="h-4 w-4" />
            </RowButton>
            <RowButton label="Save and resend" tone="emerald" onClick={save}>
              <SendIcon className="h-4 w-4" />
            </RowButton>
            <span className="text-[10px] text-muted-foreground">
              Saving replaces everything below.
            </span>
          </MessageFooter>
        </MessageContent>
      </Message>
    );
  }
  return (
    <MessageRow
      message={message}
      mine={mine}
      editable={editable}
      onEdit={onEdit}
      startEdit={startEdit}
      goals={goals}
      scholarships={scholarships}
      currency={currency}
    />
  );
}

/** The settled row: bubble, any inline proof cards, then the hover actions. */
function MessageRow({
  message,
  mine,
  editable,
  onEdit,
  startEdit,
  goals,
  scholarships,
  currency,
}: {
  message: ChatMessage;
  mine: boolean;
  editable?: boolean;
  onEdit?: (id: string, text: string) => void;
  startEdit: () => void;
  goals?: Goal[];
  scholarships?: Scholarship[];
  currency?: Currency;
}) {
  // Resolve related ids to live records. Anything since removed is skipped
  // silently, so a card disappears rather than erroring.
  const relatedGoals = (message.relatedGoalIds ?? [])
    .map((id) => goals?.find((g) => g.id === id))
    .filter((g): g is Goal => Boolean(g));
  const relatedScholarships = (message.relatedScholarshipIds ?? [])
    .map((id) => scholarships?.find((s) => s.id === id))
    .filter((s): s is Scholarship => Boolean(s));
  // The "+N more" hint only appears on the capped deadlines stack.
  const moreScholarships =
    relatedScholarships.length >= 3 &&
    (scholarships?.length ?? 0) > relatedScholarships.length
      ? (scholarships?.length ?? 0) - relatedScholarships.length
      : 0;

  return (
    <Message align={mine ? "end" : "start"} className="group/row">
      {!mine && <StashAvatar />}
      <MessageContent>
        {message.pending ? (
          // Thinking: a status line rather than an empty bubble, so assistive
          // tech is told a turn is in flight instead of meeting a blank row.
          <Marker role="status" className="w-fit">
            <MarkerIcon>
              <Spinner />
            </MarkerIcon>
            <MarkerContent className="shimmer">Thinking…</MarkerContent>
          </Marker>
        ) : (
          <>
            {message.content && (
              <Bubble
                variant={mine ? "secondary" : "outline"}
                align={mine ? "end" : "start"}
              >
                <BubbleContent>
                  {mine ? (
                    <span className="whitespace-pre-wrap">{message.content}</span>
                  ) : (
                    <Markdown>{message.content}</Markdown>
                  )}
                </BubbleContent>
              </Bubble>
            )}
            {message.card?.type === "spending" && (
              <SpendingCard data={message.card.data} />
            )}
            {currency &&
              relatedGoals.map((g) => (
                <GoalCard key={g.id} goal={g} currency={currency} />
              ))}
            {relatedScholarships.map((s) => (
              <ScholarshipCard key={s.id} scholarship={s} />
            ))}
            {moreScholarships > 0 && (
              <p className="px-1 text-xs text-muted-foreground">
                +{moreScholarships} more on your radar
              </p>
            )}
            {message.content && (
              <MessageFooter className="gap-0.5 px-0 opacity-100 transition-opacity md:opacity-0 md:group-hover/row:opacity-100">
                <CopyButton text={message.content} />
                {mine && editable && onEdit && (
                  <button
                    type="button"
                    aria-label="Edit message"
                    onClick={startEdit}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </MessageFooter>
            )}
          </>
        )}
      </MessageContent>
    </Message>
  );
}
