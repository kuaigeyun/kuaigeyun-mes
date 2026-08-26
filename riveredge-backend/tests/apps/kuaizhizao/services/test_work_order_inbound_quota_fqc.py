"""工单入库额度：FQC 不应阻塞待入库单创建。"""

import asyncio
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from apps.kuaizhizao.services.warehouse_service import FinishedGoodsReceiptService


def test_inbound_quota_pending_not_capped_by_fqc_when_no_inspection():
    work_order = MagicMock(id=10, product_id=99, quantity=Decimal("2"))

    with patch(
        "apps.kuaizhizao.models.work_order.WorkOrder.get_or_none",
        new=AsyncMock(return_value=work_order),
    ), patch.object(
        FinishedGoodsReceiptService,
        "_sum_work_order_inbound_quantity",
        new=AsyncMock(return_value=0.0),
    ), patch(
        "apps.kuaizhizao.services.inspection_policy_service.resolve_inspection_policy",
        new=AsyncMock(return_value=("plan", 1, None)),
    ), patch(
        "apps.kuaizhizao.services.inspection_policy_service.get_fqc_inbound_remaining_quantity",
        new=AsyncMock(return_value=Decimal("0")),
    ):
        quota = asyncio.run(
            FinishedGoodsReceiptService()._get_work_order_inbound_quota(1, 10)
        )

    assert quota["pending"] == 2.0
    assert quota["fqc_qualified_remaining"] == 0.0


def test_assert_inbound_quantity_allows_create_when_fqc_remaining_zero():
    svc = FinishedGoodsReceiptService()
    with patch.object(
        svc,
        "_get_work_order_inbound_quota",
        new=AsyncMock(
            return_value={
                "planned": 2.0,
                "max_quantity": 2.0,
                "received": 0.0,
                "pending": 2.0,
                "fqc_qualified_remaining": 0.0,
            }
        ),
    ):
        pending = asyncio.run(svc._assert_work_order_inbound_quantity(1, 10, 2.0))
    assert pending == 2.0
