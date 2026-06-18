"""工程变更统一审核辅助（BOM / 工艺路线）。"""

from __future__ import annotations

from typing import Any, Literal, Optional

from loguru import logger

ChangeCategory = Literal["bom", "process_route"]

AUDIT_NODE_BY_CATEGORY: dict[ChangeCategory, str] = {
    "bom": "bom_change",
    "process_route": "process_route_change",
}

ECN_ALLOWED_STATUSES = frozenset(
    {"draft", "pending", "approved", "rejected", "executed", "cancelled"}
)


async def is_audit_required(tenant_id: int, category: ChangeCategory) -> bool:
    from infra.services.business_config_service import BusinessConfigService

    node_key = AUDIT_NODE_BY_CATEGORY[category]
    return await BusinessConfigService().check_audit_required(tenant_id, node_key)


def audit_node_for_category(category: ChangeCategory) -> str:
    return AUDIT_NODE_BY_CATEGORY[category]


def _entity_type(category: ChangeCategory) -> str:
    return audit_node_for_category(category)


def _approval_title(category: ChangeCategory, change: Any) -> str:
    if category == "bom":
        material = getattr(change, "material", None)
        code = (
            getattr(material, "main_code", None)
            or getattr(change, "bom_code", None)
            or str(getattr(change, "uuid", ""))
        )
        return f"BOM 工程变更: {code}"
    route = getattr(change, "process_route", None)
    code = (
        getattr(route, "code", None)
        or str(getattr(change, "uuid", ""))
    )
    return f"工艺路线变更: {code}"


def _approval_content(change: Any) -> str:
    reason = (getattr(change, "change_reason", None) or "").strip()
    change_type = getattr(change, "change_type", None) or ""
    if reason and change_type:
        return f"{change_type} · {reason}"
    return reason or change_type or "工程变更自动提交审批"


async def start_change_approval_flow(
    tenant_id: int,
    category: ChangeCategory,
    change: Any,
    *,
    submitter_id: int,
) -> None:
    """创建变更进入待审批时自动启动审批实例（发起人为申请人）。"""
    from core.services.approval.approval_instance_service import ApprovalInstanceService

    entity_type = _entity_type(category)
    instance = await ApprovalInstanceService.start_approval_for_node(
        tenant_id=tenant_id,
        user_id=submitter_id,
        node_key=entity_type,
        entity_type=entity_type,
        entity_id=int(change.id),
        entity_uuid=str(change.uuid),
        title=_approval_title(category, change),
        content=_approval_content(change),
    )
    if not instance:
        from infra.exceptions.exceptions import ValidationError

        label = "BOM 工程变更" if category == "bom" else "工艺路线变更"
        raise ValidationError(
            f"{label}审核已开启但未找到可用的审批流程，请在配置中心检查 {entity_type} 审批流程是否已激活"
        )


async def cancel_change_approval_flow(
    tenant_id: int,
    category: ChangeCategory,
    change_id: int,
    operator_id: int,
) -> None:
    from core.services.approval.approval_instance_service import ApprovalInstanceService

    try:
        await ApprovalInstanceService.cancel_approval(
            tenant_id=tenant_id,
            entity_type=_entity_type(category),
            entity_id=change_id,
            operator_id=operator_id,
        )
    except Exception as exc:
        logger.warning(
            "cancel ecn approval instance failed category={} change_id={}: {}",
            category,
            change_id,
            exc,
        )


async def ensure_pending_change_approval_instance(
    tenant_id: int,
    category: ChangeCategory,
    change: Any,
) -> None:
    """待审批但缺少审批实例时补建（历史数据 / 旧逻辑遗留）。"""
    if getattr(change, "status", None) != "pending":
        return
    if not await is_audit_required(tenant_id, category):
        return

    from core.services.approval.approval_instance_service import ApprovalInstanceService

    entity_type = _entity_type(category)
    approval_status = await ApprovalInstanceService.get_approval_status(
        tenant_id=tenant_id,
        entity_type=entity_type,
        entity_id=int(change.id),
    )
    if approval_status.get("has_instance"):
        return

    submitter_id = int(getattr(change, "applicant_id", 0) or 0)
    if not submitter_id:
        return

    try:
        await start_change_approval_flow(
            tenant_id,
            category,
            change,
            submitter_id=submitter_id,
        )
        logger.info(
            "补建工程变更审批实例 category={} change_id={} submitter={}",
            category,
            change.id,
            submitter_id,
        )
    except Exception as exc:
        logger.warning(
            "补建工程变更审批实例失败 category={} change_id={}: {}",
            category,
            change.id,
            exc,
        )
