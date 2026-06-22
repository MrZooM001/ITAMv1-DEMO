from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional

from app.database import get_db
from app.core.dependencies import get_current_user, require_admin, require_technician
from app.core.pagination import Pagination, PaginatedResponse, make_response
from app.models.user import User
from app.schemas.device import (
    DeviceCreate, DeviceUpdate, DeviceResponse,
    DeviceSummaryResponse, DeviceDetailResponse,
    DeviceStatusUpdate, AssignEmployeeRequest, AssignDepartmentRequest,
    DeviceTypeCreate, DeviceTypeUpdate, DeviceTypeResponse,
    DeviceModelCreate, DeviceModelUpdate, DeviceModelResponse,
    DeviceTypeFieldCreate, DeviceTypeFieldUpdate, DeviceTypeFieldResponse,
    BulkDeleteDevicesRequest, BulkDeleteDevicesResponse,
)
from app.services import device as device_service

router = APIRouter(prefix="/devices", tags=["Devices"])


# ── Device Types ───────────────────────────────────────────────
@router.post("/types", response_model=DeviceTypeResponse)
def create_device_type(
    request:      DeviceTypeCreate,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    return device_service.create_device_type(request, current_user.tenant_id, db)


@router.get("/types", response_model=list[DeviceTypeResponse])
def get_device_types(
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    return device_service.get_device_types(current_user.tenant_id, db)


@router.put("/types/{type_id}", response_model=DeviceTypeResponse)
def update_device_type(
    type_id:      UUID,
    request:      DeviceTypeUpdate,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    return device_service.update_device_type(type_id, request, current_user.tenant_id, db)


@router.delete("/types/{type_id}")
def delete_device_type(
    type_id:      UUID,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    device_service.delete_device_type(type_id, current_user.tenant_id, db)
    return {"message": "Device type deleted successfully"}


# ── Device Type Fields ─────────────────────────────────────────
@router.get("/types/{type_id}/fields", response_model=list[DeviceTypeFieldResponse])
def get_type_fields(
    type_id:      UUID,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    return device_service.get_type_fields(type_id, current_user.tenant_id, db)


@router.post("/types/{type_id}/fields", response_model=DeviceTypeFieldResponse)
def create_type_field(
    type_id:      UUID,
    request:      DeviceTypeFieldCreate,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    return device_service.create_type_field(type_id, request, current_user.tenant_id, db)


@router.put("/types/{type_id}/fields/{field_id}", response_model=DeviceTypeFieldResponse)
def update_type_field(
    type_id:      UUID,
    field_id:     UUID,
    request:      DeviceTypeFieldUpdate,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    return device_service.update_type_field(type_id, field_id, request, current_user.tenant_id, db)


@router.delete("/types/{type_id}/fields/{field_id}")
def delete_type_field(
    type_id:      UUID,
    field_id:     UUID,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    device_service.delete_type_field(type_id, field_id, current_user.tenant_id, db)
    return {"message": "Field deleted successfully"}


# ── Device Models ──────────────────────────────────────────────
@router.post("/models", response_model=DeviceModelResponse)
def create_device_model(
    request:      DeviceModelCreate,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    return device_service.create_device_model(request, current_user.tenant_id, db)


@router.get("/models", response_model=list[DeviceModelResponse])
def get_device_models(
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    return device_service.get_device_models(current_user.tenant_id, db)


@router.put("/models/{model_id}", response_model=DeviceModelResponse)
def update_device_model(
    model_id:     UUID,
    request:      DeviceModelUpdate,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    return device_service.update_device_model(model_id, request, current_user.tenant_id, db)


@router.delete("/models/{model_id}")
def delete_device_model(
    model_id:     UUID,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    device_service.delete_device_model(model_id, current_user.tenant_id, db)
    return {"message": "Device model deleted successfully"}


# ── Devices ────────────────────────────────────────────────────
@router.post("/", response_model=DeviceResponse)
def create_device(
    request:      DeviceCreate,
    current_user: User    = Depends(require_technician),
    db:           Session = Depends(get_db),
):
    return device_service.create_device(request, current_user.tenant_id, db)


@router.get("/", response_model=PaginatedResponse[DeviceSummaryResponse])
def get_devices(
    status:        Optional[str]  = Query(None, description="Filter by status: active, in_maintenance, retired"),
    department_id: Optional[UUID] = Query(None, description="Filter by department"),
    pagination:    Pagination     = Depends(),
    current_user:  User           = Depends(get_current_user),
    db:            Session        = Depends(get_db),
):
    items, total = device_service.get_devices(
        current_user.tenant_id, db,
        limit=pagination.limit, offset=pagination.offset,
        device_status=status, department_id=department_id,
    )
    return make_response(items, total, pagination)


@router.get("/expiring-warranty", response_model=list[DeviceResponse])
def get_expiring_warranty(
    days:         int     = Query(30),
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    return device_service.get_expiring_warranty(current_user.tenant_id, db, days)


@router.get("/{device_id}", response_model=DeviceDetailResponse)
def get_device(
    device_id:    UUID,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    return device_service.get_device(device_id, current_user.tenant_id, db)


@router.put("/{device_id}", response_model=DeviceResponse)
def update_device(
    device_id:    UUID,
    request:      DeviceUpdate,
    current_user: User    = Depends(require_technician),
    db:           Session = Depends(get_db),
):
    return device_service.update_device(device_id, request, current_user.tenant_id, db)


@router.put("/{device_id}/status", response_model=DeviceResponse)
def update_status(
    device_id:    UUID,
    request:      DeviceStatusUpdate,
    current_user: User    = Depends(require_technician),
    db:           Session = Depends(get_db),
):
    return device_service.update_device_status(device_id, request, current_user.tenant_id, db)


@router.put("/{device_id}/assign-employee", response_model=DeviceResponse)
def assign_employee(
    device_id:    UUID,
    request:      AssignEmployeeRequest,
    current_user: User    = Depends(require_technician),
    db:           Session = Depends(get_db),
):
    return device_service.assign_employee(device_id, request, current_user.tenant_id, db)


@router.put("/{device_id}/assign-department", response_model=DeviceResponse)
def assign_department(
    device_id:    UUID,
    request:      AssignDepartmentRequest,
    current_user: User    = Depends(require_technician),
    db:           Session = Depends(get_db),
):
    return device_service.assign_department(device_id, request, current_user.tenant_id, db)


@router.get("/{device_id}/tickets")
def get_device_tickets(
    device_id:    UUID,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    return device_service.get_device_tickets(device_id, current_user.tenant_id, db)


@router.delete("/bulk", response_model=BulkDeleteDevicesResponse)
def bulk_delete_devices(
    request:      BulkDeleteDevicesRequest,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    """
    Delete multiple devices in one atomic call.
    Returns a per-ID success/failure report so the frontend knows exactly which IDs failed and why.
    Replaces N parallel DELETE requests with a single round-trip.
    """
    return device_service.bulk_delete_devices(request.device_ids, current_user.tenant_id, db)


@router.delete("/{device_id}")
def delete_device(
    device_id:    UUID,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    device_service.delete_device(device_id, current_user.tenant_id, db)
    return {"message": "Device deleted successfully"}
