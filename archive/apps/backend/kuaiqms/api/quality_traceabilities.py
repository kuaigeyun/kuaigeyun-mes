"""
质量追溯 API 模块

提供质量追溯的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiqms.services.quality_traceability_service import QualityTraceabilityService
from apps.kuaiqms.schemas.quality_traceability_schemas import (
    QualityTraceabilityCreate, QualityTraceabilityResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/quality-traceabilities", tags=["QualityTraceabilities"])


@router.post("", response_model=QualityTraceabilityResponse, status_code=status.HTTP_201_CREATED, summary="创建质量追溯")
async def create_quality_traceability(
    data: QualityTraceabilityCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建质量追溯"""
    try:
        return await QualityTraceabilityService.create_quality_traceability(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[QualityTraceabilityResponse], summary="获取质量追溯列表")
async def list_quality_traceabilities(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    trace_type: Optional[str] = Query(None, description="追溯类型（过滤）"),
    batch_no: Optional[str] = Query(None, description="批次号（过滤）"),
    serial_no: Optional[str] = Query(None, description="序列号（过滤）")
):
    """获取质量追溯列表"""
    return await QualityTraceabilityService.list_quality_traceabilities(tenant_id, skip, limit, trace_type, batch_no, serial_no)


@router.get("/{trace_uuid}", response_model=QualityTraceabilityResponse, summary="获取质量追溯详情")
async def get_quality_traceability(
    trace_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取质量追溯详情"""
    try:
        return await QualityTraceabilityService.get_quality_traceability_by_uuid(tenant_id, trace_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
