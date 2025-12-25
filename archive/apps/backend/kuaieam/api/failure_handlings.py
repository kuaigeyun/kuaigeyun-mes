"""
故障处理 API 模块

提供故障处理的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaieam.services.failure_handling_service import FailureHandlingService
from apps.kuaieam.schemas.failure_handling_schemas import (
    FailureHandlingCreate, FailureHandlingUpdate, FailureHandlingResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/failure-handlings", tags=["FailureHandlings"])


@router.post("", response_model=FailureHandlingResponse, status_code=status.HTTP_201_CREATED, summary="创建故障处理")
async def create_failure_handling(
    data: FailureHandlingCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建故障处理"""
    try:
        return await FailureHandlingService.create_failure_handling(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[FailureHandlingResponse], summary="获取故障处理列表")
async def list_failure_handlings(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    report_uuid: Optional[str] = Query(None, description="故障报修UUID（过滤）"),
    status: Optional[str] = Query(None, description="处理状态（过滤）")
):
    """获取故障处理列表"""
    return await FailureHandlingService.list_failure_handlings(tenant_id, skip, limit, report_uuid, status)


@router.get("/{handling_uuid}", response_model=FailureHandlingResponse, summary="获取故障处理详情")
async def get_failure_handling(
    handling_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取故障处理详情"""
    try:
        return await FailureHandlingService.get_failure_handling_by_uuid(tenant_id, handling_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{handling_uuid}", response_model=FailureHandlingResponse, summary="更新故障处理")
async def update_failure_handling(
    handling_uuid: str,
    data: FailureHandlingUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新故障处理"""
    try:
        return await FailureHandlingService.update_failure_handling(tenant_id, handling_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{handling_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除故障处理")
async def delete_failure_handling(
    handling_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除故障处理"""
    try:
        await FailureHandlingService.delete_failure_handling(tenant_id, handling_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
