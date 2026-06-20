from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException, status
from uuid import UUID
from datetime import date, timedelta
from typing import Optional

from app.models.software import Software, SoftwareLicense, DeviceSoftware
from app.models.device import Device
from app.schemas.software import (
    SoftwareCreate,
    SoftwareUpdate,
    SoftwareLicenseCreate,
    SoftwareLicenseUpdate,
    DeviceSoftwareCreate,
    DeviceSoftwareUpdate,
    SoftwareResponse,
    SoftwareLicenseResponse,
    DeviceSoftwareResponse,
)

# ----- Helpers -----


def _days_remaining(expiry: Optional[date]) -> Optional[int]:
    if not expiry:
        return None
    return (expiry - date.today()).days


def _to_license_response(
    lic: SoftwareLicense, software_name: Optional[str] = None
) -> SoftwareLicenseResponse:
    return SoftwareLicenseResponse(
        id=lic.id,
        tenant_id=lic.tenant_id,
        software_id=lic.software_id,
        software_name=software_name or (lic.software.name if lic.software else None),
        license_key=lic.license_key,
        license_type=lic.license_type,
        seats=lic.seats,
        expiry_date=lic.expiry_date,
        cost=lic.cost,
        notes=lic.notes,
        days_remaining=_days_remaining(lic.expiry_date),
        created_at=lic.created_at,
    )


def _get_software_or_404(software_id: UUID, tenant_id: UUID, db: Session) -> Software:
    sw = (
        db.query(Software)
        .filter(
            Software.id == software_id,
            Software.tenant_id == tenant_id,
        )
        .first()
    )
    if not sw:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Software not found"
        )
    return sw


def _get_license_or_404(
    license_id: UUID, tenant_id: UUID, db: Session
) -> SoftwareLicense:
    lic = (
        db.query(SoftwareLicense)
        .filter(
            SoftwareLicense.id == license_id,
            SoftwareLicense.tenant_id == tenant_id,
        )
        .first()
    )
    if not lic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="License not found"
        )
    return lic


# ----- Software CRUD -----


def create_software(request: SoftwareCreate, tenant_id: UUID, db: Session) -> Software:
    sw = Software(
        tenant_id=tenant_id,
        name=request.name,
        vendor=request.vendor,
        category=request.category,
        is_common=request.is_common,
        notes=request.notes,
    )
    db.add(sw)
    db.commit()
    db.refresh(sw)
    return sw


def get_software_list(
    tenant_id: UUID,
    db: Session,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    category: Optional[str] = None,
    is_common: Optional[bool] = None,
) -> tuple[list[Software], int]:
    q = db.query(Software).filter(Software.tenant_id == tenant_id)

    if search:
        q = q.filter(
            or_(
                Software.name.ilike(f"%{search}%"),
                Software.vendor.ilike(f"%{search}%"),
            )
        )
    if category is not None:
        q = q.filter(Software.category == category)
    if is_common is not None:
        q = q.filter(Software.is_common == is_common)

    total = q.count()
    items = (
        q.order_by(Software.name).offset(offset).all()
        if limit is None
        else q.order_by(Software.name).offset(offset).limit(limit).all()
    )
    return items, total


def get_software(software_id: UUID, tenant_id: UUID, db: Session) -> Software:
    return _get_software_or_404(software_id, tenant_id, db)


def update_software(
    software_id: UUID, request: SoftwareUpdate, tenant_id: UUID, db: Session
) -> Software:
    sw = _get_software_or_404(software_id, tenant_id, db)

    if request.name is not None:
        sw.name = request.name
    if request.vendor is not None:
        sw.vendor = request.vendor
    if request.category is not None:
        sw.category = request.category
    if request.is_common is not None:
        sw.is_common = request.is_common
    if request.notes is not None:
        sw.notes = request.notes

    db.commit()
    db.refresh(sw)
    return sw


def delete_software(software_id: UUID, tenant_id: UUID, db: Session) -> None:
    sw = _get_software_or_404(software_id, tenant_id, db)

    # تحقق مفيش أجهزة مرتبطة
    in_use = (
        db.query(DeviceSoftware)
        .filter(DeviceSoftware.software_id == software_id)
        .first()
    )
    if in_use:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete: software is installed on one or more devices",
        )

    db.delete(sw)
    db.commit()


# ----- License CRUD -----


def create_license(
    software_id: UUID,
    request: SoftwareLicenseCreate,
    tenant_id: UUID,
    db: Session,
) -> SoftwareLicenseResponse:
    sw = _get_software_or_404(software_id, tenant_id, db)

    lic = SoftwareLicense(
        tenant_id=tenant_id,
        software_id=software_id,
        license_key=request.license_key,
        license_type=request.license_type,
        seats=request.seats,
        expiry_date=request.expiry_date,
        cost=request.cost,
        notes=request.notes,
    )
    db.add(lic)
    db.commit()
    db.refresh(lic)
    return _to_license_response(lic, sw.name)


