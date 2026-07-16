"""统一审核执行入口 API。

`POST /core/uni-audit/{entity_type}/{entity_id}/{action}`：所有可审核单据的
submit/approve/reject/revoke/withdraw 统一从此执行。

- 实体集合：manifest.audit（audit_registry）声明的实体。
- 权限：按 `entry.resource` + 动作标准权限码命令式校验（不绕过权限契约）。
"""

from typing import Optional

from fastapi import APIRouter, Body, Depends, Request

from core.api.deps.access import AuthContext, ensure_permission_codes, get_auth_context
from core.api.deps.deps import get_current_tenant
from core.config.audit_registry import entry_by_entity_type
from core.services.approval.uni_audit_dispatch import (
    action_permission_for,
    execute_uni_audit,
    execute_uni_audit_edit,
)
from infra.exceptions.exceptions import ValidationError

router = APIRouter(prefix="/uni-audit", tags=["Core - Uni Audit"])


@router.post("/{entity_type}/{entity_id}/{action}")
async def execute_audit_action(
    entity_type: str,
    entity_id: int,
    action: str,
    request: Request,
    body: Optional[dict] = Body(default=None),
    reason: Optional[str] = Body(default=None, embed=True),
    auth: AuthContext = Depends(get_auth_context),
    tenant_id: int = Depends(get_current_tenant),
):
    """统一执行审核动作（按实体资源 + 动作权限码鉴权）。"""
    entry = entry_by_entity_type(entity_type)
    if entry is None:
        raise ValidationError(f"实体 {entity_type} 未在任何 manifest.audit 中声明为可审核")

    permission_action = action_permission_for(action)
    await ensure_permission_codes(
        auth,
        tenant_id,
        request,
        [f"{entry.resource}:{permission_action}"],
    )

    payload = dict(body or {})
    merged_reason = payload.pop("reason", None) or payload.pop("comment", None) or reason

    return await execute_uni_audit(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        tenant_id=tenant_id,
        user_id=auth.user_id,
        reason=merged_reason,
        payload=payload,
    )


@router.patch("/{entity_type}/{entity_id}/edit")
async def execute_audit_edit(
    entity_type: str,
    entity_id: int,
    request: Request,
    payload: dict = Body(...),
    auth: AuthContext = Depends(get_auth_context),
    tenant_id: int = Depends(get_current_tenant),
):
    """审核中改单：当前审批节点允许时修改单据并留痕。"""
    entry = entry_by_entity_type(entity_type)
    if entry is None:
        raise ValidationError(f"实体 {entity_type} 未在任何 manifest.audit 中声明为可审核")

    comment = payload.pop("comment", None) if isinstance(payload, dict) else None
    await ensure_permission_codes(
        auth,
        tenant_id,
        request,
        [f"{entry.resource}:update"],
    )
    return await execute_uni_audit_edit(
        entity_type=entity_type,
        entity_id=entity_id,
        tenant_id=tenant_id,
        user_id=auth.user_id,
        payload=payload if isinstance(payload, dict) else {},
        comment=comment,
    )
