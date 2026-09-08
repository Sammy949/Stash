import type { ReactNode } from "react";
import { Button } from "@/components/shadcn/button";

/**
 * Small ghost icon-button for per-row actions.
 *
 * A thin tone wrapper over the Button primitive, not a second button
 * implementation. It used to hand-roll the element at 44px with its own hover
 * and radius, which put a control on the page that matched nothing else in the
 * system; `size="icon"` is the shared 32px step.
 */
export function RowButton({
  label,
  onClick,
  tone = "muted",
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: "muted" | "emerald" | "red";
  children: ReactNode;
}) {
  // Only the ink differs per tone — the surface, radius and states all come
  // from the ghost variant, so these cannot drift from the rest of the app.
  const color =
    tone === "emerald"
      ? "text-primary"
      : tone === "red"
        ? "text-destructive"
        : "text-muted-foreground hover:text-foreground";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={onClick}
      className={`shrink-0 ${color}`}
    >
      {children}
    </Button>
  );
}
