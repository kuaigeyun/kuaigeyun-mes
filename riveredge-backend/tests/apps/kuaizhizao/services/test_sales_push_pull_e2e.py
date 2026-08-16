"""销售下推/取单可发量端到端（内存桩，不依赖数据库）。"""

from __future__ import annotations

import asyncio
from decimal import Decimal
from types import SimpleNamespace
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, patch

import pytest

from apps.kuaizhizao.utils import sales_order_push_qty as push_qty
from infra.exceptions.exceptions import BusinessLogicError


def _item(
    *,
    item_id: int,
    order_id: int = 1,
    material_id: int = 100,
    order_quantity: str = "10",
    delivered_quantity: str = "0",
    remaining_quantity: Optional[str] = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=item_id,
        sales_order_id=order_id,
        material_id=material_id,
        order_quantity=Decimal(order_quantity),
        delivered_quantity=Decimal(delivered_quantity),
        remaining_quantity=Decimal(remaining_quantity) if remaining_quantity is not None else None,
    )


class _FakeQuery:
    def __init__(self, rows: List[Dict[str, Any]]):
        self._rows = rows
        self._filters: List[tuple] = []
        self._exclude: List[tuple] = []
        self._value_fields: tuple = ()
        self._flat = False

    def filter(self, **kwargs):
        self._filters.extend(kwargs.items())
        return self

    def exclude(self, **kwargs):
        self._exclude.extend(kwargs.items())
        return self

    def values(self, *fields):
        self._value_fields = fields
        return self

    def values_list(self, *fields, flat=False):
        self._value_fields = fields
        self._flat = flat
        return self

    async def all(self):
        return self._apply()

    def __await__(self):
        async def _run():
            return self._apply()

        return _run().__await__()

    def _match_row(self, row: Dict[str, Any]) -> bool:
        for key, val in self._filters:
            if key.endswith("__in"):
                field = key[:-4]
                if row.get(field) not in val:
                    return False
            elif key.endswith("__isnull"):
                field = key[:-8]
                is_null = row.get(field) is None
                if is_null != val:
                    return False
            elif row.get(key) != val:
                return False
        for key, val in self._exclude:
            if key.endswith("__in"):
                field = key[:-4]
                if row.get(field) in val:
                    return False
        return True

    def _apply(self):
        matched = [r for r in self._rows if self._match_row(r)]
        if self._value_fields:
            out = []
            for r in matched:
                if len(self._value_fields) == 1 and self._flat:
                    out.append(r[self._value_fields[0]])
                elif len(self._value_fields) == 1:
                    out.append({self._value_fields[0]: r.get(self._value_fields[0])})
                else:
                    out.append({f: r.get(f) for f in self._value_fields})
            return out
        return matched


def _patch_orm(
    *,
    notices: Optional[List[Dict[str, Any]]] = None,
    notice_items: Optional[List[Dict[str, Any]]] = None,
    deliveries: Optional[List[Dict[str, Any]]] = None,
    delivery_items: Optional[List[Dict[str, Any]]] = None,
):
    notices = notices or []
    notice_items = notice_items or []
    deliveries = deliveries or []
    delivery_items = delivery_items or []

    return patch.multiple(
        push_qty,
        ShipmentNotice=SimpleNamespace(filter=lambda **kwargs: _FakeQuery(notices)),
        ShipmentNoticeItem=SimpleNamespace(filter=lambda **kwargs: _FakeQuery(notice_items)),
        SalesDelivery=SimpleNamespace(filter=lambda **kwargs: _FakeQuery(deliveries)),
        SalesDeliveryItem=SimpleNamespace(filter=lambda **kwargs: _FakeQuery(delivery_items)),
    )


def test_compute_backorder_zero_remaining_not_fallback_to_order_qty():
    item = _item(item_id=1, order_quantity="10", remaining_quantity="0")
    assert push_qty.compute_backorder_qty(item) == Decimal("0")


def test_compute_pushable_qty_formula():
    assert push_qty.compute_pushable_qty(Decimal("10"), Decimal("3"), Decimal("2")) == Decimal("5")
    assert push_qty.compute_pushable_qty(Decimal("0"), Decimal("0"), Decimal("0")) == Decimal("0")


def test_zero_remaining_cannot_push_again():
    async def _run():
        items = [_item(item_id=1, remaining_quantity="0", order_quantity="10")]
        with _patch_orm():
            pushable = await push_qty.get_pushable_qty_for_order_items(1, 1, items)
        assert pushable.get(1, Decimal("-1")) == Decimal("0")

    asyncio.run(_run())


