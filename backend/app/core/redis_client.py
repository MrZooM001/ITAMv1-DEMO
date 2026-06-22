import redis
import logging
from app.config import settings

logger = logging.getLogger("itam.redis")

# ── Connection state ────────────────────────────────────────────
_client: redis.Redis | None = None
_available: bool | None = None  # None=untested, True=ok, False=failed


def get_redis() -> redis.Redis | None:
    """بيرجع Redis client أو None لو مش متاح."""
    global _client, _available

    # لو REDIS_URL فاضي أو مش متظبط — متحاولش تتصل أصلاً
    if not settings.REDIS_URL:
        if _available is not False:
            _available = False
            logger.info("REDIS_URL not set — token blacklisting disabled")
        return None

    # لو اتاختبر قبل كده وفشل — مترجعش تحاول
    if _available is False:
        return None

    if _client is None:
        try:
            _client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=1,  # 1 ثانية بس للـ connect
                socket_timeout=1,
            )
        except Exception as e:
            _available = False
            logger.warning("Invalid REDIS_URL — token blacklisting disabled: %s", e)
            return None

    # اختبر الـ connection لأول مرة
    if _available is None:
        try:
            _client.ping()
            _available = True
            logger.info("Redis connected: %s", settings.REDIS_URL)
        except Exception as e:
            _available = False
            _client = None
            logger.warning("Redis unavailable — token blacklisting disabled: %s", e)
            return None

    return _client


# ── Blacklist helpers ───────────────────────────────────────────

BLACKLIST_PREFIX = "blacklist:"


def blacklist_token(token: str, ttl_seconds: int) -> None:
    if ttl_seconds <= 0:
        return
    r = get_redis()
    if r is None:
        return
    try:
        r.setex(f"{BLACKLIST_PREFIX}{token}", ttl_seconds, "1")
    except Exception:
        pass


def is_blacklisted(token: str) -> bool:
    r = get_redis()
    if r is None:
        return False  # Redis مش متاح — نسمح بالـ token
    try:
        return r.exists(f"{BLACKLIST_PREFIX}{token}") == 1
    except Exception:
        return False
