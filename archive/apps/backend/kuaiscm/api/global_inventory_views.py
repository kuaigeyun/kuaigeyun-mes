"""
全局库存视图 API 模块

提供全局库存视图的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiscm.services.global_inventory_view_service import GlobalInventoryViewService
from apps.kuaiscm.schemas.global_inventory_view_schemas import (
    GlobalInventoryViewCreate, GlobalInventoryViewUpdate, GlobalInventoryViewResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/global-inventory-views", tags=["GlobalInventoryViews"])


@router.post("", response_model=GlobalInventoryViewResponse, status_code=status.HTTP_201_CREATED, summary="创建全局库存视图")
async def create_global_inventory_view(
    data: GlobalInventoryViewCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建全局库存视图"""
    try:
        return await GlobalInventoryViewService.create_global_inventory_view(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[GlobalInventoryViewResponse], summary="获取全局库存视图列表")
async def list_global_inventory_views(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    inventory_type: Optional[str] = Query(None, description="库存类型（过滤）"),
    alert_status: Optional[str] = Query(None, description="预警状态（过滤）"),
    status: Optional[str] = Query(None, description="状态（过滤）")
):
    """获取全局库存视图列表"""
    return await GlobalInventoryViewService.list_global_inventory_views(tenant_id, skip, limit, inventory_type, alert_status, status)


@router.get("/{view_uuid}", response_model=GlobalInventoryViewResponse, summary="获取全局库存视图详情")
async def get_global_inventory_view(
    view_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取全局库存视图详情"""
    try:
        return await GlobalInventoryViewService.get_global_inventory_view_by_uuid(tenant_id, view_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{view_uuid}", response_model=GlobalInventoryViewResponse, summary="更新全局库存视图")
async def update_global_inventory_view(
    view_uuid: str,
    data: GlobalInventoryViewUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新全局库存视图"""
    try:
        return await GlobalInventoryViewService.update_global_inventory_view(tenant_id, view_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{view_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除全局库存视图")
async def delete_global_inventory_view(
    view_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除全局库存视图"""
    try:
        await GlobalInventoryViewService.delete_global_inventory_view(tenant_id, view_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

