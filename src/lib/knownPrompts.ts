/**
 * Prompts the agent loop recognises by their exact text.
 *
 * These are not UI. They used to live in QuickChips alongside the starter
 * buttons, which is why they read as "chips" — but the buttons are gone and
 * these two survived, because they do real work regardless of how the text got
 * into the composer. A user who simply TYPES "review my goals" gets the same
 * treatment as one who clicked something, which is how it should have been.
 *
 * Both are general queries: no tool fires, so the turn carries no related ids
 * of its own. useAgent matches the text and attaches the right records itself,
 * so the reply arrives with the inline cards that make it verifiable.
 */

/** Attaches ALL active goals, so the reply shows the full goal stack. */
export const REVIEW_GOALS_PROMPT = "Review my goals";

/** Attaches the few most-urgent scholarships, surfacing their inline cards. */
export const SCHOLARSHIP_DEADLINES_PROMPT = "Scholarship deadlines";
