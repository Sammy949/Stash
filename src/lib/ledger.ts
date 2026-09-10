import type {
  Goal,
  GoalEvent,
  GoalEventKind,
  Hustle,
  Ledger,
  ParsedTransaction,
  Scholarship,
  Transaction,
  UrgencyColor,
} from "@/types";
import { formatMoney } from "@/lib/currency";

/**
 * Ledger state management — seed data + pure helpers.
 *
 * Money in/out (transactions) are the source of truth; the spendable
 * balance is always DERIVED (never stored): see `balance()`.
 */

/**
 * A brand-new user's ledger — the empty-first starting point. Onboarding
 * fills in owner/currency/openingBalance; everything else grows from the
 * user's own entries. No hardcoded demo data anywhere.
 */
export const EMPTY_LEDGER: Ledger = {
  version: 6,
  owner: "",
  currency: "NGN",
  openingBalance: 0,
  monthlyBudget: null,
  transactions: [],
  scholarships: [],
  hustles: [],
  goals: [],
};

/** ───────────────── Formatting ───────────────── */

/** ───────────────── Balance math (derived) ───────────────── */

export function totalIncome(ledger: Ledger): number {
  return ledger.transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
}

export function totalExpenses(ledger: Ledger): number {
  return ledger.transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
}

/** Spendable balance = opening + income − expenses. Never stored. */
export function balance(ledger: Ledger): number {
  return ledger.openingBalance + totalIncome(ledger) - totalExpenses(ledger);
}

/**
 * Percentage for the Vault ring, 0–100. Against the monthly budget cap if
 * one is set, otherwise against total inflow (opening + income).
 */
export function outflowPct(ledger: Ledger): number {
  const spent = totalExpenses(ledger);
  const denom =
    ledger.monthlyBudget && ledger.monthlyBudget > 0
      ? ledger.monthlyBudget
      : ledger.openingBalance + totalIncome(ledger);
  if (denom <= 0) return 0;
  return Math.min(100, Math.max(0, (spent / denom) * 100));
}

/** ───────────────── Balance over time ───────────────── */

export interface BalancePoint {
  /** Start of the day, ms since epoch. */
  t: number;
  /** Spendable balance at the END of that day. */
  balance: number;
}

const DAY_MS = 86_400_000;

/**
 * Running balance over the last `days` days, oldest first. It includes one
 * anchor per day and preserves individual transaction points, so several
 * entries made on the same day still produce visible movement.
 *
 * Walks transactions forward in `createdAt` order, exactly the way `balance()`
 * derives the figure, so the series and the headline number can never disagree.
 * Two invariants the instrument depends on:
 *
 *  - The LAST point always equals `balance(ledger)`. Transactions dated in the
 *    future are still counted (the reducers allow them), so they land in the
 *    final bucket rather than being silently dropped from the total.
 *  - Days with no activity carry the previous day's balance forward, so the
 *    trace is continuous and the x-axis is real time, not transaction index.
 *
 * Pure and deterministic: `now` is injectable for tests. Code owns this maths,
 * per the load-bearing invariant — the model is never asked for it.
 */
