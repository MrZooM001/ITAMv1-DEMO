from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from uuid import UUID
from datetime import date, timedelta
from typing import Optional

from app.models.device import (
    Device, DeviceType, DeviceModel, DeviceStatus, DeviceTypeField,
)
from app.models.department import Department
from app.models.employee import Employee
from app.models.ticket import Ticket, TicketStatus
from app.models.software import DeviceOS, OperatingSystem, DeviceSoftware, Software
from app.models.device_hardware import DeviceHardware
from app.schemas.device import (
    DeviceCreate, DeviceUpdate, DeviceStatusUpdate,
    AssignEmployeeRequest, AssignDepartmentRequest,
    DeviceTypeCreate, DeviceTypeUpdate,
    DeviceModelCreate, DeviceModelUpdate,
    DeviceTypeFieldCreate, DeviceTypeFieldUpdate,
    OSInfo, DeviceResponse, DeviceSummaryResponse, DeviceDetailResponse,
    TicketSummary, InstalledSoftwareSummary,
)


# ----- Internal helpers -----

def _get_device_type_or_404(type_id: UUID, tenant_id: UUID, db: Session) -> DeviceType:
    dt = db.query(DeviceType).filter(
        DeviceType.id        == type_id,
        DeviceType.tenant_id == tenant_id,
    ).first()
    if not dt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device type not found")
    return dt


def _get_device_model_orm(device_id: UUID, tenant_id: UUID, db: Session) -> Device:
    device = db.query(Device).filter(
        Device.id        == device_id,
        Device.tenant_id == tenant_id,
    ).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return device


def _get_os_info(device_id: UUID, db: Session) -> Optional[OSInfo]:
    device_os = (
        db.query(DeviceOS)
        .filter(DeviceOS.device_id == device_id)
        .order_by(DeviceOS.is_primary.desc())
        .first()
    )
    if not device_os:
        return None
    os = db.query(OperatingSystem).filter(OperatingSystem.id == device_os.os_id).first()
    if not os:
        return None
    return OSInfo(
        id           = os.id,
        name         = os.name,
        architecture = os.architecture,
        install_date = device_os.install_date,
    )


def _warranty_status(expiry: Optional[date]) -> str:
    if not expiry:
        return "no_warranty"
    days = (expiry - date.today()).days
    if days < 0:
        return "expired"
    if days <= 30:
        return "expiring_soon"
    return "valid"


def _build_summary(device: Device, db: Session) -> DeviceSummaryResponse:
    device_type = db.query(DeviceType).filter(DeviceType.id == device.device_type_id).first()

    dept_name = None
    if device.department_id:
        dept = db.query(Department).filter(Department.id == device.department_id).first()
        dept_name = dept.name if dept else None

    emp_name = None
    if device.employee_id:
        emp = db.query(Employee).filter(Employee.id == device.employee_id).first()
        emp_name = emp.full_name if emp else None

    open_tickets = db.query(Ticket).filter(
        Ticket.device_id == device.id,
        Ticket.status.in_([TicketStatus.open, TicketStatus.in_progress]),
    ).count()

    return DeviceSummaryResponse(
        id                = device.id,
        tenant_id         = device.tenant_id,
        name              = device.name,
        serial_number     = device.serial_number,
        status            = device.status,
        device_type_id    = device.device_type_id,
        device_model_id   = device.device_model_id,
        department_id     = device.department_id,
        employee_id       = device.employee_id,
        purchase_date     = device.purchase_date,
        warranty_expiry   = device.warranty_expiry,
        purchase_price    = device.purchase_price,
        notes             = device.notes,
        custom_attributes = device.custom_attributes,
        created_at        = device.created_at,
        operating_system  = _get_os_info(device.id, db),
        device_type_name  = device_type.name if device_type else None,
        department_name   = dept_name,
        employee_name     = emp_name,
        open_tickets      = open_tickets,
        warranty_status   = _warranty_status(device.warranty_expiry),
    )


