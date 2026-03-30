import sys
import types
from decimal import Decimal

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from infra.exceptions.exceptions import BusinessLogicError
from apps.kuaizhizao.services import sales_order_service
from apps.kuaizhizao.services.sales_order_service import SalesOrderService


class _Query:
    def __init__(self, rows):
        self.rows = rows

    async def all(self):
        return self.rows


def _build_item(material_id: int, qty: str, amount: str):
    return types.SimpleNamespace(
        material_id=material_id,
        order_quantity=Decimal(qty),
        total_amount=Decimal(amount),
    )


def _build_material(material_id: int, defaults: dict):
    return types.SimpleNamespace(id=material_id, defaults=defaults)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_sales_margin_should_block_when_below_threshold(monkeypatch):
    service = SalesOrderService()

    async def _get_threshold(_tenant_id: int) -> float:
        return 30.0

    service.business_config_service.get_sales_low_margin_threshold_percent = _get_threshold

    items = [_build_item(101, "10", "100")]
    materials = [_build_material(101, {"standard_cost": "8"})]

    class _SalesOrderItem:
        @staticmethod
        def filter(**_kwargs):
            return _Query(items)

    class _Material:
        @staticmethod
        def filter(**_kwargs):
            return _Query(materials)

    monkeypatch.setattr(sales_order_service, "SalesOrderItem", _SalesOrderItem)
    monkeypatch.setattr(sales_order_service, "Material", _Material)

    with pytest.raises(BusinessLogicError, match="低于阈值"):
        await service._validate_sales_order_margin_before_release(
            tenant_id=1,
            sales_order_id=1,
            order_code="SO-001",
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_sales_margin_should_pass_when_above_threshold(monkeypatch):
    service = SalesOrderService()

    async def _get_threshold(_tenant_id: int) -> float:
        return 20.0

    service.business_config_service.get_sales_low_margin_threshold_percent = _get_threshold

    items = [_build_item(101, "10", "100")]
    materials = [_build_material(101, {"standard_cost": "6"})]

    class _SalesOrderItem:
        @staticmethod
        def filter(**_kwargs):
            return _Query(items)

    class _Material:
        @staticmethod
        def filter(**_kwargs):
            return _Query(materials)

    monkeypatch.setattr(sales_order_service, "SalesOrderItem", _SalesOrderItem)
    monkeypatch.setattr(sales_order_service, "Material", _Material)

    await service._validate_sales_order_margin_before_release(
        tenant_id=1,
        sales_order_id=1,
        order_code="SO-001",
    )

