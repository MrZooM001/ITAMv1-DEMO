from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional

from app.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.core.pagination import Pagination, PaginatedResponse, make_response
from app.models.user import User
from app.schemas.department import (
    DepartmentCreate, DepartmentUpdate, DepartmentResponse,
    DepartmentSummaryResponse, DepartmentDetailResponse,
)
from app.services import department as department_service

router = APIRouter(prefix="/departments", tags=["Departments"])


@router.post("/", response_model=DepartmentResponse)
def create_department(
    request:      DepartmentCreate,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    return department_service.create_department(request, current_user.tenant_id, db)


@router.get("/", response_model=PaginatedResponse[DepartmentSummaryResponse])
def get_departments(
    search:       Optional[str] = Query(None, description="Search by name"),
    pagination:   Pagination    = Depends(),
    current_user: User          = Depends(get_current_user),
    db:           Session       = Depends(get_db),
):
    items, total = department_service.get_departments(
        current_user.tenant_id, db,
        limit=pagination.limit, offset=pagination.offset, search=search,
    )
    return make_response(items, total, pagination)


@router.get("/{department_id}", response_model=DepartmentDetailResponse)
def get_department(
    department_id: UUID,
    current_user:  User    = Depends(get_current_user),
    db:            Session = Depends(get_db),
):
    return department_service.get_department(department_id, current_user.tenant_id, db)


@router.put("/{department_id}", response_model=DepartmentResponse)
def update_department(
    department_id: UUID,
    request:       DepartmentUpdate,
    current_user:  User    = Depends(require_admin),
    db:            Session = Depends(get_db),
):
    return department_service.update_department(department_id, request, current_user.tenant_id, db)


@router.delete("/{department_id}")
def delete_department(
    department_id: UUID,
    current_user:  User    = Depends(require_admin),
    db:            Session = Depends(get_db),
):
    department_service.delete_department(department_id, current_user.tenant_id, db)
    return {"message": "Department deleted successfully"}