def _build_detail(device: Device, db: Session) -> DeviceDetailResponse:
    summary = _build_summary(device, db)

    # Hardware snapshot — lightweight dict (no full schema needed here)
    hardware = None
    hw = db.query(DeviceHardware).filter(DeviceHardware.device_id == device.id).first()
    if hw:
        hardware = {
            "cpu_model":      hw.cpu_model,
            "cpu_cores":      hw.cpu_cores,
            "cpu_threads":    hw.cpu_threads,
            "cpu_speed_mhz":  hw.cpu_speed_mhz,
            "ram_total_mb":   hw.ram_total_mb,
            "ram_type":       hw.ram_type,
            "gpu_model":      hw.gpu_model,
            "eth_mac":        hw.eth_mac,
            "wifi_mac":       hw.wifi_mac,
            "storage":        hw.storage,
            "monitors":       hw.monitors,
            "speccy_scan_date": hw.speccy_scan_date.isoformat() if hw.speccy_scan_date else None,
        }

    # Installed software
    sw_rows = (
        db.query(DeviceSoftware, Software)
        .join(Software, DeviceSoftware.software_id == Software.id)
        .filter(DeviceSoftware.device_id == device.id)
        .order_by(Software.name)
        .all()
    )
    installed_software = [
        InstalledSoftwareSummary(
            id            = ds.id,
            software_id   = ds.software_id,
            software_name = sw.name,
            version       = ds.version,
        )
        for ds, sw in sw_rows
    ]

    # Open tickets
    open_tickets_list = (
        db.query(Ticket)
        .filter(
            Ticket.device_id == device.id,
            Ticket.status.in_([TicketStatus.open, TicketStatus.in_progress]),
        )
        .order_by(Ticket.created_at.desc())
        .all()
    )
    ticket_summaries = [
        TicketSummary(
            id            = t.id,
            ticket_number = t.ticket_number,
            title         = t.title,
            status        = t.status.value,
            priority      = t.priority.value,
        )
        for t in open_tickets_list
    ]

    return DeviceDetailResponse(
        **summary.model_dump(),
        hardware           = hardware,
        installed_software = installed_software,
        open_ticket_list   = ticket_summaries,
    )


# ----- Device Types -----

def create_device_type(request: DeviceTypeCreate, tenant_id: UUID, db: Session) -> DeviceType:
    existing = db.query(DeviceType).filter(
        DeviceType.name == request.name, DeviceType.tenant_id == tenant_id,
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Device type already exists")
    dt = DeviceType(tenant_id=tenant_id, name=request.name)
    db.add(dt)
    db.commit()
    db.refresh(dt)
    return dt


def get_device_types(tenant_id: UUID, db: Session) -> list[DeviceType]:
    return db.query(DeviceType).filter(DeviceType.tenant_id == tenant_id).all()


def update_device_type(type_id: UUID, request: DeviceTypeUpdate, tenant_id: UUID, db: Session) -> DeviceType:
    dt = _get_device_type_or_404(type_id, tenant_id, db)
    duplicate = db.query(DeviceType).filter(
        DeviceType.name == request.name, DeviceType.tenant_id == tenant_id, DeviceType.id != type_id,
    ).first()
    if duplicate:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Device type name already exists")
    dt.name = request.name
    db.commit()
    db.refresh(dt)
    return dt


def delete_device_type(type_id: UUID, tenant_id: UUID, db: Session) -> None:
    dt = _get_device_type_or_404(type_id, tenant_id, db)
    if db.query(Device).filter(Device.device_type_id == type_id).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete: device type is assigned to one or more devices",
        )
    db.delete(dt)
    db.commit()


# ----- Device Models -----

def create_device_model(request: DeviceModelCreate, tenant_id: UUID, db: Session) -> DeviceModel:
    _get_device_type_or_404(request.device_type_id, tenant_id, db)
    dm = DeviceModel(
        tenant_id      = tenant_id,
        device_type_id = request.device_type_id,
        manufacturer   = request.manufacturer,
        model_name     = request.model_name,
    )
    db.add(dm)
    db.commit()
    db.refresh(dm)
    return dm


def get_device_models(tenant_id: UUID, db: Session) -> list[DeviceModel]:
    return db.query(DeviceModel).filter(DeviceModel.tenant_id == tenant_id).all()


def update_device_model(model_id: UUID, request: DeviceModelUpdate, tenant_id: UUID, db: Session) -> DeviceModel:
    dm = db.query(DeviceModel).filter(
        DeviceModel.id == model_id, DeviceModel.tenant_id == tenant_id,
    ).first()
    if not dm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device model not found")
    if request.manufacturer is not None: dm.manufacturer = request.manufacturer
    if request.model_name   is not None: dm.model_name   = request.model_name
    db.commit()
    db.refresh(dm)
    return dm


