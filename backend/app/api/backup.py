from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_admin
from app.models.user import User
from app.services import backup as backup_service

router = APIRouter(prefix="/backup", tags=["Backup"])


@router.post("/trigger")
def trigger_backup(
    current_user: User = Depends(require_admin),
):
    try:
        result = backup_service.create_backup()
        return result
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/list")
def list_backups(
    current_user: User = Depends(require_admin),
):
    return backup_service.list_backups()


@router.post("/restore/{filename}")
def restore_backup(
    filename: str,
    current_user: User = Depends(require_admin),
):
    try:
        return backup_service.restore_backup(filename)
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except (RuntimeError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.delete("/{filename}")
def delete_backup(
    filename: str,
    current_user: User = Depends(require_admin),
):
    try:
        backup_service.delete_backup(filename)
        return {"message": f"Backup '{filename}' deleted successfully"}
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
