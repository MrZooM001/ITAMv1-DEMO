from uuid import UUID
from dataclasses import dataclass, field
from pathlib import PurePosixPath
from typing import Optional

from sqlalchemy.orm import Session

from app.models.department import Department
from app.models.device import Device, DeviceType, DeviceStatus
from app.models.device_hardware import DeviceHardware
from app.parsers.speccy import parse_speccy_xml
from app.services.device_hardware import _speccy_to_dict, _import_os


# ----- DTOs -----

@dataclass
class FileEntry:
    filename: str    # e.g. "TS3-PC.xml"  (just the filename, no path needed)
    content:  bytes


@dataclass
class DeviceImportResult:
    file:        str
    action:      str        # "created" | "updated" | "error"
    device_id:   Optional[str] = None
    device_name: Optional[str] = None
    error:       Optional[str] = None


@dataclass
class BulkImportSummary:
    total:   int = 0
    created: int = 0
    updated: int = 0
    errors:  int = 0
    results: list[DeviceImportResult] = field(default_factory=list)


# ----- Helpers -----

def _get_or_create_pc_type(tenant_id: UUID, db: Session) -> DeviceType:
    dt = db.query(DeviceType).filter(
        DeviceType.tenant_id == tenant_id,
        DeviceType.name      == "PC",
    ).first()
    if not dt:
        dt = DeviceType(tenant_id=tenant_id, name="PC")
        db.add(dt)
        db.flush()
    return dt


def _find_by_mac(eth_mac: str, tenant_id: UUID, db: Session) -> Optional[Device]:
    hw = db.query(DeviceHardware).filter(
        DeviceHardware.eth_mac   == eth_mac,
        DeviceHardware.tenant_id == tenant_id,
    ).first()
    if not hw:
        return None
    return db.query(Device).filter(Device.id == hw.device_id).first()


def _parse_device_name(filename: str) -> Optional[str]:
    """Extract device name from filename — strips .xml extension."""
    path = PurePosixPath(filename.replace("\\", "/"))
    if path.suffix.lower() != ".xml":
        return None
    if path.name.startswith(".") or path.name.startswith("__"):
        return None
    return path.stem.strip() or None


# ----- Core: Process One XML -----

def _process_one(
    xml_content:   bytes,
    device_name:   str,
    department_id: UUID,
    tenant_id:     UUID,
    device_type:   DeviceType,
    db:            Session,
) -> tuple[str, str]:
    """Returns (action, device_id). Raises on error."""
    speccy        = parse_speccy_xml(xml_content)
    hardware_dict = _speccy_to_dict(speccy)

    existing: Optional[Device] = None
    if speccy.eth_mac:
        existing = _find_by_mac(speccy.eth_mac, tenant_id, db)

    if existing:
        # ----- UPDATE -----
        if existing.department_id != department_id:
            existing.department_id = department_id

        hw = db.query(DeviceHardware).filter(DeviceHardware.device_id == existing.id).first()
        if hw:
            for k, v in hardware_dict.items():
                setattr(hw, k, v)
        else:
            db.add(DeviceHardware(tenant_id=tenant_id, device_id=existing.id, **hardware_dict))

        db.flush()
        if speccy.os_name:
            _import_os(existing.id, tenant_id, speccy, db)

        return "updated", str(existing.id)

    else:
        # ----- CREATE -----
        device = Device(
            tenant_id      = tenant_id,
            name           = device_name,
            device_type_id = device_type.id,
            department_id  = department_id,
            status         = DeviceStatus.active,
        )
        db.add(device)
        db.flush()

        db.add(DeviceHardware(tenant_id=tenant_id, device_id=device.id, **hardware_dict))
        db.flush()

        if speccy.os_name:
            _import_os(device.id, tenant_id, speccy, db)

        return "created", str(device.id)


# ----- Main Entry -----

def bulk_import_from_files(
    files:         list[FileEntry],
    department_id: UUID,
    tenant_id:     UUID,
    db:            Session,
) -> BulkImportSummary:
    """
    Import devices from a list of Speccy XML FileEntries into a chosen department.

    - Device name  = filename without .xml
    - MAC exists   → UPDATE hardware + move to department if changed
    - MAC not found→ CREATE new device
    - Department is explicitly chosen by the user (not inferred from folder structure)
    """
    if not files:
        raise ValueError("No files provided")

    dept = db.query(Department).filter(
        Department.id        == department_id,
        Department.tenant_id == tenant_id,
    ).first()
    if not dept:
        raise ValueError("Department not found")

    summary     = BulkImportSummary()
    device_type = _get_or_create_pc_type(tenant_id, db)

    for entry in files:
        summary.total += 1
        device_name = _parse_device_name(entry.filename)

        if not device_name:
            summary.errors += 1
            summary.results.append(DeviceImportResult(
                file   = entry.filename,
                action = "error",
                error  = "Not a valid XML file",
            ))
            continue

        try:
            action, device_id = _process_one(
                xml_content   = entry.content,
                device_name   = device_name,
                department_id = department_id,
                tenant_id     = tenant_id,
                device_type   = device_type,
                db            = db,
            )

            if action == "created":
                summary.created += 1
            else:
                summary.updated += 1

            summary.results.append(DeviceImportResult(
                file        = entry.filename,
                action      = action,
                device_id   = device_id,
                device_name = device_name,
            ))

        except Exception as e:
            summary.errors += 1
            summary.results.append(DeviceImportResult(
                file   = entry.filename,
                action = "error",
                error  = str(e),
            ))

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise ValueError(f"Database commit failed: {e}")

    return summary
