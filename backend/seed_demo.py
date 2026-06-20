#
# Populates the ITAM system with realistic demo data for the public demo.
# Safe to re-run: every block checks for existing rows before inserting.
#
# Usage:
#   python seed_demo.py

import sys
import uuid
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, "/app")

from app.database import SessionLocal
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.models.department import Department
from app.models.employee import Employee
from app.models.device import Device, DeviceType, DeviceModel, DeviceStatus
from app.models.software import (
    OperatingSystem,
    DeviceOS,
    Software,
    SoftwareLicense,
    DeviceSoftware,
)
from app.models.inventory import Inventory, SparePart
from app.models.ticket import Ticket, TicketUpdate, TicketPriority, TicketStatus
from app.core.security import hash_password

TENANT_NAME = "ITAM Demo Co."
TENANT_SLUG = "default"

DEMO_ADMIN_EMAIL = "admin@demo.com"
DEMO_ADMIN_NAME = "Demo Admin"
DEMO_ADMIN_PASS = "Demo@1234"

DEMO_TECH_EMAIL = "tech@demo.com"
DEMO_TECH_NAME = "Demo Technician"
DEMO_TECH_PASS = "Demo@1234"

DEMO_VIEWER_EMAIL = "viewer@demo.com"
DEMO_VIEWER_NAME = "Demo Viewer"
DEMO_VIEWER_PASS = "Demo@1234"

today = date.today()
now = datetime.now(timezone.utc)


def get_or_create(db, model, defaults=None, **kwargs):
    """Fetch a row matching kwargs, or create it with defaults merged in."""
    instance = db.query(model).filter_by(**kwargs).first()
    if instance:
        return instance, False
    params = {**kwargs, **(defaults or {})}
    instance = model(**params)
    db.add(instance)
    db.flush()
    return instance, True


