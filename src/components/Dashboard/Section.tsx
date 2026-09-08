import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { ArrowUpRightIcon, CaretDownIcon } from "@/components/UI/icons";

/**
 * The shell every dashboard section sits in.
 *
 * Before this there were four hand-rolled copies of the same markup (a rounded
 * bordered box, a mono caps heading with a small mark, a list, and a footer
 * link), which is how four sections drift apart. One shell means the whole
 * dashboard is measured off the same object.
 *
 * The heading treatment is deliberately the SAME one the balance instrument
 * uses for "Balance" — mono caps at 10px in muted ink — so a section reads as
 * another face of the instrument rather than a card bolted on beside it.
 *
 * Two optional slots, and the difference between them is real:
 *   `action`   a quiet control at the foot of the list (expand, or manage).
 *   `summary`  a derived figure that belongs on its own floor (CardFooter),
 *              because a total is not another row of the list.
 */
export function Section({
  icon,
  title,
  children,
  action,
  summary,
}: {
  /** The section's mark, sized by the caller (`size-3.5`). */
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  summary?: ReactNode;
}) {
  return (
    // h-full + the action's mt-auto are what keep the paired tracker columns
    // honest: whichever card has more rows sets the height, and BOTH cards'
    // controls sit on the same line instead of floating wherever their own
    // content happened to end.
    <Card className="h-full">
      <CardHeader>
        {/* A real <h2>: the dashboard keeps a document outline, and CardTitle
            would only have had every one of its classes overridden. */}
        <h2 className="label-caps flex items-center gap-2 text-[10px] text-muted-foreground">
          {icon}
          {title}
        </h2>
      </CardHeader>

      <CardContent>{children}</CardContent>

      {action && <CardContent className="mt-auto">{action}</CardContent>}

      {summary && (
        <CardFooter className="mt-auto justify-between gap-4">
          {summary}
        </CardFooter>
      )}
    </Card>
  );
}

/**
 * "There is more of this list than you can see."
 *
 * Two shapes, because they do two different things and should not look
 * identical. Expanding in place gets a caret that turns to point at what it
 * did; leaving for the manage sheet gets the up-and-out diagonal. Neither is
 * the stock horizontal CTA arrow.
 */
export function SectionAction({
  label,
  onClick,
  kind,
  expanded = false,
}: {
  label: string;
  onClick: () => void;
  kind: "expand" | "open";
  /** Expand only: rotates the caret and sets aria-expanded. */
  expanded?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-expanded={kind === "expand" ? expanded : undefined}
      // Full width for the tap target, but the label and its mark sit TOGETHER
      // at the start. justify-between stranded the icon against the far right
      // edge of a wide card, half a metre from the words it belongs to.
      className="h-9 w-full justify-start gap-1.5 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
    >
      {label}
      {kind === "expand" ? (
        <CaretDownIcon
          className={`transition-transform duration-200 motion-reduce:transition-none ${
            expanded ? "rotate-180" : ""
          }`}
        />
      ) : (
        <ArrowUpRightIcon />
      )}
    </Button>
  );
}
