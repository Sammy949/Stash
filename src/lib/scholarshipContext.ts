import type { ChatMessage, Ledger, Scholarship } from "@/types";
import { daysUntil } from "@/lib/ledger";

/**
 * Scholarship context — turning tracked scholarships into LIVING context for
 * inline cards, the same way goalContext does for goals.
 *
 * Everything here is PURE and code-owned: it only ever selects scholarships
 * that already exist in the ledger (never the model, never invented), so the
 * inline cards are deterministic proof. The agent decides nothing about which
 * cards appear — code does.
 */

/** Words that carry no identifying signal in a scholarship's name. */
const NAME_STOPWORDS = new Set([
  "scholarship",
  "scholarships",
  "foundation",
  "award",
  "awards",
  "grant",
  "grants",
  "fund",
  "bursary",
  "program",
  "programme",
  "scheme",
  "prize",
  "the",
  "a",
  "an",
  "of",
  "for",
  "and",
]);

/** Escape a token for safe use inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Urgency-ordered scholarships: soonest upcoming deadline first, then
 * undated/status-only entries, then already-closed ones last. Sliced to `n`.
 * Used by the "Scholarship deadlines" chip (top 3).
 */
export function mostUrgentScholarships(
  ledger: Ledger,
  n: number,
  now: Date = new Date(),
): Scholarship[] {
  const dated = ledger.scholarships.filter((s) => s.deadline);
  const upcoming = dated
    .filter((s) => daysUntil(s.deadline!, now) >= 0)
    .sort((a, b) => daysUntil(a.deadline!, now) - daysUntil(b.deadline!, now));
  const undated = ledger.scholarships.filter((s) => !s.deadline);
  const closed = dated
    .filter((s) => daysUntil(s.deadline!, now) < 0)
    .sort((a, b) => daysUntil(b.deadline!, now) - daysUntil(a.deadline!, now));
  return [...upcoming, ...undated, ...closed].slice(0, Math.max(0, n));
}

/**
 * IDs of tracked scholarships the user's message REFERS TO. Matches on the
 * distinctive words of each name (e.g. "MTN" out of "MTN Foundation
 * Scholarship"), so "what's the deadline for the MTN one?" resolves — while
 * generic words ("scholarship", "fund") never trigger a false match. Falls
 * back to a whole-name substring match for names made entirely of stopwords.
 */
export function matchScholarshipsByMention(ledger: Ledger, text: string): string[] {
  const t = text.toLowerCase();
  const ids: string[] = [];
  for (const s of ledger.scholarships) {
    const name = s.name.trim();
    if (name.length < 3) continue;
    const tokens = name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !NAME_STOPWORDS.has(w));
    const hit = tokens.length
      ? tokens.some((tok) => new RegExp(`\\b${escapeRegExp(tok)}\\b`).test(t))
      : t.includes(name.toLowerCase());
    if (hit) ids.push(s.id);
  }
  return ids;
}

/**
 * The single most-urgent scholarship in the RED band (due within 7 days) —
 * the only thing worth surfacing proactively, unprompted. Null when nothing is
 * that close. Gated further by the caller's "recently shown" guard so it
 * doesn't repeat every turn.
 */
export function proactiveDeadlineScholarshipId(
  ledger: Ledger,
  now: Date = new Date(),
): string | null {
  const soon = ledger.scholarships
    .filter((s) => s.deadline)
    .map((s) => ({ s, d: daysUntil(s.deadline!, now) }))
    .filter((x) => x.d >= 0 && x.d < 7)
    .sort((a, b) => a.d - b.d);
  return soon[0]?.s.id ?? null;
}

/**
 * Scholarship IDs already shown in the last `lookback` transcript messages —
 * the guard that stops the proactive nudge from re-surfacing the same card on
 * every turn.
 */
export function recentlyShownScholarshipIds(
  transcript: ChatMessage[],
  lookback: number,
): Set<string> {
  const ids = new Set<string>();
  for (const m of transcript.slice(-lookback)) {
    m.relatedScholarshipIds?.forEach((id) => ids.add(id));
  }
  return ids;
}

/** How far back the proactive nudge looks before it'll repeat a deadline. */
export const NUDGE_LOOKBACK = 8;

/**
 * The proactive deadline nudge: the most-urgent near deadline worth raising
 * UNPROMPTED, paired with the code-owned FACTS line the model should weave into
 * its reply so it actually MENTIONS it (not just renders a silent card). Returns
 * null when nothing is in the red band, or when that scholarship was already
 * surfaced in the last `lookback` messages — the guard that keeps Stash from
 * harping on the same deadline every turn.
 *
 * Computed on the PRE-turn ledger by design: a scholarship the user is adding
 * THIS turn isn't here yet, so the add-trigger owns that moment, not the nudge.
 */
export function proactiveDeadlineNudge(
  ledger: Ledger,
  transcript: ChatMessage[],
  lookback: number = NUDGE_LOOKBACK,
  now: Date = new Date(),
): { id: string; facts: string } | null {
  const id = proactiveDeadlineScholarshipId(ledger, now);
  if (!id) return null;
  if (recentlyShownScholarshipIds(transcript, lookback).has(id)) return null;
  const s = ledger.scholarships.find((x) => x.id === id);
  if (!s || !s.deadline) return null;

  const d = daysUntil(s.deadline, now);
  const when = d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`;
  const who = ledger.owner?.trim() ? `${ledger.owner.trim()}'s` : "their";
  const facts =
    `DEADLINE NUDGE (code-owned fact — use it verbatim, don't recompute): ` +
    `${who} "${s.name}" application is due ${when} (${s.deadline}). ` +
    `Give a brief, warm heads-up about it — one line — then get back to what they asked. ` +
    `Mention it naturally; don't nag or repeat it if it's already been raised.`;
  return { id, facts };
}
