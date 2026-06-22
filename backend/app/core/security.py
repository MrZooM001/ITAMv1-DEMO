from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTError, JWTClaimsError
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,
    bcrypt__ident="2b",
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password[:72])


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password[:72], hashed_password)


# --- JWT ---
def create_access_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload.update({"exp": expire, "type": "access"})
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload.update({"exp": expire, "type": "refresh"})
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT.

    Returns the payload dict on success, or None on ANY failure —
    expired signature, bad signature, malformed token, invalid claims.
    Callers (get_current_user, refresh_access_token, logout) already
    treat None as "reject this token", so collapsing every failure
    mode to None here keeps that contract simple and uniform.

    IMPORTANT: python-jose's exception hierarchy is

        JOSEError
        ├── JWTError
        │   ├── ExpiredSignatureError   (token's `exp` has passed)
        │   └── JWTClaimsError          (claims invalid, e.g. bad audience)
        └── JWSError                    (signature/structure invalid)

    ExpiredSignatureError is a JWTError, NOT a JWSError — catching only
    JWSError (as a previous version of this function did) lets every
    expired-token decode raise uncaught, producing an unhandled 500
    instead of a clean 401 on every expired access/refresh token.
    """
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        return payload
    except ExpiredSignatureError:
        # Expected, frequent, NOT a server error — the token simply expired.
        # Falls through to `return None` below; no logging needed at this
        # layer, since every caller already returns a proper 401 for None.
        return None
    except JWTClaimsError:
        return None
    except JWTError:
        # Catches everything else under JWTError, plus JWSError via
        # JOSEError is intentionally NOT used here so genuinely unexpected
        # exceptions (e.g. a coding bug) still surface instead of being
        # silently swallowed.
        return None
