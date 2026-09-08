import type { ChatMessage, Currency, Goal, Scholarship } from "@/types";
import { StashMark } from "@/components/UI/StashMark";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/shadcn/message-scroller";
import { MessageBubble } from "./MessageBubble";

/**
 * The conversation transcript. It fills its pane and owns nothing above itself:
 * the app header is the only header now.
 *
 * This used to carry a second bar of its own ("Stash AI", a pulsing Active dot,
 * Start fresh, the build hash). Beside the app header that was two competing
 * headers, and at `lg` — where both panes are on screen at once — it was two
 * stacked bars in the same corner. Everything it held already exists elsewhere:
 * identity and the build hash in the app header, Start fresh in the account
 * menu. The dot was decoration.
 */
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
  // Before the first user turn, show a centered greeting instead of a lone
  // left-aligned bubble. The starter chips live on the command bar (above the
  // input) — no need to repeat them here.
  const greeting =
    messages.length === 1 && messages[0].role === "assistant" && !messages[0].pending
      ? messages[0]
      : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Transcript. MessageScroller owns the scrolling: it sticks to the
          bottom only while you are at the live edge, anchors each user turn so
          the reply streams in below it, and holds position when history is
          prepended. Its viewport carries scroll-fade-b, so the top edge softens
          as content runs under the header. */}
      <MessageScrollerProvider>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            {greeting ? (
              // Centred in the pane: before the first turn there is no
              // conversation for the greeting to sit on top of, so the mark and
              // the opening line read as the panel's resting state rather than
              // one stray bubble pinned above the composer.
              <div className="flex h-full flex-col items-center justify-center px-6 py-6 text-center">
                <StashMark className="size-14" />
                <p className="mt-5 max-w-sm whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {greeting.content}
                </p>
              </div>
            ) : (
              <MessageScrollerContent className="mx-auto w-full max-w-2xl gap-4 px-5 py-4">
                {messages.map((m) => (
                  <MessageScrollerItem
                    key={m.id}
                    scrollAnchor={m.role === "user"}
                  >
                    <MessageBubble
                      message={m}
                      onEdit={onEditMessage}
                      editable={!isThinking}
                      isThinking={isThinking}
                      goals={goals}
                      scholarships={scholarships}
                      currency={currency}
                    />
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            )}
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  );
}
