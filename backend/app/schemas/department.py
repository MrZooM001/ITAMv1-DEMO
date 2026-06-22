from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


# ── Request Schemas ────────────────────────────────────────────
class DepartmentCreate(BaseModel):
    name:  str           = Field(..., min_length=2, max_length=200)
    notes: Optional[str] = Field(None, max_length=500)


class DepartmentUpdate(BaseModel):
    name:  Optional[str] = Field(None, min_length=2, max_length=200)
    notes: Optional[str] = Field(None, max_length=500)


# ── Basic Response ─────────────────────────────────────────────
class DepartmentResponse(BaseModel):
    id:         UUID
    tenant_id:  UUID
    name:       str
    notes:      Optional[str]      = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── List Response ──────────────────────────────────────────────
class DepartmentSummaryResponse(DepartmentResponse):
    """For list endpoints — adds counts computed in a single query."""
    employee_count: int = 0
    device_count:   int = 0
    open_tickets:   int = 0


# ── Detail Response ────────────────────────────────────────────
class DeviceBasic(BaseModel):
    id:     UUID
    name:   str
    status: str
    model_config = {"from_attributes": True}


class EmployeeBasic(BaseModel):
    id:        UUID
    full_name: str
    job_title: Optional[str] = None
    model_config = {"from_attributes": True}


class DepartmentDetailResponse(DepartmentSummaryResponse):
    """For GET /{id} — adds full employee and device lists."""
    employees: list[EmployeeBasic] = []
    devices:   list[DeviceBasic]   = []
