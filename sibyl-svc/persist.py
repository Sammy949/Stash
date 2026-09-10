"""Snapshot/restore for the memory database, so an ephemeral disk stops being fatal.

WHY: Sibyl's store is one SQLite file plus its WAL, and hosts like a free Hugging
Face Space wipe container-local disk on every restart, sleep-wake and rebuild.
Losing it fails *quietly*: /recall-pack just returns `remembers: false`, which is
indistinguishable from a brand-new tenant. So the service snapshots itself to a
durable store and restores on boot.

Three details this file exists to get right:

1. **Never copy memory.db directly.** In WAL mode the committed rows sit in
   `memory.db-wal` until a checkpoint; mid-flight the main file can be a 4 KB
   stub. `VACUUM INTO` folds the WAL in and writes one consistent, complete
   file, which is the only safe way to snapshot a live database.

2. **Never hand Sibyl a symlink.** `Storage.__init__` refuses to open a
   symlinked database file (a deliberate guard against redirected writes), and
   the Hub's cache is built out of symlinks into `blobs/`. Restore therefore
   downloads to a scratch dir and `copyfile`s to the real path, which
   dereferences and lands a plain file whatever the backend handed back.

3. **Never overwrite live local state.** Restore only fires when there is no
   usable database on disk. On a host with a real volume the local file is
   always the newer one, so a stale snapshot must not clobber it.

Writes are debounced rather than per-request: a money event should not block on a
git commit. The cost is an explicit, bounded loss window (`SIBYL_SNAPSHOT_DEBOUNCE_S`),
closed on graceful shutdown and by `POST /snapshot`.
"""

from __future__ import annotations

import base64
import os
import shutil
import sqlite3
import tempfile
import threading
import time
from pathlib import Path
from typing import Protocol

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Name the snapshot carries inside the durable store. Fixed: each push replaces
# the previous one, so the dataset holds one current file plus git history,
# rather than an ever-growing pile of dated copies.
SNAPSHOT_NAME = "memory.db"
SNAPSHOT_MAGIC = b"STASH-SNAPSHOT-AESGCM\x01"


class SnapshotStore(Protocol):
    """The durable side. Small on purpose: two calls and a label."""

    def load(self, dest: Path) -> bool:
        """Fetch the latest snapshot to `dest` as a real file. False if none exists."""

    def save(self, src: Path) -> None:
        """Publish `src` as the latest snapshot."""

    def describe(self) -> str: ...


class NullStore:
    """No durable store configured. The service still runs; memory is disk-only."""

    def load(self, dest: Path) -> bool:
        return False

    def save(self, src: Path) -> None:
        return None

    def describe(self) -> str:
        return "none (memory is not backed up)"


class LocalDirStore:
    """A plain directory. The offline mode: no token, no network, same contract.

    Used by the wipe-and-restore test, and a legitimate deploy target whenever the
    host has a volume mounted somewhere other than the database's own directory.
    """

    def __init__(self, directory: str) -> None:
        self._dir = Path(directory).expanduser()
        self._dir.mkdir(parents=True, exist_ok=True)

    @property
    def _path(self) -> Path:
        return self._dir / SNAPSHOT_NAME

    def load(self, dest: Path) -> bool:
        if not self._path.exists():
            return False
        # copyfile, not copy/move: dereferences a symlinked source and writes a
        # plain file, which is what Sibyl's Storage guard requires.
        shutil.copyfile(self._path, dest)
        return True

    def save(self, src: Path) -> None:
        tmp = self._path.with_name(self._path.name + ".tmp")
        shutil.copyfile(src, tmp)
        os.replace(tmp, self._path)  # atomic: a reader never sees a half-written file

    def describe(self) -> str:
        return f"local dir {self._dir}"


