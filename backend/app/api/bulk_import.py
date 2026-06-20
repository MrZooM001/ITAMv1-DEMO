from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app.core.dependencies import require_technician
from app.models.user import User
from app.schemas.bulk_import import BulkImportResponse, DeviceImportResultResponse
from app.services.bulk_import import bulk_import_from_files, FileEntry

router = APIRouter(prefix="/devices", tags=["Bulk Import"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/bulk-import", response_model=BulkImportResponse)
async def bulk_import_devices(
    department_id: UUID             = Form(..., description="Target department for all imported devices"),
    files:         list[UploadFile] = File(..., description="Speccy XML files"),
    current_user:  User             = Depends(require_technician),
    db:            Session          = Depends(get_db),
):
    """
    Upload multiple Speccy XML files and import them into a chosen department.

    - `department_id` — chosen by the user from the UI
    - `files`         — one or more Speccy XML files
    - Device name     = filename without .xml
    - MAC exists      → UPDATE hardware
    - MAC not found   → CREATE new device
    """
    entries: list[FileEntry] = []

    for upload in files:
        content = await upload.read()

        if not content:
            continue

        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File '{upload.filename}' exceeds 10 MB limit",
            )

        filename = (upload.filename or "").strip()
        if not filename:
            continue

        entries.append(FileEntry(filename=filename, content=content))

    if not entries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid files found",
        )

    try:
        summary = bulk_import_from_files(
            files         = entries,
            department_id = department_id,
            tenant_id     = current_user.tenant_id,
            db            = db,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return BulkImportResponse(
        department_id = department_id,
        total         = summary.total,
        created       = summary.created,
        updated       = summary.updated,
        errors        = summary.errors,
        results       = [
            DeviceImportResultResponse(
                file        = r.file,
                action      = r.action,
                device_id   = r.device_id,
                device_name = r.device_name,
                error       = r.error,
            )
            for r in summary.results
        ],
    )
