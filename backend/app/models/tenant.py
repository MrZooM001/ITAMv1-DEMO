from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid


from app.database import Base


class Tenant(Base):
  __tablename__ = "tenants"

  id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  name = Column(String(200), nullable=False)
  slug = Column(String(100), nullable= False, unique= True)
  is_active = Column(Boolean, default= True)
  created_at = Column(DateTime(timezone=True), server_default= func.now())
  updated_at = Column(DateTime(timezone=True), server_default= func.now(), onupdate=func.now())

  # --- Replationships ---
  users = relationship("User", back_populates="tenant")
  departments = relationship("Department", back_populates="tenant")
  devices = relationship("Device", back_populates="tenant")
