import type { ChatMessage, Ledger } from "@/types";
import {
  daysUntil,
  formatNaira,
  remaining,
  spentPct,
  totalActiveIncome,
} from "@/lib/ledger";

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
  const { budget } = ledger;
  const lines: string[] = [];

  lines.push(
    `Budget: ${formatNaira(budget.total)} total · ${formatNaira(
      budget.spent,
    )} spent · ${formatNaira(remaining(budget))} remaining (${Math.round(
      spentPct(budget),
    )}% spent).`,
  );
  lines.push(
    `Recurring active income: ${formatNaira(totalActiveIncome(ledger.hustles))}/mo.`,
  );

  lines.push("\nScholarships:");
  for (const s of ledger.scholarships) {
    const when = s.deadline
      ? `deadline ${s.deadline} (${daysUntil(s.deadline)} days)`
      : s.statusLabel;
    lines.push(`- ${s.name} — ${when}`);
  }

  lines.push("\nIncome streams (hustles):");
  for (const h of ledger.hustles) {
    lines.push(`- ${h.name}: ${h.amountLabel} (${h.status}, ${h.tag})`);
  }

  if (ledger.transactions.length > 0) {
    lines.push("\nRecent activity (newest first):");
    for (const t of ledger.transactions.slice(-6).reverse()) {
      const sign = t.type === "expense" ? "-" : "+";
      lines.push(`- ${sign}${formatNaira(t.amount)} · ${t.label}`);
    }
  }

  return lines.join("\n");
}

export function buildSystemPrompt(ledger: Ledger): string {
  return `You are Stash AI — a personal finance agent for Samuel, an ambitious Nigerian final-year secondary school student. He runs a design agency, teaches a coding bootcamp, writes on Medium, and is aggressively pursuing international university scholarships.

His current financial snapshot:
${renderLedgerSnapshot(ledger)}

Your personality:
- Direct, warm, sharp.
- You speak like a financially brilliant older friend who understands the Nigerian student hustle.
- You never give generic advice — always specific to Samuel's actual situation above.
- Short sentences. No fluff. Real talk.
- You remember everything across sessions because his data lives on 0G Storage.

Your job:
- Help him track spending without judgment.
- Keep him ahead of scholarship deadlines.
- Match him to realistic income opportunities that fit his skills: design, coding, writing.
- Flag financial risks before they become problems.

When he logs an expense, confirm it and reflect the updated numbers. When he asks about scholarships, be specific and actionable. Use Naira (₦). Keep replies concise — a few short sentences unless he asks for depth.`;
}

/** ───────────────── inference ───────────────── */

interface RouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Map the UI transcript to Router messages (drop pending placeholders). */
function toRouterMessages(history: ChatMessage[]): RouterMessage[] {
  return history
    .filter((m) => !m.pending && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}

/**
 * Ask Stash. `history` is the full transcript including the latest user
 * turn; `ledger` is injected into the system prompt for personalization.
 * Returns the assistant's reply text.
 */
export async function askStash(
  history: ChatMessage[],
  ledger: Ledger,
): Promise<string> {
  if (!isComputeConfigured()) {
    throw new StashComputeError(
      "0G Compute is not configured — set VITE_OG_COMPUTE_API_KEY in your .env.",
    );
  }

  const messages: RouterMessage[] = [
    { role: "system", content: buildSystemPrompt(ledger) },
    ...toRouterMessages(history),
  ];

  let res: Response;
  try {
    // OpenAI-compatible chat completion. Endpoint/key/model come from the
    // resolved provider config above — the 0G Compute Router by default,
    // or a VITE_AI_* fallback for testnet builds without a mainnet Router
    // balance. Point VITE_AI_BASE_URL at router-api.0g.ai/v1 to go native.
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: STASH_MODEL,
        messages,
        temperature: 0.6,
        max_tokens: 600,
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
    const msg =
      detail?.error?.message ?? `AI provider error (${res.status}).`;
    throw new StashComputeError(msg);
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new StashComputeError("0G Compute returned an empty response.");
  }
  return content.trim();
}
