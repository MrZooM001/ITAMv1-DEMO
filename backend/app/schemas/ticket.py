from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.models.ticket import TicketStatus, TicketPriority


# ── Request Schemas ────────────────────────────────────────────
class TicketCreate(BaseModel):
    title:       str            = Field(..., min_length=3, max_length=300)
    description: Optional[str] = None
    priority:    TicketPriority = TicketPriority.medium
    device_id:   Optional[UUID] = None
    reported_by: Optional[UUID] = None   # employee who reported it
    assigned_to: Optional[UUID] = None   # user to assign on creation

class TicketUpdate(BaseModel):
    title:       Optional[str]            = Field(None, min_length=3, max_length=300)
    description: Optional[str]            = None
    priority:    Optional[TicketPriority] = None
    device_id:   Optional[UUID]           = None
    assigned_to: Optional[UUID]           = None

class TicketStatusUpdate(BaseModel):
    new_status: TicketStatus
    note:       Optional[str] = None

class TicketUpdateCreate(BaseModel):
    note:       str                    = Field(..., min_length=1)
    new_status: Optional[TicketStatus] = None

class TicketAssign(BaseModel):
    assigned_to: Optional[UUID] = None


# ── Sub-schemas ────────────────────────────────────────────────
class TicketUpdateResponse(BaseModel):
    id: UUID
    ticket_id: UUID
    updated_by: UUID
    note: Optional[str]       = None
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}

class SparePartUsageCreate(BaseModel):
    spare_part_id: UUID
    quantity_used: int = Field(..., gt=0)

class SparePartUsageResponse(BaseModel):
    id: UUID
    ticket_id: UUID
    spare_part_id: UUID
    spare_part_name: Optional[str] = None
    quantity_used: int
    used_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ── Basic Response ─────────────────────────────────────────────
class TicketResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    ticket_number: str
    title: str
    description: Optional[str] = None
    status: TicketStatus
    priority: TicketPriority
    device_id:   Optional[UUID]     = None
    reported_by: Optional[UUID]     = None
    assigned_to: Optional[UUID]     = None
    resolved_at: Optional[datetime] = None
    created_at:  Optional[datetime] = None
    updated_at:  Optional[datetime] = None
    updates: list[TicketUpdateResponse] = []
    model_config = {"from_attributes": True}


# ── List Response ──────────────────────────────────────────────
class TicketSummaryResponse(BaseModel):
    """For list endpoints — no nested updates, adds resolved name fields."""
    id: UUID
    tenant_id: UUID
    ticket_number: str
    title: str
    status: TicketStatus
    priority: TicketPriority
    device_id:        Optional[UUID] = None
    device_name:      Optional[str]  = None
    department_name:  Optional[str]  = None
    assigned_to:      Optional[UUID] = None
    assigned_to_name: Optional[str]  = None
    reported_by:      Optional[UUID] = None
    resolved_at:  Optional[datetime] = None
    created_at:   Optional[datetime] = None
    updates_count: int = 0
    model_config = {"from_attributes": True}


# ── Detail Response ────────────────────────────────────────────
class TicketDetailResponse(TicketSummaryResponse):
    """For GET /{id} — adds full update history + spare parts used."""
    description:  Optional[str]            = None
    updated_at:   Optional[datetime]       = None
    updates:      list[TicketUpdateResponse]   = []
    spare_parts:  list[SparePartUsageResponse] = []
