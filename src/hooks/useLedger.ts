import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Currency, Ledger, ParsedTransaction, SyncPhase } from "@/types";
import { EMPTY_LEDGER, addTransaction, migrateLedger } from "@/lib/ledger";
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
  const ref = useRef<Ledger>(EMPTY_LEDGER);
  const [ledger, setLedgerState] = useState<Ledger>(EMPTY_LEDGER);
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
        if (!cancelled) setLedger(migrateLedger(restored));
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
      toast.warning("Couldn't reach 0G just now", {
        description:
          e instanceof Error ? e.message : "Tap Sync to 0G again in a moment.",
      });
      window.setTimeout(() => setSyncPhase("idle"), 2800);
      return false;
    }
  }, []);

  /** Log a parsed transaction (income or expense); returns updated ledger. */
  const logTransaction = useCallback((parsed: ParsedTransaction): Ledger => {
    const next = addTransaction(ref.current, parsed);
    setLedger(next);
    return next;
  }, []);

  /** Seed the ledger from onboarding (owner, currency, opening balance). */
  const initProfile = useCallback(
    (profile: {
      owner: string;
      currency: Currency;
      openingBalance: number;
    }): Ledger => {
      const next: Ledger = {
        ...EMPTY_LEDGER,
        owner: profile.owner,
        currency: profile.currency,
        openingBalance: profile.openingBalance,
      };
      setLedger(next);
      return next;
    },
    [],
  );

  return {
    ledger,
    hydrating,
    syncPhase,
    sync,
    logTransaction,
    initProfile,
  };
}
