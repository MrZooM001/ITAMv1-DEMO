from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User, RefreshToken
from app.schemas.user import (
    LoginRequest,
    TokenResponse,
    RefreshTokenRequest,
    ChangePasswordRequest,
)
from app.core.security import (
    verify_password,
    hash_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.core.redis_client import blacklist_token
from app.config import settings


def login(request: LoginRequest, db: Session) -> TokenResponse:
    # ── تحقق من الـ user ───────────────────────────────────────
    user = (
        db.query(User)
        .filter(User.email == request.email, User.is_active == True)
        .first()
    )

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # ── إنشاء الـ tokens ───────────────────────────────────────
    token_data = {
        "sub": str(user.id),
        "tenant_id": str(user.tenant_id),
        "role": user.role.value,
    }

    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    # ── حفظ الـ refresh token في الـ DB ───────────────────────
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    db_token = RefreshToken(
        user_id=user.id,
        token=refresh_token,
        expires_at=expires_at,
    )
    db.add(db_token)

    # ── تحديث آخر تسجيل دخول ──────────────────────────────────
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


def logout(access_token: str, refresh_token: str, db: Session) -> None:
    # ── 1. احذف الـ refresh token من الـ DB ───────────────────
    db_token = (
        db.query(RefreshToken).filter(RefreshToken.token == refresh_token).first()
    )
    if db_token:
        db.delete(db_token)
        db.commit()

    # ── 2. أضف الـ access token للـ Redis blacklist ───────────
    # TTL = الوقت المتبقي لانتهاء صلاحية الـ access token
    payload = decode_token(access_token)
    if payload:
        exp = payload.get("exp")
        if exp:
            remaining = int(exp - datetime.now(timezone.utc).timestamp())
            blacklist_token(access_token, remaining)


def refresh_access_token(request: RefreshTokenRequest, db: Session) -> TokenResponse:
    # ── تحقق من الـ token في الـ DB ────────────────────────────
    db_token = (
        db.query(RefreshToken)
        .filter(RefreshToken.token == request.refresh_token)
        .first()
    )

    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    # ── تحقق من انتهاء الصلاحية ───────────────────────────────
    if db_token.expires_at < datetime.now(timezone.utc):
        db.delete(db_token)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired",
        )

    # ── decode وإنشاء access token جديد ──────────────────────
    payload = decode_token(request.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    token_data = {
        "sub": payload.get("sub"),
        "tenant_id": payload.get("tenant_id"),
        "role": payload.get("role"),
    }

    new_access_token = create_access_token(token_data)

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=request.refresh_token,
    )


def change_password(
    request: ChangePasswordRequest, current_user: User, db: Session
) -> None:
    if not verify_password(request.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Old password is incorrect",
        )

    current_user.password_hash = hash_password(request.new_password)
    db.commit()
