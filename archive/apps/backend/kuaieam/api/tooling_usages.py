"""
工装夹具使用记录 API 模块

提供工装夹具使用记录的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaieam.services.tooling_usage_service import ToolingUsageService
from apps.kuaieam.schemas.tooling_usage_schemas import (
    ToolingUsageCreate, ToolingUsageUpdate, ToolingUsageResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/tooling-usages", tags=["ToolingUsages"])


@router.post("", response_model=ToolingUsageResponse, status_code=status.HTTP_201_CREATED, summary="创建工装夹具使用记录")
async def create_tooling_usage(
    data: ToolingUsageCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建工装夹具使用记录"""
    try:
        return await ToolingUsageService.create_tooling_usage(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ToolingUsageResponse], summary="获取工装夹具使用记录列表")
async def list_tooling_usages(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    tooling_id: Optional[int] = Query(None, description="工装夹具ID（过滤）"),
    status: Optional[str] = Query(None, description="使用状态（过滤）")
):
    """获取工装夹具使用记录列表"""
    return await ToolingUsageService.list_tooling_usages(tenant_id, skip, limit, tooling_id, status)


@router.get("/{usage_uuid}", response_model=ToolingUsageResponse, summary="获取工装夹具使用记录详情")
async def get_tooling_usage(
    usage_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取工装夹具使用记录详情"""
    try:
        return await ToolingUsageService.get_tooling_usage_by_uuid(tenant_id, usage_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{usage_uuid}", response_model=ToolingUsageResponse, summary="更新工装夹具使用记录")
async def update_tooling_usage(
    usage_uuid: str,
    data: ToolingUsageUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新工装夹具使用记录"""
    try:
        return await ToolingUsageService.update_tooling_usage(tenant_id, usage_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{usage_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除工装夹具使用记录")
async def delete_tooling_usage(
    usage_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除工装夹具使用记录"""
    try:
        await ToolingUsageService.delete_tooling_usage(tenant_id, usage_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
