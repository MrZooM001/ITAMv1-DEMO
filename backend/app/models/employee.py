from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base


class Employee(Base):
    __tablename__ = "employees"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    department_id = Column(
        UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True
    )
    full_name = Column(String(200), nullable=False)
    email = Column(String(200), nullable=True)
    phone = Column(String(50), nullable=True)
    job_title = Column(String(200), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_employees_tenant_id", "tenant_id"),
        Index("ix_employees_tenant_department", "tenant_id", "department_id"),
        Index("ix_employees_tenant_active", "tenant_id", "is_active"),
    )

    # ── Relationships ──────────────────────────────────────────
    department = relationship("Department", back_populates="employees")
    devices = relationship("Device", back_populates="employee")
    tickets = relationship(
        "Ticket", back_populates="employee", foreign_keys="Ticket.reported_by"
    )
