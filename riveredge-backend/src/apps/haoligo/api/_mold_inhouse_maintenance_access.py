"""厂内保养/维修单 API 鉴权：按 service_type 映射独立模块权限。"""

from __future__ import annotations

from typing import Annotated, List, Optional

from fastapi import Depends, HTTPException, Query, Request, status

from apps.haoligo.api._haoligo_route_access import resolve_haoligo_module_action
from apps.haoligo.authorization.workflow_permissions import (
    REPAIR_COMPLETE_CREATE_PERMISSIONS,
    UPKEEP_COMPLETE_CREATE_PERMISSIONS,
)
from apps.haoligo.constants.mold_inhouse_maintenance_permissions import (
    INHOUSE_SERVICE_TYPES,
    SERVICE_TYPE_REPAIR,
    SERVICE_TYPE_UPKEEP,
    complete_module_for_service_type,
    sheet_module_for_service_type,
)
from core.api.deps.access import AuthContext, ensure_permission_codes, get_auth_context
from core.api.deps.deps import get_current_tenant
from core.config.permission_contract import build_permission_code


async def _ensure_haoligo_permissions(
    *,
    auth: AuthContext,
    tenant_id: int,
    request: Request,
    module_codes: List[str],
    action: Optional[str] = None,
    required_permissions: Optional[List[str]] = None,
    check_abac: bool = True,
) -> None:
    perms = list(required_permissions or [])
    if not perms:
        act = (action or resolve_haoligo_module_action(request.method, request.url.path)).strip().lower()
        perms = [build_permission_code("haoligo", m, act) for m in module_codes if m]
    if not perms:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="权限不足")
    await ensure_permission_codes(
        auth,
        tenant_id,
        request,
        perms,
        require_all=False,
        check_abac=check_abac,
    )


async def ensure_inhouse_sheet_access_for_service_type(
    *,
    auth: AuthContext,
    tenant_id: int,
    request: Request,
    service_type: str,
    action: Optional[str] = None,
) -> None:
    st = (service_type or "").strip()
    if st not in INHOUSE_SERVICE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的维修/保养类型")
    await _ensure_haoligo_permissions(
        auth=auth,
        tenant_id=tenant_id,
        request=request,
        module_codes=[sheet_module_for_service_type(st)],
        action=action,
    )


async def ensure_inhouse_complete_access_for_service_type(
    *,
    auth: AuthContext,
    tenant_id: int,
    request: Request,
    service_type: str,
    action: Optional[str] = None,
) -> None:
    st = (service_type or "").strip()
    if st not in INHOUSE_SERVICE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的维修/保养类型")
    await _ensure_haoligo_permissions(
        auth=auth,
        tenant_id=tenant_id,
        request=request,
        module_codes=[complete_module_for_service_type(st)],
        action=action,
    )


def require_inhouse_maintenance_sheet_list_access():
    """列表：须带 service_type=保养|维修，并具备对应单据 read 权限。"""

    async def dependency(
        request: Request,
        auth: Annotated[AuthContext, Depends(get_auth_context)],
        tenant_id: Annotated[int, Depends(get_current_tenant)],
        service_type: Annotated[Optional[str], Query(description="维修 / 保养")] = None,
        open_for_complete: Annotated[
            bool,
            Query(description="为 true 时用于完修单选源，接受来源单 read 或 complete"),
        ] = False,
    ) -> AuthContext:
        st = (service_type or "").strip()
        if st in INHOUSE_SERVICE_TYPES:
            if open_for_complete:
                mod = sheet_module_for_service_type(st)
                await _ensure_haoligo_permissions(
                    auth=auth,
                    tenant_id=tenant_id,
                    request=request,
                    module_codes=[],
                    required_permissions=[
                        build_permission_code("haoligo", mod, "read"),
                        build_permission_code("haoligo", mod, "complete"),
                    ],
                )
            else:
                await ensure_inhouse_sheet_access_for_service_type(
                    auth=auth, tenant_id=tenant_id, request=request, service_type=st
                )
        else:
            await _ensure_haoligo_permissions(
                auth=auth,
                tenant_id=tenant_id,
                request=request,
                module_codes=[
                    sheet_module_for_service_type("保养"),
                    sheet_module_for_service_type("维修"),
                ],
            )
        auth.tenant_id = tenant_id
        return auth

    return dependency


async def ensure_inhouse_complete_create_access(
    *,
    auth: AuthContext,
    tenant_id: int,
    request: Request,
    service_type: str,
) -> None:
    st = (service_type or "").strip()
    if st == SERVICE_TYPE_UPKEEP:
        perms = UPKEEP_COMPLETE_CREATE_PERMISSIONS
    elif st == SERVICE_TYPE_REPAIR:
        perms = REPAIR_COMPLETE_CREATE_PERMISSIONS
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的维修/保养类型")
    await _ensure_haoligo_permissions(
        auth=auth,
        tenant_id=tenant_id,
        request=request,
        module_codes=[],
        required_permissions=perms,
    )


def require_inhouse_maintenance_complete_list_access():
    async def dependency(
        request: Request,
        auth: Annotated[AuthContext, Depends(get_auth_context)],
        tenant_id: Annotated[int, Depends(get_current_tenant)],
        service_type: Annotated[Optional[str], Query(description="维修 / 保养")] = None,
    ) -> AuthContext:
        st = (service_type or "").strip()
        if st in INHOUSE_SERVICE_TYPES:
            await ensure_inhouse_complete_access_for_service_type(
                auth=auth, tenant_id=tenant_id, request=request, service_type=st
            )
        else:
            await _ensure_haoligo_permissions(
                auth=auth,
                tenant_id=tenant_id,
                request=request,
                module_codes=[
                    complete_module_for_service_type("保养"),
                    complete_module_for_service_type("维修"),
                ],
            )
        auth.tenant_id = tenant_id
        return auth

    return dependency
