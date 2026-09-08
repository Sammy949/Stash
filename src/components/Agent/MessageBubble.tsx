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
import { Button } from "@/components/shadcn/button";
import { Textarea } from "@/components/shadcn/textarea";
import { Bubble, BubbleContent } from "@/components/shadcn/bubble";
import {
  Message,
  MessageContent,
  MessageFooter,
} from "@/components/shadcn/message";
import { Marker, MarkerContent, MarkerIcon } from "@/components/shadcn/marker";
import { TypingDots } from "./TypingDots";
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
          <Textarea
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
            // min-h-0 overrides the primitive's min-h-16: this editor is
            // sized by the auto-grow effect below, and a 64px floor left a
            // one-line message sitting in an oversized box.
            className="w-full max-w-[80%] min-h-0 resize-none self-end overflow-hidden rounded-bubble bg-secondary px-3 py-2 text-sm leading-relaxed"
          />
          <MessageFooter className="gap-1">
            <RowButton label="Cancel edit" onClick={() => setEditing(false)}>
              <CloseIcon className="size-3.5" />
            </RowButton>
            <RowButton label="Save and resend" tone="emerald" onClick={save}>
              <SendIcon className="size-3.5" />
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
      {/* The mark lands with the reply, not before it. While the turn is in
          flight the row is a status line, and an avatar sitting beside
          "Thinking…" reads as Stash having already spoken. */}
      {!mine && !message.pending && <StashAvatar />}
      <MessageContent>
        {message.pending ? (
          // Thinking: a status line rather than an empty bubble, so assistive
          // tech is told a turn is in flight instead of meeting a blank row.
          <Marker role="status" className="w-fit">
            {/* MarkerIcon is a square size-4 slot built for a single glyph:
                w-auto gives the three dots their width, and flex+items-center
                actually centres them in the 16px slot. Without the flex the
                dots are an inline box sitting on the text baseline, which
                parks 6px dots low against the label beside them. */}
            <MarkerIcon className="flex w-auto items-center">
              <TypingDots />
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
                <BubbleContent className="rounded-bubble">
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Edit message"
                    onClick={startEdit}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <PencilIcon className="size-3.5" />
                  </Button>
                )}
              </MessageFooter>
            )}
          </>
        )}
      </MessageContent>
    </Message>
  );
}
