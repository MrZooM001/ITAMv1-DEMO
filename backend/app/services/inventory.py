from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from uuid import UUID

from app.models.inventory import Inventory, SparePart
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


# ----- Helper -----
def _to_inventory_response(item: Inventory) -> InventoryResponse:
    return InventoryResponse(
        id=item.id,
        tenant_id=item.tenant_id,
        name=item.name,
        category=item.category,
        quantity=item.quantity,
        min_quantity=item.min_quantity,
        unit=item.unit,
        notes=item.notes,
        created_at=item.created_at,
        is_low_stock=item.quantity <= item.min_quantity,
    )


def _to_spare_part_response(item: SparePart) -> SparePartResponse:
    return SparePartResponse(
        id=item.id,
        tenant_id=item.tenant_id,
        name=item.name,
        compatible_with=item.compatible_with,
        quantity=item.quantity,
        min_quantity=item.min_quantity,
        notes=item.notes,
        created_at=item.created_at,
        is_low_stock=item.quantity <= item.min_quantity,
    )


# ----- Inventory -----
def create_inventory(
    request: InventoryCreate, tenant_id: UUID, db: Session
) -> InventoryResponse:
    item = Inventory(
        tenant_id=tenant_id,
        name=request.name,
        category=request.category,
        quantity=request.quantity,
        min_quantity=request.min_quantity,
        unit=request.unit,
        notes=request.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _to_inventory_response(item)


def get_inventory(
    tenant_id: UUID,
    db: Session,
    limit: int = 20,
    offset: int = 0,
    category: str | None = None,
    search: str | None = None,
    low_stock: bool = False,
) -> tuple[list[InventoryResponse], int]:
    query = db.query(Inventory).filter(Inventory.tenant_id == tenant_id)
    if category:
        query = query.filter(Inventory.category == category)
    if search:
        query = query.filter(Inventory.name.ilike(f"%{search}%"))
    if low_stock:
        query = query.filter(Inventory.quantity <= Inventory.min_quantity)
    query = query.order_by(Inventory.name)
    total = query.count()
    items = (
        query.offset(offset).all()
        if limit is None
        else query.offset(offset).limit(limit).all()
    )
    return [_to_inventory_response(i) for i in items], total


def get_inventory_item(
    item_id: UUID, tenant_id: UUID, db: Session
) -> InventoryResponse:
    item = (
        db.query(Inventory)
        .filter(Inventory.id == item_id, Inventory.tenant_id == tenant_id)
        .first()
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
        )
    return _to_inventory_response(item)


def update_inventory(
    item_id: UUID, request: InventoryUpdate, tenant_id: UUID, db: Session
) -> InventoryResponse:
    item = (
        db.query(Inventory)
        .filter(Inventory.id == item_id, Inventory.tenant_id == tenant_id)
        .first()
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
        )
    for key, value in request.model_dump(exclude_none=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return _to_inventory_response(item)


def update_inventory_quantity(
    item_id: UUID, request: InventoryQuantityUpdate, tenant_id: UUID, db: Session
) -> InventoryResponse:
    item = (
        db.query(Inventory)
        .filter(Inventory.id == item_id, Inventory.tenant_id == tenant_id)
        .first()
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
        )
    item.quantity = request.quantity
    db.commit()
    db.refresh(item)
    return _to_inventory_response(item)


def delete_inventory(item_id: UUID, tenant_id: UUID, db: Session) -> None:
    item = (
        db.query(Inventory)
        .filter(Inventory.id == item_id, Inventory.tenant_id == tenant_id)
        .first()
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
        )
    db.delete(item)
    db.commit()


def get_low_stock_inventory(tenant_id: UUID, db: Session) -> list[InventoryResponse]:
    items = (
        db.query(Inventory)
        .filter(
            Inventory.tenant_id == tenant_id,
            Inventory.quantity <= Inventory.min_quantity,
        )
        .all()
    )
    return [_to_inventory_response(i) for i in items]


# ----- Spare Parts -----
def create_spare_part(
    request: SparePartCreate, tenant_id: UUID, db: Session
) -> SparePartResponse:
    part = SparePart(
        tenant_id=tenant_id,
        name=request.name,
        compatible_with=request.compatible_with,
        quantity=request.quantity,
        min_quantity=request.min_quantity,
        notes=request.notes,
    )
    db.add(part)
    db.commit()
    db.refresh(part)
    return _to_spare_part_response(part)


def get_spare_parts(
    tenant_id: UUID,
    db: Session,
    limit: int = 20,
    offset: int = 0,
    search: str | None = None,
    low_stock: bool = False,
) -> tuple[list[SparePartResponse], int]:
    query = db.query(SparePart).filter(SparePart.tenant_id == tenant_id)
    if search:
        query = query.filter(SparePart.name.ilike(f"%{search}%"))
    if low_stock:
        query = query.filter(SparePart.quantity <= SparePart.min_quantity)
    query = query.order_by(SparePart.name)
    total = query.count()
    items = (
        query.offset(offset).all()
        if limit is None
        else query.offset(offset).limit(limit).all()
    )
    return [_to_spare_part_response(p) for p in items], total


def get_spare_part(part_id: UUID, tenant_id: UUID, db: Session) -> SparePartResponse:
    part = (
        db.query(SparePart)
        .filter(SparePart.id == part_id, SparePart.tenant_id == tenant_id)
        .first()
    )
    if not part:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Spare part not found"
        )
    return _to_spare_part_response(part)


def update_spare_part(
    part_id: UUID, request: SparePartUpdate, tenant_id: UUID, db: Session
) -> SparePartResponse:
    part = (
        db.query(SparePart)
        .filter(SparePart.id == part_id, SparePart.tenant_id == tenant_id)
        .first()
    )
    if not part:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Spare part not found"
        )
    for key, value in request.model_dump(exclude_none=True).items():
        setattr(part, key, value)
    db.commit()
    db.refresh(part)
    return _to_spare_part_response(part)


def update_spare_part_quantity(
    part_id: UUID, request: SparePartQuantityUpdate, tenant_id: UUID, db: Session
) -> SparePartResponse:
    part = (
        db.query(SparePart)
        .filter(SparePart.id == part_id, SparePart.tenant_id == tenant_id)
        .first()
    )
    if not part:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Spare part not found"
        )
    part.quantity = request.quantity
    db.commit()
    db.refresh(part)
    return _to_spare_part_response(part)


def delete_spare_part(part_id: UUID, tenant_id: UUID, db: Session) -> None:
    part = (
        db.query(SparePart)
        .filter(SparePart.id == part_id, SparePart.tenant_id == tenant_id)
        .first()
    )
    if not part:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Spare part not found"
        )
    db.delete(part)
    db.commit()


def get_low_stock_spare_parts(tenant_id: UUID, db: Session) -> list[SparePartResponse]:
    parts = (
        db.query(SparePart)
        .filter(
            SparePart.tenant_id == tenant_id,
            SparePart.quantity <= SparePart.min_quantity,
        )
        .all()
    )
    return [_to_spare_part_response(p) for p in parts]
