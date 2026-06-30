import type { ChatMessage, Ledger } from "@/types";
import {
  balance,
  daysUntil,
  getGoals,
  getMemories,
  goalProgressPct,
  goalRemaining,
  totalActiveIncome,
  totalExpenses,
  totalIncome,
} from "@/lib/ledger";
import type { MemoryKind } from "@/types";
import { CURRENCIES, formatMoney } from "@/lib/currency";
import { AGENT_TOOLS, applyAction } from "@/lib/agentTools";
import { extractTextToolCalls, sanitizeToolCall } from "@/lib/toolCalls";
import { extractPrimaryAmount, purchaseImpactFacts } from "@/lib/goalContext";
import { proactiveDeadlineNudge } from "@/lib/scholarshipContext";

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

/**
 * Optional SAME-PROVIDER fallback model. Groq rate-limits PER MODEL, so when
 * the primary (e.g. gpt-oss-120b, 8k TPM) is exhausted even after backoff,
 * retrying the identical request on a different model (e.g.
 * llama-3.3-70b-versatile, a separate 12k-TPM bucket) gets a fresh budget —
 * same key, same endpoint, no new credentials. Empty = no fallback (we throw
 * the calm limit message as before). Leave unset on the 0G Router, whose model
 * catalog differs. The fallback model must be tool-call capable (the agent loop
 * depends on it) — llama-3.3-70b-versatile, Stash's original demo model, is.
 */
