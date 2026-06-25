import type { Ledger, SyncResult } from "@/types";

/**
 * 0G Storage integration — encrypted persistent financial memory.
 *
 * The ledger JSON is encrypted client-side with AES-256 (via the SDK's
 * native storage-layer encryption) and uploaded to 0G Storage. The
 * resulting root hash is the only thing kept locally (localStorage);
 * on the next session we download by that root hash and decrypt.
 *
 * The AES key is derived deterministically from the wallet's private
 * key, so the same wallet always — and only — decrypts its own ledger.
 * The key itself is never stored or transmitted.
 *
 * ethers and the 0G SDK (~500KB) are loaded lazily via dynamic import
 * so the dashboard paints instantly; they only arrive on the first sync.
 */

const RPC_URL = import.meta.env.VITE_OG_RPC_URL;
const INDEXER_URL = import.meta.env.VITE_OG_INDEXER_URL;
const PRIVATE_KEY = import.meta.env.VITE_OG_PRIVATE_KEY;

/** localStorage key holding the latest ledger root hash. */
export const LEDGER_ROOT_KEY = "stash_ledger_root";

/** Domain separator so the AES key is not a bare hash of the raw secret. */
const KEY_DOMAIN = "stash-ledger-v1:";

export type SyncProgress = (message: string) => void;

/**
 * True when storage sync is available. In production the serverless proxy
 * holds the key/config server-side, so the client just needs to be able to
 * reach it — always true there. On localhost (direct SDK path) the client
 * env must be present.
 */
export function isStorageConfigured(): boolean {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") return true; // proxy path
  }
  return Boolean(RPC_URL && INDEXER_URL && PRIVATE_KEY);
}

/** ───────────────── root-hash persistence ───────────────── */

export function getStoredRootHash(): string | null {
  return localStorage.getItem(LEDGER_ROOT_KEY);
}

export function setStoredRootHash(rootHash: string): void {
  localStorage.setItem(LEDGER_ROOT_KEY, rootHash);
}

/** ───────────────── local-first ledger cache ───────────────── */

/**
 * The ledger's working copy lives in localStorage and is written on EVERY
 * change (synchronous, never fails). 0G is the durable, sovereign backup
 * synced in the background — if a sync fails, nothing is lost; the local
 * copy is still here and the sync can be retried. This makes the app
 * offline-capable and trustworthy regardless of testnet flakiness.
 */
const LEDGER_CACHE_KEY = "stash_ledger_cache";

export function saveLocalLedger(ledger: Ledger): void {
  try {
    localStorage.setItem(LEDGER_CACHE_KEY, JSON.stringify(ledger));
  } catch {
    /* quota/serialize errors are non-fatal — 0G remains the backup */
  }
}

export function getLocalLedger(): Ledger | null {
  try {
    const raw = localStorage.getItem(LEDGER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Ledger) : null;
  } catch {
    return null;
  }
}

export function clearStoredRootHash(): void {
  localStorage.removeItem(LEDGER_ROOT_KEY);
}

/** ───────────────── internals ───────────────── */

function requireConfig(): {
  rpc: string;
  indexerUrl: string;
  privateKey: string;
} {
  if (!isStorageConfigured()) {
    throw new Error(
      "0G Storage is not configured — set VITE_OG_RPC_URL, " +
        "VITE_OG_INDEXER_URL and VITE_OG_PRIVATE_KEY in your .env.",
    );
  }
  return { rpc: RPC_URL, indexerUrl: INDEXER_URL, privateKey: PRIVATE_KEY };
}

/** 32-byte AES-256 key derived from the wallet private key. */
function deriveAesKey(
  ethers: typeof import("ethers").ethers,
  privateKey: string,
): Uint8Array {
  const hex = ethers.sha256(ethers.toUtf8Bytes(KEY_DOMAIN + privateKey));
  return ethers.getBytes(hex); // 32 bytes
}

/** ───────────────── save / load ───────────────── */

/** How many times to attempt the upload before giving up. */
const MAX_UPLOAD_ATTEMPTS = 3;

const delayMs = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Truly fatal errors (bad key, no gas) — no point retrying these, and we
 * surface their real message. Everything else (timeouts, unreachable
 * storage nodes) is treated as a transient network hiccup and retried.
 */
function isFatalUploadError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return /insufficient funds|invalid private key|invalid sender|nonce|gas required exceeds|intrinsic gas/.test(
    msg,
  );
}

