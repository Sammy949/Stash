import type { Ledger, SyncPhase } from "@/types";
import { VaultCard } from "./VaultCard";
import { ScholarshipRadar } from "./ScholarshipRadar";
import { HustleLedger } from "./HustleLedger";
import { TransactionList } from "./TransactionList";

/** Full dashboard — the default, front-facing view. */
export function Dashboard({
  ledger,
  syncPhase,
  hydrating,
  onEditTransaction,
  onDeleteTransaction,
}: {
  ledger: Ledger;
  syncPhase: SyncPhase;
  hydrating: boolean;
  onEditTransaction: (
    id: string,
    patch: { amount?: number; label?: string },
  ) => void;
  onDeleteTransaction: (id: string) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <VaultCard ledger={ledger} syncPhase={syncPhase} hydrating={hydrating} />
      <ScholarshipRadar scholarships={ledger.scholarships} />
      <HustleLedger hustles={ledger.hustles} currency={ledger.currency} />
      <TransactionList
        transactions={ledger.transactions}
        currency={ledger.currency}
        onEdit={onEditTransaction}
        onDelete={onDeleteTransaction}
      />
    </div>
  );
}
