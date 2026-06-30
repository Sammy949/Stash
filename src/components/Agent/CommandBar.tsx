import { QuickChips } from "./QuickChips";
import { InputBar } from "./InputBar";

/**
 * The always-present command bar — a floating panel near the bottom of the
 * screen (no full-width bar; the page shows around it). It's how you talk
 * to Stash from any view, like a calm command line.
 */
export function CommandBar({
  onSend,
  onStop,
  isThinking,
}: {
  onSend: (text: string) => void;
  onStop?: () => void;
  isThinking: boolean;
}) {
  return (
    <div className="px-4 pb-5 pt-3">
      <div className="mx-auto w-full max-w-2xl">
        {/* Chips float above the pill; the pill (InputBar) carries its own
            border + shadow so it reads as a floating command line. */}
        <div className="mb-2.5">
          <QuickChips onPick={onSend} disabled={isThinking} />
        </div>
        <InputBar onSend={onSend} onStop={onStop} disabled={isThinking} />
        <p className="label-caps mt-2 text-center text-[10px] text-muted">
          Powered by 0G Compute
        </p>
      </div>
    </div>
  );
}