def delete_device_model(model_id: UUID, tenant_id: UUID, db: Session) -> None:
    dm = db.query(DeviceModel).filter(
        DeviceModel.id == model_id, DeviceModel.tenant_id == tenant_id,
    ).first()
    if not dm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device model not found")
    if db.query(Device).filter(Device.device_model_id == model_id).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete: device model is assigned to one or more devices",
        )
    db.delete(dm)
    db.commit()


# ----- Device Type Fields -----

def get_type_fields(type_id: UUID, tenant_id: UUID, db: Session) -> list[DeviceTypeField]:
    _get_device_type_or_404(type_id, tenant_id, db)
    return (
        db.query(DeviceTypeField)
        .filter(DeviceTypeField.device_type_id == type_id)
        .order_by(DeviceTypeField.sort_order)
        .all()
    )


def create_type_field(
    type_id: UUID, request: DeviceTypeFieldCreate, tenant_id: UUID, db: Session,
) -> DeviceTypeField:
    _get_device_type_or_404(type_id, tenant_id, db)
    exists = db.query(DeviceTypeField).filter(
        DeviceTypeField.device_type_id == type_id,
        DeviceTypeField.field_key      == request.field_key,
    ).first()
    if exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Field key '{request.field_key}' already exists for this device type",
        )
    field = DeviceTypeField(
        tenant_id      = tenant_id,
        device_type_id = type_id,
        field_key      = request.field_key,
        label          = request.label,
        field_type     = request.field_type,
        options        = request.options,
        is_required    = request.is_required,
        sort_order     = request.sort_order,
    )
    db.add(field)
    db.commit()
    db.refresh(field)
    return field


def update_type_field(
    type_id: UUID, field_id: UUID, request: DeviceTypeFieldUpdate, tenant_id: UUID, db: Session,
) -> DeviceTypeField:
    _get_device_type_or_404(type_id, tenant_id, db)
    field = db.query(DeviceTypeField).filter(
        DeviceTypeField.id             == field_id,
        DeviceTypeField.device_type_id == type_id,
    ).first()
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")
    if request.label       is not None: field.label       = request.label
    if request.field_type  is not None: field.field_type  = request.field_type
    if request.options     is not None: field.options     = request.options
    if request.is_required is not None: field.is_required = request.is_required
    if request.sort_order  is not None: field.sort_order  = request.sort_order
    db.commit()
    db.refresh(field)
    return field


def delete_type_field(type_id: UUID, field_id: UUID, tenant_id: UUID, db: Session) -> None:
    _get_device_type_or_404(type_id, tenant_id, db)
    field = db.query(DeviceTypeField).filter(
        DeviceTypeField.id             == field_id,
        DeviceTypeField.device_type_id == type_id,
    ).first()
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")
    db.delete(field)
    db.commit()


# ----- Devices -----

