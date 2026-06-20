from fastapi import APIRouter
from app.api import (
    auth,
    users,
    tenants,
    departments,
    employees,
    devices,
    device_hardware,
    reports,
    backup,
    tickets,
    inventory,
    software,
    network_scan,
)
from app.api import bulk_import

router = APIRouter()

router.include_router(auth.router)
router.include_router(tenants.router)
router.include_router(users.router)
router.include_router(departments.router)
router.include_router(employees.router)
router.include_router(devices.router)
router.include_router(device_hardware.router)
router.include_router(bulk_import.router)
router.include_router(tickets.router)
router.include_router(inventory.router)
router.include_router(software.router)
router.include_router(reports.router)
router.include_router(backup.router)
router.include_router(network_scan.router)
