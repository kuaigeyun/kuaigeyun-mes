"""三层权限中的数据/字段策略 API。"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from core.schemas.permission_policy import (
    DataPermissionPolicyResponse,
    DataPermissionPolicyUpsert,
    FieldPermissionPolicyResponse,
    FieldPermissionPolicyUpsert,
)
from core.services.authorization.permission_policy_service import PermissionPolicyService
from infra.exceptions.exceptions import ValidationError

router = APIRouter(prefix="/permission-policies", tags=["Core Permission Policies"])


@router.get("/roles/{role_uuid}/data", response_model=List[DataPermissionPolicyResponse])
async def list_role_data_policies(
    role_uuid: str,
    _auth: object = Depends(require_access("system.permission", "read")),
    tenant_id: int = Depends(get_current_tenant),
):
    return await PermissionPolicyService.list_data_policies(tenant_id=tenant_id, role_uuid=role_uuid)


@router.put("/roles/{role_uuid}/data", response_model=List[DataPermissionPolicyResponse])
async def replace_role_data_policies(
    role_uuid: str,
    items: List[DataPermissionPolicyUpsert],
    _auth: object = Depends(require_access("system.permission", "update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await PermissionPolicyService.save_data_policies(
            tenant_id=tenant_id,
            role_uuid=role_uuid,
            items=items,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.get("/roles/{role_uuid}/field", response_model=List[FieldPermissionPolicyResponse])
async def list_role_field_policies(
    role_uuid: str,
    _auth: object = Depends(require_access("system.permission", "read")),
    tenant_id: int = Depends(get_current_tenant),
):
    return await PermissionPolicyService.list_field_policies(tenant_id=tenant_id, role_uuid=role_uuid)


@router.put("/roles/{role_uuid}/field", response_model=List[FieldPermissionPolicyResponse])
async def replace_role_field_policies(
    role_uuid: str,
    items: List[FieldPermissionPolicyUpsert],
    _auth: object = Depends(require_access("system.permission", "update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await PermissionPolicyService.save_field_policies(
            tenant_id=tenant_id,
            role_uuid=role_uuid,
            items=items,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
