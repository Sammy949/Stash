import type { ChatMessage, Ledger } from "@/types";

/**
 * 0G Compute integration — the Stash AI agent.
 *
 * STUB (step 4/5). Will implement the OpenAI-compatible call to the
 * 0G Compute Router, injecting the live ledger state into the system
 * prompt so every response is specific to Samuel.
 */

export const ROUTER_URL = "https://router-api.0g.ai/v1";
export const STASH_MODEL = "zai-org/GLM-5-FP8";

export function buildSystemPrompt(_ledger: Ledger): string {
  return "";
}

export async function askStash(
  _messages: ChatMessage[],
  _ledger: Ledger,
): Promise<string> {
  throw new Error("ogCompute.askStash not implemented yet (step 4)");
}
