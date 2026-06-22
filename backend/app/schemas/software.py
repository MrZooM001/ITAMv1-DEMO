# /backend/app/schemas/software.py

from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from typing import Optional

# ── Software ───────────────────────────────────────────────────


class SoftwareCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    vendor: Optional[str] = Field(None, max_length=200)
    category: Optional[str] = Field(None, max_length=100)
    is_common: bool = False
    notes: Optional[str] = Field(None, max_length=500)


class SoftwareUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    vendor: Optional[str] = Field(None, max_length=200)
    category: Optional[str] = Field(None, max_length=100)
    is_common: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=500)


class SoftwareResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    vendor: Optional[str] = None
    category: Optional[str] = None
    is_common: bool
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Software License ───────────────────────────────────────────


class SoftwareLicenseCreate(BaseModel):
    license_key: Optional[str] = Field(None, max_length=500)
    license_type: Optional[str] = Field(None, max_length=100)
    seats: Optional[int] = Field(None, gt=0)
    expiry_date: Optional[date] = None
    cost: Optional[Decimal] = None
    notes: Optional[str] = Field(None, max_length=500)


class SoftwareLicenseUpdate(BaseModel):
    license_key: Optional[str] = Field(None, max_length=500)
    license_type: Optional[str] = Field(None, max_length=100)
    seats: Optional[int] = Field(None, gt=0)
    expiry_date: Optional[date] = None
    cost: Optional[Decimal] = None
    notes: Optional[str] = Field(None, max_length=500)


class SoftwareLicenseResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    software_id: UUID
    software_name: Optional[str] = None
    license_key: Optional[str] = None
    license_type: Optional[str] = None
    seats: Optional[int] = None
    expiry_date: Optional[date] = None
    cost: Optional[Decimal] = None
    notes: Optional[str] = None
    days_remaining: Optional[int] = None  # محسوبة — مش موجودة في الـ DB
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Device Software ────────────────────────────────────────────


class DeviceSoftwareCreate(BaseModel):
    software_id: UUID
    version: Optional[str] = Field(None, max_length=100)
    installed_at: Optional[date] = None


class DeviceSoftwareUpdate(BaseModel):
    version: Optional[str] = Field(None, max_length=100)
    installed_at: Optional[date] = None


class DeviceSoftwareResponse(BaseModel):
    id: UUID
    device_id: UUID
    software_id: UUID
    software_name: Optional[str] = None
    vendor: Optional[str] = None
    version: Optional[str] = None
    installed_at: Optional[date] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
