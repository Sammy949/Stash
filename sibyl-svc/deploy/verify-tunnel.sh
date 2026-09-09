#!/usr/bin/env bash
# Verify the sidecar through a public URL (quick tunnel or a real host).
#
#   STASH_SVC_TOKEN=<token> ./deploy/verify-tunnel.sh https://x.trycloudflare.com
#
# Checks the chain in the order it can break, so a failure tells you WHERE:
# reachable -> healthy -> auth enforced -> real memory round-trip.
set -uo pipefail

BASE="${1:-}"
[ -z "$BASE" ] && { echo "usage: $0 <public-base-url>"; exit 2; }
BASE="${BASE%/}"
: "${STASH_SVC_TOKEN:?set STASH_SVC_TOKEN to the same value as SIBYL_SVC_TOKEN in Vercel}"

fail() { echo "  FAIL  $1"; exit 1; }

echo "1. reachable + healthy  ($BASE/healthz)"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$BASE/healthz") \
  || fail "could not reach $BASE — is the tunnel still running?"
[ "$code" = "200" ] || fail "/healthz returned $code (note: it is /healthz, not /health)"
echo "  PASS  200"

echo "2. auth is actually enforced"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 \
  -H 'X-Stash-Tenant: 0x0000000000000000000000000000000000000000' \
  "$BASE/recall-pack")
[ "$code" = "401" ] || [ "$code" = "403" ] \
  || fail "unauthenticated /recall-pack returned $code — expected 401/403. Do NOT expose this."
echo "  PASS  $code without a token"

echo "3. full probe through the public URL"
python3 "$(dirname "$0")/../probe.py" "$BASE" || fail "probe failed — see output above"

cat <<DONE

All green. The public chain works.

Next: set SIBYL_SVC_URL=$BASE and SIBYL_SVC_TOKEN (same token) in Vercel,
redeploy, then open heystash.app. The chain you are proving is

  browser -> Vercel api/memory.ts -> $BASE -> localhost -> SQLite

Remember: a quick-tunnel URL dies with the process. Fine for tonight, not
a URL to submit to judges.
DONE
