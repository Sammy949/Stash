import type { Ledger, SyncResult } from "@/types";

/**
 * 0G Storage integration — encrypted persistent financial memory.
 *
 * STUB (step 3/5). Will implement:
 *   - client-side encryption of the ledger JSON (Web Crypto)
 *   - upload via Indexer + ZgFile, returning the root hash
 *   - download + decrypt by root hash
 *   - root-hash persistence in localStorage
 */

export const LEDGER_ROOT_KEY = "stash_ledger_root";

export async function saveLedger(_ledger: Ledger): Promise<SyncResult> {
  throw new Error("ogStorage.saveLedger not implemented yet (step 3)");
}

export async function loadLedger(_rootHash: string): Promise<Ledger> {
  throw new Error("ogStorage.loadLedger not implemented yet (step 3)");
}
