import subprocess
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from app.config import settings


# ── Backup Directory ───────────────────────────────────────────
BACKUP_DIR = Path("backups")
BACKUP_DIR.mkdir(exist_ok=True)


def _parse_db_url(db_url: str) -> dict:
    """بيفك الـ DATABASE_URL لأجزاء"""
    parsed = urlparse(db_url)
    return {
        "host":     parsed.hostname,
        "port":     parsed.port or 5432,
        "user":     parsed.username,
        "password": parsed.password,
        "dbname":   parsed.path.lstrip("/"),
    }


def create_backup() -> dict:
    """بيعمل pg_dump للـ database"""
    db = _parse_db_url(settings.DATABASE_URL)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename  = f"backup_{timestamp}.sql"
    filepath  = BACKUP_DIR / filename

    env = os.environ.copy()
    env["PGPASSWORD"] = db["password"]

    try:
        result = subprocess.run(
            [
                "pg_dump",
                "-h", db["host"],
                "-p", str(db["port"]),
                "-U", db["user"],
                "-d", db["dbname"],
                "-f", str(filepath),
                "--no-password",
            ],
            env=env,
            capture_output=True,
            text=True,
            timeout=300,   # 5 دقايق max
        )

        if result.returncode != 0:
            raise RuntimeError(f"pg_dump failed: {result.stderr}")

        size_bytes = filepath.stat().st_size

        return {
            "filename":   filename,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "size_bytes": size_bytes,
            "size_mb":    round(size_bytes / 1024 / 1024, 2),
        }

    except FileNotFoundError:
        raise RuntimeError("pg_dump not found, make sure PostgreSQL client tools are installed")
    except subprocess.TimeoutExpired:
        raise RuntimeError("Backup timed out after 5 minutes")


def list_backups() -> list[dict]:
    """بيرجع قائمة الـ backups الموجودة"""
    backups = []

    for filepath in sorted(BACKUP_DIR.glob("backup_*.sql"), reverse=True):
        stat = filepath.stat()
        backups.append({
            "filename":   filepath.name,
            "created_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            "size_bytes": stat.st_size,
            "size_mb":    round(stat.st_size / 1024 / 1024, 2),
        })

    return backups


def restore_backup(filename: str) -> dict:
    """بيعمل restore من backup معين"""
    filepath = BACKUP_DIR / filename

    if not filepath.exists():
        raise FileNotFoundError(f"Backup file '{filename}' not found")

    # ── التحقق من اسم الملف عشان نمنع path traversal ──────────
    if not filename.startswith("backup_") or not filename.endswith(".sql"):
        raise ValueError("Invalid backup filename")

    db  = _parse_db_url(settings.DATABASE_URL)
    env = os.environ.copy()
    env["PGPASSWORD"] = db["password"]

    try:
        result = subprocess.run(
            [
                "psql",
                "-h", db["host"],
                "-p", str(db["port"]),
                "-U", db["user"],
                "-d", db["dbname"],
                "-f", str(filepath),
                "--no-password",
            ],
            env=env,
            capture_output=True,
            text=True,
            timeout=600,   # 10 دقايق max
        )

        if result.returncode != 0:
            raise RuntimeError(f"Restore failed: {result.stderr}")

        return {
            "filename":    filename,
            "restored_at": datetime.now(timezone.utc).isoformat(),
            "message":     "Database restored successfully",
        }

    except FileNotFoundError:
        raise RuntimeError("psql not found, make sure PostgreSQL client tools are installed")
    except subprocess.TimeoutExpired:
        raise RuntimeError("Restore timed out after 10 minutes")


def delete_backup(filename: str) -> None:
    """بيحذف backup معين"""
    if not filename.startswith("backup_") or not filename.endswith(".sql"):
        raise ValueError("Invalid backup filename")

    filepath = BACKUP_DIR / filename

    if not filepath.exists():
        raise FileNotFoundError(f"Backup file '{filename}' not found")

    filepath.unlink()
