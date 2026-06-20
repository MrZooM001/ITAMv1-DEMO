from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.dependencies import get_current_user, require_admin
from app.core.pagination import Pagination, PaginatedResponse, make_response
from app.database import get_db
from app.models.user import User
from app.schemas.network_scan import (
    BulkImportRequest,
    BulkImportResponse,
    NetworkInterfaceResponse,
    NetworkScanDetail,
    NetworkScanSummary,
    ScanRequest,
)
from app.services import network_scan as scan_service
from app.services.scanner import list_interfaces, _subnet_from_iface

router = APIRouter(prefix="/network", tags=["Network Discovery"])


@router.get("/interfaces", response_model=list[NetworkInterfaceResponse])
def get_interfaces(current_user: User = Depends(require_admin)):
    """
    List all network adapters available on the server (Ethernet + Wi-Fi).
    Use the 'name' field from a result as preferred_iface when triggering a scan.
    The 'subnet' field shows the CIDR range you'd want to scan for that adapter.
    """
    ifaces = list_interfaces()
    return [
        NetworkInterfaceResponse(
            name    = i["name"],
            ip      = i["ip"],
            netmask = i["netmask"],
            type    = i["type"],
            subnet  = _subnet_from_iface(i),
        )
        for i in ifaces
    ]


@router.post("/scan", response_model=NetworkScanSummary, status_code=202)
def trigger_scan(
    request:          ScanRequest,
    background_tasks: BackgroundTasks,
    current_user:     User    = Depends(require_admin),
    db:               Session = Depends(get_db),
):
    """
    Trigger a LAN discovery scan on the given subnet.
    - Returns 202 immediately with a scan_id.
    - Poll GET /network/scans/{id} until status = 'completed'.
    - Set preferred_iface to force a specific adapter (useful for Wi-Fi-only machines).
      Call GET /network/interfaces first to see available adapters.
    """
    scan = scan_service.create_scan(request, current_user.tenant_id, current_user.id, db)
    background_tasks.add_task(
        scan_service.run_scan_task,
        scan_id          = scan.id,
        tenant_id        = current_user.tenant_id,
        preferred_iface  = request.preferred_iface,
        db               = db,
    )
    return scan


@router.get("/scans", response_model=PaginatedResponse[NetworkScanSummary])
def list_scans(
    pagination:   Pagination = Depends(),
    current_user: User       = Depends(get_current_user),
    db:           Session    = Depends(get_db),
):
    """List all past scans for this tenant, newest first."""
    items, total = scan_service.get_scans(
        current_user.tenant_id, db,
        limit=pagination.limit, offset=pagination.offset,
    )
    return make_response(items, total, pagination)


@router.get("/scans/{scan_id}", response_model=NetworkScanDetail)
def get_scan(
    scan_id:      UUID,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """
    Get full scan results including every discovered host.
    Status flow: pending → running → completed | failed
    """
    return scan_service.get_scan_detail(scan_id, current_user.tenant_id, db)


@router.post("/scans/{scan_id}/import", response_model=BulkImportResponse)
def import_hosts(
    scan_id:      UUID,
    request:      BulkImportRequest,
    current_user: User    = Depends(require_admin),
    db:           Session = Depends(get_db),
):
    """
    Import discovered hosts into the asset database.
    Each import creates a Device record. Supports partial failure per host.
    """
    scan_service.get_scan_detail(scan_id, current_user.tenant_id, db)
    return scan_service.bulk_import_hosts(request.imports, current_user.tenant_id, db)

