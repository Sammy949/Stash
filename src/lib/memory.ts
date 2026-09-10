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
  /** First identity entity, for the opener's convenience. */
  identity: MemoryEntity | null;
  /** ALL identity entities, so recall never silently drops the 2nd one. */
  identities: MemoryEntity[];
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
  identities: [],
  goals: [],
  habits: [],
  preferences: [],
  opportunities: [],
  snapshot: null,
  recent_events: [],
  counts: {},
  remembers: false,
};

/**
 * The outcome of a recall read, so the caller can tell "this tenant has nothing
 * stored" apart from "the service did not answer".
 *
 * Both used to collapse into EMPTY_RECALL, which was fine when the sidecar was
 * always-on and wrong now that it is not. A free host spins the service down
 * after ~15 minutes idle and takes ~50s to boot, and during that window a
 * swallowed failure made Stash render EXACTLY the deletion-test greeting: it
 * claimed to remember nothing about someone it remembers fine. `reachable`
 * exists so the UI can say "reconnecting" instead of lying.
 */
export interface RecallResult {
  pack: RecallPack;
  /** False only when the service was asked and did not answer. */
  reachable: boolean;
}

export class MemoryWriteError extends Error {}

/**
 * A failed request, carrying the HTTP status so a caller can tell a permanent
 * client error from a service that is merely booting. Extends MemoryWriteError
 * so existing write-failure handling is unchanged.
 *
 * `status` is 0 when the request never got a response at all (DNS, offline,
 * connection refused — which is what a spun-down host looks like from here).
 */
export class MemoryRequestError extends MemoryWriteError {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Abortable delay. Resolves early on abort; the caller re-checks the signal. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * One pending Sibyl write, produced by a tool call and executed by the agent
 * turn. Tool handlers stay pure by RETURNING these instead of performing the
 * network write themselves (the reducers must never do I/O).
 */
export type MemoryOp =
  | {
      op: "write";
      category: MemoryCategory;
      /** Stable subject slug: re-writing the same one consolidates that row. */
      name: string;
      body: Record<string, unknown>;
    }
  | { op: "archive"; category: MemoryCategory; name: string; reason?: string }
  | { op: "journal"; entry: GoalJournalEntry };

/**
 * The WHY behind one goal history entry, written to Sibyl's COLD journal.
 *
 * The ledger already holds what happened and when, deterministically. This
 * holds the one thing code cannot know — the reason, in the user's own words,
 * captured by the model at the moment they said it. Keeping the note HERE and
 * nowhere else is deliberate: the goal detail view renders its numbers from the
 * ledger whatever happens, and switching memory off (`?nomemory`) or wiping the
 * service visibly strips the voice from the history while every figure stands.
 * That is the demonstration, made concrete on a surface you can point at.
 *
 * `goalEventId` is the join key back onto the ledger's `GoalEvent.id`.
 */
export interface GoalJournalEntry {
  goalId: string;
  goalEventId: string;
  goalName: string;
  kind: string;
  /** The reason, in the user's words. Short. */
  note: string;
  /** Signed money delta, when the entry is a contribution. */
  amount?: number;
  /** ISO timestamp — the ledger event's own, so the two records agree. */
  at: string;
}

/**
 * The seam the agent and the views read memory through. Ref-backed by useMemory,
 * so a stable object can be handed to useAgent once instead of threading the
 * recall pack through every call signature.
 */
export interface MemoryPort {
  /** The latest recall pack. Always safe to render; never null. */
  read(): RecallPack;
  /** Re-fetch after a write so the next prompt sees what was just learned. */
  refresh(): Promise<void>;
}

/**
 * One human-readable line for a memory entity. Prefers `body.content` (what the
 * `remember` tool writes) and falls back to the body's fields, then the subject
 * slug, so a structured entity written by onboarding still renders as prose
 * instead of vanishing from the prompt.
 */
export function memoryLine(entity: MemoryEntity): string {
  const body = entity.body ?? {};
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (content) return content;
  const pairs = Object.entries(body)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  return pairs.length > 0 ? pairs.join(", ") : entity.name.replace(/-/g, " ");
}

/** Slugify a model-supplied subject into a stable entity name. */
export function memorySubject(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}


const TENANT_RE = /^0x[0-9a-f]{40}$/;

/**
 * Whose memory we are reading.
 *
 * One configured tenant, `VITE_MEMORY_TENANT`. It is address-shaped for
 * historical reasons — Sibyl only needs a stable opaque key — and there is no
 * wallet-connect to override it: an injected account bought identity for a
 * chain feature this app no longer has, so it was removed rather than left on
 * screen as a control that does nothing.
 *
 * `?nomemory` is the source of truth: no tenant means no reads, no writes, and
 * every recall resolves to EMPTY_RECALL — the app keeps working and Stash meets
 * a stranger. Removing the parameter therefore restores memory on the next
 * navigation or reload without a stale session flag.
 *
 * Synchronous on purpose: this is called during render and from non-async code,
 * so an await here would fire the first memory read against no tenant at all.
 */
export function resolveTenant(): string | null {
  if (memoryDisabled()) return null;
  const raw = (import.meta.env.VITE_MEMORY_TENANT || "").trim().toLowerCase();
  return TENANT_RE.test(raw) ? raw : null;
}

/**
 * True when the memory layer has been switched off for this session.
 *
 * Read from the URL rather than a build flag so the same deployed bundle can
 * demonstrate both halves: `?nomemory` on the live link, no rebuild, nothing to
 * take anyone's word for. Persisted for the tab so a reload inside the test
 * stays in the test.
 */
export function memoryDisabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("nomemory");
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
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?${params}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Stash-Tenant": tenant,
        ...(init.headers ?? {}),
      },
    });
  } catch (e) {
    // No response at all: offline, DNS, refused — or a host that has spun the
    // sidecar down. Status 0 marks it as retryable.
    throw new MemoryRequestError(
      `memory ${path} unreachable: ${e instanceof Error ? e.message : String(e)}`,
      0,
    );
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new MemoryRequestError(
      `memory ${path} failed (${res.status}): ${detail.slice(0, 200)}`,
      res.status,
    );
  }
  return res.json();
}

