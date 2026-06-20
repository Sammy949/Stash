import { useCallback, useEffect, useRef, useState } from "react";
import type { Ledger, ParsedExpense, SyncPhase } from "@/types";
import { SEED_LEDGER, addExpense } from "@/lib/ledger";
import {
  getStoredRootHash,
  isStorageConfigured,
  loadLedger,
  saveLedger,
} from "@/lib/ogStorage";

export interface ToastState {
  message: string;
  rootHash: string;
  kind: "success" | "error";
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
  const [toast, setToast] = useState<ToastState | null>(null);

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
      setToast({
        message: "Ledger synced to 0G Storage",
        rootHash: result.rootHash,
        kind: "success",
      });
      window.setTimeout(() => setSyncPhase("idle"), 1800);
      return true;
    } catch (e) {
      console.error("0G Storage sync failed:", e);
      setSyncPhase("error");
      setToast({
        message:
          e instanceof Error ? `Sync failed — ${e.message}` : "Sync failed",
        rootHash: "",
        kind: "error",
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

  const clearToast = useCallback(() => setToast(null), []);

  return {
    ledger,
    hydrating,
    syncPhase,
    toast,
    clearToast,
    sync,
    logExpense,
  };
}
