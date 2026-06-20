from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


# --- Request Schemas ---
class TenantCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    slug: str = Field(
        ..., min_length=2, max_length=100, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
    )


class TenantUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    is_active: Optional[bool] = None


# --- Response Schemas ---
class TenantResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
