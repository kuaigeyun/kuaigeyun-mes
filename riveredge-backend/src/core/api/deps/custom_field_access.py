"""自定义字段业务页读取依赖（字段定义与单据字段值，非配置管理）。"""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, Query, status

from core.api.deps.access import AuthContext, get_auth_context
from core.api.deps.deps import get_current_tenant
from core.config.associated_table_registry import TABLE_REFERENCE_RESOURCE
from core.services.authorization.access_control_service import AccessControlService
from core.services.authorization.user_permission_service import UserPermissionService

_HOST_BUSINESS_ACTIONS = ("read", "create", "update")
_HOST_WRITE_ACTIONS = ("create", "update")


def host_resource_for_record_table(record_table: str) -> Optional[str]:
    return TABLE_REFERENCE_RESOURCE.get((record_table or "").strip())


async def assert_custom_field_values_access(
    *,
    auth: AuthContext,
    tenant_id: int,
    record_table: str,
    write: bool,
) -> None:
    """单据上的自定义字段值走宿主模块权限，禁止用 system:custom-field:update 冒充业务保存。"""
    if await UserPermissionService.is_admin_bypass_flags(
        auth.user_id,
        tenant_id,
        is_infra_admin=auth.is_infra_admin,
        is_tenant_admin=auth.is_tenant_admin,
    ):
        return

    user_perms = await UserPermissionService.get_user_permissions(
        user_id=auth.user_id,
        tenant_id=tenant_id,
    )
    system_code = "system:custom-field:update" if write else "system:custom-field:read"
    if system_code in user_perms:
        return

    host = host_resource_for_record_table(record_table)
    if host:
        actions = _HOST_WRITE_ACTIONS if write else _HOST_BUSINESS_ACTIONS
        host_codes = {
            AccessControlService.build_permission_code(host, action)
            for action in actions
        }
        if any(code in user_perms for code in host_codes):
            return

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="权限不足")


def require_custom_field_definitions_read():
    """允许 system:custom-field:read，或宿主业务模块 read/create/update 读取字段定义。"""

    async def dependency(
        host_resource: Optional[str] = Query(None, description="宿主 {app}:{module}，业务页读取字段定义"),
        auth: AuthContext = Depends(get_auth_context),
        tenant_id: int = Depends(get_current_tenant),
    ) -> AuthContext:
        if await UserPermissionService.is_admin_bypass_flags(
            auth.user_id,
            tenant_id,
            is_infra_admin=auth.is_infra_admin,
            is_tenant_admin=auth.is_tenant_admin,
        ):
            return auth

        user_perms = await UserPermissionService.get_user_permissions(
            user_id=auth.user_id,
            tenant_id=tenant_id,
        )
        if "system:custom-field:read" in user_perms:
            return auth

        host = (host_resource or "").strip().lower()
        if host:
            host_codes = {
                AccessControlService.build_permission_code(host, action)
                for action in _HOST_BUSINESS_ACTIONS
            }
            if any(code in user_perms for code in host_codes):
                return auth

        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="权限不足")

    return dependency
