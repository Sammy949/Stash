import { useState } from "react";
import type { Ledger } from "@/types";
import { SEED_LEDGER } from "@/lib/ledger";

/**
 * useLedger — owns ledger state, expense/income mutations, and 0G sync.
 *
 * STUB (wired up in step 5). For now it just holds the seed ledger so
 * the dashboard renders.
 */
export function useLedger() {
  const [ledger, setLedger] = useState<Ledger>(SEED_LEDGER);

  return { ledger, setLedger };
}
