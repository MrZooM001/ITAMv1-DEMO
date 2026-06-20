from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.models.network_scan import ScanStatus, DeviceTypeGuess


# ----- Network interface -----
class NetworkInterfaceResponse(BaseModel):
    name:    str
    ip:      str
    netmask: str
    type:    str   # "wifi" | "ethernet"
    subnet:  str   # computed CIDR e.g. 192.168.1.0/24


# ----- Trigger a scan -----
class ScanRequest(BaseModel):
    subnet: str = Field(
        ...,
        description="CIDR subnet to scan, e.g. 192.168.1.0/24",
        examples=["192.168.1.0/24"],
    )
    preferred_iface: Optional[str] = Field(
        None,
        description=(
            "Network interface name to use for ARP sweep. "
            "If omitted the engine auto-selects the best matching adapter. "
            "Use GET /network/interfaces to list available adapters."
        ),
        examples=["Wi-Fi", "wlan0", "Ethernet"],
    )


# ----- Single discovered host -----
class DiscoveredHostResponse(BaseModel):
    id:           UUID
    ip:           str
    mac:          Optional[str]         = None
    hostname:     Optional[str]         = None
    manufacturer: Optional[str]         = None
    open_ports:   list[int]             = []
    os_guess:     Optional[str]         = None
    device_type:  DeviceTypeGuess
    is_known:     bool
    asset_id:     Optional[UUID]        = None
    imported:     bool
    imported_at:  Optional[datetime]    = None

    model_config = {"from_attributes": True}


# ----- Scan summary (list view) -----
class NetworkScanSummary(BaseModel):
    id:           UUID
    subnet:       str
    status:       ScanStatus
    total_found:  int
    total_new:    int
    total_known:  int
    started_at:   Optional[datetime]    = None
    finished_at:  Optional[datetime]    = None
    created_at:   datetime
    error:        Optional[str]         = None

    model_config = {"from_attributes": True}


# ----- Scan detail (includes all hosts) -----
class NetworkScanDetail(NetworkScanSummary):
    hosts: list[DiscoveredHostResponse] = []


# ----- Import a discovered host into assets -----
class ImportHostRequest(BaseModel):
    host_id:        UUID
    name:           str  = Field(..., min_length=2, max_length=200)
    device_type_id: Optional[UUID] = None
    department_id:  Optional[UUID] = None


# ----- Bulk import -----
class BulkImportRequest(BaseModel):
    imports: list[ImportHostRequest] = Field(..., min_length=1)


class ImportResult(BaseModel):
    host_id:  UUID
    success:  bool
    asset_id: Optional[UUID] = None
    error:    Optional[str]  = None


class BulkImportResponse(BaseModel):
    imported: int
    failed:   int
    results:  list[ImportResult]
