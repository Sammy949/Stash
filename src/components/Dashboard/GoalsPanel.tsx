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
 * never the spendable balance (see `Goal` in types). Mirrors the structure of
 * ScholarshipRadar / HustleLedger so the dashboard reads as one system.
 */
export function GoalsPanel({
  goals,
  currency,
  onManage,
  onAdd,
}: {
  goals: Goal[];
  currency: Currency;
  /** Open the Manage sheet (shown as "View all" once past VISIBLE). */
  onManage?: () => void;
  /** Prime the agent to set the first target, from the empty state. */
  onAdd?: () => void;
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
        <ItemGroup>
          {shown.map((g) => {
            const pct = goalProgressPct(g);
            const done = isGoalComplete(g);
            return (
              <Item
                key={g.id}
                role="listitem"
                size="sm"
                className="flex-col items-stretch gap-2 px-0"
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
