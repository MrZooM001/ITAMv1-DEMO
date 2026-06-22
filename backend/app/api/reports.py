from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional
import io
import csv

from app.database import get_db
from app.core.dependencies import get_current_user
from app.core.pdf_builder import build_pdf
from app.models.user import User
from app.schemas.report import (
    AssetInventoryReport,
    WarrantyReport,
    SLAReport,
    LicenseUtilizationReport,
)
from app.services import report as report_service

router = APIRouter(prefix="/reports", tags=["Reports"])


# ── Assets Inventory ───────────────────────────────────────────


@router.get("/assets-inventory", response_model=AssetInventoryReport)
def assets_inventory(
    department_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    format: Optional[str] = Query(None, description="csv | pdf"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = report_service.get_assets_inventory(
        current_user.tenant_id, db, department_id, status
    )
    if format == "csv":
        return _assets_csv(report)
    if format == "pdf":
        return _assets_pdf(report)
    return report


# ── Warranty Status ────────────────────────────────────────────


@router.get("/warranty-status", response_model=WarrantyReport)
def warranty_status(
    department_id: Optional[UUID] = Query(None),
    format: Optional[str] = Query(None, description="csv | pdf"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = report_service.get_warranty_report(
        current_user.tenant_id, db, department_id
    )
    if format == "csv":
        return _warranty_csv(report)
    if format == "pdf":
        return _warranty_pdf(report)
    return report


# ── SLA Report ─────────────────────────────────────────────────


@router.get("/sla", response_model=SLAReport)
def sla_report(
    format: Optional[str] = Query(None, description="csv | pdf"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = report_service.get_sla_report(current_user.tenant_id, db)
    if format == "csv":
        return _sla_csv(report)
    if format == "pdf":
        return _sla_pdf(report)
    return report


# ── License Utilization ────────────────────────────────────────


@router.get("/license-utilization", response_model=LicenseUtilizationReport)
def license_utilization(
    format: Optional[str] = Query(None, description="csv | pdf"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = report_service.get_license_utilization(current_user.tenant_id, db)
    if format == "csv":
        return _license_csv(report)
    if format == "pdf":
        return _license_pdf(report)
    return report


# ── PDF Helpers ────────────────────────────────────────────────


def _pdf_response(pdf_bytes: bytes, filename: str) -> StreamingResponse:
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"},
    )


def _assets_pdf(report: AssetInventoryReport) -> StreamingResponse:
    headers = [
        "Device",
        "Type",
        "Serial",
        "Status",
        "Department",
        "Employee",
        "Warranty",
        "OS",
    ]
    rows = [
        [
            i.device_name,
            i.device_type or "",
            i.serial_number or "",
            i.status.value,
            i.department_name or "",
            i.employee_name or "",
            str(i.warranty_expiry or ""),
            i.os_name or "",
        ]
        for i in report.items
    ]
    pdf = build_pdf(
        title="Assets Inventory Report",
        subtitle=f"Generated: {report.generated_at.strftime('%Y-%m-%d %H:%M')} UTC",
        headers=headers,
        rows=rows,
        summary={
            "Total": report.total_devices,
            "Active": report.active_devices,
            "In Maintenance": report.in_maintenance,
            "Retired": report.retired_devices,
        },
        orientation="landscape",
    )
    return _pdf_response(pdf, "assets_inventory.pdf")


def _warranty_pdf(report: WarrantyReport) -> StreamingResponse:
    headers = [
        "Device",
        "Serial",
        "Department",
        "Employee",
        "Expiry",
        "Days Left",
        "Status",
    ]
    rows = [
        [
            i.device_name,
            i.serial_number or "",
            i.department_name or "",
            i.employee_name or "",
            str(i.warranty_expiry or ""),
            str(i.days_remaining) if i.days_remaining is not None else "",
            i.status,
        ]
        for i in report.items
    ]
    pdf = build_pdf(
        title="Warranty Status Report",
        subtitle=f"Generated: {report.generated_at.strftime('%Y-%m-%d %H:%M')} UTC",
        headers=headers,
        rows=rows,
        summary={
            "Total": report.total_devices,
            "Valid": report.valid,
            "Expiring Soon": report.expiring_soon,
            "Expired": report.expired,
        },
    )
    return _pdf_response(pdf, "warranty_status.pdf")


def _sla_pdf(report: SLAReport) -> StreamingResponse:
    headers = ["Priority", "Total", "Resolved", "Avg Hours", "Min Hours", "Max Hours"]
    rows = [
        [
            p.priority,
            p.total_tickets,
            p.resolved_tickets,
            p.avg_resolution_hours or "—",
            p.min_resolution_hours or "—",
            p.max_resolution_hours or "—",
        ]
        for p in report.by_priority
    ]
    pdf = build_pdf(
        title="SLA Report",
        subtitle=f"Generated: {report.generated_at.strftime('%Y-%m-%d %H:%M')} UTC",
        headers=headers,
        rows=rows,
        summary={
            "Total Tickets": report.total_tickets,
            "Resolved": report.resolved_tickets,
            "Open": report.open_tickets,
            "Avg Resolution (hrs)": report.avg_resolution_hours or "N/A",
        },
    )
    return _pdf_response(pdf, "sla_report.pdf")


def _license_pdf(report: LicenseUtilizationReport) -> StreamingResponse:
    headers = [
        "Software",
        "Vendor",
        "Type",
        "Total Seats",
        "Used",
        "Available",
        "Utilization %",
        "Expiry",
        "Status",
    ]
    rows = [
        [
            i.software_name,
            i.vendor or "",
            i.license_type or "",
            i.total_seats or "—",
            i.used_seats,
            i.available_seats if i.available_seats is not None else "—",
            f"{i.utilization_pct}%" if i.utilization_pct is not None else "—",
            str(i.expiry_date or ""),
            i.status,
        ]
        for i in report.items
    ]
    pdf = build_pdf(
        title="License Utilization Report",
        subtitle=f"Generated: {report.generated_at.strftime('%Y-%m-%d %H:%M')} UTC",
        headers=headers,
        rows=rows,
        summary={
            "Total Software": report.total_software,
            "Licensed": report.licensed_software,
            "Over-utilized": report.over_utilized,
            "Expiring Soon": report.expiring_soon,
        },
        orientation="landscape",
    )
    return _pdf_response(pdf, "license_utilization.pdf")


# ── CSV Helpers ────────────────────────────────────────────────


def _csv_response(rows: list, headers: list, filename: str) -> StreamingResponse:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerows(rows)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def _assets_csv(report: AssetInventoryReport) -> StreamingResponse:
    return _csv_response(
        headers=[
            "Device",
            "Type",
            "Model",
            "Serial",
            "Status",
            "Department",
            "Employee",
            "Purchase Date",
            "Price",
            "Warranty",
            "OS",
        ],
        rows=[
            [
                i.device_name,
                i.device_type or "",
                i.device_model or "",
                i.serial_number or "",
                i.status.value,
                i.department_name or "",
                i.employee_name or "",
                i.purchase_date or "",
                i.purchase_price or "",
                i.warranty_expiry or "",
                i.os_name or "",
            ]
            for i in report.items
        ],
        filename="assets_inventory.csv",
    )


def _warranty_csv(report: WarrantyReport) -> StreamingResponse:
    return _csv_response(
        headers=[
            "Device",
            "Serial",
            "Department",
            "Employee",
            "Warranty Expiry",
            "Days Remaining",
            "Status",
        ],
        rows=[
            [
                i.device_name,
                i.serial_number or "",
                i.department_name or "",
                i.employee_name or "",
                i.warranty_expiry or "",
                i.days_remaining if i.days_remaining is not None else "",
                i.status,
            ]
            for i in report.items
        ],
        filename="warranty_status.csv",
    )


def _sla_csv(report: SLAReport) -> StreamingResponse:
    return _csv_response(
        headers=[
            "Priority",
            "Total Tickets",
            "Resolved",
            "Avg Hours",
            "Min Hours",
            "Max Hours",
        ],
        rows=[
            [
                p.priority,
                p.total_tickets,
                p.resolved_tickets,
                p.avg_resolution_hours or "",
                p.min_resolution_hours or "",
                p.max_resolution_hours or "",
            ]
            for p in report.by_priority
        ],
        filename="sla_report.csv",
    )


def _license_csv(report: LicenseUtilizationReport) -> StreamingResponse:
    return _csv_response(
        headers=[
            "Software",
            "Vendor",
            "Type",
            "Total Seats",
            "Used",
            "Available",
            "Utilization %",
            "Expiry",
            "Status",
        ],
        rows=[
            [
                i.software_name,
                i.vendor or "",
                i.license_type or "",
                i.total_seats or "",
                i.used_seats,
                i.available_seats if i.available_seats is not None else "",
                f"{i.utilization_pct}%" if i.utilization_pct is not None else "",
                i.expiry_date or "",
                i.status,
            ]
            for i in report.items
        ],
        filename="license_utilization.csv",
    )
