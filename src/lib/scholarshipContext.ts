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