export function balanceSeries(
  ledger: Ledger,
  days = 30,
  now: Date = new Date(),
): BalancePoint[] {
  const span = Math.max(1, Math.floor(days));
  // Local midnight today, so "day" means the user's day, not UTC's.
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const firstDay = today.getTime() - (span - 1) * DAY_MS;

  // Opening balance plus everything that happened BEFORE the window: that is
  // where the trace starts, otherwise the first point would ignore all history.
  // Sort chronologically before the walk. The line is a time series, and the app
  // can accumulate transactions in arbitrary insertion order; a ledger that was
  // edited or restored is still expected to draw forward in date order.
  let running = ledger.openingBalance;
  const inWindow: { day: number; timestamp: number; delta: number }[] = [];
  const ordered = [...ledger.transactions].sort((a, b) => {
    const ta = Date.parse(a.createdAt);
    const tb = Date.parse(b.createdAt);
    if (!Number.isFinite(ta) && !Number.isFinite(tb)) return 0;
    if (!Number.isFinite(ta)) return 1;
    if (!Number.isFinite(tb)) return -1;
    return ta - tb;
  });

  for (const t of ordered) {
    const delta = t.type === "income" ? t.amount : -t.amount;
    const ts = new Date(t.createdAt).getTime();
    // A malformed date must not poison the series; treat it as pre-window so it
    // still counts toward the total (keeping the last-point invariant true).
    if (!Number.isFinite(ts) || ts < firstDay) {
      running += delta;
      continue;
    }
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    // Future-dated entries collapse into today, so they cannot fall off the end.
    inWindow.push({
      day: Math.min(d.getTime(), today.getTime()),
      timestamp: Math.min(ts, now.getTime()),
      delta,
    });
  }

  const byDay = new Map<number, typeof inWindow>();
  for (const entry of inWindow) {
    const entries = byDay.get(entry.day) ?? [];
    entries.push(entry);
    byDay.set(entry.day, entries);
  }

  const points: BalancePoint[] = [];
  for (let i = 0; i < span; i++) {
    const t = firstDay + i * DAY_MS;
    points.push({ t, balance: running });

    for (const { timestamp, delta } of byDay.get(t) ?? []) {
      running += delta;
      points.push({ t: timestamp, balance: running });
    }
  }
  return points;
}

/**
 * "Decision context" — the facts a wise friend would notice, computed in
 * code (the accountant) so the agent never has to do arithmetic. Fields are
 * omitted when not meaningful (e.g. runway with too little history), so we
 * never hand the model a garbage number it would faithfully repeat.
 */
export interface DecisionContext {
  balance: number;
  /** Whole days of money left at the current average spend pace, if known. */
  runwayDays: number | null;
  /** Whether the balance is now below zero. */
  inTheRed: boolean;
  /** Average spend per active day, if there's enough history. */
  avgDailySpend: number | null;
}

/**
 * How far back the spend-pace window looks. Anything older is ignored, so
 * stale or migration-injected expenses (e.g. the v1→v2 legacy "Previous
 * spending" dated 2026-01-01) can't stretch the span and produce an absurd
 * runway like "900 days left". A rolling window also keeps the pace honest:
 * it reflects how the user spends *now*, not months ago.
 */
const RUNWAY_WINDOW_DAYS = 30;

export function decisionContext(
  ledger: Ledger,
  now: Date = new Date(),
): DecisionContext {
  const bal = balance(ledger);
  const windowStart = now.getTime() - RUNWAY_WINDOW_DAYS * 86_400_000;
  // Only recent expenses set the pace; older/legacy entries are excluded so
  // they can't poison the span (and therefore the runway) below.
  const recent = ledger.transactions.filter(
    (t) => t.type === "expense" && new Date(t.createdAt).getTime() >= windowStart,
  );

  // Average daily spend needs a real span and a couple of data points to
  // mean anything — otherwise runway is noise (e.g. "0.5 days" on day one).
  let avgDailySpend: number | null = null;
  let runwayDays: number | null = null;
  if (recent.length >= 3) {
    const times = recent.map((t) => new Date(t.createdAt).getTime());
    const firstTs = Math.min(...times);
    const spanDays = Math.max(1, (now.getTime() - firstTs) / 86_400_000);
    const recentSpend = recent.reduce((sum, t) => sum + t.amount, 0);
    avgDailySpend = recentSpend / spanDays;
    if (avgDailySpend > 0 && bal > 0) {
      runwayDays = Math.floor(bal / avgDailySpend);
    }
  }

  return { balance: bal, runwayDays, inTheRed: bal < 0, avgDailySpend };
}

/** ───────────────── Scholarship urgency ───────────────── */

