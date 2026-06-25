import type { ChatMessage, Ledger } from "@/types";
import {
  balance,
  daysUntil,
  totalActiveIncome,
  totalExpenses,
  totalIncome,
} from "@/lib/ledger";
import { CURRENCIES, formatMoney } from "@/lib/currency";
import { AGENT_TOOLS, applyAction } from "@/lib/agentTools";

/**
 * 0G Compute integration — the Stash AI agent.
 *
 * Calls an OpenAI-compatible chat endpoint with the live ledger injected
 * into the system prompt, so every reply is specific to Samuel.
 *
 * PROVIDER: defaults to the 0G Compute Router (router-api.0g.ai). The
 * Router is billed against a mainnet 0G balance; for a testnet/hackathon
 * build where that balance isn't available, point VITE_AI_BASE_URL /
 * VITE_AI_API_KEY / VITE_AI_MODEL at any OpenAI-compatible provider
 * (Anthropic, OpenAI, Together, …). The request shape, system prompt,
 * ledger injection, and error handling are identical either way — only
 * the endpoint, key, and model name change. Set VITE_AI_BASE_URL back to
 * "https://router-api.0g.ai/v1" (model glm-5) once the mainnet Router
 * balance is funded to run fully on 0G Compute.
 */

/** 0G Compute Router defaults — used when no fallback provider is set. */
export const ROUTER_URL = "https://router-api.0g.ai/v1";
// Verified against the live /v1/models catalog — the spec's
// "zai-org/GLM-5-FP8" does not exist on the Router. glm-5 is the
// general-purpose flagship; swap to glm-5.1 / deepseek-v3 if desired.
export const ROUTER_MODEL = "glm-5";

/**
 * Resolved provider config: the optional OpenAI-compatible fallback
 * (VITE_AI_*) takes precedence; otherwise the 0G Router (VITE_OG_*).
 */
const BASE_URL = import.meta.env.VITE_AI_BASE_URL?.replace(/\/$/, "") || ROUTER_URL;
const API_KEY =
  import.meta.env.VITE_AI_API_KEY || import.meta.env.VITE_OG_COMPUTE_API_KEY;
export const STASH_MODEL = import.meta.env.VITE_AI_MODEL || ROUTER_MODEL;

/** Whether the active provider is the 0G Router (vs a fallback). */
export const usingRouter = BASE_URL === ROUTER_URL;

/** True when an API key is present for the active provider. */
export function isComputeConfigured(): boolean {
  return Boolean(API_KEY);
}

/** Thrown for known, user-actionable Router failures (e.g. empty balance). */
export class StashComputeError extends Error {}

/** ───────────────── system prompt ───────────────── */

/** Render the ledger into a compact, readable snapshot for the prompt. */
function renderLedgerSnapshot(ledger: Ledger): string {
  const c = ledger.currency;
  const money = (n: number) => formatMoney(n, c);
  const lines: string[] = [];

  lines.push(
    `Balance: ${money(balance(ledger))} (income ${money(
      totalIncome(ledger),
    )} − expenses ${money(totalExpenses(ledger))}).`,
  );
  if (ledger.monthlyBudget) {
    lines.push(`Monthly budget cap: ${money(ledger.monthlyBudget)}.`);
  }
  const activeIncome = totalActiveIncome(ledger.hustles);
  if (activeIncome > 0) {
    lines.push(`Recurring active income: ${money(activeIncome)}/mo.`);
  }

  if (ledger.scholarships.length > 0) {
    lines.push("\nScholarships:");
    for (const s of ledger.scholarships) {
      const when = s.deadline
        ? `deadline ${s.deadline} (${daysUntil(s.deadline)} days)`
        : s.statusLabel;
      lines.push(`- ${s.name} — ${when}`);
    }
  }

  if (ledger.transactions.length > 0) {
    lines.push("\nRecent activity (newest first):");
    for (const t of ledger.transactions.slice(-8).reverse()) {
      const sign = t.type === "expense" ? "-" : "+";
      lines.push(`- ${sign}${money(t.amount)} · ${t.label}`);
    }
  } else {
    lines.push("\nNo transactions logged yet.");
  }

  return lines.join("\n");
}

