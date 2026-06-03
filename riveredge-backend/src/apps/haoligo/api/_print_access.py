"""好力 GO 单据打印鉴权。"""

from __future__ import annotations

from fastapi import HTTPException, Request, status

from apps.haoligo.api._mold_inhouse_maintenance_access import assert_haoligo_module_access
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.constants.document_print import (
    HAOLIGO_DOCUMENT_PRINT_MODULES,
    HAOLIGO_PRINT_DOCUMENT_TYPE_MODULE,
)
from core.config.permission_contract import build_permission_code
from apps.haoligo.models.mold_maintenance_complete_sheet import HaoligoMoldMaintenanceCompleteSheet
from core.api.deps.access import AuthContext


async def resolve_haoligo_print_module(
    tenant_id: int,
    document_type: str,
    document_id: int | None = None,
) -> str:
    dt = (document_type or "").strip()
    if dt == "mold_maintenance_complete" and document_id is not None:
        row = await tenant_alive(HaoligoMoldMaintenanceCompleteSheet, tenant_id).filter(id=document_id).first()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
        svc = (getattr(row, "service_type", None) or "维修").strip()
        return "molds-documents-upkeep-complete" if svc == "保养" else "molds-documents-repair-complete"
    module = HAOLIGO_PRINT_DOCUMENT_TYPE_MODULE.get(dt)
    if not module:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的单据类型：{document_type}",
        )
    return module


async def assert_haoligo_print_preset_loader(
    *,
    auth: AuthContext,
    tenant_id: int,
    request: Request,
) -> None:
    """加载打印模板预设：具备任一连单据 print 权限即可（幂等，不视为管理端 update）。"""
    await assert_haoligo_module_access(
        auth=auth,
        tenant_id=tenant_id,
        request=request,
        module_codes=[],
        action="print",
        required_permissions=[
            build_permission_code("haoligo", m, "print") for m in HAOLIGO_DOCUMENT_PRINT_MODULES
        ],
    )


async def assert_haoligo_document_print_access(
    *,
    auth: AuthContext,
    tenant_id: int,
    request: Request,
    document_type: str,
    document_id: int | None = None,
) -> None:
    module = await resolve_haoligo_print_module(tenant_id, document_type, document_id)
    await assert_haoligo_module_access(
        auth=auth,
        tenant_id=tenant_id,
        request=request,
        module_codes=[module],
        action="print",
        check_abac=False,
    )
