"""
LAN discovery engine — supports both Ethernet and Wi-Fi adapters.

Layer 1 — Interface detection : lists all usable network adapters (Ethernet + Wi-Fi)
Layer 2 — ARP sweep           : sends ARP via the correct adapter (fixes Wi-Fi failures)
Layer 3 — Port scan           : nmap fingerprinting per live host
Layer 4 — Enrichment          : reverse-DNS + MAC→OUI manufacturer lookup

Wi-Fi fix explained:
  The previous version called scapy's srp() without specifying which network
  interface to use. On Windows, scapy defaults to the first adapter it finds,
  which is almost always the Ethernet adapter — even if the machine is connected
  via Wi-Fi. When the Ethernet cable is unplugged, scapy finds no suitable
  interface and silently fails or raises an exception. The fix is to:
    1. Enumerate all interfaces with an IP on the target subnet
    2. Pass that interface explicitly to srp(iface=...)
    3. If multiple adapters match, try each one until ARP responses come back

Requires:
  pip install scapy python-nmap psutil
  nmap binary in PATH (https://nmap.org/download)

On Windows: run uvicorn as Administrator (raw-socket ARP needs admin rights).
On Linux:   run with sudo OR:  sudo setcap cap_net_raw+eip $(which python3)
"""

from __future__ import annotations

import ipaddress
import logging
import platform
import socket
import subprocess
import concurrent.futures
from typing import Optional

log = logging.getLogger(__name__)

# ----- OUI prefix → manufacturer -----
_OUI: dict[str, str] = {
    "00:00:0C": "Cisco",           "00:1A:A1": "Cisco",
    "00:1C:58": "Cisco",           "F8:72:EA": "Cisco",
    "CC:EF:48": "Cisco",           "00:0D:54": "Cisco",
    "B8:27:EB": "Raspberry Pi",    "DC:A6:32": "Raspberry Pi",
    "00:60:2F": "Cisco-Linksys",   "00:50:56": "VMware",
    "00:0C:29": "VMware",          "00:15:5D": "Microsoft Hyper-V",
    "08:00:27": "VirtualBox",
    "00:00:48": "Seagate",         "00:80:92": "Xerox",
    "00:00:AA": "Xerox",           "00:00:74": "Ricoh",
    "00:60:B0": "Hewlett-Packard", "00:1B:78": "Hewlett-Packard",
    "3C:2A:F4": "Brother",         "00:80:77": "Brother",
    "00:17:C8": "Canon",           "00:1E:8F": "Canon",
    "00:26:73": "Kyocera",         "00:C0:EE": "KONICA MINOLTA",
    "00:14:22": "Dell",            "00:21:70": "Dell",
    "18:03:73": "Dell",            "F0:1F:AF": "Dell",
    "B8:CA:3A": "Dell",            "34:17:EB": "Dell",
    "00:1F:29": "HP",              "00:25:B3": "HP",
    "3C:D9:2B": "HP",              "A0:B3:CC": "HP",
    "00:0A:E4": "Lenovo",          "40:49:0F": "Lenovo",
    "54:EE:75": "Lenovo",          "00:09:6B": "IBM",
    "00:17:F2": "Apple",           "AC:DE:48": "Apple",
    "F0:18:98": "Apple",
    "C0:25:A5": "Samsung",         "00:16:32": "Samsung",
    "50:C7:BF": "TP-Link",         "EC:08:6B": "TP-Link",
    "DC:9F:DB": "Ubiquiti",        "24:A4:3C": "Ubiquiti",
    "00:09:5B": "Netgear",         "20:E5:2A": "Netgear",
    "00:1C:F0": "D-Link",          "00:1A:2B": "D-Link",
    "04:D9:F5": "ASUS",            "AC:22:0B": "ASUS",
    "00:13:49": "Zyxel",
    "00:00:0E": "Fujitsu",         "00:80:45": "Panasonic",
    "00:1B:21": "Intel",           "8C:EC:4B": "Intel",
    "00:19:D1": "Intel",
    # Wi-Fi chipset vendors
    "00:03:7F": "Atheros",         "00:21:5C": "Realtek",
    "00:E0:4C": "Realtek",         "F4:4E:E3": "Intel Wi-Fi",
    "A4:C3:F0": "Intel Wi-Fi",
}


def _oui_lookup(mac: Optional[str]) -> Optional[str]:
    if not mac:
        return None
    return _OUI.get(mac.upper()[:8])


def _reverse_dns(ip: str) -> Optional[str]:
    try:
        return socket.gethostbyaddr(ip)[0]
    except Exception:
        return None


