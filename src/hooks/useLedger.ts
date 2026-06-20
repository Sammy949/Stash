import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Ledger, ParsedExpense, SyncPhase } from "@/types";
import { SEED_LEDGER, addExpense } from "@/lib/ledger";
import {
  getStoredRootHash,
  isStorageConfigured,
  loadLedger,
  saveLedger,
} from "@/lib/ogStorage";

/** Short root-hash badge: "#a7f3c2b1…". */
function shortRoot(rootHash: string): string {
  const hex = rootHash.replace(/^0x/, "");
  return hex ? `#${hex.slice(0, 8)}…` : "";
}

/**
 * useLedger — owns ledger state, expense logging, and 0G Storage sync.
 *
 * On mount it hydrates from 0G (if a root hash is stored), so the ledger
 * persists across sessions. A ref mirrors state so async sync handlers
 * always read the latest ledger.
 */
export function useLedger() {
  const ref = useRef<Ledger>(SEED_LEDGER);
  const [ledger, setLedgerState] = useState<Ledger>(SEED_LEDGER);
  const [hydrating, setHydrating] = useState<boolean>(
    isStorageConfigured() && Boolean(getStoredRootHash()),
  );
  const [syncPhase, setSyncPhase] = useState<SyncPhase>("idle");

  const setLedger = (next: Ledger) => {
    ref.current = next;
    setLedgerState(next);
  };

  // Restore the ledger from 0G Storage on first load.
  useEffect(() => {
    const root = getStoredRootHash();
    if (!isStorageConfigured() || !root) {
      setHydrating(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const restored = await loadLedger(root);
        if (!cancelled) setLedger(restored);
      } catch (e) {
        console.warn("Ledger hydrate from 0G failed; using local state.", e);
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Encrypt + upload the ledger to 0G. Returns true on success. */
  const sync = useCallback(async (target?: Ledger): Promise<boolean> => {
    const current = target ?? ref.current;
    setSyncPhase("encrypting");
    try {
      const result = await saveLedger(current, () => setSyncPhase("uploading"));
      setLedger({ ...ref.current, lastSyncedAt: result.syncedAt });
      setSyncPhase("confirmed");
      toast.success("Ledger synced to 0G Storage", {
        description: `Encrypted · Root: ${shortRoot(result.rootHash)}`,
      });
      window.setTimeout(() => setSyncPhase("idle"), 1800);
      return true;
    } catch (e) {
      console.error("0G Storage sync failed:", e);
      setSyncPhase("error");
      toast.error("0G Storage sync failed", {
        description: e instanceof Error ? e.message : "Upload didn't go through.",
      });
      window.setTimeout(() => setSyncPhase("idle"), 2800);
      return false;
    }
  }, []);

  /** Log a parsed expense locally and return the updated ledger. */
  const logExpense = useCallback((parsed: ParsedExpense): Ledger => {
    const next = addExpense(ref.current, parsed);
    setLedger(next);
    return next;
  }, []);

  return {
    ledger,
    hydrating,
    syncPhase,
    sync,
    logExpense,
  };
}
