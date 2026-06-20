from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from uuid import UUID
from datetime import datetime, timezone
from typing import Optional

from app.models.ticket import (
    Ticket, TicketUpdate, TicketStatus, TicketPriority, SparePartUsage,
)
from app.models.inventory import SparePart
from app.models.device import Device, DeviceStatus
from app.models.department import Department
from app.models.user import User
from app.schemas.ticket import (
    TicketCreate, TicketStatusUpdate, TicketUpdateCreate,
    TicketAssign, TicketUpdate as TicketUpdateSchema,
    TicketUpdateResponse, SparePartUsageCreate, SparePartUsageResponse,
    TicketSummaryResponse, TicketDetailResponse,
)


# ----- Ticket Number Generator -----

def _generate_ticket_number(db: Session, tenant_id: UUID) -> str:
    from sqlalchemy import func, text

    year   = datetime.now(timezone.utc).year
    prefix = f"TKT-{year}-"

    lock_key = abs(hash(str(tenant_id))) % (2**31)
    db.execute(text(f"SELECT pg_advisory_xact_lock({lock_key})"))

    last_number: str | None = (
        db.query(func.max(Ticket.ticket_number))
        .filter(
            Ticket.tenant_id == tenant_id,
            Ticket.ticket_number.like(f"{prefix}%"),
        )
        .scalar()
    )

    if last_number:
        try:
            seq = int(last_number.split("-")[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    else:
        seq = 1

    return f"{prefix}{str(seq).zfill(4)}"


# ----- Internal helpers -----

def _add_update(
    ticket_id:  UUID,
    user_id:    UUID,
    note:       str,
    old_status: Optional[TicketStatus],
    new_status: Optional[TicketStatus],
    db:         Session,
):
    update = TicketUpdate(
        ticket_id  = ticket_id,
        updated_by = user_id,
        note       = note,
        old_status = old_status.value if old_status else None,
        new_status = new_status.value if new_status else None,
        created_at = datetime.now(timezone.utc),
    )
    db.add(update)


def _get_device_dept_name(device_id: Optional[UUID], db: Session) -> Optional[str]:
    """Resolve department name from a device's department_id."""
    if not device_id:
        return None
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device or not device.department_id:
        return None
    dept = db.query(Department).filter(Department.id == device.department_id).first()
    return dept.name if dept else None


def _build_summary(ticket: Ticket, db: Session) -> TicketSummaryResponse:
    """Build an enriched TicketSummaryResponse from an ORM Ticket object."""
    device_name     = None
    department_name = None
    if ticket.device_id:
        device = db.query(Device).filter(Device.id == ticket.device_id).first()
        if device:
            device_name = device.name
            if device.department_id:
                dept = db.query(Department).filter(Department.id == device.department_id).first()
                department_name = dept.name if dept else None

    assigned_to_name = None
    if ticket.assigned_to:
        assignee = db.query(User).filter(User.id == ticket.assigned_to).first()
        assigned_to_name = assignee.full_name if assignee else None

    updates_count = len(ticket.updates) if ticket.updates is not None else 0

    return TicketSummaryResponse(
        id               = ticket.id,
        tenant_id        = ticket.tenant_id,
        ticket_number    = ticket.ticket_number,
        title            = ticket.title,
        status           = ticket.status,
        priority         = ticket.priority,
        device_id        = ticket.device_id,
        device_name      = device_name,
        department_name  = department_name,
        assigned_to      = ticket.assigned_to,
        assigned_to_name = assigned_to_name,
        reported_by      = ticket.reported_by,
        resolved_at      = ticket.resolved_at,
        created_at       = ticket.created_at,
        updates_count    = updates_count,
    )


def _build_detail(ticket: Ticket, db: Session) -> TicketDetailResponse:
    """Build a full TicketDetailResponse including updates and spare parts."""
    summary = _build_summary(ticket, db)

    updates = [
        TicketUpdateResponse(
            id         = u.id,
            ticket_id  = u.ticket_id,
            updated_by = u.updated_by,
            note       = u.note,
            old_status = u.old_status,
            new_status = u.new_status,
            created_at = u.created_at,
        )
        for u in (ticket.updates or [])
    ]

    spare_parts = []
    for usage in (ticket.spare_parts or []):
        part = db.query(SparePart).filter(SparePart.id == usage.spare_part_id).first()
        spare_parts.append(SparePartUsageResponse(
            id              = usage.id,
            ticket_id       = usage.ticket_id,
            spare_part_id   = usage.spare_part_id,
            spare_part_name = part.name if part else None,
            quantity_used   = usage.quantity_used,
            used_at         = usage.used_at,
        ))

    return TicketDetailResponse(
        **summary.model_dump(),
        description = ticket.description,
        updated_at  = ticket.updated_at,
        updates     = updates,
        spare_parts = spare_parts,
    )


# ----- Public service functions -----

def create_ticket(
    request: TicketCreate, tenant_id: UUID, current_user: User, db: Session
) -> Ticket:
    if request.device_id:
        device = db.query(Device).filter(
            Device.id        == request.device_id,
            Device.tenant_id == tenant_id,
        ).first()
        if not device:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
        if device.status == DeviceStatus.retired:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot open a ticket for a retired device",
            )

    ticket = Ticket(
        tenant_id     = tenant_id,
        ticket_number = _generate_ticket_number(db, tenant_id),
        title         = request.title,
        description   = request.description,
        device_id     = request.device_id,
        reported_by   = request.reported_by,
        assigned_to   = request.assigned_to or current_user.id,
        priority      = request.priority,
        status        = TicketStatus.open,
    )
    db.add(ticket)
    db.flush()

    _add_update(ticket.id, current_user.id, "Ticket created", None, TicketStatus.open, db)

    db.commit()
    db.refresh(ticket)
    return ticket


def get_tickets(
    tenant_id:      UUID,
    db:             Session,
    limit:          int           = 20,
    offset:         int           = 0,
    ticket_status:  Optional[str] = None,
    priority:       Optional[str] = None,
    device_id:      Optional[UUID]= None,
    assigned_to_id: Optional[UUID]= None,
    department_id:  Optional[UUID]= None,
) -> tuple[list[TicketSummaryResponse], int]:
    from sqlalchemy.orm import selectinload

    query = (
        db.query(Ticket)
        .options(selectinload(Ticket.updates))
        .filter(Ticket.tenant_id == tenant_id)
    )
    if ticket_status:   query = query.filter(Ticket.status      == ticket_status)
    if priority:        query = query.filter(Ticket.priority     == priority)
    if device_id:       query = query.filter(Ticket.device_id    == device_id)
    if assigned_to_id:  query = query.filter(Ticket.assigned_to  == assigned_to_id)

    if department_id:
        # Join through Device to match its department_id
        device_ids = (
            db.query(Device.id)
            .filter(Device.department_id == department_id, Device.tenant_id == tenant_id)
            .subquery()
        )
        query = query.filter(Ticket.device_id.in_(device_ids))

    query = query.order_by(Ticket.created_at.desc())
    total = query.count()
    tickets = query.offset(offset).limit(limit).all()

    return [_build_summary(t, db) for t in tickets], total


def get_ticket(ticket_id: UUID, tenant_id: UUID, db: Session) -> TicketDetailResponse:
    from sqlalchemy.orm import selectinload

    ticket = (
        db.query(Ticket)
        .options(
            selectinload(Ticket.updates),
            selectinload(Ticket.spare_parts),
        )
        .filter(Ticket.id == ticket_id, Ticket.tenant_id == tenant_id)
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    return _build_detail(ticket, db)


def update_ticket_status(
    ticket_id:    UUID,
    tenant_id:    UUID,
    request:      TicketStatusUpdate,
    current_user: User,
    db:           Session,
) -> Ticket:
    from sqlalchemy.orm import selectinload

    ticket = (
        db.query(Ticket)
        .options(selectinload(Ticket.updates))
        .filter(Ticket.id == ticket_id, Ticket.tenant_id == tenant_id)
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    # ----- Workflow validation -----
    allowed = {
        TicketStatus.open:        [TicketStatus.in_progress, TicketStatus.cancelled],
        TicketStatus.in_progress: [TicketStatus.resolved,    TicketStatus.cancelled],
        TicketStatus.resolved:    [TicketStatus.closed],
        TicketStatus.closed:      [],
        TicketStatus.cancelled:   [],
    }

    # request.new_status (fixed field name from schema)
    if request.new_status not in allowed[ticket.status]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot change status from '{ticket.status}' to '{request.new_status}'",
        )

    if request.new_status == TicketStatus.cancelled and not request.note:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A note is required when cancelling a ticket",
        )

    old_status    = ticket.status
    ticket.status = request.new_status

    if request.new_status == TicketStatus.resolved:
        ticket.resolved_at = datetime.now(timezone.utc)

    note = request.note or f"Status changed to {request.new_status.value}"
    _add_update(ticket.id, current_user.id, note, old_status, request.new_status, db)

    db.commit()
    db.refresh(ticket)
    return ticket


def add_update(
    ticket_id:    UUID,
    tenant_id:    UUID,
    request:      TicketUpdateCreate,
    current_user: User,
    db:           Session,
) -> Ticket:
    from sqlalchemy.orm import selectinload

    ticket = (
        db.query(Ticket)
        .options(selectinload(Ticket.updates))
        .filter(Ticket.id == ticket_id, Ticket.tenant_id == tenant_id)
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    if ticket.status in (TicketStatus.closed, TicketStatus.cancelled):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add updates to a closed or cancelled ticket",
        )

    if request.new_status and request.new_status != ticket.status:
        temp = TicketStatusUpdate(new_status=request.new_status, note=request.note)
        return update_ticket_status(ticket_id, tenant_id, temp, current_user, db)

    _add_update(ticket.id, current_user.id, request.note, None, None, db)
    db.commit()
    db.refresh(ticket)
    return ticket


def assign_ticket(
    ticket_id:    UUID,
    tenant_id:    UUID,
    request:      TicketAssign,
    current_user: User,
    db:           Session,
) -> Ticket:
    from sqlalchemy.orm import selectinload

    ticket = (
        db.query(Ticket)
        .options(selectinload(Ticket.updates))
        .filter(Ticket.id == ticket_id, Ticket.tenant_id == tenant_id)
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    if request.assigned_to:
        assignee = db.query(User).filter(
            User.id        == request.assigned_to,
            User.tenant_id == tenant_id,
            User.is_active == True,
        ).first()
        if not assignee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        ticket.assigned_to = request.assigned_to
        _add_update(ticket.id, current_user.id, f"Ticket assigned to {assignee.full_name}", None, None, db)
    else:
        ticket.assigned_to = None
        _add_update(ticket.id, current_user.id, "Ticket unassigned", None, None, db)

    db.commit()
    db.refresh(ticket)
    return ticket


def update_ticket(
    ticket_id:    UUID,
    tenant_id:    UUID,
    request:      TicketUpdateSchema,
    current_user: User,
    db:           Session,
) -> Ticket:
    from sqlalchemy.orm import selectinload

    ticket = (
        db.query(Ticket)
        .options(selectinload(Ticket.updates))
        .filter(Ticket.id == ticket_id, Ticket.tenant_id == tenant_id)
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    if ticket.status in (TicketStatus.closed, TicketStatus.cancelled):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit a closed or cancelled ticket",
        )

    changes = []

    if request.title is not None and request.title != ticket.title:
        changes.append("Title updated")
        ticket.title = request.title

    if request.description is not None:
        ticket.description = request.description

    if request.priority is not None and request.priority != ticket.priority:
        changes.append(f"Priority changed: {ticket.priority.value} → {request.priority.value}")
        ticket.priority = request.priority

    if request.device_id is not None and request.device_id != ticket.device_id:
        device = db.query(Device).filter(
            Device.id == request.device_id, Device.tenant_id == tenant_id,
        ).first()
        if not device:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
        changes.append("Device updated")
        ticket.device_id = request.device_id

    if request.assigned_to is not None and request.assigned_to != ticket.assigned_to:
        assignee = db.query(User).filter(
            User.id == request.assigned_to, User.tenant_id == tenant_id, User.is_active == True,
        ).first()
        if not assignee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        changes.append(f"Assigned to {assignee.full_name}")
        ticket.assigned_to = request.assigned_to

    if changes:
        _add_update(ticket.id, current_user.id, " · ".join(changes), None, None, db)

    db.commit()
    db.refresh(ticket)
    return ticket


# ----- Spare Part Usage -----

def add_spare_part_usage(
    ticket_id:    UUID,
    tenant_id:    UUID,
    request:      SparePartUsageCreate,
    current_user: User,
    db:           Session,
) -> SparePartUsageResponse:
    from sqlalchemy.orm import selectinload

    ticket = (
        db.query(Ticket)
        .options(selectinload(Ticket.updates))
        .filter(Ticket.id == ticket_id, Ticket.tenant_id == tenant_id)
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    if ticket.status in (TicketStatus.closed, TicketStatus.cancelled):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add spare parts to a closed or cancelled ticket",
        )

    spare_part = db.query(SparePart).filter(
        SparePart.id        == request.spare_part_id,
        SparePart.tenant_id == tenant_id,
    ).first()
    if not spare_part:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Spare part not found")

    if spare_part.quantity < request.quantity_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient stock. Available: {spare_part.quantity}, requested: {request.quantity_used}",
        )

    usage = SparePartUsage(
        tenant_id     = tenant_id,
        ticket_id     = ticket_id,
        spare_part_id = request.spare_part_id,
        quantity_used = request.quantity_used,
        used_at       = datetime.now(timezone.utc),
    )
    db.add(usage)

    spare_part.quantity -= request.quantity_used

    _add_update(
        ticket.id, current_user.id,
        f"Used {request.quantity_used}x {spare_part.name} from spare parts",
        None, None, db,
    )

    db.commit()
    db.refresh(usage)

    return SparePartUsageResponse(
        id              = usage.id,
        ticket_id       = usage.ticket_id,
        spare_part_id   = usage.spare_part_id,
        spare_part_name = spare_part.name,
        quantity_used   = usage.quantity_used,
        used_at         = usage.used_at,
    )


def get_ticket_spare_parts(
    ticket_id: UUID, tenant_id: UUID, db: Session,
) -> list[SparePartUsageResponse]:
    ticket = db.query(Ticket).filter(
        Ticket.id == ticket_id, Ticket.tenant_id == tenant_id,
    ).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    rows = (
        db.query(SparePartUsage, SparePart)
        .join(SparePart, SparePartUsage.spare_part_id == SparePart.id)
        .filter(SparePartUsage.ticket_id == ticket_id)
        .all()
    )

    return [
        SparePartUsageResponse(
            id              = usage.id,
            ticket_id       = usage.ticket_id,
            spare_part_id   = usage.spare_part_id,
            spare_part_name = part.name,
            quantity_used   = usage.quantity_used,
            used_at         = usage.used_at,
        )
        for usage, part in rows
    ]


def remove_spare_part_usage(
    ticket_id:    UUID,
    usage_id:     UUID,
    tenant_id:    UUID,
    current_user: User,
    db:           Session,
) -> None:
    from sqlalchemy.orm import selectinload

    ticket = (
        db.query(Ticket)
        .options(selectinload(Ticket.updates))
        .filter(Ticket.id == ticket_id, Ticket.tenant_id == tenant_id)
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    if ticket.status in (TicketStatus.closed, TicketStatus.cancelled):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove spare parts from a closed or cancelled ticket",
        )

    usage = db.query(SparePartUsage).filter(
        SparePartUsage.id        == usage_id,
        SparePartUsage.ticket_id == ticket_id,
        SparePartUsage.tenant_id == tenant_id,
    ).first()
    if not usage:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Spare part usage record not found")

    spare_part = db.query(SparePart).filter(SparePart.id == usage.spare_part_id).first()

    if spare_part:
        spare_part.quantity += usage.quantity_used
        _add_update(
            ticket.id, current_user.id,
            f"Removed {usage.quantity_used}x {spare_part.name} — returned to stock",
            None, None, db,
        )

    db.delete(usage)
    db.commit()


# ----- Delete Ticket -----
def delete_ticket(
    ticket_id:    UUID,
    tenant_id:    UUID,
    current_user: User,
    db:           Session,
) -> None:
    """
    Permanently delete a ticket and all its child records
    (updates, spare-part usage, attachments).

    Rules:
      - Only admins and super_admins can hard-delete.
      - Technicians may NOT delete — they can only resolve/cancel.
      - Open tickets with spare-part usage that has NOT been reversed
        will have their parts automatically returned to stock first,
        keeping inventory consistent.
    """
    from app.models.user import UserRole

    if current_user.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can permanently delete tickets. "
                   "Technicians should resolve or cancel instead.",
        )

    ticket = db.query(Ticket).filter(
        Ticket.id        == ticket_id,
        Ticket.tenant_id == tenant_id,
    ).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    # Return any consumed spare parts to stock before deleting
    usages = db.query(SparePartUsage).filter(
        SparePartUsage.ticket_id == ticket_id,
        SparePartUsage.tenant_id == tenant_id,
    ).all()

    for usage in usages:
        spare_part = db.query(SparePart).filter(SparePart.id == usage.spare_part_id).first()
        if spare_part:
            spare_part.quantity += usage.quantity_used

    # SQLAlchemy cascade="all, delete-orphan" on the Ticket model handles
    # TicketUpdate and SparePartUsage child rows automatically.
    db.delete(ticket)
    db.commit()
