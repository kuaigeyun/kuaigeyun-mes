"""
报告管理 API 模块

提供报告管理的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuailims.services.report_management_service import ReportManagementService
from apps.kuailims.schemas.report_management_schemas import (
    ReportManagementCreate, ReportManagementUpdate, ReportManagementResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/report-managements", tags=["ReportManagements"])


@router.post("", response_model=ReportManagementResponse, status_code=status.HTTP_201_CREATED, summary="创建报告管理")
async def create_report_management(
    data: ReportManagementCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建报告管理"""
    try:
        return await ReportManagementService.create_report_management(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ReportManagementResponse], summary="获取报告管理列表")
async def list_report_managements(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    audit_status: Optional[str] = Query(None, description="审核状态（过滤）"),
    publish_status: Optional[str] = Query(None, description="发布状态（过滤）"),
    status: Optional[str] = Query(None, description="状态（过滤）")
):
    """获取报告管理列表"""
    return await ReportManagementService.list_report_managements(tenant_id, skip, limit, audit_status, publish_status, status)


@router.get("/{management_uuid}", response_model=ReportManagementResponse, summary="获取报告管理详情")
async def get_report_management(
    management_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取报告管理详情"""
    try:
        return await ReportManagementService.get_report_management_by_uuid(tenant_id, management_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{management_uuid}", response_model=ReportManagementResponse, summary="更新报告管理")
async def update_report_management(
    management_uuid: str,
    data: ReportManagementUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新报告管理"""
    try:
        return await ReportManagementService.update_report_management(tenant_id, management_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{management_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除报告管理")
async def delete_report_management(
    management_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除报告管理"""
    try:
        await ReportManagementService.delete_report_management(tenant_id, management_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

