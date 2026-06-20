from pydantic import BaseModel
from uuid import UUID
from typing import Optional


class DeviceImportResultResponse(BaseModel):
    file:        str
    action:      str                  # "created" | "updated" | "error"
    device_id:   Optional[str] = None
    device_name: Optional[str] = None
    error:       Optional[str] = None


class BulkImportResponse(BaseModel):
    department_id: UUID
    total:         int
    created:       int
    updated:       int
    errors:        int
    results:       list[DeviceImportResultResponse]
