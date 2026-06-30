import type { ReactNode } from "react";
import { PlusIcon } from "@/components/UI/icons";

/**
 * Empty-state tile for a tracker section (Scholarship Radar / Hustle Ledger).
 * A square `+` CTA that, when tapped, primes the agent to add the first entry
 * via conversation (Stash is agent-first — no manual add form here).
 */
export function TrackerTile({
  icon,
  title,
  subtitle,
  onAdd,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onAdd: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="group flex h-full min-h-[10rem] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-card/40 p-5 text-center transition-colors hover:border-emerald/40 hover:bg-card"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-bg/40 text-muted transition-colors group-hover:border-emerald/40 group-hover:text-emerald">
        {icon}
      </span>
      <span className="label-caps text-[11px] text-muted">{title}</span>
      <span className="text-xs text-muted">{subtitle}</span>
      <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald/10 text-emerald transition-colors group-hover:bg-emerald group-hover:text-bg">
        <PlusIcon className="h-4 w-4" />
      </span>
    </button>
  );
}
