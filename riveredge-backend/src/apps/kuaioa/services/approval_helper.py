"""轻办公审批流辅助。"""

from __future__ import annotations

from typing import Any, Optional

from loguru import logger


AUDIT_NODE_FORM_REQUEST = "kuaioa_form_request"
AUDIT_NODE_ASSET_PURCHASE = "kuaioa_asset_purchase"
AUDIT_NODE_LEAVE = "kuaioa_leave"
AUDIT_NODE_SEAL = "kuaioa_seal"
AUDIT_NODE_SPECIAL_PRICE = "kuaioa_special_price"
AUDIT_NODE_CONCESSION = "kuaioa_concession"
AUDIT_NODE_PROCESS_DEVIATION = "kuaioa_process_deviation"


async def is_audit_required(tenant_id: int, node_key: str) -> bool:
    from infra.services.business_config_service import BusinessConfigService

    return await BusinessConfigService().check_audit_required(tenant_id, node_key)


async def start_approval(
    tenant_id: int,
    *,
    node_key: str,
    entity_type: str,
    entity_id: int,
    entity_uuid: str,
    title: str,
    content: str,
    submitter_id: int,
) -> None:
    from core.services.approval.approval_instance_service import ApprovalInstanceService
    from infra.exceptions.exceptions import ValidationError

    instance = await ApprovalInstanceService.start_approval_for_node(
        tenant_id=tenant_id,
        user_id=submitter_id,
        node_key=node_key,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_uuid=entity_uuid,
        title=title,
        content=content,
    )
    if not instance:
        raise ValidationError(
            f"审核已开启但未找到可用的审批流程，请在配置中心检查 {node_key} 审批流程是否已激活"
        )


async def cancel_approval(
    tenant_id: int,
    *,
    entity_type: str,
    entity_id: int,
    operator_id: int,
) -> None:
    from core.services.approval.approval_instance_service import ApprovalInstanceService

    try:
        await ApprovalInstanceService.cancel_approval(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
            operator_id=operator_id,
        )
    except Exception as exc:
        logger.warning(
            "cancel kuaioa approval failed entity_type={} entity_id={}: {}",
            entity_type,
            entity_id,
            exc,
        )


async def get_approval_status(tenant_id: int, entity_type: str, entity_id: int) -> dict[str, Any]:
    from core.services.approval.approval_instance_service import ApprovalInstanceService

    return await ApprovalInstanceService.get_approval_status(
        tenant_id=tenant_id,
        entity_type=entity_type,
        entity_id=entity_id,
    )


async def enrich_with_approval(row_dict: dict[str, Any], tenant_id: int, entity_type: str) -> dict[str, Any]:
    entity_id = row_dict.get("id")
    if not entity_id:
        return row_dict
    status = await get_approval_status(tenant_id, entity_type, int(entity_id))
    row_dict["approval_status"] = status.get("status")
    row_dict["has_approval_instance"] = status.get("has_instance", False)
    return row_dict
