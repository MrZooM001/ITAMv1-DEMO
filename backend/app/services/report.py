from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from uuid import UUID
from datetime import datetime, date, timezone, timedelta
from typing import Optional

from app.models.device import Device, DeviceType, DeviceModel, DeviceStatus
from app.models.department import Department
from app.models.employee import Employee
from app.models.software import (
    DeviceOS,
    OperatingSystem,
    Software,
    SoftwareLicense,
    DeviceSoftware,
)
from app.models.ticket import Ticket, TicketStatus, TicketPriority
from app.models.user import User
from app.schemas.report import (
    AssetInventoryItem,
    AssetInventoryReport,
    WarrantyItem,
    WarrantyReport,
    SLAByPriority,
    SLAByTechnician,
    SLAReport,
    LicenseUtilizationItem,
    LicenseUtilizationReport,
)


def get_assets_inventory(
    tenant_id: UUID,
    db: Session,
    department_id: Optional[UUID] = None,
    status: Optional[str] = None,
) -> AssetInventoryReport:

    query = (
        db.query(Device)
        .options(
            joinedload(Device.device_type),
            joinedload(Device.device_model),
            joinedload(Device.department),
            joinedload(Device.employee),
            joinedload(Device.os).joinedload(DeviceOS.os),
        )
        .filter(Device.tenant_id == tenant_id)
    )
    if department_id:
        query = query.filter(Device.department_id == department_id)
    if status:
        query = query.filter(Device.status == status)
    devices = query.all()

    items = []
    for d in devices:
        os_name = d.os[0].os.name if d.os and d.os[0].os else None
        device_model = None
        if d.device_model:
            device_model = f"{d.device_model.manufacturer or ''} {d.device_model.model_name}".strip()

        items.append(
            AssetInventoryItem(
                device_id=d.id,
                device_name=d.name,
                device_type=d.device_type.name if d.device_type else None,
                device_model=device_model,
                serial_number=d.serial_number,
                status=d.status,
                department_name=d.department.name if d.department else None,
                employee_name=d.employee.full_name if d.employee else None,
                purchase_date=d.purchase_date,
                purchase_price=d.purchase_price,
                warranty_expiry=d.warranty_expiry,
                os_name=os_name,
            )
        )

    return AssetInventoryReport(
        total_devices=len(devices),
        active_devices=sum(1 for d in devices if d.status == DeviceStatus.active),
        in_maintenance=sum(
            1 for d in devices if d.status == DeviceStatus.in_maintenance
        ),
        retired_devices=sum(1 for d in devices if d.status == DeviceStatus.retired),
        generated_at=datetime.now(timezone.utc),
        items=items,
    )


def get_warranty_report(
    tenant_id: UUID,
    db: Session,
    department_id: Optional[UUID] = None,
) -> WarrantyReport:

    query = (
        db.query(Device)
        .options(joinedload(Device.department), joinedload(Device.employee))
        .filter(Device.tenant_id == tenant_id, Device.status != DeviceStatus.retired)
    )
    if department_id:
        query = query.filter(Device.department_id == department_id)
    devices = query.all()

    today = date.today()
    items = []
    expired = expiring_soon = valid = 0

    for d in devices:
        days_remaining = None
        warranty_status = "no_warranty"
        if d.warranty_expiry:
            days_remaining = (d.warranty_expiry - today).days
            if days_remaining < 0:
                warranty_status = "expired"
                expired += 1
            elif days_remaining <= 30:
                warranty_status = "expiring_soon"
                expiring_soon += 1
            else:
                warranty_status = "valid"
                valid += 1

        items.append(
            WarrantyItem(
                device_id=d.id,
                device_name=d.name,
                serial_number=d.serial_number,
                department_name=d.department.name if d.department else None,
                employee_name=d.employee.full_name if d.employee else None,
                warranty_expiry=d.warranty_expiry,
                days_remaining=days_remaining,
                status=warranty_status,
            )
        )

    items.sort(key=lambda x: (x.days_remaining is None, x.days_remaining or 0))

    return WarrantyReport(
        total_devices=len(devices),
        expired=expired,
        expiring_soon=expiring_soon,
        valid=valid,
        generated_at=datetime.now(timezone.utc),
        items=items,
    )