/** Whole days from `now` until an ISO date (negative = past). */
export function daysUntil(isoDate: string, now: Date = new Date()): number {
  const MS_PER_DAY = 86_400_000;
  const target = new Date(isoDate).setHours(0, 0, 0, 0);
  const today = new Date(now).setHours(0, 0, 0, 0);
  return Math.round((target - today) / MS_PER_DAY);
}

/**
 * Urgency band for the radar. Deadline-bearing entries are derived
 * dynamically (red <7d, amber <30d, else emerald); status-only entries
 * fall back to their stored color.
 */
export function deriveUrgency(s: Scholarship, now: Date = new Date()): UrgencyColor {
  if (s.deadline) {
    const d = daysUntil(s.deadline, now);
    if (d < 7) return "red";
    if (d < 30) return "amber";
    return "emerald";
  }
  return s.color;
}

/** Short countdown/status text for a scholarship's right-side badge. */
export function radarBadge(s: Scholarship, now: Date = new Date()): string {
  if (s.deadline) {
    const d = daysUntil(s.deadline, now);
    if (d < 0) return "Closed";
    if (d === 0) return "Due today";
    return `${d} ${d === 1 ? "day" : "days"}`;
  }
  return s.statusLabel;
}

/** ───────────────── Hustle totals ───────────────── */

/** Sum of recurring monthly income from currently-active streams. */
export function totalActiveIncome(hustles: Hustle[]): number {
  return hustles
    .filter((h) => h.status === "active")
    .reduce((sum, h) => sum + h.monthlyValue, 0);
}

/** ───────────────── Mutations (pure) ───────────────── */

/** Window in which an identical transaction is treated as a duplicate. */
const DEDUPE_WINDOW_MS = 90_000;

/**
 * True if an identical transaction (same type + amount + label) was logged
 * within the dedupe window. This flags a *candidate* duplicate — the caller
 * doesn't drop it silently (a genuine repeat purchase, e.g. two ₦100 bus
 * trips, is real); instead it asks the user to confirm a second log. Match
 * stays EXACT on purpose: fuzzier matching would swallow real repeats.
 */
export function isDuplicateTransaction(
  ledger: Ledger,
  parsed: ParsedTransaction,
  now: number = Date.now(),
): boolean {
  const label = parsed.label.trim().toLowerCase();
  return ledger.transactions.some(
    (t) =>
      t.type === parsed.type &&
      t.amount === parsed.amount &&
      t.label.trim().toLowerCase() === label &&
      now - new Date(t.createdAt).getTime() < DEDUPE_WINDOW_MS,
  );
}

/** Append a transaction. Balance recomputes automatically (it's derived). */
export function addTransaction(ledger: Ledger, parsed: ParsedTransaction): Ledger {
  const tx: Transaction = {
    id: crypto.randomUUID(),
    type: parsed.type,
    amount: parsed.amount,
    label: parsed.label,
    category: parsed.category,
    tag: parsed.tag,
    createdAt: new Date().toISOString(),
  };
  return { ...ledger, transactions: [...ledger.transactions, tx] };
}

/** Remove a transaction by id (for corrections / agent actions). */
export function removeTransaction(ledger: Ledger, id: string): Ledger {
  return {
    ...ledger,
    transactions: ledger.transactions.filter((t) => t.id !== id),
  };
}

/**
 * Edit a transaction's amount and/or label by id (manual corrections from the
 * dashboard list). Invalid patches are ignored field-by-field, so a blank
 * label or non-positive amount leaves the original value untouched — balance
 * recomputes automatically since it's derived.
 */
export function editTransaction(
  ledger: Ledger,
  id: string,
  patch: { amount?: number; label?: string },
): Ledger {
  return {
    ...ledger,
    transactions: ledger.transactions.map((t) => {
      if (t.id !== id) return t;
      const amount =
        patch.amount !== undefined &&
        Number.isFinite(patch.amount) &&
        patch.amount > 0
          ? Math.round(patch.amount)
          : t.amount;
      const label =
        patch.label !== undefined && patch.label.trim()
          ? patch.label.trim()
          : t.label;
      return { ...t, amount, label };
    }),
  };
}

