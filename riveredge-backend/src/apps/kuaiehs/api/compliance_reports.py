"""
合规报告 API 模块

提供合规报告的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiehs.services.compliance_report_service import ComplianceReportService
from apps.kuaiehs.schemas.compliance_report_schemas import (
    ComplianceReportCreate, ComplianceReportUpdate, ComplianceReportResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/compliance-report", tags=["合规报告"])


@router.post("", response_model=ComplianceReportResponse, summary="创建合规报告")
async def create_compliancereport(
    data: ComplianceReportCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建合规报告"""
    try:
        return await ComplianceReportService.create_compliancereport(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ComplianceReportResponse], summary="获取合规报告列表")
async def list_compliancereports(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取合规报告列表"""
    return await ComplianceReportService.list_compliancereports(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=ComplianceReportResponse, summary="获取合规报告详情")
async def get_compliancereport(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取合规报告详情"""
    try:
        return await ComplianceReportService.get_compliancereport_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=ComplianceReportResponse, summary="更新合规报告")
async def update_compliancereport(
    obj_uuid: str,
    data: ComplianceReportUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新合规报告"""
    try:
        return await ComplianceReportService.update_compliancereport(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除合规报告")
async def delete_compliancereport(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除合规报告（软删除）"""
    try:
        await ComplianceReportService.delete_compliancereport(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
