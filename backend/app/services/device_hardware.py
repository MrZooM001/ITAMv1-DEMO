from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from uuid import UUID

from app.models.device_hardware import DeviceHardware
from app.models.device import Device
from app.models.software import OperatingSystem, DeviceOS
from app.parsers.speccy import parse_speccy_xml, SpeccyData
from app.schemas.device_hardware import DeviceHardwareUpdate


def _speccy_to_dict(data: SpeccyData) -> dict:
    """بيحول الـ SpeccyData لـ dict جاهز للـ DB"""
    return {
        # CPU
        "cpu_model": data.cpu_model,
        "cpu_cores": data.cpu_cores,
        "cpu_threads": data.cpu_threads,
        "cpu_speed_mhz": data.cpu_speed_mhz,
        "cpu_cache_kb": data.cpu_cache_kb,
        # Motherboard
        "mb_manufacturer": data.mb_manufacturer,
        "mb_model": data.mb_model,
        "mb_bios_version": data.mb_bios_version,
        "mb_bios_date": data.mb_bios_date,
        # RAM
        "ram_total_mb": data.ram_total_mb,
        "ram_type": data.ram_type,
        "ram_speed_mhz": data.ram_speed_mhz,
        "ram_slots_total": data.ram_slots_total,
        "ram_slots_used": data.ram_slots_used,
        "ram_slots_free": data.ram_slots_free,        # ← NEW
        "ram_modules": [
            {
                "slot": m.slot,
                "type": m.type,
                "size_mb": m.size_mb,
                "manufacturer": m.manufacturer,
                "part_number": m.part_number,
                "serial": m.serial,
                "speed_mhz": m.speed_mhz,
            }
            for m in data.ram_modules
        ]
        or None,
        # Storage
        "storage": [
            {
                "model": d.model,
                "manufacturer": d.manufacturer,
                "capacity_mb": d.capacity_mb,
                "interface": d.interface,
                "type": d.type,
                "serial": d.serial,
                "smart_status": d.smart_status,
                "partitions": [
                    {
                        "partition_id": p.partition_id,
                        "disk_letter": p.disk_letter,
                        "file_system": p.file_system,
                        "size_mb": p.size_mb,
                        "used_mb": p.used_mb,
                        "free_mb": p.free_mb,
                    }
                    for p in d.partitions
                ],
            }
            for d in data.storage
        ]
        or None,
        # GPU
        "gpu_model": data.gpu_model,
        "gpu_manufacturer": data.gpu_manufacturer,
        "gpu_memory_mb": data.gpu_memory_mb,          # ← NEW — None for iGPU
        # Monitors
        "monitors": [
            {
                "model": m.model,
                "manufacturer": m.manufacturer,
                "resolution": m.resolution,
                "refresh_hz": m.refresh_hz,
                "is_primary": m.is_primary,
            }
            for m in data.monitors
        ]
        or None,
        # Network - Ethernet
        "eth_adapter": data.eth_adapter,
        "eth_mac": data.eth_mac,
        "eth_connections": [
            {
                "ip": c.ip,
                "subnet": c.subnet,
                "gateway": c.gateway,
                "dhcp": c.dhcp,
            }
            for c in data.eth_connections
        ]
        or None,
        # Network - WiFi
        "wifi_adapter": data.wifi_adapter,
        "wifi_mac": data.wifi_mac,
        "wifi_connections": [
            {
                "ip": c.ip,
                "subnet": c.subnet,
                "gateway": c.gateway,
                "dhcp": c.dhcp,
            }
            for c in data.wifi_connections
        ]
        or None,
        # Metadata
        "speccy_scan_date": data.scan_date,
    }


