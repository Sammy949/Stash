import { QuickChips } from "./QuickChips";
import { InputBar } from "./InputBar";

/**
 * The always-present command bar, pinned to the bottom of the screen.
 * It's how you talk to Stash from any view — like a calm command line.
 */
export function CommandBar({
  onSend,
  isThinking,
}: {
  onSend: (text: string) => void;
  isThinking: boolean;
}) {
  return (
    <div className="border-t border-line bg-card/80 px-4 py-3 backdrop-blur">
      <div className="mx-auto w-full max-w-2xl space-y-2.5">
        <QuickChips onPick={onSend} disabled={isThinking} />
        <InputBar onSend={onSend} disabled={isThinking} />
        <p className="text-center text-[11px] text-muted">Powered by 0G Compute</p>
      </div>
    </div>
  );
}