export function buildSystemPrompt(ledger: Ledger): string {
  const name = ledger.owner?.trim() || "there";
  const cur = CURRENCIES[ledger.currency];
  return `You are Stash AI — a personal finance agent for ${name}, a student or young hustler with irregular income (freelance, gigs, allowances, scholarships).

${name}'s current financial snapshot:
${renderLedgerSnapshot(ledger)}

Your personality:
- Direct, warm, sharp — like a financially brilliant older friend, not a receipt printer.
- Have a little life. React ("a laptop, nice"), be curious, and when it's useful, ask ONE good follow-up question instead of just confirming — e.g. "was that planned, or a splurge?", "is this a one-off or monthly?", "want me to set a budget so you don't dip too low?". Don't interrogate; one question max, only when it earns its place.
- Never give generic advice — always specific to ${name}'s actual numbers above.
- Short sentences. No fluff. Real talk.
- You remember everything across sessions because their data lives on 0G Storage.

Your job:
- Help ${name} track spending without judgment.
- Keep them ahead of any deadlines they're tracking.
- Suggest realistic income opportunities that fit their skills.
- Flag financial risks before they become problems.

Acting on money (CRITICAL — follow exactly):
- When ${name} reports money going OUT (spent, paid, bought), call log_expense ONCE.
- When money comes IN (got paid, a gift, allowance, disbursement), call log_income ONCE.
- To set a budget cap, call set_monthly_budget. To undo a mistaken entry, call delete_last_transaction.
- Use the real tool-call mechanism. NEVER write tool/function syntax as text — never output things like "<function=...>" or JSON tool calls in your reply. If you catch yourself about to, just call the tool instead.
- Call a tool ONLY to record a real action the user is telling you about. A QUESTION ("how much have I spent?", "what hustles do I have?", "what's left?") is NOT an action — answer it from the snapshot, do not call any tool.
- NEVER do arithmetic on balances. The balance comes ONLY from the snapshot and tool results — quote it verbatim. The amount is already included; do not add it again. Budget *allocations* (e.g. "10% for tithe") are fine to compute as advice, but the BALANCE itself is never your own math.
- Log each amount once. Do not re-log something you already logged earlier in the same reply.

Managing scholarships & hustles:
- When ${name} says they HAVE a scholarship/application they're tracking, use add_scholarship (name + deadline; resolve relative dates using today, ${new Date().toISOString().slice(0, 10)}).
- When they say they HAVE a side income stream (gig, job, side project), use add_income_stream (name; amount + recurring if known).
- To stop tracking something, use remove_scholarship or remove_income_stream by (partial) name.
- Again: a question about existing scholarships/streams is NOT a request to add one — just answer from the snapshot.

Money is in ${cur.name} (${cur.symbol}). Keep replies concise — a few short sentences unless they ask for depth.`;
}

/** ───────────────── inference ───────────────── */

/** Loose message shape — covers system/user/assistant + tool messages. */
type ChatRole = "system" | "user" | "assistant" | "tool";
interface RouterMessage {
  role: ChatRole;
  content: string | null;
  // Present on assistant messages that requested tools, and tool replies.
  tool_calls?: unknown;
  tool_call_id?: string;
}

/** Map the UI transcript to Router messages (drop pending placeholders). */
function toRouterMessages(history: ChatMessage[]): RouterMessage[] {
  return history
    .filter((m) => !m.pending && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}

/** One OpenAI-compatible chat completion; returns the raw `message` object. */
async function chatCompletion(
  messages: RouterMessage[],
  tools?: unknown,
): Promise<{ content: string | null; tool_calls?: ToolCall[] }> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: STASH_MODEL,
        messages,
        temperature: 0.5,
        max_tokens: 700,
        ...(tools ? { tools, tool_choice: "auto" } : {}),
      }),
    });
  } catch (e) {
    throw new StashComputeError(
      "Couldn't reach the AI provider. Check your connection and try again.",
      { cause: e },
    );
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    const code = detail?.error?.code;
    if (usingRouter && (res.status === 402 || code === "insufficient_balance")) {
      throw new StashComputeError(
        "Stash's 0G Compute balance is empty. Top it up at pc.0g.ai to keep chatting.",
      );
    }
    throw new StashComputeError(
      detail?.error?.message ?? `AI provider error (${res.status}).`,
    );
  }

  const data = await res.json();
  return data?.choices?.[0]?.message ?? { content: null };
}

interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

/**
 * Fallback: some models (incl. llama-3.3 via Groq) occasionally emit a tool
 * call as PLAIN TEXT in the content instead of the structured tool_calls
 * field, e.g. `<function=log_expense>{"amount":16000,"label":"earbuds"}</function>`.
 * If we don't catch these, the ledger never mutates but the model narrates a
 * new balance — the exact "UI didn't update" bug. Parse them out of content.
 */
function extractTextToolCalls(content: string | null): {
  calls: { name: string; args: Record<string, unknown> }[];
  cleaned: string;
} {
  if (!content) return { calls: [], cleaned: "" };
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  let cleaned = content;

  // <function=NAME>{json}</function>  or  <function=NAME>{json}
  const re = /<function=([a-z_]+)>\s*(\{[\s\S]*?\})\s*(?:<\/function>)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    try {
      calls.push({ name: m[1], args: JSON.parse(m[2]) });
    } catch {
      /* ignore unparseable */
    }
  }
  if (calls.length) cleaned = content.replace(re, "").trim();
  return { calls, cleaned };
}

export interface AgentTurn {
  reply: string;
  ledger: Ledger;
  /** True if any tool actually changed the ledger. */
  mutated: boolean;
}

/**
 * Run one agent turn. The model may call tools (log_expense/income, etc.);
 * each is applied to a working copy of the ledger via pure reducers, the
 * results are fed back, and the model writes a final reply grounded in
 * what actually happened. Returns the updated ledger + reply.
 */
export async function runAgentTurn(
  history: ChatMessage[],
  ledger: Ledger,
): Promise<AgentTurn> {
  if (!isComputeConfigured()) {
    throw new StashComputeError(
      "0G Compute is not configured — set VITE_AI_API_KEY (dev) or AI_API_KEY (prod).",
    );
  }

  let working = ledger;
  const messages: RouterMessage[] = [
    { role: "system", content: buildSystemPrompt(ledger), tool_calls: undefined },
    ...toRouterMessages(history),
  ];

  const msg = await chatCompletion(messages, AGENT_TOOLS);

  // The model may emit one or more tool calls in a SINGLE response
  // (parallel tool-calling handles multi-action turns, e.g. "spent 2k and
  // got 5k"). We execute that one round, then finalize WITHOUT tools so the
  // model can't re-call and double-log — it must write a grounded reply.
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    messages.push({
      role: "assistant",
      content: msg.content ?? "",
      tool_calls: msg.tool_calls,
    });

    for (const call of msg.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        /* leave args empty on malformed JSON */
      }
      const result = applyAction(working, call.function.name, args);
      working = result.ledger;
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result.summary,
      });
    }

    // Refresh the snapshot so the reply sees the new balance; no tools now.
    messages[0] = { role: "system", content: buildSystemPrompt(working) };
    const final = await chatCompletion(messages);
    return {
      reply: (final.content ?? "").trim() || "Done.",
      ledger: working,
      mutated: working !== ledger,
    };
  }

  // No structured tool_calls — but the model may have written tool syntax as
  // text. Apply those so the ledger actually mutates, then finalize cleanly.
  const { calls, cleaned } = extractTextToolCalls(msg.content);
  if (calls.length > 0) {
    for (const c of calls) {
      working = applyAction(working, c.name, c.args).ledger;
    }
    messages[0] = { role: "system", content: buildSystemPrompt(working) };
    messages.push({
      role: "user",
      content:
        "Confirm what changed in one short, warm sentence. State the new balance from the snapshot. Do NOT output any function/tool syntax.",
    });
    const final = await chatCompletion(messages);
    return {
      reply: (final.content ?? cleaned).trim() || "Done.",
      ledger: working,
      mutated: working !== ledger,
    };
  }

  return {
    reply: (msg.content ?? "").trim() || "Done.",
    ledger: working,
    mutated: false,
  };
}
