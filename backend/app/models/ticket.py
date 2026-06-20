from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, Integer, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from app.database import Base


class TicketPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class TicketStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"
    cancelled = "cancelled"


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id"), nullable=True)
    reported_by = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    ticket_number = Column(String(50), nullable=False, unique=True)  # TKT-2025-0001
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(
        Enum(TicketPriority), default=TicketPriority.medium, nullable=False
    )
    status = Column(Enum(TicketStatus), default=TicketStatus.open, nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_tickets_tenant_id", "tenant_id"),
        Index("ix_tickets_tenant_status", "tenant_id", "status"),
        Index("ix_tickets_tenant_priority", "tenant_id", "priority"),
        Index("ix_tickets_tenant_created", "tenant_id", "created_at"),
        Index("ix_tickets_device_id", "device_id"),
        Index("ix_tickets_assigned_to", "assigned_to"),
    )

    # ----- Relationships -----
    device = relationship("Device", back_populates="tickets")
    employee = relationship(
        "Employee", back_populates="tickets", foreign_keys=[reported_by]
    )
    assignee = relationship("User", foreign_keys=[assigned_to])
    updates = relationship("TicketUpdate", back_populates="ticket")
    spare_parts = relationship("SparePartUsage", back_populates="ticket")


class TicketUpdate(Base):
    __tablename__ = "ticket_updates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.id"), nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    note = Column(Text, nullable=False)
    old_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # ----- Relationships -----
    ticket = relationship("Ticket", back_populates="updates")


class SparePartUsage(Base):
    __tablename__ = "spare_parts_usage"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.id"), nullable=False)
    spare_part_id = Column(
        UUID(as_uuid=True), ForeignKey("spare_parts.id"), nullable=False
    )
    quantity_used = Column(Integer, nullable=False)
    used_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_spare_parts_usage_ticket_id", "ticket_id"),
        Index("ix_spare_parts_usage_spare_part_id", "spare_part_id"),
        Index("ix_spare_parts_usage_tenant_id", "tenant_id"),
    )

    # ----- Relationships -----
    ticket = relationship("Ticket", back_populates="spare_parts")
    spare_part = relationship("SparePart", back_populates="usage")