/**
 * How long to keep trying the cold-start read before settling for "unreachable".
 *
 * A free host spins the sidecar down after idle and takes ~50s to boot, so a
 * single attempt would fail on exactly the first visit of the day — the one a
 * judge makes. These retries ride that boot out. They cost nothing when the
 * service is already awake (the first attempt succeeds), and the UI stays fully
 * rendered throughout, so this only ever delays the greeting getting warmer.
 */
const RECALL_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000];

/**
 * Read the whole recall pack. Never throws.
 *
 * Returns `reachable: false` when the service did not answer, so a cold start is
 * distinguishable from an empty tenant. `pack` is ALWAYS a renderable
 * RecallPack, so every existing caller stays correct whether or not it looks at
 * `reachable`: content is never gated on this resolving.
 *
 * Retries while the service is unreachable, because "asleep" and "gone" look
 * identical on the first attempt and only one of them is worth reporting. A 4xx
 * is NOT retried: a rejected tenant or a misconfigured proxy will not fix itself.
 */
export async function fetchRecall(
  tenant: string,
  signal?: AbortSignal,
): Promise<RecallResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      const pack = (await request("recall-pack", tenant, { signal })) as RecallPack;
      if (pack && typeof pack === "object") return { pack, reachable: true };
      // A 200 carrying a non-object is a broken service, not an empty tenant.
      return { pack: EMPTY_RECALL, reachable: false };
    } catch (e) {
      if (signal?.aborted) return { pack: EMPTY_RECALL, reachable: false };
      // Client errors are permanent; only a transport failure or a 5xx (which is
      // what a booting or crashed service returns) is worth waiting on.
      if (e instanceof MemoryRequestError && e.status >= 400 && e.status < 500) {
        return { pack: EMPTY_RECALL, reachable: false };
      }
      const delay = RECALL_RETRY_DELAYS_MS[attempt];
      if (delay === undefined) return { pack: EMPTY_RECALL, reachable: false };
      await sleep(delay, signal);
    }
  }
}

/** Back-compat: the pack alone, for callers that do not care why it is empty. */
export async function fetchRecallPack(
  tenant: string,
  signal?: AbortSignal,
): Promise<RecallPack> {
  return (await fetchRecall(tenant, signal)).pack;
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
  event: {
    evaluated: unknown;
    acted: unknown;
    forward: unknown;
    /** Structured tags the reader filters on. Not interpreted by Sibyl. */
    extra?: unknown;
    /** Override the journal timestamp so it matches the ledger row exactly. */
    ts?: string;
  },
): Promise<void> {
  await request("event", tenant, { method: "POST", body: JSON.stringify(event) });
}

/**
 * Journal the reason behind one goal history entry.
 *
 * `extra` carries the join keys, which is what makes these events findable
 * later: the COLD journal is a flat chronological log with no query language of
 * its own, so the reader pulls a page and matches on `extra.goalEventId`.
 */
export async function journalGoalEvent(
  tenant: string,
  entry: GoalJournalEntry,
): Promise<void> {
  await writeMoneyEvent(tenant, {
    evaluated: { goal: entry.goalName, kind: entry.kind },
    acted: { note: entry.note, amount: entry.amount ?? null },
    forward: null,
    extra: {
      goalId: entry.goalId,
      goalEventId: entry.goalEventId,
      kind: entry.kind,
    },
    ts: entry.at,
  });
}