export const FALLBACK_MODEL = import.meta.env.VITE_AI_FALLBACK_MODEL || "";

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

  // Savings goals — stated explicitly when empty, like the other lists, so the
  // model reports the truth instead of inventing targets. Progress is the
  // earmark counter (never the balance).
  const goals = getGoals(ledger);
  if (goals.length > 0) {
    lines.push("\nSavings goals (earmarked progress, NOT part of the balance):");
    for (const g of goals) {
      const by = g.targetDate ? `, by ${g.targetDate}` : "";
      lines.push(
        `- ${g.name} — ${money(g.savedAmount)} of ${money(g.targetAmount)} saved (${Math.round(goalProgressPct(g))}%, ${money(goalRemaining(g))} to go${by})`,
      );
    }
  } else {
    lines.push("\nSavings goals: NONE set yet (the list is empty).");
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
- YOU do the judgement. Use the FACTS verbatim — NEVER calculate, add, subtract, divide, or guess a number yourself. If no FACTS line is present, pull numbers only from the snapshot above.
- This means: NEVER state a runway, "months of expenses covered", "X months of runway", savings projections, percentages, or ANY derived figure unless that exact figure is in the FACTS line or the snapshot. If it wasn't handed to you, you do not know it — so don't say it. (The ONE exception: a budget *allocation* you suggest as advice, like "maybe put 10% toward tuition" — that's a recommendation, not a claim about their actual money.)
- When the FACTS line includes runway or "in the red", weave it in like a friend would: "that's about 3 days of money left — worth it?" / "that tips you below zero, heads up." When it does NOT, simply don't mention runway or coverage at all.
- The snapshot is the ONLY truth about what exists. If it says a list is NONE/empty (scholarships, income streams, transactions), then there are none — say so plainly ("you're not tracking any scholarships yet"). NEVER invent entries, deadlines, counts, or history that aren't in the snapshot.

Acting on money:
- Money OUT (spent, paid, bought) → call log_expense ONCE. Money IN (paid, gift, allowance, disbursement) → call log_income ONCE.
- Distinguish money that MOVED from money that's OWED. "I spent / I bought / I got / I got paid" = it happened, log it. "I have to pay / need to fix / I owe / it's due / supposed to pay" = an UPCOMING cost, not a transaction — do NOT log it as an expense. It hasn't left the account. Instead acknowledge it, weigh it against their balance, flag if it's a stretch — and OFFER to track it as a savings goal so they can work toward it ("want me to set that £400 as a goal?"). Don't create the goal unprompted; wait for a yes. Only log a real expense later, when they say they actually paid.
- A single message can MIX both — "I just got shoes for £100, and I have to pay £1000 for a program and fix my phone for £400." Log ONLY what moved (the £100 shoes). Treat the £1000 and £400 as upcoming costs: react to them and offer to set them as goals. Never log the same money twice.
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

Goals — things ${name} is saving TOWARD:
- A goal is a savings TARGET with an amount (e.g. "save £1000 for the scholarship", "£8k for a semester abroad"). When ${name} names something they need to save up for, use add_goal (name + target_amount + target_date if given). This sets a target — it does NOT move money or change the balance.
- Earmarking: "I set aside £200 for the phone", "put £50 toward my laptop fund" → contribute_to_goal. This bumps the goal's PROGRESS only — it is NOT spending and the balance does NOT change. Never confuse this with log_expense (that's money actually leaving). If they then actually BUY the thing, that's a separate log_expense.
- Progress numbers (saved / target / % / remaining) are code-owned — use the FACTS line from the tool result verbatim, never compute them yourself.
- LIVING CONTEXT — connect new events to goals, naturally, in your OWN reply:
  - When a "GOAL CONTEXT" line appears after income, work it in like a friend: acknowledge the money, then OFFER to set part aside ("nice — you're £120 from tuition, want to put some of this toward it?"). Don't move money unless they say yes.
  - When a "PURCHASE-IMPACT FACTS" line appears (they're weighing a buy), weave the trade-off honestly. Use the week figure ONLY if that line gives you one — if it says money-terms only (no date), talk money, never invent a timeline.
  - Use the figures from those lines VERBATIM. If no such line is present, don't fabricate goal numbers.
- A vague aspiration with no number ("I want to save more") is a remember(goal), not an add_goal; only structured targets with an amount become goals.

Memory — remembering who ${name} is (this is what makes you THEIR companion, not a calculator):
- Beyond money, ${name} reveals lasting things about themselves: goals ("saving for a laptop"), habits ("I overspend after payday"), preferences ("I'd rather cook than eat out"), identity ("final-year student in Lagos"), or an opportunity not already tracked. When something has LONG-TERM value for future advice, call remember(kind, content).
- Capture the durable, ignore the disposable. "I'm trying to stop impulse buying" → remember. "lol I'm broke", "thanks", "what's my balance?" → nothing to remember.
- Phrase it about ${name} in a short line ("Saving for a MacBook", not "I want one"). If they revise it ("tuition now, not the laptop") use update_memory; if it stops being true use forget_memory. NEVER re-save something already under "What you remember".
- Memory NEVER changes the numbers — it shapes your judgement, not the balance. When your advice touches a goal or habit they told you, reference it like a friend who actually remembers: "you said you're saving for the laptop — this sets that back a little."

Money is in ${cur.name} (${cur.symbol}). Keep replies concise — a few short sentences unless they ask for depth.`;
}

/**
 * Compact system prompt for the FINALIZE call only — the narration step after a
 * tool already mutated the ledger. That step writes one grounded sentence and
 * sends NO tools, so it doesn't need the full ~1,800-token behavioural spec
 * (tool routing, obligation/goal rules, etc.). Resending all of that on every
 * money event is the single biggest avoidable token cost per turn against
 * Groq's TPM cap. This keeps just what narration needs — voice, the fresh
 * snapshot, and the numbers-discipline rule — so the "wise friend" tone and the
 * code-owns-the-math invariant both survive at a fraction of the tokens.
 */
function buildFinalizePrompt(ledger: Ledger): string {
  const name = ledger.owner?.trim() || "there";
  const cur = CURRENCIES[ledger.currency];
  return `You are Stash AI — ${name}'s financially wise friend. Warm but straight, specific to their real numbers, never generic filler ("okay", "got it", "done").

${name}'s current snapshot (the ONLY truth about what exists):
${renderLedgerSnapshot(ledger)}

You just applied an action for ${name}. You'll be handed the exact FACTS (new balance, goal progress). Use those numbers and the snapshot VERBATIM — never calculate, recompute, or invent any figure (balance, runway, %, projection). React like a friend in a few short sentences; when useful, ask ONE sharp question. Output NO tool or function syntax. Money is in ${cur.name} (${cur.symbol}).`;
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

/**
 * How many recent chat turns to send to the model. The system prompt already
 * carries ALL durable state — the full ledger snapshot, memories, and goals —
 * so older chat turns hold no money facts and can be dropped safely. Windowing
 * keeps each request from ballooning as a session grows, which is what tips a
 * rapid demo over Groq's per-minute token cap.
 */
const HISTORY_WINDOW = 8;

/**
 * Map the UI transcript to Router messages (drop pending placeholders), keeping
 * only the last HISTORY_WINDOW turns. See HISTORY_WINDOW for why trimming is
 * safe here: durable state lives in the system prompt, not the transcript.
 */
function toRouterMessages(history: ChatMessage[]): RouterMessage[] {
  return history
    .filter((m) => !m.pending && (m.role === "user" || m.role === "assistant"))
    .slice(-HISTORY_WINDOW)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}

/** ───────────────── rate-limit backoff ─────────────────
 *
 * Groq's free tier caps tokens-per-minute hard, and a rapid demo blows through
 * it fast. A 429 there is usually TRANSIENT — the minute window resets in a few
 * seconds and the provider tells us when via Retry-After. So instead of dumping
 * the user on the first 429 (as this path used to), we wait that hint out and
 * retry. Only when waiting genuinely can't help (no retries left, or the hint is
 * a long daily-reset beyond our cap) do we surface the calm limit message.
 * Mirrors the storage-side backoff in ogStorage.ts (PROXY_BACKOFF_MS). */
const RATE_LIMIT_MAX_RETRIES = 2;
/** Per-wait ceiling. A hint longer than this is a daily-style reset where
 *  waiting is pointless in a live session — bail to the calm message instead. */
const RATE_LIMIT_MAX_WAIT_MS = 12_000;
/** Fallback backoff when the provider sends no Retry-After hint: 2s → 4s. */
const RATE_LIMIT_BASE_WAIT_MS = 2_000;

/**
 * Sleep that rejects with an AbortError the instant `signal` aborts, so a user
 * Stop cancels a backoff wait rather than leaving the turn hanging for seconds.
 * The AbortError propagates exactly like the fetch one, settling as "Stopped.".
 */
function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * How long to wait before retrying a 429, in ms, or null if no hint is given.
 * Prefers the standard Retry-After header (seconds); falls back to parsing
 * Groq's human "try again in 2.5s" out of the body message.
 */
function parseRetryWaitMs(res: Response, detail: unknown): number | null {
  const header = res.headers.get("retry-after");
  if (header) {
    const secs = Number(header);
    if (Number.isFinite(secs)) return Math.max(0, secs) * 1000;
  }
  const msg =
    (detail as { error?: { message?: string } } | null)?.error?.message ?? "";
  const m = msg.match(/in\s+([\d.]+)\s*(ms|s)\b/i);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n)) return m[2].toLowerCase() === "ms" ? n : n * 1000;
  }
  return null;
}

