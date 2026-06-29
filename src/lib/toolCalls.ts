import { AGENT_TOOLS } from "@/lib/agentTools";

/**
 * Robust tool-call handling.
 *
 * Models (especially llama-3.3 via Groq) are unpredictable about HOW they emit
 * a tool call. We've seen, for the same intent:
 *   - clean structured calls: { name: "remember", arguments: "{...}" }
 *   - args fused into the name: { name: 'remember={"kind":"goal",...}' }
 *   - namespaced names: "functions.log_expense"
 *   - the whole call as plain text: `<function=remember>{...}` or `remember={...}`
 *
 * Any of these used to either silently no-op (unknown action) or crash the turn
 * with a raw provider error. This module normalizes every shape into a clean,
 * validated call so the agent loop can rely on `{ name, args, known }`.
 */

/** The set of tool names the agent actually has. */
export const KNOWN_TOOL_NAMES = new Set<string>(
  AGENT_TOOLS.map((t) => t.function.name),
);

export interface CleanCall {
  name: string;
  args: Record<string, unknown>;
  /** True when `name` is an actual tool we can execute. */
  known: boolean;
}

/**
 * Forgiving JSON parse. Accepts an object as-is, a JSON string, or a string
 * with junk around a JSON object (grabs the outermost {...}). Returns null when
 * nothing object-shaped can be recovered.
 */
export function parseLooseJson(input: unknown): Record<string, unknown> | null {
  if (input && typeof input === "object") {
    return input as Record<string, unknown>;
  }
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!s) return null;

  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    /* fall through to brace extraction */
  }

  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const v = JSON.parse(s.slice(start, end + 1));
      return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    } catch {
      /* give up */
    }
  }
  return null;
}

/**
 * Recover a usable tool name from whatever the model put in the name field.
 * Tries, in order: exact match, namespaced last segment ("functions.x" → "x"),
 * the leading identifier (strips "=..."/"(...)" fused args), then any known
 * tool name that appears anywhere in the string.
 */
function recoverName(raw: string): string {
  const r = (raw || "").trim();
  if (KNOWN_TOOL_NAMES.has(r)) return r;

  const lastSeg = r.split(".").pop() ?? r;
  const segName = (lastSeg.match(/[a-zA-Z_][a-zA-Z0-9_]*/) ?? [""])[0];
  if (KNOWN_TOOL_NAMES.has(segName)) return segName;

  const head = (r.match(/^[a-zA-Z_][a-zA-Z0-9_]*/) ?? [""])[0];
  if (KNOWN_TOOL_NAMES.has(head)) return head;

  for (const known of KNOWN_TOOL_NAMES) {
    if (r.includes(known)) return known;
  }
  return head || segName;
}

/**
 * Normalize one (possibly malformed) tool call into a clean, validated call.
 * Recovers the name, and the args from either the arguments field or JSON that
 * leaked into the name.
 */
export function sanitizeToolCall(rawName: string, rawArgs: string): CleanCall {
  const name = recoverName(rawName);
  const args = parseLooseJson(rawArgs) ?? parseLooseJson(rawName) ?? {};
  return { name, args, known: KNOWN_TOOL_NAMES.has(name) };
}

/**
 * Last-resort fallback: pull tool calls out of plain assistant TEXT, for models
 * that narrate the call instead of emitting it structurally. Returns the
 * recovered calls plus the text with those fragments stripped out. Only known
 * tools are returned — junk that merely looks tool-shaped is ignored.
 */
export function extractTextToolCalls(content: string | null): {
  calls: CleanCall[];
  cleaned: string;
} {
  if (!content) return { calls: [], cleaned: "" };
  const calls: CleanCall[] = [];
  let cleaned = content;

  // 1) <function=NAME>{json}</function>  (or without the closing tag)
  const tagged = /<function=([a-zA-Z_]+)>\s*(\{[\s\S]*?\})\s*(?:<\/function>)?/gi;
  cleaned = cleaned.replace(tagged, (_full, name: string, json: string) => {
    const c = sanitizeToolCall(name, json);
    if (c.known) calls.push(c);
    return "";
  });

  // 2) NAME={json}  or  NAME({json})  for any known tool name.
  for (const name of KNOWN_TOOL_NAMES) {
    const fused = new RegExp(`\\b${name}\\s*[=(]\\s*(\\{[\\s\\S]*?\\})\\s*\\)?`, "g");
    cleaned = cleaned.replace(fused, (_full, json: string) => {
      const args = parseLooseJson(json);
      if (args) calls.push({ name, args, known: true });
      return "";
    });
  }

  return { calls, cleaned: cleaned.trim() };
}
