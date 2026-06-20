from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Any


# ----- RAM Module Schema -----
class RAMModule(BaseModel):
    slot: int
    type: Optional[str] = None  # DDR4
    size_mb: Optional[int] = None  # 8
    manufacturer: Optional[str] = None  # Crucial Technology
    part_number: Optional[str] = None  # CB8GU2666.C8RT
    serial: Optional[str] = None  # E7003701
    speed_mhz: Optional[int] = None  # 2666


# ----- Partition Schema -----
class PartitionData(BaseModel):
    partition_id: Optional[str] = None  # "Disk #0, Partition #0"
    disk_letter: Optional[str] = None  # "C:"
    file_system: Optional[str] = None  # NTFS, FAT32
    size_mb: Optional[int] = None
    used_mb: Optional[int] = None
    free_mb: Optional[int] = None


# ----- Storage Disk Schema -----
class StorageDisk(BaseModel):
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    capacity_mb: Optional[int] = None
    interface: Optional[str] = None  # SATA, SATA-2, USB (SATA), NVMe
    type: Optional[str] = None  # SSD, HDD, USB
    serial: Optional[str] = None
    smart_status: Optional[str] = None
    partitions: list[PartitionData] = []


# ----- Network Connection Schema -----
class NetworkConnection(BaseModel):
    ip: Optional[str] = None  # 192.168.1.65
    subnet: Optional[str] = None  # 255.255.255.0
    gateway: Optional[str] = None  # 192.168.1.1
    dhcp: bool = False


# ----- Request Schemas -----
class DeviceHardwareUpdate(BaseModel):
    """للتعديل اليدوي على بيانات الهاردوير"""

    cpu_model: Optional[str] = None
    cpu_cores: Optional[int] = None
    cpu_threads: Optional[int] = None
    cpu_speed_mhz: Optional[int] = None
    cpu_cache_kb: Optional[int] = None
    cpu_avg_temp_c: Optional[int] = None

    mb_manufacturer: Optional[str] = None
    mb_model: Optional[str] = None
    mb_bios_version: Optional[str] = None
    mb_bios_date: Optional[date] = None
    mb_avg_temp_c: Optional[int] = None

    ram_total_mb: Optional[Decimal] = None
    ram_type: Optional[str] = None
    ram_speed_mhz: Optional[int] = None
    ram_slots_total: Optional[int] = None
    ram_slots_used: Optional[int] = None
    ram_slots_free: Optional[int] = None  # ← NEW

    gpu_model: Optional[str] = None
    gpu_manufacturer: Optional[str] = None
    gpu_memory_mb: Optional[int] = None   # ← NEW — VRAM in MB

    monitor_model: Optional[str] = None
    monitor_manufacturer: Optional[str] = None
    monitor_resolution: Optional[str] = None
    monitor_refresh_hz: Optional[int] = None

    eth_adapter: Optional[str] = None
    eth_mac: Optional[str] = None
    wifi_adapter: Optional[str] = None
    wifi_mac: Optional[str] = None


# ----- Response Schema -----
class DeviceHardwareResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    device_id: UUID

    # CPU
    cpu_model: Optional[str] = None
    cpu_cores: Optional[int] = None
    cpu_threads: Optional[int] = None
    cpu_speed_mhz: Optional[int] = None
    cpu_cache_kb: Optional[int] = None
    cpu_avg_temp_c: Optional[int] = None

    # Motherboard
    mb_manufacturer: Optional[str] = None
    mb_model: Optional[str] = None
    mb_bios_version: Optional[str] = None
    mb_bios_date: Optional[date] = None
    mb_avg_temp_c: Optional[int] = None

    # RAM
    ram_total_mb: Optional[Decimal] = None
    ram_type: Optional[str] = None
    ram_speed_mhz: Optional[int] = None
    ram_slots_total: Optional[int] = None
    ram_slots_used: Optional[int] = None
    ram_slots_free: Optional[int] = None   # ← NEW
    ram_modules: Optional[list[RAMModule]] = None

    # Storage
    storage: Optional[list[StorageDisk]] = None

    # GPU
    gpu_model: Optional[str] = None
    gpu_manufacturer: Optional[str] = None
    gpu_memory_mb: Optional[int] = None    # ← NEW — None for iGPU / AMD APU

    # Monitor - بيدعم أكتر من شاشة
    monitors: Optional[list[dict]] = None

    # Network
    eth_adapter: Optional[str] = None
    eth_mac: Optional[str] = None
    eth_connections: Optional[list[NetworkConnection]] = None
    wifi_adapter: Optional[str] = None
    wifi_mac: Optional[str] = None
    wifi_connections: Optional[list[NetworkConnection]] = None

    speccy_scan_date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
