from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional

from app.database import get_db
from app.core.dependencies import get_current_user, require_admin, require_technician
from app.core.pagination import Pagination, PaginatedResponse, make_response
from app.models.user import User
from app.schemas.ticket import (
    TicketCreate, TicketUpdate, TicketResponse,
    TicketSummaryResponse, TicketDetailResponse,
    TicketStatusUpdate, TicketUpdateCreate, TicketAssign,
    SparePartUsageCreate, SparePartUsageResponse,
)
from app.services import ticket as ticket_service

router = APIRouter(prefix="/tickets", tags=["Tickets"])


@router.post("/", response_model=TicketResponse)
def create_ticket(
    request:      TicketCreate,
    current_user: User    = Depends(require_technician),
    db:           Session = Depends(get_db),
):
    return ticket_service.create_ticket(request, current_user.tenant_id, current_user, db)


@router.get("/", response_model=PaginatedResponse[TicketSummaryResponse])
def get_tickets(
    status:         Optional[str]  = Query(None, description="Filter: open, in_progress, resolved, closed, cancelled"),
    priority:       Optional[str]  = Query(None, description="Filter: low, medium, high, critical"),
    device_id:      Optional[UUID] = Query(None),
    assigned_to_id: Optional[UUID] = Query(None, description="Filter by assignee user ID — returns that user's ticket history"),
    department_id:  Optional[UUID] = Query(None, description="Filter by department ID (via device's department)"),
    pagination:     Pagination     = Depends(),
    current_user:   User           = Depends(get_current_user),
    db:             Session        = Depends(get_db),
):
    items, total = ticket_service.get_tickets(
        current_user.tenant_id, db,
        limit=pagination.limit, offset=pagination.offset,
        ticket_status=status, priority=priority, device_id=device_id,
        assigned_to_id=assigned_to_id, department_id=department_id,
    )
    return make_response(items, total, pagination)


@router.get("/{ticket_id}", response_model=TicketDetailResponse)
def get_ticket(
    ticket_id:    UUID,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    return ticket_service.get_ticket(ticket_id, current_user.tenant_id, db)


@router.put("/{ticket_id}", response_model=TicketResponse)
def update_ticket(
    ticket_id:    UUID,
    request:      TicketUpdate,
    current_user: User    = Depends(require_technician),
    db:           Session = Depends(get_db),
):
    return ticket_service.update_ticket(
        ticket_id, current_user.tenant_id, request, current_user, db
    )


@router.put("/{ticket_id}/status", response_model=TicketResponse)
def update_status(
    ticket_id:    UUID,
    request:      TicketStatusUpdate,
    current_user: User    = Depends(require_technician),
    db:           Session = Depends(get_db),
):
    return ticket_service.update_ticket_status(
        ticket_id, current_user.tenant_id, request, current_user, db
    )


@router.post("/{ticket_id}/updates", response_model=TicketResponse)
def add_update(
    ticket_id:    UUID,
    request:      TicketUpdateCreate,
    current_user: User    = Depends(require_technician),
    db:           Session = Depends(get_db),
):
    return ticket_service.add_update(
        ticket_id, current_user.tenant_id, request, current_user, db
    )


@router.put("/{ticket_id}/assign", response_model=TicketResponse)
def assign_ticket(
    ticket_id:    UUID,
    request:      TicketAssign,
    current_user: User    = Depends(require_technician),
    db:           Session = Depends(get_db),
):
    return ticket_service.assign_ticket(
        ticket_id, current_user.tenant_id, request, current_user, db
    )


@router.delete("/{ticket_id}", status_code=204)
def delete_ticket(
    ticket_id:    UUID,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    """
    Permanently delete a ticket and all its history.
    Admin and super-admin only — technicians should resolve/cancel instead.
    Spare parts consumed by the ticket are automatically returned to stock.
    """
    ticket_service.delete_ticket(ticket_id, current_user.tenant_id, current_user, db)


# ── Spare Parts Usage ──────────────────────────────────────────
@router.post("/{ticket_id}/spare-parts", response_model=SparePartUsageResponse)
def add_spare_part(
    ticket_id:    UUID,
    request:      SparePartUsageCreate,
    current_user: User    = Depends(require_technician),
    db:           Session = Depends(get_db),
):
    return ticket_service.add_spare_part_usage(
        ticket_id, current_user.tenant_id, request, current_user, db
    )


@router.get("/{ticket_id}/spare-parts", response_model=list[SparePartUsageResponse])
def get_ticket_spare_parts(
    ticket_id:    UUID,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    return ticket_service.get_ticket_spare_parts(
        ticket_id, current_user.tenant_id, db
    )


@router.delete("/{ticket_id}/spare-parts/{usage_id}")
def remove_spare_part(
    ticket_id:    UUID,
    usage_id:     UUID,
    current_user: User    = Depends(require_technician),
    db:           Session = Depends(get_db),
):
    ticket_service.remove_spare_part_usage(
        ticket_id, usage_id, current_user.tenant_id, current_user, db
    )
    return {"message": "Spare part usage removed and quantity restored to stock"}
