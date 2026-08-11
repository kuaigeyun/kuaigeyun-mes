"""批次库存 batch-query 与 quality_status 契约。"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from apps.kuaizhizao.services.report_service import ReportService


def test_summary_only_filters_qualified_batches():
    batch = MagicMock()
    batch.material_id = 3
    batch.quantity = 10
    batch.status = "in_stock"
    batch.ownership_type = "company_owned"
    batch.customer_id = 0

    captured = {}

    class FakeBatchQuery:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        def filter(self, *_args, **_kwargs):
            return self

        async def all(self):
            return [batch]

    class FakeLineQuery:
        def filter(self, *_args, **_kwargs):
            return self

        async def all(self):
            return []

    with patch(
        "apps.master_data.models.material_batch.MaterialBatch.filter",
        side_effect=lambda **kwargs: FakeBatchQuery(**kwargs),
    ), patch(
        "apps.kuaizhizao.models.line_side_inventory.LineSideInventory.filter",
        side_effect=lambda **_kwargs: FakeLineQuery(),
    ):
        result = asyncio.run(
            ReportService().query_batch_inventory(
                tenant_id=1,
                material_ids=[3],
                summary_only=True,
                include_expired=False,
            )
        )

    assert captured.get("quality_status") == "qualified"
    assert result["material_totals"]["3"] == 10.0
