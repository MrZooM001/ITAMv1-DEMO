from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, Enum, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from app.database import Base


class ScanStatus(str, enum.Enum):
    pending   = "pending"
    running   = "running"
    completed = "completed"
    failed    = "failed"


class DeviceTypeGuess(str, enum.Enum):
    router        = "router"
    switch        = "switch"
    printer       = "printer"
    windows_pc    = "windows_pc"
    linux_server  = "linux_server"
    nas           = "nas"
    camera        = "camera"
    voip_phone    = "voip_phone"
    access_point  = "access_point"
    unknown       = "unknown"


class NetworkScan(Base):
    __tablename__ = "network_scans"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id   = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    created_by  = Column(UUID(as_uuid=True), ForeignKey("users.id"),   nullable=False)

    subnet      = Column(String(50),  nullable=False)          # e.g. 192.168.1.0/24
    status      = Column(Enum(ScanStatus), default=ScanStatus.pending, nullable=False)
    error       = Column(Text, nullable=True)

    total_found = Column(Integer, default=0)
    total_new   = Column(Integer, default=0)   # not yet in assets
    total_known = Column(Integer, default=0)   # already in assets

    started_at  = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    hosts       = relationship("DiscoveredHost", back_populates="scan",
                               cascade="all, delete-orphan")


class DiscoveredHost(Base):
    __tablename__ = "discovered_hosts"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scan_id     = Column(UUID(as_uuid=True), ForeignKey("network_scans.id"), nullable=False)
    tenant_id   = Column(UUID(as_uuid=True), ForeignKey("tenants.id"),       nullable=False)

    ip          = Column(String(45),  nullable=False)
    mac         = Column(String(17),  nullable=True)   # AA:BB:CC:DD:EE:FF
    hostname    = Column(String(255), nullable=True)
    manufacturer= Column(String(200), nullable=True)   # from OUI lookup
    open_ports  = Column(JSONB, default=list)           # [80, 443, 9100]
    os_guess    = Column(String(200), nullable=True)    # from nmap
    device_type = Column(Enum(DeviceTypeGuess), default=DeviceTypeGuess.unknown)

    # Whether this host was already in the assets table
    is_known    = Column(Boolean, default=False)
    asset_id    = Column(UUID(as_uuid=True), ForeignKey("devices.id"), nullable=True)

    # Whether the admin imported this host into assets
    imported    = Column(Boolean, default=False)
    imported_at = Column(DateTime(timezone=True), nullable=True)

    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    scan        = relationship("NetworkScan",  back_populates="hosts")
    asset       = relationship("Device",       foreign_keys=[asset_id])
