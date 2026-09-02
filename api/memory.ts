/**
 * Sibyl memory proxy (Vercel serverless, Node runtime).
 *
 * WHY THIS EXISTS: the sidecar authenticates with a shared service token. If the
 * browser held that token it would be public, and anyone could read or write any
 * tenant's memory. So the token lives in SERVER env only and every call is
 * relayed here. Note there is deliberately no VITE_ fallback for the token:
 * a VITE_ variable is inlined into the client bundle, which is exactly the leak
 * this function exists to prevent.
 *
 *   /api/memory?path=recall-pack        → GET  <svc>/recall-pack
 *   /api/memory?path=entity   (POST)    → POST <svc>/entity
 *   …and the rest of the allowlist below.
 *
 * The caller supplies its own tenant via X-Stash-Tenant. That is not yet proof
 * of ownership: until SIWE lands, a caller can name any wallet. The token keeps
 * strangers out; it does not keep tenants apart.
 *
 * Typed loosely (req/res: any) so it needs no @vercel/node dependency.
 */

const SVC_URL = (process.env.SIBYL_SVC_URL || "").replace(/\/$/, "");
const SVC_TOKEN = process.env.SIBYL_SVC_TOKEN || "";

/** Only these sidecar routes are reachable, so this can't be used as an open proxy. */
const ALLOWED_PATHS = new Set([
  "recall-pack",
  "entity",
  "entities",
  "archive",
  "state",
  "event",
  "events",
  "tier",
]);

const TENANT_RE = /^0x[0-9a-fA-F]{40}$/;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (!SVC_URL || !SVC_TOKEN) {
    return res
      .status(500)
      .json({ error: "Memory service not configured (SIBYL_SVC_URL / SIBYL_SVC_TOKEN)." });
  }

  const { path, ...rest } = (req.query ?? {}) as Record<string, string>;
  if (!path || !ALLOWED_PATHS.has(path)) {
    return res.status(400).json({ error: "Unknown or missing ?path=." });
  }

  const tenant = String(req.headers?.["x-stash-tenant"] ?? "");
  if (!TENANT_RE.test(tenant)) {
    return res.status(400).json({ error: "X-Stash-Tenant must be a wallet address." });
  }

  const query = new URLSearchParams(
    Object.entries(rest).filter(([, v]) => typeof v === "string") as [string, string][],
  ).toString();

  try {
    const upstream = await fetch(`${SVC_URL}/${path}${query ? `?${query}` : ""}`, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${SVC_TOKEN}`,
        "X-Stash-Tenant": tenant.toLowerCase(),
        "Content-Type": "application/json",
      },
      body:
        req.method === "GET" || req.method === "HEAD"
          ? undefined
          : JSON.stringify(req.body ?? {}),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    try {
      return res.json(JSON.parse(text || "null"));
    } catch {
      return res.send(text);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return res.status(502).json({ error: `memory service unreachable: ${message}` });
  }
}
