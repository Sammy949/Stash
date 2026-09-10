/**
 * Server-side inference proxy.
 *
 * Provider credentials never enter the Vite bundle. The browser sends the chat
 * payload here; this function selects the configured model and forwards it to
 * the OpenAI-compatible provider.
 */
const BASE_URL = (process.env.AI_BASE_URL || "").replace(/\/$/, "");
const API_KEY = process.env.AI_API_KEY || "";
const MODEL = process.env.AI_MODEL || "";
const FALLBACK_MODEL = process.env.AI_FALLBACK_MODEL || "";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { message: "Method not allowed" } });
  }
  if (!BASE_URL || !API_KEY || !MODEL) {
    return res.status(503).json({
      error: { message: "AI provider is not configured on the server." },
    });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  if (!body || !Array.isArray(body.messages)) {
    return res.status(400).json({ error: { message: "messages must be an array" } });
  }

  const payload = {
    model: MODEL,
    messages: body.messages,
    temperature: 0.5,
    max_tokens: body.max_tokens,
    ...(body.tools ? { tools: body.tools, tool_choice: body.tool_choice } : {}),
  };

  try {
    let upstream = await callProvider(payload);
    if (upstream.status === 429 && FALLBACK_MODEL && FALLBACK_MODEL !== MODEL) {
      upstream = await callProvider({ ...payload, model: FALLBACK_MODEL });
    }
    const text = await upstream.text();
    res.status(upstream.status);
    try {
      return res.json(JSON.parse(text || "null"));
    } catch {
      return res.send(text);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(502).json({ error: { message: `AI provider unreachable: ${message}` } });
  }
}

function callProvider(payload: Record<string, unknown>): Promise<Response> {
  return fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
