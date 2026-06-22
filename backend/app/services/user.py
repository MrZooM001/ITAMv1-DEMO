from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from uuid import UUID
from datetime import datetime, timezone

from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.models.ticket import Ticket, TicketUpdate, TicketStatus
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserRoleUpdate,
    UserStatusUpdate,
    UpdateMyProfile,
    UserResponse,
    UserActivityResponse,
    UserStatsResponse,
    TicketActivityItem,
)
from app.core.security import hash_password


# ── Response serialization ──────────────────────────────────────
def to_response(user: User, db: Session) -> UserResponse:
    """
    The ONLY place a User ORM object becomes a UserResponse.

    Deliberately does NOT walk user.tenant (no relationship traversal,
    no joinedload, no nested tenant object). It runs one small, explicitly
    scoped query for the tenant's name — the user's OWN tenant only,
    identified by user.tenant_id which is already trusted because every
    caller of this function already filtered the User query by tenant_id.

    This keeps schema-level exposure to exactly one plain string field
    and nothing else about the tenant (no slug, no is_active, no
    created_at, no platform/admin flag).
    """
    tenant_name = (
        db.query(Tenant.name).filter(Tenant.id == user.tenant_id).scalar()
    )
    data = UserResponse.model_validate(user)
    data.tenant_name = tenant_name
    return data


def to_response_list(users: list[User], db: Session) -> list[UserResponse]:
    return [to_response(u, db) for u in users]


# ── Super-admin protection ─────────────────────────────────────
def _is_platform_super_admin(actor: User, db: Session) -> bool:
    """
    True only if actor is super_admin AND actor's own tenant_id matches
    the platform tenant's id. Looked up by slug → id, never by walking
    actor.tenant as a relationship.
    """
    if actor.role != UserRole.super_admin:
        return False
    from app.config import settings
    platform_tenant_id = (
        db.query(Tenant.id).filter(Tenant.slug == settings.PLATFORM_TENANT_SLUG).scalar()
    )
    return platform_tenant_id is not None and actor.tenant_id == platform_tenant_id


def _guard_super_admin_target(target: User, actor: User, db: Session) -> None:
    """
    Raises 403 if the target user is a super_admin AND the actor is not
    a platform super_admin. No customer-tenant admin may ever touch a
    super_admin account, including their own tenant's data.
    """
    if target.role != UserRole.super_admin:
        return
    if not _is_platform_super_admin(actor, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin accounts can only be managed by the platform administrator",
        )


def _guard_no_self_delete(target: User, actor: User) -> None:
    if target.id == actor.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot perform this action on your own account",
        )


# ── CRUD ───────────────────────────────────────────────────────
def create_user(request: UserCreate, tenant_id: UUID, db: Session) -> User:
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = User(
        tenant_id     = tenant_id,
        full_name     = request.full_name,
        email         = request.email,
        password_hash = hash_password(request.password),
        role          = request.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_users(
    tenant_id: UUID,
    db: Session,
    limit: int = 20,
    offset: int = 0,
    search: str | None = None,
    is_active: bool | None = None,
) -> tuple[list[User], int]:
    query = db.query(User).filter(User.tenant_id == tenant_id)
    if search:
        query = query.filter(
            (User.full_name.ilike(f"%{search}%")) | (User.email.ilike(f"%{search}%"))
        )
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    query = query.order_by(User.full_name)
    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return items, total


def get_user(user_id: UUID, tenant_id: UUID, db: Session) -> User:
    user = db.query(User).filter(
        User.id        == user_id,
        User.tenant_id == tenant_id,
    ).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def update_user(
    user_id: UUID, request: UserUpdate, tenant_id: UUID, db: Session,
    actor: User | None = None,
) -> User:
    user = get_user(user_id, tenant_id, db)
    if actor:
        _guard_super_admin_target(user, actor, db)

    if request.full_name:
        user.full_name = request.full_name
    if request.email and request.email != user.email:
        existing = db.query(User).filter(User.email == request.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )
        user.email = request.email

    db.commit()
    db.refresh(user)
    return user


def update_user_role(
    user_id: UUID, request: UserRoleUpdate, current_user: User,
    tenant_id: UUID, db: Session,
) -> User:
    user = get_user(user_id, tenant_id, db)
    _guard_no_self_delete(user, current_user)
    _guard_super_admin_target(user, current_user, db)

    if request.role == UserRole.super_admin and not _is_platform_super_admin(current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the platform super admin can assign the super admin role",
        )

    user.role = request.role
    db.commit()
    db.refresh(user)
    return user


def update_user_status(
    user_id: UUID, request: UserStatusUpdate, current_user: User,
    tenant_id: UUID, db: Session,
) -> User:
    user = get_user(user_id, tenant_id, db)
    _guard_no_self_delete(user, current_user)
    _guard_super_admin_target(user, current_user, db)

    user.is_active = request.is_active
    db.commit()
    db.refresh(user)
    return user


def delete_user(
    user_id: UUID, current_user: User, tenant_id: UUID, db: Session,
) -> None:
    user = get_user(user_id, tenant_id, db)
    _guard_no_self_delete(user, current_user)

    if user.role == UserRole.super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin accounts cannot be deleted",
        )

    db.delete(user)
    db.commit()