def get_sla_report(tenant_id: UUID, db: Session) -> SLAReport:
    """
    SLA Report:
    - متوسط وقت حل التذاكر بالساعات (لحظة الفتح → لحظة الحل)
    - مقسّم حسب الـ priority والـ technician
    """

    tickets = (
        db.query(Ticket)
        .options(joinedload(Ticket.updates))
        .filter(Ticket.tenant_id == tenant_id)
        .all()
    )

    total = len(tickets)
    resolved = [
        t for t in tickets if t.status in (TicketStatus.resolved, TicketStatus.closed)
    ]
    open_count = total - len(resolved)

    def resolution_hours(t: Ticket) -> Optional[float]:
        if t.resolved_at and t.created_at:
            delta = t.resolved_at - t.created_at
            return round(delta.total_seconds() / 3600, 2)
        return None

    # ----- By Priority -----
    by_priority = []
    for priority in TicketPriority:
        p_tickets = [t for t in tickets if t.priority == priority]
        p_resolved = [
            t
            for t in p_tickets
            if t.status in (TicketStatus.resolved, TicketStatus.closed)
        ]
        hours = [h for t in p_resolved if (h := resolution_hours(t)) is not None]

        by_priority.append(
            SLAByPriority(
                priority=priority.value,
                total_tickets=len(p_tickets),
                resolved_tickets=len(p_resolved),
                avg_resolution_hours=(
                    round(sum(hours) / len(hours), 2) if hours else None
                ),
                min_resolution_hours=round(min(hours), 2) if hours else None,
                max_resolution_hours=round(max(hours), 2) if hours else None,
            )
        )

    # ----- By Technician -----
    tech_ids = {t.assigned_to for t in tickets if t.assigned_to}
    users = (
        {u.id: u for u in db.query(User).filter(User.id.in_(tech_ids)).all()}
        if tech_ids
        else {}
    )

    by_technician = []
    for tech_id in tech_ids:
        t_tickets = [t for t in tickets if t.assigned_to == tech_id]
        t_resolved = [
            t
            for t in t_tickets
            if t.status in (TicketStatus.resolved, TicketStatus.closed)
        ]
        hours = [h for t in t_resolved if (h := resolution_hours(t)) is not None]
        user = users.get(tech_id)

        by_technician.append(
            SLAByTechnician(
                technician_id=tech_id,
                technician_name=user.full_name if user else "Unknown",
                assigned_tickets=len(t_tickets),
                resolved_tickets=len(t_resolved),
                avg_resolution_hours=(
                    round(sum(hours) / len(hours), 2) if hours else None
                ),
            )
        )

    by_technician.sort(key=lambda x: x.resolved_tickets, reverse=True)

    all_hours = [h for t in resolved if (h := resolution_hours(t)) is not None]

    return SLAReport(
        total_tickets=total,
        resolved_tickets=len(resolved),
        open_tickets=open_count,
        avg_resolution_hours=(
            round(sum(all_hours) / len(all_hours), 2) if all_hours else None
        ),
        by_priority=by_priority,
        by_technician=by_technician,
        generated_at=datetime.now(timezone.utc),
    )


def get_license_utilization(tenant_id: UUID, db: Session) -> LicenseUtilizationReport:
    """
    License Utilization:
    - كل software: كم seat اشتريت vs كم جهاز مثبّت
    """

    software_list = (
        db.query(Software)
        .options(joinedload(Software.licenses), joinedload(Software.device_software))
        .filter(Software.tenant_id == tenant_id)
        .all()
    )

    today = date.today()
    items = []
    over_utilized = expiring_count = 0

    for sw in software_list:
        used_seats = len(sw.device_software)
        license = sw.licenses[0] if sw.licenses else None
        total_seats = license.seats if license else None
        expiry = license.expiry_date if license else None
        days_rem = (expiry - today).days if expiry else None

        avail = (total_seats - used_seats) if total_seats is not None else None
        pct = round((used_seats / total_seats) * 100, 1) if total_seats else None

        if total_seats is not None and used_seats > total_seats:
            status = "over"
            over_utilized += 1
        elif days_rem is not None and days_rem <= 30:
            status = "expiring"
            expiring_count += 1
        elif days_rem is not None and days_rem < 0:
            status = "expired"
        elif license:
            status = "ok"
        else:
            status = "no_license"

        items.append(
            LicenseUtilizationItem(
                software_name=sw.name,
                vendor=sw.vendor,
                license_type=license.license_type if license else None,
                total_seats=total_seats,
                used_seats=used_seats,
                available_seats=avail,
                utilization_pct=pct,
                expiry_date=expiry,
                days_remaining=days_rem,
                status=status,
            )
        )

    items.sort(key=lambda x: (x.utilization_pct or 0), reverse=True)

    return LicenseUtilizationReport(
        total_software=len(software_list),
        licensed_software=sum(1 for s in software_list if s.licenses),
        over_utilized=over_utilized,
        expiring_soon=expiring_count,
        generated_at=datetime.now(timezone.utc),
        items=items,
    )


