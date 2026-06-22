from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app.core.security import decode_token
from app.core.redis_client import is_blacklisted
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ── Get Current User ───────────────────────────────────────────
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise credentials_exception

    # ── تحقق إن الـ token مش في الـ blacklist ─────────────────
    if is_blacklisted(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise credentials_exception

    # Plain lookup — no relationship eager-loading needed. tenant_name (if
    # ever required on this object) is resolved explicitly downstream via
    # user_service.to_response(), never by walking user.tenant here.
    user = (
        db.query(User)
        .filter(User.id == UUID(user_id), User.is_active == True)
        .first()
    )
    if not user:
        raise credentials_exception

    return user


# ── Role Guards ────────────────────────────────────────────────
def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required",
        )
    return current_user


def require_platform_super_admin(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Ensures the caller is:
      1. Authenticated
      2. Role = super_admin
      3. Belongs to the platform's own tenant (slug = settings.PLATFORM_TENANT_SLUG)

    This is the guard for ALL tenant-management operations — creating,
    editing, or deleting tenants, and provisioning users inside any tenant
    from the platform level.

    Deliberately does NOT use current_user.tenant (relationship walk).
    Instead it resolves the platform tenant's id by its known slug and
    compares plain UUIDs — current_user.tenant_id == platform_tenant_id.
    This avoids any lazy-load surprises and never exposes tenant objects
    to the response layer; the comparison result is just a bool.
    """
    from app.config import settings
    from app.models.tenant import Tenant

    if current_user.role != UserRole.super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required",
        )

    platform_tenant_id = (
        db.query(Tenant.id)
        .filter(Tenant.slug == settings.PLATFORM_TENANT_SLUG)
        .scalar()
    )

    if platform_tenant_id is None or current_user.tenant_id != platform_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to platform administrators only",
        )

    return current_user


def require_technician(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (
        UserRole.technician,
        UserRole.admin,
        UserRole.super_admin,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Technician access required",
        )
    return current_user
