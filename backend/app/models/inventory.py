from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    name = Column(String(200), nullable=False)
    category = Column(String(100), nullable=True)
    quantity = Column(Integer, default=0, nullable=False)
    min_quantity = Column(Integer, default=0, nullable=False)
    unit = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_inventory_tenant_id", "tenant_id"),
        Index("ix_inventory_tenant_category", "tenant_id", "category"),
    )


class SparePart(Base):
    __tablename__ = "spare_parts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    name = Column(String(200), nullable=False)
    compatible_with = Column(Text, nullable=True)
    quantity = Column(Integer, default=0, nullable=False)
    min_quantity = Column(Integer, default=0, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (Index("ix_spare_parts_tenant_id", "tenant_id"),)

    # ── Relationships ──────────────────────────────────────────
    usage = relationship("SparePartUsage", back_populates="spare_part")
