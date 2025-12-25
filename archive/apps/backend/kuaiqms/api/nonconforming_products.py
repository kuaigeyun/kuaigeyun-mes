"""
不合格品记录 API 模块

提供不合格品记录的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiqms.services.nonconforming_product_service import NonconformingProductService
from apps.kuaiqms.schemas.nonconforming_product_schemas import (
    NonconformingProductCreate, NonconformingProductUpdate, NonconformingProductResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/nonconforming-products", tags=["NonconformingProducts"])


@router.post("", response_model=NonconformingProductResponse, status_code=status.HTTP_201_CREATED, summary="创建不合格品记录")
async def create_nonconforming_product(
    data: NonconformingProductCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建不合格品记录"""
    try:
        return await NonconformingProductService.create_nonconforming_product(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[NonconformingProductResponse], summary="获取不合格品记录列表")
async def list_nonconforming_products(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="记录状态（过滤）"),
    defect_type: Optional[int] = Query(None, description="缺陷类型（过滤）")
):
    """获取不合格品记录列表"""
    return await NonconformingProductService.list_nonconforming_products(tenant_id, skip, limit, status, defect_type)


@router.get("/{record_uuid}", response_model=NonconformingProductResponse, summary="获取不合格品记录详情")
async def get_nonconforming_product(
    record_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取不合格品记录详情"""
    try:
        return await NonconformingProductService.get_nonconforming_product_by_uuid(tenant_id, record_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{record_uuid}", response_model=NonconformingProductResponse, summary="更新不合格品记录")
async def update_nonconforming_product(
    record_uuid: str,
    data: NonconformingProductUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新不合格品记录"""
    try:
        return await NonconformingProductService.update_nonconforming_product(tenant_id, record_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{record_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除不合格品记录")
async def delete_nonconforming_product(
    record_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除不合格品记录"""
    try:
        await NonconformingProductService.delete_nonconforming_product(tenant_id, record_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
