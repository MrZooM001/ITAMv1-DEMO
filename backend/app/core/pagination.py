import math
from fastapi import Query
from pydantic import BaseModel
from typing import TypeVar, Generic, Optional
from dataclasses import dataclass

T = TypeVar("T")


# ── Paginated Response Schema ──────────────────────────────────


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int  # -1 = all
    pages: int

    model_config = {"from_attributes": True}


# ── Pagination Dependency ──────────────────────────────────────


@dataclass
class Pagination:
    """
    FastAPI dependency للـ pagination.

    page_size=-1  → ترجع كل البيانات بدون limit
    page_size=20  → ترجع 20 نتيجة (default)

    Usage:
        GET /departments/              → أول 20 نتيجة
        GET /departments/?page_size=-1 → كل النتائج
        GET /departments/?page=2&page_size=50
    """

    page: int = Query(default=1, ge=1, description="Page number (1-based)")
    page_size: int = Query(
        default=20, ge=-1, description="Items per page. Use -1 for all data."
    )

    @property
    def fetch_all(self) -> bool:
        return self.page_size == -1

    @property
    def offset(self) -> int:
        return 0 if self.fetch_all else (self.page - 1) * self.page_size

    @property
    def limit(self) -> Optional[int]:
        return None if self.fetch_all else self.page_size


def make_response(items, total: int, pagination: Pagination) -> dict:
    if pagination.fetch_all:
        return {
            "items": items,
            "total": total,
            "page": 1,
            "page_size": -1,
            "pages": 1,
        }
    return {
        "items": items,
        "total": total,
        "page": pagination.page,
        "page_size": pagination.page_size,
        "pages": max(1, math.ceil(total / pagination.page_size)),
    }