def get_licenses(
    software_id: UUID, tenant_id: UUID, db: Session
) -> list[SoftwareLicenseResponse]:
    sw = _get_software_or_404(software_id, tenant_id, db)
    lics = (
        db.query(SoftwareLicense)
        .filter(
            SoftwareLicense.software_id == software_id,
            SoftwareLicense.tenant_id == tenant_id,
        )
        .all()
    )
    return [_to_license_response(l, sw.name) for l in lics]


def update_license(
    license_id: UUID,
    request: SoftwareLicenseUpdate,
    tenant_id: UUID,
    db: Session,
) -> SoftwareLicenseResponse:
    lic = _get_license_or_404(license_id, tenant_id, db)

    if request.license_key is not None:
        lic.license_key = request.license_key
    if request.license_type is not None:
        lic.license_type = request.license_type
    if request.seats is not None:
        lic.seats = request.seats
    if request.expiry_date is not None:
        lic.expiry_date = request.expiry_date
    if request.cost is not None:
        lic.cost = request.cost
    if request.notes is not None:
        lic.notes = request.notes

    db.commit()
    db.refresh(lic)
    return _to_license_response(lic)


def delete_license(license_id: UUID, tenant_id: UUID, db: Session) -> None:
    lic = _get_license_or_404(license_id, tenant_id, db)
    db.delete(lic)
    db.commit()


def get_expiring_licenses(
    tenant_id: UUID, db: Session, days: int = 30
) -> list[SoftwareLicenseResponse]:
    """بيرجع الـ licenses اللي هتنتهي خلال N يوم."""
    cutoff = date.today() + timedelta(days=days)
    lics = (
        db.query(SoftwareLicense)
        .filter(
            SoftwareLicense.tenant_id == tenant_id,
            SoftwareLicense.expiry_date != None,
            SoftwareLicense.expiry_date <= cutoff,
        )
        .order_by(SoftwareLicense.expiry_date)
        .all()
    )
    return [_to_license_response(l) for l in lics]


# ----- Device Software -----


def install_software(
    device_id: UUID,
    request: DeviceSoftwareCreate,
    tenant_id: UUID,
    db: Session,
) -> DeviceSoftwareResponse:
    # تحقق إن الجهاز موجود
    device = (
        db.query(Device)
        .filter(Device.id == device_id, Device.tenant_id == tenant_id)
        .first()
    )
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Device not found"
        )

    # تحقق إن البرنامج موجود
    sw = _get_software_or_404(request.software_id, tenant_id, db)

    # تحقق مش مثبّت قبل كده
    existing = (
        db.query(DeviceSoftware)
        .filter(
            DeviceSoftware.device_id == device_id,
            DeviceSoftware.software_id == request.software_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"'{sw.name}' is already installed on this device",
        )

    ds = DeviceSoftware(
        tenant_id=tenant_id,
        device_id=device_id,
        software_id=request.software_id,
        version=request.version,
        installed_at=request.installed_at,
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)

    return DeviceSoftwareResponse(
        id=ds.id,
        device_id=ds.device_id,
        software_id=ds.software_id,
        software_name=sw.name,
        vendor=sw.vendor,
        version=ds.version,
        installed_at=ds.installed_at,
        created_at=ds.created_at,
    )


def get_device_software(
    device_id: UUID, tenant_id: UUID, db: Session
) -> list[DeviceSoftwareResponse]:
    rows = (
        db.query(DeviceSoftware, Software)
        .join(Software, DeviceSoftware.software_id == Software.id)
        .filter(
            DeviceSoftware.device_id == device_id,
            DeviceSoftware.tenant_id == tenant_id,
        )
        .order_by(Software.name)
        .all()
    )
    return [
        DeviceSoftwareResponse(
            id=ds.id,
            device_id=ds.device_id,
            software_id=ds.software_id,
            software_name=sw.name,
            vendor=sw.vendor,
            version=ds.version,
            installed_at=ds.installed_at,
            created_at=ds.created_at,
        )
        for ds, sw in rows
    ]


def update_device_software(
    device_software_id: UUID,
    request: DeviceSoftwareUpdate,
    tenant_id: UUID,
    db: Session,
) -> DeviceSoftwareResponse:
    ds = (
        db.query(DeviceSoftware)
        .filter(
            DeviceSoftware.id == device_software_id,
            DeviceSoftware.tenant_id == tenant_id,
        )
        .first()
    )
    if not ds:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Record not found"
        )

    if request.version is not None:
        ds.version = request.version
    if request.installed_at is not None:
        ds.installed_at = request.installed_at

    db.commit()
    db.refresh(ds)

    sw = db.query(Software).filter(Software.id == ds.software_id).first()
    return DeviceSoftwareResponse(
        id=ds.id,
        device_id=ds.device_id,
        software_id=ds.software_id,
        software_name=sw.name if sw else None,
        vendor=sw.vendor if sw else None,
        version=ds.version,
        installed_at=ds.installed_at,
        created_at=ds.created_at,
    )


def uninstall_software(device_software_id: UUID, tenant_id: UUID, db: Session) -> None:
    ds = (
        db.query(DeviceSoftware)
        .filter(
            DeviceSoftware.id == device_software_id,
            DeviceSoftware.tenant_id == tenant_id,
        )
        .first()
    )
    if not ds:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Record not found"
        )

    db.delete(ds)
    db.commit()
