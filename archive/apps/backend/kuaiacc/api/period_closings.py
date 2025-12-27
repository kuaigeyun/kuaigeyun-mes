"""
期末结账 API 模块

提供期末结账的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiacc.services.period_closing_service import PeriodClosingService
from apps.kuaiacc.schemas.period_closing_schemas import (
    PeriodClosingCreate, PeriodClosingUpdate, PeriodClosingResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/period-closings", tags=["Period Closings"])


@router.post("", response_model=PeriodClosingResponse, summary="创建期末结账")
async def create_period_closing(
    data: PeriodClosingCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建期末结账"""
    try:
        return await PeriodClosingService.create_period_closing(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[PeriodClosingResponse], summary="获取期末结账列表")
async def list_period_closings(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    closing_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None)
):
    """获取期末结账列表"""
    return await PeriodClosingService.list_period_closings(tenant_id, skip, limit, closing_type, status)


@router.get("/{closing_uuid}", response_model=PeriodClosingResponse, summary="获取期末结账详情")
async def get_period_closing(
    closing_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取期末结账详情"""
    try:
        return await PeriodClosingService.get_period_closing_by_uuid(tenant_id, closing_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{closing_period}/check", summary="结账前检查")
async def check_before_closing(
    closing_period: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """结账前检查"""
    return await PeriodClosingService.check_before_closing(tenant_id, closing_period)


@router.post("/{closing_uuid}/execute", response_model=PeriodClosingResponse, summary="执行结账")
async def execute_closing(
    closing_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """执行结账"""
    try:
        return await PeriodClosingService.execute_closing(tenant_id, closing_uuid, current_user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
