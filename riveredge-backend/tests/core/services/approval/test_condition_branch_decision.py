"""条件分支：无命中走 else；前序审批可从下一条件节点推导决策开关。"""

from types import SimpleNamespace

from core.services.approval.approval_instance_service import ApprovalInstanceService


def test_evaluate_conditions_unmatched_returns_sentinel():
    instance = SimpleNamespace(data={})
    conditions = [
        {"field": "require_gm_special_approval", "operator": "==", "value": True},
        {"field": "require_gm_special_approval", "operator": "==", "value": False},
    ]
    assert ApprovalInstanceService._evaluate_conditions(instance, conditions) == -1


def test_get_next_node_unmatched_uses_last_edge():
    graph = {
        "nodes": [
            {"id": "cond", "type": "condition", "data": {
                "label": "是否总经理特批",
                "conditions": [
                    {"field": "require_gm_special_approval", "operator": "==", "value": True},
                    {"field": "require_gm_special_approval", "operator": "==", "value": False},
                ],
            }},
            {"id": "gm", "type": "approval", "data": {"label": "总经理"}},
            {"id": "vp", "type": "approval", "data": {"label": "采购副总"}},
        ],
        "edges": [
            {"source": "cond", "target": "gm"},
            {"source": "cond", "target": "vp"},
        ],
    }
    instance = SimpleNamespace(data={})
    nxt = ApprovalInstanceService._get_next_node(graph, "cond", instance=instance)
    assert nxt is not None
    assert nxt["id"] == "vp"


def test_get_next_node_true_takes_first_edge():
    graph = {
        "nodes": [
            {"id": "cond", "type": "condition", "data": {
                "conditions": [
                    {"field": "require_gm_special_approval", "operator": "==", "value": True},
                    {"field": "require_gm_special_approval", "operator": "==", "value": False},
                ],
            }},
            {"id": "gm", "type": "approval", "data": {}},
            {"id": "vp", "type": "approval", "data": {}},
        ],
        "edges": [
            {"source": "cond", "target": "gm"},
            {"source": "cond", "target": "vp"},
        ],
    }
    instance = SimpleNamespace(data={"require_gm_special_approval": True})
    nxt = ApprovalInstanceService._get_next_node(graph, "cond", instance=instance)
    assert nxt is not None
    assert nxt["id"] == "gm"


def test_infer_decision_from_next_boolean_condition():
    graph = {
        "nodes": [
            {"id": "n2", "type": "approval", "data": {"label": "二级上级"}},
            {"id": "cond", "type": "condition", "data": {
                "label": "是否总经理特批",
                "conditions": [
                    {"field": "require_gm_special_approval", "operator": "==", "value": True},
                    {"field": "require_gm_special_approval", "operator": "==", "value": False},
                ],
            }},
            {"id": "gm", "type": "approval", "data": {}},
        ],
        "edges": [
            {"source": "n2", "target": "cond"},
            {"source": "cond", "target": "gm"},
        ],
    }
    n2 = graph["nodes"][0]
    spec = ApprovalInstanceService._resolve_decision_on_approve_spec(graph, n2)
    assert spec is not None
    assert spec["field"] == "require_gm_special_approval"
    assert spec["label"] == "是否总经理特批"
    assert spec["defaultValue"] is False


def test_explicit_decision_on_approve_wins_over_infer():
    graph = {
        "nodes": [
            {
                "id": "n2",
                "type": "approval",
                "data": {
                    "decisionOnApprove": {
                        "field": "custom_flag",
                        "label": "自定义",
                        "defaultValue": True,
                    }
                },
            },
            {"id": "cond", "type": "condition", "data": {
                "label": "是否总经理特批",
                "conditions": [
                    {"field": "require_gm_special_approval", "operator": "==", "value": True},
                ],
            }},
        ],
        "edges": [{"source": "n2", "target": "cond"}],
    }
    spec = ApprovalInstanceService._resolve_decision_on_approve_spec(graph, graph["nodes"][0])
    assert spec["field"] == "custom_flag"
    assert spec["defaultValue"] is True
