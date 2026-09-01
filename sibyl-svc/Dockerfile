# 3.14-slim matches the local venv the contract was verified against, and every
# dependency ships a cp314 wheel (no build toolchain needed).
FROM python:3.14-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY gateway.py app.py probe.py ./

# The SQLite file MUST land on a mounted persistent volume; container-local
# storage is wiped on redeploy and the memory would go with it.
ENV SIBYL_DB_PATH=/data/memory.db \
    PYTHONUNBUFFERED=1
RUN mkdir -p /data

EXPOSE 8000

# $PORT is injected by most hosts (Render); 8000 is the local/Fly default.
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]