def create_device(request: DeviceCreate, tenant_id: UUID, db: Session) -> DeviceResponse:
    _get_device_type_or_404(request.device_type_id, tenant_id, db)

    if request.department_id:
        dept = db.query(Department).filter(
            Department.id == request.department_id, Department.tenant_id == tenant_id,
        ).first()
        if not dept:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    if request.employee_id:
        emp = db.query(Employee).filter(
            Employee.id == request.employee_id, Employee.tenant_id == tenant_id,
        ).first()
        if not emp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
        if not request.department_id and emp.department_id:
            request.department_id = emp.department_id

    device = Device(
        tenant_id         = tenant_id,
        name              = request.name,
        device_type_id    = request.device_type_id,
        device_model_id   = request.device_model_id,
        serial_number     = request.serial_number,
        department_id     = request.department_id,
        employee_id       = request.employee_id,
        purchase_date     = request.purchase_date,
        warranty_expiry   = request.warranty_expiry,
        purchase_price    = request.purchase_price,
        notes             = request.notes,
        custom_attributes = request.custom_attributes or {},
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return DeviceResponse(
        id                = device.id,
        tenant_id         = device.tenant_id,
        name              = device.name,
        serial_number     = device.serial_number,
        status            = device.status,
        device_type_id    = device.device_type_id,
        device_model_id   = device.device_model_id,
        department_id     = device.department_id,
        employee_id       = device.employee_id,
        purchase_date     = device.purchase_date,
        warranty_expiry   = device.warranty_expiry,
        purchase_price    = device.purchase_price,
        notes             = device.notes,
        custom_attributes = device.custom_attributes,
        created_at        = device.created_at,
        operating_system  = None,
    )


def get_devices(
    tenant_id:     UUID,
    db:            Session,
    limit:         int           = 20,
    offset:        int           = 0,
    device_status: str           = None,
    department_id: UUID          = None,
) -> tuple[list[DeviceSummaryResponse], int]:
    query = db.query(Device).filter(Device.tenant_id == tenant_id)
    if device_status:  query = query.filter(Device.status        == device_status)
    if department_id:  query = query.filter(Device.department_id == department_id)
    query = query.order_by(Device.created_at.desc())
    total   = query.count()
    devices = query.offset(offset).limit(limit).all()
    return [_build_summary(d, db) for d in devices], total


def get_device(device_id: UUID, tenant_id: UUID, db: Session) -> DeviceDetailResponse:
    device = _get_device_model_orm(device_id, tenant_id, db)
    return _build_detail(device, db)


def update_device(device_id: UUID, request: DeviceUpdate, tenant_id: UUID, db: Session) -> DeviceResponse:
    device = _get_device_model_orm(device_id, tenant_id, db)
    if request.name              is not None: device.name              = request.name
    if request.device_model_id   is not None: device.device_model_id   = request.device_model_id
    if request.serial_number     is not None: device.serial_number     = request.serial_number
    if request.purchase_date     is not None: device.purchase_date     = request.purchase_date
    if request.warranty_expiry   is not None: device.warranty_expiry   = request.warranty_expiry
    if request.purchase_price    is not None: device.purchase_price    = request.purchase_price
    if request.notes             is not None: device.notes             = request.notes
    if request.custom_attributes is not None: device.custom_attributes = request.custom_attributes
    db.commit()
    db.refresh(device)
    return DeviceResponse(
        id                = device.id,
        tenant_id         = device.tenant_id,
        name              = device.name,
        serial_number     = device.serial_number,
        status            = device.status,
        device_type_id    = device.device_type_id,
        device_model_id   = device.device_model_id,
        department_id     = device.department_id,
        employee_id       = device.employee_id,
        purchase_date     = device.purchase_date,
        warranty_expiry   = device.warranty_expiry,
        purchase_price    = device.purchase_price,
        notes             = device.notes,
        custom_attributes = device.custom_attributes,
        created_at        = device.created_at,
        operating_system  = _get_os_info(device.id, db),
    )


def update_device_status(
    device_id: UUID, request: DeviceStatusUpdate, tenant_id: UUID, db: Session,
) -> DeviceResponse:
    device = _get_device_model_orm(device_id, tenant_id, db)

    if request.status == DeviceStatus.retired:
        open_tickets = db.query(Ticket).filter(
            Ticket.device_id == device_id,
            Ticket.status    == TicketStatus.in_progress,
        ).all()
        for ticket in open_tickets:
            ticket.status = TicketStatus.cancelled
        db.flush()

    device.status = request.status
    db.commit()
    db.refresh(device)
    return DeviceResponse(
        id=device.id, tenant_id=device.tenant_id, name=device.name,
        serial_number=device.serial_number, status=device.status,
        device_type_id=device.device_type_id, device_model_id=device.device_model_id,
        department_id=device.department_id, employee_id=device.employee_id,
        purchase_date=device.purchase_date, warranty_expiry=device.warranty_expiry,
        purchase_price=device.purchase_price, notes=device.notes,
        custom_attributes=device.custom_attributes, created_at=device.created_at,
        operating_system=_get_os_info(device.id, db),
    )


def assign_employee(
    device_id: UUID, request: AssignEmployeeRequest, tenant_id: UUID, db: Session,
) -> DeviceResponse:
    device = _get_device_model_orm(device_id, tenant_id, db)
    emp = db.query(Employee).filter(
        Employee.id        == request.employee_id,
        Employee.tenant_id == tenant_id,
        Employee.is_active == True,
    ).first()
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    device.employee_id = emp.id
    if emp.department_id:
        device.department_id = emp.department_id
    db.commit()
    db.refresh(device)
    return DeviceResponse(
        id=device.id, tenant_id=device.tenant_id, name=device.name,
        serial_number=device.serial_number, status=device.status,
        device_type_id=device.device_type_id, device_model_id=device.device_model_id,
        department_id=device.department_id, employee_id=device.employee_id,
        purchase_date=device.purchase_date, warranty_expiry=device.warranty_expiry,
        purchase_price=device.purchase_price, notes=device.notes,
        custom_attributes=device.custom_attributes, created_at=device.created_at,
        operating_system=_get_os_info(device.id, db),
    )


def assign_department(
    device_id: UUID, request: AssignDepartmentRequest, tenant_id: UUID, db: Session,
) -> DeviceResponse:
    device = _get_device_model_orm(device_id, tenant_id, db)
    dept = db.query(Department).filter(
        Department.id        == request.department_id,
        Department.tenant_id == tenant_id,
    ).first()
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    device.department_id = dept.id
    device.employee_id   = None
    db.commit()
    db.refresh(device)
    return DeviceResponse(
        id=device.id, tenant_id=device.tenant_id, name=device.name,
        serial_number=device.serial_number, status=device.status,
        device_type_id=device.device_type_id, device_model_id=device.device_model_id,
        department_id=device.department_id, employee_id=device.employee_id,
        purchase_date=device.purchase_date, warranty_expiry=device.warranty_expiry,
        purchase_price=device.purchase_price, notes=device.notes,
        custom_attributes=device.custom_attributes, created_at=device.created_at,
        operating_system=_get_os_info(device.id, db),
    )


def get_expiring_warranty(tenant_id: UUID, db: Session, days: int = 30) -> list[Device]:
    expiry_threshold = date.today() + timedelta(days=days)
    return (
        db.query(Device)
        .filter(
            Device.tenant_id      == tenant_id,
            Device.warranty_expiry <= expiry_threshold,
            Device.warranty_expiry >= date.today(),
            Device.status         != DeviceStatus.retired,
        )
        .all()
    )


def get_device_tickets(device_id: UUID, tenant_id: UUID, db: Session) -> list[Ticket]:
    device = _get_device_model_orm(device_id, tenant_id, db)
    return (
        db.query(Ticket)
        .filter(Ticket.device_id == device.id)
        .order_by(Ticket.created_at.desc())
        .all()
    )


def delete_device(device_id: UUID, tenant_id: UUID, db: Session) -> None:
    device = _get_device_model_orm(device_id, tenant_id, db)
    open_tickets = db.query(Ticket).filter(
        Ticket.device_id == device_id,
        Ticket.status.in_([TicketStatus.open, TicketStatus.in_progress]),
    ).count()
    if open_tickets > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete device with {open_tickets} open ticket(s)",
        )
    db.delete(device)
    db.commit()