/**
 * Route choice. The 0G testnet storage nodes are plain HTTP on bare IPs,
 * which a browser on an HTTPS page blocks as mixed content. So in any
 * non-localhost context we go through the same-origin /api/og-sync
 * serverless proxy (Node → HTTP nodes is fine). On http://localhost the
 * direct SDK path works and avoids needing the serverless runtime.
 */
function useProxy(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  return !isLocal;
}

const PROXY_URL = "/api/og-sync";

/**
 * Encrypt the ledger and upload it to 0G Storage. Returns the new root
 * hash (also persisted to localStorage) and the sync timestamp.
 *
 * In production this calls the serverless proxy; on localhost it runs the
 * SDK directly with retry/backoff.
 */
export async function saveLedger(
  ledger: Ledger,
  onProgress?: SyncProgress,
): Promise<SyncResult> {
  if (useProxy()) {
    onProgress?.("Uploading to 0G…");
    const result = await saveLedgerViaProxy(ledger);
    setStoredRootHash(result.rootHash);
    return result;
  }
  return saveLedgerDirect(ledger, onProgress);
}

/** Upload via the same-origin serverless proxy (production path). */
async function saveLedgerViaProxy(ledger: Ledger): Promise<SyncResult> {
  let res: Response;
  try {
    res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ledger }),
    });
  } catch (e) {
    throw new Error(
      "Couldn't reach the 0G sync service. Check your connection and try again.",
      { cause: e },
    );
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.rootHash) {
    throw new Error(data?.error ?? `0G sync failed (${res.status}).`);
  }
  return { rootHash: data.rootHash, syncedAt: data.syncedAt };
}

/** Upload by running the SDK directly in the browser (localhost dev path). */
async function saveLedgerDirect(
  ledger: Ledger,
  onProgress?: SyncProgress,
): Promise<SyncResult> {
  const { rpc, indexerUrl, privateKey } = requireConfig();

  const [{ ethers }, { Indexer, MemData }] = await Promise.all([
    import("ethers"),
    import("@0gfoundation/0g-storage-ts-sdk"),
  ]);

  const bytes = new TextEncoder().encode(JSON.stringify(ledger));
  const provider = new ethers.JsonRpcProvider(rpc);
  const signer = new ethers.Wallet(privateKey, provider);
  const indexer = new Indexer(indexerUrl);
  const key = deriveAesKey(ethers, privateKey);

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt++) {
    try {
      const file = new MemData(bytes);
      const [res, err] = await indexer.upload(file, rpc, signer, {
        encryption: { type: "aes256", key },
        onProgress,
      });
      if (err) throw err;
      if (!res) throw new Error("0G upload returned no result");

      const rootHash = "rootHash" in res ? res.rootHash : res.rootHashes[0];
      if (!rootHash) throw new Error("0G upload returned no root hash");

      setStoredRootHash(rootHash);
      return { rootHash, syncedAt: new Date().toISOString() };
    } catch (e) {
      lastError = e;
      if (isFatalUploadError(e) || attempt === MAX_UPLOAD_ATTEMPTS) break;
      onProgress?.(
        `Storage nodes busy — retrying (${attempt}/${MAX_UPLOAD_ATTEMPTS - 1})…`,
      );
      await delayMs(attempt * 1500);
    }
  }

  if (isFatalUploadError(lastError)) {
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
  throw new Error(
    "0G's storage nodes are busy right now. Your latest changes are still here — tap Sync to 0G again in a moment.",
  );
}

/**
 * Download a ledger from 0G Storage by root hash and decrypt it.
 * Proxy in production; direct SDK on localhost.
 */
export async function loadLedger(rootHash: string): Promise<Ledger> {
  if (useProxy()) {
    const res = await fetch(`${PROXY_URL}?root=${encodeURIComponent(rootHash)}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ledger) {
      throw new Error(data?.error ?? `0G restore failed (${res.status}).`);
    }
    return data.ledger as Ledger;
  }

  const { indexerUrl, privateKey } = requireConfig();
  const [{ ethers }, { Indexer }] = await Promise.all([
    import("ethers"),
    import("@0gfoundation/0g-storage-ts-sdk"),
  ]);

  const indexer = new Indexer(indexerUrl);
  const key = deriveAesKey(ethers, privateKey);

  const [blob, err] = await indexer.downloadToBlob(rootHash, {
    decryption: { symmetricKey: key },
  });
  if (err) throw err;
  if (!blob) throw new Error("0G download returned no data");

  const text = new TextDecoder().decode(await blob.arrayBuffer());
  return JSON.parse(text) as Ledger;
}
