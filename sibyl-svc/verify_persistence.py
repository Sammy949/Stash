#!/usr/bin/env python3
"""Wipe-and-restore proof: simulate the thing a free Space actually does to us.

Boots the real service, writes real memory through the real HTTP API, snapshots,
then DELETES the entire database directory the way an ephemeral container wipe
does, boots a second service against a fresh empty disk, and asserts the memory
came back byte-for-byte identical.

Run against the offline backend (a directory, no token, no network):

    STASH_SVC_TOKEN=... .venv/bin/python verify_persistence.py

Run against the real private dataset by exporting these first, which exercises
the exact code path a deployed Space uses:

    export SIBYL_SNAPSHOT_REPO=you/stash-memory
    export SIBYL_SNAPSHOT_HF_TOKEN=hf_...
"""

from __future__ import annotations

import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
PYTHON = str(HERE / ".venv/bin/python") if (HERE / ".venv/bin/python").exists() else sys.executable
TOKEN = os.environ.get("STASH_SVC_TOKEN") or "verify-token-" + os.urandom(8).hex()
TENANT = "0x" + "7e" * 20
PORT = int(os.environ.get("VERIFY_PORT", "8799"))
BASE = f"http://127.0.0.1:{PORT}"

_failures: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    print(f"  {'PASS' if ok else 'FAIL'}  {label}{f'  ({detail})' if detail else ''}")
    if not ok:
        _failures.append(label)


def call(method: str, path: str, body=None, *, token=TOKEN):
    req = urllib.request.Request(f"{BASE}{path}", method=method)
    req.add_header("X-Stash-Auth", token)
    req.add_header("X-Stash-Tenant", TENANT)
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, data, timeout=60) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def boot(db_dir: Path, snapshot_env: dict[str, str], debounce: str = "1") -> subprocess.Popen:
    """Start uvicorn on a given disk and wait for it to answer.

    `debounce` is raised to something long when a stage needs to prove the
    SHUTDOWN flush rather than the background one: with a 1s window the
    background thread would have uploaded before the SIGTERM arrived, and the
    test would pass without exercising the path it claims to cover.
    """
    env = {
        **os.environ,
        "STASH_SVC_TOKEN": TOKEN,
        "SIBYL_DB_PATH": str(db_dir / "memory.db"),
        "SIBYL_MEMORY_TELEMETRY": "0",
        "SIBYL_SNAPSHOT_DEBOUNCE_S": debounce,
        **snapshot_env,
    }
    # The service reads sibyl-svc/.env with override=False, so a stale SIBYL_DB_PATH
    # in that file cannot win over what we set here. Belt and braces: drop the keys
    # this test owns from anything inherited.
    proc = subprocess.Popen(
        [PYTHON, "-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", str(PORT)],
        cwd=str(HERE),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    for _ in range(150):
        if proc.poll() is not None:
            print(proc.stdout.read() if proc.stdout else "")
            raise SystemExit("service exited during boot")
        try:
            with urllib.request.urlopen(f"{BASE}/healthz", timeout=1) as r:
                if r.status == 200:
                    return proc
        except Exception:
            time.sleep(0.2)
    proc.kill()
    raise SystemExit("service never became healthy")


def shutdown(proc: subprocess.Popen) -> None:
    """SIGTERM, the signal a host sends on redeploy, so the lifespan flush runs."""
    proc.send_signal(signal.SIGTERM)
    try:
        proc.wait(timeout=30)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=10)


