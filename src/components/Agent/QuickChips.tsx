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

/**
 * Conversation starters. Kept as real buttons rather than wrapped in Badge: the
 * 44px touch target and the horizontal-scroll row are load-bearing on phones,
 * and Badge's own sizing fights both. What it does borrow from the new system is
 * scroll-fade-e, so the cut edge reads as "more to the right" instead of clipped.
 */
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
    <div className="no-scrollbar scroll-fade-e -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:px-0 sm:[--scroll-fade-mask:none]">
      {CHIPS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c)}
          disabled={disabled}
          className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-background px-3.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          {c}
        </button>
      ))}
    </div>
  );
}
