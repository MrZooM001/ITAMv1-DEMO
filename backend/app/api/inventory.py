from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional

from app.database import get_db
from app.core.dependencies import get_current_user, require_technician
from app.core.pagination import Pagination, PaginatedResponse, make_response
from app.models.user import User
from app.schemas.inventory import (
    InventoryCreate,
    InventoryUpdate,
    InventoryQuantityUpdate,
    InventoryResponse,
    SparePartCreate,
    SparePartUpdate,
    SparePartQuantityUpdate,
    SparePartResponse,
)
from app.services import inventory as inventory_service

router = APIRouter(tags=["Inventory"])


# ── Inventory ──────────────────────────────────────────────────
@router.post("/inventory/", response_model=InventoryResponse)
def create_inventory(
    request: InventoryCreate,
    current_user: User = Depends(require_technician),
    db: Session = Depends(get_db),
):
    return inventory_service.create_inventory(request, current_user.tenant_id, db)


@router.get("/inventory/", response_model=PaginatedResponse[InventoryResponse])
def get_inventory(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    low_stock: bool = Query(
        False, description="Show only items at or below min quantity"
    ),
    pagination: Pagination = Depends(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items, total = inventory_service.get_inventory(
        current_user.tenant_id,
        db,
        limit=pagination.limit,
        offset=pagination.offset,
        category=category,
        search=search,
        low_stock=low_stock,
    )
    return make_response(items, total, pagination)


@router.get("/inventory/low-stock", response_model=list[InventoryResponse])
def get_low_stock_inventory(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return inventory_service.get_low_stock_inventory(current_user.tenant_id, db)


@router.get("/inventory/{item_id}", response_model=InventoryResponse)
def get_inventory_item(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return inventory_service.get_inventory_item(item_id, current_user.tenant_id, db)


@router.put("/inventory/{item_id}", response_model=InventoryResponse)
def update_inventory(
    item_id: UUID,
    request: InventoryUpdate,
    current_user: User = Depends(require_technician),
    db: Session = Depends(get_db),
):
    return inventory_service.update_inventory(
        item_id, request, current_user.tenant_id, db
    )


@router.put("/inventory/{item_id}/quantity", response_model=InventoryResponse)
def update_inventory_quantity(
    item_id: UUID,
    request: InventoryQuantityUpdate,
    current_user: User = Depends(require_technician),
    db: Session = Depends(get_db),
):
    return inventory_service.update_inventory_quantity(
        item_id, request, current_user.tenant_id, db
    )


@router.delete("/inventory/{item_id}")
def delete_inventory(
    item_id: UUID,
    current_user: User = Depends(require_technician),
    db: Session = Depends(get_db),
):
    inventory_service.delete_inventory(item_id, current_user.tenant_id, db)
    return {"message": "Item deleted successfully"}


# ── Spare Parts ────────────────────────────────────────────────
@router.post("/spare-parts/", response_model=SparePartResponse)
def create_spare_part(
    request: SparePartCreate,
    current_user: User = Depends(require_technician),
    db: Session = Depends(get_db),
):
    return inventory_service.create_spare_part(request, current_user.tenant_id, db)


@router.get("/spare-parts/", response_model=PaginatedResponse[SparePartResponse])
def get_spare_parts(
    search: Optional[str] = Query(None),
    low_stock: bool = Query(
        False, description="Show only items at or below min quantity"
    ),
    pagination: Pagination = Depends(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items, total = inventory_service.get_spare_parts(
        current_user.tenant_id,
        db,
        limit=pagination.limit,
        offset=pagination.offset,
        search=search,
        low_stock=low_stock,
    )
    return make_response(items, total, pagination)


@router.get("/spare-parts/low-stock", response_model=list[SparePartResponse])
def get_low_stock_spare_parts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return inventory_service.get_low_stock_spare_parts(current_user.tenant_id, db)


@router.get("/spare-parts/{part_id}", response_model=SparePartResponse)
def get_spare_part(
    part_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return inventory_service.get_spare_part(part_id, current_user.tenant_id, db)


@router.put("/spare-parts/{part_id}", response_model=SparePartResponse)
def update_spare_part(
    part_id: UUID,
    request: SparePartUpdate,
    current_user: User = Depends(require_technician),
    db: Session = Depends(get_db),
):
    return inventory_service.update_spare_part(
        part_id, request, current_user.tenant_id, db
    )


@router.put("/spare-parts/{part_id}/quantity", response_model=SparePartResponse)
def update_spare_part_quantity(
    part_id: UUID,
    request: SparePartQuantityUpdate,
    current_user: User = Depends(require_technician),
    db: Session = Depends(get_db),
):
    return inventory_service.update_spare_part_quantity(
        part_id, request, current_user.tenant_id, db
    )


@router.delete("/spare-parts/{part_id}")
def delete_spare_part(
    part_id: UUID,
    current_user: User = Depends(require_technician),
    db: Session = Depends(get_db),
):
    inventory_service.delete_spare_part(part_id, current_user.tenant_id, db)
    return {"message": "Spare part deleted successfully"}
