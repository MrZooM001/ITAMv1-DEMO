from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


# ----- Request Schemas -----
class EmployeeCreate(BaseModel):
    full_name:     str               = Field(..., min_length=2, max_length=200)
    email:         Optional[EmailStr]= None
    phone:         Optional[str]     = Field(None, max_length=50)
    job_title:     Optional[str]     = Field(None, max_length=200)
    department_id: Optional[UUID]    = None


class EmployeeUpdate(BaseModel):
    full_name:     Optional[str]      = Field(None, min_length=2, max_length=200)
    email:         Optional[EmailStr] = None
    phone:         Optional[str]      = Field(None, max_length=50)
    job_title:     Optional[str]      = Field(None, max_length=200)
    department_id: Optional[UUID]     = None
    is_active:     Optional[bool]     = None


# ----- Basic Response -----
class EmployeeResponse(BaseModel):
    id:            UUID
    tenant_id:     UUID
    department_id: Optional[UUID] = None
    full_name:     str
    email:         Optional[str]  = None
    phone:         Optional[str]  = None
    job_title:     Optional[str]  = None
    is_active:     bool
    created_at:    Optional[datetime] = None

    model_config = {"from_attributes": True}


# ----- List Response -----
class EmployeeSummaryResponse(EmployeeResponse):
    """For list endpoints — adds department name and counts."""
    department_name: Optional[str] = None
    device_count:    int           = 0
    open_tickets:    int           = 0


# ----- Detail Response -----
class AssignedDeviceInfo(BaseModel):
    id:     UUID
    name:   str
    status: str
    model_config = {"from_attributes": True}


class TicketInfo(BaseModel):
    id:            UUID
    ticket_number: str
    title:         str
    status:        str
    priority:      str
    model_config = {"from_attributes": True}


class EmployeeDetailResponse(EmployeeSummaryResponse):
    """For GET /{id} — adds full device list and open tickets."""
    assigned_devices: list[AssignedDeviceInfo] = []
    open_ticket_list: list[TicketInfo]         = []
