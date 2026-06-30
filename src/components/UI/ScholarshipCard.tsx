import type { Scholarship, UrgencyColor } from "@/types";
import { deriveUrgency, radarBadge } from "@/lib/ledger";

/**
 * Inline scholarship card — visible proof of a tracked scholarship's state,
 * shown inside an agent message bubble (when one is added, named, or due soon)
 * and reused on the dashboard radar so the two stay visually identical.
 *
 * DISPLAY-ONLY: urgency band and countdown come from the pure helpers in
 * ledger.ts (deriveUrgency / radarBadge) — this component computes nothing.
 */

/** Left-accent border per urgency band (kept whole for Tailwind scanning). */
const BORDER: Record<UrgencyColor, string> = {
  emerald: "border-l-emerald",
  amber: "border-l-amber",
  red: "border-l-red",
  muted: "border-l-line",
};

/** Countdown/status pill colors per urgency band. */
const BADGE: Record<UrgencyColor, string> = {
  emerald: "border-emerald/30 bg-emerald/10 text-emerald",
  amber: "border-amber/30 bg-amber/10 text-amber",
  red: "border-red/30 bg-red/10 text-red",
  muted: "border-line bg-bg/40 text-muted",
};

const DOT: Record<UrgencyColor, string> = {
  emerald: "bg-emerald",
  amber: "bg-amber",
  red: "bg-red",
  muted: "bg-muted",
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
  className = "w-full max-w-[18rem]",
}: {
  scholarship: Scholarship;
  now?: Date;
  /** Width container — radar passes "w-full"; chat uses the bounded default. */
  className?: string;
}) {
  const urgency = deriveUrgency(scholarship, now);

  return (
    <div
      className={`rounded-2xl border border-line border-l-2 ${BORDER[urgency]} bg-card/80 p-3.5 ${className}`}
    >
      {/* Name + countdown/status badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
          <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[urgency]}`} />
          <span className="truncate">{scholarship.name}</span>
        </span>
        <span
          className={`font-data shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${BADGE[urgency]}`}
        >
          {radarBadge(scholarship, now)}
        </span>
      </div>

      {/* Status label + deadline date */}
      <div className="mt-2 flex items-baseline justify-between gap-2 text-xs text-muted">
        <span className="truncate">{scholarship.statusLabel}</span>
        {scholarship.deadline && (
          <span className="font-data shrink-0">
            {formatDeadline(scholarship.deadline)}
          </span>
        )}
      </div>
    </div>
  );
}
