from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional

from app.database import get_db
from app.core.dependencies import get_current_user, require_admin, require_technician
from app.core.pagination import Pagination, PaginatedResponse, make_response
from app.models.user import User
from app.schemas.software import (
    SoftwareCreate,
    SoftwareUpdate,
    SoftwareResponse,
    SoftwareLicenseCreate,
    SoftwareLicenseUpdate,
    SoftwareLicenseResponse,
    DeviceSoftwareCreate,
    DeviceSoftwareUpdate,
    DeviceSoftwareResponse,
)
from app.services import software as software_service

router = APIRouter(tags=["Software & Licenses"])


# ----- Software -----


@router.post("/software/", response_model=SoftwareResponse)
def create_software(
    request: SoftwareCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return software_service.create_software(request, current_user.tenant_id, db)


@router.get("/software/", response_model=PaginatedResponse[SoftwareResponse])
def get_software_list(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    is_common: Optional[bool] = Query(None),
    pagination: Pagination = Depends(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items, total = software_service.get_software_list(
        current_user.tenant_id,
        db,
        limit=pagination.limit,
        offset=pagination.offset,
        search=search,
        category=category,
        is_common=is_common,
    )
    return make_response(items, total, pagination)


@router.get("/software/{software_id}", response_model=SoftwareResponse)
def get_software(
    software_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return software_service.get_software(software_id, current_user.tenant_id, db)


@router.put("/software/{software_id}", response_model=SoftwareResponse)
def update_software(
    software_id: UUID,
    request: SoftwareUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return software_service.update_software(
        software_id, request, current_user.tenant_id, db
    )


@router.delete("/software/{software_id}")
def delete_software(
    software_id: UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    software_service.delete_software(software_id, current_user.tenant_id, db)
    return {"message": "Software deleted successfully"}


# ----- Licenses -----


@router.get("/software/licenses/expiring", response_model=list[SoftwareLicenseResponse])
def get_expiring_licenses(
    days: int = Query(30, ge=1, le=365, description="Days ahead to check"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """بيرجع الـ licenses اللي هتنتهي خلال N يوم (default: 30)."""
    return software_service.get_expiring_licenses(current_user.tenant_id, db, days)


@router.post("/software/{software_id}/licenses", response_model=SoftwareLicenseResponse)
def create_license(
    software_id: UUID,
    request: SoftwareLicenseCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return software_service.create_license(
        software_id, request, current_user.tenant_id, db
    )


@router.get(
    "/software/{software_id}/licenses", response_model=list[SoftwareLicenseResponse]
)
def get_licenses(
    software_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return software_service.get_licenses(software_id, current_user.tenant_id, db)


@router.put("/software/licenses/{license_id}", response_model=SoftwareLicenseResponse)
def update_license(
    license_id: UUID,
    request: SoftwareLicenseUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return software_service.update_license(
        license_id, request, current_user.tenant_id, db
    )


@router.delete("/software/licenses/{license_id}")
def delete_license(
    license_id: UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    software_service.delete_license(license_id, current_user.tenant_id, db)
    return {"message": "License deleted successfully"}


# ----- Device Software -----


@router.post("/devices/{device_id}/software", response_model=DeviceSoftwareResponse)
def install_software(
    device_id: UUID,
    request: DeviceSoftwareCreate,
    current_user: User = Depends(require_technician),
    db: Session = Depends(get_db),
):
    return software_service.install_software(
        device_id, request, current_user.tenant_id, db
    )


@router.get(
    "/devices/{device_id}/software", response_model=list[DeviceSoftwareResponse]
)
def get_device_software(
    device_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return software_service.get_device_software(device_id, current_user.tenant_id, db)


@router.put(
    "/devices/{device_id}/software/{ds_id}", response_model=DeviceSoftwareResponse
)
def update_device_software(
    device_id: UUID,
    ds_id: UUID,
    request: DeviceSoftwareUpdate,
    current_user: User = Depends(require_technician),
    db: Session = Depends(get_db),
):
    return software_service.update_device_software(
        ds_id, request, current_user.tenant_id, db
    )


@router.delete("/devices/{device_id}/software/{ds_id}")
def uninstall_software(
    device_id: UUID,
    ds_id: UUID,
    current_user: User = Depends(require_technician),
    db: Session = Depends(get_db),
):
    software_service.uninstall_software(ds_id, current_user.tenant_id, db)
    return {"message": "Software uninstalled successfully"}
