"""撤回本级须保留发起人选边，且不得清掉撤回人的 pending。"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.services.approval.approval_flow_policy import (
    next_approval_node_id_on_instance_path,
    previous_approval_node_id_on_instance_path,
)
from core.services.approval.approval_instance_service import ApprovalInstanceService


def _graph_with_initiator_condition() -> dict:
    return {
        "nodes": [
            {"id": "start", "type": "start"},
            {"id": "n1", "type": "approval", "data": {"label": "一级"}},
            {"id": "n2", "type": "approval", "data": {"label": "二级"}},
            {
                "id": "cond",
                "type": "condition",
                "data": {
                    "label": "是否总经理特批",
                    "routeMode": "initiator",
                    "conditions": [
                        {"field": "x", "operator": "==", "value": True, "label": "是"},
                        {"field": "x", "operator": "==", "value": False, "label": "否"},
                    ],
                },
            },
            {"id": "n3", "type": "approval", "data": {"label": "总经理"}},
            {"id": "n4", "type": "approval", "data": {"label": "采购副总"}},
            {"id": "end", "type": "end"},
        ],
        "edges": [
            {"source": "start", "target": "n1"},
            {"source": "n1", "target": "n2"},
            {"source": "n2", "target": "cond"},
            {"source": "cond", "target": "n3"},
            {"source": "cond", "target": "n4"},
            {"source": "n3", "target": "n4"},
            {"source": "n4", "target": "end"},
        ],
    }


def test_recall_keeps_initiator_branch_index():
    graph = _graph_with_initiator_condition()
    data = {
        "entity_type": "purchase_request",
        "entity_id": 40,
        "__branch_index_cond": 1,
        "__branch_decided_by": 99,
    }
    out = ApprovalInstanceService._strip_branch_keys_after_recall(data, graph, "n2")
    assert out.get("__branch_index_cond") == 1
    assert "__branch_decided_by" not in out or out.get("__branch_decided_by") is None


def test_recall_at_gm_keeps_initiator_branch():
    """在总经理(特殊情况)节点撤回本级：须保留发起人选边，不得清掉导致流程断开。"""
    graph = _graph_with_initiator_condition()
    data = {
        "entity_type": "purchase_request",
        "entity_id": 40,
        "__branch_index_cond": 0,
    }
    out = ApprovalInstanceService._strip_branch_keys_after_recall(data, graph, "n3")
    assert out.get("__branch_index_cond") == 0


def test_recall_strips_previous_approver_branch_downstream():
    graph = _graph_with_initiator_condition()
    # 改成 previous_approver
    for n in graph["nodes"]:
        if n["id"] == "cond":
            n["data"]["routeMode"] = "previous_approver"
    data = {"__branch_index_cond": 0, "entity_id": 1}
    out = ApprovalInstanceService._strip_branch_keys_after_recall(data, graph, "n2")
    assert "__branch_index_cond" not in out


def test_get_next_node_stop_on_missing_initiator_branch():
    graph = _graph_with_initiator_condition()
    instance = SimpleNamespace(data={})
    nxt = ApprovalInstanceService._get_next_node(
        graph, "cond", instance=instance, on_missing_branch="stop"
    )
    assert nxt is None


def test_path_helpers_stop_when_initiator_branch_missing():
    """缺选边时路径辅助不得 raise（否则审核弹窗变未绑定）。"""
    graph = _graph_with_initiator_condition()
    instance = SimpleNamespace(data={}, id=1)
    assert (
        next_approval_node_id_on_instance_path(graph, "n2", instance) is None
    )
    assert previous_approval_node_id_on_instance_path(graph, "n3", instance) is None


@pytest.mark.asyncio
async def test_restore_initiator_branch_from_condition_route_history():
    graph = _graph_with_initiator_condition()
    instance = SimpleNamespace(
        id=7,
        data={"entity_id": 1},
        save=AsyncMock(),
    )
    route_hist = SimpleNamespace(
        action="condition_route",
        from_node="cond",
        to_node="n3",
        action_at=None,
    )

    class _QS:
        def order_by(self, *args):
            return self

        async def all(self):
            return [route_hist]

    with patch(
        "core.services.approval.approval_instance_service.ApprovalHistory.filter",
        return_value=_QS(),
    ):
        changed = await ApprovalInstanceService._restore_missing_initiator_branches_from_history(
            1, instance, graph
        )

    assert changed is True
    assert instance.data.get("__branch_index_cond") == 0
    instance.save.assert_awaited()
