import type { ReactNode } from "react";
import { PlusIcon } from "@/components/UI/icons";

/**
 * Empty-state tile for a tracker section (Scholarship Radar / Hustle Ledger).
 * Left-aligned card: icon up top, title, then a footer row with a small
 * status and the `+` action. Tapping primes the agent to add the first entry
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
      className="group flex min-h-[11rem] w-full flex-col rounded-2xl border border-dashed border-border bg-card/40 p-5 text-left transition-colors hover:border-primary/40 hover:bg-card"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background/40 text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
        {icon}
      </span>

      <p className="mt-4 text-xl font-semibold leading-tight text-foreground">{title}</p>

      <div className="mt-auto flex items-center justify-between pt-4">
        <span className="text-xs text-muted-foreground">{subtitle}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <PlusIcon className="h-4 w-4" />
        </span>
      </div>
    </button>
  );
}
