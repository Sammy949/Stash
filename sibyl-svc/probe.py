"""End-to-end proof that the sidecar does what the demo needs.

Run the service, then: python probe.py [base_url]
Exits non-zero on the first failure. Uses throwaway tenants, never a real wallet.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8787").rstrip("/")
TOKEN = os.environ["STASH_SVC_TOKEN"]
ALICE = "0x" + "a1" * 20
BOB = "0x" + "b2" * 20

_failures: list[str] = []


def call(method: str, path: str, body=None, *, tenant=ALICE, token=TOKEN):
    req = urllib.request.Request(f"{BASE}{path}", method=method)
    if token is not None:
        req.add_header("Authorization", f"Bearer {token}")
    if tenant is not None:
        req.add_header("X-Stash-Tenant", tenant)
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, data, timeout=15) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def check(label: str, ok: bool, detail: str = "") -> None:
    print(f"  {'PASS' if ok else 'FAIL'}  {label}{f'  ({detail})' if detail else ''}")
    if not ok:
        _failures.append(label)


print(f"probing {BASE}")

status, health = call("GET", "/healthz", tenant=None, token=None)
check("healthz open, no auth needed", status == 200 and health.get("ok"), str(health))

status, _ = call("GET", "/recall-pack", token=None)
check("no token rejected", status == 401)
status, _ = call("GET", "/recall-pack", token="wrong-token")
check("wrong token rejected", status == 401)
status, _ = call("GET", "/recall-pack", tenant="not-a-wallet")
check("malformed tenant rejected", status == 400)

status, pack = call("GET", "/recall-pack")
check("fresh tenant remembers nothing (the deletion-test path)",
      status == 200 and pack["remembers"] is False, f"remembers={pack.get('remembers')}")

call("POST", "/entity", {"category": "identity", "name": "profile",
                         "body": {"name": "Ada", "currency": "GBP", "city": "Lagos",
                                  "situation": "final-year student, freelance income"}})
status, first = call("POST", "/entity", {"category": "goal", "name": "MacBook Pro",
                                         "body": {"target": 1500, "saved": 0, "currency": "GBP"}})
check("goal written", status == 200 and first.get("id"))
status, second = call("POST", "/entity", {"category": "goal", "name": "macbook pro",
                                          "body": {"target": 1800, "saved": 120, "currency": "GBP"}})
check("CONSOLIDATION: same row, evolved body",
      second.get("id") == first.get("id") and second["body"]["target"] == 1800,
      f"id stable={second.get('id') == first.get('id')} target={second['body']['target']}")

call("POST", "/entity", {"category": "habit", "name": "post-payday spike",
                         "body": {"note": "spending runs the week after a client pays"}})
call("POST", "/entity", {"category": "preference", "name": "no subscriptions",
                         "body": {"note": "cancels anything recurring"}})

status, _ = call("POST", "/entity", {"category": "nonsense", "name": "x", "body": {}})
check("unknown category rejected (no silent category drift)", status == 400)

call("POST", "/state", {"body": {"balance": 600, "currency": "GBP", "runwayDays": 41}})
status, ev = call("POST", "/event", {"evaluated": {"kind": "income", "amount": 600},
                                     "acted": {"newBalance": 600},
                                     "forward": {"goalGap": 1680}})
check("money event journalled to COLD", status == 200 and ev.get("id"))

status, pack = call("GET", "/recall-pack")
ok = (
    status == 200
    and pack["remembers"] is True
    and pack["identity"]["body"]["name"] == "Ada"
    and len(pack["goals"]) == 1
    and pack["goals"][0]["body"]["target"] == 1800
    and len(pack["habits"]) == 1
    and pack["snapshot"]["body"]["balance"] == 600
    and len(pack["recent_events"]) == 1
)
check("recall-pack returns the whole opener in ONE call", ok, json.dumps(pack["counts"]))

status, found = call("GET", "/entities?q=macbook")
check("FTS finds the goal", status == 200 and len(found["results"]) >= 1)

status, bob = call("GET", "/recall-pack", tenant=BOB)
check("tenant isolation: Bob sees none of Ada's memory",
      status == 200 and bob["remembers"] is False)

status, tier = call("GET", "/tier")
print(f"\n  tier={tier.get('tier')} db={tier.get('db_size_bytes')}B "
      f"cap={tier.get('soft_cap_bytes')}B used={round(tier.get('pct_used', 0) * 100, 3)}%")

print(f"\n{len(_failures)} failure(s)" if _failures else "\nall checks passed")
sys.exit(1 if _failures else 0)