def main() -> int:
    repo = os.getenv("SIBYL_SNAPSHOT_REPO", "").strip()
    hf_token = os.getenv("SIBYL_SNAPSHOT_HF_TOKEN", "").strip()
    workspace = Path(tempfile.mkdtemp(prefix="verify-persist-"))
    disk_a = workspace / "container-1"
    disk_b = workspace / "container-2"
    disk_a.mkdir()
    disk_b.mkdir()

    if repo and hf_token:
        backend = {"SIBYL_SNAPSHOT_REPO": repo, "SIBYL_SNAPSHOT_HF_TOKEN": hf_token}
        print(f"backend: private HF dataset {repo}")
    else:
        durable = workspace / "durable-store"
        backend = {"SIBYL_SNAPSHOT_DIR": str(durable), "SIBYL_SNAPSHOT_REPO": "",
                   "SIBYL_SNAPSHOT_HF_TOKEN": ""}
        print(f"backend: offline local dir {durable}")
        print("        (set SIBYL_SNAPSHOT_REPO + SIBYL_SNAPSHOT_HF_TOKEN to test the Hub path)")

    before: dict = {}

    print("\n--- container 1: write real memory ---")
    proc = boot(disk_a, backend)
    try:
        status, st = call("GET", "/persistence")
        check("snapshot layer enabled", status == 200 and st.get("enabled"), st.get("store", ""))
        check("nothing restored on a first-ever boot", st.get("restored_on_boot") is False)

        status, pack = call("GET", "/recall-pack")
        check("fresh tenant remembers nothing", status == 200 and pack["remembers"] is False)

        call("POST", "/entity", {"category": "identity", "name": "profile",
                                 "body": {"name": "Ada", "currency": "GBP"}})
        call("POST", "/entity", {"category": "goal", "name": "MacBook Pro",
                                 "body": {"target": 1500, "saved": 240}})
        call("POST", "/entity", {"category": "habit", "name": "post-payday spike",
                                 "body": {"note": "spends the week after a client pays"}})
        call("POST", "/state", {"body": {"balance": 612.5, "runwayDays": 41}})
        status, ev = call("POST", "/event", {"evaluated": {"kind": "income", "amount": 600},
                                             "acted": {"newBalance": 612.5},
                                             "forward": {"goalGap": 1260}})
        check("money event journalled", status == 200 and ev.get("id"))

        status, before = call("GET", "/recall-pack")
        check("memory reads back before the wipe", status == 200 and before["remembers"] is True)

        # Prove the WAL point: the live main file is a stub, the data is in -wal.
        main_size = (disk_a / "memory.db").stat().st_size
        wal = disk_a / "memory.db-wal"
        wal_size = wal.stat().st_size if wal.exists() else 0
        print(f"        live disk: memory.db={main_size}B  memory.db-wal={wal_size}B")

        status, snap = call("POST", "/snapshot")
        check("forced snapshot succeeded", status == 200 and snap.get("ok"),
              snap.get("last_error") or "")
        if wal_size > main_size:
            print("        (a naive copy of memory.db would have backed up the stub, "
                  "not the WAL — this is why VACUUM INTO)")
    finally:
        shutdown(proc)

    print("\n--- the wipe: delete the container's entire disk ---")
    shutil.rmtree(disk_a)
    check("database, WAL and SHM are all gone", not disk_a.exists())

    print("\n--- container 2: fresh empty disk, must restore ---")
    proc = boot(disk_b, backend)
    try:
        status, st = call("GET", "/persistence")
        check("restored on boot", status == 200 and st.get("restored_on_boot") is True,
              st.get("last_error") or "")
        check("restored file is not a symlink (Sibyl's Storage guard)",
              (disk_b / "memory.db").exists() and not (disk_b / "memory.db").is_symlink())

        status, after = call("GET", "/recall-pack")
        check("tenant is remembered again", status == 200 and after["remembers"] is True)

        # The real assertion: identical memory, not merely non-empty.
        def shape(pack: dict) -> dict:
            return {
                "counts": pack["counts"],
                "identity": pack["identity"]["body"] if pack["identity"] else None,
                "goals": sorted((g["name"], json.dumps(g["body"], sort_keys=True))
                                for g in pack["goals"]),
                "habits": sorted((h["name"], json.dumps(h["body"], sort_keys=True))
                                 for h in pack["habits"]),
                "snapshot": pack["snapshot"]["body"] if pack["snapshot"] else None,
                "events": [e.get("id") for e in pack["recent_events"]],
            }

        check("recall-pack is IDENTICAL across the wipe", shape(before) == shape(after),
              "" if shape(before) == shape(after)
              else f"\n    before={json.dumps(shape(before), sort_keys=True)}"
                   f"\n    after ={json.dumps(shape(after), sort_keys=True)}")

        status, found = call("GET", "/entities?q=macbook")
        check("FTS5 index survived the round-trip (not just the rows)",
              status == 200 and len(found["results"]) >= 1,
              f"{len(found.get('results', []))} hit(s)")

        # A restored container must keep backing itself up, not go read-only.
        call("POST", "/entity", {"category": "opportunity", "name": "tutoring gig",
                                 "body": {"rate": 25}})
        status, snap2 = call("POST", "/snapshot")
        check("restored container can snapshot again", status == 200 and snap2.get("ok"),
              snap2.get("last_error") or "")
    finally:
        shutdown(proc)

    print("\n--- container 3: second wipe, must restore the LATER snapshot ---")
    shutil.rmtree(disk_b)
    disk_c = workspace / "container-3"
    disk_c.mkdir()
    proc = boot(disk_c, backend)
    try:
        status, pack = call("GET", "/recall-pack")
        check("the write made after the first restore also survived",
              status == 200 and len(pack["opportunities"]) == 1,
              f"opportunities={len(pack.get('opportunities', []))}")
    finally:
        shutdown(proc)

    print("\n--- live local state is never clobbered by a stale snapshot ---")
    proc = boot(disk_c, backend)
    try:
        status, st = call("GET", "/persistence")
        check("boot with a usable local db does NOT restore over it",
              status == 200 and st.get("restored_on_boot") is False)
    finally:
        shutdown(proc)

    # The debounce window is only safe because a graceful stop closes it. Prove
    # that with a window long enough that the background thread cannot be the one
    # doing the work: write, SIGTERM at once, wipe, and look for the write.
    print("\n--- SIGTERM during the debounce window still flushes ---")
    disk_d = workspace / "container-4"
    disk_d.mkdir()
    proc = boot(disk_d, backend, debounce="3600")
    try:
        status, _ = call("POST", "/entity", {"category": "preference",
                                            "name": "flush on sigterm",
                                            "body": {"written": "just before the stop"}})
        check("write accepted", status == 200)
        status, st = call("GET", "/persistence")
        check("write is still pending, not yet uploaded", st.get("pending_write") is True)
    finally:
        shutdown(proc)  # SIGTERM -> lifespan finally -> persister.close() -> flush

    shutil.rmtree(disk_d)
    disk_e = workspace / "container-5"
    disk_e.mkdir()
    proc = boot(disk_e, backend)
    try:
        status, pack = call("GET", "/recall-pack")
        names = [p["name"] for p in pack.get("preferences", [])]
        check("the pending write survived the restart", "flush-on-sigterm" in names,
              f"preferences={names}")
    finally:
        shutdown(proc)

    shutil.rmtree(workspace, ignore_errors=True)
    print(f"\n{len(_failures)} failure(s): {_failures}" if _failures else "\nall checks passed")
    return 1 if _failures else 0


if __name__ == "__main__":
    sys.exit(main())
