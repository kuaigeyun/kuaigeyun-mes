"""驳回到上一级：perform_task_action 集成（mock 任务层，真图 + 策略）。"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.schemas.approval_instance import ApprovalInstanceAction
from core.services.approval.approval_instance_service import ApprovalInstanceService


def _linear_graph():
    return {
        "nodes": [
            {"id": "start", "type": "start"},
            {"id": "n1", "type": "approval", "data": {"label": "一级审核"}},
            {"id": "n2", "type": "approval", "data": {"label": "二级审核"}},
            {"id": "end", "type": "end"},
        ],
        "edges": [
            {"source": "start", "target": "n1"},
            {"source": "n1", "target": "n2"},
            {"source": "n2", "target": "end"},
        ],
    }


@pytest.mark.asyncio
async def test_reject_previous_keeps_instance_pending_and_moves_to_n1():
    graph = _linear_graph()
    process = SimpleNamespace(nodes=graph)
    instance = SimpleNamespace(
        id=900,
        status="pending",
        current_node="n2",
        completed_at=None,
        process=process,
        data={},
    )
    task = SimpleNamespace(
        uuid="task-uuid-1",
        node_id="n2",
        approver_id=200,
        status="pending",
        sign_type=None,
        parent_task_id=None,
        approval_instance=instance,
        action_at=None,
        comment=None,
    )
    task.save = AsyncMock()

    task_qs = MagicMock()
    task_qs.prefetch_related.return_value = task_qs
    task_qs.first = AsyncMock(return_value=task)

    saved_instance = {"status": None, "node": None}

    async def _fake_save(self=None):
        if instance:
            saved_instance["status"] = instance.status
            saved_instance["node"] = instance.current_node

    instance.save = AsyncMock(side_effect=_fake_save)

    create_tasks = AsyncMock(return_value=[])
    reject_prev = AsyncMock(return_value=instance)

    with patch(
        "core.services.approval.approval_instance_service.ApprovalTask.filter",
        return_value=task_qs,
    ), patch.object(
        ApprovalInstanceService,
        "_check_node_completion",
        new=AsyncMock(return_value=(True, "rejected")),
    ), patch.object(
        ApprovalInstanceService,
        "reject_to_previous_approval_node",
        reject_prev,
    ), patch.object(
        ApprovalInstanceService,
        "_advance_instance_after_node_completion",
        new=AsyncMock(),
    ) as advance:
        task.status = "pending"
        await ApprovalInstanceService.perform_task_action(
            tenant_id=1,
            task_uuid="task-uuid-1",
            user_id=200,
            action_data=ApprovalInstanceAction(
                action="reject",
                comment="请修改数量",
                reject_target="previous",
            ),
        )
        reject_prev.assert_awaited_once()
        advance.assert_not_awaited()


@pytest.mark.asyncio
async def test_reject_submitter_calls_advance_rejected():
    graph = _linear_graph()
    process = SimpleNamespace(nodes=graph)
    instance = SimpleNamespace(
        id=901,
        status="pending",
        current_node="n2",
        process=process,
        data={},
    )
    task = SimpleNamespace(
        uuid="task-uuid-2",
        node_id="n2",
        approver_id=200,
        status="pending",
        sign_type=None,
        parent_task_id=None,
        approval_instance=instance,
        action_at=None,
        comment=None,
    )
    task.save = AsyncMock()

    task_qs = MagicMock()
    task_qs.prefetch_related.return_value = task_qs
    task_qs.first = AsyncMock(return_value=task)

    with patch(
        "core.services.approval.approval_instance_service.ApprovalTask.filter",
        return_value=task_qs,
    ), patch.object(
        ApprovalInstanceService,
        "_check_node_completion",
        new=AsyncMock(return_value=(True, "rejected")),
    ), patch.object(
        ApprovalInstanceService,
        "reject_to_previous_approval_node",
        new=AsyncMock(),
    ) as reject_prev, patch.object(
        ApprovalInstanceService,
        "_advance_instance_after_node_completion",
        new=AsyncMock(return_value=instance),
    ) as advance:
        await ApprovalInstanceService.perform_task_action(
            tenant_id=1,
            task_uuid="task-uuid-2",
            user_id=200,
            action_data=ApprovalInstanceAction(
                action="reject",
                comment="退回制单",
                reject_target="submitter",
            ),
        )
        reject_prev.assert_not_awaited()
        advance.assert_awaited_once()
        assert advance.await_args.kwargs.get("instance_status") == "rejected" or (
            len(advance.await_args.args) >= 3 and advance.await_args.args[2] == "rejected"
        )
