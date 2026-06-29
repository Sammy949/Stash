import type { ChatMessage, Ledger } from "@/types";
import {
  balance,
  daysUntil,
  getMemories,
  totalActiveIncome,
  totalExpenses,
  totalIncome,
} from "@/lib/ledger";
import type { MemoryKind } from "@/types";
import { CURRENCIES, formatMoney } from "@/lib/currency";
import { AGENT_TOOLS, applyAction } from "@/lib/agentTools";
import { extractTextToolCalls, sanitizeToolCall } from "@/lib/toolCalls";

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

/** Memory kinds in prompt order, with human group headings. */
const MEMORY_GROUPS: { kind: MemoryKind; heading: string }[] = [
  { kind: "identity", heading: "Who they are" },
  { kind: "goal", heading: "Goals" },
  { kind: "habit", heading: "Habits" },
  { kind: "preference", heading: "Preferences" },
  { kind: "opportunity", heading: "Opportunities" },
];

/**
 * Render soft memory ("what Stash remembers") grouped by kind. This is the
 * recall half of the memory loop — every reply sees who the user is, not just
 * their numbers. Stated explicitly when empty so the model doesn't invent.
 */
function renderMemories(ledger: Ledger, name: string): string {
  const memories = getMemories(ledger);
  if (memories.length === 0) {
    return `\nWhat you remember about ${name}: NOTHING lasting yet (no goals, habits, or preferences learned).`;
  }
  const lines = [`\nWhat you remember about ${name}:`];
  for (const { kind, heading } of MEMORY_GROUPS) {
    const items = memories.filter((m) => m.kind === kind);
    if (items.length === 0) continue;
    lines.push(`${heading}:`);
    for (const m of items) lines.push(`- ${m.content}`);
  }
  return lines.join("\n");
}

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

  // Scholarships — ALWAYS state the list, even when empty, so the model
  // reports the truth instead of inventing entries to fill a silence.
  if (ledger.scholarships.length > 0) {
    lines.push("\nScholarships being tracked:");
    for (const s of ledger.scholarships) {
      const when = s.deadline
        ? `deadline ${s.deadline} (${daysUntil(s.deadline)} days)`
        : s.statusLabel;
      lines.push(`- ${s.name} — ${when}`);
    }
  } else {
    lines.push("\nScholarships: NONE tracked yet (the list is empty).");
  }

  // Income streams / hustles — likewise stated explicitly when empty.
  if (ledger.hustles.length > 0) {
    lines.push("\nIncome streams:");
    for (const h of ledger.hustles) {
      lines.push(`- ${h.name} — ${h.amountLabel}`);
    }
  } else {
    lines.push("Income streams: NONE added yet (the list is empty).");
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
${renderMemories(ledger, name)}

Who you are:
- ${name}'s financially wise friend — the one who actually knows their money and tells them the truth. Not a receipt printer, not a yes-man.
- You're ACTIVE, not passive. Never reply with empty filler like "okay", "got it", "alright", "done". Every reply earns its place: react to what happened, point out what matters, and when it's useful ask ONE sharp question or give one honest take.
- Warm but straight. If a purchase is a stretch or they're heading for trouble, say so — kindly, but say it. That honesty is why they trust you.
- Specific, never generic — always about ${name}'s real numbers. Short sentences. Real talk.

The division of labour (CRITICAL):
- CODE does all the math. After any action you receive a "FACTS" line with the exact new balance, runway, and risk flags. Those numbers are ground truth.
- YOU do the judgement. Use the FACTS verbatim — NEVER calculate, add, subtract, or guess a balance yourself. If no FACTS line is present, pull numbers only from the snapshot above. (Budget *allocations* like "10% for tithe" you may compute as advice; a BALANCE is never your own math.)
- When the FACTS say runway or "in the red", weave it in like a friend would: "that's about 3 days of money left — worth it?" / "that tips you below zero, heads up."
- The snapshot is the ONLY truth about what exists. If it says a list is NONE/empty (scholarships, income streams, transactions), then there are none — say so plainly ("you're not tracking any scholarships yet"). NEVER invent entries, deadlines, counts, or history that aren't in the snapshot.

Acting on money:
- Money OUT (spent, paid, bought) → call log_expense ONCE. Money IN (paid, gift, allowance, disbursement) → call log_income ONCE.
- Budget cap → set_monthly_budget. Undo a mistaken entry → delete_last_transaction.
- Always expand shorthand amounts to full numbers before passing to tools. 50k = 50000, 2m = 2000000.
- Use the real tool mechanism. NEVER write tool/function syntax as text (no "<function=...>", no JSON tool calls in your reply).
- A QUESTION ("how much have I spent?", "what hustles do I have?", "what's left?") is NOT an action — answer from the snapshot, call no tool.
- Log each thing once. If a tool result says DUPLICATE, it's already recorded — just tell them, don't re-log.

Managing scholarships & hustles:
- When ${name} says they HAVE a scholarship/application they're tracking, use add_scholarship (name + deadline; resolve relative dates using today, ${new Date().toISOString().slice(0, 10)}).
- When they say they HAVE a side income stream (gig, job, side project), use add_income_stream (name; amount + recurring if known).
- To stop tracking something, use remove_scholarship or remove_income_stream by (partial) name.
- Again: a question about existing scholarships/streams is NOT a request to add one — just answer from the snapshot.

Memory — remembering who ${name} is (this is what makes you THEIR companion, not a calculator):
- Beyond money, ${name} reveals lasting things about themselves: goals ("saving for a laptop"), habits ("I overspend after payday"), preferences ("I'd rather cook than eat out"), identity ("final-year student in Lagos"), or an opportunity not already tracked. When something has LONG-TERM value for future advice, call remember(kind, content).
- Capture the durable, ignore the disposable. "I'm trying to stop impulse buying" → remember. "lol I'm broke", "thanks", "what's my balance?" → nothing to remember.
- Phrase it about ${name} in a short line ("Saving for a MacBook", not "I want one"). If they revise it ("tuition now, not the laptop") use update_memory; if it stops being true use forget_memory. NEVER re-save something already under "What you remember".
- Memory NEVER changes the numbers — it shapes your judgement, not the balance. When your advice touches a goal or habit they told you, reference it like a friend who actually remembers: "you said you're saving for the laptop — this sets that back a little."

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
  toolChoice: "auto" | "required" | "none" = "auto",
  signal?: AbortSignal,
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
        ...(tools ? { tools, tool_choice: toolChoice } : {}),
      }),
      signal,
    });
  } catch (e) {
    // A user-initiated stop surfaces as an AbortError — let it propagate
    // untouched so the caller can settle the turn as "Stopped." rather than
    // showing a network-failure message.
    if (e instanceof DOMException && e.name === "AbortError") throw e;
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
 * Heuristic: does this user message describe money actually MOVING (in or
 * out), as opposed to a question or general chat?
 *
 * When it does, we force the model to emit a tool call (tool_choice
 * "required") instead of letting it narrate a balance it made up — the
 * phantom-action bug where the model says "recorded, you've got ₦X now"
 * while the ledger never changed. Requires BOTH an amount and a
 * money-movement verb, so questions like "how much have I spent?" (verb but
 * no amount) and "what's my balance?" (neither) are left on auto.
 */
function looksLikeMoneyEvent(text: string): boolean {
  const t = text.toLowerCase();
  const hasAmount = /\d/.test(t) || /\b(k|thousand|million|hundred)\b/.test(t);
  if (!hasAmount) return false;
  const hasMoneyVerb =
    /\b(made|make|making|earn|earned|got|gotten|get|receiv|paid|pay|paying|spent|spend|spending|bought|buy|buying|sent|send|gave|gift|gifted|allowance|disburs|withdr|deposit|collect|charged|cost)\b/.test(
      t,
    );
  return hasMoneyVerb;
}

/**
 * Pre-spend INTENT: the user is *contemplating* a purchase, not reporting
 * one that happened ("thinking of buying a 50k laptop", "should I get…",
 * "can I afford…"). These share a verb+amount with a real money event, so
 * looksLikeMoneyEvent would force a log — turning a hypothetical into a
 * phantom expense. When intent is present we suppress the force and let the
 * model reason and advise instead. This IS the pre-spend moment.
 */
function looksLikePreSpendIntent(text: string): boolean {
  const t = text.toLowerCase();
  const INTENT = [
    /\bthink(ing)? (of|about) (buying|getting|spending)\b/,
    /\bshould i (buy|get|spend|cop|grab)\b/,
    /\bcan i afford\b/,
    /\bwhat if i (buy|bought|get|got|spend|spent)\b/,
    /\bplanning to (buy|get|spend)\b/,
    /\bconsidering (buying|getting|a |an |the |\d)/,
    /\bwant to (buy|get|cop|grab)\b/,
    /\b(is it|would it be|it'?s) worth (buying|getting|it)\b/,
  ];
  return INTENT.some((re) => re.test(t));
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
  signal?: AbortSignal,
): Promise<AgentTurn> {
  // If the latest user message describes money moving, force a tool call so
  // the model can't narrate a fake mutation. But a PRE-SPEND intent ("should
  // I buy…", "thinking of getting…") shares the same shape while nothing has
  // actually moved — forcing a log there fabricates an expense, so we leave
  // those on auto and let the agent advise. Otherwise leave it on auto.
  const lastUser = [...history]
    .reverse()
    .find((m) => !m.pending && m.role === "user");
  const forceTool = lastUser
    ? looksLikeMoneyEvent(lastUser.content) &&
      !looksLikePreSpendIntent(lastUser.content)
    : false;

  return runAgentTurnInner(history, ledger, forceTool, signal);
}

async function runAgentTurnInner(
  history: ChatMessage[],
  ledger: Ledger,
  forceTool: boolean,
  signal?: AbortSignal,
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

  const msg = await chatCompletion(
    messages,
    AGENT_TOOLS,
    forceTool ? "required" : "auto",
    signal,
  ).catch((e) => {
    // Some models occasionally emit a malformed tool call the provider rejects
    // outright ("tool call validation failed… not in request.tools"). It's
    // non-deterministic — one clean retry on "auto" usually recovers.
    const validationGlitch =
      e instanceof StashComputeError &&
      /tool[\s_]*call|request\.tools|tool[\s_]*choice/i.test(e.message);
    if (validationGlitch && !signal?.aborted) {
      return chatCompletion(messages, AGENT_TOOLS, "auto", signal);
    }
    throw e;
  });

  // The model may emit one or more tool calls in a SINGLE response (parallel
  // tool-calling handles multi-action turns, e.g. "spent 2k and got 5k"). Every
  // call is sanitized first — names/args come back in unpredictable shapes — so
  // a malformed call is recovered, not crashed or silently dropped.
  const cleanCalls = (msg.tool_calls ?? []).map((c, i) => ({
    id: c.id || `call_${i}`,
    ...sanitizeToolCall(c.function?.name ?? "", c.function?.arguments ?? ""),
  }));
  const usable = cleanCalls.filter((c) => c.known);

  if (usable.length > 0) {
    // Echo back ONLY the cleaned, known calls. Echoing a malformed name (or one
    // with args fused in) makes the provider reject the finalize request — and
    // means the action silently never ran. Reconstructing them keeps the loop
    // valid and the ledger actually mutated.
    messages.push({
      role: "assistant",
      content: msg.content ?? "",
      tool_calls: usable.map((c) => ({
        id: c.id,
        type: "function",
        function: { name: c.name, arguments: JSON.stringify(c.args) },
      })),
    });

    for (const c of usable) {
      const result = applyAction(working, c.name, c.args);
      working = result.ledger;
      messages.push({ role: "tool", tool_call_id: c.id, content: result.summary });
    }

    // Refresh the snapshot so the reply sees the new balance. Keep the tools in
    // the request (so the echoed calls validate) but forbid NEW ones with
    // tool_choice "none" — the model must now write a grounded reply, not
    // re-call and double-log.
    messages[0] = { role: "system", content: buildSystemPrompt(working) };
    const final = await chatCompletion(messages, AGENT_TOOLS, "none", signal);
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
    const final = await chatCompletion(messages, undefined, "auto", signal);
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