class HubStore:
    """A private Hugging Face dataset repo, via huggingface_hub.

    The repo is created on first save (private, `exist_ok=True`) so a fresh deploy
    needs only a write-scoped token and a repo id.
    """

    def __init__(self, repo_id: str, token: str) -> None:
        from huggingface_hub import HfApi

        self._repo_id = repo_id
        self._token = token
        self._api = HfApi(token=token)

    def load(self, dest: Path) -> bool:
        from huggingface_hub import hf_hub_download
        from huggingface_hub.errors import EntryNotFoundError, RepositoryNotFoundError

        with tempfile.TemporaryDirectory() as scratch:
            try:
                # local_dir= keeps the download out of the shared blob cache. We
                # still copyfile below, because the symlink guard in Sibyl's
                # Storage makes "probably a real file" not good enough.
                got = hf_hub_download(
                    repo_id=self._repo_id,
                    repo_type="dataset",
                    filename=SNAPSHOT_NAME,
                    local_dir=scratch,
                    token=self._token,
                )
            except (EntryNotFoundError, RepositoryNotFoundError):
                return False  # first boot: nothing published yet
            shutil.copyfile(got, dest)
        return True

    def save(self, src: Path) -> None:
        self._api.create_repo(
            repo_id=self._repo_id, repo_type="dataset", private=True, exist_ok=True
        )
        self._api.upload_file(
            path_or_fileobj=str(src),
            path_in_repo=SNAPSHOT_NAME,
            repo_id=self._repo_id,
            repo_type="dataset",
            commit_message=f"snapshot {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}",
        )

    def describe(self) -> str:
        return f"hf dataset {self._repo_id} (private)"


def store_from_env() -> SnapshotStore:
    """Pick a backend from the environment. Hub wins; local dir is the offline mode."""
    repo = os.getenv("SIBYL_SNAPSHOT_REPO", "").strip()
    token = os.getenv("SIBYL_SNAPSHOT_HF_TOKEN", "").strip()
    if repo and token:
        return HubStore(repo, token)
    local = os.getenv("SIBYL_SNAPSHOT_DIR", "").strip()
    if local:
        return LocalDirStore(local)
    return NullStore()


def _is_usable_db(path: Path) -> bool:
    """True when `path` is a readable SQLite database with Sibyl's schema in it.

    A zero-byte or truncated file left by a half-finished restore must not be
    mistaken for live state, or the boot logic would skip the restore that would
    have fixed it.
    """
    if not path.exists() or path.stat().st_size == 0:
        return False
    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=5.0)
    except sqlite3.Error:
        return False
    try:
        row = conn.execute(
            "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='entities'"
        ).fetchone()
        return bool(row and row[0])
    except sqlite3.Error:
        return False
    finally:
        conn.close()


