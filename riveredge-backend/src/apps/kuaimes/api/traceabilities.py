"""
生产追溯 API 模块

提供生产追溯的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaimes.services.traceability_service import TraceabilityService
from apps.kuaimes.schemas.traceability_schemas import (
    TraceabilityCreate, TraceabilityResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/traceabilities", tags=["Traceabilities"])


@router.post("", response_model=TraceabilityResponse, status_code=status.HTTP_201_CREATED, summary="创建生产追溯")
async def create_traceability(
    data: TraceabilityCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建生产追溯"""
    try:
        return await TraceabilityService.create_traceability(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[TraceabilityResponse], summary="获取生产追溯列表")
async def list_traceabilities(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    batch_no: Optional[str] = Query(None, description="批次号（过滤）"),
    serial_no: Optional[str] = Query(None, description="序列号（过滤）")
):
    """获取生产追溯列表"""
    return await TraceabilityService.list_traceabilities(tenant_id, skip, limit, batch_no, serial_no)


@router.get("/{trace_uuid}", response_model=TraceabilityResponse, summary="获取生产追溯详情")
async def get_traceability(
    trace_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取生产追溯详情"""
    try:
        return await TraceabilityService.get_traceability_by_uuid(tenant_id, trace_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
