import type { ComponentType, ReactNode } from "react";
import type { Currency, Goal, GoalEvent } from "@/types";
import {
  goalEvents,
  goalProgressPct,
  goalRemaining,
  isGoalComplete,
} from "@/lib/ledger";
import { observedPace, paceFacts } from "@/lib/goalContext";
import { formatMoney } from "@/lib/currency";
import { useGoalMemory } from "@/hooks/useGoalMemory";
import { AnimatedNumber } from "@/components/UI/AnimatedNumber";
import { useIsMobile } from "@/hooks/use-mobile";
import { GoalBar } from "@/components/UI/GoalBar";
import {
  ArrowUpRightIcon,
  CheckIcon,
  MemoryIcon,
} from "@/components/UI/icons";
import { Button } from "@/components/shadcn/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/shadcn/item";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/shadcn/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/shadcn/drawer";

/**
 * "Sep 8", or "May 13, 2027" once it isn't this year any more.
 *
 * Spaces are non-breaking: these dates sit inside running sentences, and a
 * wrap between the month and the day ("past your Dec / 1 deadline") reads as
 * broken text. A date is one word.
 */
function shortDate(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
    })
    .replace(/ /g, "\u00A0");
}

/**
 * What a history entry says when nobody explained it.
 *
 * Every line here is derived from the stored event, never from the model, which
 * is what lets the whole timeline render with the memory service unreachable.
 * `lead` is the row's headline (a remembered note replaces it); `detail` is the
 * accounting that sits under it either way.
 */
function describe(
  event: GoalEvent,
  goal: Goal,
  currency: Currency,
): { lead: string; detail: string } {
  const money = (n: number) => formatMoney(n, currency);
  switch (event.kind) {
    case "created":
      return {
        lead: "Goal started",
        detail: [
          `Target ${money(event.targetAmount ?? goal.targetAmount)}`,
          event.toDate ? `by ${shortDate(event.toDate)}` : "",
        ]
          .filter(Boolean)
          .join(" "),
      };
    case "contribution": {
      if (event.carriedOver)
        return {
          lead: "Carried over",
          detail: "Set aside before Stash tracked each step",
        };
      // A negative delta is a correction walking progress back. It says so
      // rather than hiding behind the same "set aside" wording as a deposit.
      return {
        lead: (event.amount ?? 0) < 0 ? "Correction" : "Set aside",
        // The running total, not a restatement of the row: the signed figure
        // in the amount column has already said how much moved.
        detail:
          event.savedAfter !== undefined
            ? `${money(event.savedAfter)} of ${money(goal.targetAmount)}`
            : "",
      };
    }
    case "target_changed": {
      const from = event.fromAmount ?? 0;
      const to = event.toAmount ?? goal.targetAmount;
      return {
        lead: to > from ? "Target raised" : "Target lowered",
        detail: `${money(from)} → ${money(to)}`,
      };
    }
    case "date_changed": {
      if (!event.toDate) return { lead: "Date removed", detail: "No deadline now" };
      return {
        lead: event.fromDate ? "Date moved" : "Date set",
        detail: event.fromDate
          ? `${shortDate(event.fromDate)} → ${shortDate(event.toDate)}`
          : shortDate(event.toDate),
      };
    }
    case "reached":
      return { lead: "Target reached", detail: `${money(goal.targetAmount)} covered` };
  }
}

/**
 * The one line about pace — measured, demanded, or nothing at all.
 *
 * The distinction is the whole honesty of it: "averaging" is what the history
 * shows they have actually done, "needs" is what the target date would require.
 * Those are never blended into one number, and when neither is knowable the
 * line is simply absent rather than filled with an encouraging guess.
 */
function paceLine(goal: Goal, currency: Currency): string | null {
  const money = (n: number) => formatMoney(Math.round(n), currency);
  const observed = observedPace(goal);

  if (observed) {
    const rate = `Averaging ${money(observed.perMonth)} a month`;
    if (!observed.projectedDate) return `${rate}. At that pace the target is over ten years away.`;
    const lands = shortDate(observed.projectedDate);
    if (!goal.targetDate) return `${rate}, which lands it around ${lands}.`;
    const deadline = shortDate(goal.targetDate);
    return Date.parse(observed.projectedDate) <= Date.parse(goal.targetDate)
      ? `${rate}, which lands it around ${lands}: ahead of your ${deadline} deadline.`
      : `${rate}, which lands it around ${lands}: past your ${deadline} deadline.`;
  }

  const needed = paceFacts(goal);
  if (needed) return `Needs about ${money(needed.perMonth)} a month to land by ${shortDate(goal.targetDate!)}.`;
  return null;
}