def seed():
    db = SessionLocal()
    try:
        # ----- Tenant -----
        tenant, created = get_or_create(
            db, Tenant, slug=TENANT_SLUG,
            defaults=dict(id=uuid.uuid4(), name=TENANT_NAME, is_active=True),
        )
        print(f"  {'✅ Tenant created' if created else '⏭  Tenant exists'}: {tenant.name}")

        # ----- Demo Users (3 roles, so the demo shows permission tiers) ─
        users = {}
        for email, name, password, role in [
            (DEMO_ADMIN_EMAIL, DEMO_ADMIN_NAME, DEMO_ADMIN_PASS, UserRole.admin),
            (DEMO_TECH_EMAIL, DEMO_TECH_NAME, DEMO_TECH_PASS, UserRole.technician),
            (DEMO_VIEWER_EMAIL, DEMO_VIEWER_NAME, DEMO_VIEWER_PASS, UserRole.viewer),
        ]:
            user, created = get_or_create(
                db, User, email=email,
                defaults=dict(
                    id=uuid.uuid4(),
                    tenant_id=tenant.id,
                    full_name=name,
                    password_hash=hash_password(password),
                    role=role,
                    is_active=True,
                ),
            )
            users[email] = user
            print(f"  {'✅ User created' if created else '⏭  User exists'}: {email} / {password} ({role.value})")

        admin_user = users[DEMO_ADMIN_EMAIL]
        tech_user = users[DEMO_TECH_EMAIL]

        # ----- Departments -----
        dept_names = ["IT", "Finance", "Human Resources", "Sales", "Operations"]
        departments = {}
        for name in dept_names:
            dept, created = get_or_create(
                db, Department, tenant_id=tenant.id, name=name,
                defaults=dict(id=uuid.uuid4()),
            )
            departments[name] = dept
        print(f"  ✅ Departments ready: {len(departments)}")

        # ----- Employees -----
        employee_data = [
            ("Sarah Johnson", "sarah.johnson@demo.com", "IT Manager", "IT"),
            ("Michael Chen", "michael.chen@demo.com", "Systems Administrator", "IT"),
            ("Emily Davis", "emily.davis@demo.com", "Financial Analyst", "Finance"),
            ("James Wilson", "james.wilson@demo.com", "Accountant", "Finance"),
            ("Olivia Martinez", "olivia.martinez@demo.com", "HR Specialist", "Human Resources"),
            ("David Brown", "david.brown@demo.com", "Recruiter", "Human Resources"),
            ("Sophia Taylor", "sophia.taylor@demo.com", "Sales Executive", "Sales"),
            ("Daniel Anderson", "daniel.anderson@demo.com", "Sales Manager", "Sales"),
            ("Ava Thomas", "ava.thomas@demo.com", "Operations Coordinator", "Operations"),
            ("Liam Garcia", "liam.garcia@demo.com", "Warehouse Supervisor", "Operations"),
        ]
        employees = {}
        for full_name, email, job_title, dept_name in employee_data:
            emp, created = get_or_create(
                db, Employee, tenant_id=tenant.id, email=email,
                defaults=dict(
                    id=uuid.uuid4(),
                    full_name=full_name,
                    phone=f"+1-555-{uuid.uuid4().int % 9000 + 1000}",
                    job_title=job_title,
                    department_id=departments[dept_name].id,
                    is_active=True,
                ),
            )
            employees[full_name] = emp
        print(f"  ✅ Employees ready: {len(employees)}")

        # ----- Device Types & Models -----
        type_names = ["Laptop", "Desktop PC", "Server", "Printer", "Monitor"]
        device_types = {}
        for name in type_names:
            dt, _ = get_or_create(
                db, DeviceType, tenant_id=tenant.id, name=name,
                defaults=dict(id=uuid.uuid4()),
            )
            device_types[name] = dt

        model_data = [
            ("Laptop", "Dell", "Latitude 5440"),
            ("Laptop", "Lenovo", "ThinkPad T14"),
            ("Laptop", "Apple", "MacBook Pro 14\""),
            ("Desktop PC", "Dell", "OptiPlex 7010"),
            ("Desktop PC", "HP", "EliteDesk 800"),
            ("Server", "Dell", "PowerEdge R740"),
            ("Printer", "HP", "LaserJet Pro M404"),
            ("Monitor", "Dell", "UltraSharp U2722DE"),
        ]
        device_models = {}
        for type_name, manufacturer, model_name in model_data:
            dm, _ = get_or_create(
                db, DeviceModel,
                tenant_id=tenant.id,
                device_type_id=device_types[type_name].id,
                model_name=model_name,
                defaults=dict(id=uuid.uuid4(), manufacturer=manufacturer),
            )
            device_models[model_name] = dm
        print(f"  ✅ Device types/models ready: {len(device_types)}/{len(device_models)}")

        # ----- Operating Systems -----
        os_data = [
            ("Windows 11 Pro", "23H2", "x64"),
            ("Windows Server", "2022", "x64"),
            ("macOS", "Sonoma 14.5", "arm64"),
            ("Ubuntu Server", "22.04 LTS", "x64"),
        ]
        operating_systems = {}
        for name, version, arch in os_data:
            os_obj, _ = get_or_create(
                db, OperatingSystem, tenant_id=tenant.id, name=name, version=version,
                defaults=dict(id=uuid.uuid4(), architecture=arch),
            )
            operating_systems[name] = os_obj
        print(f"  ✅ Operating systems ready: {len(operating_systems)}")

        # ----- Software catalog + licenses -----
        software_data = [
            ("Microsoft 365", "Microsoft", "Productivity", True),
            ("Adobe Acrobat Pro", "Adobe", "Productivity", True),
            ("Slack", "Salesforce", "Communication", True),
            ("AutoCAD", "Autodesk", "Engineering", False),
            ("QuickBooks", "Intuit", "Finance", False),
            ("Salesforce CRM", "Salesforce", "Sales", False),
            ("Zoom", "Zoom Video", "Communication", True),
            ("Antivirus Enterprise", "CrowdStrike", "Security", True),
        ]
        software_catalog = {}
        for name, vendor, category, is_common in software_data:
            sw, _ = get_or_create(
                db, Software, tenant_id=tenant.id, name=name,
                defaults=dict(
                    id=uuid.uuid4(), vendor=vendor, category=category, is_common=is_common
                ),
            )
            software_catalog[name] = sw

        license_data = [
            ("Microsoft 365", "Subscription", 50, today + timedelta(days=210), 7500.00),
            ("Adobe Acrobat Pro", "Subscription", 20, today + timedelta(days=45), 2400.00),
            ("AutoCAD", "Perpetual", 5, None, 6000.00),
            ("QuickBooks", "Subscription", 10, today + timedelta(days=300), 1200.00),
            ("Salesforce CRM", "Subscription", 15, today + timedelta(days=15), 9000.00),
            ("Antivirus Enterprise", "Subscription", 100, today + timedelta(days=120), 8000.00),
        ]
        for sw_name, lic_type, seats, expiry, cost in license_data:
            get_or_create(
                db, SoftwareLicense,
                tenant_id=tenant.id,
                software_id=software_catalog[sw_name].id,
                license_type=lic_type,
                defaults=dict(
                    id=uuid.uuid4(),
                    license_key=f"DEMO-{uuid.uuid4().hex[:16].upper()}",
                    seats=seats,
                    expiry_date=expiry,
                    cost=cost,
                ),
            )
        print(f"  ✅ Software catalog/licenses ready: {len(software_catalog)}/{len(license_data)}")

        # ----- Devices (with hardware-less basic records) -----
        device_specs = [
            ("LAP-001", "Laptop", "Latitude 5440", "Sarah Johnson", "IT", DeviceStatus.active, 180, 1200.00),
            ("LAP-002", "Laptop", "ThinkPad T14", "Michael Chen", "IT", DeviceStatus.active, 365, 1100.00),
            ("LAP-003", "Laptop", "MacBook Pro 14\"", "Sophia Taylor", "Sales", DeviceStatus.active, 60, 2400.00),
            ("LAP-004", "Laptop", "Latitude 5440", "Emily Davis", "Finance", DeviceStatus.in_maintenance, 400, 1200.00),
            ("DSK-001", "Desktop PC", "OptiPlex 7010", "James Wilson", "Finance", DeviceStatus.active, 500, 900.00),
            ("DSK-002", "Desktop PC", "EliteDesk 800", "Olivia Martinez", "Human Resources", DeviceStatus.active, 250, 850.00),
            ("DSK-003", "Desktop PC", "OptiPlex 7010", "David Brown", "Human Resources", DeviceStatus.retired, 1200, 900.00),
            ("SRV-001", "Server", "PowerEdge R740", None, "IT", DeviceStatus.active, 700, 8500.00),
            ("PRN-001", "Printer", "LaserJet Pro M404", None, "Operations", DeviceStatus.active, 300, 350.00),
            ("MON-001", "Monitor", "UltraSharp U2722DE", "Daniel Anderson", "Sales", DeviceStatus.active, 90, 450.00),
            ("LAP-005", "Laptop", "ThinkPad T14", "Ava Thomas", "Operations", DeviceStatus.active, 120, 1100.00),
            ("DSK-004", "Desktop PC", "EliteDesk 800", "Liam Garcia", "Operations", DeviceStatus.active, 30, 850.00),
        ]
        devices = {}
        for name, type_name, model_name, emp_name, dept_name, status, purchase_days_ago, price in device_specs:
            purchase_dt = today - timedelta(days=purchase_days_ago)
            warranty_dt = purchase_dt + timedelta(days=365 * 3)
            dev, _ = get_or_create(
                db, Device, tenant_id=tenant.id, name=name,
                defaults=dict(
                    id=uuid.uuid4(),
                    device_type_id=device_types[type_name].id,
                    device_model_id=device_models[model_name].id,
                    department_id=departments[dept_name].id,
                    employee_id=employees[emp_name].id if emp_name else None,
                    serial_number=f"SN-{uuid.uuid4().hex[:10].upper()}",
                    status=status,
                    purchase_date=purchase_dt,
                    warranty_expiry=warranty_dt,
                    purchase_price=price,
                ),
            )
            devices[name] = dev
        print(f"  ✅ Devices ready: {len(devices)}")

        # ----- Attach OS to a few devices -----
        device_os_map = [
            ("LAP-001", "Windows 11 Pro"),
            ("LAP-002", "Windows 11 Pro"),
            ("LAP-003", "macOS"),
            ("DSK-001", "Windows 11 Pro"),
            ("SRV-001", "Ubuntu Server"),
        ]
        for dev_name, os_name in device_os_map:
            get_or_create(
                db, DeviceOS,
                tenant_id=tenant.id,
                device_id=devices[dev_name].id,
                os_id=operating_systems[os_name].id,
                defaults=dict(id=uuid.uuid4(), install_date=today - timedelta(days=200), is_primary=True),
            )

        # ----- Attach software installs to a few devices -----
        device_software_map = [
            ("LAP-001", "Microsoft 365"),
            ("LAP-001", "Zoom"),
            ("LAP-002", "Microsoft 365"),
            ("LAP-002", "Antivirus Enterprise"),
            ("DSK-001", "QuickBooks"),
            ("DSK-001", "Microsoft 365"),
            ("LAP-003", "Adobe Acrobat Pro"),
        ]
        for dev_name, sw_name in device_software_map:
            get_or_create(
                db, DeviceSoftware,
                tenant_id=tenant.id,
                device_id=devices[dev_name].id,
                software_id=software_catalog[sw_name].id,
                defaults=dict(id=uuid.uuid4(), version="latest", installed_at=today - timedelta(days=100)),
            )
        print("  ✅ Device OS/software links ready")

        # ----- Inventory & Spare Parts -----
        inventory_data = [
            ("USB-C Cable", "Accessories", 45, 10, "pcs"),
            ("Wireless Mouse", "Accessories", 22, 5, "pcs"),
            ("HDMI Cable 2m", "Accessories", 8, 10, "pcs"),
            ("Laptop Charger 65W", "Accessories", 15, 5, "pcs"),
            ("Toner Cartridge - HP M404", "Consumables", 6, 3, "pcs"),
        ]
        for name, category, qty, min_qty, unit in inventory_data:
            get_or_create(
                db, Inventory, tenant_id=tenant.id, name=name,
                defaults=dict(id=uuid.uuid4(), category=category, quantity=qty, min_quantity=min_qty, unit=unit),
            )

        spare_parts_data = [
            ("8GB DDR4 RAM Module", "Dell Latitude, Lenovo ThinkPad", 12, 4),
            ("512GB NVMe SSD", "Dell, HP, Lenovo laptops", 7, 3),
            ("Laptop Battery (Latitude 5440)", "Dell Latitude 5440", 3, 2),
            ("Printer Fuser Unit", "HP LaserJet Pro M404", 2, 1),
        ]
        for name, compat, qty, min_qty in spare_parts_data:
            get_or_create(
                db, SparePart, tenant_id=tenant.id, name=name,
                defaults=dict(id=uuid.uuid4(), compatible_with=compat, quantity=qty, min_quantity=min_qty),
            )
        print(f"  ✅ Inventory/spare parts ready: {len(inventory_data)}/{len(spare_parts_data)}")

        # ----- Tickets (with one update each, for realism) -----
        ticket_data = [
            ("TKT-DEMO-0001", "Laptop won't boot after Windows update", "LAP-004", "Emily Davis",
             TicketPriority.high, TicketStatus.in_progress, 5,
             "Replaced boot sector, currently re-imaging the device."),
            ("TKT-DEMO-0002", "Printer jamming repeatedly", "PRN-001", "Ava Thomas",
             TicketPriority.medium, TicketStatus.open, 1,
             "Ticket logged, awaiting technician assignment."),
            ("TKT-DEMO-0003", "Request for second monitor", None, "Daniel Anderson",
             TicketPriority.low, TicketStatus.resolved, 14,
             "Monitor MON-001 issued and configured."),
            ("TKT-DEMO-0004", "Server disk usage critical (95%)", "SRV-001", "Sarah Johnson",
             TicketPriority.critical, TicketStatus.closed, 20,
             "Archived old logs and expanded storage volume. Disk usage back to 60%."),
            ("TKT-DEMO-0005", "Slow performance on accounting desktop", "DSK-001", "James Wilson",
             TicketPriority.medium, TicketStatus.open, 2,
             "Initial triage scheduled."),
        ]
        for ticket_number, title, dev_name, emp_name, priority, status, days_ago, note in ticket_data:
            created_dt = now - timedelta(days=days_ago)
            resolved_dt = now - timedelta(days=max(days_ago - 2, 0)) if status in (
                TicketStatus.resolved, TicketStatus.closed
            ) else None
            ticket, created = get_or_create(
                db, Ticket, tenant_id=tenant.id, ticket_number=ticket_number,
                defaults=dict(
                    id=uuid.uuid4(),
                    device_id=devices[dev_name].id if dev_name else None,
                    reported_by=employees[emp_name].id,
                    assigned_to=tech_user.id,
                    title=title,
                    description=f"{title}. Reported via demo seed data.",
                    priority=priority,
                    status=status,
                    resolved_at=resolved_dt,
                    created_at=created_dt,
                ),
            )
            if created:
                db.add(TicketUpdate(
                    id=uuid.uuid4(),
                    ticket_id=ticket.id,
                    updated_by=tech_user.id,
                    note=note,
                    old_status=TicketStatus.open.value,
                    new_status=status.value,
                ))
        print(f"  ✅ Tickets ready: {len(ticket_data)}")

        db.commit()
        print("\n✅ Demo data seeding complete.")

    except Exception as e:
        db.rollback()
        print(f"  ❌ Demo seed error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
