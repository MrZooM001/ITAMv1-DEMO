from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status
from uuid import UUID

from app.models.employee import Employee
from app.models.department import Department
from app.models.device import Device
from app.models.ticket import Ticket, TicketStatus
from app.schemas.employee import (
    EmployeeCreate, EmployeeUpdate,
    EmployeeSummaryResponse, EmployeeDetailResponse,
    AssignedDeviceInfo, TicketInfo,
)


def create_employee(request: EmployeeCreate, tenant_id: UUID, db: Session) -> Employee:
    if request.department_id:
        dept = db.query(Department).filter(
            Department.id        == request.department_id,
            Department.tenant_id == tenant_id,
        ).first()
        if not dept:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    employee = Employee(
        tenant_id     = tenant_id,
        department_id = request.department_id,
        full_name     = request.full_name,
        email         = request.email,
        phone         = request.phone,
        job_title     = request.job_title,
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


def get_employees(
    tenant_id:     UUID,
    db:            Session,
    limit:         int        = 20,
    offset:        int        = 0,
    department_id: UUID | None = None,
    search:        str | None  = None,
    is_active:     bool | None = None,
) -> tuple[list[EmployeeSummaryResponse], int]:
    """
    Returns employees with counts computed via correlated subqueries.
    No N+1 — all counts resolved in a single SQL statement.
    """
    dept_name_sq = (
        db.query(Department.name)
        .filter(Department.id == Employee.department_id)
        .correlate(Employee)
        .scalar_subquery()
    )
    device_count_sq = (
        db.query(func.count(Device.id))
        .filter(Device.employee_id == Employee.id)
        .correlate(Employee)
        .scalar_subquery()
    )
    open_tickets_sq = (
        db.query(func.count(Ticket.id))
        .join(Device, Ticket.device_id == Device.id)
        .filter(
            Device.employee_id == Employee.id,
            Ticket.status.in_([TicketStatus.open, TicketStatus.in_progress]),
        )
        .correlate(Employee)
        .scalar_subquery()
    )

    query = db.query(
        Employee,
        dept_name_sq.label("department_name"),
        device_count_sq.label("device_count"),
        open_tickets_sq.label("open_tickets"),
    ).filter(Employee.tenant_id == tenant_id)

    if department_id:      query = query.filter(Employee.department_id == department_id)
    if search:             query = query.filter(Employee.full_name.ilike(f"%{search}%"))
    if is_active is not None: query = query.filter(Employee.is_active == is_active)

    query = query.order_by(Employee.full_name)

    count_q = db.query(func.count(Employee.id)).filter(Employee.tenant_id == tenant_id)
    if department_id:      count_q = count_q.filter(Employee.department_id == department_id)
    if search:             count_q = count_q.filter(Employee.full_name.ilike(f"%{search}%"))
    if is_active is not None: count_q = count_q.filter(Employee.is_active == is_active)
    total = count_q.scalar()

    rows = query.offset(offset).limit(limit).all()

    items = [
        EmployeeSummaryResponse(
            id              = e.id,
            tenant_id       = e.tenant_id,
            department_id   = e.department_id,
            full_name       = e.full_name,
            email           = e.email,
            phone           = e.phone,
            job_title       = e.job_title,
            is_active       = e.is_active,
            created_at      = e.created_at,
            department_name = dept_name,
            device_count    = dev_count or 0,
            open_tickets    = open_t or 0,
        )
        for e, dept_name, dev_count, open_t in rows
    ]
    return items, total


def get_employee(employee_id: UUID, tenant_id: UUID, db: Session) -> EmployeeDetailResponse:
    """Returns a single employee with full device and ticket details."""
    employee = db.query(Employee).filter(
        Employee.id        == employee_id,
        Employee.tenant_id == tenant_id,
    ).first()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    dept_name = None
    if employee.department_id:
        dept = db.query(Department).filter(Department.id == employee.department_id).first()
        dept_name = dept.name if dept else None

    devices = db.query(Device).filter(Device.employee_id == employee_id).all()

    open_tickets = (
        db.query(Ticket)
        .join(Device, Ticket.device_id == Device.id)
        .filter(
            Device.employee_id == employee_id,
            Ticket.status.in_([TicketStatus.open, TicketStatus.in_progress]),
        )
        .all()
    )

    return EmployeeDetailResponse(
        id               = employee.id,
        tenant_id        = employee.tenant_id,
        department_id    = employee.department_id,
        full_name        = employee.full_name,
        email            = employee.email,
        phone            = employee.phone,
        job_title        = employee.job_title,
        is_active        = employee.is_active,
        created_at       = employee.created_at,
        department_name  = dept_name,
        device_count     = len(devices),
        open_tickets     = len(open_tickets),
        assigned_devices = [
            AssignedDeviceInfo(id=d.id, name=d.name, status=d.status.value)
            for d in devices
        ],
        open_ticket_list = [
            TicketInfo(
                id            = t.id,
                ticket_number = t.ticket_number,
                title         = t.title,
                status        = t.status.value,
                priority      = t.priority.value,
            )
            for t in open_tickets
        ],
    )


def update_employee(
    employee_id: UUID, request: EmployeeUpdate, tenant_id: UUID, db: Session
) -> Employee:
    employee = db.query(Employee).filter(
        Employee.id        == employee_id,
        Employee.tenant_id == tenant_id,
    ).first()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    if request.department_id:
        dept = db.query(Department).filter(
            Department.id        == request.department_id,
            Department.tenant_id == tenant_id,
        ).first()
        if not dept:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
        employee.department_id = request.department_id

    if request.full_name  is not None: employee.full_name  = request.full_name
    if request.email      is not None: employee.email      = request.email
    if request.phone      is not None: employee.phone      = request.phone
    if request.job_title  is not None: employee.job_title  = request.job_title
    if request.is_active  is not None: employee.is_active  = request.is_active

    db.commit()
    db.refresh(employee)
    return employee


def delete_employee(employee_id: UUID, tenant_id: UUID, db: Session) -> None:
    employee = db.query(Employee).filter(
        Employee.id        == employee_id,
        Employee.tenant_id == tenant_id,
    ).first()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    device_count = db.query(func.count(Device.id)).filter(
        Device.employee_id == employee_id
    ).scalar()

    if device_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete employee with {device_count} assigned device(s), reassign them first",
        )

    db.delete(employee)
    db.commit()