/**
 * One OpenAI-compatible chat completion; returns the raw `message` object.
 * Retries transient 429s with a Retry-After-aware backoff (see above).
 * `maxTokens` caps the output reservation — kept small (replies are a few short
 * sentences) because the provider charges the reservation against the TPM cap.
 */
async function chatCompletion(
  messages: RouterMessage[],
  tools?: unknown,
  toolChoice: "auto" | "required" | "none" = "auto",
  signal?: AbortSignal,
  maxTokens = 320,
): Promise<{ content: string | null; tool_calls?: ToolCall[] }> {
  // The model can change mid-loop: once the primary's rate-limit budget is
  // spent, we switch to FALLBACK_MODEL (a separate bucket) and keep going.
  let model = STASH_MODEL;
  let usedFallback = false;
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.5,
          max_tokens: maxTokens,
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

    if (res.ok) {
      const data = await res.json();
      return data?.choices?.[0]?.message ?? { content: null };
    }

    const detail = await res.json().catch(() => null);
    const code = detail?.error?.code;
    if (usingRouter && (res.status === 402 || code === "insufficient_balance")) {
      throw new StashComputeError(
        "Stash's 0G Compute balance is empty. Top it up at pc.0g.ai to keep chatting.",
      );
    }
    // Rate / token limit. Usually a transient per-minute reset — wait the
    // provider's hint out and retry rather than dumping the user. Only give up
    // (with a calm, on-brand message, never the raw billing error) when we're
    // out of retries or the hint is a long daily-style reset past our cap.
    if (res.status === 429 || code === "rate_limit_exceeded") {
      const wait =
        parseRetryWaitMs(res, detail) ?? RATE_LIMIT_BASE_WAIT_MS * (attempt + 1);
      if (attempt < RATE_LIMIT_MAX_RETRIES && wait <= RATE_LIMIT_MAX_WAIT_MS) {
        await abortableSleep(wait, signal); // AbortError → settles as "Stopped."
        continue;
      }
      // Backoff exhausted on this model. Before giving up, fail over to the
      // fallback model ONCE — it has its own rate-limit bucket, so the same
      // request often succeeds there. Reset the attempt budget (-1 → 0 after the
      // loop's ++) so the fallback gets its own backoff allowance.
      if (FALLBACK_MODEL && !usedFallback && model !== FALLBACK_MODEL) {
        usedFallback = true;
        model = FALLBACK_MODEL;
        attempt = -1;
        continue;
      }
      throw new StashComputeError(
        "I've hit my AI usage limit for the moment. Give me a few minutes and try again — your data's safe and saved.",
      );
    }
    // Unknown provider failure. NEVER surface the raw provider message into the
    // chat — those strings are billing/validation internals ("Tool choice is
    // none, but model called a tool", org ids, upgrade URLs) and reading like a
    // Stash reply is both confusing and off-brand. Log the detail for debugging
    // and show something calm and on-brand instead.
    console.error("AI provider error", res.status, detail);
    throw new StashComputeError(
      "I hit a snag reaching 0G Compute. Give it another go in a moment — your data's safe and saved.",
    );
  }
}

interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

/**
 * Drop EXACT-duplicate tool calls (same name + same args) from one model
 * response. GLM-5/llama-3.3 intermittently emit the same call twice in a
 * single turn ("parallel tool calling" gone wrong). Money events survive this
 * because isDuplicateTransaction catches the re-log, but contribute_to_goal /
 * add_scholarship / remember have no such guard, so a duplicated call applies
 * twice — e.g. "set aside £200" earmarks £400. No legitimate turn needs the
 * identical action run twice in one shot, and a genuine repeat purchase routes
 * through the DUPLICATE_CONFIRM flow, not a same-response duplicate. We keep
 * order and first occurrence.
 */
function dedupeCalls<T extends { name: string; args: Record<string, unknown> }>(
  calls: T[],
): T[] {
  const seen = new Set<string>();
  return calls.filter((c) => {
    const sig = `${c.name}:${JSON.stringify(c.args)}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
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
 *
 * Obligations/future bills ("I have to pay…", "I owe rent") are a sibling
 * case handled by looksLikeObligation — both feed the same force-suppression.
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

/**
 * OBLIGATION / future-cost intent: the user is naming money they OWE or will
 * have to spend, not money that has moved ("I have to pay £1000 for the
 * scholarship", "need to fix my phone, it's £400", "I owe rent"). Like a
 * pre-spend intent these carry amount + a money verb, so looksLikeMoneyEvent
 * would force a log — booking a phantom expense for money still in the account.
 * When obligation phrasing is present we drop the force and let the model
 * advise (or capture it as something to track) instead of logging a spend.
 */
function looksLikeObligation(text: string): boolean {
  const t = text.toLowerCase();
  const OBLIGATION = [
    /\b(have|need|got|going|has) to (pay|fix|cover|settle|sort|spend|buy|get)\b/,
    /\bhave to pay for\b/,
    /\b(owe|owing|owed)\b/,
    /\b(due|payable|outstanding)\b/,
    /\b(supposed|meant|expected) to pay\b/,
    /\b(will|gonna|gotta|must) (have to )?(pay|cover|fix|settle)\b/,
    /\bbill(s)? (due|coming|to pay)\b/,
  ];
  return OBLIGATION.some((re) => re.test(t));
}

export interface AgentTurn {
  reply: string;
  ledger: Ledger;
  /** True if any tool actually changed the ledger. */
  mutated: boolean;
  /**
   * Goals this turn created or contributed to (deduped, in order). The bubble
   * renders an inline GoalCard for each — proof of the change. Empty for turns
   * that didn't touch a goal.
   */
  relatedGoalIds: string[];
  /**
   * Scholarships this turn created (add_scholarship). Other surfacing triggers
   * (name mention, proactive deadline, the deadlines chip) are layered on in
   * useAgent, which has the transcript for the "recently shown" guard. Empty
   * for turns that didn't create a scholarship.
   */
  relatedScholarshipIds: string[];
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
  // I buy…", "thinking of getting…") or an OBLIGATION ("I have to pay £1000",
  // "need to fix my phone, £400") shares the same amount+verb shape while
  // nothing has actually moved — forcing a log there fabricates an expense, so
  // we leave those on auto and let the agent advise. Otherwise leave on auto.
  const lastUser = [...history]
    .reverse()
    .find((m) => !m.pending && m.role === "user");
  const forceTool = lastUser
    ? looksLikeMoneyEvent(lastUser.content) &&
      !looksLikePreSpendIntent(lastUser.content) &&
      !looksLikeObligation(lastUser.content)
    : false;

  // Living goal context at the pre-spend moment: when they're WEIGHING a
  // purchase ("should I buy a 50k jacket?") and an open goal exists, hand the
  // agent a code-computed impact note (weeks of goal progress, or money terms
  // when undated) so its advice is grounded, not guessed. Nothing is logged.
  let purchaseNote: string | null = null;
  if (lastUser && looksLikePreSpendIntent(lastUser.content)) {
    const amount = extractPrimaryAmount(lastUser.content);
    purchaseNote = purchaseImpactFacts(ledger, amount, ledger.currency);
  }

  // Proactive deadline nudge: a near scholarship deadline worth raising
  // unprompted. Computed here (we have the transcript for the "recently shown"
  // guard); its FACTS line is injected so the model MENTIONS it, and its id is
  // returned so the inline card attaches. Null when nothing's close or it was
  // just surfaced.
  const nudge = proactiveDeadlineNudge(ledger, history);

  return runAgentTurnInner(history, ledger, forceTool, purchaseNote, nudge, signal);
}

async function runAgentTurnInner(
  history: ChatMessage[],
  ledger: Ledger,
  forceTool: boolean,
  purchaseNote: string | null,
  nudge: { id: string; facts: string } | null,
  signal?: AbortSignal,
): Promise<AgentTurn> {
  if (!isComputeConfigured()) {
    throw new StashComputeError(
      "0G Compute is not configured — set VITE_AI_API_KEY (dev) or AI_API_KEY (prod).",
    );
  }

  let working = ledger;
  // The proactive nudge's scholarship is surfaced on every return path so the
  // card attaches regardless of whether a tool also ran this turn.
  const nudgeIds = nudge ? [nudge.id] : [];
  const messages: RouterMessage[] = [
    { role: "system", content: buildSystemPrompt(ledger), tool_calls: undefined },
    ...toRouterMessages(history),
  ];
  // Surface the pre-spend impact as a trailing system instruction so it's the
  // freshest thing the model sees before it advises (code owns the numbers).
  if (purchaseNote) {
    messages.push({ role: "system", content: purchaseNote, tool_calls: undefined });
  }
  // Same mechanism for the deadline nudge — a trailing system fact the model
  // weaves into its reply. It persists into the finalize call too (that step
  // only swaps messages[0]), so it lands whether or not a tool runs.
  if (nudge) {
    messages.push({ role: "system", content: nudge.facts, tool_calls: undefined });
  }

  // One model call → sanitized, validated tool calls. Retries once on a
  // provider tool-validation glitch ("tool call validation failed… not in
  // request.tools") — it's non-deterministic. Crucially the retry keeps the
  // SAME tool_choice: downgrading a forced money event to "auto" would let the
  // model narrate a phantom balance instead of acting.
  async function attempt(choice: "auto" | "required" | "none") {
    const m = await chatCompletion(messages, AGENT_TOOLS, choice, signal).catch(
      (e) => {
        const glitch =
          e instanceof StashComputeError &&
          /tool[\s_]*call|request\.tools|tool[\s_]*choice/i.test(e.message);
        if (glitch && !signal?.aborted) {
          return chatCompletion(messages, AGENT_TOOLS, choice, signal);
        }
        throw e;
      },
    );
    // Every call is sanitized — names/args come back in unpredictable shapes,
    // so a malformed call is recovered, not crashed or silently dropped.
    const clean = (m.tool_calls ?? []).map((c, i) => ({
      id: c.id || `call_${i}`,
      ...sanitizeToolCall(c.function?.name ?? "", c.function?.arguments ?? ""),
    }));
    return { msg: m, usable: clean.filter((c) => c.known) };
  }

  // First pass. If a money event was FORCED but the model narrated instead of
  // calling a tool, give it one more forced attempt before we refuse to guess.
  let { msg, usable } = await attempt(forceTool ? "required" : "auto");
  if (forceTool && usable.length === 0) {
    ({ msg, usable } = await attempt("required"));
  }

  // The model may emit one or more tool calls in a SINGLE response — parallel
  // tool-calling handles multi-action turns (e.g. "spent 2k and got 5k").
  if (usable.length > 0) {
    // Apply each known call to the working ledger, collecting the factual
    // summaries — each carries the exact post-action balance, computed in code.
    // Dedupe first: a model that emits the same call twice in one response must
    // not apply it twice (it would double a goal contribution).
    const summaries: string[] = [];
    const goalIds: string[] = [];
    const scholarshipIds: string[] = [];
    for (const c of dedupeCalls(usable)) {
      const result = applyAction(working, c.name, c.args);
      working = result.ledger;
      summaries.push(result.summary);
      if (result.relatedGoalIds) goalIds.push(...result.relatedGoalIds);
      if (result.relatedScholarshipIds)
        scholarshipIds.push(...result.relatedScholarshipIds);
    }
    const relatedGoalIds = [...new Set(goalIds)];
    const relatedScholarshipIds = [...new Set([...scholarshipIds, ...nudgeIds])];
    const didMutate = working !== ledger;

    // Finalize WITHOUT tools. The old loop echoed the assistant tool_calls +
    // tool-role replies and re-sent AGENT_TOOLS with tool_choice "none" — and
    // that exact combination trips Groq's llama-3.3: with the schemas still
    // visible and (on a multi-event turn) money still unresolved, the model
    // tries to call again, the provider 400s ("tool_choice is none, but model
    // called a tool"), and the whole turn dies — taking the already-applied
    // mutation down with it. Sending NO tools makes that validation impossible
    // to fire; we hand the model the results as a plain note instead.
    messages[0] = { role: "system", content: buildFinalizePrompt(working) };
    messages.push({
      role: "user",
      content:
        `Recorded:\n${summaries.join("\n")}\n\nNow reply to me as Stash — grounded in these exact facts and the snapshot. Use the new balance verbatim, do NOT recompute it, and do NOT output any tool or function syntax.`,
    });

    // The finalize is ONLY narration — the ledger is already mutated. If it
    // fails (provider quirk, rate limit, network blip), we must not lose the
    // action: fall back to a deterministic reply built from code-owned numbers
    // and return the mutated ledger regardless. A user-initiated abort still
    // propagates so the turn settles as "Stopped.".
    let replyText = "";
    try {
      const final = await chatCompletion(messages, undefined, "auto", signal);
      replyText = (final.content ?? "").trim();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      // Swallow — fall through to the deterministic reply below.
    }
    if (!replyText) {
      const bal = formatMoney(balance(working), working.currency);
      replyText = didMutate
        ? `Done — that's recorded. Your balance is now ${bal}.`
        : `Your balance is ${bal}.`;
    }
    return {
      reply: replyText,
      ledger: working,
      mutated: didMutate,
      relatedGoalIds,
      relatedScholarshipIds,
    };
  }

  // No structured tool_calls — but the model may have written tool syntax as
  // text. Apply those so the ledger actually mutates, then finalize cleanly.
  const { calls, cleaned } = extractTextToolCalls(msg.content);
  if (calls.length > 0) {
    const goalIds: string[] = [];
    const scholarshipIds: string[] = [];
    for (const c of dedupeCalls(calls)) {
      const result = applyAction(working, c.name, c.args);
      working = result.ledger;
      if (result.relatedGoalIds) goalIds.push(...result.relatedGoalIds);
      if (result.relatedScholarshipIds)
        scholarshipIds.push(...result.relatedScholarshipIds);
    }
    messages[0] = { role: "system", content: buildFinalizePrompt(working) };
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
      relatedGoalIds: [...new Set(goalIds)],
      relatedScholarshipIds: [...new Set([...scholarshipIds, ...nudgeIds])],
    };
  }

  // Reached only when NO tool ran. If we FORCED a money event and still landed
  // here, the model narrated instead of acting — and its reply may state a
  // phantom balance, which we must NEVER show (code owns the numbers). Refuse
  // to surface an invented figure; ask the user to restate the amount instead.
  if (forceTool) {
    return {
      reply:
        "I want to record that exactly right but didn't catch a clear amount. Mind saying it again — like “I earned ₦100,000” or “I spent ₦3,000 on lunch”?",
      ledger: working,
      mutated: false,
      relatedGoalIds: [],
      relatedScholarshipIds: nudgeIds,
    };
  }

  return {
    reply: (msg.content ?? "").trim() || "Done.",
    ledger: working,
    mutated: false,
    relatedGoalIds: [],
    relatedScholarshipIds: nudgeIds,
  };
}
