"""单据提交启审批 / 审核前校验 pending 实例（与销售订单试点同一契约）。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from infra.exceptions.exceptions import BusinessLogicError


async def start_document_approval_or_raise(
    *,
    tenant_id: int,
    user_id: int,
    node_key: str,
    entity_type: str,
    entity_id: int,
    entity_uuid: str,
    title: str,
    content: str,
    doc_label: str,
    send_notification: bool = True,
    selected_approver_user_ids: Optional[List[int]] = None,
    selected_approver_by_node: Optional[Dict[str, List[int]]] = None,
) -> Any:
    """审核已开时必须创建审批实例；失败即暴露，禁止空壳待审。"""
    from core.services.approval.approval_instance_service import ApprovalInstanceService

    instance = await ApprovalInstanceService.start_approval_for_node(
        tenant_id=tenant_id,
        user_id=user_id,
        node_key=node_key,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_uuid=str(entity_uuid),
        title=title,
        content=content,
        send_notification=send_notification,
        selected_approver_user_ids=selected_approver_user_ids,
        selected_approver_by_node=selected_approver_by_node,
    )
    if not instance:
        raise BusinessLogicError(
            f"{doc_label}审核已开启但未找到可用的审批流程，"
            f"请在配置中心检查 {node_key} 审批流程是否已激活"
        )
    return instance


async def get_approval_gate_status(
    *,
    tenant_id: int,
    entity_type: str,
    entity_id: int,
) -> dict:
    """读取审批实例门控：pending / 已通过 / 已驳回。"""
    from core.services.approval.approval_instance_service import ApprovalInstanceService

    approval_status = await ApprovalInstanceService.get_approval_status(
        tenant_id=tenant_id,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    has_instance = bool(approval_status.get("has_instance"))
    status = approval_status.get("status")
    return {
        "approval_status": approval_status,
        "has_pending_flow": has_instance and status == "pending",
        "flow_completed_approved": has_instance and status == "approved",
        "flow_completed_rejected": has_instance and status == "rejected",
    }


def assert_manual_approval_action_allowed(
    gate: dict,
    *,
    doc_label: str,
    verb: str = "审核",
    is_auto_approve: bool = False,
) -> None:
    """
    人工审核/驳回前校验。
    流程已结束但单据仍待审时允许补齐写回（空审批人 auto_pass / 完成回调曾失败）。
    """
    if is_auto_approve:
        return
    if gate.get("has_pending_flow"):
        return
    if verb == "审核" and gate.get("flow_completed_approved"):
        return
    if verb == "驳回" and gate.get("flow_completed_rejected"):
        return
    # 反审核补齐：实例已结束但单据仍待审/待撤时允许业务写回（对齐 approve/reject）
    if verb in ("反审核", "revoke") and (
        gate.get("flow_completed_approved") or gate.get("flow_completed_rejected")
    ):
        return
    raise BusinessLogicError(
        f"{doc_label}审核已开启但无进行中的审批流程，请先提交审批后再{verb}"
    )


def should_sync_doc_after_flow_completed(gate: dict, *, approve: bool) -> bool:
    """流程实例已结束、单据仍待审时直接走业务写回，避免重复 execute_approval。"""
    if approve:
        return bool(gate.get("flow_completed_approved"))
    return bool(gate.get("flow_completed_rejected"))


def approval_instance_finished_on_submit(instance: Any) -> bool:
    """提交瞬间 auto_pass 等导致实例已通过（单据可能尚未落待审）。"""
    return getattr(instance, "status", None) == "approved"


def approval_instance_rejected_on_submit(instance: Any) -> bool:
    return getattr(instance, "status", None) == "rejected"


async def assert_pending_approval_instance(
    *,
    tenant_id: int,
    entity_type: str,
    entity_id: int,
    audit_required: bool,
    doc_label: str,
    verb: str = "审核",
    is_auto_approve: bool = False,
) -> None:
    """审核已开时须存在 pending 审批实例，或允许已结束流程补齐写回。"""
    if not audit_required or is_auto_approve:
        return
    gate = await get_approval_gate_status(
        tenant_id=tenant_id,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    assert_manual_approval_action_allowed(
        gate,
        doc_label=doc_label,
        verb=verb,
    )
