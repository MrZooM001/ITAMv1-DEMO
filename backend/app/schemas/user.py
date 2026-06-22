from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.models.user import UserRole


# ── Auth Schemas ───────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=6)
    new_password: str = Field(..., min_length=6)


class AdminChangePasswordRequest(BaseModel):
    """Admin-initiated password reset — no old password required."""
    new_password: str = Field(..., min_length=6)


# ── Request Schemas ────────────────────────────────────────────
class UserCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: UserRole = UserRole.viewer


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=200)
    email: Optional[EmailStr] = None


class UpdateMyProfile(BaseModel):
    """لتعديل الـ profile الشخصي — بدون role أو status"""

    full_name: Optional[str] = Field(None, min_length=2, max_length=200)
    email: Optional[EmailStr] = None


class UserRoleUpdate(BaseModel):
    role: UserRole


class UserStatusUpdate(BaseModel):
    is_active: bool


# ── Response Schemas ───────────────────────────────────────────
class UserResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    full_name: str
    email: str
    role: UserRole
    is_active: bool
    last_login: Optional[datetime] = None
    created_at: Optional[datetime] = None

    # Plain string only — set explicitly by the service layer after it has
    # already queried the user's OWN tenant (never a relationship walk, never
    # a nested object). No slug, no is_active, no created_at, no platform
    # flag — nothing that could leak metadata about tenants other than the
    # caller's own. Defaults to None so old call sites that forget to set it
    # fail visibly empty rather than silently exposing more than intended.
    tenant_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Activity & Stats ───────────────────────────────────────────
class TicketActivityItem(BaseModel):
    ticket_id: UUID
    ticket_number: str
    title: str
    status: str
    priority: str
    note: Optional[str] = None
    action: str  # "assigned" | "updated" | "created"
    action_at: datetime


class UserActivityResponse(BaseModel):
    user_id: UUID
    full_name: str
    last_login: Optional[datetime] = None
    activity: list[TicketActivityItem]
    total: int


class UserStatsResponse(BaseModel):
    user_id: UUID
    full_name: str
    role: UserRole
    tickets_assigned: int  # إجمالي التذاكر المسندة للـ user
    tickets_open: int  # التذاكر المفتوحة دلوقتي
    tickets_resolved: int  # التذاكر اللي حلها
    updates_made: int  # إجمالي ticket updates كتبها
    last_login: Optional[datetime] = None
    member_since: Optional[datetime] = None
