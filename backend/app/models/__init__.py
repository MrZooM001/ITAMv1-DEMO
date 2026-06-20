from app.models.tenant import Tenant
from app.models.user import User, RefreshToken
from app.models.department import Department
from app.models.employee import Employee
from app.models.device import Device, DeviceType, DeviceModel
from app.models.device_hardware import DeviceHardware
from app.models.software import OperatingSystem, DeviceOS, Software, SoftwareLicense, DeviceSoftware
from app.models.inventory import Inventory, SparePart
from app.models.ticket import Ticket, TicketUpdate, SparePartUsage
from app.models.network_scan import NetworkScan, DiscoveredHost
