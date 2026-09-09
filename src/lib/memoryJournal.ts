import type { Ledger, Transaction } from "@/types";
import {
  balance,
  getGoals,
  totalExpenses,
  totalIncome,
} from "@/lib/ledger";
import { resolveTenant, writeMoneyEvent, writeSnapshot } from "@/lib/memory";

/**
 * Journal a committed turn to Sibyl's COLD tier.
 *
 * This is the second home for a money event, and the reason it exists: the
 * local ledger is the instant working copy, and the journal is the durable
 * temporal history. Without it Sibyl holds WHO someone is but nothing about
 * WHEN their money moved, and the temporal tier is a route the app never
 * calls.
 *
 * Two hard rules, both about not letting memory hurt the ledger:
 *
 *   1. COMMITTED state only. The caller fires this from the ledger-update
 *      callback, which runs only when a turn actually mutated something. A
 *      rejected tool call never reaches here, so the journal can never record
 *      money that did not move.
 *   2. Never throws. Every failure is swallowed and logged. A sidecar that is
 *      down, a dropped tunnel, an unconfigured tenant: all of it degrades to
 *      "no journal entry", never to a broken turn. The ledger is already
 *      persisted locally by the time this runs.
 *
 * Fire-and-forget by design. The reply must not wait on a network write.
 */

/** Transactions present in `after` but not in `before`, by id. */
function newTransactions(before: Ledger, after: Ledger): Transaction[] {
  const seen = new Set(before.transactions.map((t) => t.id));
  return after.transactions.filter((t) => !seen.has(t.id));
}

/**
 * The financial state worth carrying between sessions.
 *
 * Deliberately derived figures only, never a copy of the ledger: the point is a
 * summary Stash can open with ("you were at X"), not a second source of truth
 * that could disagree with the transactions it came from.
 */
function snapshotOf(ledger: Ledger): Record<string, unknown> {
  const goals = getGoals(ledger);
  return {
    currency: ledger.currency,
    balance: balance(ledger),
    income: totalIncome(ledger),
    expenses: totalExpenses(ledger),
    transactions: ledger.transactions.length,
    goals: goals.length,
    goalNames: goals.map((g) => g.name),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Journal what a turn actually did, then refresh the snapshot.
 *
 * The event shape is Sibyl's: what was evaluated, what was acted on, what it
 * means going forward. `extra` carries the structured tags a reader filters on
 * later, because the COLD journal is a flat chronological log with no query
 * language of its own. `ts` is the transaction's own timestamp so a journal
 * entry and its ledger row cannot drift apart.
 */
export async function journalCommittedTurn(
  before: Ledger,
  after: Ledger,
): Promise<void> {
  const tenant = resolveTenant();
  if (!tenant) return; // ?nomemory, or no tenant configured. Stay silent.

  const added = newTransactions(before, after);
  const cur = after.currency;

  for (const tx of added) {
    const signed = tx.type === "income" ? tx.amount : -tx.amount;
    try {
      await writeMoneyEvent(tenant, {
        evaluated: `${tx.type} of ${tx.amount} ${cur}: ${tx.label}`,
        acted: `logged to the ledger; balance now ${balance(after)} ${cur}`,
        forward: `balance moved by ${signed} ${cur}`,
        extra: {
          kind: "transaction",
          type: tx.type,
          amount: tx.amount,
          currency: cur,
          label: tx.label,
          category: tx.category ?? null,
          transactionId: tx.id,
          balanceAfter: balance(after),
        },
        ts: tx.createdAt,
      });
    } catch (e) {
      // Non-fatal on purpose. See rule 2 above.
      console.warn("Money event not journalled to memory.", e);
    }
  }

  // Only worth rewriting when the numbers actually moved.
  if (added.length === 0 && before.goals === after.goals) return;

  try {
    await writeSnapshot(tenant, snapshotOf(after));
  } catch (e) {
    console.warn("Financial snapshot not written to memory.", e);
  }
}
