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
