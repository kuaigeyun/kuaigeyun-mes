import sys
import types
from decimal import Decimal

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from infra.exceptions.exceptions import BusinessLogicError
from apps.kuaizhizao.services import sales_order_service
from apps.kuaizhizao.services import shipment_notice_service
from apps.kuaizhizao.services.sales_order_service import SalesOrderService
from apps.kuaizhizao.services.shipment_notice_service import ShipmentNoticeService


class _NoopTx:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


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
async def test_push_shipment_notice_should_use_remaining_quantity(monkeypatch):
    service = SalesOrderService()

    monkeypatch.setattr(sales_order_service, "in_transaction", lambda: _NoopTx())

    order = types.SimpleNamespace(
        id=1,
        order_code="SO-001",
        status="AUDITED",
        customer_id=10,
        customer_name="测试客户",
        customer_contact=None,
        customer_phone=None,
        shipping_address="测试地址",
        delivery_date=None,
        notes=None,
    )
    item_open = types.SimpleNamespace(
        id=101,
        material_id=1001,
        material_code="MAT-001",
        material_name="物料A",
        material_spec=None,
        material_unit="PCS",
        order_quantity=Decimal("10"),
        delivered_quantity=Decimal("4"),
        remaining_quantity=Decimal("6"),
        unit_price=Decimal("5"),
        total_amount=Decimal("50"),
    )
    item_closed = types.SimpleNamespace(
        id=102,
        material_id=1002,
        material_code="MAT-002",
        material_name="物料B",
        material_spec=None,
        material_unit="PCS",
        order_quantity=Decimal("3"),
        delivered_quantity=Decimal("3"),
        remaining_quantity=Decimal("0"),
        unit_price=Decimal("7"),
        total_amount=Decimal("21"),
    )

    created_items = []

    async def _get_order(**_kwargs):
        return order

    class _ItemModel:
        @staticmethod
        def filter(**_kwargs):
            return _AwaitableItems([item_open, item_closed])

    class _NoticeModel:
        @staticmethod
        async def create(**_kwargs):
            return types.SimpleNamespace(id=9001)

        @staticmethod
        def filter(**_kwargs):
            class _Q:
                @staticmethod
                async def update(**_k):
                    return None

            return _Q()

    class _NoticeItemModel:
        @staticmethod
        async def create(**kwargs):
            created_items.append(kwargs)
            return types.SimpleNamespace(id=len(created_items))

    async def _fake_generate_code(self, _tenant_id, _rule_code, prefix=None):
        return f"{prefix or 'SN'}-X"

    monkeypatch.setattr(sales_order_service.SalesOrder, "get_or_none", _get_order)
    monkeypatch.setattr(sales_order_service, "SalesOrderItem", _ItemModel)
    monkeypatch.setattr(sales_order_service, "ShipmentNotice", _NoticeModel)
    monkeypatch.setattr(sales_order_service, "ShipmentNoticeItem", _NoticeItemModel)
    monkeypatch.setattr(
        "apps.kuaizhizao.services.shipment_notice_service.ShipmentNoticeService.generate_code",
        _fake_generate_code,
    )

    result = await service.push_sales_order_to_shipment_notice(
        tenant_id=1,
        sales_order_id=1,
        created_by=100,
    )

    assert result["success"] is True
    assert len(created_items) == 1
    assert created_items[0]["sales_order_item_id"] == 101
    assert Decimal(str(created_items[0]["notice_quantity"])) == Decimal("6")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_notify_warehouse_should_block_overdelivery(monkeypatch):
    service = ShipmentNoticeService()

    notice = types.SimpleNamespace(id=2001, sales_order_id=1, status="待发货")
    notice_item = types.SimpleNamespace(
        id=1,
        notice_quantity=Decimal("9"),
        sales_order_item_id=101,
    )
    reserved_notice_item = types.SimpleNamespace(
        id=2,
        notice_quantity=Decimal("2"),
        sales_order_item_id=101,
    )
    order_item = types.SimpleNamespace(
        id=101,
        material_code="MAT-001",
        material_name="物料A",
        order_quantity=Decimal("10"),
        delivered_quantity=Decimal("4"),
        remaining_quantity=Decimal("6"),
    )

    class _ItemsQuery:
        def __init__(self, items):
            self._items = items

        async def all(self):
            return self._items

    class _NoticeQuery:
        def exclude(self, **_kwargs):
            return self

        async def values_list(self, *_args, **_kwargs):
            return [3001]

    async def _get_notice(**_kwargs):
        return notice

    def _notice_filter(**kwargs):
        if "id" in kwargs:
            class _U:
                @staticmethod
                async def update(**_k):
                    return None

            return _U()
        return _NoticeQuery()

    def _notice_item_filter(**kwargs):
        if kwargs.get("notice_id") == 2001:
            return _ItemsQuery([notice_item])
        if kwargs.get("notice_id__in") == [3001]:
            return _ItemsQuery([reserved_notice_item])
        return _ItemsQuery([])

    def _order_item_filter(**_kwargs):
        return _ItemsQuery([order_item])

    monkeypatch.setattr(shipment_notice_service.ShipmentNotice, "get_or_none", _get_notice)
    monkeypatch.setattr(shipment_notice_service.ShipmentNotice, "filter", _notice_filter)
    monkeypatch.setattr(shipment_notice_service.ShipmentNoticeItem, "filter", _notice_item_filter)
    monkeypatch.setattr(shipment_notice_service.SalesOrderItem, "filter", _order_item_filter)

    with pytest.raises(BusinessLogicError, match="超过可通知欠发量"):
        await service.notify_warehouse(
            tenant_id=1,
            notice_id=2001,
            notified_by=100,
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_notify_warehouse_should_block_when_inventory_reserved(monkeypatch):
    service = ShipmentNoticeService()

    notice = types.SimpleNamespace(id=2002, sales_order_id=1, status="待发货", warehouse_id=1)
    notice_item = types.SimpleNamespace(
        id=1,
        material_id=1001,
        material_code="MAT-001",
        material_name="物料A",
        notice_quantity=Decimal("5"),
        sales_order_item_id=101,
    )
    # 其他已通知单据对同物料已有预占（这里不关联当前订单行，避免触发超发校验）
    reserved_notice_item = types.SimpleNamespace(
        id=2,
        material_id=1001,
        material_code="MAT-001",
        material_name="物料A",
        notice_quantity=Decimal("8"),
        sales_order_item_id=None,
    )
    order_item = types.SimpleNamespace(
        id=101,
        material_code="MAT-001",
        material_name="物料A",
        order_quantity=Decimal("20"),
        delivered_quantity=Decimal("0"),
        remaining_quantity=Decimal("20"),
    )

    class _ItemsQuery:
        def __init__(self, items):
            self._items = items

        async def all(self):
            return self._items

    class _NoticeQuery:
        def __init__(self):
            self._warehouse_id = None

        def exclude(self, **_kwargs):
            return self

        def filter(self, **kwargs):
            self._warehouse_id = kwargs.get("warehouse_id")
            return self

        async def values_list(self, *_args, **_kwargs):
            return [3002] if self._warehouse_id == 1 else []

    async def _get_notice(**_kwargs):
        return notice

    def _notice_filter(**kwargs):
        if "id" in kwargs:
            class _U:
                @staticmethod
                async def update(**_k):
                    return None

            return _U()
        return _NoticeQuery()

    def _notice_item_filter(**kwargs):
        if kwargs.get("notice_id") == 2002:
            return _ItemsQuery([notice_item])
        if kwargs.get("notice_id__in") == [3002]:
            return _ItemsQuery([reserved_notice_item])
        return _ItemsQuery([])

    def _order_item_filter(**_kwargs):
        return _ItemsQuery([order_item])

    async def _available_qty(**_kwargs):
        return Decimal("10")

    monkeypatch.setattr(shipment_notice_service.ShipmentNotice, "get_or_none", _get_notice)
    monkeypatch.setattr(shipment_notice_service.ShipmentNotice, "filter", _notice_filter)
    monkeypatch.setattr(shipment_notice_service.ShipmentNoticeItem, "filter", _notice_item_filter)
    monkeypatch.setattr(shipment_notice_service.SalesOrderItem, "filter", _order_item_filter)
    monkeypatch.setattr(shipment_notice_service, "get_material_available_quantity", _available_qty)

    with pytest.raises(BusinessLogicError, match="超过库存可用量"):
        await service.notify_warehouse(
            tenant_id=1,
            notice_id=2002,
            notified_by=100,
        )