def bulk_delete_devices(
    device_ids: list[UUID],
    tenant_id:  UUID,
    db:         Session,
) -> dict:
    """
    Atomically attempt deletion of multiple devices.
    Returns a partial-failure report — each ID gets success/error status.
    The entire batch is committed only once; individual failures are caught per ID.
    """
    from app.schemas.device import BulkDeleteResult

    results: list[BulkDeleteResult] = []
    deleted = 0
    failed  = 0

    for device_id in device_ids:
        # Use a nested savepoint so one failure doesn't abort the whole tx
        try:
            with db.begin_nested():
                device = db.query(Device).filter(
                    Device.id        == device_id,
                    Device.tenant_id == tenant_id,
                ).first()

                if not device:
                    raise ValueError("Device not found")

                open_tickets = db.query(Ticket).filter(
                    Ticket.device_id == device_id,
                    Ticket.status.in_([TicketStatus.open, TicketStatus.in_progress]),
                ).count()

                if open_tickets > 0:
                    raise ValueError(
                        f"Has {open_tickets} open ticket(s) — close them first"
                    )

                db.delete(device)

            results.append(BulkDeleteResult(id=device_id, success=True))
            deleted += 1

        except Exception as exc:
            results.append(BulkDeleteResult(id=device_id, success=False, error=str(exc)))
            failed += 1

    db.commit()
    return {"deleted": deleted, "failed": failed, "results": results}