# ── My Profile ─────────────────────────────────────────────────
def update_my_profile(request: UpdateMyProfile, current_user: User, db: Session) -> User:
    if request.email and request.email != current_user.email:
        taken = db.query(User).filter(
            User.email == request.email,
            User.id    != current_user.id,
        ).first()
        if taken:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already in use",
            )
        current_user.email = request.email

    if request.full_name is not None:
        current_user.full_name = request.full_name

    db.commit()
    db.refresh(current_user)
    return current_user


# ── Password ───────────────────────────────────────────────────
def admin_change_password(
    user_id: UUID, new_password: str, tenant_id: UUID, db: Session,
    actor: User | None = None,
) -> None:
    """Admin-initiated password reset. Platform SA can reset any SA password."""
    user = db.query(User).filter(
        User.id        == user_id,
        User.tenant_id == tenant_id,
    ).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if actor:
        _guard_super_admin_target(user, actor, db)

    user.password_hash = hash_password(new_password)
    db.commit()


# ── Activity ───────────────────────────────────────────────────
def get_user_activity(
    user_id: UUID, tenant_id: UUID, limit: int, offset: int, db: Session,
) -> UserActivityResponse:
    user = get_user(user_id, tenant_id, db)
    activity_items: list[dict] = []

    assigned_tickets = db.query(Ticket).filter(
        Ticket.assigned_to == user_id,
        Ticket.tenant_id   == tenant_id,
    ).all()
    for t in assigned_tickets:
        activity_items.append({
            "ticket_id":     t.id,
            "ticket_number": t.ticket_number,
            "title":         t.title,
            "status":        t.status.value,
            "priority":      t.priority.value,
            "note":          None,
            "action":        "assigned",
            "action_at":     t.updated_at or t.created_at,
        })

    updates = db.query(TicketUpdate, Ticket).join(
        Ticket, TicketUpdate.ticket_id == Ticket.id,
    ).filter(
        TicketUpdate.updated_by == user_id,
        Ticket.tenant_id        == tenant_id,
    ).all()
    for upd, t in updates:
        activity_items.append({
            "ticket_id":     t.id,
            "ticket_number": t.ticket_number,
            "title":         t.title,
            "status":        t.status.value,
            "priority":      t.priority.value,
            "note":          upd.note,
            "action":        "updated",
            "action_at":     upd.created_at or t.created_at,
        })

    activity_items.sort(
        key=lambda x: x["action_at"] or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    total = len(activity_items)
    page  = activity_items[offset: offset + limit]

    return UserActivityResponse(
        user_id   = user.id,
        full_name = user.full_name,
        last_login= user.last_login,
        total     = total,
        activity  = [TicketActivityItem(**item) for item in page],
    )


# ── Stats ──────────────────────────────────────────────────────
def get_user_stats(user_id: UUID, tenant_id: UUID, db: Session) -> UserStatsResponse:
    user = get_user(user_id, tenant_id, db)

    tickets_assigned = db.query(Ticket).filter(
        Ticket.assigned_to == user_id, Ticket.tenant_id == tenant_id,
    ).count()
    tickets_open = db.query(Ticket).filter(
        Ticket.assigned_to == user_id, Ticket.tenant_id == tenant_id,
        Ticket.status.in_([TicketStatus.open, TicketStatus.in_progress]),
    ).count()
    tickets_resolved = db.query(Ticket).filter(
        Ticket.assigned_to == user_id, Ticket.tenant_id == tenant_id,
        Ticket.status.in_([TicketStatus.resolved, TicketStatus.closed]),
    ).count()
    updates_made = db.query(TicketUpdate).filter(
        TicketUpdate.updated_by == user_id,
    ).count()

    return UserStatsResponse(
        user_id          = user.id,
        full_name        = user.full_name,
        role             = user.role,
        tickets_assigned = tickets_assigned,
        tickets_open     = tickets_open,
        tickets_resolved = tickets_resolved,
        updates_made     = updates_made,
        last_login       = user.last_login,
        member_since     = user.created_at,
    )
