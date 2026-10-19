"""
统一审核生命周期服务。

提供 submit/approve/reject/revoke/withdraw 的统一门面，优先走平台审批流，
未启用流程时回落到业务单据原有状态流转。
"""

from __future__ import annotations

import inspect
from typing import Any, Awaitable, Callable, Dict, Optional

from core.services.approval.approval_instance_service import ApprovalInstanceService


SubmitCallback = Callable[[], Awaitable[Any]]
ActionCallback = Callable[..., Awaitable[Any]]


def _callback_accepts_kwarg(callback: Callable[..., Any], name: str) -> bool:
    try:
        params = inspect.signature(callback).parameters
    except (TypeError, ValueError):
        return False
    if name in params:
        return True
    return any(p.kind == inspect.Parameter.VAR_KEYWORD for p in params.values())


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
    async def _has_pending_flow_instance(
        *,
        tenant_id: int,
        entity_type: str,
        entity_id: int,
    ) -> bool:
        """
        审核/驳回前只读是否仍有 pending 实例。

        禁止调用 get_approval_status：其 bootstrap/reconcile 可能在投票前推进节点并取消待办，
        多级审核第二级会出现「第一次点击被吃掉、第二次才生效」。
        """
        instance = await ApprovalInstanceService.get_instance_by_entity(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        return bool(instance and instance.status == "pending")

    @staticmethod
    async def approve_with_flow_fallback(
        *,
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        approver_id: int,
        flow_approve: ActionCallback,
        instance_data_patch: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """
        审核通过统一入口。
        若存在待审批流程任务，则先执行流程任务；最终状态落库仍由业务回调处理。
        """
        if await UniAuditService._has_pending_flow_instance(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
        ):
            # execute_approval 完成实例后会触发完成回调，由回调执行业务写回（单一写回路径）。
            # 此处不得再调用 flow_approve，否则与回调重复写回（双写副作用，如重复下推）。
            await ApprovalInstanceService.execute_approval(
                tenant_id=tenant_id,
                entity_type=entity_type,
                entity_id=entity_id,
                approver_id=approver_id,
                approved=True,
                comment=None,
                instance_data_patch=instance_data_patch,
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
        reject_target: Optional[str] = None,
    ) -> Any:
        """驳回统一入口。"""
        if await UniAuditService._has_pending_flow_instance(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
        ):
            from core.services.approval.audit_reject_context import (
                get_reject_target,
                normalize_reject_target,
            )

            target = normalize_reject_target(reject_target) or get_reject_target()
            # 同 approve：终态驳回时完成回调为单一写回路径；驳回到上一级不写回业务终态。
            await ApprovalInstanceService.execute_approval(
                tenant_id=tenant_id,
                entity_type=entity_type,
                entity_id=entity_id,
                approver_id=approver_id,
                approved=False,
                comment=reason,
                reject_target=target,
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
        admin_bypass: bool = False,
        has_revoke_permission: bool = True,
    ) -> Any:
        """反审核统一入口。

        回调若声明 ``reopened``：有已通过流程则重开终审节点，并把是否成功传给回调
        （采购申请/销售订单据此落 pending）。其余单据仍只取消 pending 后走原草稿落点。
        """
        from core.services.approval.approval_flow_policy import (
            assert_revoke_allowed_for_viewer,
            resolve_final_approval_context,
            should_reopen_on_revoke,
        )

        await assert_revoke_allowed_for_viewer(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
            operator_id=operator_id,
            admin_bypass=admin_bypass,
            has_revoke_permission=has_revoke_permission,
        )

        accepts_reopened = _callback_accepts_kwarg(flow_revoke, "reopened")
        reopened = False
        if accepts_reopened:
            entity_instances = await ApprovalInstanceService._list_instances_by_entity(
                tenant_id, entity_type, entity_id
            )
            approved = next((i for i in entity_instances if i.status == "approved"), None)
            last_node_id = None
            process_nodes = {}
            if approved:
                process = approved.process
                if not process:
                    await approved.fetch_related("process")
                    process = approved.process
                if process:
                    process_nodes = process.nodes or {}
                last_node_id, _ = await resolve_final_approval_context(tenant_id, approved)
            if should_reopen_on_revoke(process_nodes, last_node_id):
                reopened_inst = await ApprovalInstanceService.reopen_at_last_approval_node(
                    tenant_id=tenant_id,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    operator_id=operator_id,
                )
                reopened = bool(reopened_inst)
        if not reopened:
            await ApprovalInstanceService.cancel_approval(
                tenant_id=tenant_id,
                entity_type=entity_type,
                entity_id=entity_id,
                operator_id=operator_id,
            )
        if accepts_reopened:
            return await flow_revoke(reopened=reopened)
        return await flow_revoke()

    @staticmethod
    async def withdraw_with_flow_fallback(
        *,
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        operator_id: int,
        flow_withdraw: ActionCallback,
        admin_bypass: bool = False,
    ) -> Any:
        """提交撤回统一入口。"""
        from core.services.approval.approval_flow_policy import assert_submitter_withdraw_allowed

        await assert_submitter_withdraw_allowed(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
            operator_id=operator_id,
            admin_bypass=admin_bypass,
        )
        await ApprovalInstanceService.cancel_approval(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
            operator_id=operator_id,
        )
        return await flow_withdraw()

