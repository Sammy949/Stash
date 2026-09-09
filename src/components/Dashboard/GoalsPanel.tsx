import type { Currency, Goal } from "@/types";
import { goalProgressPct, goalRemaining, isGoalComplete } from "@/lib/ledger";
import { formatMoneyCompact, formatMoney } from "@/lib/currency";
import { TargetIcon, CheckIcon } from "@/components/UI/icons";
import { EmptyState } from "@/components/UI/EmptyState";
import { Section, SectionAction } from "./Section";
import { GoalBar } from "@/components/UI/GoalBar";
import {
  Item,
  ItemContent,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from "@/components/shadcn/item";

const VISIBLE = 4;

/**
 * Goals panel — savings targets with earmarked progress. Each goal shows
 * saved/target (compact) and a progress bar. Progress is the earmark counter,
 * never the spendable balance (see `Goal` in types). Built on the shared
 * `Section` shell, so it is measured off the same object as the rest of the
 * dashboard. (It used to say it mirrored ScholarshipRadar and HustleLedger;
 * those two cards are gone, and their contents now live behind TrackingStrip.)
 */
export function GoalsPanel({
  goals,
  currency,
  onManage,
  onAdd,
  onOpen,
}: {
  goals: Goal[];
  currency: Currency;
  /** Open the Manage sheet (shown as "View all" once past VISIBLE). */
  onManage?: () => void;
  /** Prime the agent to set the first target, from the empty state. */
  onAdd?: () => void;
  /** Open one goal's history. Rows are inert without it. */
  onOpen?: (goal: Goal) => void;
}) {
  const overflow = onManage && goals.length > VISIBLE;
  const shown = overflow ? goals.slice(0, VISIBLE) : goals;

  return (
    <Section
      icon={<TargetIcon className="size-3.5" />}
      title="Goals"
      action={
        overflow ? (
          <SectionAction
            kind="open"
            onClick={onManage!}
            label={`View all ${goals.length}`}
          />
        ) : undefined
      }
    >
      {goals.length === 0 ? (
        <EmptyState
          title="No savings targets yet"
          hint={
            <>
              Name one and Stash will earmark toward it: say{" "}
              <span className="text-foreground">
                &ldquo;I want to save 200,000 for a laptop&rdquo;
              </span>
              .
            </>
          }
          action={onAdd ? { label: "Set a goal", onClick: onAdd } : undefined}
        />
      ) : (
        <ItemGroup
          // A clickable goal is a real <button>, and a button cannot also be a
          // listitem: an explicit role would override the one that actually
          // matters to assistive tech. So the group drops its list semantics
          // exactly when its rows become controls, the same trade PendingRows
          // makes in TransactionList.
          role={onOpen ? "presentation" : undefined}
        >
          {shown.map((g) => {
            const pct = goalProgressPct(g);
            const done = isGoalComplete(g);
            return (
              <Item
                key={g.id}
                role={onOpen ? undefined : "listitem"}
                size="sm"
                // A goal opens its own history, so the row IS the control —
                // rendered as a real button rather than a div with a click
                // handler, which is what keeps it keyboard-reachable.
                //
                // The hover state is a tonal step off the card and nothing
                // else: no lift, no shadow, no glowing edge. The negative
                // margin lets that tone sit in its own padding without pushing
                // the row's content off the alignment the other sections share.
                render={
                  onOpen ? (
                    <button
                      type="button"
                      onClick={() => onOpen(g)}
                      aria-label={`${g.name}: open history`}
                    />
                  ) : undefined
                }
                className={`flex-col items-stretch gap-2 px-0 ${
                  onOpen
                    ? "-mx-2 w-[calc(100%+1rem)] cursor-pointer rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-foreground/[0.04] focus-visible:bg-foreground/[0.04]"
                    : ""
                }`}
              >
                <ItemContent className="gap-2">
                  <ItemHeader>
                    {/* flex-1 + min-w-0, because this title shares a flex row
                        with the figure; without min-w-0 a long name refuses to
                        shrink and pushes the amount out of the card. */}
                    <ItemTitle
                      className="block min-w-0 flex-1 truncate"
                      title={g.name}
                    >
                      {g.name}
                    </ItemTitle>
                    <span className="font-data shrink-0 text-xs text-muted-foreground">
                      {formatMoneyCompact(g.savedAmount, currency)} /{" "}
                      {formatMoneyCompact(g.targetAmount, currency)}
                    </span>
                  </ItemHeader>

                  <GoalBar name={g.name} pct={pct} />

                  <ItemFooter>
                    {done ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-success">
                        <CheckIcon className="size-3" />
                        Target reached
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        {formatMoney(goalRemaining(g), currency)} to go
                      </span>
                    )}
                    <span className="font-data text-[11px] text-muted-foreground">
                      {Math.round(pct)}%
                    </span>
                  </ItemFooter>
                </ItemContent>
              </Item>
            );
          })}
        </ItemGroup>
      )}
    </Section>
  );
}
