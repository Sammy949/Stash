import { Button } from "@/components/shadcn/button";
import { QuickChips } from "./QuickChips";
import { InputBar } from "./InputBar";
import { ChatIcon } from "@/components/UI/icons";

/**
 * The always-present command bar — a floating panel near the bottom of the
 * screen (no full-width bar; the page shows around it). It's how you talk
 * to Stash from any view, like a calm command line.
 */
export function CommandBar({
  onSend,
  onStop,
  isThinking,
  active = false,
  onOpenPanel,
  canOpenPanel = false,
}: {
  onSend: (text: string) => void;
  onStop?: () => void;
  isThinking: boolean;
  /** True while the agent panel is open. Gates input autofocus so the keyboard
   *  never pops over the dashboard on cold load. */
  active?: boolean;
  /** Reopen the agent panel to review the conversation — no message sent. */
  onOpenPanel?: () => void;
  /** Only offer the reopen affordance when the panel is closed and there's
   *  an existing conversation worth glancing back at. */
  canOpenPanel?: boolean;
}) {
  return (
    <div className="px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-2xl">
        {/* Starters sit above the composer, and only before the conversation
            starts: once the panel is open they are noise, since the transcript
            is the context. */}
        {!active && (
          <div className="mb-2.5">
            <QuickChips onPick={onSend} disabled={isThinking} />
          </div>
        )}
        {/* Aligned to the bottom so the reopen button stays level with the send
            button as the composer grows. */}
        <div className="flex items-end gap-1.5">
          {canOpenPanel && onOpenPanel && (
            <Button
              variant="outline"
              size="icon-lg"
              onClick={onOpenPanel}
              aria-label="Open conversation"
              title="Open conversation"
              // Below lg only: at lg the transcript is always on screen beside
              // the dashboard, so there is nothing to reopen.
              className="mb-1 size-11 shrink-0 rounded-full text-muted-foreground lg:hidden"
            >
              <ChatIcon className="size-4" />
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <InputBar
              onSend={onSend}
              onStop={onStop}
              disabled={isThinking}
              autoFocus={active}
            />
          </div>
        </div>
        {/* Supporting text for the composer, not a UI element of its own: the
            quietest ink in the system, and it wraps rather than truncates on a
            narrow phone. Balanced so a two-line wrap breaks evenly. */}
        <p className="mt-2 text-pretty px-1 text-center text-[11px] leading-snug text-muted-foreground">
          Stash can make mistakes, so double-check anything important.
        </p>
      </div>
    </div>
  );
}
