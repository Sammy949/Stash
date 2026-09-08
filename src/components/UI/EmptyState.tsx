import type { ReactNode } from "react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/shadcn/empty";
import { Button } from "@/components/shadcn/button";
import { PlusIcon } from "@/components/UI/icons";

/**
 * Per-section empty state.
 *
 * Left-aligned, no icon, no dashed box. That is a deliberate reversal of what
 * was here before (a centred mark inside a tinted circle inside a dashed
 * rectangle): an icon parked in a box is the component-kit default, and a
 * dashed outline inside a card is a second container drawn around nothing.
 * The balance instrument already establishes how Stash says "nothing measured
 * yet" — plain ink, left aligned, naming the gesture — and every section now
 * says it the same way.
 *
 * The hint teaches what to SAY, because Stash is agent-first and there is no
 * manual add form. `action` primes that sentence into the composer for anyone
 * who would rather press something than type it.
 */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <Empty className="items-start gap-3 p-0 text-left">
      <EmptyHeader className="items-start gap-1 text-left">
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription className="text-xs leading-relaxed">
          {hint}
        </EmptyDescription>
      </EmptyHeader>

      {action && (
        <EmptyContent className="items-start">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={action.onClick}
          >
            <PlusIcon />
            {action.label}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
