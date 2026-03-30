import sys
import types
from decimal import Decimal

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from infra.exceptions.exceptions import BusinessLogicError
from apps.kuaizhizao.services import sales_order_service
from apps.kuaizhizao.services.sales_order_service import SalesOrderService


class _ReceivableQuery:
    def __init__(self, rows):
        self.rows = rows

    async def values_list(self, *_args, **_kwargs):
        return self.rows


@pytest.mark.unit
@pytest.mark.asyncio
async def test_credit_limit_should_block_when_exceeded(monkeypatch):
    service = SalesOrderService()

    class _Customer:
        credit_limit = Decimal("1000")
        name = "客户A"

    async def _get_customer(**_kwargs):
        return _Customer()

    class _Receivable:
        @staticmethod
        def filter(**_kwargs):
            return _ReceivableQuery([Decimal("900")])

    monkeypatch.setattr(sales_order_service.Customer, "get_or_none", _get_customer)
    monkeypatch.setattr(sales_order_service, "Receivable", _Receivable)

    with pytest.raises(BusinessLogicError, match="信用额度超限"):
        await service._validate_customer_credit_limit_before_release(
            tenant_id=1,
            customer_id=1,
            customer_name="客户A",
            order_total_amount=Decimal("200"),
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_credit_limit_should_pass_when_not_exceeded(monkeypatch):
    service = SalesOrderService()

    class _Customer:
        credit_limit = Decimal("1000")
        name = "客户A"

    async def _get_customer(**_kwargs):
        return _Customer()

    class _Receivable:
        @staticmethod
        def filter(**_kwargs):
            return _ReceivableQuery([Decimal("400")])

    monkeypatch.setattr(sales_order_service.Customer, "get_or_none", _get_customer)
    monkeypatch.setattr(sales_order_service, "Receivable", _Receivable)

    await service._validate_customer_credit_limit_before_release(
        tenant_id=1,
        customer_id=1,
        customer_name="客户A",
        order_total_amount=Decimal("200"),
    )
