#!/bin/bash
# /backend/entrypoint.sh
set -e

echo "========================================"
echo "  ITAM System — Starting Up"
echo "========================================"

# ----- 1. Wait for Database -----
echo "[1/4] Waiting for database..."

python << 'PYEOF'
import time
import os
import psycopg2

db_url = os.environ.get("DATABASE_URL", "")
# حوّل SQLAlchemy URL لـ psycopg2 URL
conn_str = db_url.replace("postgresql+psycopg2://", "postgresql://")

max_retries = 30
for i in range(max_retries):
    try:
        conn = psycopg2.connect(conn_str)
        conn.close()
        print(f"  ✅ Database ready!")
        break
    except Exception as e:
        print(f"  ⏳ Attempt {i+1}/{max_retries}: {e}")
        time.sleep(2)
else:
    print("  ❌ Database not available after retries. Exiting.")
    exit(1)
PYEOF

# ----- 2. Wait for Redis -----
echo "[2/4] Waiting for Redis..."

python << 'PYEOF'
import time
import os
import redis

redis_url = os.environ.get("REDIS_URL", "redis://redis:6379/0")
max_retries = 15

for i in range(max_retries):
    try:
        r = redis.from_url(redis_url, socket_connect_timeout=2)
        r.ping()
        print(f"  ✅ Redis ready!")
        break
    except Exception as e:
        print(f"  ⏳ Attempt {i+1}/{max_retries}: {e}")
        time.sleep(2)
else:
    print("  ⚠️  Redis not available — continuing without blacklisting")
PYEOF

# ----- 3. Create Tables -----
echo "[3/4] Creating database tables..."

python << 'PYEOF'
import sys
sys.path.insert(0, "/app")

from app.database import engine, Base
import app.models  # noqa: F401 — import all models

Base.metadata.create_all(bind=engine)
print("  ✅ Tables created (or already exist)")
PYEOF

# ----- 4. Seed inital data -----
echo "[4/4] Seeding initial data..."

python /app/seed.py

# Optional: populate realistic demo data (devices, tickets, employees...)
# Set SEED_DEMO_DATA=true as an env var on the demo deployment only.
# Leave unset (or "false") on real production deployments.
if [ "${SEED_DEMO_DATA}" = "true" ]; then
    echo "  → SEED_DEMO_DATA=true, seeding demo dataset..."
    python /app/seed_demo.py
fi

# ----- 5. Starting API Server -----
echo ""
echo "========================================"
echo "  Starting uvicorn on port 8000..."
echo "========================================"

exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 1
