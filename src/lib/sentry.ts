import * as Sentry from "@sentry/react";

/**
 * Sentry error monitoring + performance tracing.
 *
 * Gated on a configured DSN (`VITE_SENTRY_DSN`). If it's absent — the normal
 * case in local dev — every call here is a silent no-op, so dev stays quiet
 * and the DSN never has to live in source. When present, the SDK installs its
 * global handlers and captures unhandled errors automatically.
 *
 * Deliberately NO Session Replay: Stash's promise is sovereign, encrypted
 * financial memory, and replay would ship users' real balances/transactions
 * (the rendered DOM) off-device to Sentry's servers. Errors + tracing only,
 * and the helpers below scrub financial values out of the context we attach.
 */
/**
 * Replace any run of 4+ digits with `[redacted]`. Catches stray amounts /
 * balances in error text without touching short numbers like HTTP status
 * codes or schema versions. Intentionally blunt, not a perfect sanitiser.
 */
function redactDigits(text: string): string {
  return text.replace(/\d[\d,.]{3,}/g, "[redacted]");
}

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    // "production" | "development" — drives Sentry's environment filter.
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    // Performance tracing — sample everything (hackathon-scale traffic).
    tracesSampleRate: 1.0,
    // Only attach distributed-tracing headers to our own origin + the
    // serverless sync function. Keeps trace headers off the third-party
    // AI / 0G endpoints, where they'd risk CORS rejections.
    tracePropagationTargets: ["localhost", /^https:\/\/heystash\.app/],
    // No IP / cookies / headers. Explicit beats relying on the SDK default.
    sendDefaultPii: false,
    // Drop console breadcrumbs entirely — a stray `console.log(ledger)`
    // anywhere would otherwise ride along on the next captured error. Keep
    // every other breadcrumb type (fetch/navigation/UI) for debugging.
    beforeBreadcrumb: (crumb) => (crumb.category === "console" ? null : crumb),
    // Last line of defense: redact long digit runs from error messages, in
    // case an amount/balance ever lands in a thrown string. Deliberately
    // simple — make accidental leaks unlikely and obvious, not impossible.
    beforeSend: (event) => {
      if (event.message) event.message = redactDigits(event.message);
      for (const ex of event.exception?.values ?? []) {
        if (ex.value) ex.value = redactDigits(ex.value);
      }
      return event;
    },
  });
}

/**
 * Report a 0G Storage sync failure.
 *
 * Context is intentionally financial-data-free: only the sync phase, the
 * transport route, and whether the error is fatal (vs transient testnet
 * flakiness). No ledger, amount, balance, or root hash is ever attached.
 * Transient failures are `warning` level — the local copy is safe and the
 * sync retries — so they don't read as crashes.
 */
export function reportStorageError(
  error: unknown,
  ctx: { phase: "save" | "load"; route: "proxy" | "direct"; fatal?: boolean },
): void {
  Sentry.captureException(error, {
    level: ctx.fatal ? "error" : "warning",
    tags: { feature: "og-storage", sync_phase: ctx.phase, route: ctx.route },
  });
}

/**
 * Report an agent (0G Compute) failure.
 *
 * NO PII / financial data: we attach the SHAPE of the turn (message length,
 * whether a tool call was forced, the active provider/model) but NEVER the
 * user's message text — it routinely contains amounts and descriptions, which
 * the app's privacy bar forbids leaving the client. Expected, user-actionable
 * failures (empty balance, unreachable provider) are `warning` level; only
 * genuinely unexpected errors are `error`.
 */
export function reportAgentError(
  error: unknown,
  ctx: {
    provider: string;
    model: string;
    forceTool: boolean;
    messageLength: number;
    expected: boolean;
  },
): void {
  Sentry.captureException(error, {
    level: ctx.expected ? "warning" : "error",
    tags: { feature: "og-compute", provider: ctx.provider },
    extra: {
      model: ctx.model,
      force_tool: ctx.forceTool,
      user_message_length: ctx.messageLength,
    },
  });
}
