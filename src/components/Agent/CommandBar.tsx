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
  onOpenPanel,
  canOpenPanel = false,
}: {
  onSend: (text: string) => void;
  onStop?: () => void;
  isThinking: boolean;
  /** Reopen the agent panel to review the conversation — no message sent. */
  onOpenPanel?: () => void;
  /** Only offer the reopen affordance when the panel is closed and there's
   *  an existing conversation worth glancing back at. */
  canOpenPanel?: boolean;
}) {
  return (
    <div className="px-4 pb-5 pt-3">
      <div className="mx-auto w-full max-w-2xl">
        {/* Chips float above the pill; the pill (InputBar) carries its own
            border + shadow so it reads as a floating command line. */}
        <div className="mb-2.5">
          <QuickChips onPick={onSend} disabled={isThinking} />
        </div>
        {/* Quiet ghost affordance + the input pill. The chat button reopens the
            transcript without triggering a turn; it sits out of the way until
            there's a conversation to return to. */}
        <div className="flex items-end gap-1.5">
          {canOpenPanel && onOpenPanel && (
            <button
              type="button"
              onClick={onOpenPanel}
              aria-label="Open conversation"
              title="Open conversation"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-bg text-muted transition-colors hover:text-ink"
            >
              <ChatIcon className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <InputBar onSend={onSend} onStop={onStop} disabled={isThinking} />
          </div>
        </div>
        <p className="label-caps mt-2 text-center text-[10px] text-muted">
          Powered by 0G Compute
        </p>
      </div>
    </div>
  );
}
