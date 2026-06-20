from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Enum,
    Date,
    Numeric,
    Integer,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from app.database import Base


class DeviceStatus(str, enum.Enum):
    active = "active"
    in_maintenance = "in_maintenance"
    retired = "retired"


class FieldType(str, enum.Enum):
    text = "text"
    integer = "integer"
    decimal = "decimal"
    boolean = "boolean"
    select = "select"
    ip = "ip"
    mac = "mac"
    date = "date"


class Device(Base):
    __tablename__ = "devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    department_id = Column(
        UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True
    )
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True)
    device_type_id = Column(
        UUID(as_uuid=True), ForeignKey("device_types.id"), nullable=False
    )
    device_model_id = Column(
        UUID(as_uuid=True), ForeignKey("device_models.id"), nullable=True
    )

    name = Column(String(200), nullable=False)
    serial_number = Column(String(200), nullable=True)
    status = Column(Enum(DeviceStatus), default=DeviceStatus.active, nullable=False)
    purchase_date = Column(Date, nullable=True)
    warranty_expiry = Column(Date, nullable=True)
    purchase_price = Column(Numeric(10, 2), nullable=True)
    custom_attributes = Column(JSONB, nullable=True, default=dict)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_devices_tenant_id", "tenant_id"),
        Index("ix_devices_tenant_status", "tenant_id", "status"),
        Index("ix_devices_tenant_type", "tenant_id", "device_type_id"),
        Index("ix_devices_tenant_department", "tenant_id", "department_id"),
        Index("ix_devices_tenant_warranty", "tenant_id", "warranty_expiry"),
        Index("ix_devices_custom_attrs", "custom_attributes", postgresql_using="gin"),
    )

    tenant = relationship("Tenant", back_populates="devices")
    department = relationship("Department", back_populates="devices")
    employee = relationship("Employee", back_populates="devices")
    device_type = relationship("DeviceType", back_populates="devices")
    device_model = relationship("DeviceModel", back_populates="devices")
    hardware = relationship(
        "DeviceHardware",
        back_populates="device",
        uselist=False,
        cascade="all, delete-orphan",
    )
    tickets = relationship("Ticket", back_populates="device")
    os = relationship("DeviceOS", back_populates="device", cascade="all, delete-orphan")
    software = relationship(
        "DeviceSoftware", back_populates="device", cascade="all, delete-orphan"
    )


class DeviceType(Base):
    __tablename__ = "device_types"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_device_types_tenant_id", "tenant_id"),
        Index("ix_device_types_tenant_name", "tenant_id", "name", unique=True),
    )

    devices = relationship("Device", back_populates="device_type")
    models = relationship("DeviceModel", back_populates="device_type")
    fields = relationship(
        "DeviceTypeField",
        back_populates="device_type",
        cascade="all, delete-orphan",
        order_by="DeviceTypeField.sort_order",
    )


class DeviceModel(Base):
    __tablename__ = "device_models"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    device_type_id = Column(
        UUID(as_uuid=True), ForeignKey("device_types.id"), nullable=False
    )
    manufacturer = Column(String(200), nullable=True)
    model_name = Column(String(200), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_device_models_tenant_id", "tenant_id"),
        Index("ix_device_models_tenant_type", "tenant_id", "device_type_id"),
    )

    device_type = relationship("DeviceType", back_populates="models")
    devices = relationship("Device", back_populates="device_model")


class DeviceTypeField(Base):
    __tablename__ = "device_type_fields"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    device_type_id = Column(
        UUID(as_uuid=True), ForeignKey("device_types.id"), nullable=False
    )
    field_key = Column(String(100), nullable=False)
    label = Column(String(200), nullable=False)
    field_type = Column(Enum(FieldType), nullable=False, default=FieldType.text)
    options = Column(JSONB, nullable=True)
    is_required = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_dtf_type_key", "device_type_id", "field_key", unique=True),
        Index("ix_dtf_tenant_type", "tenant_id", "device_type_id"),
    )

    device_type = relationship("DeviceType", back_populates="fields")