/** Remove the most recently logged transaction (agent "undo that"). */
export function removeLastTransaction(ledger: Ledger): Ledger {
  if (ledger.transactions.length === 0) return ledger;
  return { ...ledger, transactions: ledger.transactions.slice(0, -1) };
}

/** Set (or clear) the optional monthly budget cap. */
export function setMonthlyBudget(ledger: Ledger, amount: number | null): Ledger {
  return {
    ...ledger,
    monthlyBudget: amount && amount > 0 ? Math.round(amount) : null,
  };
}

/** Normalize a date string to YYYY-MM-DD, or null if unparseable. */
function normalizeDate(input?: string | null): string | null {
  if (!input) return null;
  const t = Date.parse(input);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/** Add a scholarship to the radar (agent action). */
export function addScholarship(
  ledger: Ledger,
  input: { name: string; deadline?: string | null },
): Ledger {
  const deadline = normalizeDate(input.deadline);
  const s: Scholarship = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    status: deadline ? "deadline" : "pending_confirmation",
    statusLabel: deadline ? "Deadline" : "Tracking",
    deadline: deadline ?? undefined,
    color: deadline ? "amber" : "muted",
  };
  return { ...ledger, scholarships: [...ledger.scholarships, s] };
}

/** Add an income stream / hustle (agent action). */
export function addHustle(
  ledger: Ledger,
  input: { name: string; amount?: number; recurring?: boolean },
): Ledger {
  const amount = input.amount && input.amount > 0 ? Math.round(input.amount) : 0;
  const recurring = Boolean(input.recurring);
  const h: Hustle = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    amountLabel: amount
      ? `${formatMoney(amount, ledger.currency)}${recurring ? "/mo" : ""}`
      : "—",
    monthlyValue: recurring ? amount : 0,
    status: recurring ? "active" : amount ? "received" : "building",
    tag: "Other",
  };
  return { ...ledger, hustles: [...ledger.hustles, h] };
}

/** Remove the first scholarship/hustle whose name matches (case-insensitive). */
export function removeScholarshipByName(ledger: Ledger, name: string): Ledger {
  const q = name.trim().toLowerCase();
  const idx = ledger.scholarships.findIndex((s) =>
    s.name.toLowerCase().includes(q),
  );
  if (idx < 0) return ledger;
  return {
    ...ledger,
    scholarships: ledger.scholarships.filter((_, i) => i !== idx),
  };
}

export function removeHustleByName(ledger: Ledger, name: string): Ledger {
  const q = name.trim().toLowerCase();
  const idx = ledger.hustles.findIndex((h) => h.name.toLowerCase().includes(q));
  if (idx < 0) return ledger;
  return { ...ledger, hustles: ledger.hustles.filter((_, i) => i !== idx) };
}

/** Remove a scholarship by id (precise delete from the Manage sheet). */
export function removeScholarship(ledger: Ledger, id: string): Ledger {
  return {
    ...ledger,
    scholarships: ledger.scholarships.filter((s) => s.id !== id),
  };
}

/** Remove a hustle by id (precise delete from the Manage sheet). */
export function removeHustle(ledger: Ledger, id: string): Ledger {
  return { ...ledger, hustles: ledger.hustles.filter((h) => h.id !== id) };
}

/** ───────────────── Goals (savings targets, pure) ───────────────── */

/** Defensive accessor — older cached ledgers (pre-v4) have no `goals`. */
export function getGoals(ledger: Ledger): Goal[] {
  return ledger.goals ?? [];
}

