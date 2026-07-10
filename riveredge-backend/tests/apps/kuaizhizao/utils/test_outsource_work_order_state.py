"""委外工单状态流转单元测试。"""

from datetime import datetime
from decimal import Decimal

from apps.kuaizhizao.services.document_action_policy.outsource_work_order import (
    derive_outsource_work_order_capabilities,
)
from apps.kuaizhizao.utils.outsource_work_order_state import (
    apply_outsource_work_order_execution_start,
    apply_outsource_work_order_receipt_completion,
    outsource_work_order_has_execution_activity,
    resolve_outsource_work_order_product_unit,
)


class _Owo:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


def test_execution_start_from_released():
    owo = _Owo(status="released", actual_start_date=None)
    changed = apply_outsource_work_order_execution_start(owo, now=datetime(2026, 7, 10, 9, 0, 0))
    assert changed is True
    assert owo.status == "in_progress"
    assert owo.actual_start_date == datetime(2026, 7, 10, 9, 0, 0)


def test_receipt_completion_when_fully_received():
    owo = _Owo(status="in_progress", quantity=Decimal("100"), received_quantity=Decimal("100"))
    changed = apply_outsource_work_order_receipt_completion(owo, now=datetime(2026, 7, 31, 18, 0, 0))
    assert changed is True
    assert owo.status == "completed"
    assert owo.actual_end_date == datetime(2026, 7, 31, 18, 0, 0)


def test_has_execution_activity():
    assert outsource_work_order_has_execution_activity(_Owo(issued_quantity=0, received_quantity=0)) is False
    assert outsource_work_order_has_execution_activity(_Owo(issued_quantity=1, received_quantity=0)) is True


def test_cancel_capability_draft_and_released():
    draft_caps = derive_outsource_work_order_capabilities(_Owo(status="draft"))
    assert draft_caps.cancel.allowed is True

    released_caps = derive_outsource_work_order_capabilities(
        _Owo(status="released", issued_quantity=0, received_quantity=0, quantity=100)
    )
    assert released_caps.cancel.allowed is True
    assert released_caps.close.allowed is False


def test_close_capability_in_progress():
    caps = derive_outsource_work_order_capabilities(
        _Owo(status="in_progress", issued_quantity=10, received_quantity=50, quantity=100)
    )
    assert caps.cancel.allowed is False
    assert caps.close.allowed is True
    assert caps.push_outsource_receipt.allowed is True


def test_resolve_product_unit_default_without_product_id():
    import asyncio

    async def _run():
        return await resolve_outsource_work_order_product_unit(1, _Owo())

    assert asyncio.run(_run()) == "件"
