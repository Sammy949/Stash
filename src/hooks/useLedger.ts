import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Currency, Ledger, SyncPhase } from "@/types";
import { EMPTY_LEDGER, migrateLedger } from "@/lib/ledger";
import {
  getLocalLedger,
  getStoredRootHash,
  isStorageConfigured,
  loadLedger,
  saveLedger,
  saveLocalLedger,
} from "@/lib/ogStorage";

/** Short root-hash badge: "#a7f3c2b1…". */
function shortRoot(rootHash: string): string {
  const hex = rootHash.replace(/^0x/, "");
  return hex ? `#${hex.slice(0, 8)}…` : "";
}

/**
 * useLedger — local-first ledger state with 0G as the durable backup.
 *
 * Every change writes to localStorage SYNCHRONOUSLY (the working copy,
 * never lost). 0G sync runs in the background; if it fails, the data is
 * safe locally and retryable. On boot we read the local copy instantly,
 * then reconcile with 0G in the background.
 */
export function useLedger() {
  // Seed from the local working copy if present (instant, offline-safe).
  const initial = getLocalLedger() ?? EMPTY_LEDGER;
  const ref = useRef<Ledger>(initial);
  const [ledger, setLedgerState] = useState<Ledger>(initial);
  const [hydrating, setHydrating] = useState<boolean>(
    isStorageConfigured() && Boolean(getStoredRootHash()) && !getLocalLedger(),
  );
  const [syncPhase, setSyncPhase] = useState<SyncPhase>("idle");

  /** Single choke-point: update state AND persist the local working copy. */
  const setLedger = (next: Ledger) => {
    ref.current = next;
    setLedgerState(next);
    saveLocalLedger(next);
  };

  // Reconcile with 0G in the background. The local copy is already shown;
  // we only adopt the 0G version if we had no local copy to begin with
  // (fresh device / cleared cache) so we never clobber unsynced local edits.
  useEffect(() => {
    const root = getStoredRootHash();
    const hadLocal = Boolean(getLocalLedger());
    if (!isStorageConfigured() || !root || hadLocal) {
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

  /** Replace the ledger wholesale (used when the agent mutates via tools). */
  const applyLedger = useCallback((next: Ledger) => {
    setLedger(next);
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
    applyLedger,
    initProfile,
  };
}
