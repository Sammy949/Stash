/**
 * Stash domain model.
 *
 * The `Ledger` is the single object that gets serialized to JSON,
 * encrypted, and persisted to 0G Storage. Everything the agent needs
 * to be "personalized" lives here so it can be injected into the
 * system prompt on every 0G Compute call.
 */

export type Currency =
  | "NGN"
  | "USD"
  | "GHS"
  | "KES"
  | "ZAR"
  | "RWF"
  | "GBP"
  | "EUR";

/** ───────────────── Transactions ───────────────── */

export type TransactionType = "expense" | "income";

export type ExpenseCategory =
  | "transport"
  | "data"
  | "food"
  | "printing"
  | "airtime"
  | "rent"
  | "other";

export type IncomeTag = "Design" | "Teaching" | "Writing" | "Other";

export interface Transaction {
  id: string;
  type: TransactionType;
  /** Positive amount in the smallest sensible unit (whole Naira). */
  amount: number;
  /** Free-text label, e.g. "transport", "Brand Identity — CBHF". */
  label: string;
  category?: ExpenseCategory;
  tag?: IncomeTag;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

/** ───────────────── Scholarships ───────────────── */

export type ScholarshipStatus =
  | "documents_submitted"
  | "pending_confirmation"
  | "deadline" // open application with a due date
  | "opens_later"; // not yet open

/** Visual urgency band. Derived from status + days remaining. */
export type UrgencyColor = "emerald" | "amber" | "red" | "muted";

export interface Scholarship {
  id: string;
  name: string;
  status: ScholarshipStatus;
  /** Human label for the status pill, e.g. "Documents Submitted". */
  statusLabel: string;
  /** ISO date of the deadline, when applicable. */
  deadline?: string;
  /** Pre-computed/overridable color band for the radar. */
  color: UrgencyColor;
}

/** ───────────────── Hustles (income streams) ───────────────── */

export type HustleStatus = "received" | "active" | "pending" | "building";

export interface Hustle {
  id: string;
  name: string;
  /** Display string for the amount, e.g. "₦25,000/mo", "₦0". */
  amountLabel: string;
  /** Numeric monthly value for "total active income" math; 0 if none. */
  monthlyValue: number;
  status: HustleStatus;
  tag: IncomeTag;
}

/** ───────────────── Goals (savings targets) ───────────────── */

/**
 * A savings target — money the user is working TOWARD ("save £1000 for the
 * scholarship", "£8k for a semester abroad"). Distinct from a `goal` MEMORY
 * (a vague, number-less aspiration): a Goal is structured and trackable.
 *
 * Progress is an EARMARK model: `savedAmount` is money the user has mentally
 * set aside, bumped only by explicit "I set aside £X" actions. It is NOT a
 * transaction and NEVER changes the spendable balance — balance stays derived
 * from transactions alone. Actually paying for the thing is a normal expense
 * that, separately, can close the goal.
 */
export interface Goal {
  id: string;
  /** What they're saving for, e.g. "Scholarship payment", "Fix phone". */
  name: string;
  /** The target amount to reach. */
  targetAmount: number;
  /** Money earmarked so far (0..targetAmount-ish). Never touches balance. */
  savedAmount: number;
  /** Optional ISO date they want to hit the target by. */
  targetDate?: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

/** ───────────────── Memory ───────────────── */

/**
 * Soft memory — what Stash KNOWS about the user, beyond the money math.
 * The conversation creates these; they're model-written and fuzzy, and they
 * NEVER feed balance math (that stays deterministic + code-owned). The ledger
 * is a special, stricter kind of memory; this is everything else.
 */
export type MemoryKind =
  | "goal" // "Saving for a MacBook"
  | "habit" // "Overspends after payday"
  | "preference" // "Prefers cooking", "Avoids debt"
  | "opportunity" // a gig/application not already in scholarships/hustles
  | "identity"; // "Final-year student in Lagos"

export interface Memory {
  id: string;
  kind: MemoryKind;
  /** Free-text, first-person-about-the-user, e.g. "Saving for a MacBook". */
  content: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

/** ───────────────── The persisted ledger ───────────────── */

/**
 * Expenses and income are the source of truth. The spendable balance is
 * DERIVED — never stored — as:
 *
 *   balance = openingBalance + Σ(income) − Σ(expenses)
 *
 * `monthlyBudget` is an optional cap the user sets later (or the agent
 * suggests); it is not where money "comes from". Null until set.
 */
export interface Ledger {
  /** Schema version so we can migrate the stored JSON later. */
  version: number;
  owner: string;
  currency: Currency;
  /** Money the user already had before they started logging. */
  openingBalance: number;
  /** Optional monthly spending cap. Null until the user sets one. */
  monthlyBudget: number | null;
  transactions: Transaction[];
  scholarships: Scholarship[];
  hustles: Hustle[];
  /** Structured savings targets (earmark progress, never balance). */
  goals: Goal[];
  /** Soft memory — goals, habits, preferences. Grows from conversation. */
  memories: Memory[];
  /** ISO timestamp of the last successful 0G Storage sync. */
  lastSyncedAt: string | null;
}

/** ───────────────── 0G Storage ───────────────── */

export interface SyncResult {
  rootHash: string;
  syncedAt: string;
}

export type SyncPhase =
  | "idle"
  | "encrypting"
  | "uploading"
  | "confirmed"
  | "error"
  /** Sync didn't go through; data is safe locally and will retry. Persists
   *  (no auto-clear) until a sync succeeds. */
  | "pending";

/** ───────────────── Agent cards (structured replies) ───────────────── */

/** One row in a spending breakdown — a category and its share of the total. */
export interface SpendRow {
  label: string;
  amount: number;
  pct: number;
}

/**
 * A deterministic spending breakdown, computed in code (never the model) and
 * rendered as an inline card in chat. Numbers are code-owned — see
 * `analyzeSpending` in lib/analysis.ts.
 */
export interface SpendingBreakdown {
  currency: Currency;
  windowDays: number;
  total: number;
  /** Top categories, largest first. */
  rows: SpendRow[];
  topLabel: string;
  topShare: number;
}

/** Structured payload the agent can attach to a message for rich rendering. */
export type AgentCard = { type: "spending"; data: SpendingBreakdown };

/** ───────────────── Agent / Chat ───────────────── */

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  /** Transient flag for the typing indicator placeholder. */
  pending?: boolean;
  /** Optional structured card rendered with this message (e.g. a spending
   *  breakdown). Code-computed — see lib/analysis.ts. */
  card?: AgentCard;
  /**
   * IDs of goals this assistant turn touched (created/contributed-to) or, for a
   * "review my goals" turn, the active goals to show. The bubble renders an
   * inline GoalCard for each still-existing goal — visible proof of goal state,
   * shown only at the moments it matters, not on every message.
   */
  relatedGoalIds?: string[];
  /**
   * The full state Stash held just BEFORE this (user) turn ran — money AND
   * memory. Editing a message restores exactly this, so the ledger is never
   * reconstructed by replaying the model; the snapshot is the source of truth
   * for the numbers. Named "memory", not "ledger", because it captures
   * everything Stash knew, not just transactions.
   */
  memorySnapshot?: Ledger;
}

/** A transaction parsed from natural language (expense or income). */
export interface ParsedTransaction {
  type: TransactionType;
  amount: number;
  label: string;
  category?: ExpenseCategory;
  tag?: IncomeTag;
}
