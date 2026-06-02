"""文件上传鉴权：system.file:create 或业务 category 对应模块写权限。"""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, Query, Request, status

from core.api.deps.access import AuthContext, _make_error, get_auth_context
from core.api.deps.deps import get_current_tenant
from core.services.authorization.access_control_service import AccessControlService
from core.services.file.business_upload_access import business_upload_permission_codes


def require_file_upload_access():
    async def dependency(
        request: Request,
        auth: AuthContext = Depends(get_auth_context),
        tenant_id: Optional[int] = Depends(get_current_tenant),
        category: Optional[str] = Query(None, description="文件分类（可选）"),
    ) -> AuthContext:
        if tenant_id is None:
            _make_error(
                http_status=status.HTTP_400_BAD_REQUEST,
                code="TENANT_CONTEXT_REQUIRED",
                message="组织上下文未设置",
                request_id=auth.request_id,
                reason="missing_tenant",
            )

        if auth.is_infra_admin or auth.is_tenant_admin:
            auth.tenant_id = tenant_id
            return auth

        env = {
            "method": request.method,
            "path": request.url.path,
            "client_ip": request.client.host if request.client else None,
            "file_category": (category or "").strip() or None,
        }

        system_decision = await AccessControlService.check_access(
            user_id=auth.user_id,
            tenant_id=tenant_id,
            resource="system.file",
            action="create",
            is_infra_admin=False,
            is_tenant_admin=False,
            check_abac=True,
            required_permissions=["system:file:create"],
            env=env,
        )
        if system_decision.allowed:
            auth.tenant_id = tenant_id
            return auth

        biz_perms = business_upload_permission_codes(category)
        if biz_perms:
            biz_decision = await AccessControlService.check_access(
                user_id=auth.user_id,
                tenant_id=tenant_id,
                resource="system.file",
                action="create",
                is_infra_admin=False,
                is_tenant_admin=False,
                check_abac=True,
                require_all=False,
                required_permissions=biz_perms,
                env=env,
            )
            if biz_decision.allowed:
                auth.tenant_id = tenant_id
                return auth
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

    return dependency
