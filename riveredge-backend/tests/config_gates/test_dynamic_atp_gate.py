import sys
import types
from decimal import Decimal

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from apps.kuaizhizao.services.report_service import ReportService


class _SimpleQuery:
    def __init__(self, rows):
        self.rows = rows
        self._excluded_statuses = set()
        self._material_ids = None
        self._material_id = None

    def filter(self, *args, **kwargs):
        if "material_id__in" in kwargs:
            self._material_ids = set(kwargs["material_id__in"] or [])
        if "material_id" in kwargs and kwargs["material_id"] is not None:
            self._material_id = int(kwargs["material_id"])
        return self

    def exclude(self, **kwargs):
        statuses = kwargs.get("status__in")
        if statuses:
            self._excluded_statuses = set(statuses)
        return self

    def prefetch_related(self, *_args, **_kwargs):
        return self

    async def all(self):
        rows = list(self.rows)
        if self._material_ids is not None:
            rows = [r for r in rows if int(getattr(r, "material_id", 0)) in self._material_ids]
        if self._material_id is not None:
            rows = [r for r in rows if int(getattr(r, "material_id", 0)) == self._material_id]
        return rows

    async def values_list(self, *fields, **_kwargs):
        if fields == ("id",):
            rows = [r for r in self.rows if getattr(r, "status", None) not in self._excluded_statuses]
            return [getattr(r, "id") for r in rows]
        if fields == ("material_id", "remaining_quantity"):
            rows = list(self.rows)
            if self._material_ids is not None:
                rows = [r for r in rows if int(getattr(r, "material_id", 0)) in self._material_ids]
            if self._material_id is not None:
                rows = [r for r in rows if int(getattr(r, "material_id", 0)) == self._material_id]
            return [(getattr(r, "material_id"), getattr(r, "remaining_quantity")) for r in rows]
        return []


@pytest.mark.unit
@pytest.mark.asyncio
async def test_batch_inventory_should_deduct_sales_commitment_for_atp(monkeypatch):
    service = ReportService()

    batch_rows = [
        types.SimpleNamespace(material_id=1, quantity=Decimal("10")),
        types.SimpleNamespace(material_id=2, quantity=Decimal("5")),
    ]
    line_rows = [
        types.SimpleNamespace(material_id=1, quantity=Decimal("4"), reserved_quantity=Decimal("1")),
    ]
    order_rows = [
        types.SimpleNamespace(id=101, status="已审核"),
        types.SimpleNamespace(id=102, status="草稿"),
    ]
    item_rows = [
        types.SimpleNamespace(material_id=1, remaining_quantity=Decimal("8")),
    ]

    from apps.master_data.models.material_batch import MaterialBatch
    from apps.kuaizhizao.models.line_side_inventory import LineSideInventory
    from apps.kuaizhizao.models.sales_order import SalesOrder
    from apps.kuaizhizao.models.sales_order_item import SalesOrderItem

    monkeypatch.setattr(MaterialBatch, "filter", staticmethod(lambda **_kwargs: _SimpleQuery(batch_rows)))
    monkeypatch.setattr(LineSideInventory, "filter", staticmethod(lambda **_kwargs: _SimpleQuery(line_rows)))
    monkeypatch.setattr(SalesOrder, "filter", staticmethod(lambda **_kwargs: _SimpleQuery(order_rows)))
    monkeypatch.setattr(SalesOrderItem, "filter", staticmethod(lambda **_kwargs: _SimpleQuery(item_rows)))

    result = await service.query_batch_inventory(
        tenant_id=1,
        material_ids=[1, 2],
        summary_only=True,
        include_sales_commitment=True,
    )

    # material1: 10 + (4-1) - 8 = 5
    assert float(result["material_totals"]["1"]) == 5.0
    assert float(result["material_totals"]["2"]) == 5.0