def test_second_notice_blocked_after_first_fills_backorder():
    async def _run():
        items = [_item(item_id=1, remaining_quantity="10")]
        notices = [{"id": 101, "sales_order_id": 1, "status": "待发货", "deleted_at": None}]
        notice_items = [
            {"notice_id": 101, "sales_order_item_id": 1, "notice_quantity": Decimal("10")},
        ]
        with _patch_orm(notices=notices, notice_items=notice_items):
            pushable = await push_qty.get_pushable_qty_for_order_items(1, 1, items)
        assert pushable[1] == Decimal("0")

    asyncio.run(_run())


def test_same_material_two_lines_independent_occupancy():
    async def _run():
        items = [
            _item(item_id=1, material_id=100, remaining_quantity="5"),
            _item(item_id=2, material_id=100, remaining_quantity="8"),
        ]
        notices = [{"id": 201, "sales_order_id": 1, "status": "已通知", "deleted_at": None}]
        notice_items = [
            {"notice_id": 201, "sales_order_item_id": 1, "notice_quantity": Decimal("5")},
        ]
        with _patch_orm(notices=notices, notice_items=notice_items):
            pushable = await push_qty.get_pushable_qty_for_order_items(1, 1, items)
        assert pushable[1] == Decimal("0")
        assert pushable[2] == Decimal("8")

    asyncio.run(_run())


def test_delivery_occupancy_by_order_line():
    async def _run():
        items = [_item(item_id=1, remaining_quantity="10")]
        deliveries = [{"id": 301, "sales_order_id": 1, "status": "待出库", "deleted_at": None}]
        delivery_items = [
            {
                "delivery_id": 301,
                "sales_order_item_id": 1,
                "material_id": 100,
                "delivery_quantity": Decimal("4"),
            },
        ]
        with _patch_orm(deliveries=deliveries, delivery_items=delivery_items):
            pushable = await push_qty.get_pushable_qty_for_order_items(1, 1, items)
        assert pushable[1] == Decimal("6")

    asyncio.run(_run())


def test_pull_from_sales_order_rejects_zero_remaining():
    async def _run():
        from apps.kuaizhizao.services.warehouse_service import SalesDeliveryService

        order = SimpleNamespace(
            id=1,
            order_code="SO001",
            status="已审核",
            customer_id=1,
            customer_name="客户A",
            shipping_address="addr",
            shipping_method=None,
        )
        order_item = SimpleNamespace(
            id=1,
            material_id=100,
            material_code="M1",
            material_name="物料1",
            material_spec=None,
            material_unit="个",
            unit_price=Decimal("1"),
            remaining_quantity=Decimal("0"),
            order_quantity=Decimal("10"),
            delivered_quantity=Decimal("10"),
            is_gift=False,
            gift_ref_unit_price=None,
        )

        class _ItemQuery:
            async def all(self):
                return [order_item]

        svc = SalesDeliveryService()
        with patch(
            "apps.kuaizhizao.models.sales_order.SalesOrder.get_or_none",
            new=AsyncMock(return_value=order),
        ), patch(
            "apps.kuaizhizao.models.sales_order_item.SalesOrderItem.filter",
            return_value=_ItemQuery(),
        ), patch(
            "apps.kuaizhizao.utils.sales_order_push_qty.get_pushable_qty_for_order_items",
            new=AsyncMock(return_value={1: Decimal("0")}),
        ), patch(
            "apps.kuaizhizao.models.sales_delivery.SalesDelivery.filter",
            return_value=_FakeQuery([]),
        ), patch(
            "apps.kuaizhizao.services.warehouse_service._resolve_warehouse_name_by_id",
            new=AsyncMock(return_value="主仓"),
        ):
            with pytest.raises(BusinessLogicError, match="没有可出库"):
                await svc.pull_from_sales_order(
                    tenant_id=1,
                    sales_order_id=1,
                    created_by=1,
                    warehouse_id=1,
                    warehouse_name="主仓",
                )

    asyncio.run(_run())


def test_batch_orders_with_pushable_qty_excludes_fully_delivered():
    async def _run():
        items = [_item(item_id=1, remaining_quantity="0")]
        with _patch_orm():
            ids = await push_qty.batch_orders_with_pushable_qty(1, items)
        assert 1 not in ids

    asyncio.run(_run())
