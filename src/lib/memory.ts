import type { MemoryKind } from "@/types";

/**
 * The TS side of the Sibyl boundary.
 *
 * Sibyl Memory is a Python library over local SQLite, so it lives behind the
 * `sibyl-svc` sidecar. The browser never talks to that service directly: every
 * call goes through `/api/memory`, which injects the service token server-side
 * (`api/memory.ts` in prod, the Vite dev proxy locally). Nothing secret is in
 * the bundle.
 *
 * Read/write policy, and it is deliberate:
 * - READS never throw. A recall failure returns EMPTY_RECALL, so the UI renders
 *   a plain greeting instead of a blank screen or an error boundary.
 * - WRITES do throw, so the agent turn can tell the model the memory was NOT
 *   saved. A write that fails silently would have Stash claim to remember
 *   something it does not, which is worse than admitting the miss.
 */

const ENDPOINT = "/api/memory";

/** Sibyl WARM categories. Same five kinds the ledger already modelled. */
export type MemoryCategory = MemoryKind;

export interface MemoryEntity {
  id: string;
  category: MemoryCategory;
  name: string;
  status: string | null;
  body: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MemoryEvent {
  id: string;
  ts: string;
  evaluated: unknown;
  acted: unknown;
  forward: unknown;
  extra: unknown;
}

export interface MemorySnapshot {
  body: Record<string, unknown>;
  updated_at: string;
}

/** Everything the cold-start opener needs, in one round-trip. */
export interface RecallPack {
  tenant: string;
  identity: MemoryEntity | null;
  goals: MemoryEntity[];
  habits: MemoryEntity[];
  preferences: MemoryEntity[];
  opportunities: MemoryEntity[];
  snapshot: MemorySnapshot | null;
  recent_events: MemoryEvent[];
  counts: Record<string, number>;
  /** False when this tenant has nothing stored: greet plainly, recall nothing. */
  remembers: boolean;
}

/**
 * The shape a failed or absent recall resolves to. Identical to what the
 * sidecar returns for an unknown tenant, so the "memory is gone" path and the
 * "memory is unreachable" path render the same way instead of branching.
 */
export const EMPTY_RECALL: RecallPack = {
  tenant: "",
  identity: null,
  goals: [],
  habits: [],
  preferences: [],
  opportunities: [],
  snapshot: null,
  recent_events: [],
  counts: {},
  remembers: false,
};

export class MemoryWriteError extends Error {}

const TENANT_RE = /^0x[0-9a-f]{40}$/;

/**
 * Which wallet's memory we are reading. Until wallet-connect lands (D4) this
 * is a single configured address, so the whole app shares one tenant; after it,
 * this returns the connected account and each user gets their own memory.
 */
export function resolveTenant(): string | null {
  const raw = (import.meta.env.VITE_MEMORY_TENANT || "").trim().toLowerCase();
  return TENANT_RE.test(raw) ? raw : null;
}

export function isMemoryConfigured(): boolean {
  return resolveTenant() !== null;
}

async function request(
  path: string,
  tenant: string,
  init: RequestInit & { query?: Record<string, string> } = {},
): Promise<unknown> {
  const params = new URLSearchParams({ path, ...(init.query ?? {}) });
  const res = await fetch(`${ENDPOINT}?${params}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Stash-Tenant": tenant,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new MemoryWriteError(`memory ${path} failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  return res.json();
}

/** Read the whole recall pack. Never throws: failure reads as "remembers nothing". */
export async function fetchRecallPack(
  tenant: string,
  signal?: AbortSignal,
): Promise<RecallPack> {
  try {
    const pack = (await request("recall-pack", tenant, { signal })) as RecallPack;
    return pack && typeof pack === "object" ? pack : EMPTY_RECALL;
  } catch {
    return EMPTY_RECALL;
  }
}

/**
 * Write (or consolidate) one memory. `name` is the stable subject slug: writing
 * the same (category, name) again UPDATES that row rather than forking a second
 * memory, which is Sibyl's UNIQUE(tenant, category, name) doing the work.
 */
export async function writeMemory(
  tenant: string,
  category: MemoryCategory,
  name: string,
  body: Record<string, unknown>,
): Promise<MemoryEntity> {
  return (await request("entity", tenant, {
    method: "POST",
    body: JSON.stringify({ category, name, body }),
  })) as MemoryEntity;
}

/** Retire a memory. Archive, not delete, so it stays recoverable. */
export async function archiveMemory(
  tenant: string,
  category: MemoryCategory,
  name: string,
  reason?: string,
): Promise<void> {
  await request("archive", tenant, {
    method: "POST",
    body: JSON.stringify({ category, name, reason: reason ?? null }),
  });
}

/** Journal a money event to the COLD tier: the durable temporal history. */
export async function writeMoneyEvent(
  tenant: string,
  event: { evaluated: unknown; acted: unknown; forward: unknown },
): Promise<void> {
  await request("event", tenant, { method: "POST", body: JSON.stringify(event) });
}

/** Refresh the HOT financial snapshot the opener greets the user with. */
export async function writeSnapshot(
  tenant: string,
  body: Record<string, unknown>,
): Promise<void> {
  await request("state", tenant, { method: "POST", body: JSON.stringify({ body }) });
}
