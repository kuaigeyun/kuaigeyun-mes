"""生产工单推/拉分离 — 服务层门禁与调度验收测试。

拉取 ``POST /apps/kuaizhizao/work-orders/sync-from-source``
- 仅 upsert 本地工单，不得触发金蝶 PRD_MO 推送
- binding.sync_direction 对工单实质仅为 pull（调度也不应自动推）

调度 ``external_sync_scheduler._run_work_order``
- ``sync_direction=bidirectional`` 时也不应自动外推（外推走 DocumentPush）
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from apps.kuaizhizao.schemas.work_order_sync import (
    WorkOrderSyncFromSourceOut,
    WorkOrderSyncFromSourceRequest,
)
from apps.kuaizhizao.services.work_order_sync_service import WorkOrderSyncService
from core.services.data.external_sync_scheduler import ExternalSyncSchedulerService


def _binding(**overrides):
    base = dict(
        sync_direction="pull",
        sync_mode="scheduled_full",
        schedule_interval_minutes=15,
        last_success_at=None,
        last_attempt_at=None,
        last_error=None,
    )
    base.update(overrides)
    binding = SimpleNamespace(**base)
    binding.save = AsyncMock()
    return binding


@pytest.mark.asyncio
async def test_sync_from_source_does_not_invoke_kingdee_push():
    """拉取路径不应再暴露 sync_to_kingdee；外推走 DocumentPush。"""
    assert not hasattr(WorkOrderSyncService, "sync_to_kingdee")

    service = WorkOrderSyncService()
    pull_result = WorkOrderSyncFromSourceOut(created=1, updated=0, skipped=0, failed=0)

    with patch(
        "infra.models.user.User.get_or_none",
        new=AsyncMock(return_value=SimpleNamespace(id=10)),
    ), patch.object(
        service,
        "_upsert_work_orders",
        new=AsyncMock(return_value=pull_result),
    ), patch(
        "apps.kuaizhizao.services.work_order_sync_service.fetch_rows_from_api",
        new=AsyncMock(return_value=([{"code": "WO-1"}], False)),
    ), patch(
        "apps.kuaizhizao.services.work_order_sync_service.run_work_order_prerequisite_syncs",
        new=AsyncMock(return_value=[]),
    ), patch(
        "apps.kuaizhizao.services.work_order_sync_service.record_sync_run_log",
        new=AsyncMock(),
    ), patch(
        "apps.kuaizhizao.services.work_order_sync_service.WorkOrderSyncBinding.filter",
    ) as binding_filter:
        binding = _binding(source_type="api", api_uuid="api-1", field_mapping={"code": "code"})
        binding_filter.return_value.first = AsyncMock(return_value=binding)

        out = await service.sync_from_source(
            tenant_id=1,
            user_id=10,
            request=WorkOrderSyncFromSourceRequest(
                source_type="api",
                api_uuid="api-1",
                field_mapping={"code": "code"},
                sync_mode="manual_full",
                sync_direction="pull",
                skip_prerequisite_syncs=True,
            ),
        )

    assert out.created == 1


@pytest.mark.asyncio
async def test_scheduler_run_work_order_bidirectional_does_not_auto_push():
    """工单拉取任务不应因 sync_direction=bidirectional 自动外推。"""
    assert not hasattr(WorkOrderSyncService, "sync_to_kingdee")

    binding = _binding(sync_direction="bidirectional")
    actor = SimpleNamespace(id=99)
    pull_result = WorkOrderSyncFromSourceOut(created=0, updated=1, skipped=0, failed=0)
    service = WorkOrderSyncService()

    with patch(
        "core.services.data.external_sync_scheduler.WorkOrderSyncBinding.filter",
    ) as binding_filter, patch(
        "core.services.data.external_sync_scheduler._due",
        return_value=True,
    ), patch(
        "core.services.data.external_sync_scheduler._resolve_actor",
        new=AsyncMock(return_value=actor),
    ), patch(
        "core.services.data.external_sync_scheduler.WorkOrderSyncService",
        return_value=service,
    ), patch.object(
        service,
        "sync_from_source",
        new=AsyncMock(return_value=pull_result),
    ) as pull_mock:
        binding_filter.return_value.first = AsyncMock(return_value=binding)

        stats = {"work_order": 0, "errors": 0}
        await ExternalSyncSchedulerService._run_work_order(tenant_id=1, stats=stats)

    pull_mock.assert_awaited_once()
    assert stats["work_order"] == 1
