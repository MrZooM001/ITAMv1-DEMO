from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app.core.dependencies import get_current_user, require_technician
from app.models.user import User
from app.schemas.device_hardware import DeviceHardwareResponse, DeviceHardwareUpdate
from app.services import device_hardware as hardware_service


router = APIRouter(prefix="/devices", tags=["Device Hardware"])


@router.post("/{device_id}/hardware", response_model=DeviceHardwareResponse)
async def import_speccy(
    device_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(require_technician),
    db: Session = Depends(get_db),
):
    if not file.filename.endswith(".xml"):
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only XML files are accepted",
        )

    xml_content = await file.read()
    if len(xml_content) > 10 * 1024 * 1024:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds 10MB limit",
        )

    return hardware_service.import_from_speccy(
        device_id, current_user.tenant_id, xml_content, db
    )


@router.get("/{device_id}/hardware", response_model=DeviceHardwareResponse)
def get_hardware(
    device_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return hardware_service.get_hardware(device_id, current_user.tenant_id, db)


@router.put("/{device_id}/hardware", response_model=DeviceHardwareResponse)
def update_hardware(
    device_id: UUID,
    request: DeviceHardwareUpdate,
    current_user: User = Depends(require_technician),
    db: Session = Depends(get_db),
):
    return hardware_service.update_hardware_manual(
        device_id, current_user.tenant_id, request, db
    )
