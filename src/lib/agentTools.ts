import type { ExpenseCategory, Ledger, MemoryKind } from "@/types";
import {
  addGoal,
  addHustle,
  addMemory,
  addScholarship,
  addTransaction,
  contributeToGoal,
  decisionContext,
  getGoals,
  goalProgressPct,
  goalRemaining,
  isDuplicateGoal,
  isDuplicateMemory,
  isDuplicateTransaction,
  removeGoalByName,
  removeHustleByName,
  removeLastTransaction,
  removeMemoryByContent,
  removeScholarshipByName,
  setMonthlyBudget,
  updateMemoryByContent,
} from "@/lib/ledger";
import { formatMoney } from "@/lib/currency";
import { incomeGoalFacts } from "@/lib/goalContext";

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

/**
 * Map any free-form category the model emits onto our known buckets.
 *
 * The schema intentionally does NOT constrain `category` to an enum: a strict
 * enum is enforced *server-side* by the provider, so a value the model invents
 * ("tithe", "family", "hospital") makes the provider reject the WHOLE tool
 * call with a raw validation error — before our code ever runs. Instead we
 * accept any string and bucket it here: exact matches pass through, a few
 * common synonyms are mapped, and everything unrecognized falls to "other".
 * The model can never send a value that crashes the call.
 */
const CATEGORY_SYNONYMS: Record<string, ExpenseCategory> = {
  transportation: "transport",
  transit: "transport",
  fare: "transport",
  fuel: "transport",
  internet: "data",
  wifi: "data",
  groceries: "food",
  meal: "food",
  meals: "food",
  dining: "food",
  printout: "printing",
  print: "printing",
  call: "airtime",
  calls: "airtime",
  recharge: "airtime",
  housing: "rent",
  accommodation: "rent",
};

export function normalizeCategory(input: unknown): ExpenseCategory {
  if (typeof input !== "string") return "other";
  const key = input.trim().toLowerCase();
  if ((EXPENSE_CATEGORIES as string[]).includes(key)) {
    return key as ExpenseCategory;
  }
  return CATEGORY_SYNONYMS[key] ?? "other";
}

/** The known memory kinds + a few synonyms the model might reach for. */
const MEMORY_KINDS: MemoryKind[] = [
  "goal",
  "habit",
  "preference",
  "opportunity",
  "identity",
];
const MEMORY_KIND_SYNONYMS: Record<string, MemoryKind> = {
  goals: "goal",
  saving: "goal",
  target: "goal",
  aspiration: "goal",
  habits: "habit",
  behaviour: "habit",
  behavior: "habit",
  pattern: "habit",
  tendency: "habit",
  preferences: "preference",
  like: "preference",
  dislike: "preference",
  value: "preference",
  gig: "opportunity",
  application: "opportunity",
  fact: "identity",
  about: "identity",
  background: "identity",
  profile: "identity",
};

/**
 * Bucket a free-form memory kind onto our known set. Like normalizeCategory,
 * the schema does NOT enforce an enum (a strict enum makes the provider reject
 * the whole tool call on any off-list value); we accept any string and map it.
 * Unknown kinds fall to "identity" — the most general "fact about the user".
 */
export function normalizeMemoryKind(input: unknown): MemoryKind {
  if (typeof input !== "string") return "identity";
  const key = input.trim().toLowerCase();
  if ((MEMORY_KINDS as string[]).includes(key)) return key as MemoryKind;
  return MEMORY_KIND_SYNONYMS[key] ?? "identity";
}

/**
 * Coerce a model-supplied amount into a number, EXPANDING k/m/thousand/million
 * shorthand before stripping non-numeric characters.
 *
 * Nigerian users say "5k / 50k / 2m" constantly. The old logic stripped all
 * non-digits first, so "50k" collapsed to 50 — and every downstream figure
 * (balance, runway, % spent) came out 1000× too small. We detect the
 * multiplier first, then parse the numeric core, then multiply:
 *   "50k" → 50000 · "2m" → 2000000 · "2.5k" → 2500 · "5 thousand" → 5000
 * Plain amounts ("₦50,000", 50000) pass straight through (multiplier 1).
 */
