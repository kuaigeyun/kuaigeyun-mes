"""
盘点单 API 模块

提供盘点单的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiwms.services.stocktake_service import StocktakeService
from apps.kuaiwms.schemas.stocktake_schemas import (
    StocktakeCreate, StocktakeUpdate, StocktakeResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/stocktakes", tags=["Stocktakes"])


@router.post("", response_model=StocktakeResponse, status_code=status.HTTP_201_CREATED, summary="创建盘点单")
async def create_stocktake(
    data: StocktakeCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建盘点单
    
    - **stocktake_no**: 盘点单编号（必填，组织内唯一）
    - **stocktake_date**: 盘点日期（必填）
    - **warehouse_id**: 仓库ID（必填）
    - **stocktake_type**: 盘点类型（全盘、抽盘、循环盘点）
    """
    try:
        return await StocktakeService.create_stocktake(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[StocktakeResponse], summary="获取盘点单列表")
async def list_stocktakes(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="盘点状态（过滤）"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID（过滤）")
):
    """
    获取盘点单列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **status**: 盘点状态（可选，用于过滤）
    - **warehouse_id**: 仓库ID（可选）
    """
    return await StocktakeService.list_stocktakes(tenant_id, skip, limit, status, warehouse_id)


@router.get("/{stocktake_uuid}", response_model=StocktakeResponse, summary="获取盘点单详情")
async def get_stocktake(
    stocktake_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取盘点单详情
    
    - **stocktake_uuid**: 盘点单UUID
    """
    try:
        return await StocktakeService.get_stocktake_by_uuid(tenant_id, stocktake_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{stocktake_uuid}", response_model=StocktakeResponse, summary="更新盘点单")
async def update_stocktake(
    stocktake_uuid: str,
    data: StocktakeUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新盘点单
    
    - **stocktake_uuid**: 盘点单UUID
    - **data**: 盘点单更新数据
    """
    try:
        return await StocktakeService.update_stocktake(tenant_id, stocktake_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{stocktake_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除盘点单")
async def delete_stocktake(
    stocktake_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除盘点单（软删除）
    
    - **stocktake_uuid**: 盘点单UUID
    """
    try:
        await StocktakeService.delete_stocktake(tenant_id, stocktake_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{stocktake_uuid}/complete", response_model=StocktakeResponse, summary="完成盘点")
async def complete_stocktake(
    stocktake_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    完成盘点（计算差异）
    
    - **stocktake_uuid**: 盘点单UUID
    """
    try:
        return await StocktakeService.complete_stocktake(tenant_id, stocktake_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