# ----- Port → device type hints -----
_PORT_HINTS: dict[int, str] = {
    9100: "printer",       # JetDirect
    631:  "printer",       # IPP / CUPS
    515:  "printer",       # LPD
    23:   "switch",        # Telnet → managed switch / old router
    161:  "switch",        # SNMP
    22:   "linux_server",
    3389: "windows_pc",
    445:  "windows_pc",    # SMB
    5985: "windows_pc",    # WinRM
    2049: "nas",           # NFS
    548:  "nas",           # AFP
    5060: "voip_phone",    # SIP
    554:  "camera",        # RTSP
    8554: "camera",
    1883: "access_point",  # MQTT
}
_ROUTER_PORTS = {80, 443, 8080, 8443}


def _classify(open_ports: list[int], manufacturer: Optional[str], os_guess: Optional[str]) -> str:
    port_set = set(open_ports)
    for port, dtype in _PORT_HINTS.items():
        if port in port_set:
            return dtype

    mfr = (manufacturer or "").lower()
    os  = (os_guess or "").lower()

    if any(x in mfr for x in ("brother", "xerox", "canon", "ricoh", "hp", "kyocera", "konica")):
        return "printer"
    if any(x in mfr for x in ("cisco", "ubiquiti", "netgear", "d-link", "zyxel", "tp-link", "atheros")):
        if port_set and port_set.issubset(_ROUTER_PORTS | {22, 23, 161}):
            return "router"
        return "switch"
    if "windows" in os:
        return "windows_pc"
    if any(x in os for x in ("linux", "ubuntu", "debian", "centos")):
        return "linux_server"
    if port_set and port_set.issubset(_ROUTER_PORTS):
        return "router"
    return "unknown"


# ----- Interface detection -----
def list_interfaces() -> list[dict]:
    """
    Return all network interfaces that have a real IPv4 address assigned.
    Works on Windows and Linux. Each entry: {name, ip, netmask, type}
    where type is 'wifi' or 'ethernet'.
    """
    results: list[dict] = []

    try:
        import psutil
        for iface_name, addrs in psutil.net_if_addrs().items():
            for addr in addrs:
                if addr.family == socket.AF_INET and not addr.address.startswith("127."):
                    results.append({
                        "name":    iface_name,
                        "ip":      addr.address,
                        "netmask": addr.netmask or "255.255.255.0",
                        "type":    _guess_iface_type(iface_name),
                    })
    except ImportError:
        log.warning("psutil not installed — interface detection is limited")
        try:
            hostname = socket.gethostname()
            for item in socket.getaddrinfo(hostname, None):
                ip = item[4][0]
                if ":" not in ip and not ip.startswith("127."):
                    results.append({
                        "name":    "default",
                        "ip":      ip,
                        "netmask": "255.255.255.0",
                        "type":    "ethernet",
                    })
        except Exception as exc:
            log.error("Interface detection fallback failed: %s", exc)

    return results


def _guess_iface_type(name: str) -> str:
    """Heuristic: identify Wi-Fi vs Ethernet by interface name."""
    n = name.lower()
    wifi_hints = ("wi-fi", "wifi", "wlan", "wireless", "airport", "802.11",
                  "wlp", "wlo", "wlx")
    if any(h in n for h in wifi_hints):
        return "wifi"
    return "ethernet"


def _subnet_from_iface(iface: dict) -> str:
    """Compute CIDR subnet from an interface's IP and netmask."""
    try:
        network = ipaddress.IPv4Network(
            f"{iface['ip']}/{iface['netmask']}", strict=False
        )
        return str(network)
    except Exception:
        parts = iface["ip"].rsplit(".", 1)
        return f"{parts[0]}.0/24"


def _iface_matches_subnet(iface: dict, subnet: str) -> bool:
    """Check whether an interface's IP is inside the requested subnet."""
    try:
        network = ipaddress.IPv4Network(subnet, strict=False)
        return ipaddress.IPv4Address(iface["ip"]) in network
    except Exception:
        return False


# ----- ARP sweep — with explicit interface (Wi-Fi fix) -----
def _arp_sweep_on_iface(subnet: str, iface_name: str) -> list[dict]:
    """
    ARP sweep bound to a specific network interface.
    Passing iface= explicitly to scapy's srp() is the core Wi-Fi fix:
    without it scapy always picks the first adapter (usually Ethernet).
    """
    from scapy.layers.l2 import ARP, Ether
    from scapy.sendrecv import srp

    log.info("ARP sweep on %s via interface '%s'", subnet, iface_name)
    pkt = Ether(dst="ff:ff:ff:ff:ff:ff") / ARP(pdst=subnet)
    answered, _ = srp(pkt, iface=iface_name, timeout=3, verbose=False)
    return [{"ip": r[1].psrc, "mac": r[1].hwsrc} for r in answered]


