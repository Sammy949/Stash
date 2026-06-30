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
    <div className="flex flex-wrap gap-2">
      {CHIPS.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          disabled={disabled}
          className="rounded-full border border-line bg-bg px-3 py-1.5 text-xs text-muted transition-colors hover:border-emerald/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {c}
        </button>
      ))}
    </div>
  );
}
