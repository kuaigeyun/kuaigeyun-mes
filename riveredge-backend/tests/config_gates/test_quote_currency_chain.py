import sys
import types
from decimal import Decimal
from datetime import date

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from apps.kuaizhizao.services import quotation_service
from apps.kuaizhizao.services.quotation_service import QuotationService


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
async def test_convert_quote_to_order_should_forward_currency_code(monkeypatch):
    service = QuotationService()
    captured = {}

    quotation = types.SimpleNamespace(
        id=1,
        quotation_code="QT-001",
        quotation_date=date.today(),
        delivery_date=date.today(),
        customer_id=100,
        customer_name="客户A",
        customer_contact="张三",
        customer_phone="13800138000",
        total_quantity=Decimal("10"),
        total_amount=Decimal("100"),
        salesman_id=9,
        salesman_name="销售A",
        shipping_address="测试地址",
        shipping_method="快递",
        payment_terms="月结",
        notes="测试备注",
        status="已发送",
        sales_order_id=None,
        currency_code="USD",
    )
    q_item = types.SimpleNamespace(
        material_id=1,
        material_code="MAT-001",
        material_name="物料A",
        material_spec=None,
        material_unit="PCS",
        quote_quantity=Decimal("10"),
        unit_price=Decimal("10"),
        total_amount=Decimal("100"),
        delivery_date=date.today(),
        notes=None,
    )

    async def _get_quote(**_kwargs):
        return quotation

    class _QuotationItemModel:
        @staticmethod
        def filter(**_kwargs):
            return _AwaitableItems([q_item])

    def _quotation_filter(**_kwargs):
        class _Q:
            @staticmethod
            async def update(**_kw):
                return None

        return _Q()

    async def _fake_create_sales_order(self, tenant_id, sales_order_data, created_by):
        captured["currency_code"] = getattr(sales_order_data, "currency_code", None)
        return types.SimpleNamespace(id=9001, order_code="SO-9001")

    async def _fake_get_quotation_by_id(self, tenant_id, quotation_id, include_items=True):
        return types.SimpleNamespace(id=quotation_id)

    monkeypatch.setattr(quotation_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(quotation_service.Quotation, "get_or_none", _get_quote)
    monkeypatch.setattr(quotation_service, "QuotationItem", _QuotationItemModel)
    monkeypatch.setattr(quotation_service.Quotation, "filter", _quotation_filter)
    monkeypatch.setattr(QuotationService, "get_quotation_by_id", _fake_get_quotation_by_id)
    monkeypatch.setattr(
        "apps.kuaizhizao.services.sales_order_service.SalesOrderService.create_sales_order",
        _fake_create_sales_order,
    )

    await service.convert_to_sales_order(
        tenant_id=1,
        quotation_id=1,
        created_by=7,
    )
    assert captured["currency_code"] == "USD"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_convert_quote_to_order_should_support_partial_item_selection(monkeypatch):
    service = QuotationService()
    captured = {}

    quotation = types.SimpleNamespace(
        id=1,
        quotation_code="QT-001",
        quotation_date=date.today(),
        delivery_date=date.today(),
        customer_id=100,
        customer_name="客户A",
        customer_contact="张三",
        customer_phone="13800138000",
        total_quantity=Decimal("10"),
        total_amount=Decimal("100"),
        salesman_id=9,
        salesman_name="销售A",
        shipping_address="测试地址",
        shipping_method="快递",
        payment_terms="月结",
        notes="测试备注",
        status="已发送",
        sales_order_id=None,
        currency_code="CNY",
    )
    q_item_1 = types.SimpleNamespace(
        id=11,
        material_id=1,
        material_code="MAT-001",
        material_name="物料A",
        material_spec=None,
        material_unit="PCS",
        quote_quantity=Decimal("4"),
        unit_price=Decimal("10"),
        total_amount=Decimal("40"),
        delivery_date=date.today(),
        notes=None,
    )
    q_item_2 = types.SimpleNamespace(
        id=12,
        material_id=2,
        material_code="MAT-002",
        material_name="物料B",
        material_spec=None,
        material_unit="PCS",
        quote_quantity=Decimal("6"),
        unit_price=Decimal("10"),
        total_amount=Decimal("60"),
        delivery_date=date.today(),
        notes=None,
    )

    async def _get_quote(**_kwargs):
        return quotation

    class _QuotationItemModel:
        @staticmethod
        def filter(**_kwargs):
            return _AwaitableItems([q_item_1, q_item_2])

    def _quotation_filter(**_kwargs):
        class _Q:
            @staticmethod
            async def update(**_kw):
                return None

        return _Q()

    async def _fake_create_sales_order(self, tenant_id, sales_order_data, created_by):
        captured["item_ids"] = [int(it.material_id) for it in sales_order_data.items]
        return types.SimpleNamespace(id=9002, order_code="SO-9002")

    async def _fake_get_quotation_by_id(self, tenant_id, quotation_id, include_items=True):
        return types.SimpleNamespace(id=quotation_id)

    monkeypatch.setattr(quotation_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(quotation_service.Quotation, "get_or_none", _get_quote)
    monkeypatch.setattr(quotation_service, "QuotationItem", _QuotationItemModel)
    monkeypatch.setattr(quotation_service.Quotation, "filter", _quotation_filter)
    monkeypatch.setattr(QuotationService, "get_quotation_by_id", _fake_get_quotation_by_id)
    monkeypatch.setattr(
        "apps.kuaizhizao.services.sales_order_service.SalesOrderService.create_sales_order",
        _fake_create_sales_order,
    )

    await service.convert_to_sales_order(
        tenant_id=1,
        quotation_id=1,
        created_by=7,
        selected_item_ids=[12],
    )
    assert captured["item_ids"] == [2]
