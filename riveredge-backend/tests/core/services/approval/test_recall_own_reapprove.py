"""撤回本级后必须能再次审核：残留 approved 不得触发 reconcile 清掉待办。"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.services.approval.approval_instance_service import ApprovalInstanceService


@pytest.mark.asyncio
async def test_check_node_completion_false_when_only_pending_after_recall():
    """撤回后仅 pending、无 approved → 不得判定节点已完成。"""
    instance = SimpleNamespace(
        id=1,
        status="pending",
        current_node="n1",
        process=SimpleNamespace(
            nodes={
                "nodes": [
                    {"id": "n1", "type": "approval", "data": {"approvalType": "OR"}},
                ],
                "edges": [],
            }
        ),
    )
    tasks = [
        SimpleNamespace(status="pending", sign_type=None),
        SimpleNamespace(status="cancelled", sign_type=None),
    ]

    with patch(
        "core.services.approval.approval_instance_service.ApprovalTask.filter",
        return_value=SimpleNamespace(all=AsyncMock(return_value=tasks)),
    ):
        completed, status = await ApprovalInstanceService._check_node_completion(instance)

    assert completed is False
    assert status == "pending"


@pytest.mark.asyncio
async def test_check_node_completion_true_when_leftover_approved_exists():
    """旧缺陷：approved 残留 + pending → 或签会误判已完成并清掉待办。"""
    instance = SimpleNamespace(
        id=1,
        status="pending",
        current_node="n1",
        process=SimpleNamespace(
            nodes={
                "nodes": [
                    {"id": "n1", "type": "approval", "data": {"approvalType": "OR"}},
                ],
                "edges": [],
            }
        ),
    )
    tasks = [
        SimpleNamespace(status="approved", sign_type=None),
        SimpleNamespace(status="pending", sign_type=None),
    ]

    with patch(
        "core.services.approval.approval_instance_service.ApprovalTask.filter",
        return_value=SimpleNamespace(all=AsyncMock(return_value=tasks)),
    ):
        completed, status = await ApprovalInstanceService._check_node_completion(instance)

    assert completed is True
    assert status == "approved"


@pytest.mark.asyncio
async def test_recall_own_cancels_all_then_creates_pending():
    """recall_own 须整批 cancel 再 create pending，不能只改一行。"""
    graph = {
        "nodes": [
            {"id": "start", "type": "start"},
            {"id": "n1", "type": "approval", "data": {"label": "直接上级", "allowApproverRecall": True}},
            {"id": "n2", "type": "approval", "data": {"label": "二级上级"}},
            {"id": "end", "type": "end"},
        ],
        "edges": [
            {"source": "start", "target": "n1"},
            {"source": "n1", "target": "n2"},
            {"source": "n2", "target": "end"},
        ],
    }
    instance = SimpleNamespace(
        id=99,
        status="pending",
        current_node="n2",
        current_approver_id=10,
        data={"entity_type": "purchase_request", "entity_id": 1, "__branch_index_x": 0},
        process=SimpleNamespace(nodes=graph),
        save=AsyncMock(),
        fetch_related=AsyncMock(),
    )
    approved_task = SimpleNamespace(
        id=1,
        node_id="n1",
        approver_id=10,
        status="approved",
        action_at="2026-10-18",
    )

    filter_calls: list[dict] = []
    created: list[dict] = []

    class _QS:
        def __init__(self, **kwargs):
            self.kwargs = kwargs
            filter_calls.append(kwargs)

        def order_by(self, *args):
            return self

        def exclude(self, **kwargs):
            return self

        async def all(self):
            if self.kwargs.get("status") == "approved":
                return [approved_task]
            return []

        async def first(self):
            if self.kwargs.get("status") == "approved":
                return approved_task
            return None

        async def exists(self):
            return False

        async def update(self, **kwargs):
            filter_calls.append({"__update__": kwargs, **self.kwargs})
            return 1

    async def _create(**kwargs):
        created.append(kwargs)
        return SimpleNamespace(id=100, **kwargs)

    with patch(
        "core.services.approval.approval_instance_service.ApprovalInstanceService.get_instance_by_entity",
        new=AsyncMock(return_value=instance),
    ), patch(
        "core.services.approval.approval_instance_service.ApprovalTask.filter",
        side_effect=lambda **kw: _QS(**kw),
    ), patch(
        "core.services.approval.approval_instance_service.ApprovalTask.create",
        new=AsyncMock(side_effect=_create),
    ), patch(
        "core.services.approval.approval_flow_policy.viewer_may_recall_own_on_instance",
        new=AsyncMock(return_value=True),
    ), patch.object(
        ApprovalInstanceService,
        "_resolve_node_approvers",
        new=AsyncMock(return_value=[10]),
    ), patch.object(
        ApprovalInstanceService,
        "_sync_node_approver_tasks",
        new=AsyncMock(return_value=[]),
    ), patch.object(
        ApprovalInstanceService,
        "_create_approval_history",
        new=AsyncMock(),
    ), patch.object(
        ApprovalInstanceService,
        "_strip_branch_decision_keys",
        side_effect=lambda d: {k: v for k, v in (d or {}).items() if not str(k).startswith("__branch")},
    ):
        ok = await ApprovalInstanceService.recall_own_approval(
            tenant_id=1,
            entity_type="purchase_request",
            entity_id=1,
            operator_id=10,
        )

    assert ok is True
    assert instance.current_node == "n1"
    assert any(c.get("__update__", {}).get("status") == "cancelled" for c in filter_calls)
    assert created and created[0]["status"] == "pending"
    assert created[0]["node_id"] == "n1"
    assert created[0]["approver_id"] == 10
    assert "__branch_index_x" not in (instance.data or {})
