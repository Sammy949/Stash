import type { Scholarship, UrgencyColor } from "@/types";
import { deriveUrgency, radarBadge } from "@/lib/ledger";
import { RadarIcon } from "@/components/UI/icons";
import { EmptyState } from "@/components/UI/EmptyState";

/** Literal class strings per urgency band (kept whole for Tailwind scanning). */
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

const VISIBLE = 2;

export function ScholarshipRadar({
  scholarships,
  onManage,
}: {
  scholarships: Scholarship[];
  /** Open the Manage sheet (shown as "View all" once past VISIBLE). */
  onManage?: () => void;
}) {
  const overflow = onManage && scholarships.length > VISIBLE;
  const shown = overflow ? scholarships.slice(0, VISIBLE) : scholarships;

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-center gap-2 text-muted">
        <RadarIcon className="h-3.5 w-3.5" />
        <h2 className="label-caps text-[11px]">Scholarship Radar</h2>
      </div>

      {scholarships.length === 0 && (
        <EmptyState
          icon={<RadarIcon className="h-4 w-4" />}
          title="No deadlines tracked yet"
          hint="Tell Stash: “I'm applying for the MTN scholarship, deadline Aug 30.”"
        />
      )}

      <ul className="mt-4 space-y-1">
        {shown.map((s) => {
          const urgency = deriveUrgency(s);
          return (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-bg/40"
            >
              <span
                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${DOT[urgency]}`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.name}</p>
                <p className="truncate text-xs text-muted">{s.statusLabel}</p>
              </div>
              <span
                className={`font-data shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${BADGE[urgency]}`}
              >
                {radarBadge(s)}
              </span>
            </li>
          );
        })}
      </ul>

      {overflow && (
        <button
          type="button"
          onClick={onManage}
          className="mt-3 w-full border-t border-line pt-3 text-xs text-muted transition-colors hover:text-ink"
        >
          View all ({scholarships.length}) →
        </button>
      )}
    </section>
  );
}
