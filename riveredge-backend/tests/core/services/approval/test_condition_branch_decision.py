"""条件分支：双出边须前序审批显式选边，禁止默认跳节点3/4。"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

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
                    "routeMode": "previous_approver",
                    "conditions": [
                        {"label": "是（需总经理特批）"},
                        {"label": "否（直接采购副总）"},
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


def _bridge_auto_pass_graph():
    """直接上级 → 空审批人二级上级(auto_pass) → previous_approver 条件。"""
    return {
        "nodes": [
            {"id": "n1", "type": "approval", "data": {"label": "直接上级"}},
            {
                "id": "n2",
                "type": "approval",
                "data": {
                    "label": "二级上级",
                    "approverType": "manager",
                    "emptyApproverPolicy": "auto_pass",
                },
            },
            {
                "id": "cond",
                "type": "condition",
                "data": {
                    "label": "是否总经理特批",
                    "routeMode": "previous_approver",
                    "conditions": [
                        {"label": "是（需总经理特批）"},
                        {"label": "否（直接采购副总）"},
                    ],
                },
            },
            {"id": "gm", "type": "approval", "data": {"label": "总经理(特殊情况)"}},
            {"id": "vp", "type": "approval", "data": {"label": "采购副总"}},
        ],
        "edges": [
            {"source": "n1", "target": "n2"},
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
    assert spec["trueBranchLabel"] == "是（需总经理特批）"
    assert spec["falseBranchLabel"] == "否（直接采购副总）"
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


def test_dual_branch_without_route_key_does_not_silent_else():
    """双出边人工选边：缺 __branch_true_* 时禁止静默走否/else。"""
    graph = _gm_branch_graph()
    instance = SimpleNamespace(data={})
    with pytest.raises(ValidationError, match="请先由前序审批人选择"):
        ApprovalInstanceService._get_next_node(graph, "cond", instance=instance)


def test_strip_branch_decision_keys_clears_route_and_decided_by():
    data = {
        "entity_id": 1,
        "__branch_true_cond": False,
        ApprovalInstanceService.BRANCH_DECIDED_BY_KEY: 9,
        "total_amount": 12,
    }
    cleaned = ApprovalInstanceService._strip_branch_decision_keys(data)
    assert "__branch_true_cond" not in cleaned
    assert ApprovalInstanceService.BRANCH_DECIDED_BY_KEY not in cleaned
    assert cleaned["entity_id"] == 1
    assert cleaned["total_amount"] == 12


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
            1, instance, "n2", graph, action
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
    await ApprovalInstanceService._apply_decision_on_approve(1, instance, "n2", graph, action)
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
                    "routeMode": "previous_approver",
                    "conditions": [
                        {"label": "是"},
                        {"label": "否"},
                    ],
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
    assert spec is not None
    assert spec["field"] == "__branch_index_cond"
    assert spec["label"] == "自定义"
    assert spec["defaultValue"] == 0


@pytest.mark.asyncio
async def test_condition_route_action_by_uses_last_approver_not_submitter():
    instance = SimpleNamespace(id=7, submitter_id=100, current_approver_id=None, data={})
    last_task = SimpleNamespace(approver_id=22)
    qs = MagicMock()
    qs.filter.return_value = qs
    qs.order_by.return_value.first = AsyncMock(return_value=last_task)
    with patch(
        "core.services.approval.approval_instance_service.ApprovalTask.filter",
        return_value=qs,
    ):
        actor = await ApprovalInstanceService._resolve_condition_route_action_by(1, instance)
    assert actor == 22


@pytest.mark.asyncio
async def test_condition_route_action_by_prefers_decided_by_and_explicit():
    instance = SimpleNamespace(
        id=7,
        submitter_id=100,
        current_approver_id=None,
        data={ApprovalInstanceService.BRANCH_DECIDED_BY_KEY: 33},
    )
    actor = await ApprovalInstanceService._resolve_condition_route_action_by(1, instance)
    assert actor == 33
    actor2 = await ApprovalInstanceService._resolve_condition_route_action_by(
        1, instance, preferred_user_id=44
    )
    assert actor2 == 44


@pytest.mark.asyncio
async def test_apply_decision_persists_decided_by():
    graph = _gm_branch_graph()
    instance = SimpleNamespace(data={}, save=None)

    async def _save(**kwargs):
        pass

    instance.save = _save
    spec = ApprovalInstanceService._resolve_decision_on_approve_spec(graph, graph["nodes"][0])
    action = SimpleNamespace(instance_data_patch={spec["field"]: True})
    await ApprovalInstanceService._apply_decision_on_approve(
        1, instance, "n2", graph, action, decided_by=22
    )
    assert instance.data.get(ApprovalInstanceService.BRANCH_DECIDED_BY_KEY) == 22


@pytest.mark.asyncio
async def test_bridge_auto_pass_shows_branch_decision_on_prior_approver():
    """空审批人中间节点自动跳过时，分支仍由上一有人的审批节点选择。"""
    graph = _bridge_auto_pass_graph()
    instance = SimpleNamespace(data={}, submitter_id=10)
    with patch.object(
        ApprovalInstanceService,
        "_resolve_node_approvers",
        new=AsyncMock(return_value=[]),
    ):
        spec = await ApprovalInstanceService._resolve_decision_on_approve_spec_for_instance(
            1, graph, graph["nodes"][0], instance
        )
    assert spec is not None
    assert spec["label"] == "是否总经理特批"
    assert spec["conditionNodeId"] == "cond"


def test_condition_route_history_belongs_to_condition_node_only():
    """条件分支履历挂 from_node，不因 to_node 冒到目标审批节点。"""
    rows = [
        SimpleNamespace(from_node="cond", to_node="gm", action="condition_route"),
        SimpleNamespace(from_node="gm", to_node=None, action="approve"),
    ]

    def belongs(node_id: str, h) -> bool:
        return h.from_node == node_id or (
            h.to_node == node_id
            and ApprovalInstanceService._normalize_execution_action(h.action) != "condition_route"
        )

    assert [h.action for h in rows if belongs("cond", h)] == ["condition_route"]
    assert [h.action for h in rows if belongs("gm", h)] == ["approve"]
