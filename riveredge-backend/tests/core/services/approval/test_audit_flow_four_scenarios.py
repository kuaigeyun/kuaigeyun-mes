"""
审核流程四项优化：场景模拟（与客户反馈图1～图3 + 节点撤销规则对齐）。

| 场景 | 断言要点 |
|------|----------|
| 图1 制单人已提交 | submitter 无 pending → approve/reject=false |
| 当前节点待办 | 待办人 → approve/reject=true |
| 节点撤销 下一节点未审 | viewer_may_recall_own=true |
| 节点撤销 下一节点已审 | viewer_may_recall_own=false |
| 图2 终审重开 overview | 前序节点 approved，终审 pending |
| 图3 驳回重提 | capabilities submit/update + gate submit |
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from apps.kuaizhizao.services.document_action_policy.purchase_requisition import (
    derive_purchase_requisition_capabilities,
)
from core.services.approval.approval_flow_policy import (
    compute_viewer_flow_withdraw_revoke,
    viewer_may_recall_own_on_instance,
)
from core.services.approval.approval_instance_service import ApprovalInstanceService
from core.services.approval.approval_viewer_actions import build_flow_viewer_actions
from core.services.approval.audit_capability_gate import gate_audit_allowed_actions


def _linear_three_approval_graph() -> dict:
    return {
        "nodes": [
            {"id": "start", "type": "start"},
            {"id": "n1", "type": "approval", "data": {"label": "直接上级"}},
            {"id": "n2", "type": "approval", "data": {"label": "二级上级"}},
            {"id": "n3", "type": "approval", "data": {"label": "总经理"}},
            {"id": "end", "type": "end"},
        ],
        "edges": [
            {"source": "start", "target": "n1"},
            {"source": "n1", "target": "n2"},
            {"source": "n2", "target": "n3"},
            {"source": "n3", "target": "end"},
        ],
    }


class TestScenarioSubmitterAndAssignee:
    """图1：制单人 vs 当前待办人按钮门禁。"""

    def test_submitter_only_withdraw_semantics_via_viewer_actions(self):
        """制单人陈超：流程在 n1，待办是审核节点2 → 本人不可审/驳。"""
        instance = SimpleNamespace(
            current_node="n1", status="pending", submitter_id=100
        )
        actions = build_flow_viewer_actions(
            viewer_id=100,
            instance=instance,
            tasks=[SimpleNamespace(node_id="n1", approver_id=200, status="pending")],
            nodes_overview=[
                {
                    "is_current": True,
                    "eligible_approvers": [{"user_id": 200, "name": "审核节点2"}],
                }
            ],
        )
        assert actions["approve"] is False
        assert actions["reject"] is False
        assert "发起人" in (actions.get("block_reason") or "")

    def test_current_node_assignee_can_approve_reject(self):
        """当前节点待办人：审核、驳回可点（尚未通过本级，无 recall）。"""
        instance = SimpleNamespace(
            current_node="n1", status="pending", submitter_id=100
        )
        actions = build_flow_viewer_actions(
            viewer_id=200,
            instance=instance,
            tasks=[SimpleNamespace(node_id="n1", approver_id=200, status="pending")],
            nodes_overview=[
                {
                    "is_current": True,
                    "eligible_approvers": [{"user_id": 200, "name": "审核节点2"}],
                }
            ],
        )
        assert actions["approve"] is True
        assert actions["reject"] is True
        assert actions.get("my_acted") is not True


class TestScenarioRecallOwn:
    """第四条：节点级撤销审核（recall_own）。"""

    @staticmethod
    def _mock_approval_task_filter(*, n1_has_approved: bool, n2_has_approved: bool):
        def _filter(**kwargs):
            qs = MagicMock()
            node_id = kwargs.get("node_id")
            status = kwargs.get("status")
            if status == "approved" and "approver_id" in kwargs:
                qs.first = AsyncMock(
                    return_value=SimpleNamespace(node_id=node_id, status="approved")
                    if node_id == "n1" and n1_has_approved
                    else None
                )
            elif status == "approved" and node_id == "n2":
                qs.exists = AsyncMock(return_value=n2_has_approved)
            else:
                qs.first = AsyncMock(return_value=None)
                qs.exists = AsyncMock(return_value=False)
            return qs

        return _filter

    @pytest.mark.asyncio
    async def test_recall_allowed_when_next_approval_not_yet_approved(self):
        """n1 已通过、流程停在 n2 且 n2 尚无通过记录 → 可撤回本级。"""
        graph = _linear_three_approval_graph()
        instance = SimpleNamespace(id=1, current_node="n2", status="pending")
        with patch(
            "core.services.approval.approval_flow_policy.ApprovalTask.filter",
            side_effect=self._mock_approval_task_filter(
                n1_has_approved=True, n2_has_approved=False
            ),
        ):
            ok = await viewer_may_recall_own_on_instance(
                tenant_id=1,
                instance=instance,
                viewer_id=10,
                process_nodes=graph,
            )
        assert ok is True

    @pytest.mark.asyncio
    async def test_recall_blocked_when_next_approval_already_approved(self):
        """n1 已通过、下一节点 n2 已有通过记录 → 不可撤回 n1。"""
        graph = _linear_three_approval_graph()
        instance = SimpleNamespace(id=1, current_node="n2", status="pending")
        with patch(
            "core.services.approval.approval_flow_policy.ApprovalTask.filter",
            side_effect=self._mock_approval_task_filter(
                n1_has_approved=True, n2_has_approved=True
            ),
        ):
            ok = await viewer_may_recall_own_on_instance(
                tenant_id=1,
                instance=instance,
                viewer_id=10,
                process_nodes=graph,
            )
        assert ok is False


class TestScenarioReopenOverview:
    """图2：终审撤销重开后节点执行记录。"""

    @pytest.mark.asyncio
    async def test_prior_approved_nodes_still_approved_after_reopen(self):
        graph = _linear_three_approval_graph()
        process = SimpleNamespace(nodes=graph)
        instance = SimpleNamespace(
            id=200,
            status="pending",
            current_node="n3",
            submitter_id=1,
            data={"reopened_from_instance_id": 100},
        )
        tasks = [
            SimpleNamespace(
                approval_instance_id=100,
                node_id="n1",
                approver_id=10,
                status="approved",
                action_at=None,
                comment=None,
            ),
            SimpleNamespace(
                approval_instance_id=100,
                node_id="n2",
                approver_id=11,
                status="approved",
                action_at=None,
                comment=None,
            ),
            SimpleNamespace(
                approval_instance_id=200,
                node_id="n3",
                approver_id=12,
                status="pending",
                action_at=None,
                comment=None,
            ),
        ]
        history: list = []

        async def _empty_map(_tid, _uids):
            return {u: str(u) for u in _uids}

        with patch.object(
            ApprovalInstanceService,
            "_resolve_node_approvers",
            new=AsyncMock(return_value=[]),
        ), patch.object(
            ApprovalInstanceService,
            "_user_display_map",
            new=AsyncMock(side_effect=_empty_map),
        ):
            overview = await ApprovalInstanceService._build_nodes_overview(
                tenant_id=1,
                process=process,
                instance=instance,
                tasks=tasks,
                history=history,
            )

        by_id = {row["node_id"]: row for row in overview}
        assert by_id["n1"]["status"] == "approved"
        assert by_id["n2"]["status"] == "approved"
        assert by_id["n3"]["status"] == "pending"
        assert by_id["n3"]["is_current"] is True


class TestScenarioRejectedResubmit:
    """图3：驳回后可编辑、重新提交。"""

    def test_purchase_requisition_rejected_capabilities(self):
        req = SimpleNamespace(status="已驳回")
        caps = derive_purchase_requisition_capabilities(req)
        assert caps.update.allowed is True
        assert caps.submit.allowed is True

    def test_audit_gate_preserves_submit_on_rejected_phase(self):
        audit = {"phase": "rejected", "allowed_actions": ["submit"]}
        caps = {"submit": {"allowed": False}}
        out = gate_audit_allowed_actions(audit, caps)
        assert out is not None
        assert "submit" in out["allowed_actions"]

    @pytest.mark.asyncio
    async def test_submitter_withdraw_after_resubmit_ignores_prior_instance_approves(self):
        """驳回重提新建实例：旧轮 approve 不得阻断本轮撤回提交。"""
        graph = {
            "nodes": [
                {"id": "start", "type": "start"},
                {
                    "id": "n1",
                    "type": "approval",
                    "data": {
                        "allowSubmitterWithdraw": True,
                        "submitterWithdrawOnlyBeforeAnyApprove": True,
                    },
                },
                {"id": "end", "type": "end"},
            ],
            "edges": [{"source": "start", "target": "n1"}, {"source": "n1", "target": "end"}],
        }
        pending_instance = SimpleNamespace(
            id=200,
            status="pending",
            submitter_id=100,
            current_node="n1",
        )
        mixed_history = [
            SimpleNamespace(approval_instance_id=100, action="approve", action_by=200),
            SimpleNamespace(approval_instance_id=100, action="reject", action_by=200),
            SimpleNamespace(approval_instance_id=200, action="submit", action_by=100),
        ]
        with patch(
            "core.services.approval.approval_flow_policy.viewer_may_recall_own_on_instance",
            new=AsyncMock(return_value=False),
        ):
            flags = await compute_viewer_flow_withdraw_revoke(
                tenant_id=1,
                viewer_id=100,
                instance=pending_instance,
                process_nodes=graph,
                history=mixed_history,
            )
        assert flags["viewer_can_withdraw_submit"] is True
