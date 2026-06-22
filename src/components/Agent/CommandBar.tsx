import { QuickChips } from "./QuickChips";
import { InputBar } from "./InputBar";

/**
 * The always-present command bar — a floating panel near the bottom of the
 * screen (no full-width bar; the page shows around it). It's how you talk
 * to Stash from any view, like a calm command line.
 */
export function CommandBar({
  onSend,
  isThinking,
}: {
  onSend: (text: string) => void;
  isThinking: boolean;
}) {
  return (
    <div className="px-4 pb-5 pt-3">
      <div className="mx-auto w-full max-w-2xl">
        {/* Floating panel — distinct from the page via border + shadow. */}
        <div className="rounded-2xl border border-line bg-card/90 p-3 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.75)] backdrop-blur">
          <QuickChips onPick={onSend} disabled={isThinking} />
          <div className="mt-2.5">
            <InputBar onSend={onSend} disabled={isThinking} />
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted">
          Powered by 0G Compute
        </p>
      </div>
    </div>
  );
}
