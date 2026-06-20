from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from uuid import UUID

from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.tenant import TenantCreate, TenantUpdate


def create_tenant(request: TenantCreate, db: Session) -> Tenant:
    existing_slug = db.query(Tenant).filter(Tenant.slug == request.slug).first()
    if existing_slug:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tenant with slug '{request.slug}' already exists",
        )
    tenant = Tenant(name=request.name, slug=request.slug)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


def get_tenants(
    db: Session,
    limit: int = 20,
    offset: int = 0,
    is_active: bool | None = None,
) -> tuple[list[Tenant], int]:
    query = db.query(Tenant)
    if is_active is not None:
        query = query.filter(Tenant.is_active == is_active)
    query = query.order_by(Tenant.created_at.desc())
    total = query.count()
    return query.offset(offset).limit(limit).all(), total


def get_tenant(tenant_id: UUID, db: Session) -> Tenant:
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found"
        )
    return tenant


def update_tenant(tenant_id: UUID, request: TenantUpdate, db: Session) -> Tenant:
    from app.config import settings

    tenant = get_tenant(tenant_id, db)

    # The platform tenant's slug is immutable — only name/active allowed
    if request.name is not None:
        tenant.name = request.name
    if request.is_active is not None:
        if tenant.slug == settings.PLATFORM_TENANT_SLUG:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate the platform tenant",
            )
        tenant.is_active = request.is_active

    db.commit()
    db.refresh(tenant)
    return tenant


def delete_tenant(tenant_id: UUID, current_user: User, db: Session) -> None:
    from app.config import settings

    tenant = get_tenant(tenant_id, db)

    # Hard block: never allow deletion of the platform tenant
    if tenant.slug == settings.PLATFORM_TENANT_SLUG:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The platform tenant cannot be deleted",
        )

    # Guard: don't delete tenants that still have active users.
    # Explicit scoped query (not tenant.users relationship walk) — keeps
    # this consistent with the rest of the codebase's pattern of never
    # relying on lazy-loaded relationships for trust decisions.
    active_users = (
        db.query(User)
        .filter(
            User.tenant_id == tenant_id,
            User.is_active == True,
        )
        .count()
    )
    if active_users > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete tenant with {active_users} active user(s). Deactivate all users first.",
        )
    db.delete(tenant)
    db.commit()
