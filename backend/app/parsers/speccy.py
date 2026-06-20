from lxml import etree
from datetime import datetime, date
from typing import Optional
from dataclasses import dataclass, field

# ----- Virtual Adapter Keywords (will be execluded) -----
VIRTUAL_ADAPTER_KEYWORDS = [
    "vmware",
    "virtual",
    "vpn",
    "kaspersky",
    "loopback",
    "bluetooth",
    "tunnel",
    "pseudo",
    "miniport",
    "wan",
]


# ----- Data Classes (Parser result) -----
@dataclass
class RAMModuleData:
    slot: int
    type: Optional[str] = None
    size_mb: Optional[int] = None
    manufacturer: Optional[str] = None
    part_number: Optional[str] = None
    serial: Optional[str] = None
    speed_mhz: Optional[int] = None


@dataclass
class PartitionData:
    partition_id: Optional[str] = None
    disk_letter: Optional[str] = None
    file_system: Optional[str] = None
    size_mb: Optional[int] = None
    used_mb: Optional[int] = None
    free_mb: Optional[int] = None


@dataclass
class StorageDiskData:
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    capacity_mb: Optional[int] = None
    interface: Optional[str] = None
    type: Optional[str] = None  # SSD, HDD, USB
    serial: Optional[str] = None
    smart_status: Optional[str] = None
    partitions: list = field(default_factory=list)  # list[PartitionData]


@dataclass
class MonitorData:
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    resolution: Optional[str] = None
    refresh_hz: Optional[int] = None
    is_primary: bool = False


@dataclass
class NetworkConnectionData:
    ip: Optional[str] = None
    subnet: Optional[str] = None
    gateway: Optional[str] = None
    dhcp: bool = False


@dataclass
class SpeccyData:
    # Metadata
    scan_date: Optional[datetime] = None

    # CPU
    cpu_model: Optional[str] = None
    cpu_cores: Optional[int] = None
    cpu_threads: Optional[int] = None
    cpu_speed_mhz: Optional[int] = None
    cpu_cache_kb: Optional[int] = None
    cpu_avg_temp_c: Optional[int] = None  # Average Temperature °C

    # Motherboard
    mb_manufacturer: Optional[str] = None
    mb_model: Optional[str] = None
    mb_bios_version: Optional[str] = None
    mb_bios_date: Optional[date] = None
    mb_avg_temp_c: Optional[int] = None  # Motherboard temp °C (if reported by sensor)

    # RAM
    ram_total_mb: Optional[int] = None
    ram_type: Optional[str] = None
    ram_speed_mhz: Optional[int] = None
    ram_slots_total: Optional[int] = None
    ram_slots_used: Optional[int] = None
    ram_slots_free: Optional[int] = None  # "Free memory slots" from Speccy
    ram_modules: list[RAMModuleData] = field(default_factory=list)

    # Storage
    storage: list[StorageDiskData] = field(default_factory=list)

    # GPU
    gpu_model: Optional[str] = None
    gpu_manufacturer: Optional[str] = None
    gpu_memory_mb: Optional[int] = None  # Discrete GPU VRAM in MB (absent for integrated GPU)

    # Monitors (Support multi-monitors)
    monitors: list[MonitorData] = field(default_factory=list)

    # Network - Ethernet
    eth_adapter: Optional[str] = None
    eth_mac: Optional[str] = None
    eth_connections: list[NetworkConnectionData] = field(default_factory=list)

    # Network - WiFi
    wifi_adapter: Optional[str] = None
    wifi_mac: Optional[str] = None
    wifi_connections: list[NetworkConnectionData] = field(default_factory=list)

    # OS
    os_name: Optional[str] = None
    os_architecture: Optional[str] = None
    os_install_date: Optional[date] = None


# ----- Helper Functions -----
def _get_section(root, *titles) -> Optional[etree._Element]:
    """بيدور على section بالعنوان في الـ XML"""
    current = root
    for title in titles:
        found = None
        for el in current:
            if el.get("title") == title:
                found = el
                break
        if found is None:
            return None
        current = found
    return current


def _get_entry_value(section, title) -> Optional[str]:
    """بيجيب value من entry معين"""
    if section is None:
        return None
    for entry in section:
        if entry.get("title") == title:
            return entry.get("value", "").strip() or None
    return None


