import type { ExpenseCategory, Ledger } from "@/types";
import {
  addHustle,
  addScholarship,
  addTransaction,
  decisionContext,
  isDuplicateTransaction,
  removeHustleByName,
  removeLastTransaction,
  removeScholarshipByName,
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
          amount: { type: ["number", "string"], description: "Amount spent, in the user's currency" },
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
          amount: { type: ["number", "string"], description: "Amount received, in the user's currency" },
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
          amount: { type: ["number", "string"], description: "Monthly budget cap in the user's currency" },
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
  {
    type: "function",
    function: {
      name: "add_scholarship",
      description:
        "Add a scholarship or application to the user's radar. Use when they mention one they're tracking or applying to.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Scholarship/program name" },
          deadline: {
            type: "string",
            description:
              "Application deadline as an ISO date YYYY-MM-DD, if known. Resolve relative dates using today's date from the snapshot.",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_scholarship",
      description: "Remove a scholarship from the radar by (partial) name.",
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_income_stream",
      description:
        "Add an income stream / hustle (e.g. a freelance gig, a job, a side project). Use ONLY when the user states they HAVE a source of income — never to answer a question about existing streams.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the gig/stream" },
          amount: {
            type: ["number", "string"],
            description: "Amount it pays, if known",
          },
          recurring: {
            type: ["boolean", "string"],
            description: "True if it pays regularly each month (e.g. a monthly job)",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_income_stream",
      description: "Remove an income stream / hustle by (partial) name.",
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
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
 * Render the post-transaction facts the model should react to (the
 * "accountant" handing the "friend" ground truth). Every number here is
 * computed in code; the model must use these verbatim and never compute
 * its own. Only includes runway/pace when they're meaningful.
 */
function factSummary(
  type: "income" | "expense",
  amount: number,
  label: string,
  ledger: Ledger,
  cur: Ledger["currency"],
): string {
  const ctx = decisionContext(ledger);
  const facts: string[] = [
    `Logged ${type} ${formatMoney(amount, cur)} (${label}).`,
    `FACTS (use these exact numbers, do NOT recompute): new balance ${formatMoney(ctx.balance, cur)}.`,
  ];
  if (ctx.inTheRed) {
    facts.push(`The user is now IN THE RED (below zero) — flag this with care.`);
  }
  if (ctx.runwayDays !== null) {
    facts.push(
      `At their current spending pace, that's about ${ctx.runwayDays} day${ctx.runwayDays === 1 ? "" : "s"} of money left.`,
    );
  }
  return facts.join(" ");
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
  // Models sometimes send amounts as strings ("60000", "₦60,000"); coerce.
  const amount =
    typeof args.amount === "string"
      ? Number(args.amount.replace(/[^\d.-]/g, ""))
      : Number(args.amount);
  // ...and booleans as strings ("true"/"yes").
  const recurring =
    typeof args.recurring === "string"
      ? /^(true|yes|1)$/i.test(args.recurring.trim())
      : Boolean(args.recurring);

  switch (name) {
    case "log_expense": {
      if (!isFinite(amount) || amount <= 0)
        return { ledger, summary: "Invalid expense amount; nothing logged." };
      const label = String(args.label ?? "expense");
      const category = (args.category as ExpenseCategory) ?? "other";
      const parsed = { type: "expense" as const, amount, label, category };
      if (isDuplicateTransaction(ledger, parsed)) {
        return {
          ledger,
          summary: `DUPLICATE: an identical expense (${formatMoney(amount, cur)}, ${label}) was just logged — NOT logged again. Tell the user it's already recorded; do not re-log.`,
        };
      }
      const next = addTransaction(ledger, parsed);
      return { ledger: next, summary: factSummary("expense", amount, label, next, cur) };
    }
    case "log_income": {
      if (!isFinite(amount) || amount <= 0)
        return { ledger, summary: "Invalid income amount; nothing logged." };
      const label = String(args.label ?? "income");
      const parsed = { type: "income" as const, amount, label, tag: "Other" as const };
      if (isDuplicateTransaction(ledger, parsed)) {
        return {
          ledger,
          summary: `DUPLICATE: identical income (${formatMoney(amount, cur)}, ${label}) was just logged — NOT logged again. Tell the user it's already recorded; do not re-log.`,
        };
      }
      const next = addTransaction(ledger, parsed);
      return { ledger: next, summary: factSummary("income", amount, label, next, cur) };
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
    case "add_scholarship": {
      const schName = String(args.name ?? "").trim();
      if (!schName) return { ledger, summary: "No scholarship name given." };
      const next = addScholarship(ledger, {
        name: schName,
        deadline: args.deadline ? String(args.deadline) : null,
      });
      const added = next.scholarships[next.scholarships.length - 1];
      return {
        ledger: next,
        summary: `Added scholarship "${added.name}"${added.deadline ? ` (deadline ${added.deadline})` : ""}.`,
      };
    }
    case "remove_scholarship": {
      const next = removeScholarshipByName(ledger, String(args.name ?? ""));
      return {
        ledger: next,
        summary:
          next === ledger
            ? "No matching scholarship found."
            : `Removed scholarship matching "${args.name}".`,
      };
    }
    case "add_income_stream": {
      const hName = String(args.name ?? "").trim();
      if (!hName) return { ledger, summary: "No income-stream name given." };
      const next = addHustle(ledger, {
        name: hName,
        amount: isFinite(amount) && amount > 0 ? amount : undefined,
        recurring,
      });
      return { ledger: next, summary: `Added income stream "${hName}".` };
    }
    case "remove_income_stream": {
      const next = removeHustleByName(ledger, String(args.name ?? ""));
      return {
        ledger: next,
        summary:
          next === ledger
            ? "No matching income stream found."
            : `Removed income stream matching "${args.name}".`,
      };
    }
    default:
      return { ledger, summary: `Unknown action: ${name}.` };
  }
}
