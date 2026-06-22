from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Date, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base


class DeviceHardware(Base):
    __tablename__ = "device_hardware"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    device_id = Column(
        UUID(as_uuid=True), ForeignKey("devices.id"), nullable=False, unique=True
    )

    # ── CPU ────────────────────────────────────────────────────
    cpu_model = Column(String(200), nullable=True)
    cpu_cores = Column(Integer, nullable=True)
    cpu_threads = Column(Integer, nullable=True)
    cpu_speed_mhz = Column(Integer, nullable=True)
    cpu_cache_kb = Column(Integer, nullable=True)
    cpu_avg_temp_c = Column(Integer, nullable=True)  # Average Temperature in °C

    # ── Motherboard ────────────────────────────────────────────
    mb_manufacturer = Column(String(100), nullable=True)
    mb_model = Column(String(200), nullable=True)
    mb_bios_version = Column(String(100), nullable=True)
    mb_bios_date = Column(Date, nullable=True)
    mb_avg_temp_c = Column(
        Integer, nullable=True
    )  # Motherboard temp in °C (if reported)

    # ── RAM ────────────────────────────────────────────────────
    ram_total_mb = Column(Integer, nullable=True)  # 16
    ram_type = Column(String(50), nullable=True)  # DDR4
    ram_speed_mhz = Column(Integer, nullable=True)  # 2666
    ram_slots_total = Column(Integer, nullable=True)  # 2
    ram_slots_used = Column(Integer, nullable=True)  # 2
    ram_slots_free = Column(Integer, nullable=True) 
    ram_modules = Column(JSONB, nullable=True)

    # ── Storage ────────────────────────────────────────────────
    storage = Column(JSONB, nullable=True)

    # ── GPU ────────────────────────────────────────────────────
    gpu_model = Column(String(200), nullable=True)
    gpu_manufacturer = Column(String(100), nullable=True)
    gpu_memory_mb = Column(Integer, nullable=True)     # VRAM in MB — discrete GPUs only  ← NEW

    # ── Monitors (JSONB - بيدعم أكتر من شاشة) ─────────────────
    monitors = Column(JSONB, nullable=True)

    # ── Network - Ethernet ─────────────────────────────────────
    eth_adapter = Column(String(200), nullable=True)
    eth_mac = Column(String(50), nullable=True, unique=True)  # C0-25-A5-94-AF-A4
    eth_connections = Column(JSONB, nullable=True)

    # ── Network - WiFi ─────────────────────────────────────────
    wifi_adapter = Column(String(200), nullable=True)  # Intel Wi-Fi 6 AX201
    wifi_mac = Column(String(50), nullable=True)  # F4-4E-E3-B8-EA-A2
    wifi_connections = Column(JSONB, nullable=True)  # نفس structure الـ eth_connections

    # ── Metadata ───────────────────────────────────────────────
    speccy_scan_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_device_hardware_tenant_id", "tenant_id"),
        Index("ix_device_hardware_eth_mac", "eth_mac", unique=True),
        Index("ix_device_hardware_wifi_mac", "wifi_mac"),
    )

    # ── Relationships ──────────────────────────────────────────
    device = relationship("Device", back_populates="hardware")