def _is_virtual_adapter(name: str) -> bool:
    """بيتحقق لو الـ adapter virtual"""
    name_lower = name.lower()
    return any(keyword in name_lower for keyword in VIRTUAL_ADAPTER_KEYWORDS)


def _parse_int(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    try:
        return int(value.replace(",", "").strip())
    except (ValueError, AttributeError):
        return None


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _parse_scan_date(value: Optional[str]) -> Optional[datetime]:
    """Parse: 20250409T075830"""
    if not value:
        return None
    try:
        return datetime.strptime(value.strip(), "%Y%m%dT%H%M%S")
    except ValueError:
        return None


# ----- Main Parser -----
def parse_speccy_xml(xml_content: bytes) -> SpeccyData:
    """
    بيستقبل محتوى ملف Speccy XML ويرجع SpeccyData object
    """
    try:
        root = etree.fromstring(xml_content)
    except etree.XMLSyntaxError as e:
        raise ValueError(f"Invalid XML file: {e}")

    if root.tag != "speccydata":
        raise ValueError("Invalid Speccy file: missing <speccydata> root element")

    data = SpeccyData()

    # ----- Scan Date -----
    data.scan_date = _parse_scan_date(root.get("time"))

    # ----- OS -----
    _parse_os(root, data)

    # ----- CPU -----
    _parse_cpu(root, data)

    # ----- Motherboard -----
    _parse_motherboard(root, data)

    # ----- RAM -----
    _parse_ram(root, data)

    # ----- Storage -----
    _parse_storage(root, data)

    # ----- GPU & Monitor -----
    _parse_graphics(root, data)

    # ----- Network -----
    _parse_network(root, data)

    return data


# ----- Section Parsers -----
def _parse_os(root, data: SpeccyData):
    os_section = None
    for section in root:
        if section.get("title") == "Operating System":
            os_section = section
            break

    if os_section is None:
        return

    for entry in os_section:
        if entry.tag == "entry":
            arch = entry.get("value", "")
            if "64-bit" in arch or "32-bit" in arch:
                data.os_architecture = arch.strip()
            # Installation Date
            value = entry.get("value", "")
            if "Installation Date:" in value:
                date_str = value.replace("Installation Date:", "").strip()
                # "1/30/2025 10:04:16 AM" → ناخد التاريخ بس
                date_part = date_str.split(" ")[0]
                data.os_install_date = _parse_date(date_part)

    # OS Name من Summary
    summary = _get_section(root, "Summary")
    if summary is not None:
        os_entry = _get_section(summary, "Operating System")
        if os_entry is not None:
            for entry in os_entry:
                title = entry.get("title", "")
                if title:
                    data.os_name = title
                    # استنباط الـ architecture من الـ name
                    if "64-bit" in title:
                        data.os_architecture = "64-bit"
                    elif "32-bit" in title:
                        data.os_architecture = "32-bit"
                    break


def _parse_cache_kb(value: Optional[str]) -> Optional[int]:
    """
    بيحول cache size string لـ KB integer.
    Examples:
      "6144 KBytes"    → 6144
      "4 x 32 KBytes"  → 128   (4 × 32)
      "12288 KBytes"   → 12288
    """
    if not value:
        return None
    try:
        value = value.strip()
        if "x" in value:
            # e.g. "4 x 32 KBytes"
            parts = value.split("x")
            count = int(parts[0].strip())
            size = int(parts[1].replace("KBytes", "").replace("KB", "").strip())
            return count * size
        else:
            # e.g. "6144 KBytes"
            return int(value.replace("KBytes", "").replace("KB", "").strip())
    except (ValueError, IndexError):
        return None


def _parse_cpu(root, data: SpeccyData):
    cpu_section = None
    for section in root:
        if section.get("title") == "CPU":
            cpu_section = section
            break
    if cpu_section is None:
        return

    # بيدور على أول section جوا الـ CPU (اسم الـ CPU)
    for child in cpu_section:
        if child.tag == "section":
            data.cpu_model = _get_entry_value(child, "Specification")
            data.cpu_cores = _parse_int(_get_entry_value(child, "Cores"))
            data.cpu_threads = _parse_int(_get_entry_value(child, "Threads"))

            # Speed من Stock Core Speed: "3200 MHz" → 3200
            speed_str = _get_entry_value(child, "Stock Core Speed")
            if speed_str:
                try:
                    data.cpu_speed_mhz = int(speed_str.replace("MHz", "").strip())
                except ValueError:
                    pass

            # Cache — بناخد أعلى level متاح (L3 → L2 → L1)
            caches_section = _get_section(child, "Caches")
            if caches_section is not None:
                for level in (
                    "L3 Unified Cache Size",
                    "L2 Unified Cache Size",
                    "L1 Data Cache Size",
                ):
                    raw = _get_entry_value(caches_section, level)
                    kb = _parse_cache_kb(raw)
                    if kb is not None:
                        data.cpu_cache_kb = kb
                        break

            # Average Temperature: "39 °C" → 39
            temp_str = _get_entry_value(child, "Average Temperature")
            if temp_str:
                try:
                    data.cpu_avg_temp_c = int(
                        temp_str.replace("°C", "").replace("°", "").strip()
                    )
                except ValueError:
                    pass

            break


def _parse_motherboard(root, data: SpeccyData):
    mb_section = None
    for section in root:
        if section.get("title") == "Motherboard":
            mb_section = section
            break
    if mb_section is None:
        return

    data.mb_manufacturer = _get_entry_value(mb_section, "Manufacturer")
    data.mb_model = _get_entry_value(mb_section, "Model")

    bios_section = _get_section(mb_section, "BIOS")
    if bios_section is not None:
        data.mb_bios_version = _get_entry_value(bios_section, "Version")
        data.mb_bios_date = _parse_date(_get_entry_value(bios_section, "Date"))

    # Motherboard temperature — بعض الـ boards بتحتها temp sensor
    # Speccy بيعرضها في الـ Motherboard mainsection كـ entry value مباشرةً
    # e.g. <entry title="Motherboard" value="32 °C" />
    for child in mb_section:
        if child.tag == "entry":
            val = child.get("value", "")
            if "°C" in val or "°" in val:
                try:
                    data.mb_avg_temp_c = int(
                        val.replace("°C", "").replace("°", "").strip()
                    )
                    break
                except ValueError:
                    pass


def _parse_ram(root, data: SpeccyData):
    ram_section = None
    for section in root:
        if section.get("title") == "RAM":
            ram_section = section
            break
    if ram_section is None:
        return

    memory_section = _get_section(ram_section, "Memory")
    if memory_section is not None:
        data.ram_type = _get_entry_value(memory_section, "Type")

        # Speed من DRAM Frequency: "1333.3 MHz" → 1333
        freq_str = _get_entry_value(memory_section, "DRAM Frequency")
        if freq_str:
            try:
                data.ram_speed_mhz = int(float(freq_str.replace("MHz", "").strip()))
            except ValueError:
                pass

        # Total size: "16384 MBytes" → 16384
        size_str = _get_entry_value(memory_section, "Size")
        if size_str:
            try:
                data.ram_total_mb = int(size_str.replace("MBytes", "").strip())
            except ValueError:
                pass

    slots_section = _get_section(ram_section, "Memory slots")
    if slots_section is not None:
        data.ram_slots_total = _parse_int(
            _get_entry_value(slots_section, "Total memory slots")
        )
        data.ram_slots_used = _parse_int(
            _get_entry_value(slots_section, "Used memory slots")
        )
        data.ram_slots_free = _parse_int(
            _get_entry_value(slots_section, "Free memory slots")
        )

    # RAM Modules (SPD)
    spd_section = _get_section(ram_section, "SPD")
    if spd_section is not None:
        slot_num = 1
        for child in spd_section:
            if child.tag == "section" and "Slot" in child.get("title", ""):
                module = RAMModuleData(slot=slot_num)
                module.type = _get_entry_value(child, "Type")
                module.manufacturer = _get_entry_value(child, "Manufacturer")
                module.part_number = _get_entry_value(child, "Part Number")
                module.serial = _get_entry_value(child, "Serial Number")

                # Size: "8192 MBytes" → 8192
                size_str = _get_entry_value(child, "Size")
                if size_str:
                    try:
                        module.size_mb = int(size_str.replace("MBytes", "").strip())
                    except ValueError:
                        pass

                # Speed من Max Bandwidth: "DDR4-2666 (1333 MHz)" → 2666
                bandwidth = _get_entry_value(child, "Max Bandwidth")
                if bandwidth and "-" in bandwidth:
                    try:
                        module.speed_mhz = int(bandwidth.split("-")[1].split(" ")[0])
                    except (ValueError, IndexError):
                        pass

                data.ram_modules.append(module)
                slot_num += 1


def _parse_storage(root, data: SpeccyData):
    storage_section = None
    for section in root:
        if section.get("title") == "Storage":
            storage_section = section
            break
    if storage_section is None:
        return

    hard_drives = _get_section(storage_section, "Hard drives")
    if hard_drives is None:
        return

    for drive_section in hard_drives:
        if drive_section.tag != "section":
            continue

        disk = StorageDiskData()

        # Model من اسم الـ section (بيشيل الـ (SSD) أو (HDD) من الاسم)
        section_title = drive_section.get("title", "")
        disk.model = section_title.replace("(SSD)", "").replace("(HDD)", "").strip()

        # Type من اسم الـ section
        if "(SSD)" in section_title:
            disk.type = "SSD"
        elif "(HDD)" in section_title:
            disk.type = "HDD"

        disk.manufacturer = _get_entry_value(drive_section, "Manufacturer")
        disk.serial = _get_entry_value(drive_section, "Serial Number")
        disk.interface = _get_entry_value(drive_section, "Interface")

        # لو interface فيها USB → type = USB
        if disk.interface and "USB" in disk.interface:
            disk.type = "USB"

        # لو type لسه None → نحاول نحدده من Speed
        if disk.type is None:
            speed = _get_entry_value(drive_section, "Speed")
            if speed and "RPM" in speed:
                disk.type = "HDD"

        # Capacity: "1863 GB" → MB
        capacity_str = _get_entry_value(drive_section, "Capacity")
        if capacity_str:
            try:
                gb = float(capacity_str.replace("GB", "").strip())
                disk.capacity_mb = int(gb * 1024)
            except ValueError:
                pass

        # SMART Status
        smart_section = _get_section(drive_section, "S.M.A.R.T")
        if smart_section is not None:
            disk.smart_status = _get_entry_value(smart_section, "Status")

        # Partitions
        for child in drive_section:
            if child.tag == "section" and child.get("title", "").startswith(
                "Partition"
            ):
                partition = PartitionData()
                partition.partition_id = _get_entry_value(child, "Partition ID")
                partition.disk_letter = _get_entry_value(child, "Disk Letter")
                partition.file_system = _get_entry_value(child, "File System")

                # Size: "1750 GB" → MB
                size_str = _get_entry_value(child, "Size")
                if size_str:
                    try:
                        if "GB" in size_str:
                            partition.size_mb = int(
                                float(size_str.replace("GB", "").strip()) * 1024
                            )
                        elif "MB" in size_str:
                            partition.size_mb = int(size_str.replace("MB", "").strip())
                    except ValueError:
                        pass

                # Used Space: "918 GB (52%)" → MB
                used_str = _get_entry_value(child, "Used Space")
                if used_str:
                    try:
                        used_val = used_str.split("(")[0].strip()
                        if "GB" in used_val:
                            partition.used_mb = int(
                                float(used_val.replace("GB", "").strip()) * 1024
                            )
                        elif "MB" in used_val:
                            partition.used_mb = int(used_val.replace("MB", "").strip())
                    except ValueError:
                        pass

                # Free Space
                free_str = _get_entry_value(child, "Free Space")
                if free_str:
                    try:
                        free_val = free_str.split("(")[0].strip()
                        if "GB" in free_val:
                            partition.free_mb = int(
                                float(free_val.replace("GB", "").strip()) * 1024
                            )
                        elif "MB" in free_val:
                            partition.free_mb = int(free_val.replace("MB", "").strip())
                    except ValueError:
                        pass

                disk.partitions.append(partition)

        data.storage.append(disk)


def _parse_graphics(root, data: SpeccyData):
    graphics_section = None
    for section in root:
        if section.get("title") == "Graphics":
            graphics_section = section
            break
    if graphics_section is None:
        return

    for child in graphics_section:
        if child.tag != "section":
            continue

        title = child.get("title", "")

        # ----- Monitor Sections -----
        if title.startswith("Monitor"):
            monitor = MonitorData()

            # "LI2215sD on Intel UHD Graphics 630" → ناخد الجزء قبل "on"
            name_full = _get_entry_value(child, "Name")
            if name_full and " on " in name_full:
                monitor.model = name_full.split(" on ")[0].strip()

            # Resolution
            width = _get_entry_value(child, "Monitor Width")
            height = _get_entry_value(child, "Monitor Height")
            if width and height:
                monitor.resolution = f"{width}x{height}"

            # Refresh Rate
            freq_str = _get_entry_value(child, "Monitor Frequency")
            if freq_str:
                try:
                    monitor.refresh_hz = int(freq_str.replace("Hz", "").strip())
                except ValueError:
                    pass

            # Primary monitor
            state = _get_entry_value(child, "State")
            if state and "Primary" in state:
                monitor.is_primary = True

            data.monitors.append(monitor)

        # ----- GPU Sections -----
        else:
            # أول GPU بس اللي هناخده (لو فيه أكتر من GPU)
            if not data.gpu_model:
                data.gpu_model = _get_entry_value(child, "Model")
                data.gpu_manufacturer = _get_entry_value(child, "Manufacturer")
                
                # Memory: "4095 MB" → 4095  (only present for discrete GPUs)
                mem_str = _get_entry_value(child, "Memory")
                if mem_str:
                    try:
                        data.gpu_memory_mb = int(mem_str.replace("MB", "").strip())
                    except ValueError:
                        pass

    # ----- Monitor Manufacturer من Device Tree -----
    _parse_monitor_manufacturer_from_device_tree(root, data)


def _parse_monitor_manufacturer_from_device_tree(root, data: SpeccyData):
    """بيجيب الـ monitor manufacturer من الـ Device Tree لكل الشاشات"""
    if not data.monitors:
        return

    for section in root:
        if section.get("title") != "Operating System":
            continue
        for child in section:
            if child.get("title") != "Device Tree":
                continue
            for entry in child.iter("entry"):
                value = entry.get("value", "").strip()
                if not value:
                    continue
                # بيدور على كل شاشة ويحاول يلاقي الـ manufacturer بتاعها
                for monitor in data.monitors:
                    if (
                        monitor.model
                        and monitor.model in value
                        and not monitor.manufacturer
                    ):
                        parts = value.split(" ", 1)
                        if len(parts) == 2:
                            monitor.manufacturer = parts[0]
        return


def _parse_network(root, data: SpeccyData):
    network_section = None
    for section in root:
        if section.get("title") == "Network":
            network_section = section
            break
    if network_section is None:
        return

    adapters_section = _get_section(network_section, "Adapters List", "Enabled")
    if adapters_section is None:
        return

    for adapter_section in adapters_section:
        if adapter_section.tag != "section":
            continue

        adapter_name = adapter_section.get("title", "")

        # استبعاد الـ Virtual Adapters
        if _is_virtual_adapter(adapter_name):
            continue

        mac = _get_entry_value(adapter_section, "MAC Address")
        dhcp = _get_entry_value(adapter_section, "DHCP enabled") == "Yes"
        ip = _get_entry_value(adapter_section, "IP Address")
        subnet = _get_entry_value(adapter_section, "Subnet mask")
        gateway = _get_entry_value(adapter_section, "Gateway server")

        connection = NetworkConnectionData(
            ip=ip, subnet=subnet, gateway=gateway, dhcp=dhcp
        )

        # Ethernet أو WiFi؟
        adapter_lower = adapter_name.lower()
        if (
            "wi-fi" in adapter_lower
            or "wifi" in adapter_lower
            or "wireless" in adapter_lower
        ):
            if not data.wifi_adapter:
                data.wifi_adapter = adapter_name
                data.wifi_mac = mac
            if ip:
                data.wifi_connections.append(connection)
        else:
            if not data.eth_adapter:
                data.eth_adapter = adapter_name
                data.eth_mac = mac
            if ip:
                data.eth_connections.append(connection)
