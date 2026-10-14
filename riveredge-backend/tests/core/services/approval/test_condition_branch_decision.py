"""条件分支：双出边须前序审批显式选边，禁止默认跳节点3/4。"""

from types import SimpleNamespace

import pytest

from core.services.approval.approval_instance_service import ApprovalInstanceService
from infra.exceptions.exceptions import ValidationError


def _gm_branch_graph():
    return {
        "nodes": [
            {"id": "n2", "type": "approval", "data": {"label": "二级上级"}},
            {
                "id": "cond",
                "type": "condition",
                "data": {
                    "label": "是否总经理特批",
                    # 模拟设计器 ProFormDigit：无布尔值、甚至空 field——仍须出选择
                    "conditions": [
                        {"label": "分支1", "operator": ">="},
                        {"label": "分支2", "operator": ">="},
                    ],
                },
            },
            {"id": "gm", "type": "approval", "data": {"label": "总经理(特殊情况)"}},
            {"id": "vp", "type": "approval", "data": {"label": "采购副总"}},
        ],
        "edges": [
            {"source": "n2", "target": "cond"},
            {"source": "cond", "target": "gm"},
            {"source": "cond", "target": "vp"},
        ],
    }


def test_infer_decision_for_two_edge_condition_even_without_boolean_rules():
    graph = _gm_branch_graph()
    spec = ApprovalInstanceService._resolve_decision_on_approve_spec(graph, graph["nodes"][0])
    assert spec is not None
    assert spec["label"] == "是否总经理特批"
    assert spec["trueBranchLabel"] == "总经理(特殊情况)"
    assert spec["falseBranchLabel"] == "采购副总"
    assert spec["requireExplicit"] is True
    assert spec["conditionNodeId"] == "cond"


def test_route_key_true_goes_to_first_branch():
    graph = _gm_branch_graph()
    instance = SimpleNamespace(data={"__branch_true_cond": True})
    nxt = ApprovalInstanceService._get_next_node(graph, "cond", instance=instance)
    assert nxt is not None
    assert nxt["id"] == "gm"


def test_route_key_false_goes_to_last_branch():
    graph = _gm_branch_graph()
    instance = SimpleNamespace(data={"__branch_true_cond": False})
    nxt = ApprovalInstanceService._get_next_node(graph, "cond", instance=instance)
    assert nxt is not None
    assert nxt["id"] == "vp"


@pytest.mark.asyncio
async def test_apply_decision_requires_explicit_patch():
    graph = _gm_branch_graph()
    instance = SimpleNamespace(data={}, save=None)
    saved = {}

    async def _save(**kwargs):
        saved["data"] = dict(instance.data)

    instance.save = _save
    action = SimpleNamespace(instance_data_patch={})
    with pytest.raises(ValidationError, match="请选择"):
        await ApprovalInstanceService._apply_decision_on_approve(
            instance, "n2", graph, action
        )


@pytest.mark.asyncio
async def test_apply_decision_writes_route_key():
    graph = _gm_branch_graph()
    instance = SimpleNamespace(data={}, save=None)

    async def _save(**kwargs):
        pass

    instance.save = _save
    action = SimpleNamespace(instance_data_patch={"__branch_true_cond": True})
    # field 可能是业务字段或 route key；先用 resolve 的 field
    spec = ApprovalInstanceService._resolve_decision_on_approve_spec(graph, graph["nodes"][0])
    assert spec is not None
    action.instance_data_patch = {spec["field"]: True}
    await ApprovalInstanceService._apply_decision_on_approve(instance, "n2", graph, action)
    assert instance.data.get("__branch_true_cond") is True


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
            {
                "id": "cond",
                "type": "condition",
                "data": {
                    "label": "是否总经理特批",
                    "conditions": [{"field": "require_gm_special_approval", "operator": "==", "value": True}],
                },
            },
            {"id": "gm", "type": "approval", "data": {"label": "总经理"}},
            {"id": "vp", "type": "approval", "data": {"label": "副总"}},
        ],
        "edges": [
            {"source": "n2", "target": "cond"},
            {"source": "cond", "target": "gm"},
            {"source": "cond", "target": "vp"},
        ],
    }
    spec = ApprovalInstanceService._resolve_decision_on_approve_spec(graph, graph["nodes"][0])
    assert spec["field"] == "custom_flag"