def import_from_speccy(
    device_id: UUID, tenant_id: UUID, xml_content: bytes, db: Session
) -> DeviceHardware:
    # ── تحقق إن الجهاز موجود ──────────────────────────────────
    device = (
        db.query(Device)
        .filter(
            Device.id == device_id,
            Device.tenant_id == tenant_id,
        )
        .first()
    )

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    # ── Parse الـ XML ──────────────────────────────────────────
    try:
        speccy_data = parse_speccy_xml(xml_content)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    hardware_dict = _speccy_to_dict(speccy_data)

    # ── تحقق من الـ eth_mac عشان نمنع الـ duplication ─────────
    # Scoped to this tenant only — a MAC collision in another tenant's
    # data is irrelevant and must never be surfaced or block this import.
    if speccy_data.eth_mac:
        existing_mac = (
            db.query(DeviceHardware)
            .filter(
                DeviceHardware.eth_mac   == speccy_data.eth_mac,
                DeviceHardware.tenant_id == tenant_id,
                DeviceHardware.device_id != device_id,
            )
            .first()
        )

        if existing_mac:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Hardware with MAC {speccy_data.eth_mac} already linked to another device",
            )

    # ── UPDATE لو موجود، INSERT لو مش موجود ───────────────────
    existing = (
        db.query(DeviceHardware)
        .filter(
            DeviceHardware.device_id == device_id,
        )
        .first()
    )

    if existing:
        for key, value in hardware_dict.items():
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        result = existing
    else:
        hardware = DeviceHardware(
            tenant_id=tenant_id,
            device_id=device_id,
            **hardware_dict,
        )
        db.add(hardware)
        db.commit()
        db.refresh(hardware)
        result = hardware

    # ── استيراد الـ OS ─────────────────────────────────────────
    if speccy_data.os_name:
        _import_os(device_id, tenant_id, speccy_data, db)

    return result


def _import_os(device_id: UUID, tenant_id: UUID, speccy_data: SpeccyData, db: Session):
    """بيضيف أو يحدث الـ OS المرتبط بالجهاز"""

    # ── بيدور على الـ OS في الـ catalog أو بيعمل واحد جديد ────
    os = (
        db.query(OperatingSystem)
        .filter(
            OperatingSystem.tenant_id == tenant_id,
            OperatingSystem.name == speccy_data.os_name,
            OperatingSystem.architecture == speccy_data.os_architecture,
        )
        .first()
    )

    if not os:
        os = OperatingSystem(
            tenant_id=tenant_id,
            name=speccy_data.os_name,
            architecture=speccy_data.os_architecture,
        )
        db.add(os)
        db.flush()

    # ── ربط الـ OS بالجهاز ─────────────────────────────────────
    device_os = (
        db.query(DeviceOS)
        .filter(
            DeviceOS.device_id == device_id,
            DeviceOS.os_id == os.id,
        )
        .first()
    )

    if not device_os:
        device_os = DeviceOS(
            tenant_id=tenant_id,
            device_id=device_id,
            os_id=os.id,
            install_date=speccy_data.os_install_date,
            is_primary=True,
        )
        db.add(device_os)
    else:
        device_os.install_date = speccy_data.os_install_date

    db.commit()


def get_hardware(device_id: UUID, tenant_id: UUID, db: Session) -> DeviceHardware:
    # ── تحقق إن الجهاز موجود ──────────────────────────────────
    device = (
        db.query(Device)
        .filter(
            Device.id == device_id,
            Device.tenant_id == tenant_id,
        )
        .first()
    )

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    hardware = (
        db.query(DeviceHardware)
        .filter(
            DeviceHardware.device_id == device_id,
        )
        .first()
    )

    if not hardware:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hardware data found for this device, upload a Speccy XML file first",
        )

    return hardware


def update_hardware_manual(
    device_id: UUID, tenant_id: UUID, request: DeviceHardwareUpdate, db: Session
) -> DeviceHardware:
    hardware = get_hardware(device_id, tenant_id, db)

    for key, value in request.model_dump(exclude_none=True).items():
        setattr(hardware, key, value)

    db.commit()
    db.refresh(hardware)
    return hardware
