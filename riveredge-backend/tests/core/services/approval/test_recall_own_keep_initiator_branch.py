"""撤回本级须保留发起人选边，且不得清掉撤回人的 pending。"""

from __future__ import annotations

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
            {"id": "end", "type": "end"},
        ],
        "edges": [
            {"source": "start", "target": "n1"},
            {"source": "n1", "target": "n2"},
            {"source": "n2", "target": "cond"},
            {"source": "cond", "target": "n3"},
            {"source": "cond", "target": "end"},
            {"source": "n3", "target": "end"},
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
    from types import SimpleNamespace

    instance = SimpleNamespace(data={})
    nxt = ApprovalInstanceService._get_next_node(
        graph, "cond", instance=instance, on_missing_branch="stop"
    )
    assert nxt is None