/**
 * A goal's history, oldest first — the same order it is stored in.
 *
 * Defensive for the same reason `getGoals` is: a goal restored from a pre-v6
 * backup that skipped the migration would have no `events` at all, and the
 * detail view must render an empty history rather than crash the dashboard.
 */
export function goalEvents(goal: Goal): GoalEvent[] {
  return goal.events ?? [];
}

/**
 * Mint one history entry.
 *
 * `at` is passed in rather than read from the clock inside, so the migration can
 * date a synthesized row from the goal's own `createdAt` and every event this
 * module writes still stays a pure function of its inputs.
 */
function goalEvent(
  kind: GoalEventKind,
  at: string,
  rest: Omit<GoalEvent, "id" | "kind" | "at"> = {},
): GoalEvent {
  return { id: crypto.randomUUID(), kind, at, ...rest };
}

/** Append entries to a goal's history. Append-only: history is never rewritten. */
function withEvents(goal: Goal, ...added: GoalEvent[]): Goal {
  return { ...goal, events: [...goalEvents(goal), ...added] };
}

/** Progress toward the target as a 0–100 percentage (clamped). */
export function goalProgressPct(goal: Goal): number {
  if (goal.targetAmount <= 0) return 0;
  return Math.min(100, Math.max(0, (goal.savedAmount / goal.targetAmount) * 100));
}

/** Amount still needed to hit the target (never negative). */
export function goalRemaining(goal: Goal): number {
  return Math.max(0, goal.targetAmount - goal.savedAmount);
}

/** True once enough has been earmarked to cover the target. */
export function isGoalComplete(goal: Goal): boolean {
  return goal.savedAmount >= goal.targetAmount && goal.targetAmount > 0;
}

/**
 * True if a goal with effectively the same name already exists — idempotency
 * guard so "save £1000 for the scholarship" said twice doesn't stack targets.
 */
export function isDuplicateGoal(ledger: Ledger, name: string): boolean {
  const q = name.trim().toLowerCase();
  return getGoals(ledger).some((g) => g.name.trim().toLowerCase() === q);
}

/** Add a savings target (agent action). Progress starts at 0 (earmark model). */
export function addGoal(
  ledger: Ledger,
  input: { name: string; targetAmount: number; targetDate?: string | null },
): Ledger {
  const target =
    input.targetAmount > 0 ? Math.round(input.targetAmount) : 0;
  const createdAt = new Date().toISOString();
  const targetDate = normalizeDate(input.targetDate) ?? undefined;
  const g: Goal = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    targetAmount: target,
    savedAmount: 0,
    targetDate,
    createdAt,
    // The history opens with the goal itself, so the detail view always has a
    // first entry to show — a brand-new goal reads as "started", not as blank.
    events: [
      goalEvent("created", createdAt, {
        targetAmount: target,
        toDate: targetDate ?? null,
      }),
    ],
  };
  return { ...ledger, goals: [...getGoals(ledger), g] };
}

/**
 * Revise an existing goal's target amount and/or date, recording what changed.
 *
 * This exists because a target that can never move makes the history a lie:
 * "make it 200k instead" used to hit `add_goal`'s duplicate guard and silently
 * do nothing. Only genuine changes are written — re-stating the same target
 * returns the ledger untouched, so a repeated ask cannot pile up empty rows.
 */
