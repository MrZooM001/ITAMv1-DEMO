from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional

from app.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.core.pagination import Pagination, PaginatedResponse, make_response
from app.models.user import User
from app.schemas.user import (
    UserCreate, UserUpdate, UserRoleUpdate, UserStatusUpdate, UserResponse,
    UpdateMyProfile, UserActivityResponse, UserStatsResponse,
    AdminChangePasswordRequest,
)
from app.services import user as user_service

router = APIRouter(prefix="/users", tags=["Users"])


# ── My Profile ─────────────────────────────────────────────────
@router.put("/me", response_model=UserResponse)
def update_my_profile(
    request:      UpdateMyProfile,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """Any user can update their own name or email without admin rights."""
    user = user_service.update_my_profile(request, current_user, db)
    return user_service.to_response(user, db)


# ── Stats & Activity (self or admin) ───────────────────────────
@router.get("/{user_id}/stats", response_model=UserStatsResponse)
def get_user_stats(
    user_id:      UUID,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    target_id = (
        user_id
        if current_user.role.value in ("admin", "super_admin")
        else current_user.id
    )
    return user_service.get_user_stats(target_id, current_user.tenant_id, db)


@router.get("/{user_id}/activity", response_model=UserActivityResponse)
def get_user_activity(
    user_id:      UUID,
    pagination:   Pagination = Depends(),
    current_user: User       = Depends(get_current_user),
    db:           Session    = Depends(get_db),
):
    target_id = (
        user_id
        if current_user.role.value in ("admin", "super_admin")
        else current_user.id
    )
    return user_service.get_user_activity(
        target_id, current_user.tenant_id,
        limit=pagination.limit, offset=pagination.offset, db=db,
    )


# ── User CRUD (Admin only) ─────────────────────────────────────
@router.post("/", response_model=UserResponse)
def create_user(
    request:      UserCreate,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    user = user_service.create_user(request, current_user.tenant_id, db)
    return user_service.to_response(user, db)


@router.get("/", response_model=PaginatedResponse[UserResponse])
def get_users(
    search:       Optional[str]  = Query(None, description="Search by name or email"),
    is_active:    Optional[bool] = Query(None),
    pagination:   Pagination     = Depends(),
    current_user: User           = Depends(require_admin),
    db:           Session        = Depends(get_db),
):
    items, total = user_service.get_users(
        current_user.tenant_id, db,
        limit=pagination.limit, offset=pagination.offset,
        search=search, is_active=is_active,
    )
    responses = user_service.to_response_list(items, db)
    return make_response(responses, total, pagination)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id:      UUID,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    user = user_service.get_user(user_id, current_user.tenant_id, db)
    return user_service.to_response(user, db)


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id:      UUID,
    request:      UserUpdate,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    user = user_service.update_user(user_id, request, current_user.tenant_id, db, actor=current_user)
    return user_service.to_response(user, db)


@router.put("/{user_id}/change-password", status_code=204)
def change_password(
    user_id:      UUID,
    request:      AdminChangePasswordRequest,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    """Admin resets any user's password without needing the old password."""
    user_service.admin_change_password(
        user_id, request.new_password, current_user.tenant_id, db, actor=current_user,
    )


@router.put("/{user_id}/role", response_model=UserResponse)
def update_role(
    user_id:      UUID,
    request:      UserRoleUpdate,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    user = user_service.update_user_role(user_id, request, current_user, current_user.tenant_id, db)
    return user_service.to_response(user, db)


@router.put("/{user_id}/status", response_model=UserResponse)
def update_status(
    user_id:      UUID,
    request:      UserStatusUpdate,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    user = user_service.update_user_status(user_id, request, current_user, current_user.tenant_id, db)
    return user_service.to_response(user, db)


@router.delete("/{user_id}")
def delete_user(
    user_id:      UUID,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    user_service.delete_user(user_id, current_user, current_user.tenant_id, db)
    return {"message": "User deleted successfully"}
