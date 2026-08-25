"""齐套委外关联单号：工单组内委外子单应按物料匹配，不限 bom_parent=当前工单。"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from apps.kuaizhizao.services.work_order_service import WorkOrderService


@pytest.mark.asyncio
async def test_load_kitting_outsource_map_uses_whole_group_not_only_direct_parent():
    svc = WorkOrderService()
    wo = SimpleNamespace(id=10, work_order_group_id=99)
    nested_owo = SimpleNamespace(id=501, product_id=2001, code="OWO-20260824-0002")

    filter_mock = MagicMock()
    filter_mock.order_by.return_value.all = AsyncMock(return_value=[nested_owo])

    with patch(
        "apps.kuaizhizao.models.outsource_work_order.OutsourceWorkOrder.filter",
        return_value=filter_mock,
    ) as outsource_filter:
        result = await svc._load_kitting_component_outsource_map(1, wo)

    outsource_filter.assert_called_once_with(
        tenant_id=1,
        work_order_group_id=99,
        deleted_at__isnull=True,
    )
    assert result[2001] is nested_owo


@pytest.mark.asyncio
async def test_load_kitting_outsource_map_without_group_uses_subtree_parents():
    svc = WorkOrderService()
    wo = SimpleNamespace(id=10, work_order_group_id=None)
    child_owo = SimpleNamespace(id=502, product_id=3001, code="OWO-CHILD")

    filter_mock = MagicMock()
    filter_mock.order_by.return_value.all = AsyncMock(return_value=[child_owo])

    with patch.object(
        WorkOrderService,
        "_collect_work_order_subtree_ids",
        new_callable=AsyncMock,
        return_value={10, 11},
    ), patch(
        "apps.kuaizhizao.models.outsource_work_order.OutsourceWorkOrder.filter",
        return_value=filter_mock,
    ) as outsource_filter:
        result = await svc._load_kitting_component_outsource_map(1, wo)

    outsource_filter.assert_called_once()
    call_kwargs = outsource_filter.call_args.kwargs
    assert call_kwargs["tenant_id"] == 1
    assert set(call_kwargs["bom_parent_work_order_id__in"]) == {10, 11}
    assert result[3001] is child_owo
