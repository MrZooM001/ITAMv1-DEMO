from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.device import Device
from app.models.network_scan import DiscoveredHost, NetworkScan, ScanStatus
from app.schemas.network_scan import BulkImportResponse, ImportResult, ScanRequest

log = logging.getLogger(__name__)


# ── helpers ────────────────────────────────────────────────────
def _now() -> datetime:
    return datetime.now(timezone.utc)


def _get_scan(scan_id: UUID, tenant_id: UUID, db: Session) -> NetworkScan:
    scan = db.query(NetworkScan).filter(
        NetworkScan.id        == scan_id,
        NetworkScan.tenant_id == tenant_id,
    ).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


# ── Create & trigger ───────────────────────────────────────────
def create_scan(
    request:    ScanRequest,
    tenant_id:  UUID,
    user_id:    UUID,
    db:         Session,
) -> NetworkScan:
    """Persist a pending scan record and return it — caller starts background task."""
    scan = NetworkScan(
        tenant_id  = tenant_id,
        created_by = user_id,
        subnet     = request.subnet,
        status     = ScanStatus.pending,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return scan


def run_scan_task(
    scan_id: UUID, tenant_id: UUID, db: Session,
    preferred_iface: Optional[str] = None,
) -> None:
    """
    Background task: runs the actual LAN scan and writes results to DB.
    preferred_iface — optional adapter name forwarded to the ARP engine.
    """
    from app.services.scanner import run_scan

    scan = db.query(NetworkScan).filter(NetworkScan.id == scan_id).first()
    if not scan:
        log.error("Scan %s not found in background task", scan_id)
        return

    try:
        scan.status     = ScanStatus.running
        scan.started_at = _now()
        db.commit()

        raw_hosts = run_scan(scan.subnet, preferred_iface=preferred_iface)

        # Look up existing devices by MAC for "already in assets" matching
        existing_macs: dict[str, Device] = {}
        existing_ips:  dict[str, Device] = {}

        for device in db.query(Device).filter(Device.tenant_id == tenant_id).all():
            hw = device.hardware
            if hw and hw.mac_address:
                existing_macs[hw.mac_address.upper()] = device
            if device.ip_address:
                existing_ips[device.ip_address] = device

        total_new   = 0
        total_known = 0

        for h in raw_hosts:
            mac    = (h.get("mac") or "").upper()
            asset  = existing_macs.get(mac) or existing_ips.get(h["ip"])
            known  = asset is not None

            host = DiscoveredHost(
                scan_id      = scan_id,
                tenant_id    = tenant_id,
                ip           = h["ip"],
                mac          = h.get("mac"),
                hostname     = h.get("hostname"),
                manufacturer = h.get("manufacturer"),
                open_ports   = h.get("open_ports", []),
                os_guess     = h.get("os_guess"),
                device_type  = h.get("device_type", "unknown"),
                is_known     = known,
                asset_id     = asset.id if asset else None,
            )
            db.add(host)

            if known:
                total_known += 1
            else:
                total_new += 1

        scan.total_found = len(raw_hosts)
        scan.total_known = total_known
        scan.total_new   = total_new
        scan.status      = ScanStatus.completed
        scan.finished_at = _now()
        db.commit()

    except Exception as exc:
        log.exception("Scan %s failed: %s", scan_id, exc)
        scan.status      = ScanStatus.failed
        scan.error       = str(exc)
        scan.finished_at = _now()
        db.commit()


# ── Read ───────────────────────────────────────────────────────
def get_scans(
    tenant_id: UUID,
    db:        Session,
    limit:     int = 20,
    offset:    int = 0,
) -> tuple[list[NetworkScan], int]:
    q = (
        db.query(NetworkScan)
        .filter(NetworkScan.tenant_id == tenant_id)
        .order_by(NetworkScan.created_at.desc())
    )
    return q.offset(offset).limit(limit).all(), q.count()


def get_scan_detail(scan_id: UUID, tenant_id: UUID, db: Session) -> NetworkScan:
    return _get_scan(scan_id, tenant_id, db)


# ── Import discovered host(s) into asset DB ────────────────────
def import_host(
    host_id:        UUID,
    name:           str,
    device_type_id: UUID | None,
    department_id:  UUID | None,
    tenant_id:      UUID,
    db:             Session,
) -> Device:
    host = db.query(DiscoveredHost).filter(
        DiscoveredHost.id        == host_id,
        DiscoveredHost.tenant_id == tenant_id,
    ).first()
    if not host:
        raise HTTPException(status_code=404, detail="Discovered host not found")
    if host.imported:
        raise HTTPException(status_code=409, detail="Host already imported")

    device = Device(
        tenant_id      = tenant_id,
        name           = name,
        ip_address     = host.ip,
        mac_address    = host.mac,
        device_type_id = device_type_id,
        department_id  = department_id,
        status         = "active",
    )
    db.add(device)
    db.flush()

    host.imported    = True
    host.imported_at = _now()
    host.asset_id    = device.id
    host.is_known    = True
    db.commit()
    db.refresh(device)
    return device


def bulk_import_hosts(
    imports:   list,
    tenant_id: UUID,
    db:        Session,
) -> BulkImportResponse:
    results: list[ImportResult] = []
    imported = 0
    failed   = 0

    for item in imports:
        try:
            with db.begin_nested():
                device = import_host(
                    host_id        = item.host_id,
                    name           = item.name,
                    device_type_id = item.device_type_id,
                    department_id  = item.department_id,
                    tenant_id      = tenant_id,
                    db             = db,
                )
            results.append(ImportResult(host_id=item.host_id, success=True, asset_id=device.id))
            imported += 1
        except Exception as exc:
            results.append(ImportResult(host_id=item.host_id, success=False, error=str(exc)))
            failed += 1

    db.commit()
    return BulkImportResponse(imported=imported, failed=failed, results=results)
