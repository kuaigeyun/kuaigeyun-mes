"""三层权限中的数据/字段策略 API。"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User
from core.schemas.permission_policy import (
    DataPermissionPolicyResponse,
    DataPermissionPolicyUpsert,
    FieldPermissionPolicyResponse,
    FieldPermissionPolicyUpsert,
)
from core.services.authorization.permission_policy_service import PermissionPolicyService
from tortoise.exceptions import IntegrityError

from infra.exceptions.exceptions import ValidationError

router = APIRouter(prefix="/permission-policies", tags=["Core · Permission Policies"])


@router.get("/me/field-masks")
async def get_my_field_masks(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """当前登录用户的有效字段掩码（供前端 AmountDisplay 等按字段展示）。"""
    return await PermissionPolicyService.get_user_effective_field_masks(
        tenant_id=tenant_id,
        user_id=current_user.id,
    )


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
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"数据权限记录冲突，请刷新后重试: {exc}",
        )


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
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"字段权限记录冲突，请刷新后重试: {exc}",
        )


@router.post("/governance/field-canonicalize")
async def canonicalize_field_policies(
    role_uuid: str | None = None,
    _auth: object = Depends(require_access("system.permission", "update")),
    tenant_id: int = Depends(get_current_tenant),
):
    """字段权限命名治理：归一化同义字段并合并重复记录（保留最新 updated_at）。"""
    return await PermissionPolicyService.canonicalize_field_policies(
        tenant_id=tenant_id,
        role_uuid=role_uuid,
    )
