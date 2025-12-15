"""
LRP批次 API 模块

提供LRP批次的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaimrp.services.lrp_batch_service import LRPBatchService
from apps.kuaimrp.schemas.lrp_batch_schemas import (
    LRPBatchCreate, LRPBatchUpdate, LRPBatchResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/lrp-batches", tags=["LRP Batches"])


@router.post("", response_model=LRPBatchResponse, status_code=status.HTTP_201_CREATED, summary="创建LRP批次")
async def create_lrp_batch(
    data: LRPBatchCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建LRP批次
    
    - **batch_no**: 批次编号（必填，组织内唯一）
    - **batch_name**: 批次名称（必填）
    - **order_ids**: 关联订单ID列表（可选）
    """
    try:
        return await LRPBatchService.create_lrp_batch(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[LRPBatchResponse], summary="获取LRP批次列表")
async def list_lrp_batches(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="批次状态（过滤）")
):
    """
    获取LRP批次列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **status**: 批次状态（可选，用于过滤）
    """
    return await LRPBatchService.list_lrp_batches(tenant_id, skip, limit, status)


@router.get("/{batch_uuid}", response_model=LRPBatchResponse, summary="获取LRP批次详情")
async def get_lrp_batch(
    batch_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取LRP批次详情
    
    - **batch_uuid**: 批次UUID
    """
    try:
        return await LRPBatchService.get_lrp_batch_by_uuid(tenant_id, batch_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{batch_uuid}", response_model=LRPBatchResponse, summary="更新LRP批次")
async def update_lrp_batch(
    batch_uuid: str,
    data: LRPBatchUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新LRP批次
    
    - **batch_uuid**: 批次UUID
    - **data**: 批次更新数据
    """
    try:
        return await LRPBatchService.update_lrp_batch(tenant_id, batch_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{batch_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除LRP批次")
async def delete_lrp_batch(
    batch_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除LRP批次（软删除）
    
    - **batch_uuid**: 批次UUID
    """
    try:
        await LRPBatchService.delete_lrp_batch(tenant_id, batch_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{batch_uuid}/calculate", response_model=LRPBatchResponse, summary="执行LRP计算")
async def calculate_lrp(
    batch_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    执行LRP计算
    
    - **batch_uuid**: 批次UUID
    """
    try:
        return await LRPBatchService.calculate_lrp(tenant_id, batch_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