/**
 * A savings goal opened up: where it stands, and everything that happened to it.
 *
 * The timeline is assembled from two records that fail independently. The
 * ledger's `GoalEvent`s supply every figure and date, so the history renders
 * offline, after a restore, and with memory switched off. Sibyl's journal
 * supplies the reason each one happened, joined on the event id.
 *
 * That split is what the row hierarchy is built to show. The REMEMBERED line is
 * the headline and the accounting is the annotation beneath it — the inverse of
 * the ranking on the dashboard, because this surface is a memory rather than a
 * statement. With memory off, every row falls back to its clerical description
 * and the same history reads in a flatter voice with no figure lost. That is
 * the product's whole argument, visible in one screen.
 */
export function GoalDetail({
  goal,
  currency,
  onClose,
  onAsk,
}: {
  /** The goal to open, or null when nothing is open. */
  goal: Goal | null;
  currency: Currency;
  onClose: () => void;
  /** Hand this goal to the conversation (closes the detail). */
  onAsk: (goal: Goal) => void;
}) {
  const isMobile = useIsMobile();
  const { notes, available } = useGoalMemory(goal?.id ?? null);
  const open = goal !== null;

  // Both shells render the SAME body, so the phone and the desktop view cannot
  // drift into two different designs of the same screen.
  const body = goal && (
    <GoalDetailBody
      goal={goal}
      currency={currency}
      notes={notes}
      memoryAvailable={available}
      onAsk={() => onAsk(goal)}
      // Only the dialog parks a close button in its top-right corner, so only
      // the dialog needs the header to keep clear of one.
      reserveClose={!isMobile}
      Title={isMobile ? DrawerTitle : DialogTitle}
      Description={isMobile ? DrawerDescription : DialogDescription}
    />
  );

  if (isMobile) {
    return (
      // showSwipeHandle, because the sheet has no close button of its own: the
      // dialog's × is the desktop affordance, and without the grab handle the
      // phone version offers nothing to say it can be dismissed.
      <Drawer open={open} onOpenChange={(next) => !next && onClose()} showSwipeHandle>
        <DrawerContent className="max-h-[85dvh] overflow-hidden">
          {body}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      {/* flex replaces the primitive's own `grid` (tailwind-merge resolves the
          display group), so the history can be the one part that scrolls while
          the standing figures and the action stay put. */}
      <DialogContent className="flex max-h-[80dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {body}
      </DialogContent>
    </Dialog>
  );
}

function GoalDetailBody({
  goal,
  currency,
  notes,
  memoryAvailable,
  onAsk,
  reserveClose,
  Title,
  Description,
}: {
  goal: Goal;
  currency: Currency;
  notes: Map<string, string>;
  memoryAvailable: boolean;
  onAsk: () => void;
  /** Keep the header clear of an overlaid close button. */
  reserveClose: boolean;
  Title: ComponentType<{ className?: string; children: ReactNode }>;
  Description: ComponentType<{ className?: string; children: ReactNode }>;
}) {
  const pct = goalProgressPct(goal);
  const done = isGoalComplete(goal);
  const pace = paceLine(goal, currency);
  // Newest first. The stored order is chronological, so reversing it keeps
  // same-second entries (a contribution and the target it completed) in the
  // order they actually happened rather than at the mercy of a sort.
  const history = [...goalEvents(goal)].reverse();
  const remembered = history.filter((e) => notes.has(e.id)).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Standing: the numbers, which are true whatever else is reachable.
          The extra right padding keeps a long goal name from running underneath
          the close button parked in that corner. */}
      <div
        className={`flex flex-col gap-3 px-5 pt-5 pb-4 ${reserveClose ? "pr-10" : ""}`}
      >
        <Title className="text-sm font-medium text-muted-foreground">
          {goal.name}
        </Title>

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {/* The same tween the balance instrument uses, for the same reason:
              a contribution made while this is open should be watched landing,
              not silently swapped. It renders the real figure on mount and
              only moves when the number actually changes. */}
          <AnimatedNumber
            value={goal.savedAmount}
            format={(n) => formatMoney(n, currency)}
            className="font-data text-3xl leading-none font-semibold tracking-tight"
          />
          <span className="font-data text-sm text-muted-foreground">
            of {formatMoney(goal.targetAmount, currency)}
          </span>
        </div>

        <GoalBar name={goal.name} pct={pct} />

        <Description className="flex flex-wrap items-center gap-x-2 text-xs">
          {done ? (
            <span className="flex items-center gap-1 font-medium text-success">
              <CheckIcon className="size-3" />
              Target reached
            </span>
          ) : (
            <span>{formatMoney(goalRemaining(goal), currency)} to go</span>
          )}
          <span className="text-muted-foreground/40">·</span>
          <span className="font-data">{Math.round(pct)}%</span>
        </Description>

        {/* text-pretty so a two-line pace sentence doesn't strand one word on
            its own last line. */}
        {pace && (
          <p className="text-xs text-pretty text-muted-foreground">{pace}</p>
        )}
      </div>

      {/* History. The heading names where this comes from, because where it
          comes from is the point. */}
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border px-5 py-4">
        <h3 className="label-caps flex items-center gap-2 text-[10px] text-muted-foreground">
          <MemoryIcon className="size-3.5" />
          Memory
        </h3>

        {!memoryAvailable && (
          <p className="mt-2 text-xs text-muted-foreground">
            Memory is off, so the reasons are gone. Every figure below is the
            ledger&rsquo;s own.
          </p>
        )}
        {memoryAvailable && remembered === 0 && history.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Nothing said about why yet. Tell Stash the reason next time and it
            keeps it here.
          </p>
        )}

        <ItemGroup className="mt-3">
          {history.map((event) => (
            <HistoryRow
              key={event.id}
              event={event}
              goal={goal}
              currency={currency}
              note={notes.get(event.id)}
            />
          ))}
        </ItemGroup>
      </div>

      <div className="border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          variant="outline"
          onClick={onAsk}
          className="h-11 w-full justify-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          Ask Stash about this
          <ArrowUpRightIcon />
        </Button>
      </div>
    </div>
  );
}

