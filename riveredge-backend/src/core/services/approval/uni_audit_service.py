"""
统一审核生命周期服务。

提供 submit/approve/reject/revoke/withdraw 的统一门面，优先走平台审批流，
未启用流程时回落到业务单据原有状态流转。
"""

from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict, Optional

from core.services.approval.approval_instance_service import ApprovalInstanceService


SubmitCallback = Callable[[], Awaitable[Any]]
ActionCallback = Callable[..., Awaitable[Any]]


class UniAuditService:
    """单据审核统一门面。"""

    @staticmethod
    async def submit_with_flow_fallback(
        *,
        submitter_id: int,
        flow_submit: SubmitCallback,
    ) -> Any:
        """提交动作统一入口。"""
        return await flow_submit()

    @staticmethod
    async def approve_with_flow_fallback(
        *,
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        approver_id: int,
        flow_approve: ActionCallback,
    ) -> Any:
        """
        审核通过统一入口。
        若存在待审批流程任务，则先执行流程任务；最终状态落库仍由业务回调处理。
        """
        approval_status = await ApprovalInstanceService.get_approval_status(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        has_pending_flow = approval_status.get("has_flow") and approval_status.get("status") == "pending"
        if has_pending_flow:
            # execute_approval 完成实例后会触发完成回调，由回调执行业务写回（单一写回路径）。
            # 此处不得再调用 flow_approve，否则与回调重复写回（双写副作用，如重复下推）。
            await ApprovalInstanceService.execute_approval(
                tenant_id=tenant_id,
                entity_type=entity_type,
                entity_id=entity_id,
                approver_id=approver_id,
                approved=True,
                comment=None,
            )
            return None
        return await flow_approve()

    @staticmethod
    async def reject_with_flow_fallback(
        *,
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        approver_id: int,
        reason: Optional[str],
        flow_reject: ActionCallback,
    ) -> Any:
        """驳回统一入口。"""
        approval_status = await ApprovalInstanceService.get_approval_status(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        has_pending_flow = approval_status.get("has_flow") and approval_status.get("status") == "pending"
        if has_pending_flow:
            # 同 approve：完成回调为单一写回路径，避免双写。
            await ApprovalInstanceService.execute_approval(
                tenant_id=tenant_id,
                entity_type=entity_type,
                entity_id=entity_id,
                approver_id=approver_id,
                approved=False,
                comment=reason,
            )
            return None
        return await flow_reject(reason)

    @staticmethod
    async def revoke_with_flow_fallback(
        *,
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        operator_id: int,
        flow_revoke: ActionCallback,
    ) -> Any:
        """反审核统一入口：优先撤销 pending 的流程实例。"""
        await ApprovalInstanceService.cancel_approval(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
            operator_id=operator_id,
        )
        return await flow_revoke()

    @staticmethod
    async def withdraw_with_flow_fallback(
        *,
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        operator_id: int,
        flow_withdraw: ActionCallback,
    ) -> Any:
        """提交撤回统一入口。"""
        await ApprovalInstanceService.cancel_approval(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
            operator_id=operator_id,
        )
        return await flow_withdraw()

