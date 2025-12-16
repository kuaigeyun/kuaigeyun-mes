"""
评估报告 API 模块

提供评估报告的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicert.services.assessment_report_service import AssessmentReportService
from apps.kuaicert.schemas.assessment_report_schemas import (
    AssessmentReportCreate, AssessmentReportUpdate, AssessmentReportResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/assessment-report", tags=["评估报告"])


@router.post("", response_model=AssessmentReportResponse, summary="创建评估报告")
async def create_assessmentreport(
    data: AssessmentReportCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建评估报告"""
    try:
        return await AssessmentReportService.create_assessmentreport(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[AssessmentReportResponse], summary="获取评估报告列表")
async def list_assessmentreports(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取评估报告列表"""
    return await AssessmentReportService.list_assessmentreports(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=AssessmentReportResponse, summary="获取评估报告详情")
async def get_assessmentreport(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取评估报告详情"""
    try:
        return await AssessmentReportService.get_assessmentreport_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=AssessmentReportResponse, summary="更新评估报告")
async def update_assessmentreport(
    obj_uuid: str,
    data: AssessmentReportUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新评估报告"""
    try:
        return await AssessmentReportService.update_assessmentreport(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除评估报告")
async def delete_assessmentreport(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除评估报告（软删除）"""
    try:
        await AssessmentReportService.delete_assessmentreport(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
