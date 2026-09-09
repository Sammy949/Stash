import { useCallback, useEffect, useState } from "react";
import {
  connectWallet,
  connectedAddress,
  disconnectWallet,
  onAccountsChanged,
  restoreConnection,
  walletAvailable,
} from "@/lib/wallet";

/**
 * useWallet — the connected account, as React state.
 *
 * The account is IDENTITY here, never money: see lib/wallet.ts. Its one job in
 * the app is to decide whose Sibyl memory Stash reads.
 *
 * `onTenantChange` fires whenever the address changes for any reason —
 * connected, disconnected, or switched in the wallet's own UI. The caller uses
 * it to re-read memory, because the tenant moving without a re-read is the one
 * genuinely dangerous failure here: Stash would go on showing the previous
 * account's remembered habits under a new address.
 */
export function useWallet(onTenantChange?: () => void) {
  const [address, setAddress] = useState<string | null>(() =>
    connectedAddress(),
  );
  const [connecting, setConnecting] = useState(false);
  const available = walletAvailable();

  // Reconcile the remembered address with the provider's real state, silently.
  // If access was revoked in the wallet while Stash was closed, this clears it
  // rather than letting the UI claim a connection that no longer exists.
  useEffect(() => {
    let alive = true;
    void restoreConnection().then((restored) => {
      if (!alive) return;
      setAddress((prev) => {
        if (prev === restored) return prev;
        onTenantChange?.();
        return restored;
      });
    });
    return () => {
      alive = false;
    };
    // Mount only: this reconciles the stored address once, on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Account switched or revoked in the wallet UI while Stash is open.
  useEffect(
    () =>
      onAccountsChanged((next) => {
        setAddress(next);
        onTenantChange?.();
      }),
    [onTenantChange],
  );

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const next = await connectWallet();
      // null means the user dismissed the prompt — leave state untouched.
      if (next) {
        setAddress(next);
        onTenantChange?.();
      }
      return next;
    } finally {
      setConnecting(false);
    }
  }, [onTenantChange]);

  const disconnect = useCallback(() => {
    disconnectWallet();
    setAddress(null);
    onTenantChange?.();
  }, [onTenantChange]);

  return { address, connect, disconnect, connecting, available };
}
