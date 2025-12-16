"""
战略地图 API 模块

提供战略地图的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiepm.services.strategy_map_service import StrategyMapService
from apps.kuaiepm.schemas.strategy_map_schemas import (
    StrategyMapCreate, StrategyMapUpdate, StrategyMapResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/strategy-map", tags=["战略地图"])


@router.post("", response_model=StrategyMapResponse, summary="创建战略地图")
async def create_strategymap(
    data: StrategyMapCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建战略地图"""
    try:
        return await StrategyMapService.create_strategymap(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[StrategyMapResponse], summary="获取战略地图列表")
async def list_strategymaps(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取战略地图列表"""
    return await StrategyMapService.list_strategymaps(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=StrategyMapResponse, summary="获取战略地图详情")
async def get_strategymap(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取战略地图详情"""
    try:
        return await StrategyMapService.get_strategymap_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=StrategyMapResponse, summary="更新战略地图")
async def update_strategymap(
    obj_uuid: str,
    data: StrategyMapUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新战略地图"""
    try:
        return await StrategyMapService.update_strategymap(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除战略地图")
async def delete_strategymap(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除战略地图（软删除）"""
    try:
        await StrategyMapService.delete_strategymap(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