class Persister:
    """Restore on boot, debounced snapshots after writes, a final flush on exit."""

    def __init__(self, db_path: str, store: SnapshotStore, debounce_s: float = 20.0) -> None:
        self._db_path = Path(db_path).expanduser()
        self._store = store
        self._debounce_s = max(0.0, debounce_s)
        self._dirty = threading.Event()
        self._stop = threading.Event()
        self._flush_lock = threading.Lock()  # one VACUUM/upload at a time
        self._thread: threading.Thread | None = None
        self.last_error: str | None = None
        self.last_saved_at: float | None = None
        self.restored: bool = False
        self._restore_blocked = False
        raw_key = os.getenv("SIBYL_SNAPSHOT_KEY", "").strip()
        if self.enabled and not raw_key:
            raise RuntimeError("SIBYL_SNAPSHOT_KEY is required when snapshot persistence is enabled")
        try:
            self._snapshot_key = base64.urlsafe_b64decode(raw_key.encode()) if raw_key else None
        except Exception as e:
            raise RuntimeError("SIBYL_SNAPSHOT_KEY must be URL-safe base64") from e
        if self._snapshot_key is not None and len(self._snapshot_key) != 32:
            raise RuntimeError("SIBYL_SNAPSHOT_KEY must decode to exactly 32 bytes")

    @property
    def enabled(self) -> bool:
        return not isinstance(self._store, NullStore)

    # --- boot ----------------------------------------------------------
    def restore(self) -> bool:
        """Pull the snapshot down, but only when there is no usable local db.

        Call this BEFORE the Gateway opens the database: SQLite must not have the
        file open while it is being replaced.
        """
        if not self.enabled:
            return False
        if _is_usable_db(self._db_path):
            return False  # live local state always wins over a stored snapshot
        self._db_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        # Land it beside the target so the final move is a same-filesystem rename.
        staging = self._db_path.with_name(self._db_path.name + ".restore")
        try:
            if not self._store.load(staging):
                return False
            legacy_plaintext = self._is_plaintext_snapshot(staging)
            if not legacy_plaintext:
                self._decrypt_snapshot(staging)
            if not _is_usable_db(staging):
                raise RuntimeError("downloaded snapshot is not a valid Sibyl database")
            if legacy_plaintext:
                encrypted = staging.with_name(staging.name + ".encrypted")
                try:
                    self._encrypt_snapshot(staging, encrypted)
                    self._store.save(encrypted)
                except Exception as e:
                    self.last_error = (
                        f"legacy snapshot migration failed: {type(e).__name__}: {e}"
                    )
                    self._restore_blocked = True
                finally:
                    encrypted.unlink(missing_ok=True)
            # Clear WAL/SHM sidecars from any previous life: they belong to the
            # database we are replacing, and SQLite would try to apply them.
            for suffix in ("-wal", "-shm"):
                Path(str(self._db_path) + suffix).unlink(missing_ok=True)
            os.replace(staging, self._db_path)
            os.chmod(self._db_path, 0o600)
            self.restored = True
            return True
        except Exception as e:  # a failed restore must not stop the service booting
            self.last_error = f"restore failed: {type(e).__name__}: {e}"
            self._restore_blocked = True
            return False
        finally:
            staging.unlink(missing_ok=True)

    # --- runtime -------------------------------------------------------
    def start(self) -> None:
        if not self.enabled or self._thread is not None:
            return
        self._thread = threading.Thread(target=self._loop, name="snapshot", daemon=True)
        self._thread.start()

    def mark_dirty(self) -> None:
        """A write happened. Coalesced: N writes inside the window cost one upload.

        A no-op with no backend configured, so /persistence does not report a
        `pending_write` that nothing is ever going to act on.
        """
        if self.enabled:
            self._dirty.set()

    def _loop(self) -> None:
        while not self._stop.is_set():
            if not self._dirty.wait(timeout=1.0):
                continue
            # Let a burst settle before paying for an upload. Interrupted by
            # shutdown so a stopping service flushes immediately instead of waiting.
            self._stop.wait(timeout=self._debounce_s)
            self._dirty.clear()
            self.flush()

    def flush(self) -> bool:
        """Snapshot now: VACUUM INTO a temp file, publish it, delete the temp."""
        if not self.enabled or self._restore_blocked:
            return False
        with self._flush_lock:
            if not _is_usable_db(self._db_path):
                return False
            tmp = Path(tempfile.mkdtemp(prefix="sibyl-snap-")) / SNAPSHOT_NAME
            try:
                # A separate read connection sees the WAL, and VACUUM INTO folds it
                # into a single self-contained file. Destination must not exist.
                conn = sqlite3.connect(f"file:{self._db_path}?mode=ro", uri=True, timeout=30.0)
                try:
                    conn.execute("PRAGMA busy_timeout = 30000")
                    conn.execute("VACUUM INTO ?", (str(tmp),))
                finally:
                    conn.close()
                self._encrypt_snapshot(tmp)
                self._store.save(tmp)
                self.last_saved_at = time.time()
                self.last_error = None
                return True
            except Exception as e:
                # Never propagate: a failed backup must not fail the user's write.
                self.last_error = f"snapshot failed: {type(e).__name__}: {e}"
                return False
            finally:
                shutil.rmtree(tmp.parent, ignore_errors=True)

    def close(self) -> None:
        """Final flush on shutdown, so the debounce window is not a loss window."""
        pending = self._dirty.is_set()
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
            self._thread = None
        if pending:
            self.flush()

    def status(self) -> dict:
        return {
            "enabled": self.enabled,
            "store": self._store.describe(),
            "restored_on_boot": self.restored,
            "pending_write": self._dirty.is_set(),
            "debounce_seconds": self._debounce_s,
            "last_saved_at": self.last_saved_at,
            "last_error": self.last_error,
            "restore_blocked": self._restore_blocked,
        }

    @staticmethod
    def _is_plaintext_snapshot(path: Path) -> bool:
        return path.read_bytes()[:16] == b"SQLite format 3\x00"

    def _encrypt_snapshot(self, path: Path, destination: Path | None = None) -> None:
        if self._snapshot_key is None:
            raise RuntimeError("snapshot encryption key is not configured")
        plaintext = path.read_bytes()
        nonce = os.urandom(12)
        target = destination or path
        target.write_bytes(
            SNAPSHOT_MAGIC + nonce + AESGCM(self._snapshot_key).encrypt(nonce, plaintext, None)
        )

    def _decrypt_snapshot(self, path: Path) -> None:
        if self._snapshot_key is None:
            raise RuntimeError("snapshot encryption key is not configured")
        payload = path.read_bytes()
        if not payload.startswith(SNAPSHOT_MAGIC):
            raise RuntimeError("snapshot is not encrypted")
        nonce_start = len(SNAPSHOT_MAGIC)
        nonce = payload[nonce_start : nonce_start + 12]
        ciphertext = payload[nonce_start + 12 :]
        plaintext = AESGCM(self._snapshot_key).decrypt(nonce, ciphertext, None)
        path.write_bytes(plaintext)
