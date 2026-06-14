"""统一审核执行分发（注册表驱动）。

`POST /core/uni-audit/{entity_type}/{entity_id}/{action}` 的业务分发层：
把统一动作（submit/approve/reject/revoke/withdraw）路由到对应实体的业务方法。

- 实体集合受 `manifest.audit`（audit_registry）约束：未声明的 entity_type 显式报错。
- 动作集合固定为 5 个；未注册实体或未实现动作显式报错，不做兜底。
- 权限：动作 → 标准权限 action 的映射在 `action_permission_for`，由 API 层据
  `entry.resource` 拼成权限码后命令式校验。
"""

from __future__ import annotations

from typing import Any, Optional, Dict

from core.config.audit_registry import all_entries, entry_by_entity_type
from core.services.approval.uni_audit_handlers import HANDLERS
from infra.exceptions.exceptions import ValidationError

UNI_AUDIT_ACTIONS = ("submit", "approve", "reject", "revoke", "withdraw", "transfer", "add_sign", "delegate", "urge")

# 动作 → 标准权限 action（withdraw/urge 与提交同权；高级动作走 review）
_ACTION_PERMISSION = {
    "submit": "submit",
    "approve": "approve",
    "reject": "reject",
    "revoke": "revoke",
    "withdraw": "submit",
    "transfer": "approve",
    "add_sign": "approve",
    "delegate": "approve",
    "urge": "submit",
}


def action_permission_for(action: str) -> str:
    """返回该动作对应的标准权限 action（用于拼权限码）。"""
    act = (action or "").strip().lower()
    if act not in _ACTION_PERMISSION:
        raise ValidationError(f"不支持的审核动作: {action}")
    return _ACTION_PERMISSION[act]


async def _edit_sales_order(
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    payload: Dict[str, Any],
    comment: Optional[str],
) -> Any:
    from apps.kuaizhizao.schemas.sales_order import SalesOrderUpdate
    from apps.kuaizhizao.services.sales_order_service import SalesOrderService
    from core.services.approval.approval_edit_guard import ApprovalEditGuard

    edit_ctx = await ApprovalEditGuard.assert_approver_can_edit(
        tenant_id, "sales_order", entity_id, user_id
    )
    body = dict(payload or {})
    body.pop("comment", None)
    update_data = SalesOrderUpdate.model_validate(body)
    svc = SalesOrderService()
    result = await svc.update_sales_order(
        tenant_id,
        entity_id,
        update_data,
        user_id,
        approval_edit_context=edit_ctx,
        approval_edit_comment=comment,
    )
    await ApprovalEditGuard.refresh_instance_context_if_needed(
        tenant_id, "sales_order", entity_id, edit_ctx
    )
    return result


_EDIT_DISPATCH = {
    "sales_order": _edit_sales_order,
}


async def execute_uni_audit_edit(
    *,
    entity_type: str,
    entity_id: int,
    tenant_id: int,
    user_id: int,
    payload: Dict[str, Any],
    comment: Optional[str] = None,
) -> Any:
    entry = entry_by_entity_type(entity_type)
    if entry is None:
        raise ValidationError(f"实体 {entity_type} 未在任何 manifest.audit 中声明为可审核")
    handler = _EDIT_DISPATCH.get(entry.entity_type)
    if handler is None:
        raise ValidationError(f"实体 {entity_type} 尚未接入审核中改单")
    return await handler(
        tenant_id=tenant_id,
        entity_id=entity_id,
        user_id=user_id,
        payload=payload,
        comment=comment,
    )


def _assert_handlers_complete() -> None:
    """manifest 声明的 entity_type 均须在 HANDLERS 中登记。"""
    declared = {e.entity_type for e in all_entries()}
    registered = set(HANDLERS.keys())
    missing = declared - registered
    if missing:
        raise RuntimeError(f"uni_audit HANDLERS 未覆盖 manifest.audit 实体: {sorted(missing)}")


_assert_handlers_complete()

_DISPATCH = HANDLERS


async def execute_uni_audit(
    *,
    entity_type: str,
    entity_id: int,
    action: str,
    tenant_id: int,
    user_id: int,
    reason: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> Any:
    """执行统一审核动作。未声明/未接入的实体或非法动作显式报错。"""
    act = (action or "").strip().lower()
    if act not in UNI_AUDIT_ACTIONS:
        raise ValidationError(f"不支持的审核动作: {action}（仅 {', '.join(UNI_AUDIT_ACTIONS)}）")

    entry = entry_by_entity_type(entity_type)
    if entry is None:
        raise ValidationError(f"实体 {entity_type} 未在任何 manifest.audit 中声明为可审核")

    body = dict(payload or {})

    if act in ("transfer", "add_sign", "delegate", "urge"):
        return await _dispatch_advanced(
            act,
            tenant_id=tenant_id,
            entity_type=entry.entity_type,
            entity_id=entity_id,
            user_id=user_id,
            reason=reason,
            payload=body,
        )

    handler = _DISPATCH.get(entry.entity_type)
    if handler is None:
        raise ValidationError(f"实体 {entity_type} 尚未接入统一执行入口")

    return await handler(
        act,
        tenant_id=tenant_id,
        entity_id=entity_id,
        user_id=user_id,
        reason=reason,
    )


async def _dispatch_advanced(
    action: str,
    *,
    tenant_id: int,
    entity_type: str,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
    payload: Dict[str, Any],
) -> Any:
    from core.services.approval.approval_advanced_actions import ApprovalAdvancedActions

    if action == "transfer":
        target = payload.get("transfer_to_user_id") or payload.get("transfer_to")
        if not target:
            raise ValidationError("转交须指定 transfer_to_user_id")
        return await ApprovalAdvancedActions.transfer(
            tenant_id, entity_type, entity_id, user_id, target, comment=reason
        )
    if action == "delegate":
        target = payload.get("delegate_to_user_id") or payload.get("delegate_to")
        if not target:
            raise ValidationError("委托须指定 delegate_to_user_id")
        return await ApprovalAdvancedActions.delegate(
            tenant_id, entity_type, entity_id, user_id, target, comment=reason
        )
    if action == "add_sign":
        sign_users = payload.get("sign_user_ids") or payload.get("sign_users") or []
        sign_type = str(payload.get("sign_type") or "before").lower()
        return await ApprovalAdvancedActions.add_sign(
            tenant_id,
            entity_type,
            entity_id,
            user_id,
            sign_user_ids=sign_users if isinstance(sign_users, list) else [sign_users],
            sign_type=sign_type,
            comment=reason,
        )
    if action == "urge":
        return await ApprovalAdvancedActions.urge(
            tenant_id, entity_type, entity_id, user_id, comment=reason
        )
    raise ValidationError(f"不支持的高级动作: {action}")
