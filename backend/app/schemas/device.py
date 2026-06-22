from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Any
from app.models.device import DeviceStatus, FieldType


# ── Device Type ────────────────────────────────────────────────
class DeviceTypeCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)

class DeviceTypeUpdate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)

class DeviceTypeResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    model_config = {"from_attributes": True}


# ── Device Type Field ──────────────────────────────────────────
class DeviceTypeFieldCreate(BaseModel):
    field_key:   str       = Field(..., min_length=1, max_length=100, pattern=r'^[a-z][a-z0-9_]*$')
    label:       str       = Field(..., min_length=1, max_length=200)
    field_type:  FieldType = FieldType.text
    options:     Optional[list[str]] = None
    is_required: bool      = False
    sort_order:  int       = 0

class DeviceTypeFieldUpdate(BaseModel):
    label:       Optional[str]       = Field(None, min_length=1, max_length=200)
    field_type:  Optional[FieldType] = None
    options:     Optional[list[str]] = None
    is_required: Optional[bool]      = None
    sort_order:  Optional[int]       = None

class DeviceTypeFieldResponse(BaseModel):
    id: UUID
    device_type_id: UUID
    field_key: str
    label: str
    field_type: FieldType
    options: Optional[list[str]] = None
    is_required: bool
    sort_order: int
    model_config = {"from_attributes": True}


# ── Device Model ───────────────────────────────────────────────
class DeviceModelCreate(BaseModel):
    device_type_id: UUID
    manufacturer:   Optional[str] = Field(None, max_length=200)
    model_name:     str           = Field(..., min_length=2, max_length=200)

class DeviceModelUpdate(BaseModel):
    manufacturer: Optional[str] = Field(None, max_length=200)
    model_name:   Optional[str] = Field(None, min_length=2, max_length=200)

class DeviceModelResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    device_type_id: UUID
    manufacturer: Optional[str] = None
    model_name: str
    model_config = {"from_attributes": True}


# ── Device Request ─────────────────────────────────────────────
class DeviceCreate(BaseModel):
    name:              str               = Field(..., min_length=2, max_length=200)
    device_type_id:    UUID
    device_model_id:   Optional[UUID]    = None
    serial_number:     Optional[str]     = Field(None, max_length=200)
    department_id:     Optional[UUID]    = None
    employee_id:       Optional[UUID]    = None
    purchase_date:     Optional[date]    = None
    warranty_expiry:   Optional[date]    = None
    purchase_price:    Optional[Decimal] = None
    notes:             Optional[str]     = Field(None, max_length=500)
    custom_attributes: Optional[dict[str, Any]] = None

class DeviceUpdate(BaseModel):
    name:              Optional[str]     = Field(None, min_length=2, max_length=200)
    device_model_id:   Optional[UUID]    = None
    serial_number:     Optional[str]     = Field(None, max_length=200)
    purchase_date:     Optional[date]    = None
    warranty_expiry:   Optional[date]    = None
    purchase_price:    Optional[Decimal] = None
    notes:             Optional[str]     = Field(None, max_length=500)
    custom_attributes: Optional[dict[str, Any]] = None

class DeviceStatusUpdate(BaseModel):
    status: DeviceStatus

class AssignEmployeeRequest(BaseModel):
    employee_id: UUID

class AssignDepartmentRequest(BaseModel):
    department_id: UUID


# ── Shared sub-schemas ─────────────────────────────────────────
class OSInfo(BaseModel):
    id: UUID
    name: str
    architecture: Optional[str] = None
    install_date: Optional[date] = None
    model_config = {"from_attributes": True}

class TicketSummary(BaseModel):
    id: UUID
    ticket_number: str
    title: str
    status: str
    priority: str
    model_config = {"from_attributes": True}

class InstalledSoftwareSummary(BaseModel):
    id: UUID
    software_id: UUID
    software_name: Optional[str] = None
    version: Optional[str] = None
    model_config = {"from_attributes": True}


# ── Device Basic Response ──────────────────────────────────────
class DeviceResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    serial_number:     Optional[str]          = None
    status:            DeviceStatus
    device_type_id:    UUID
    device_model_id:   Optional[UUID]         = None
    department_id:     Optional[UUID]         = None
    employee_id:       Optional[UUID]         = None
    purchase_date:     Optional[date]         = None
    warranty_expiry:   Optional[date]         = None
    purchase_price:    Optional[Decimal]      = None
    notes:             Optional[str]          = None
    custom_attributes: Optional[dict[str, Any]] = None
    created_at:        Optional[datetime]     = None
    operating_system:  Optional[OSInfo]       = None
    model_config = {"from_attributes": True}


# ── Device List Response ───────────────────────────────────────
class DeviceSummaryResponse(DeviceResponse):
    """For list endpoints — adds computed name fields and counts."""
    device_type_name:  Optional[str] = None
    department_name:   Optional[str] = None
    employee_name:     Optional[str] = None
    open_tickets:      int           = 0
    warranty_status:   str           = "no_warranty"  # valid | expiring_soon | expired | no_warranty


# ── Device Detail Response ─────────────────────────────────────
class DeviceDetailResponse(DeviceSummaryResponse):
    """For GET /{id} — adds hardware snapshot + software + open tickets."""
    hardware:           Optional[dict[str, Any]]       = None
    installed_software: list[InstalledSoftwareSummary] = []
    open_ticket_list:   list[TicketSummary]            = []


# ── Bulk Delete ────────────────────────────────────────────────
class BulkDeleteDevicesRequest(BaseModel):
    device_ids: list[UUID] = Field(..., min_length=1, max_length=100, description="List of device IDs to delete")


class BulkDeleteResult(BaseModel):
    id:      UUID
    success: bool
    error:   Optional[str] = None


class BulkDeleteDevicesResponse(BaseModel):
    deleted:  int
    failed:   int
    results:  list[BulkDeleteResult]
