"""审批流查看者动作门控。"""

from types import SimpleNamespace

from core.services.approval.approval_viewer_actions import (
    build_flow_viewer_actions,
    viewer_has_pending_task_on_instance,
)


def test_viewer_has_pending_task_only_on_current_node():
    instance = SimpleNamespace(current_node="n1", status="pending")
    tasks = [
        SimpleNamespace(node_id="n1", approver_id=10, status="pending"),
        SimpleNamespace(node_id="n0", approver_id=10, status="pending"),
    ]
    assert viewer_has_pending_task_on_instance(viewer_id=10, instance=instance, tasks=tasks)
    assert not viewer_has_pending_task_on_instance(viewer_id=11, instance=instance, tasks=tasks)


def test_build_flow_viewer_actions_when_no_task():
    instance = SimpleNamespace(current_node="n1", status="pending")
    actions = build_flow_viewer_actions(
        viewer_id=99,
        instance=instance,
        tasks=[],
        nodes_overview=[
            {
                "is_current": True,
                "eligible_approvers": [{"user_id": 10, "name": "杨志伟"}],
            }
        ],
    )
    assert actions["approve"] is False
    assert "杨志伟" in (actions.get("block_reason") or "")


def test_block_reason_prefers_current_node_pending_tasks_over_stale_eligible():
    """节点已到 n2 时，文案须用 n2 pending 待办人，不能被上一节点可审名单带偏。"""
    instance = SimpleNamespace(current_node="n2", status="pending")
    actions = build_flow_viewer_actions(
        viewer_id=99,
        instance=instance,
        tasks=[
            SimpleNamespace(node_id="n1", approver_id=1, status="approved"),
            SimpleNamespace(node_id="n2", approver_id=2, status="pending"),
        ],
        nodes_overview=[
            {
                "is_current": False,
                "eligible_approvers": [{"user_id": 1, "name": "审核节点1"}],
            },
            {
                "is_current": True,
                "eligible_approvers": [{"user_id": 2, "name": "审核节点2"}],
            },
        ],
    )
    assert actions["approve"] is False
    assert actions["block_reason"] == "当前节点待办人：审核节点2"


def test_block_reason_ignores_stale_pending_not_in_eligible():
    """当前节点仍挂着上一节点人的 pending 时，文案跟可审名单（节点2），不指节点1。"""
    instance = SimpleNamespace(current_node="n2", status="pending")
    actions = build_flow_viewer_actions(
        viewer_id=99,
        instance=instance,
        tasks=[
            SimpleNamespace(node_id="n1", approver_id=1, status="pending"),
            SimpleNamespace(node_id="n2", approver_id=1, status="pending"),
        ],
        nodes_overview=[
            {
                "is_current": True,
                "eligible_approvers": [{"user_id": 2, "name": "审核节点2"}],
            },
        ],
    )
    assert actions["approve"] is False
    assert actions["block_reason"] == "当前节点待办人：审核节点2"


def test_block_reason_falls_back_to_eligible_when_only_prev_node_pending():
    instance = SimpleNamespace(current_node="n2", status="pending")
    actions = build_flow_viewer_actions(
        viewer_id=99,
        instance=instance,
        tasks=[
            SimpleNamespace(node_id="n1", approver_id=1, status="pending"),
        ],
        nodes_overview=[
            {
                "is_current": True,
                "eligible_approvers": [{"user_id": 2, "name": "审核节点2"}],
            },
        ],
    )
    assert actions["block_reason"] == "当前节点待办人：审核节点2"
