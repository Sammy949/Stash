import posthog from "posthog-js";

const KEY = import.meta.env.VITE_POSTHOG_KEY;
const HOST = import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";

let enabled = false;

/**
 * Privacy-safe analytics for a sovereign finance app.
 *
 * Stash's promise is that your financial memory is private and encrypted.
 * PostHog is therefore locked down hard: NO autocapture, NO session replay,
 * NO pageview/pageleave snooping. We only ever send the handful of named
 * product events declared in `EventProps` below, and NEVER a single
 * financial value — no amount, balance, category, description, or owner
 * name leaves the client.
 *
 * If `VITE_POSTHOG_KEY` is unset (dev / not configured), every call here is
 * a silent no-op.
 */
export function initAnalytics(): void {
  if (!KEY) return;
  posthog.init(KEY, {
    api_host: HOST,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    disable_surveys: true,
  });
  enabled = true;
}

/**
 * The closed set of events we send. Properties are deliberately
 * non-financial — booleans and a currency code only. Adding an event means
 * adding it here first, which forces a privacy review at the type level.
 */
type EventProps = {
  /** Fired once when onboarding seeds the ledger. */
  onboarding_completed: { currency: string };
  /** A user turn reached the agent. `mutated` = a tool changed the ledger. */
  agent_message_sent: { mutated: boolean };
  /** A 0G Storage backup attempt finished. */
  og_sync: { success: boolean };
};

export function track<K extends keyof EventProps>(
  name: K,
  props: EventProps[K],
): void {
  if (!enabled) return;
  posthog.capture(name, props);
}
