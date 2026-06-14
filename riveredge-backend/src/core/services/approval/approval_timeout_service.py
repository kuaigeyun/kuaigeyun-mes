"""审批任务超时扫描与升级。"""

from __future__ import annotations

from datetime import datetime

from loguru import logger

from core.models.approval_history import ApprovalHistory
from core.models.approval_task import ApprovalTask
from core.services.approval.approval_instance_service import ApprovalInstanceService


class ApprovalTimeoutService:
    @staticmethod
    async def scan_and_escalate(limit: int = 200) -> int:
        """扫描已过期 pending 任务，写 timeout_escalate 历史并通知。"""
        now = datetime.now()
        tasks = (
            await ApprovalTask.filter(
                status="pending",
                due_at__not_isnull=True,
                due_at__lt=now,
            )
            .prefetch_related("approval_instance")
            .limit(limit)
            .all()
        )
        handled = 0
        for task in tasks:
            inst = task.approval_instance
            if not inst or inst.status != "pending":
                continue
            exists = await ApprovalHistory.filter(
                tenant_id=task.tenant_id,
                approval_instance_id=inst.id,
                action="timeout_escalate",
                from_node=task.node_id,
                action_by=task.approver_id,
            ).exists()
            if exists:
                continue
            await ApprovalHistory.create(
                tenant_id=task.tenant_id,
                approval_instance_id=inst.id,
                action="timeout_escalate",
                action_by=task.approver_id,
                action_at=now,
                comment="审批任务已超时",
                from_node=task.node_id,
                to_node=task.node_id,
            )
            try:
                await ApprovalInstanceService._send_urge_notification(
                    tenant_id=task.tenant_id,
                    instance=inst,
                    approver_ids=[task.approver_id],
                    comment="审批任务已超时，请尽快处理",
                )
            except Exception as exc:
                logger.warning("超时通知失败 task={}: {}", task.id, exc)
            handled += 1
        return handled
