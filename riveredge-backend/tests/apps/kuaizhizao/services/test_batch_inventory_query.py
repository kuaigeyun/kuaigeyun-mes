"""批次库存 batch-query 与 quality_status 契约。"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from apps.kuaizhizao.services.inventory_service import InventoryService
from apps.kuaizhizao.services.report_enhancements import _format_movement_batch_number_for_report
from apps.kuaizhizao.services.report_service import ReportService


def test_format_movement_batch_number_for_report_hides_default_sentinel():
    assert _format_movement_batch_number_for_report(None) == ""
    assert _format_movement_batch_number_for_report("") == ""
    assert _format_movement_batch_number_for_report("DEFAULT") == ""
    assert _format_movement_batch_number_for_report("20260721-001") == "20260721-001"


def test_format_batch_no_for_display_hides_default_sentinel():
    assert InventoryService.format_batch_no_for_display(None) is None
    assert InventoryService.format_batch_no_for_display("") is None
    assert InventoryService.format_batch_no_for_display("DEFAULT") is None
    assert InventoryService.format_batch_no_for_display("20260721-001") == "20260721-001"


def test_normalize_batch_no_for_report_hides_default_sentinel():
    assert ReportService._normalize_batch_no_for_report(None) == ""
    assert ReportService._normalize_batch_no_for_report("DEFAULT") == ""
    assert ReportService._normalize_batch_no_for_report("20260721-001") == "20260721-001"


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
