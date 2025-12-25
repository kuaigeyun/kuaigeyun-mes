"""
备件采购 API 模块

提供备件采购的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaieam.services.spare_part_purchase_service import SparePartPurchaseService
from apps.kuaieam.schemas.spare_part_purchase_schemas import (
    SparePartPurchaseCreate, SparePartPurchaseUpdate, SparePartPurchaseResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/spare-part-purchases", tags=["SparePartPurchases"])


@router.post("", response_model=SparePartPurchaseResponse, status_code=status.HTTP_201_CREATED, summary="创建备件采购")
async def create_spare_part_purchase(
    data: SparePartPurchaseCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建备件采购"""
    try:
        return await SparePartPurchaseService.create_spare_part_purchase(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[SparePartPurchaseResponse], summary="获取备件采购列表")
async def list_spare_part_purchases(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    demand_uuid: Optional[str] = Query(None, description="备件需求UUID（过滤）"),
    status: Optional[str] = Query(None, description="采购状态（过滤）")
):
    """获取备件采购列表"""
    return await SparePartPurchaseService.list_spare_part_purchases(tenant_id, skip, limit, demand_uuid, status)


@router.get("/{purchase_uuid}", response_model=SparePartPurchaseResponse, summary="获取备件采购详情")
async def get_spare_part_purchase(
    purchase_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取备件采购详情"""
    try:
        return await SparePartPurchaseService.get_spare_part_purchase_by_uuid(tenant_id, purchase_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{purchase_uuid}", response_model=SparePartPurchaseResponse, summary="更新备件采购")
async def update_spare_part_purchase(
    purchase_uuid: str,
    data: SparePartPurchaseUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新备件采购"""
    try:
        return await SparePartPurchaseService.update_spare_part_purchase(tenant_id, purchase_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{purchase_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除备件采购")
async def delete_spare_part_purchase(
    purchase_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除备件采购"""
    try:
        await SparePartPurchaseService.delete_spare_part_purchase(tenant_id, purchase_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
