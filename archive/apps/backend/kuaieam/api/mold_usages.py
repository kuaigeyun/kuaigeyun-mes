"""
模具使用记录 API 模块

提供模具使用记录的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaieam.services.mold_usage_service import MoldUsageService
from apps.kuaieam.schemas.mold_usage_schemas import (
    MoldUsageCreate, MoldUsageUpdate, MoldUsageResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/mold-usages", tags=["MoldUsages"])


@router.post("", response_model=MoldUsageResponse, status_code=status.HTTP_201_CREATED, summary="创建模具使用记录")
async def create_mold_usage(
    data: MoldUsageCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建模具使用记录"""
    try:
        return await MoldUsageService.create_mold_usage(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[MoldUsageResponse], summary="获取模具使用记录列表")
async def list_mold_usages(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    mold_id: Optional[int] = Query(None, description="模具ID（过滤）"),
    status: Optional[str] = Query(None, description="使用状态（过滤）")
):
    """获取模具使用记录列表"""
    return await MoldUsageService.list_mold_usages(tenant_id, skip, limit, mold_id, status)


@router.get("/{usage_uuid}", response_model=MoldUsageResponse, summary="获取模具使用记录详情")
async def get_mold_usage(
    usage_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取模具使用记录详情"""
    try:
        return await MoldUsageService.get_mold_usage_by_uuid(tenant_id, usage_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{usage_uuid}", response_model=MoldUsageResponse, summary="更新模具使用记录")
async def update_mold_usage(
    usage_uuid: str,
    data: MoldUsageUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新模具使用记录"""
    try:
        return await MoldUsageService.update_mold_usage(tenant_id, usage_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{usage_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除模具使用记录")
async def delete_mold_usage(
    usage_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除模具使用记录"""
    try:
        await MoldUsageService.delete_mold_usage(tenant_id, usage_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
