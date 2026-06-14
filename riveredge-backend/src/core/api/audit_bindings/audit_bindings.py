"""审核单据绑定 API"""

from fastapi import APIRouter, Depends, HTTPException, status

from core.api.deps.deps import get_current_tenant
from core.schemas.audit_binding import (
    AuditBindingListResponse,
    AuditBindingUpdateRequest,
)
from core.services.approval.audit_binding_service import AuditBindingService
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/audit-bindings", tags=["Core · Audit Bindings"])


@router.get("", response_model=AuditBindingListResponse)
async def list_audit_bindings(
    tenant_id: int = Depends(get_current_tenant),
):
    """
    审核设置列表（配置中心唯一数据源）。

    每行 = manifest 声明的单据 + 租户绑定（开关 / 流程）。
    """
    data = await AuditBindingService.list_bindings(tenant_id)
    return AuditBindingListResponse.model_validate(data)


@router.put("/{node_key}")
async def update_audit_binding(
    node_key: str,
    data: AuditBindingUpdateRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新单据审核绑定（开关 / 流程）。"""
    if data.is_enabled is None and data.process_uuid is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="至少提供 is_enabled 或 process_uuid 之一",
        )
    try:
        binding = await AuditBindingService.update_binding(
            tenant_id,
            node_key,
            is_enabled=data.is_enabled,
            process_uuid=data.process_uuid,
        )
        return {
            "node_key": binding.node_key,
            "is_enabled": binding.is_enabled,
            "process_uuid": str(binding.process.uuid) if binding.process else None,
        }
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
