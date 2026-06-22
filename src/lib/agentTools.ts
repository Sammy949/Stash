import type { ExpenseCategory, Ledger } from "@/types";
import {
  addTransaction,
  removeLastTransaction,
  setMonthlyBudget,
} from "@/lib/ledger";
import { formatMoney } from "@/lib/currency";

/**
 * Agent tools — the structured actions Stash can take on the ledger.
 *
 * OpenAI-compatible function schemas (sent to the Router/Groq) + a pure
 * `applyAction` that maps a tool call to a ledger reducer. This is what
 * makes the agent *act* on real state instead of narrating math.
 */

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "transport",
  "data",
  "food",
  "printing",
  "airtime",
  "rent",
  "other",
];

export const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "log_expense",
      description:
        "Record money the user spent. Call whenever they mention spending, paying for, or buying something.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Amount spent, in the user's currency" },
          label: { type: "string", description: "Short description, e.g. 'new laptop'" },
          category: { type: "string", enum: EXPENSE_CATEGORIES },
        },
        required: ["amount", "label"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_income",
      description:
        "Record money the user received. Call whenever they mention getting paid, a gift, an allowance, a disbursement, or any money coming in.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Amount received, in the user's currency" },
          label: { type: "string", description: "Source, e.g. 'gift from Dad', 'client payment'" },
        },
        required: ["amount", "label"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_monthly_budget",
      description: "Set the user's monthly spending budget cap.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Monthly budget cap in the user's currency" },
        },
        required: ["amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_last_transaction",
      description:
        "Undo / remove the most recently logged transaction (use when the user says that was wrong, or to undo).",
      parameters: { type: "object", properties: {} },
    },
  },
] as const;

export type ToolName = (typeof AGENT_TOOLS)[number]["function"]["name"];

/** Result of applying one tool call. */
export interface ActionResult {
  ledger: Ledger;
  /** Short factual summary fed back to the model (the tool result). */
  summary: string;
}

/**
 * Apply a single tool call to the ledger. Pure — returns a new ledger and
 * a factual summary the model uses to write its confirmation.
 */
export function applyAction(
  ledger: Ledger,
  name: string,
  args: Record<string, unknown>,
): ActionResult {
  const cur = ledger.currency;
  const amount = Number(args.amount);

  switch (name) {
    case "log_expense": {
      if (!isFinite(amount) || amount <= 0)
        return { ledger, summary: "Invalid expense amount; nothing logged." };
      const label = String(args.label ?? "expense");
      const category = (args.category as ExpenseCategory) ?? "other";
      const next = addTransaction(ledger, { type: "expense", amount, label, category });
      return { ledger: next, summary: `Logged expense ${formatMoney(amount, cur)} (${label}).` };
    }
    case "log_income": {
      if (!isFinite(amount) || amount <= 0)
        return { ledger, summary: "Invalid income amount; nothing logged." };
      const label = String(args.label ?? "income");
      const next = addTransaction(ledger, { type: "income", amount, label, tag: "Other" });
      return { ledger: next, summary: `Logged income ${formatMoney(amount, cur)} (${label}).` };
    }
    case "set_monthly_budget": {
      if (!isFinite(amount) || amount <= 0)
        return { ledger, summary: "Invalid budget amount; unchanged." };
      const next = setMonthlyBudget(ledger, amount);
      return { ledger: next, summary: `Monthly budget set to ${formatMoney(amount, cur)}.` };
    }
    case "delete_last_transaction": {
      if (ledger.transactions.length === 0)
        return { ledger, summary: "No transactions to remove." };
      const last = ledger.transactions[ledger.transactions.length - 1];
      const next = removeLastTransaction(ledger);
      return {
        ledger: next,
        summary: `Removed last transaction: ${last.type} ${formatMoney(last.amount, cur)} (${last.label}).`,
      };
    }
    default:
      return { ledger, summary: `Unknown action: ${name}.` };
  }
}
