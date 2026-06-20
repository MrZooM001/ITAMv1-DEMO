from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional

from app.database import get_db
from app.core.dependencies import require_platform_super_admin
from app.core.pagination import Pagination, PaginatedResponse, make_response
from app.models.user import User
from app.schemas.tenant import TenantCreate, TenantUpdate, TenantResponse
from app.schemas.user import (
    UserCreate,
    UserResponse,
    UserUpdate,
    UserStatusUpdate,
    AdminChangePasswordRequest,
)
from app.services import tenant as tenant_service
from app.services import user as user_service

router = APIRouter(prefix="/tenants", tags=["Tenants"])

# ----- All routes in this file require platform super-admin -----


# ----- Tenant CRUD -----
@router.post("/", response_model=TenantResponse, status_code=201)
def create_tenant(
    request: TenantCreate,
    current_user: User = Depends(require_platform_super_admin),
    db: Session = Depends(get_db),
):
    """Create a new customer tenant. Platform super-admin only."""
    return tenant_service.create_tenant(request, db)


@router.get("/", response_model=PaginatedResponse[TenantResponse])
def get_tenants(
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    pagination: Pagination = Depends(),
    current_user: User = Depends(require_platform_super_admin),
    db: Session = Depends(get_db),
):
    """List all tenants. Platform super-admin only."""
    items, total = tenant_service.get_tenants(
        db,
        limit=pagination.limit,
        offset=pagination.offset,
        is_active=is_active,
    )
    return make_response(items, total, pagination)


@router.get("/{tenant_id}", response_model=TenantResponse)
def get_tenant(
    tenant_id: UUID,
    current_user: User = Depends(require_platform_super_admin),
    db: Session = Depends(get_db),
):
    """Get a single tenant. Platform super-admin only."""
    return tenant_service.get_tenant(tenant_id, db)


@router.put("/{tenant_id}", response_model=TenantResponse)
def update_tenant(
    tenant_id: UUID,
    request: TenantUpdate,
    current_user: User = Depends(require_platform_super_admin),
    db: Session = Depends(get_db),
):
    """Update tenant name or active status. Platform super-admin only."""
    return tenant_service.update_tenant(tenant_id, request, db)


@router.delete("/{tenant_id}")
def delete_tenant(
    tenant_id: UUID,
    current_user: User = Depends(require_platform_super_admin),
    db: Session = Depends(get_db),
):
    """Delete a tenant (only if no active users remain). Platform super-admin only."""
    tenant_service.delete_tenant(tenant_id, current_user, db)
    return {"message": "Tenant deleted successfully"}


# ----- Tenant User Management -----
# Platform super-admin can provision users inside any customer tenant
# without logging in as that tenant. This is the "on-boarding" flow:
# create tenant → create its first admin user → hand credentials to client.


@router.post("/{tenant_id}/users", response_model=UserResponse, status_code=201)
def create_tenant_user(
    tenant_id: UUID,
    request: UserCreate,
    current_user: User = Depends(require_platform_super_admin),
    db: Session = Depends(get_db),
):
    """
    Create a user inside a specific tenant.
    Typical use: provision the first admin user for a new tenant.
    """
    # Verify tenant exists first
    tenant_service.get_tenant(tenant_id, db)
    user = user_service.create_user(request, tenant_id, db)
    return user_service.to_response(user, db)


@router.get("/{tenant_id}/users", response_model=PaginatedResponse[UserResponse])
def list_tenant_users(
    tenant_id: UUID,
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    pagination: Pagination = Depends(),
    current_user: User = Depends(require_platform_super_admin),
    db: Session = Depends(get_db),
):
    """List all users in a specific tenant. Platform super-admin only."""
    tenant_service.get_tenant(tenant_id, db)
    items, total = user_service.get_users(
        tenant_id,
        db,
        limit=pagination.limit,
        offset=pagination.offset,
        search=search,
        is_active=is_active,
    )
    responses = user_service.to_response_list(items, db)
    return make_response(responses, total, pagination)


@router.put("/{tenant_id}/users/{user_id}", response_model=UserResponse)
def update_tenant_user(
    tenant_id: UUID,
    user_id: UUID,
    request: UserUpdate,
    current_user: User = Depends(require_platform_super_admin),
    db: Session = Depends(get_db),
):
    """Update a user's info inside any tenant. Platform super-admin only."""
    tenant_service.get_tenant(tenant_id, db)
    user = user_service.update_user(user_id, request, tenant_id, db, actor=current_user)
    return user_service.to_response(user, db)


@router.put("/{tenant_id}/users/{user_id}/status", response_model=UserResponse)
def update_tenant_user_status(
    tenant_id: UUID,
    user_id: UUID,
    request: UserStatusUpdate,
    current_user: User = Depends(require_platform_super_admin),
    db: Session = Depends(get_db),
):
    """
    Activate or deactivate a user inside any tenant, from the platform level.
    Mirrors PUT /users/{id}/status but scoped by tenant_id and reachable only
    by the platform super-admin — never exposed through UserUpdate, so a
    customer-tenant admin editing their own users via PUT /users/{id} cannot
    accidentally or deliberately flip is_active through that route.
    """
    tenant_service.get_tenant(tenant_id, db)
    user = user_service.update_user_status(
        user_id, request, current_user, tenant_id, db
    )
    return user_service.to_response(user, db)


@router.put("/{tenant_id}/users/{user_id}/change-password", status_code=204)
def reset_tenant_user_password(
    tenant_id: UUID,
    user_id: UUID,
    request: AdminChangePasswordRequest,
    current_user: User = Depends(require_platform_super_admin),
    db: Session = Depends(get_db),
):
    """
    Reset any user's password from the platform level.
    No old password required. Platform super-admin only.
    """
    tenant_service.get_tenant(tenant_id, db)
    user_service.admin_change_password(
        user_id, request.new_password, tenant_id, db, actor=current_user
    )