export function updateGoal(
  ledger: Ledger,
  match: string,
  input: { targetAmount?: number | null; targetDate?: string | null },
): Ledger {
  const q = match.trim().toLowerCase();
  if (!q) return ledger;
  const idx = getGoals(ledger).findIndex((g) => g.name.toLowerCase().includes(q));
  if (idx < 0) return ledger;

  const goal = getGoals(ledger)[idx];
  const at = new Date().toISOString();
  const added: GoalEvent[] = [];
  let next = goal;

  const target =
    typeof input.targetAmount === "number" && input.targetAmount > 0
      ? Math.round(input.targetAmount)
      : null;
  if (target !== null && target !== goal.targetAmount) {
    added.push(
      goalEvent("target_changed", at, {
        fromAmount: goal.targetAmount,
        toAmount: target,
      }),
    );
    next = { ...next, targetAmount: target };
  }

  // undefined means "not mentioned" and leaves the date alone; an explicit null
  // clears it. Only `undefined` can mean untouched, which is why this reads the
  // key rather than testing truthiness.
  if (input.targetDate !== undefined) {
    const date = normalizeDate(input.targetDate) ?? null;
    const current = goal.targetDate ?? null;
    if (date !== current) {
      added.push(goalEvent("date_changed", at, { fromDate: current, toDate: date }));
      next = { ...next, targetDate: date ?? undefined };
    }
  }

  if (added.length === 0) return ledger;
  next = withEvents(next, ...added);
  return {
    ...ledger,
    goals: getGoals(ledger).map((g, i) => (i === idx ? next : g)),
  };
}

/**
 * Earmark money toward the first goal whose name matches (partial, case-
 * insensitive). Bumps `savedAmount` ONLY — never a transaction, never the
 * balance. A negative delta walks it back (corrections), floored at 0.
 */
export function contributeToGoal(
  ledger: Ledger,
  match: string,
  amount: number,
): Ledger {
  const q = match.trim().toLowerCase();
  if (!q || !Number.isFinite(amount) || amount === 0) return ledger;
  const idx = getGoals(ledger).findIndex((g) =>
    g.name.toLowerCase().includes(q),
  );
  if (idx < 0) return ledger;

  const goal = getGoals(ledger)[idx];
  const savedAfter = Math.max(0, Math.round(goal.savedAmount + amount));
  // The clamp at zero can swallow part of a negative correction, so record what
  // actually moved rather than what was asked for — history has to reconcile
  // against `savedAmount` exactly, or the timeline stops being an audit trail.
  const applied = savedAfter - goal.savedAmount;
  if (applied === 0) return ledger;

  const at = new Date().toISOString();
  const added: GoalEvent[] = [
    goalEvent("contribution", at, { amount: applied, savedAfter }),
  ];
  // The moment the target is covered gets its own entry, but only on the
  // crossing: a goal already complete that receives more must not re-announce.
  const wasComplete = isGoalComplete(goal);
  const nowComplete = goal.targetAmount > 0 && savedAfter >= goal.targetAmount;
  if (!wasComplete && nowComplete) added.push(goalEvent("reached", at));

  return {
    ...ledger,
    goals: getGoals(ledger).map((g, i) =>
      i === idx ? withEvents({ ...g, savedAmount: savedAfter }, ...added) : g,
    ),
  };
}

/**
 * The history entry a reducer just wrote, or null.
 *
 * The reducers stay pure and return only a `Ledger`, so a caller that needs the
 * id of the row it just created (to journal the matching note to Sibyl under
 * the same key) reads it back off the end of the history.
 */
export function lastGoalEvent(goal: Goal, kind?: GoalEventKind): GoalEvent | null {
  const events = goalEvents(goal);
  for (let i = events.length - 1; i >= 0; i--) {
    if (!kind || events[i].kind === kind) return events[i];
  }
  return null;
}

/** Remove the first goal whose name matches (agent action, partial match). */
export function removeGoalByName(ledger: Ledger, name: string): Ledger {
  const q = name.trim().toLowerCase();
  const idx = getGoals(ledger).findIndex((g) => g.name.toLowerCase().includes(q));
  if (idx < 0) return ledger;
  return { ...ledger, goals: getGoals(ledger).filter((_, i) => i !== idx) };
}

/** Remove a goal by id (precise delete from the Manage sheet). */
export function removeGoal(ledger: Ledger, id: string): Ledger {
  return { ...ledger, goals: getGoals(ledger).filter((g) => g.id !== id) };
}