export function coerceAmount(input: unknown): number {
  if (typeof input === "number") return input;
  if (typeof input !== "string") return Number(input);
  const s = input.trim().toLowerCase();
  if (!s) return NaN;

  let multiplier = 1;
  if (/\bmillion\b/.test(s) || /\d\s*m\b/.test(s)) {
    multiplier = 1_000_000;
  } else if (/\bthousand\b/.test(s) || /\d\s*k\b/.test(s)) {
    multiplier = 1_000;
  }

  // Keep only the numeric core (digits, decimal point, sign).
  const num = Number(s.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(num)) return NaN;
  return num * multiplier;
}

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
          category: {
            type: "string",
            description:
              "Optional spending category. Prefer one of: transport, data, food, printing, airtime, rent, other. Anything else is fine too — it's bucketed in code.",
          },
          force: {
            type: ["boolean", "string"],
            description:
              "Leave unset normally. Set true ONLY when a previous attempt returned DUPLICATE_CONFIRM and the user has now explicitly confirmed they want to log this near-identical expense AGAIN (a genuine second purchase).",
          },
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
          force: {
            type: ["boolean", "string"],
            description:
              "Leave unset normally. Set true ONLY when a previous attempt returned DUPLICATE_CONFIRM and the user has now explicitly confirmed they want to log this near-identical income AGAIN.",
          },
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
  {
    type: "function",
    function: {
      name: "add_goal",
      description:
        "Create a savings target the user is working TOWARD (e.g. 'save £1000 for the scholarship', '£8k for a semester abroad'). Use when they state something they need to save up for, OR after they accept your offer to track an upcoming cost as a goal. This does NOT move money — it sets a target with progress starting at zero.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "What they're saving for, e.g. 'Scholarship payment', 'Fix phone'.",
          },
          target_amount: {
            type: ["number", "string"],
            description: "The amount to reach, in the user's currency.",
          },
          target_date: {
            type: "string",
            description:
              "Optional ISO date YYYY-MM-DD to hit it by. Resolve relative dates using today's date from the snapshot.",
          },
        },
        required: ["name", "target_amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "contribute_to_goal",
      description:
        "Earmark money toward an existing goal when the user says they SET ASIDE / saved / put money toward it (e.g. 'I put £200 toward the phone fund'). This bumps the goal's progress ONLY — it is NOT spending and does NOT change their balance. Never use this for an actual purchase (that's log_expense).",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "(Partial) name of the goal to add to, e.g. 'phone'.",
          },
          amount: {
            type: ["number", "string"],
            description: "Amount set aside toward the goal, in the user's currency.",
          },
        },
        required: ["name", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_goal",
      description:
        "Remove a savings goal by (partial) name (they abandoned it or it's done).",
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
      name: "remember",
      description:
        "Save a lasting fact about WHO the user is — a goal, habit, preference, opportunity, or identity detail — that should shape future advice. Use for non-money statements with long-term value ('I'm saving for a laptop', 'I overspend after payday', 'I prefer cooking', 'I'm a final-year student'). Do NOT use for money events (use log_expense/log_income), questions, or throwaway chit-chat.",
      parameters: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            description:
              "One of: goal, habit, preference, opportunity, identity. Anything else is bucketed in code.",
          },
          content: {
            type: "string",
            description:
              "The memory in a short third-person-about-the-user phrase, e.g. 'Saving for a MacBook', 'Overspends after getting paid'.",
          },
        },
        required: ["kind", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_memory",
      description:
        "Revise an existing memory when the user changes or corrects it (e.g. 'actually I'm saving for tuition now, not a laptop'). Matches the existing memory by a snippet of its current content.",
      parameters: {
        type: "object",
        properties: {
          match: {
            type: "string",
            description:
              "A snippet of the EXISTING memory to revise, e.g. 'laptop'.",
          },
          content: {
            type: "string",
            description: "The new memory content, e.g. 'Saving for tuition'.",
          },
        },
        required: ["match", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "forget_memory",
      description:
        "Drop a memory that no longer holds (e.g. 'I'm not saving for the laptop anymore'). Matches by a snippet of the memory's content.",
      parameters: {
        type: "object",
        properties: {
          match: {
            type: "string",
            description: "A snippet of the memory to remove, e.g. 'laptop'.",
          },
        },
        required: ["match"],
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
  /**
   * IDs of goals this action touched (created or contributed to). The turn
   * collects these so the bubble can render an inline GoalCard as proof of the
   * change. Omitted for non-goal actions (and for remove_goal — the goal is
   * gone, so there's nothing to show).
   */
  relatedGoalIds?: string[];
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
  // Living goal context: when fresh income lands and an open goal exists, hand
  // the agent the "set some aside?" facts so it can offer naturally in-reply.
  if (type === "income") {
    const goalFacts = incomeGoalFacts(ledger, cur);
    if (goalFacts) facts.push(goalFacts);
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
  // Models sometimes send amounts as strings ("60000", "₦60,000", "50k");
  // coerce + expand shorthand (50k → 50000) before any math touches it.
  const amount = coerceAmount(args.amount);
  // ...and booleans as strings ("true"/"yes").
  const recurring =
    typeof args.recurring === "string"
      ? /^(true|yes|1)$/i.test(args.recurring.trim())
      : Boolean(args.recurring);
  // `force` lets a confirmed re-log bypass the duplicate guard.
  const force =
    typeof args.force === "string"
      ? /^(true|yes|1)$/i.test(args.force.trim())
      : Boolean(args.force);

  switch (name) {
    case "log_expense": {
      if (!isFinite(amount) || amount <= 0)
        return { ledger, summary: "Invalid expense amount; nothing logged." };
      const label = String(args.label ?? "expense");
      const category = normalizeCategory(args.category);
      const parsed = { type: "expense" as const, amount, label, category };
      if (!force && isDuplicateTransaction(ledger, parsed)) {
        return {
          ledger,
          summary: `DUPLICATE_CONFIRM: a matching expense (${formatMoney(amount, cur)}, ${label}) was logged moments ago — NOT logged again yet. Ask the user if they really mean to log it a SECOND time (a genuine repeat purchase). Only if they confirm, call log_expense again with force=true. Do NOT log it otherwise.`,
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
      if (!force && isDuplicateTransaction(ledger, parsed)) {
        return {
          ledger,
          summary: `DUPLICATE_CONFIRM: matching income (${formatMoney(amount, cur)}, ${label}) was logged moments ago — NOT logged again yet. Ask the user if they really mean to log it a SECOND time. Only if they confirm, call log_income again with force=true. Do NOT log it otherwise.`,
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
    case "add_goal": {
      const goalName = String(args.name ?? "").trim();
      if (!goalName) return { ledger, summary: "No goal name given." };
      // The schema field is `target_amount`; fall back to `amount` in case the
      // model reaches for the shared name. (The top-level `amount` is derived
      // from args.amount and is NaN for a correct target_amount-only call.)
      const goalTarget = coerceAmount(args.target_amount ?? args.amount);
      if (!isFinite(goalTarget) || goalTarget <= 0)
        return { ledger, summary: "Invalid goal target; nothing added." };
      if (isDuplicateGoal(ledger, goalName)) {
        return {
          ledger,
          summary: `A goal named "${goalName}" already exists — no need to add it again. To add progress, use contribute_to_goal.`,
        };
      }
      const next = addGoal(ledger, {
        name: goalName,
        targetAmount: goalTarget,
        targetDate: args.target_date ? String(args.target_date) : null,
      });
      const g = getGoals(next)[getGoals(next).length - 1];
      const by = g.targetDate ? ` by ${g.targetDate}` : "";
      return {
        ledger: next,
        summary: `Created goal "${g.name}" — target ${formatMoney(g.targetAmount, cur)}${by}, ${formatMoney(0, cur)} saved so far. This is a target only; it did NOT change their balance.`,
        relatedGoalIds: [g.id],
      };
    }
    case "contribute_to_goal": {
      const match = String(args.name ?? "").trim();
      if (!match) return { ledger, summary: "No goal name given." };
      if (!isFinite(amount) || amount === 0)
        return { ledger, summary: "Invalid contribution amount; goal unchanged." };
      const next = contributeToGoal(ledger, match, amount);
      if (next === ledger)
        return {
          ledger,
          summary: `No goal matching "${match}" — nothing to add to. Offer to create it with add_goal.`,
        };
      const g = getGoals(next).find((x) => x.name.toLowerCase().includes(match.toLowerCase()));
      if (!g) return { ledger: next, summary: "Goal updated." };
      const done = goalRemaining(g) === 0;
      return {
        ledger: next,
        summary: done
          ? `Earmarked ${formatMoney(amount, cur)} toward "${g.name}" — that's the full ${formatMoney(g.targetAmount, cur)} target reached! (Earmark only — their spendable balance is unchanged.)`
          : `Earmarked ${formatMoney(amount, cur)} toward "${g.name}". FACTS (use verbatim): ${formatMoney(g.savedAmount, cur)} of ${formatMoney(g.targetAmount, cur)} saved (${Math.round(goalProgressPct(g))}%), ${formatMoney(goalRemaining(g), cur)} to go. Earmark only — balance unchanged.`,
        relatedGoalIds: [g.id],
      };
    }
    case "remove_goal": {
      const next = removeGoalByName(ledger, String(args.name ?? ""));
      return {
        ledger: next,
        summary:
          next === ledger
            ? "No matching goal found."
            : `Removed goal matching "${args.name}".`,
      };
    }
    case "remember": {
      const content = String(args.content ?? "").trim();
      if (!content) return { ledger, summary: "No memory content given." };
      const kind = normalizeMemoryKind(args.kind);
      if (isDuplicateMemory(ledger, kind, content)) {
        return {
          ledger,
          summary: `Already remembered (${kind}: ${content}) — no need to save it again.`,
        };
      }
      const next = addMemory(ledger, { kind, content });
      return {
        ledger: next,
        summary: `Remembered (${kind}): ${content}. Acknowledge naturally — don't read it back like a robot.`,
      };
    }
    case "update_memory": {
      const match = String(args.match ?? "").trim();
      const content = String(args.content ?? "").trim();
      if (!match || !content)
        return { ledger, summary: "Need both the memory to match and the new content." };
      const next = updateMemoryByContent(ledger, match, content);
      return {
        ledger: next,
        summary:
          next === ledger
            ? `No memory matching "${match}" to update.`
            : `Updated memory to: ${content}.`,
      };
    }
    case "forget_memory": {
      const match = String(args.match ?? "").trim();
      if (!match) return { ledger, summary: "No memory specified to forget." };
      const next = removeMemoryByContent(ledger, match);
      return {
        ledger: next,
        summary:
          next === ledger
            ? `No memory matching "${match}" to forget.`
            : `Forgot the memory matching "${match}".`,
      };
    }
    default:
      return { ledger, summary: `Unknown action: ${name}.` };
  }
}