def _get_os_name(device_id: UUID, db: Session) -> Optional[str]:
    device_os = (
        db.query(DeviceOS)
        .filter(
            DeviceOS.device_id == device_id,
        )
        .first()
    )
    if not device_os:
        return None
    os = db.query(OperatingSystem).filter(OperatingSystem.id == device_os.os_id).first()
    return os.name if os else None


def get_assets_inventory(
    tenant_id: UUID,
    db: Session,
    department_id: Optional[UUID] = None,
    status: Optional[str] = None,
) -> AssetInventoryReport:

    query = db.query(Device).filter(Device.tenant_id == tenant_id)
    if department_id:
        query = query.filter(Device.department_id == department_id)
    if status:
        query = query.filter(Device.status == status)

    devices = query.all()

    items = []
    for device in devices:
        # Device Type
        device_type = (
            db.query(DeviceType).filter(DeviceType.id == device.device_type_id).first()
        )

        # Device Model
        device_model = None
        if device.device_model_id:
            model = (
                db.query(DeviceModel)
                .filter(DeviceModel.id == device.device_model_id)
                .first()
            )
            if model:
                device_model = f"{model.manufacturer or ''} {model.model_name}".strip()

        # Department
        department_name = None
        if device.department_id:
            dept = (
                db.query(Department)
                .filter(Department.id == device.department_id)
                .first()
            )
            department_name = dept.name if dept else None

        # Employee
        employee_name = None
        if device.employee_id:
            emp = db.query(Employee).filter(Employee.id == device.employee_id).first()
            employee_name = emp.full_name if emp else None

        items.append(
            AssetInventoryItem(
                device_id=device.id,
                device_name=device.name,
                device_type=device_type.name if device_type else None,
                device_model=device_model,
                serial_number=device.serial_number,
                status=device.status,
                department_name=department_name,
                employee_name=employee_name,
                purchase_date=device.purchase_date,
                purchase_price=device.purchase_price,
                warranty_expiry=device.warranty_expiry,
                os_name=_get_os_name(device.id, db),
            )
        )

    return AssetInventoryReport(
        total_devices=len(devices),
        active_devices=sum(1 for d in devices if d.status == DeviceStatus.active),
        in_maintenance=sum(
            1 for d in devices if d.status == DeviceStatus.in_maintenance
        ),
        retired_devices=sum(1 for d in devices if d.status == DeviceStatus.retired),
        generated_at=datetime.now(timezone.utc),
        items=items,
    )


def get_warranty_report(
    tenant_id: UUID,
    db: Session,
    department_id: Optional[UUID] = None,
) -> WarrantyReport:

    query = db.query(Device).filter(
        Device.tenant_id == tenant_id,
        Device.status != DeviceStatus.retired,
    )
    if department_id:
        query = query.filter(Device.department_id == department_id)

    devices = query.all()
    today = date.today()
    items = []

    expired = 0
    expiring_soon = 0
    valid = 0

    for device in devices:
        days_remaining = None
        warranty_status = "no_warranty"

        if device.warranty_expiry:
            days_remaining = (device.warranty_expiry - today).days
            if days_remaining < 0:
                warranty_status = "expired"
                expired += 1
            elif days_remaining <= 30:
                warranty_status = "expiring_soon"
                expiring_soon += 1
            else:
                warranty_status = "valid"
                valid += 1

        # Department
        department_name = None
        if device.department_id:
            dept = (
                db.query(Department)
                .filter(Department.id == device.department_id)
                .first()
            )
            department_name = dept.name if dept else None

        # Employee
        employee_name = None
        if device.employee_id:
            emp = db.query(Employee).filter(Employee.id == device.employee_id).first()
            employee_name = emp.full_name if emp else None

        items.append(
            WarrantyItem(
                device_id=device.id,
                device_name=device.name,
                serial_number=device.serial_number,
                department_name=department_name,
                employee_name=employee_name,
                warranty_expiry=device.warranty_expiry,
                days_remaining=days_remaining,
                status=warranty_status,
            )
        )

    # ترتيب: الأقرب للانتهاء أولاً
    items.sort(key=lambda x: (x.days_remaining is None, x.days_remaining or 0))

    return WarrantyReport(
        total_devices=len(devices),
        expired=expired,
        expiring_soon=expiring_soon,
        valid=valid,
        generated_at=datetime.now(timezone.utc),
        items=items,
    )
