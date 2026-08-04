"""销售合同释放金额与整单优惠分摊。"""

import asyncio
from decimal import Decimal
from types import SimpleNamespace

from apps.kuaizhizao.services.sales_contract_service import SalesContractService


def _contract(**kwargs):
    defaults = {"discount_amount": Decimal("5")}
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _item(total_amount: str):
    return SimpleNamespace(total_amount=Decimal(total_amount))


def test_full_release_discount_matches_contract_header():
    contract = _contract(discount_amount=Decimal("5"))
    items = [_item("4325")]
    gross = Decimal("4325")
    assert SalesContractService._allocate_release_discount(contract, items, gross) == Decimal("5")
    assert SalesContractService._release_net_amount(contract, items, gross) == Decimal("4320")


def test_partial_release_discount_is_proportional():
    contract = _contract(discount_amount=Decimal("100"))
    items = [_item("1000")]
    gross = Decimal("500")
    assert SalesContractService._allocate_release_discount(contract, items, gross) == Decimal("50")
    assert SalesContractService._release_net_amount(contract, items, gross) == Decimal("450")


def test_validate_release_capacity_allows_net_amount_with_discount():
    contract = SimpleNamespace(
        total_quantity=Decimal("100"),
        total_amount=Decimal("4320"),
        released_quantity=Decimal("0"),
        released_amount=Decimal("0"),
        contract_type="single",
        tenant_id=1,
        id=1,
        discount_amount=Decimal("5"),
    )
    items = [_item("4325")]
    service = SalesContractService()
    asyncio.run(
        service._validate_release_capacity(
            contract,
            order_qty=Decimal("1"),
            order_amt=Decimal("4325"),
            all_items=items,
        )
    )
