import { useState } from "react";
import type { Currency, Transaction } from "@/types";
import { formatMoney } from "@/lib/currency";
import { ReceiptIcon } from "@/components/UI/icons";
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

const PREVIEW = 3;

/** "29 Jun" — compact day+month for the row timestamp. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * Recent activity — a read-only audit trail, not a control surface. It exists
 * so the numbers stay verifiable (money must be auditable), but it doesn't
 * scream: the latest few entries show by default, "View all" reveals the rest.
 *
 * Corrections don't happen here — you fix a mistake by editing the chat
 * message that logged it, which rewinds and re-runs from the right state.
 * Transactions are proof, not the product.
 *
 * The category no longer sits in a bordered chip. Metadata gets typographic
 * rank (quieter ink, smaller size, a middot between the two facts), because a
 * pill around every noun is dashboard-kit styling, not hierarchy.
 */
export function TransactionList({
  transactions,
  currency,
}: {
  transactions: Transaction[];
  currency: Currency;
}) {
  const [expanded, setExpanded] = useState(false);

  // Newest first. Copy before sort — never mutate the ledger array in place.
  const ordered = [...transactions].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  const shown = expanded ? ordered : ordered.slice(0, PREVIEW);

  return (
    <Section
      icon={<ReceiptIcon className="size-3.5" />}
      title="Recent Activity"
      action={
        ordered.length > PREVIEW ? (
          <SectionAction
            kind="expand"
            expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            label={expanded ? "Show less" : `View all ${ordered.length}`}
          />
        ) : undefined
      }
    >
      {ordered.length === 0 ? (
        <EmptyState
          title="No activity yet"
          hint={
            <>
              Log the first one: say{" "}
              <span className="text-foreground">
                &ldquo;I spent 3,000 on lunch&rdquo;
              </span>
              .
            </>
          }
        />
      ) : (
        <ItemGroup>
          {shown.map((t) => {
            const income = t.type === "income";
            const kind = t.category ?? t.tag ?? (income ? "income" : "other");
            return (
              <Item key={t.id} role="listitem" size="sm" className="px-0">
                <ItemContent className="min-w-0 gap-0.5">
                  {/* block+truncate rather than ItemTitle's own line-clamp-1,
                      which is dead: the same element also sets `flex`, and
                      Tailwind emits .flex after .line-clamp-1, so the clamp
                      never applies and a long label wraps the row taller than
                      its neighbours. `block` is in tailwind-merge's display
                      group, so it genuinely replaces `flex`. */}
                  <ItemTitle className="block w-full truncate" title={t.label}>
                    {t.label}
                  </ItemTitle>
                  <ItemDescription className="text-xs">
                    <span className="capitalize">{kind}</span>
                    <span className="px-1.5 text-muted-foreground/50">·</span>
                    <span className="font-data">{shortDate(t.createdAt)}</span>
                  </ItemDescription>
                </ItemContent>

                {/* Income is the only coloured figure. A normal spend is
                    neutral ink: colouring every outflow red cries wolf. */}
                <ItemActions>
                  <span
                    className={`font-data text-sm font-semibold ${
                      income ? "text-success" : "text-foreground"
                    }`}
                  >
                    {income ? "+" : "−"}
                    {formatMoney(t.amount, currency)}
                  </span>
                </ItemActions>
              </Item>
            );
          })}
        </ItemGroup>
      )}
    </Section>
  );
}
