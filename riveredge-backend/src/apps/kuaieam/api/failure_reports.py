"""
故障报修 API 模块

提供故障报修的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaieam.services.failure_report_service import FailureReportService
from apps.kuaieam.schemas.failure_report_schemas import (
    FailureReportCreate, FailureReportUpdate, FailureReportResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/failure-reports", tags=["FailureReports"])


@router.post("", response_model=FailureReportResponse, status_code=status.HTTP_201_CREATED, summary="创建故障报修")
async def create_failure_report(
    data: FailureReportCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建故障报修"""
    try:
        return await FailureReportService.create_failure_report(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[FailureReportResponse], summary="获取故障报修列表")
async def list_failure_reports(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    failure_type: Optional[str] = Query(None, description="故障类型（过滤）"),
    failure_level: Optional[str] = Query(None, description="故障等级（过滤）"),
    status: Optional[str] = Query(None, description="报修状态（过滤）")
):
    """获取故障报修列表"""
    return await FailureReportService.list_failure_reports(tenant_id, skip, limit, failure_type, failure_level, status)


@router.get("/{report_uuid}", response_model=FailureReportResponse, summary="获取故障报修详情")
async def get_failure_report(
    report_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取故障报修详情"""
    try:
        return await FailureReportService.get_failure_report_by_uuid(tenant_id, report_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{report_uuid}", response_model=FailureReportResponse, summary="更新故障报修")
async def update_failure_report(
    report_uuid: str,
    data: FailureReportUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新故障报修"""
    try:
        return await FailureReportService.update_failure_report(tenant_id, report_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{report_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除故障报修")
async def delete_failure_report(
    report_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除故障报修"""
    try:
        await FailureReportService.delete_failure_report(tenant_id, report_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
