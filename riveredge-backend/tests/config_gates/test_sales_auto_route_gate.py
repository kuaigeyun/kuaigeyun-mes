import sys
import types
from decimal import Decimal

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from apps.kuaizhizao.services import sales_order_service
from apps.kuaizhizao.services.sales_order_service import SalesOrderService


class _AwaitableItems:
    def __init__(self, items):
        self._items = items

    def order_by(self, *_args, **_kwargs):
        return self

    def __await__(self):
        async def _coro():
            return self._items

        return _coro().__await__()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_sales_auto_route_should_follow_order_type_mto(monkeypatch):
    service = SalesOrderService()
    captured = {}

    order = types.SimpleNamespace(id=1, order_code="SO-001", status="已审核", order_type="MTO")
    items = [
        types.SimpleNamespace(id=11, material_id=101, order_quantity=Decimal("5"), remaining_quantity=Decimal("5")),
        types.SimpleNamespace(id=12, material_id=102, order_quantity=Decimal("3"), remaining_quantity=Decimal("3")),
    ]

    async def _get_order(**_kwargs):
        return order

    async def _fake_push_mto(self, tenant_id, sales_order_id, created_by, selected_item_ids=None):
        captured["mto_ids"] = list(selected_item_ids or [])
        return {"success": True}

    async def _fake_push_mts(self, tenant_id, sales_order_id, created_by, selected_item_ids=None):
        captured["mts_ids"] = list(selected_item_ids or [])
        return {"success": True}

    monkeypatch.setattr(sales_order_service.SalesOrder, "get_or_none", _get_order)
    monkeypatch.setattr(sales_order_service.SalesOrderItem, "filter", lambda **_kwargs: _AwaitableItems(items))
    monkeypatch.setattr(SalesOrderService, "push_sales_order_to_work_order", _fake_push_mto)
    monkeypatch.setattr(SalesOrderService, "push_sales_order_to_shipment_notice", _fake_push_mts)

    result = await service.push_sales_order_auto_route(tenant_id=1, sales_order_id=1, created_by=7)

    assert result["route_summary"]["order_type"] == "MTO"
    assert captured["mto_ids"] == [11, 12]
    assert "mts_ids" not in captured


@pytest.mark.unit
@pytest.mark.asyncio
async def test_sales_auto_route_should_split_auto_by_source_and_inventory(monkeypatch):
    service = SalesOrderService()
    captured = {}

    order = types.SimpleNamespace(id=2, order_code="SO-002", status="已审核", order_type="AUTO")
    items = [
        # 物料1: Make => MTO
        types.SimpleNamespace(id=21, material_id=1, order_quantity=Decimal("10"), remaining_quantity=Decimal("10")),
        # 物料2: Buy + 可用库存足够 => MTS
        types.SimpleNamespace(id=22, material_id=2, order_quantity=Decimal("4"), remaining_quantity=Decimal("4")),
        # 物料3: Buy + 可用库存不足 => MTO
        types.SimpleNamespace(id=23, material_id=3, order_quantity=Decimal("8"), remaining_quantity=Decimal("8")),
    ]

    async def _get_order(**_kwargs):
        return order

    async def _fake_source_type(_tenant_id, material_id):
        return {1: "Make", 2: "Buy", 3: "Buy"}.get(material_id, "Buy")

    async def _fake_available_qty(**kwargs):
        material_id = int(kwargs.get("material_id") or 0)
        return {2: Decimal("10"), 3: Decimal("2")}.get(material_id, Decimal("0"))

    async def _fake_push_mto(self, tenant_id, sales_order_id, created_by, selected_item_ids=None):
        captured["mto_ids"] = list(selected_item_ids or [])
        return {"success": True}

    async def _fake_push_mts(self, tenant_id, sales_order_id, created_by, selected_item_ids=None):
        captured["mts_ids"] = list(selected_item_ids or [])
        return {"success": True}

    monkeypatch.setattr(sales_order_service.SalesOrder, "get_or_none", _get_order)
    monkeypatch.setattr(sales_order_service.SalesOrderItem, "filter", lambda **_kwargs: _AwaitableItems(items))
    monkeypatch.setattr(
        "apps.kuaizhizao.utils.material_source_helper.get_material_source_type",
        _fake_source_type,
    )
    monkeypatch.setattr(
        "apps.kuaizhizao.services.shipment_notice_service.get_material_available_quantity",
        _fake_available_qty,
    )
    monkeypatch.setattr(SalesOrderService, "push_sales_order_to_work_order", _fake_push_mto)
    monkeypatch.setattr(SalesOrderService, "push_sales_order_to_shipment_notice", _fake_push_mts)

    result = await service.push_sales_order_auto_route(tenant_id=1, sales_order_id=2, created_by=8)

    assert result["route_summary"]["order_type"] == "AUTO"
    assert captured["mto_ids"] == [21, 23]
    assert captured["mts_ids"] == [22]
