"""反审核重开：按原终审通过人建待办，禁止空审批人 auto_pass 冲掉节点。"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.services.approval.approval_instance_service import ApprovalInstanceService


def _three_level_graph() -> dict:
    return {
        "nodes": [
            {"id": "start", "type": "start"},
            {"id": "n1", "type": "approval", "data": {"label": "一级"}},
            {"id": "n2", "type": "approval", "data": {"label": "二级"}},
            {"id": "n3", "type": "approval", "data": {"label": "三级"}},
            {"id": "end", "type": "end"},
        ],
        "edges": [
            {"source": "start", "target": "n1"},
            {"source": "n1", "target": "n2"},
            {"source": "n2", "target": "n3"},
            {"source": "n3", "target": "end"},
        ],
    }


@pytest.mark.asyncio
async def test_reopen_seeds_final_approver_tasks_without_autopass():
    process = SimpleNamespace(id=9, code="purchase_request", nodes=_three_level_graph(), published_version=1)
    approved = SimpleNamespace(
        id=100,
        status="approved",
        process=process,
        process_id=9,
        title="采购申请审批: CGSQ",
        content=None,
        data={"entity_type": "purchase_request", "entity_id": 37},
        submitter_id=1,
        submitted_at=None,
        process_version=1,
    )
    saved_instances: list = []

    class _FakeInstance:
        def __init__(self, **kwargs):
            self.id = 200
            self.status = kwargs.get("status")
            self.current_node = kwargs.get("current_node")
            self.current_approver_id = kwargs.get("current_approver_id")
            self.data = kwargs.get("data")
            self.process = kwargs.get("process")
            self.title = kwargs.get("title")
            self.content = kwargs.get("content")
            self.submitter_id = kwargs.get("submitter_id")
            self.submitted_at = kwargs.get("submitted_at")
            self.process_version = kwargs.get("process_version")
            self.tenant_id = kwargs.get("tenant_id")
            self.completed_at = None
            saved_instances.append(self)

        async def save(self):
            return None

        async def refresh_from_db(self):
            return None

    created_tasks: list[dict] = []

    async def _task_create(**kwargs):
        created_tasks.append(kwargs)
        return SimpleNamespace(**kwargs)

    pending_filter = MagicMock()
    pending_filter.count = AsyncMock(return_value=1)
    pending_filter.update = AsyncMock(return_value=1)

    def _task_filter(**kwargs):
        if kwargs.get("status") == "pending" and kwargs.get("node_id") == "n3":
            return pending_filter
        qs = MagicMock()
        qs.update = AsyncMock(return_value=0)
        qs.count = AsyncMock(return_value=0)
        return qs

    with (
        patch.object(
            ApprovalInstanceService,
            "_list_instances_by_entity",
            new=AsyncMock(return_value=[approved]),
        ),
        patch.object(
            ApprovalInstanceService,
            "_find_last_completed_approval_node_id",
            new=AsyncMock(return_value="n3"),
        ),
        patch.object(
            ApprovalInstanceService,
            "cancel_approval",
            new=AsyncMock(return_value=False),
        ),
        patch.object(
            ApprovalInstanceService,
            "_create_approval_history",
            new=AsyncMock(return_value=None),
        ),
        patch.object(
            ApprovalInstanceService,
            "bootstrap_instance_workflow",
            new=AsyncMock(return_value=True),
        ) as bootstrap,
        patch(
            "core.services.approval.approval_flow_policy.final_approver_user_ids_on_node",
            new=AsyncMock(return_value={88}),
        ),
        patch(
            "core.services.approval.approval_instance_service.ApprovalInstance",
            side_effect=lambda **kw: _FakeInstance(**kw),
        ),
        patch(
            "core.services.approval.approval_instance_service.ApprovalTask.create",
            new=_task_create,
        ),
        patch(
            "core.services.approval.approval_instance_service.ApprovalTask.filter",
            side_effect=_task_filter,
        ),
    ):
        result = await ApprovalInstanceService.reopen_at_last_approval_node(
            tenant_id=1,
            entity_type="purchase_request",
            entity_id=37,
            operator_id=88,
        )

    assert result is not None
    assert result.status == "pending"
    assert result.current_node == "n3"
    assert created_tasks == [
        {
            "tenant_id": 1,
            "approval_instance_id": 200,
            "node_id": "n3",
            "approver_id": 88,
            "status": "pending",
        }
    ]
    bootstrap.assert_awaited_once()
