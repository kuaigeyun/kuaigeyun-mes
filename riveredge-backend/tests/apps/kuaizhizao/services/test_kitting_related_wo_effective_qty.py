"""齐套关联半成品工单：有效完工量按检验放行，未检完不计为已完成。"""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from apps.kuaizhizao.services.work_order_service import WorkOrderService


@pytest.mark.asyncio
async def test_kitting_related_summary_uses_transfer_qualified_not_reported():
    svc = WorkOrderService()
    wo = SimpleNamespace(
        id=3,
        code="GD202607250003",
        status="in_progress",
        quantity=Decimal("100"),
        completed_quantity=Decimal("100"),
        planned_end_date=None,
    )
    with patch.object(
        WorkOrderService,
        "_resolve_work_order_effective_completed_quantity",
        new_callable=AsyncMock,
        return_value=Decimal("0"),
    ):
        summary = await svc._build_kitting_related_work_order_summary(1, wo)

    assert summary.completed_quantity == Decimal("0")
    assert summary.progress_percent == 0.0


def test_work_order_progress_percent_from_effective():
    assert WorkOrderService._work_order_progress_percent(Decimal("100"), Decimal("0")) == 0.0
    assert WorkOrderService._work_order_progress_percent(Decimal("100"), Decimal("50")) == 50.0
    assert WorkOrderService._work_order_progress_percent(Decimal("100"), Decimal("100")) == 100.0
