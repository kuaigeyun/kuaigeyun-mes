"""推进到条件节点时不得先钉死 current，避免缺选边留下死结。"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from core.services.approval.approval_instance_service import ApprovalInstanceService


@pytest.mark.asyncio
async def test_advance_to_condition_does_not_pre_pin_current_before_tasks():
    """下一节点是条件时：先 create_node_tasks，禁止先 save current=condition。"""
    graph = {
        "nodes": [
            {"id": "n2", "type": "approval"},
            {
                "id": "cond",
                "type": "condition",
                "data": {"label": "是否总经理特批", "routeMode": "initiator"},
            },
            {"id": "n3", "type": "approval"},
        ],
        "edges": [
            {"source": "n2", "target": "cond"},
            {"source": "cond", "target": "n3"},
        ],
    }
    save = AsyncMock()
    instance = SimpleNamespace(
        id=1,
        status="pending",
        current_node="n2",
        current_approver_id=10,
        completed_at=None,
        process=SimpleNamespace(nodes=graph),
        save=save,
        fetch_related=AsyncMock(),
    )
    create_calls: list = []

    async def _fake_create(tenant_id, inst, node, **kwargs):
        create_calls.append({"node_id": node.get("id"), "current": inst.current_node})
        # 模拟选边成功落到审批节点
        inst.current_node = "n3"
        return []

    with patch(
        "core.services.approval.approval_instance_service.ApprovalTask.filter",
        return_value=SimpleNamespace(update=AsyncMock(return_value=1)),
    ), patch.object(
        ApprovalInstanceService,
        "_get_next_node",
        return_value=graph["nodes"][1],
    ), patch.object(
        ApprovalInstanceService,
        "_create_node_tasks",
        new=AsyncMock(side_effect=_fake_create),
    ):
        await ApprovalInstanceService._advance_instance_after_node_completion(
            1, instance, "approved", route_action_by=10
        )

    assert create_calls, "须调用 _create_node_tasks"
    # 调用时 current 仍是完成节点，尚未被钉成 condition
    assert create_calls[0]["current"] == "n2"
    assert create_calls[0]["node_id"] == "cond"
    assert instance.current_node == "n3"


def test_initiator_condition_stuck_hint():
    graph = {
        "nodes": [
            {
                "id": "condition_gm",
                "type": "condition",
                "data": {"label": "是否总经理特批", "routeMode": "initiator"},
            },
            {"id": "n3", "type": "approval"},
            {"id": "n4", "type": "approval"},
        ],
        "edges": [
            {"source": "condition_gm", "target": "n3"},
            {"source": "condition_gm", "target": "n4"},
        ],
    }
    instance = SimpleNamespace(current_node="condition_gm", data={})
    hint = ApprovalInstanceService._initiator_condition_stuck_hint(instance, graph)
    assert hint is not None
    assert "是否总经理特批" in hint
    assert "撤回提交" in hint

    instance.data = {"__branch_index_condition_gm": 0}
    assert ApprovalInstanceService._initiator_condition_stuck_hint(instance, graph) is None