/** One entry: what was remembered, then what was recorded. */
function HistoryRow({
  event,
  goal,
  currency,
  note,
}: {
  event: GoalEvent;
  goal: Goal;
  currency: Currency;
  note?: string;
}) {
  const { lead, detail } = describe(event, goal, currency);
  const amount = event.amount ?? 0;
  const reached = event.kind === "reached";
  // When a remembered reason takes the headline, the clerical label usually
  // has to move down into the detail line so nothing is lost. A plain
  // contribution is the exception: the signed figure in the amount column has
  // already said "set aside", and repeating it reads as stutter.
  const leadBelow = Boolean(
    note && (event.kind !== "contribution" || event.carriedOver),
  );

  return (
    <Item role="listitem" size="sm" className="items-start px-0">
      <ItemContent className="min-w-0 gap-0.5">
        {/* Overrides the primitive's one-line clamp and w-fit flex: a
            remembered reason is a sentence and is allowed to wrap. */}
        <ItemTitle
          className={`block w-full text-pretty whitespace-normal ${
            reached ? "text-success" : ""
          } ${note ? "font-normal" : ""}`}
        >
          {note ?? lead}
        </ItemTitle>
        <ItemDescription className="text-xs">
          <span className="font-data">{shortDate(event.at)}</span>
          {detail && (
            <>
              <span className="px-1.5 text-muted-foreground/50">·</span>
              <span>{leadBelow ? `${lead}. ${detail}` : detail}</span>
            </>
          )}
        </ItemDescription>
      </ItemContent>

      {/* The amount column is held even for entries that moved no money, so
          the rows stay on one grid instead of going ragged down the list. */}
      <ItemActions className="shrink-0">
        {event.kind === "contribution" && (
          <span
            className={`font-data text-sm font-semibold ${
              event.carriedOver
                ? "text-muted-foreground"
                : amount < 0
                  ? "text-foreground"
                  : "text-success"
            }`}
          >
            {amount < 0 ? "−" : "+"}
            {formatMoney(Math.abs(amount), currency)}
          </span>
        )}
      </ItemActions>
    </Item>
  );
}
