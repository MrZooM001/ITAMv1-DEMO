from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Date,
    Integer,
    Numeric,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base


class Software(Base):
    __tablename__ = "software"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    name = Column(String(200), nullable=False)
    vendor = Column(String(200), nullable=True)
    category = Column(String(100), nullable=True)
    is_common = Column(Boolean, default=False)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_software_tenant_id", "tenant_id"),
        Index("ix_software_tenant_category", "tenant_id", "category"),
        Index("ix_software_tenant_common", "tenant_id", "is_common"),
    )

    licenses = relationship(
        "SoftwareLicense", back_populates="software", cascade="all, delete-orphan"
    )
    device_software = relationship("DeviceSoftware", back_populates="software")


class SoftwareLicense(Base):
    __tablename__ = "software_licenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    software_id = Column(UUID(as_uuid=True), ForeignKey("software.id"), nullable=False)
    license_key = Column(String(500), nullable=True)
    license_type = Column(String(100), nullable=True)
    seats = Column(Integer, nullable=True)
    expiry_date = Column(Date, nullable=True)
    cost = Column(Numeric(10, 2), nullable=True)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_software_licenses_tenant_id", "tenant_id"),
        Index("ix_software_licenses_software_id", "software_id"),
        Index("ix_software_licenses_expiry", "tenant_id", "expiry_date"),
    )

    software = relationship("Software", back_populates="licenses")


class DeviceSoftware(Base):
    __tablename__ = "device_software"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id"), nullable=False)
    software_id = Column(UUID(as_uuid=True), ForeignKey("software.id"), nullable=False)
    version = Column(String(100), nullable=True)
    installed_at = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_device_software_device_id", "device_id"),
        Index("ix_device_software_software_id", "software_id"),
        Index("ix_device_software_tenant_id", "tenant_id"),
        # منع تكرار نفس البرنامج على نفس الجهاز
        Index("ix_device_software_unique", "device_id", "software_id", unique=True),
    )

    device = relationship("Device", back_populates="software")
    software = relationship("Software", back_populates="device_software")


class OperatingSystem(Base):
    __tablename__ = "operating_systems"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    name = Column(String(200), nullable=False)
    version = Column(String(100), nullable=True)
    architecture = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (Index("ix_operating_systems_tenant_id", "tenant_id"),)

    device_os = relationship("DeviceOS", back_populates="os")


class DeviceOS(Base):
    __tablename__ = "device_os"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id"), nullable=False)
    os_id = Column(
        UUID(as_uuid=True), ForeignKey("operating_systems.id"), nullable=False
    )
    install_date = Column(Date, nullable=True)
    is_primary = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_device_os_device_id", "device_id"),
        Index("ix_device_os_tenant_id", "tenant_id"),
    )

    device = relationship("Device", back_populates="os")
    os = relationship("OperatingSystem", back_populates="device_os")
