import type { Scholarship, UrgencyColor } from "@/types";
import { deriveUrgency, radarBadge } from "@/lib/ledger";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/shadcn/item";

/**
 * Inline scholarship card — visible proof of a tracked scholarship's state,
 * shown inside an agent message bubble (when one is added, named, or due soon)
 * and reused on the dashboard radar so the two stay visually identical.
 *
 * DISPLAY-ONLY: urgency band and countdown come from the pure helpers in
 * ledger.ts (deriveUrgency / radarBadge) — this component computes nothing.
 *
 * The urgency used to be said three times at once: a coloured left bar, a
 * coloured dot, and a tinted pill. The bar was the accent-bar-card preset and
 * the pill was a chip around a number. It is said once now, in the colour of
 * the countdown figure itself, which is the only place the information is
 * actually load-bearing.
 */

/** Countdown ink per urgency band. `emerald` means secured / on track, which is
 *  the money-in colour; `amber` and `red` are the deadline closing. */
const TONE: Record<UrgencyColor, string> = {
  emerald: "text-success",
  amber: "text-warning",
  red: "text-destructive",
  muted: "text-muted-foreground",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Format a YYYY-MM-DD deadline without timezone drift (no Date parsing). */
function formatDeadline(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function ScholarshipCard({
  scholarship,
  now,
  className = "max-w-[18rem]",
  role,
  variant = "outline",
}: {
  scholarship: Scholarship;
  now?: Date;
  /** Width container — radar passes "w-full"; chat uses the bounded default. */
  className?: string;
  /** "listitem" when rendered inside the radar's ItemGroup; absent in chat,
   *  where the card stands alone and a listitem role would be a lie. */
  role?: string;
  /** In chat the card stands alone on the bubble and needs its own edge. On
   *  the radar it is one row of a list inside a Card, and an outline there
   *  draws a second container around nothing — and made the radar speak a
   *  different language from the hustle list sitting right beside it. */
  variant?: "outline" | "default";
}) {
  const urgency = deriveUrgency(scholarship, now);

  return (
    <Item variant={variant} size="sm" className={className} role={role}>
      <ItemContent className="min-w-0 gap-0.5">
        {/* block+truncate, not ItemTitle's own line-clamp-1: that class sets
            display:-webkit-box and is then overridden by the same element's
            `flex`, which Tailwind emits later, so it silently does nothing.
            Verified by offset in the compiled CSS. `block` is in the same
            tailwind-merge group as `flex`, so it actually replaces it. */}
        <ItemTitle className="block w-full truncate" title={scholarship.name}>
          {scholarship.name}
        </ItemTitle>
        <ItemDescription className="truncate text-xs">
          <span>{scholarship.statusLabel}</span>
          {scholarship.deadline && (
            <>
              <span className="px-1.5 text-muted-foreground/50">·</span>
              <span className="font-data">
                {formatDeadline(scholarship.deadline)}
              </span>
            </>
          )}
        </ItemDescription>
      </ItemContent>

      <ItemActions>
        <span className={`font-data text-xs font-medium ${TONE[urgency]}`}>
          {radarBadge(scholarship, now)}
        </span>
      </ItemActions>
    </Item>
  );
}
