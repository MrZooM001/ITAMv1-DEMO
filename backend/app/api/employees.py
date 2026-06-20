from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional

from app.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.core.pagination import Pagination, PaginatedResponse, make_response
from app.models.user import User
from app.schemas.employee import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse,
    EmployeeSummaryResponse, EmployeeDetailResponse,
)
from app.services import employee as employee_service

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.post("/", response_model=EmployeeResponse)
def create_employee(
    request:      EmployeeCreate,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    return employee_service.create_employee(request, current_user.tenant_id, db)


@router.get("/", response_model=PaginatedResponse[EmployeeSummaryResponse])
def get_employees(
    department_id: Optional[UUID] = Query(None),
    search:        Optional[str]  = Query(None, description="Search by name"),
    is_active:     Optional[bool] = Query(None),
    pagination:    Pagination     = Depends(),
    current_user:  User           = Depends(get_current_user),
    db:            Session        = Depends(get_db),
):
    items, total = employee_service.get_employees(
        current_user.tenant_id, db,
        limit=pagination.limit, offset=pagination.offset,
        department_id=department_id, search=search, is_active=is_active,
    )
    return make_response(items, total, pagination)


@router.get("/{employee_id}", response_model=EmployeeDetailResponse)
def get_employee(
    employee_id:  UUID,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    return employee_service.get_employee(employee_id, current_user.tenant_id, db)


@router.put("/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id:  UUID,
    request:      EmployeeUpdate,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    return employee_service.update_employee(employee_id, request, current_user.tenant_id, db)


@router.delete("/{employee_id}")
def delete_employee(
    employee_id:  UUID,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    employee_service.delete_employee(employee_id, current_user.tenant_id, db)
    return {"message": "Employee deleted successfully"}