/**
 * Every remembered note for one goal, keyed by the ledger event it belongs to.
 *
 * Never throws, for the same reason recall doesn't: the detail view's numbers
 * come from the ledger and must render regardless. An unreachable sidecar, a
 * disabled memory session, or a tenant with nothing stored all resolve to an
 * empty map, and the timeline simply shows the facts without the voice.
 */
export async function fetchGoalNotes(
  goalId: string,
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  const notes = new Map<string, string>();
  const tenant = resolveTenant();
  if (!tenant) return notes;
  try {
    const res = (await request("events", tenant, {
      signal,
      query: { limit: "200" },
    })) as { events?: MemoryEvent[] };
    for (const ev of res?.events ?? []) {
      const extra = (ev.extra ?? {}) as Record<string, unknown>;
      if (extra.goalId !== goalId) continue;
      const eventId = typeof extra.goalEventId === "string" ? extra.goalEventId : "";
      const acted = (ev.acted ?? {}) as Record<string, unknown>;
      const note = typeof acted.note === "string" ? acted.note.trim() : "";
      if (eventId && note) notes.set(eventId, note);
    }
  } catch {
    // Memory being down must never break the history. Facts only, then.
  }
  return notes;
}

/** Refresh the HOT financial snapshot the opener greets the user with. */
export async function writeSnapshot(
  tenant: string,
  body: Record<string, unknown>,
): Promise<void> {
  await request("state", tenant, { method: "POST", body: JSON.stringify({ body }) });
}

export interface MemoryOpOutcome {
  applied: number;
  /** Ops that did NOT land. The turn tells the model, so it can't claim to remember. */
  failures: { op: MemoryOp; message: string }[];
}

/**
 * Execute the writes a turn's tool calls asked for. Sequential on purpose: one
 * SQLite writer, and order matters when a turn both writes and archives the same
 * subject. Failures are collected rather than thrown so one bad write can't lose
 * the rest of the turn.
 */
export async function applyMemoryOps(
  tenant: string,
  ops: MemoryOp[],
): Promise<MemoryOpOutcome> {
  let applied = 0;
  const failures: MemoryOpOutcome["failures"] = [];
  for (const op of ops) {
    try {
      if (op.op === "write") {
        await writeMemory(tenant, op.category, op.name, op.body);
      } else if (op.op === "journal") {
        await journalGoalEvent(tenant, op.entry);
      } else {
        await archiveMemory(tenant, op.category, op.name, op.reason);
      }
      applied += 1;
    } catch (e) {
      failures.push({ op, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return { applied, failures };
}

/**
 * Seed memory from first-run onboarding.
 *
 * Why this exists: onboarding used to write nothing, so a brand-new user's very
 * first session had nothing to recall and the cold-start opener had to fall back
 * to a generic greeting. These are the facts the user just volunteered, so
 * storing them needs no inference and cannot be wrong.
 *
 * Subject slugs are stable and deliberately generic ("owner", "income-shape"),
 * so re-running onboarding CONSOLIDATES those rows rather than forking a second
 * copy: Sibyl's UNIQUE(tenant, category, name) does the work.
 *
 * Never throws and never blocks: `applyMemoryOps` collects failures, and an
 * unreachable sidecar just means memory stays empty, exactly as `?nomemory`
 * simulates. Entering the app must not depend on it.
 */
export async function rememberOnboarding(profile: {
  owner: string;
  currency: string;
  incomeMemory: string | null;
  goal: { name: string; targetAmount: number } | null;
}): Promise<MemoryOpOutcome> {
  const tenant = resolveTenant();
  if (!tenant) return { applied: 0, failures: [] };

  const ops: MemoryOp[] = [
    {
      op: "write",
      category: "identity",
      name: "owner",
      body: {
        content: `Goes by ${profile.owner}. Tracks money in ${profile.currency}.`,
        name: profile.owner,
        currency: profile.currency,
      },
    },
  ];

  if (profile.incomeMemory) {
    ops.push({
      op: "write",
      category: "habit",
      name: "income-shape",
      body: { content: profile.incomeMemory },
    });
  }

  if (profile.goal) {
    ops.push({
      op: "write",
      category: "goal",
      name: memorySubject(profile.goal.name),
      body: {
        content: `Saving for ${profile.goal.name} (target ${profile.goal.targetAmount} ${profile.currency})`,
        target: profile.goal.targetAmount,
        currency: profile.currency,
      },
    });
  }

  return applyMemoryOps(tenant, ops);
}

