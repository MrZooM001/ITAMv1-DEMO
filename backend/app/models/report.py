from pydantic import BaseModel
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from app.models.device import DeviceStatus


# ── Assets Inventory Report ────────────────────────────────────
class AssetInventoryItem(BaseModel):
    device_id: UUID
    device_name: str
    device_type: Optional[str] = None
    device_model: Optional[str] = None
    serial_number: Optional[str] = None
    status: DeviceStatus
    department_name: Optional[str] = None
    employee_name: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_price: Optional[Decimal] = None
    warranty_expiry: Optional[date] = None
    os_name: Optional[str] = None

    model_config = {"from_attributes": True}


class AssetInventoryReport(BaseModel):
    total_devices: int
    active_devices: int
    in_maintenance: int
    retired_devices: int
    generated_at: datetime
    items: list[AssetInventoryItem]


# ── Warranty Status Report ─────────────────────────────────────
class WarrantyItem(BaseModel):
    device_id: UUID
    device_name: str
    serial_number: Optional[str] = None
    department_name: Optional[str] = None
    employee_name: Optional[str] = None
    warranty_expiry: Optional[date] = None
    days_remaining: Optional[int] = None
    status: str = None  # "expired", "expiring_soon", "valid"


class WarrantyReport(BaseModel):
    total_devices: int
    expired: int
    expiring_soon: int  # خلال 30 يوم
    valid: int
    generated_at: datetime
    items: list[WarrantyItem]


# ── SLA Report ─────────────────────────────────────────────────


class SLAByPriority(BaseModel):
    priority: str
    total_tickets: int
    resolved_tickets: int
    avg_resolution_hours: Optional[float] = None  # متوسط ساعات الحل
    min_resolution_hours: Optional[float] = None
    max_resolution_hours: Optional[float] = None


class SLAByTechnician(BaseModel):
    technician_id: Optional[UUID] = None
    technician_name: str
    assigned_tickets: int
    resolved_tickets: int
    avg_resolution_hours: Optional[float] = None


class SLAReport(BaseModel):
    total_tickets: int
    resolved_tickets: int
    open_tickets: int
    avg_resolution_hours: Optional[float] = None
    by_priority: list[SLAByPriority]
    by_technician: list[SLAByTechnician]
    generated_at: datetime


# ── License Utilization Report ─────────────────────────────────


class LicenseUtilizationItem(BaseModel):
    software_name: str
    vendor: Optional[str] = None
    license_type: Optional[str] = None
    total_seats: Optional[int] = None
    used_seats: int  # عدد الأجهزة اللي عليها البرنامج
    available_seats: Optional[int] = None
    utilization_pct: Optional[float] = None  # used/total * 100
    expiry_date: Optional[date] = None
    days_remaining: Optional[int] = None
    status: str = "no_license"  # "ok" | "over" | "expiring" | "expired"


class LicenseUtilizationReport(BaseModel):
    total_software: int
    licensed_software: int
    over_utilized: int  # استهلاك أكتر من الـ seats
    expiring_soon: int
    generated_at: datetime
    items: list[LicenseUtilizationItem]
