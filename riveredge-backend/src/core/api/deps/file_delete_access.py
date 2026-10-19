"""文件删除鉴权：system.file:delete 或业务 category 对应模块写权限（与上传对称）。"""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, Request, status

from core.api.deps.access import AuthContext, _make_error, get_auth_context
from core.api.deps.deps import get_current_tenant
from core.services.authorization.access_control_service import AccessControlService
from core.services.authorization.user_permission_service import UserPermissionService
from core.services.file.business_upload_access import business_upload_permission_codes
from core.services.file.file_service import FileService
from infra.exceptions.exceptions import NotFoundError


async def assert_file_delete_access(
    *,
    auth: AuthContext,
    tenant_id: int,
    request: Request,
    file_category: str | None,
) -> None:
    if await UserPermissionService.is_admin_bypass_flags(
        auth.user_id,
        tenant_id,
        is_infra_admin=auth.is_infra_admin,
        is_tenant_admin=auth.is_tenant_admin,
    ):
        return

    env = {
        "method": request.method,
        "path": request.url.path,
        "client_ip": request.client.host if request.client else None,
        "file_category": (file_category or "").strip() or None,
    }

    system_decision = await AccessControlService.check_access(
        user_id=auth.user_id,
        tenant_id=tenant_id,
        resource="system.file",
        action="delete",
        is_infra_admin=auth.is_infra_admin,
        is_tenant_admin=auth.is_tenant_admin,
        check_abac=True,
        required_permissions=["system:file:delete"],
        env=env,
    )
    if system_decision.allowed:
        return

    biz_perms = business_upload_permission_codes(file_category)
    if biz_perms:
        biz_decision = await AccessControlService.check_access(
            user_id=auth.user_id,
            tenant_id=tenant_id,
            resource="system.file",
            action="delete",
            is_infra_admin=auth.is_infra_admin,
            is_tenant_admin=auth.is_tenant_admin,
            check_abac=True,
            require_all=False,
            required_permissions=biz_perms,
            env=env,
        )
        if biz_decision.allowed:
            return
        _make_error(
            http_status=status.HTTP_403_FORBIDDEN,
            code="ACCESS_DENIED",
            message="权限不足",
            request_id=auth.request_id,
            reason=biz_decision.reason,
            required=biz_decision.required,
        )

    _make_error(
        http_status=status.HTTP_403_FORBIDDEN,
        code="ACCESS_DENIED",
        message="权限不足",
        request_id=auth.request_id,
        reason=system_decision.reason,
        required=system_decision.required,
    )


def require_file_delete_access():
    async def dependency(
        request: Request,
        uuid: str,
        auth: AuthContext = Depends(get_auth_context),
        tenant_id: Optional[int] = Depends(get_current_tenant),
    ) -> AuthContext:
        if tenant_id is None:
            _make_error(
                http_status=status.HTTP_400_BAD_REQUEST,
                code="TENANT_CONTEXT_REQUIRED",
                message="组织上下文未设置",
                request_id=auth.request_id,
                reason="missing_tenant",
            )

        try:
            existing = await FileService.get_file_by_uuid(tenant_id=tenant_id, uuid=uuid)
        except NotFoundError:
            raise
        await assert_file_delete_access(
            auth=auth,
            tenant_id=tenant_id,
            request=request,
            file_category=existing.category,
        )
        auth.tenant_id = tenant_id
        return auth

    return dependency
