"""
设计评审 API 模块

提供设计评审的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaipdm.services.design_review_service import DesignReviewService
from apps.kuaipdm.schemas.design_review_schemas import (
    DesignReviewCreate, DesignReviewUpdate, DesignReviewResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/design-reviews", tags=["Design Reviews"])


@router.post("", response_model=DesignReviewResponse, status_code=status.HTTP_201_CREATED, summary="创建设计评审")
async def create_design_review(
    data: DesignReviewCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建设计评审
    
    - **review_no**: 评审编号（必填，组织内唯一）
    - **review_type**: 评审类型（必填）
    - **review_stage**: 评审阶段（可选）
    - **product_id**: 关联产品ID（可选）
    """
    try:
        return await DesignReviewService.create_design_review(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[DesignReviewResponse], summary="获取设计评审列表")
async def list_design_reviews(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="评审状态（过滤）"),
    review_type: Optional[str] = Query(None, description="评审类型（过滤）")
):
    """
    获取设计评审列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **status**: 评审状态（可选，用于过滤）
    - **review_type**: 评审类型（可选）
    """
    return await DesignReviewService.list_design_reviews(tenant_id, skip, limit, status, review_type)


@router.get("/{review_uuid}", response_model=DesignReviewResponse, summary="获取设计评审详情")
async def get_design_review(
    review_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取设计评审详情
    
    - **review_uuid**: 评审UUID
    """
    try:
        return await DesignReviewService.get_design_review_by_uuid(tenant_id, review_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{review_uuid}", response_model=DesignReviewResponse, summary="更新设计评审")
async def update_design_review(
    review_uuid: str,
    data: DesignReviewUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新设计评审
    
    - **review_uuid**: 评审UUID
    - **data**: 评审更新数据
    """
    try:
        return await DesignReviewService.update_design_review(tenant_id, review_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{review_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除设计评审")
async def delete_design_review(
    review_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除设计评审（软删除）
    
    - **review_uuid**: 评审UUID
    """
    try:
        await DesignReviewService.delete_design_review(tenant_id, review_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
