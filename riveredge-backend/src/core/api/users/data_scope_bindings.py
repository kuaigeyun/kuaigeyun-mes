"""用户数据范围绑定 API。"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from core.schemas.user_data_scope_binding import UserDataScopeBindingItem, UserDataScopeBindingReplace
from core.services.authorization.user_data_scope_binding_service import UserDataScopeBindingService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User
from infra.api.deps.deps import get_current_user as soil_get_current_user

router = APIRouter(tags=["Core - Users - Data Scope Bindings"])


async def _resolve_user_id(tenant_id: int, user_id: int) -> int:
    exists = await User.filter(id=user_id, tenant_id=tenant_id, deleted_at__isnull=True).exists()
    if not exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    return user_id


async def _resolve_user_id_by_uuid(tenant_id: int, user_uuid: str) -> int:
    user = await User.filter(
        uuid=user_uuid,
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    ).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    return int(user.id)


@router.get("/{user_id}/data-scope-bindings", response_model=List[UserDataScopeBindingItem])
async def list_user_data_scope_bindings(
    user_id: int,
    dimension: Optional[str] = Query(None, description="按维度筛选，如 outsourced_unit"),
    _auth: object = Depends(require_access("system:user", "read")),
    tenant_id: int = Depends(get_current_tenant),
    _: User = Depends(soil_get_current_user),
):
    await _resolve_user_id(tenant_id, user_id)
    return await UserDataScopeBindingService.list_bindings(
        tenant_id=tenant_id,
        user_id=user_id,
        dimension=dimension,
    )


@router.put("/{user_id}/data-scope-bindings", response_model=List[UserDataScopeBindingItem])
async def replace_user_data_scope_bindings(
    user_id: int,
    body: UserDataScopeBindingReplace,
    _auth: object = Depends(require_access("system:user", "update")),
    tenant_id: int = Depends(get_current_tenant),
    _: User = Depends(soil_get_current_user),
):
    await _resolve_user_id(tenant_id, user_id)
    try:
        return await UserDataScopeBindingService.replace_bindings(
            tenant_id=tenant_id,
            user_id=user_id,
            body=body,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("/by-uuid/{user_uuid}/data-scope-bindings", response_model=List[UserDataScopeBindingItem])
async def list_user_data_scope_bindings_by_uuid(
    user_uuid: str,
    dimension: Optional[str] = Query(None, description="按维度筛选，如 supplier/customer"),
    _auth: object = Depends(require_access("system:user", "read")),
    tenant_id: int = Depends(get_current_tenant),
    _: User = Depends(soil_get_current_user),
):
    user_id = await _resolve_user_id_by_uuid(tenant_id, user_uuid)
    return await UserDataScopeBindingService.list_bindings(
        tenant_id=tenant_id,
        user_id=user_id,
        dimension=dimension,
    )


@router.put("/by-uuid/{user_uuid}/data-scope-bindings", response_model=List[UserDataScopeBindingItem])
async def replace_user_data_scope_bindings_by_uuid(
    user_uuid: str,
    body: UserDataScopeBindingReplace,
    _auth: object = Depends(require_access("system:user", "update")),
    tenant_id: int = Depends(get_current_tenant),
    _: User = Depends(soil_get_current_user),
):
    user_id = await _resolve_user_id_by_uuid(tenant_id, user_uuid)
    try:
        return await UserDataScopeBindingService.replace_bindings(
            tenant_id=tenant_id,
            user_id=user_id,
            body=body,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
