import type { Scholarship } from "@/types";
import { RadarIcon } from "@/components/UI/icons";
import { EmptyState } from "@/components/UI/EmptyState";
import { ScholarshipCard } from "@/components/UI/ScholarshipCard";

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

      <ul className="mt-4 space-y-2">
        {shown.map((s) => (
          <li key={s.id}>
            <ScholarshipCard scholarship={s} className="w-full" />
          </li>
        ))}
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