/**
 * Memory used to live here as `ledger.memories`. It now lives in Sibyl,
 * reached through src/lib/memory.ts: the entities are the canonical record
 * and Sibyl's UNIQUE(tenant, category, name) does the de-duplication these
 * reducers used to approximate with string matching. The ledger keeps only
 * money, which is the half that must stay deterministic and offline-safe.
 */

/** ───────────────── Migration ───────────────── */

/**
 * Give a pre-v6 goal the history it never recorded.
 *
 * A goal restored from an older backup has a `savedAmount` and nothing to
 * explain it. Rather than show a goal at 42% above an empty timeline, the
 * migration synthesizes the two things it can honestly infer from what IS
 * stored: the goal was started (dated `createdAt`), and whatever is already set
 * aside was set aside before Stash tracked each step. The carried row is
 * flagged `carriedOver` so the UI can label it as exactly that and never pass
 * it off as a contribution someone actually made on that day.
 *
 * Idempotent: a goal that already has history is returned untouched.
 */
function backfillGoalHistory(goal: Goal): Goal {
  if (Array.isArray(goal.events) && goal.events.length > 0) return goal;
  const at = goal.createdAt || new Date().toISOString();
  const events: GoalEvent[] = [
    goalEvent("created", at, {
      targetAmount: goal.targetAmount,
      toDate: goal.targetDate ?? null,
    }),
  ];
  if (goal.savedAmount > 0) {
    events.push(
      goalEvent("contribution", at, {
        amount: goal.savedAmount,
        savedAfter: goal.savedAmount,
        carriedOver: true,
      }),
    );
    if (isGoalComplete(goal)) events.push(goalEvent("reached", at));
  }
  return { ...goal, events };
}

/**
 * Normalize a ledger loaded from localStorage (or an older backup) into the
 * current (v6) shape. Guards against NaN when an older v1 ledger (budget:
 * {total,spent}) is restored: maps budget.total → monthlyBudget, synthesizes a
 * single expense for the old `spent` so the balance stays consistent. Pre-v4
 * ledgers get empty `goals`. v5 is the version that moved memory OUT of the
 * ledger and into Sibyl, so any stored `memories` array is dropped here rather
 * than carried as an orphaned copy the app never reads. v6 gives every goal a
 * history (`backfillGoalHistory`), which is what the goal detail view reads.
 */
export function migrateLedger(raw: unknown): Ledger {
  if (!raw || typeof raw !== "object") return EMPTY_LEDGER;
  const r = raw as Record<string, unknown>;

  // Already v2–v6 shape (transactions-based). Backfill goals (pre-v4) and strip
  // the retired memory field so an older cached ledger restores cleanly.
  if (typeof r.openingBalance === "number" && Array.isArray(r.transactions)) {
    const rest: Record<string, unknown> = { ...r };
    delete rest.memories;
    return {
      ...(rest as unknown as Ledger),
      version: 6,
      monthlyBudget: (r.monthlyBudget as number | null) ?? null,
      goals: ((r.goals as Goal[]) ?? []).map(backfillGoalHistory),
    };
  }

  // v1 → v6.
  const budget = r.budget as { total?: number; spent?: number } | undefined;
  const transactions = Array.isArray(r.transactions)
    ? (r.transactions as Transaction[])
    : [];
  if (budget?.spent && budget.spent > 0) {
    transactions.push({
      id: "tx-legacy-spent",
      type: "expense",
      amount: budget.spent,
      label: "Previous spending",
      category: "other",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  }
  return {
    version: 6,
    owner: (r.owner as string) ?? "",
    currency: "NGN",
    openingBalance: 0,
    monthlyBudget: budget?.total ?? null,
    transactions,
    scholarships: (r.scholarships as Ledger["scholarships"]) ?? [],
    hustles: (r.hustles as Ledger["hustles"]) ?? [],
    goals: ((r.goals as Goal[]) ?? []).map(backfillGoalHistory),
  };
}