def _arp_sweep(subnet: str, preferred_iface: Optional[str] = None) -> list[dict]:
    """
    Smart ARP sweep:
    1. Find all local interfaces whose IP is inside the target subnet
    2. If preferred_iface supplied, try it first
    3. Otherwise try Ethernet before Wi-Fi (more reliable ARP)
    4. Return results from the first interface that gives responses
    5. Fall back to ICMP ping sweep if scapy is unavailable or all fail
    """
    try:
        from scapy.layers.l2 import ARP  # noqa — import check only

        interfaces = list_interfaces()
        matching = [i for i in interfaces if _iface_matches_subnet(i, subnet)]

        if not matching:
            log.warning("No local interface found for subnet %s — trying all", subnet)
            matching = interfaces

        if preferred_iface:
            matching.sort(key=lambda i: 0 if i["name"] == preferred_iface else 1)
        else:
            # Ethernet first, Wi-Fi second
            matching.sort(key=lambda i: 0 if i["type"] == "ethernet" else 1)

        for iface in matching:
            try:
                results = _arp_sweep_on_iface(subnet, iface["name"])
                if results:
                    log.info(
                        "ARP via '%s' (%s) — %d hosts found",
                        iface["name"], iface["type"], len(results),
                    )
                    return results
                log.warning("ARP via '%s' returned 0 results — trying next", iface["name"])
            except Exception as exc:
                log.warning("ARP failed on '%s': %s", iface["name"], exc)

        log.warning("All ARP attempts failed — falling back to ping sweep")
        return _ping_sweep(subnet)

    except ImportError:
        log.warning("scapy not installed — falling back to ping sweep")
        return _ping_sweep(subnet)


def _ping_sweep(subnet: str) -> list[dict]:
    """Pure-Python ICMP fallback — no MACs, but zero extra dependencies."""
    is_windows   = platform.system().lower() == "windows"
    count_flag   = "-n" if is_windows else "-c"
    timeout_flag = "-w" if is_windows else "-W"
    network      = ipaddress.ip_network(subnet, strict=False)

    def _ping(ip: str) -> Optional[dict]:
        try:
            r = subprocess.run(
                ["ping", count_flag, "1", timeout_flag, "500", ip],
                capture_output=True, timeout=2,
            )
            return {"ip": ip, "mac": None} if r.returncode == 0 else None
        except Exception:
            return None

    live: list[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=64) as pool:
        for result in pool.map(_ping, (str(h) for h in network.hosts())):
            if result:
                live.append(result)
    return live


# ----- Port scan (nmap with socket fallback) -----─
_PROBE_PORTS = (
    "22,23,80,135,139,161,443,445,515,548,554,"
    "631,1883,2049,3389,5060,5985,8080,8443,8554,9100"
)


def _nmap_scan(ip: str) -> dict:
    try:
        import nmap
        nm = nmap.PortScanner()
        nm.scan(hosts=ip, ports=_PROBE_PORTS, arguments="-O --host-timeout 10s -T4")
        host_data  = nm[ip] if ip in nm.all_hosts() else {}
        open_ports = [
            p for p, info in host_data.get("tcp", {}).items()
            if info.get("state") == "open"
        ]
        os_matches = host_data.get("osmatch", [])
        os_guess   = os_matches[0].get("name") if os_matches else None
        return {"open_ports": open_ports, "os_guess": os_guess}
    except Exception as exc:
        log.warning("nmap failed for %s (%s) — socket fallback", ip, exc)
        return _socket_probe(ip)


def _socket_probe(ip: str) -> dict:
    """Raw socket port probe — no nmap needed, slower but dependency-free."""
    ports = [int(p) for p in _PROBE_PORTS.split(",")]
    open_ports: list[int] = []

    def _check(port: int) -> Optional[int]:
        try:
            with socket.create_connection((ip, port), timeout=0.5):
                return port
        except Exception:
            return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=32) as pool:
        for r in pool.map(_check, ports):
            if r is not None:
                open_ports.append(r)

    return {"open_ports": sorted(open_ports), "os_guess": None}


# ----- Main entry point -----
def run_scan(subnet: str, preferred_iface: Optional[str] = None) -> list[dict]:
    """
    Full LAN discovery scan.
      subnet          — CIDR range e.g. "192.168.1.0/24"
      preferred_iface — optional adapter name to use first (e.g. "Wi-Fi", "wlan0")
    Returns list of enriched host dicts ready to be persisted.
    """
    log.info("Starting scan on %s (preferred_iface=%s)", subnet, preferred_iface)
    hosts = _arp_sweep(subnet, preferred_iface=preferred_iface)
    log.info("Discovery: %d live hosts", len(hosts))

    def _enrich(host: dict) -> dict:
        ip           = host["ip"]
        mac          = host.get("mac")
        hostname     = _reverse_dns(ip)
        manufacturer = _oui_lookup(mac)
        scan         = _nmap_scan(ip)
        open_ports   = scan["open_ports"]
        os_guess     = scan["os_guess"]
        device_type  = _classify(open_ports, manufacturer, os_guess)
        return {
            "ip": ip, "mac": mac, "hostname": hostname,
            "manufacturer": manufacturer, "open_ports": open_ports,
            "os_guess": os_guess, "device_type": device_type,
        }

    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        enriched = list(pool.map(_enrich, hosts))

    log.info("Scan complete — %d hosts enriched", len(enriched))
    return enriched
