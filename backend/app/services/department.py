from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status
from uuid import UUID

from app.models.department import Department
from app.models.employee import Employee
from app.models.device import Device
from app.models.ticket import Ticket, TicketStatus
from app.schemas.department import (
    DepartmentCreate, DepartmentUpdate,
    DepartmentSummaryResponse, DepartmentDetailResponse,
    DeviceBasic, EmployeeBasic,
)


def create_department(request: DepartmentCreate, tenant_id: UUID, db: Session) -> Department:
    existing = db.query(Department).filter(
        Department.name      == request.name,
        Department.tenant_id == tenant_id,
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Department name already exists")

    dept = Department(tenant_id=tenant_id, name=request.name, notes=request.notes)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


def get_departments(
    tenant_id: UUID,
    db:        Session,
    limit:     int      = 20,
    offset:    int      = 0,
    search:    str      = None,
) -> tuple[list[DepartmentSummaryResponse], int]:
    """
    Returns departments with counts computed via correlated subqueries.
    No N+1 — all counts resolved in a single SQL statement.
    """
    emp_count_sq = (
        db.query(func.count(Employee.id))
        .filter(
            Employee.department_id == Department.id,
            Employee.is_active     == True,
        )
        .correlate(Department)
        .scalar_subquery()
    )

    dev_count_sq = (
        db.query(func.count(Device.id))
        .filter(Device.department_id == Department.id)
        .correlate(Department)
        .scalar_subquery()
    )

    open_tickets_sq = (
        db.query(func.count(Ticket.id))
        .join(Device, Ticket.device_id == Device.id)
        .filter(
            Device.department_id == Department.id,
            Ticket.status.in_([TicketStatus.open, TicketStatus.in_progress]),
        )
        .correlate(Department)
        .scalar_subquery()
    )

    query = db.query(
        Department,
        emp_count_sq.label("employee_count"),
        dev_count_sq.label("device_count"),
        open_tickets_sq.label("open_tickets"),
    ).filter(Department.tenant_id == tenant_id)

    if search:
        query = query.filter(Department.name.ilike(f"%{search}%"))

    query = query.order_by(Department.name)

    count_q = db.query(func.count(Department.id)).filter(Department.tenant_id == tenant_id)
    if search:
        count_q = count_q.filter(Department.name.ilike(f"%{search}%"))
    total = count_q.scalar()

    rows = query.offset(offset).limit(limit).all()

    return [
        DepartmentSummaryResponse(
            id             = dept.id,
            tenant_id      = dept.tenant_id,
            name           = dept.name,
            notes          = dept.notes,
            created_at     = dept.created_at,
            employee_count = emp or 0,
            device_count   = dev or 0,
            open_tickets   = tkt or 0,
        )
        for dept, emp, dev, tkt in rows
    ], total


def get_department(department_id: UUID, tenant_id: UUID, db: Session) -> DepartmentDetailResponse:
    """Returns a single department with full employee and device lists."""
    dept = db.query(Department).filter(
        Department.id        == department_id,
        Department.tenant_id == tenant_id,
    ).first()
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    employees = (
        db.query(Employee)
        .filter(Employee.department_id == department_id, Employee.is_active == True)
        .order_by(Employee.full_name)
        .all()
    )

    devices = (
        db.query(Device)
        .filter(Device.department_id == department_id)
        .order_by(Device.name)
        .all()
    )

    open_tickets = (
        db.query(func.count(Ticket.id))
        .join(Device, Ticket.device_id == Device.id)
        .filter(
            Device.department_id == department_id,
            Ticket.status.in_([TicketStatus.open, TicketStatus.in_progress]),
        )
        .scalar() or 0
    )

    return DepartmentDetailResponse(
        id             = dept.id,
        tenant_id      = dept.tenant_id,
        name           = dept.name,
        notes          = dept.notes,
        created_at     = dept.created_at,
        employee_count = len(employees),
        device_count   = len(devices),
        open_tickets   = open_tickets,
        employees      = [
            EmployeeBasic(id=e.id, full_name=e.full_name, job_title=e.job_title)
            for e in employees
        ],
        devices        = [
            DeviceBasic(id=d.id, name=d.name, status=d.status.value)
            for d in devices
        ],
    )


def update_department(
    department_id: UUID, request: DepartmentUpdate, tenant_id: UUID, db: Session
) -> Department:
    dept = db.query(Department).filter(
        Department.id        == department_id,
        Department.tenant_id == tenant_id,
    ).first()
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    if request.name and request.name != dept.name:
        existing = db.query(Department).filter(
            Department.name      == request.name,
            Department.tenant_id == tenant_id,
        ).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Department name already exists")
        dept.name = request.name

    if request.notes is not None:
        dept.notes = request.notes

    db.commit()
    db.refresh(dept)
    return dept


def delete_department(department_id: UUID, tenant_id: UUID, db: Session) -> None:
    dept = db.query(Department).filter(
        Department.id        == department_id,
        Department.tenant_id == tenant_id,
    ).first()
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    emp_count = db.query(func.count(Employee.id)).filter(
        Employee.department_id == department_id
    ).scalar()
    if emp_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete department with {emp_count} employee(s)",
        )

    dev_count = db.query(func.count(Device.id)).filter(
        Device.department_id == department_id
    ).scalar()
    if dev_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete department with {dev_count} device(s)",
        )

    db.delete(dept)
    db.commit()
