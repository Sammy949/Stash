import type { Currency, Hustle, HustleStatus } from "@/types";
import { totalActiveIncome } from "@/lib/ledger";
import { formatMoney } from "@/lib/currency";
import { BoltIcon } from "@/components/UI/icons";
import { EmptyState } from "@/components/UI/EmptyState";
import { Section, SectionAction } from "./Section";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/shadcn/item";

/**
 * Status → ink.
 *
 * This used to be four tinted pills. Colour in Stash is only ever allowed to
 * mean something about the money, so only the two states that mean income is
 * actually arriving carry the money-in colour; "pending" and "building" are
 * expectations, not money, and read as quiet ink. The words still distinguish
 * all four. (Literal class strings, for Tailwind's scanner.)
 */
const STATUS_TONE: Record<HustleStatus, string> = {
  received: "text-success",
  active: "text-success",
  pending: "text-muted-foreground",
  building: "text-muted-foreground",
};

const STATUS_LABEL: Record<HustleStatus, string> = {
  received: "Received",
  active: "Active",
  pending: "Pending",
  building: "Building",
};

const VISIBLE = 2;

export function HustleLedger({
  hustles,
  currency,
  onManage,
  onAdd,
}: {
  hustles: Hustle[];
  currency: Currency;
  /** Open the Manage sheet (shown as "View all" once past VISIBLE). */
  onManage?: () => void;
  /** Prime the agent to add the first stream, from the empty state. */
  onAdd?: () => void;
}) {
  const activeIncome = totalActiveIncome(hustles);
  const overflow = onManage && hustles.length > VISIBLE;
  const shown = overflow ? hustles.slice(0, VISIBLE) : hustles;
  const empty = hustles.length === 0;

  return (
    <Section
      icon={<BoltIcon className="size-3.5" />}
      title="Hustle Ledger"
      action={
        overflow ? (
          <SectionAction
            kind="open"
            onClick={onManage!}
            label={`View all ${hustles.length}`}
          />
        ) : undefined
      }
      summary={
        empty ? undefined : (
          <>
            <span className="label-caps text-[10px] text-muted-foreground">
              Active income
            </span>
            <span className="font-data text-sm font-semibold text-success">
              {formatMoney(activeIncome, currency)}/mo
            </span>
          </>
        )
      }
    >
      {empty ? (
        <EmptyState
          title="Track your side income"
          hint={
            <>
              Tell Stash{" "}
              <span className="text-foreground">
                &ldquo;I make 40,000 a month tutoring&rdquo;
              </span>{" "}
              and it lands here.
            </>
          }
          action={
            onAdd ? { label: "Add a stream", onClick: onAdd } : undefined
          }
        />
      ) : (
        <ItemGroup>
          {shown.map((h) => (
            <Item key={h.id} role="listitem" size="sm" className="px-0">
              <ItemContent className="min-w-0 gap-0.5">
                <ItemTitle className="block w-full truncate" title={h.name}>
                  {h.name}
                </ItemTitle>
                <ItemDescription className="text-xs">
                  <span>{h.tag}</span>
                  <span className="px-1.5 text-muted-foreground/50">·</span>
                  <span className="font-data">{h.amountLabel}</span>
                </ItemDescription>
              </ItemContent>

              <ItemActions>
                <span
                  className={`label-caps text-[10px] ${STATUS_TONE[h.status]}`}
                >
                  {STATUS_LABEL[h.status]}
                </span>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
    </Section>
  );
}
