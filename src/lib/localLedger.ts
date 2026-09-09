import type { Ledger } from "@/types";

/**
 * The ledger's storage layer: localStorage, and only localStorage.
 *
 * This used to live beside an encrypted remote backup. That layer is gone — it needed a root hash that itself
 * lived in localStorage, so it could only ever restore a browser that had not
 * actually lost anything, which is not what a backup is for.
 *
 * So the honest shape is this: the ledger is local-first and local-only.
 * Durability across sessions belongs to the memory layer (Sibyl), which holds
 * who you are, what you are working toward and a journal of money events. The
 * numbers in front of you are yours, on this device.
 *
 * Every write is synchronous, so the UI never waits on anything to be safe.
 */
const LEDGER_CACHE_KEY = "stash_ledger_cache";

export function saveLocalLedger(ledger: Ledger): void {
  try {
    localStorage.setItem(LEDGER_CACHE_KEY, JSON.stringify(ledger));
  } catch {
    // Quota or serialisation failure. Non-fatal: the in-memory ledger is still
    // correct for this session and the next successful write repairs the copy.
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

/**
 * One-time forced reset when the storage schema changes. Bump STORAGE_SCHEMA to
 * wipe pre-existing local state so every existing user starts clean on the new
 * shape exactly once. Call BEFORE any hook reads localStorage (module load).
 *
 * Bumped to 5 when 0G was removed: older browsers hold a `stash_ledger_root`
 * key pointing at a backup nothing can read any more, and leaving dead keys
 * behind is how storage turns into archaeology.
 */
const STORAGE_SCHEMA = 5;
const SCHEMA_KEY = "stash_schema";
const STASH_KEYS = [
  LEDGER_CACHE_KEY,
  "stash_onboarded",
  // Retired: the 0G Storage root hash. Listed so it is actively cleared.
  "stash_ledger_root",
];

export function ensureStorageSchema(): void {
  try {
    const current = Number(localStorage.getItem(SCHEMA_KEY) || "0");
    if (current < STORAGE_SCHEMA) {
      for (const k of STASH_KEYS) localStorage.removeItem(k);
      localStorage.setItem(SCHEMA_KEY, String(STORAGE_SCHEMA));
    }
  } catch {
    // Private mode / no storage — nothing to reset.
  }
}
