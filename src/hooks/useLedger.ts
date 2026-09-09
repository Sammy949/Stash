import { useCallback, useRef, useState } from "react";
import type { Currency, Ledger } from "@/types";
import { EMPTY_LEDGER, migrateLedger } from "@/lib/ledger";
import { getLocalLedger, saveLocalLedger } from "@/lib/localLedger";

/**
 * useLedger — the ledger, held locally.
 *
 * Every change writes to localStorage synchronously, so the working copy is
 * never behind what is on screen and the UI never waits on a network call to be
 * safe.
 *
 * There is no remote sync any more. The encrypted remote backup this hook
 * used to drive could only restore a browser that still held its root hash in
 * localStorage — that is, one that had not lost anything — so it bought
 * durability it could not actually deliver. Persistence that matters now lives
 * in the memory layer: Sibyl holds who you are, what you are working toward and
 * a journal of money events, and it survives this device.
 */
export function useLedger() {
  // Migrate on read: a cached ledger written by an older build arrives in its
  // old shape, and everything downstream assumes the current one.
  const initial = migrateLedger(getLocalLedger() ?? EMPTY_LEDGER);
  const ref = useRef<Ledger>(initial);
  const [ledger, setLedgerState] = useState<Ledger>(initial);

  /** Single choke-point: update state AND persist the working copy. */
  const setLedger = (next: Ledger) => {
    ref.current = next;
    setLedgerState(next);
    saveLocalLedger(next);
  };

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

  return { ledger, applyLedger, initProfile };
}
