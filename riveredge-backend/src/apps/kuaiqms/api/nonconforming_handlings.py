"""
不合格品处理 API 模块

提供不合格品处理的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiqms.services.nonconforming_handling_service import NonconformingHandlingService
from apps.kuaiqms.schemas.nonconforming_handling_schemas import (
    NonconformingHandlingCreate, NonconformingHandlingUpdate, NonconformingHandlingResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/nonconforming-handlings", tags=["NonconformingHandlings"])


@router.post("", response_model=NonconformingHandlingResponse, status_code=status.HTTP_201_CREATED, summary="创建不合格品处理")
async def create_nonconforming_handling(
    data: NonconformingHandlingCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建不合格品处理"""
    try:
        return await NonconformingHandlingService.create_nonconforming_handling(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[NonconformingHandlingResponse], summary="获取不合格品处理列表")
async def list_nonconforming_handlings(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="处理状态（过滤）"),
    handling_type: Optional[str] = Query(None, description="处理类型（过滤）"),
    nonconforming_product_uuid: Optional[str] = Query(None, description="不合格品记录UUID（过滤）")
):
    """获取不合格品处理列表"""
    return await NonconformingHandlingService.list_nonconforming_handlings(tenant_id, skip, limit, status, handling_type, nonconforming_product_uuid)


@router.get("/{handling_uuid}", response_model=NonconformingHandlingResponse, summary="获取不合格品处理详情")
async def get_nonconforming_handling(
    handling_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取不合格品处理详情"""
    try:
        return await NonconformingHandlingService.get_nonconforming_handling_by_uuid(tenant_id, handling_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{handling_uuid}", response_model=NonconformingHandlingResponse, summary="更新不合格品处理")
async def update_nonconforming_handling(
    handling_uuid: str,
    data: NonconformingHandlingUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新不合格品处理"""
    try:
        return await NonconformingHandlingService.update_nonconforming_handling(tenant_id, handling_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{handling_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除不合格品处理")
async def delete_nonconforming_handling(
    handling_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除不合格品处理"""
    try:
        await NonconformingHandlingService.delete_nonconforming_handling(tenant_id, handling_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
