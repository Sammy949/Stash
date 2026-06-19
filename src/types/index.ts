/**
 * Stash domain model.
 *
 * The `Ledger` is the single object that gets serialized to JSON,
 * encrypted, and persisted to 0G Storage. Everything the agent needs
 * to be "personalized" lives here so it can be injected into the
 * system prompt on every 0G Compute call.
 */

export type Currency = "NGN";

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

/** ───────────────── Budget / Vault ───────────────── */

export interface Budget {
  total: number;
  /** Sum of expenses; kept denormalized for instant UI, recomputed on load. */
  spent: number;
}

/** ───────────────── The persisted ledger ───────────────── */

export interface Ledger {
  /** Schema version so we can migrate the stored JSON later. */
  version: number;
  owner: string;
  currency: Currency;
  budget: Budget;
  transactions: Transaction[];
  scholarships: Scholarship[];
  hustles: Hustle[];
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
  | "error";

/** ───────────────── Agent / Chat ───────────────── */

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  /** Transient flag for the typing indicator placeholder. */
  pending?: boolean;
}

/** A parsed expense extracted from natural language. */
export interface ParsedExpense {
  amount: number;
  label: string;
  category: ExpenseCategory;
}
