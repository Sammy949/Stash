/**
 * Wallet connect — IDENTITY, not money.
 *
 * Read this before assuming what it does, because the word "wallet" is
 * misleading here and the honesty matters:
 *
 * Stash's balance is a personal-finance ledger in fiat (₦, GHS, KES…), derived
 * from transactions the user tells Stash about. It is NOT a token balance and a
 * connected account can never fund it. This module reads no balance, signs no
 * transaction and submits nothing on-chain. The only chain-signing code in the
 * project is server-side (`api/og-sync.ts`), where the app's OWN throwaway key
 * signs encrypted ledger backups to 0G — that is the app's key, not the user's.
 *
 * What connecting actually buys: an address to file memory under. `memory.ts`
 * has always resolved a tenant, and both it and `.env.example` said the same
 * thing — "a stand-in until wallet-connect lands, after which the connected
 * account supplies it". Until now that stand-in was ONE hardcoded address, so
 * every visitor to the deployed app shared a single memory. Connecting makes
 * memory genuinely per-person.
 *
 * Deliberately raw EIP-1193 rather than ethers: `ethers` is a ~260KB dependency
 * that ogStorage.ts loads with a dynamic import precisely to keep it out of the
 * initial bundle. Pulling it in eagerly for `eth_requestAccounts` — one string
 * over a JSON-RPC pipe — would undo that for no gain, and needs no new package.
 */

/** Where the connected address is remembered across reloads. */
const ADDRESS_KEY = "stash_wallet_address";

/** The address shape memory.ts validates tenants against. */
const ADDRESS_RE = /^0x[0-9a-f]{40}$/;

/** The slice of EIP-1193 this app uses. */
type Eip1193 = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: never[]) => void): void;
  removeListener?(event: string, handler: (...args: never[]) => void): void;
};

function provider(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  const injected = (window as { ethereum?: Eip1193 }).ethereum;
  return injected && typeof injected.request === "function" ? injected : null;
}

/** True when there is an injected wallet to talk to at all. */
export function walletAvailable(): boolean {
  return provider() !== null;
}

/** Normalise whatever the provider hands back into a tenant-shaped address. */
function normalize(value: unknown): string | null {
  const raw = String(value ?? "").trim().toLowerCase();
  return ADDRESS_RE.test(raw) ? raw : null;
}

function firstAddress(accounts: unknown): string | null {
  return Array.isArray(accounts) && accounts.length > 0
    ? normalize(accounts[0])
    : null;
}

/**
 * The connected address, or null.
 *
 * Read from localStorage rather than the provider because it has to be
 * SYNCHRONOUS: `resolveTenant()` is called during render and from non-async
 * code, and an await there would mean the first memory read fires against the
 * wrong tenant. `restoreConnection()` reconciles this with the provider's real
 * state on load.
 */
export function connectedAddress(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return normalize(localStorage.getItem(ADDRESS_KEY));
  } catch {
    // Private mode / blocked storage: degrade to "not connected" rather than
    // taking the app down. Memory falls back to the configured tenant.
    return null;
  }
}

function remember(address: string | null): void {
  try {
    if (address) localStorage.setItem(ADDRESS_KEY, address);
    else localStorage.removeItem(ADDRESS_KEY);
  } catch {
    // Non-fatal: the session still works, it just won't survive a reload.
  }
}

/**
 * Prompt to connect. Returns the address, or null if the user dismissed it.
 *
 * Throws only on a genuine provider error, so a caller can tell "changed their
 * mind" (null) apart from "something is broken" (throw) and say the right thing.
 */
export async function connectWallet(): Promise<string | null> {
  const eth = provider();
  if (!eth) throw new Error("No wallet extension found in this browser.");
  let accounts: unknown;
  try {
    accounts = await eth.request({ method: "eth_requestAccounts" });
  } catch (e) {
    // 4001 is the EIP-1193 "user rejected request" code. A refusal is a normal
    // outcome, not a failure to report as one.
    const code = (e as { code?: number }).code;
    if (code === 4001) return null;
    throw e;
  }
  const address = firstAddress(accounts);
  remember(address);
  return address;
}

/**
 * Re-establish a previous connection WITHOUT prompting.
 *
 * `eth_accounts` is the silent counterpart to `eth_requestAccounts`: it returns
 * the already-authorised accounts and shows no dialog. This is what keeps a
 * connection across a reload honest — if the user revoked access in their
 * wallet, this returns nothing and the stored address is cleared, instead of
 * Stash claiming a connection it no longer has.
 */
export async function restoreConnection(): Promise<string | null> {
  const eth = provider();
  if (!eth) return null;
  if (!connectedAddress()) return null;
  try {
    const address = firstAddress(await eth.request({ method: "eth_accounts" }));
    remember(address);
    return address;
  } catch {
    return null;
  }
}

/** Forget the account. Local only — a dapp cannot revoke its own permission. */
export function disconnectWallet(): void {
  remember(null);
}

/**
 * Subscribe to the account changing under us (switched account, or revoked in
 * the wallet UI). Returns an unsubscribe. Without this, switching accounts in
 * MetaMask would leave Stash reading the previous person's memory.
 */
export function onAccountsChanged(
  handler: (address: string | null) => void,
): () => void {
  const eth = provider();
  if (!eth?.on || !eth.removeListener) return () => {};
  const listener = (...args: never[]) => {
    const address = firstAddress(args[0]);
    remember(address);
    handler(address);
  };
  eth.on("accountsChanged", listener);
  return () => eth.removeListener?.("accountsChanged", listener);
}

/** `0x1234…abcd` — for display only. */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
