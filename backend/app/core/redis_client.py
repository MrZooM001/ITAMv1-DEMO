import redis
import logging
from app.config import settings

logger = logging.getLogger("itam.redis")

# ----- Connection state -----
_client: redis.Redis | None = None
_available: bool | None = None  # None=untested, True=ok, False=failed


def get_redis() -> redis.Redis | None:
    """Return Redis client أو None if not available."""
    global _client, _available

    if _available is False:
        return None

    if _client is None:
        _client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
        )

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


# ----- Blacklist helpers -----
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
        return False
    try:
        return r.exists(f"{BLACKLIST_PREFIX}{token}") == 1
    except Exception:
        return False
