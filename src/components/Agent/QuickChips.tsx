/** The "Sync to 0G" chip is intercepted by App; the rest go to the agent. */
export const SYNC_CHIP = "Sync to 0G";

/**
 * The "Review my goals" chip. A general query (no goal tool fires), so the
 * agent turn carries no relatedGoalIds — useAgent recognizes this exact text
 * and attaches all active goals so the reply shows the full goal stack.
 */
export const REVIEW_GOALS_CHIP = "Review my goals";

/**
 * The "Scholarship deadlines" chip. A general query (no scholarship tool
 * fires), so useAgent recognizes this exact text and attaches the top few most-
 * urgent scholarships to surface their inline cards.
 */
export const SCHOLARSHIP_DEADLINES_CHIP = "Scholarship deadlines";

export const CHIPS = [
  "Analyze my spending",
  REVIEW_GOALS_CHIP,
  SCHOLARSHIP_DEADLINES_CHIP,
  "Match me to hustles",
  SYNC_CHIP,
];

export function QuickChips({
  onPick,
  disabled = false,
}: {
  onPick: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    // Single horizontally-scrollable row on phones (no wrap stealing vertical
    // space above the keyboard); wraps normally once there's room.
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
      {CHIPS.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          disabled={disabled}
          className="inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-full border border-line bg-bg px-3.5 text-xs text-muted transition-colors hover:border-emerald/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {c}
        </button>
      ))}
    </div>
  );
}
