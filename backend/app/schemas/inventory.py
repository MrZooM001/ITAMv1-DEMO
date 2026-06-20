from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


# ----- Inventory Schemas -----
class InventoryCreate(BaseModel):
    name:         str           = Field(..., min_length=2, max_length=200)
    category:     Optional[str] = Field(None, max_length=100)
    quantity:     int           = Field(0, ge=0)
    min_quantity: int           = Field(0, ge=0)
    unit:         Optional[str] = Field(None, max_length=50)
    notes:        Optional[str] = None


class InventoryUpdate(BaseModel):
    name:         Optional[str] = Field(None, min_length=2, max_length=200)
    category:     Optional[str] = None
    min_quantity: Optional[int] = Field(None, ge=0)
    unit:         Optional[str] = None
    notes:        Optional[str] = None


class InventoryQuantityUpdate(BaseModel):
    quantity: int = Field(..., ge=0)


class InventoryResponse(BaseModel):
    id:           UUID
    tenant_id:    UUID
    name:         str
    category:     Optional[str] = None
    quantity:     int
    min_quantity: int
    unit:         Optional[str] = None
    notes:        Optional[str] = None
    created_at:   Optional[datetime] = None
    is_low_stock: bool = False

    model_config = {"from_attributes": True}


# ----- Spare Parts Schemas -----
class SparePartCreate(BaseModel):
    name:            str           = Field(..., min_length=2, max_length=200)
    compatible_with: Optional[str] = None
    quantity:        int           = Field(0, ge=0)
    min_quantity:    int           = Field(0, ge=0)
    notes:           Optional[str] = None


class SparePartUpdate(BaseModel):
    name:            Optional[str] = Field(None, min_length=2, max_length=200)
    compatible_with: Optional[str] = None
    min_quantity:    Optional[int] = Field(None, ge=0)
    notes:           Optional[str] = None


class SparePartQuantityUpdate(BaseModel):
    quantity: int = Field(..., ge=0)


class SparePartResponse(BaseModel):
    id:              UUID
    tenant_id:       UUID
    name:            str
    compatible_with: Optional[str] = None
    quantity:        int
    min_quantity:    int
    notes:           Optional[str] = None
    created_at:      Optional[datetime] = None
    is_low_stock:    bool = False

    model_config = {"from_attributes": True}
