# 3.14-slim matches the local venv the contract was verified against, and every
# dependency ships a cp314 wheel (no build toolchain needed).
FROM python:3.14-slim

# Hugging Face Spaces runs the container as UID 1000 and will not let root-owned
# paths be written. Create the user before anything is copied, and COPY --chown,
# so this image works unchanged on Spaces, Fly and Render.
RUN useradd -m -u 1000 user

WORKDIR /app

COPY --chown=user requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=user gateway.py app.py persist.py probe.py ./

# Where the SQLite file lives. On a host with a mounted volume this is durable on
# its own. On an ephemeral disk (a free Space) the directory still has to exist
# and be writable at UID 1000, and durability comes from the snapshot layer in
# persist.py instead: SIBYL_SNAPSHOT_REPO + SIBYL_SNAPSHOT_HF_TOKEN.
# Note /data is only mounted at RUNTIME on Spaces, so this mkdir is what makes
# the path usable when no volume is attached.
RUN mkdir -p /data && chown user:user /data

ENV SIBYL_DB_PATH=/data/memory.db \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/home/user/.cache/huggingface

USER user

# 7860 is the port Spaces expects (matches `app_port` in README.md's YAML block);
# $PORT is injected by Render and friends and still wins when set.
EXPOSE 7860

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-7860}"]
